// src/sidepanel/sidepanel.ts

import type { Session } from '../types/session';
import type { APIStatus } from '../types/ai-judge';
import type { Message } from '../types/messages';
import { ConfigStorage, type APIProviderConfig } from '../services/config-storage';

interface LogEntry {
  timestamp: string;
  action: string;
  message: string;
  type?: 'info' | 'success' | 'error';
}

interface DelaySendState {
  timerId: number | null;
  remaining: number;
  text: string;
  isActive: boolean;
}

type SessionRole = 'leader' | 'executor';

interface ChatMessageData {
  role: string;
  content: string;
  index: number;
}

type APIProvider = 'deepseek' | 'openai';

class DebugConsole {
  private sessions: Session[] = [];
  private logs: LogEntry[] = [];
  private configStorage: ConfigStorage;
  private delaySendState: DelaySendState = { timerId: null, remaining: 0, text: '', isActive: false };
  private sessionRoles: Map<string, SessionRole> = new Map();
  private chatMessages: ChatMessageData[] = [];
  private activeProvider: APIProvider = 'deepseek';
  private lastScreenshotDataUrl: string | null = null;

  constructor() {
    this.configStorage = new ConfigStorage();
    this.initPanelToggles();
    this.initEventListeners();
    this.initResizeHandles();
    this.loadAPIConfigs();
    this.loadSessionRoles();
    this.log('信息', '调试控制台已初始化');
  }

  // ==================== Panel Toggle ====================

  private initPanelToggles(): void {
    const panelHeaders = document.querySelectorAll('.panel-header[data-toggle]');
    panelHeaders.forEach((header) => {
      header.addEventListener('click', () => {
        const panel = header.closest('.panel');
        if (panel) {
          panel.classList.toggle('collapsed');
        }
      });
    });
  }

  // ==================== Event Listeners ====================

  private initEventListeners(): void {
    // API Provider 选择
    document.getElementById('active-api-provider')?.addEventListener('change', (e) => {
      this.activeProvider = (e.target as HTMLSelectElement).value as APIProvider;
      this.saveActiveProvider();
      this.log('配置', `已切换到 ${this.activeProvider.toUpperCase()} API`);
    });

    // 显示价格按钮
    document.getElementById('show-pricing-btn')?.addEventListener('click', () => {
      this.showPricingModal();
    });

    // Environment / API Config section - DeepSeek
    document.getElementById('save-deepseek-btn')?.addEventListener('click', () => {
      this.saveAPIConfig('deepseek');
    });
    document.getElementById('check-deepseek-btn')?.addEventListener('click', () => {
      this.checkAPI('deepseek');
    });

    // Environment / API Config section - OpenAI
    document.getElementById('save-openai-btn')?.addEventListener('click', () => {
      this.saveAPIConfig('openai');
    });
    document.getElementById('check-openai-btn')?.addEventListener('click', () => {
      this.checkAPI('openai');
    });

    // Auto-save on blur for API config inputs - DeepSeek
    const baseUrlEl = document.getElementById('deepseek-base-url');
    const apiKeyEl = document.getElementById('deepseek-api-key');
    baseUrlEl?.addEventListener('blur', () => this.saveAPIConfig('deepseek'));
    apiKeyEl?.addEventListener('blur', () => this.saveAPIConfig('deepseek'));

    // Auto-save on blur for API config inputs - OpenAI
    const openaiBaseUrlEl = document.getElementById('openai-base-url');
    const openaiApiKeyEl = document.getElementById('openai-api-key');
    openaiBaseUrlEl?.addEventListener('blur', () => this.saveAPIConfig('openai'));
    openaiApiKeyEl?.addEventListener('blur', () => this.saveAPIConfig('openai'));

    // API Test Chat section
    document.getElementById('chat-send-btn')?.addEventListener('click', () => {
      this.sendChatMessage();
    });
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendChatMessage();
      }
    });
    document.getElementById('chat-clear-btn')?.addEventListener('click', () => {
      this.clearChatMessages();
    });

    // Logs section
    document.getElementById('export-logs-btn')?.addEventListener('click', () => {
      this.exportSnapshot();
    });
    document.getElementById('clear-logs-btn')?.addEventListener('click', () => {
      this.clearLogs();
    });

    // Happy Debug section
    document.getElementById('get-sessions-btn')?.addEventListener('click', () => {
      this.getSessions();
    });
    document.getElementById('simulate-input-btn')?.addEventListener('click', () => {
      this.simulateInput();
    });
    document.getElementById('simulate-send-btn')?.addEventListener('click', () => {
      this.simulateSendWithDelay();
    });
    document.getElementById('clear-input-btn')?.addEventListener('click', () => {
      this.clearInputBox();
    });
    document.getElementById('ai-analysis-btn')?.addEventListener('click', () => {
      this.analyzeWithAI();
    });
    // AI 分析区域 provider 切换时更新模型列表
    document.getElementById('ai-analysis-provider')?.addEventListener('change', (e) => {
      this.updateAIAnalysisModelOptions((e.target as HTMLSelectElement).value as APIProvider);
    });
    document.getElementById('screenshot-btn')?.addEventListener('click', () => {
      this.takeScreenshot();
    });
    document.getElementById('view-screenshot-btn')?.addEventListener('click', () => {
      this.showScreenshotPreview();
    });
    document.getElementById('read-content-btn')?.addEventListener('click', () => {
      this.readChatContent();
    });
    document.getElementById('clear-content-btn')?.addEventListener('click', () => {
      this.clearChatContent();
    });
    document.getElementById('export-content-btn')?.addEventListener('click', () => {
      this.exportChatContent();
    });
    document.getElementById('cancel-delay-send-btn')?.addEventListener('click', () => {
      this.cancelDelaySend();
    });
  }

  // ==================== Communication ====================

  private async sendToContent<T>(message: Message): Promise<T | null> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        this.log('错误', '未找到活动标签页');
        return null;
      }

      // 尝试注入 content script（如果尚未注入）
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      } catch {
        // 如果已经注入或者没有权限，忽略错误
      }

      const response = await chrome.tabs.sendMessage(tab.id, message);
      return response as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('错误', `内容脚本通信失败: ${errorMessage}`);
      console.error('[Happy Debug] sendToContent error:', error);
      return null;
    }
  }

  private async sendToBackground<T>(message: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response as T;
    } catch (error) {
      this.log('错误', `后台错误: ${error}`);
      return null;
    }
  }

  // ==================== Logging ====================

  private log(action: string, message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString().substring(11, 19),
      action,
      message,
      type,
    };
    this.logs.push(entry);
    this.appendLogEntry(entry);

    // Also log to background for persistence
    this.sendToBackground({
      type: 'LOG_ACTION',
      action,
      data: { message, type },
    });
  }

  private appendLogEntry(entry: LogEntry): void {
    const logViewer = document.getElementById('log-viewer');
    if (!logViewer) return;

    // Remove empty state if present
    const emptyState = logViewer.querySelector('.log-empty');
    if (emptyState) {
      emptyState.remove();
    }

    const entryEl = document.createElement('div');
    entryEl.className = `log-entry log-${entry.type || 'info'}`;
    entryEl.innerHTML = `
      <span class="log-timestamp">${entry.timestamp}</span>
      <span class="log-action">[${entry.action}]</span>
      <span class="log-message">${this.escapeHtml(entry.message)}</span>
    `;
    logViewer.appendChild(entryEl);
    logViewer.scrollTop = logViewer.scrollHeight;
  }

  // ==================== API Config ====================

  private async loadAPIConfigs(): Promise<void> {
    const configs = await this.configStorage.getAll();

    // 加载 DeepSeek 配置
    const deepseekBaseUrl = document.getElementById('deepseek-base-url') as HTMLInputElement;
    const deepseekApiKey = document.getElementById('deepseek-api-key') as HTMLInputElement;
    const deepseekModel = document.getElementById('deepseek-model') as HTMLSelectElement;
    if (deepseekBaseUrl) deepseekBaseUrl.value = configs.deepseek.baseUrl;
    if (deepseekApiKey) deepseekApiKey.value = configs.deepseek.apiKey;
    if (deepseekModel && configs.deepseek.model) deepseekModel.value = configs.deepseek.model;

    // 加载 OpenAI 配置
    const openaiBaseUrl = document.getElementById('openai-base-url') as HTMLInputElement;
    const openaiApiKey = document.getElementById('openai-api-key') as HTMLInputElement;
    const openaiModel = document.getElementById('openai-model') as HTMLSelectElement;
    if (openaiBaseUrl) openaiBaseUrl.value = configs.openai.baseUrl;
    if (openaiApiKey) openaiApiKey.value = configs.openai.apiKey;
    if (openaiModel && configs.openai.model) openaiModel.value = configs.openai.model;

    // 加载当前选择的 provider
    await this.loadActiveProvider();

    // 同步 AI 分析区域的 provider 和 model 选择
    this.syncAIAnalysisSelectors();

    this.log('配置', '已加载 API 配置');
  }

  /**
   * 同步 AI 分析区域的 API 和模型选择
   */
  private syncAIAnalysisSelectors(): void {
    const providerEl = document.getElementById('ai-analysis-provider') as HTMLSelectElement;
    if (providerEl) {
      providerEl.value = this.activeProvider;
    }
    this.updateAIAnalysisModelOptions(this.activeProvider);
  }

  /**
   * 根据选择的 provider 更新 AI 分析区域的模型选项
   */
  private updateAIAnalysisModelOptions(provider: APIProvider): void {
    const modelEl = document.getElementById('ai-analysis-model') as HTMLSelectElement;
    if (!modelEl) return;

    // 获取当前配置中保存的模型
    const configModelEl = document.getElementById(`${provider}-model`) as HTMLSelectElement;
    const savedModel = configModelEl?.value;

    // 根据 provider 更新选项
    if (provider === 'deepseek') {
      modelEl.innerHTML = `
        <option value="deepseek-chat">deepseek-chat</option>
        <option value="deepseek-coder">deepseek-coder</option>
        <option value="deepseek-reasoner">deepseek-reasoner</option>
      `;
    } else {
      modelEl.innerHTML = `
        <option value="gpt-4o">gpt-4o</option>
        <option value="gpt-4o-mini">gpt-4o-mini</option>
        <option value="gpt-4-turbo">gpt-4-turbo</option>
        <option value="gpt-4">gpt-4</option>
        <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
      `;
    }

    // 如果有保存的模型，选中它
    if (savedModel) {
      modelEl.value = savedModel;
    }
  }

  private async loadActiveProvider(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('activeAPIProvider');
      if (result.activeAPIProvider) {
        this.activeProvider = result.activeAPIProvider as APIProvider;
      }
      const selectEl = document.getElementById('active-api-provider') as HTMLSelectElement;
      if (selectEl) {
        selectEl.value = this.activeProvider;
      }
    } catch (error) {
      console.error('[Happy Debug] loadActiveProvider error:', error);
    }
  }

  private async saveActiveProvider(): Promise<void> {
    try {
      await chrome.storage.local.set({ activeAPIProvider: this.activeProvider });
    } catch (error) {
      console.error('[Happy Debug] saveActiveProvider error:', error);
    }
  }

  private async saveAPIConfig(provider: APIProvider): Promise<void> {
    const baseUrlEl = document.getElementById(`${provider}-base-url`) as HTMLInputElement;
    const apiKeyEl = document.getElementById(`${provider}-api-key`) as HTMLInputElement;
    const modelEl = document.getElementById(`${provider}-model`) as HTMLSelectElement;
    const saveBtn = document.getElementById(`save-${provider}-btn`);

    if (!baseUrlEl || !apiKeyEl) return;

    const config: Partial<APIProviderConfig> = {
      baseUrl: baseUrlEl.value.trim(),
      apiKey: apiKeyEl.value.trim(),
      model: modelEl?.value || undefined,
      enabled: true,
    };

    if (saveBtn) saveBtn.classList.add('loading');

    try {
      await this.configStorage.save(provider, config);
      this.log('配置', `${provider.toUpperCase()} 配置已保存`, 'success');

      // 视觉反馈
      baseUrlEl.classList.remove('error');
      apiKeyEl.classList.remove('error');
      baseUrlEl.classList.add('success');
      apiKeyEl.classList.add('success');
      setTimeout(() => {
        baseUrlEl.classList.remove('success');
        apiKeyEl.classList.remove('success');
      }, 2000);
    } catch (error) {
      this.log('配置', `保存失败: ${error}`, 'error');
      baseUrlEl.classList.add('error');
      apiKeyEl.classList.add('error');
    } finally {
      if (saveBtn) saveBtn.classList.remove('loading');
    }
  }

  private getAPIConfigFromForm(provider: APIProvider): { apiKey: string; baseUrl: string; model?: string } | null {
    const baseUrlEl = document.getElementById(`${provider}-base-url`) as HTMLInputElement;
    const apiKeyEl = document.getElementById(`${provider}-api-key`) as HTMLInputElement;
    const modelEl = document.getElementById(`${provider}-model`) as HTMLSelectElement;

    if (!baseUrlEl || !apiKeyEl) return null;

    const baseUrl = baseUrlEl.value.trim();
    const apiKey = apiKeyEl.value.trim();

    if (!baseUrl || !apiKey) {
      return null;
    }

    return { baseUrl, apiKey, model: modelEl?.value || undefined };
  }

  /**
   * 获取当前选择的 API 配置
   */
  private getActiveAPIConfig(): { provider: APIProvider; apiKey: string; baseUrl: string; model?: string } | null {
    const config = this.getAPIConfigFromForm(this.activeProvider);
    if (!config) return null;
    return {
      provider: this.activeProvider,
      ...config,
    };
  }

  // ==================== API Check ====================

  async checkAPI(provider: APIProvider): Promise<void> {
    const statusEl = document.getElementById(`${provider}-status`);
    const btn = document.getElementById(`check-${provider}-btn`);

    // 获取当前表单中的配置
    const formConfig = this.getAPIConfigFromForm(provider);

    if (!formConfig) {
      if (statusEl) {
        statusEl.textContent = '未配置';
        statusEl.className = 'api-indicator error';
      }
      this.log('API检查', `${provider.toUpperCase()} 未配置 API Key 或 Base URL`, 'error');
      return;
    }

    if (statusEl) {
      statusEl.textContent = '...';
      statusEl.className = 'api-indicator';
    }
    if (btn) btn.classList.add('loading');

    this.log('API检查', `正在检查 ${provider.toUpperCase()} API...`);

    const response = await this.sendToBackground<APIStatus>({
      type: 'CHECK_API',
      provider,
      config: {
        provider,
        apiKey: formConfig.apiKey,
        baseUrl: formConfig.baseUrl,
      },
    });

    if (btn) btn.classList.remove('loading');

    if (response && response.connected) {
      if (statusEl) {
        statusEl.textContent = `${response.latency}ms`;
        statusEl.className = 'api-indicator connected';
      }
      this.log('API检查', `${provider.toUpperCase()} 已连接 (${response.latency}ms)`, 'success');
    } else {
      if (statusEl) {
        statusEl.textContent = 'Error';
        statusEl.className = 'api-indicator error';
      }
      this.log('API检查', `${provider.toUpperCase()} 失败: ${response?.error || '未知错误'}`, 'error');
    }
  }

  // ==================== API Test Chat ====================

  private async sendChatMessage(): Promise<void> {
    const inputEl = document.getElementById('chat-input') as HTMLInputElement;
    const sendBtn = document.getElementById('chat-send-btn');

    if (!inputEl) return;

    const message = inputEl.value.trim();
    if (!message) return;

    const activeConfig = this.getActiveAPIConfig();

    if (!activeConfig) {
      this.addChatMessage(`请先配置 ${this.activeProvider.toUpperCase()} 的 API Key 和 Base URL`, 'error');
      this.log('聊天', `${this.activeProvider.toUpperCase()} 未配置`, 'error');
      return;
    }

    // 显示用户消息
    this.addChatMessage(message, 'user');
    inputEl.value = '';

    if (sendBtn) sendBtn.classList.add('loading');
    this.log('聊天', `发送到 ${this.activeProvider.toUpperCase()}: ${message.substring(0, 30)}...`);

    const response = await this.sendToBackground<{
      success: boolean;
      content?: string;
      error?: string;
      latency?: number;
    }>({
      type: 'CHAT_TEST',
      provider: this.activeProvider,
      message,
      config: {
        provider: this.activeProvider,
        apiKey: activeConfig.apiKey,
        baseUrl: activeConfig.baseUrl,
        model: activeConfig.model,
      },
    });

    if (sendBtn) sendBtn.classList.remove('loading');

    if (response?.success && response.content) {
      this.addChatMessage(response.content, 'assistant', response.latency);
      this.log('聊天', `${this.activeProvider.toUpperCase()} 响应成功 (${response.latency}ms)`, 'success');
    } else {
      this.addChatMessage(response?.error || '请求失败', 'error');
      this.log('聊天', `${this.activeProvider.toUpperCase()} 失败: ${response?.error || '未知错误'}`, 'error');
    }
  }

  private addChatMessage(content: string, type: 'user' | 'assistant' | 'error', latency?: number): void {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    // 移除空状态
    const emptyState = messagesEl.querySelector('.chat-empty');
    if (emptyState) {
      emptyState.remove();
    }

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;

    let html = `<div class="chat-content">${this.escapeHtml(content)}</div>`;
    if (type === 'assistant' && latency !== undefined) {
      html += `<div class="chat-meta">${latency}ms</div>`;
    }

    messageEl.innerHTML = html;
    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  private clearChatMessages(): void {
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) {
      messagesEl.innerHTML = '<div class="chat-empty">发送消息测试 API 是否正常工作</div>';
    }
    this.log('聊天', '聊天记录已清空');
  }

  // ==================== Logs Export ====================

  async exportSnapshot(): Promise<void> {
    this.log('导出', '正在导出调试快照...');

    const response = await this.sendToBackground<{ snapshot: Record<string, unknown> }>({
      type: 'EXPORT_SNAPSHOT',
    });

    if (response?.snapshot) {
      const dataStr = JSON.stringify(response.snapshot, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `happy-debug-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.log('导出', '快照导出成功', 'success');
    } else {
      this.log('导出', '快照导出失败', 'error');
    }
  }

  clearLogs(): void {
    this.logs = [];
    const logViewer = document.getElementById('log-viewer');
    if (logViewer) {
      logViewer.innerHTML = '<div class="log-empty">暂无日志。</div>';
    }
    this.log('日志', '日志已清空');
  }

  // ==================== Session Roles ====================

  private async loadSessionRoles(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('sessionRoles');
      if (result.sessionRoles) {
        this.sessionRoles = new Map(Object.entries(result.sessionRoles) as [string, SessionRole][]);
      }
    } catch (error) {
      console.error('[Happy Debug] loadSessionRoles error:', error);
    }
  }

  private async saveSessionRole(sessionId: string, role: SessionRole): Promise<void> {
    this.sessionRoles.set(sessionId, role);
    const roles = Object.fromEntries(this.sessionRoles);
    await chrome.storage.local.set({ sessionRoles: roles });
    this.log('角色', `已设置为 ${role === 'leader' ? '主导方' : '执行方'}`, 'success');
  }

  private async clearSessionRole(sessionId: string): Promise<void> {
    this.sessionRoles.delete(sessionId);
    const roles = Object.fromEntries(this.sessionRoles);
    await chrome.storage.local.set({ sessionRoles: roles });
    this.log('角色', '已清除角色', 'info');
  }

  // ==================== Happy Debug - Sessions ====================

  private async getSessions(): Promise<void> {
    const btn = document.getElementById('get-sessions-btn');
    const countEl = document.getElementById('session-count');
    const listEl = document.getElementById('sessions-list');

    if (btn) btn.classList.add('loading');
    this.log('会话', '正在获取会话列表...');

    const response = await this.sendToContent<{
      success: boolean;
      data: Array<{ id: string; title: string; active: boolean; selector: string }>;
    }>({ type: 'GET_SESSIONS_LIST' });

    if (btn) btn.classList.remove('loading');

    if (response?.success && response.data) {
      const sessions = response.data;
      if (countEl) countEl.textContent = String(sessions.length);

      if (listEl) {
        if (sessions.length === 0) {
          listEl.innerHTML = '<div class="debug-empty">未找到会话</div>';
        } else {
          listEl.innerHTML = sessions.map((session, index) => {
            const role = this.sessionRoles.get(session.id);
            const roleLabel = role === 'leader' ? '主导方' : role === 'executor' ? '执行方' : '';
            const roleClass = role === 'leader' ? 'role-leader' : role === 'executor' ? 'role-executor' : '';

            return `
              <div class="session-list-item ${session.active ? 'active' : ''}" data-session-id="${session.id}" data-selector="${this.escapeHtml(session.selector)}">
                <div class="session-info">
                  <span class="session-index">${index + 1}.</span>
                  <span class="session-title">${this.escapeHtml(session.title)}</span>
                  ${roleLabel ? `<span class="session-role-badge ${roleClass}">${roleLabel}</span>` : ''}
                </div>
                <div class="session-actions">
                  <button class="btn btn-tiny btn-secondary select-session-btn" data-selector="${this.escapeHtml(session.selector)}" title="模拟选择">选择</button>
                  <button class="btn btn-tiny btn-secondary set-role-btn" data-session-id="${session.id}" title="设置角色">角色</button>
                </div>
              </div>
            `;
          }).join('');

          // 绑定事件
          this.bindSessionListEvents();
        }
      }

      this.log('会话', `找到 ${sessions.length} 个会话`, 'success');
    } else {
      if (countEl) countEl.textContent = '错误';
      if (listEl) listEl.innerHTML = '<div class="debug-empty">获取失败</div>';
      this.log('会话', '获取会话列表失败', 'error');
    }
  }

  private bindSessionListEvents(): void {
    // 模拟选择按钮
    document.querySelectorAll('.select-session-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const selector = (btn as HTMLElement).dataset.selector;
        if (selector) {
          await this.selectSession(selector);
        }
      });
    });

    // 设置角色按钮
    document.querySelectorAll('.set-role-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sessionId = (btn as HTMLElement).dataset.sessionId;
        if (sessionId) {
          await this.showRoleSelectionModal(sessionId);
        }
      });
    });
  }

  private async selectSession(selector: string): Promise<void> {
    this.log('会话', `正在选择会话: ${selector.substring(0, 50)}...`);
    const response = await this.sendToContent<{ success: boolean }>({
      type: 'CLICK_ELEMENT',
      selector,
    });

    if (response?.success) {
      this.log('会话', '会话选择成功', 'success');
      // 延迟刷新会话列表
      setTimeout(() => this.getSessions(), 500);
    } else {
      this.log('会话', `会话选择失败，选择器: ${selector}`, 'error');
    }
  }

  private showRoleSelectionModal(sessionId: string): Promise<void> {
    return new Promise((resolve) => {
      const currentRole = this.sessionRoles.get(sessionId);

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const content = document.createElement('div');
      content.className = 'modal-content';

      content.innerHTML = `
        <div class="modal-header">
          <span class="modal-title">设置页面角色</span>
        </div>
        <div class="modal-body">
          <p class="modal-message">选择此会话的角色：</p>
          <div class="role-selection">
            <button class="btn btn-full ${currentRole === 'leader' ? 'btn-primary' : 'btn-secondary'}" id="role-leader-btn">
              主导方 (Leader)
            </button>
            <button class="btn btn-full ${currentRole === 'executor' ? 'btn-primary' : 'btn-secondary'}" id="role-executor-btn">
              执行方 (Executor)
            </button>
            <button class="btn btn-full btn-warning" id="role-clear-btn">
              清除角色
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel-btn">取消</button>
        </div>
      `;

      overlay.appendChild(content);
      document.body.appendChild(overlay);

      const cleanup = () => {
        document.body.removeChild(overlay);
        resolve();
      };

      content.querySelector('#role-leader-btn')?.addEventListener('click', () => {
        this.saveSessionRole(sessionId, 'leader');
        cleanup();
        this.getSessions(); // 刷新列表显示角色
      });

      content.querySelector('#role-executor-btn')?.addEventListener('click', () => {
        this.saveSessionRole(sessionId, 'executor');
        cleanup();
        this.getSessions();
      });

      content.querySelector('#role-clear-btn')?.addEventListener('click', () => {
        this.clearSessionRole(sessionId);
        cleanup();
        this.getSessions();
      });

      content.querySelector('#modal-cancel-btn')?.addEventListener('click', cleanup);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup();
      });
    });
  }

  // ==================== Happy Debug - Input Simulation ====================

  private async simulateInput(): Promise<void> {
    const textEl = document.getElementById('input-text') as HTMLTextAreaElement;
    const resultEl = document.getElementById('input-result');
    const text = textEl?.value.trim() || '';

    if (!text) {
      this.log('输入', '请输入测试文字', 'error');
      return;
    }

    this.log('输入', `正在输入: ${text.substring(0, 20)}...`);

    const response = await this.sendToContent<{ success: boolean }>({
      type: 'INPUT_TEXT',
      selector: 'happy-input',
      text,
    });

    if (response?.success) {
      if (resultEl) resultEl.innerHTML = `<div style="color: #4caf50;">✓ 输入成功: "${this.escapeHtml(text.substring(0, 30))}${text.length > 30 ? '...' : ''}"</div>`;
      this.log('输入', '输入成功', 'success');
    } else {
      if (resultEl) resultEl.innerHTML = '<div style="color: #f44336;">✗ 输入失败</div>';
      this.log('输入', '输入失败', 'error');
    }
  }

  private async simulateSendWithDelay(): Promise<void> {
    const textEl = document.getElementById('input-text') as HTMLTextAreaElement;
    const delayEl = document.getElementById('delay-seconds') as HTMLInputElement;
    const text = textEl?.value.trim() || '';
    const delay = parseInt(delayEl?.value || '0', 10);

    // 如果有输入文字，先模拟输入
    if (text) {
      const inputResponse = await this.sendToContent<{ success: boolean }>({
        type: 'INPUT_TEXT',
        selector: 'happy-input',
        text,
      });

      if (!inputResponse?.success) {
        this.log('发送', '输入失败，无法发送', 'error');
        return;
      }
    }

    if (delay > 0) {
      // 启动延时发送
      this.startDelaySend(delay, text);
    } else {
      // 直接发送（不管有没有输入文字，因为用户可能已经手动输入了）
      await this.executeSimulateSend();
    }
  }

  private startDelaySend(seconds: number, text: string): void {
    this.delaySendState = {
      timerId: null,
      remaining: seconds,
      text,
      isActive: true,
    };

    // 显示顶部提示条
    this.showDelayBanner(seconds);

    // 启动倒计时
    this.delaySendState.timerId = window.setInterval(() => {
      this.delaySendState.remaining--;
      this.updateDelayCountdown(this.delaySendState.remaining);

      if (this.delaySendState.remaining <= 0) {
        this.executeDelaySend();
      }
    }, 1000);

    this.log('发送', `将在 ${seconds} 秒后发送`, 'info');
  }

  private cancelDelaySend(): void {
    if (this.delaySendState.timerId) {
      clearInterval(this.delaySendState.timerId);
    }
    this.hideDelayBanner();
    this.delaySendState.isActive = false;
    this.log('发送', '延时发送已取消', 'info');
  }

  private async executeDelaySend(): Promise<void> {
    if (this.delaySendState.timerId) {
      clearInterval(this.delaySendState.timerId);
    }
    this.hideDelayBanner();
    this.delaySendState.isActive = false;

    await this.executeSimulateSend();
  }

  private async executeSimulateSend(): Promise<void> {
    const resultEl = document.getElementById('input-result');
    this.log('发送', '正在模拟发送...');

    const response = await this.sendToContent<{ success: boolean }>({
      type: 'SIMULATE_SEND',
    });

    if (response?.success) {
      if (resultEl) resultEl.innerHTML = '<div style="color: #4caf50;">✓ 发送指令已执行</div>';
      this.log('发送', '发送指令已执行', 'success');
    } else {
      if (resultEl) resultEl.innerHTML = '<div style="color: #f44336;">✗ 发送失败</div>';
      this.log('发送', '发送失败', 'error');
    }
  }

  private showDelayBanner(seconds: number): void {
    const banner = document.getElementById('delay-send-banner');
    const countdown = document.getElementById('delay-countdown');
    if (banner) banner.style.display = 'block';
    if (countdown) countdown.textContent = String(seconds);
  }

  private hideDelayBanner(): void {
    const banner = document.getElementById('delay-send-banner');
    if (banner) banner.style.display = 'none';
  }

  private updateDelayCountdown(seconds: number): void {
    const countdown = document.getElementById('delay-countdown');
    if (countdown) countdown.textContent = String(seconds);
  }

  private async clearInputBox(): Promise<void> {
    const resultEl = document.getElementById('input-result');
    this.log('输入', '正在清空输入框...');

    const response = await this.sendToContent<{ success: boolean }>({
      type: 'CLEAR_INPUT',
    });

    if (response?.success) {
      if (resultEl) resultEl.innerHTML = '<div style="color: #4caf50;">✓ 输入框已清空</div>';
      this.log('输入', '输入框已清空', 'success');
    } else {
      if (resultEl) resultEl.innerHTML = '<div style="color: #f44336;">✗ 清空失败</div>';
      this.log('输入', '清空失败', 'error');
    }
  }

  // ==================== AI Analysis ====================

  /**
   * 获取 AI 分析区域选择的配置
   */
  private getAIAnalysisConfig(): { provider: APIProvider; apiKey: string; baseUrl: string; model?: string } | null {
    const providerEl = document.getElementById('ai-analysis-provider') as HTMLSelectElement;
    const modelEl = document.getElementById('ai-analysis-model') as HTMLSelectElement;

    const provider = (providerEl?.value || 'deepseek') as APIProvider;
    const model = modelEl?.value;

    // 从对应 provider 的配置表单中获取 apiKey 和 baseUrl
    const config = this.getAPIConfigFromForm(provider);
    if (!config) return null;

    return {
      provider,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: model || config.model,
    };
  }

  private async analyzeWithAI(): Promise<void> {
    const btn = document.getElementById('ai-analysis-btn');
    const viewBtn = document.getElementById('view-screenshot-btn');
    const resultEl = document.getElementById('ai-analysis-result');
    const promptEl = document.getElementById('ai-analysis-prompt') as HTMLTextAreaElement;
    const providerEl = document.getElementById('ai-analysis-provider') as HTMLSelectElement;
    const modelEl = document.getElementById('ai-analysis-model') as HTMLSelectElement;

    const prompt = promptEl?.value.trim() || '读取右边区域的内容分析当前最应该选底部那个选择按钮答案和原因';
    const selectedProvider = (providerEl?.value || 'deepseek') as APIProvider;
    const selectedModel = modelEl?.value || '';

    // 检查 DeepSeek 是否支持视觉分析
    if (selectedProvider === 'deepseek') {
      if (resultEl) {
        resultEl.innerHTML = `<div class="analysis-error">⚠️ DeepSeek API 不支持图像分析功能。<br><br>请切换到 OpenAI (gpt-4o) 进行截图分析，或使用 DeepSeek 进行纯文本分析。</div>`;
      }
      this.log('AI分析', 'DeepSeek 不支持图像分析', 'error');
      return;
    }

    // 检查 API 配置（使用 AI 分析区域选择的 provider）
    const analysisConfig = this.getAIAnalysisConfig();
    if (!analysisConfig) {
      if (resultEl) {
        resultEl.innerHTML = `<div class="analysis-error">请先在"环境 / API 配置"中配置 ${selectedProvider.toUpperCase()} API</div>`;
      }
      this.log('AI分析', `${selectedProvider.toUpperCase()} API 未配置`, 'error');
      return;
    }

    if (btn) btn.classList.add('loading');
    if (resultEl) {
      resultEl.innerHTML = `<div class="analysis-loading">正在使用 ${selectedProvider.toUpperCase()} (${selectedModel}) 截图分析中...</div>`;
    }
    this.log('AI分析', `开始截图分析 (${selectedProvider.toUpperCase()} / ${selectedModel})...`);

    try {
      // 1. 截取当前页面
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('未找到活动标签页');
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 100,
      });

      // 保存截图数据用于预览
      this.lastScreenshotDataUrl = dataUrl;
      if (viewBtn) viewBtn.style.display = 'inline-flex';

      this.log('AI分析', '截图完成，正在发送给 AI...');

      // 2. 发送给 AI 分析
      const response = await this.sendToBackground<{
        success: boolean;
        content?: string;
        error?: string;
        latency?: number;
      }>({
        type: 'ANALYZE_SCREENSHOT',
        config: {
          provider: analysisConfig.provider,
          apiKey: analysisConfig.apiKey,
          baseUrl: analysisConfig.baseUrl,
          model: analysisConfig.model,
        },
        image: dataUrl,
        prompt,
      });

      if (btn) btn.classList.remove('loading');

      if (response?.success && response.content) {
        if (resultEl) {
          resultEl.innerHTML = `<div class="analysis-content">${this.escapeHtml(response.content)}</div>`;
        }
        this.log('AI分析', `分析完成 (${response.latency}ms)`, 'success');
      } else {
        const errorMsg = response?.error || '分析失败';
        if (resultEl) {
          resultEl.innerHTML = `<div class="analysis-error">✗ ${this.escapeHtml(errorMsg)}</div>`;
        }
        this.log('AI分析', `分析失败: ${errorMsg}`, 'error');
      }
    } catch (error) {
      if (btn) btn.classList.remove('loading');
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (resultEl) {
        resultEl.innerHTML = `<div class="analysis-error">✗ ${this.escapeHtml(errorMessage)}</div>`;
      }
      this.log('AI分析', `错误: ${errorMessage}`, 'error');
    }
  }

  // ==================== Happy Debug - Screenshot ====================

  private async takeScreenshot(): Promise<void> {
    const btn = document.getElementById('screenshot-btn');
    const resultEl = document.getElementById('screenshot-result');

    if (btn) btn.classList.add('loading');
    this.log('截图', '正在截取网页...');

    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('未找到活动标签页');
      }

      // 使用 chrome.tabs.captureVisibleTab 截取可见区域
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 100,
      });

      // 将 dataUrl 转换为 Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // 复制到剪贴板
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      if (resultEl) {
        resultEl.innerHTML = '<div style="color: #4caf50;">✓ 截图已复制到剪贴板</div>';
      }
      this.log('截图', '截图已复制到剪贴板', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (resultEl) {
        resultEl.innerHTML = `<div style="color: #f44336;">✗ 截图失败: ${this.escapeHtml(errorMessage)}</div>`;
      }
      this.log('截图', `截图失败: ${errorMessage}`, 'error');
    } finally {
      if (btn) btn.classList.remove('loading');
    }
  }

  // ==================== Happy Debug - Read Content ====================

  private async readChatContent(): Promise<void> {
    const btn = document.getElementById('read-content-btn');
    const countEl = document.getElementById('message-count');
    const contentEl = document.getElementById('chat-content');
    const exportBtn = document.getElementById('export-content-btn');

    if (btn) btn.classList.add('loading');
    this.log('读取', '正在读取聊天内容...');

    const response = await this.sendToContent<{
      success: boolean;
      data: Array<{ role: string; content: string; index: number }>;
    }>({ type: 'GET_CHAT_MESSAGES' });

    if (btn) btn.classList.remove('loading');

    if (response?.success && response.data) {
      const messages = response.data;
      this.chatMessages = messages; // 保存消息用于导出
      if (countEl) countEl.textContent = String(messages.length);

      if (contentEl) {
        if (messages.length === 0) {
          contentEl.innerHTML = '<div class="debug-empty">未找到聊天消息</div>';
          if (exportBtn) exportBtn.style.display = 'none';
        } else {
          contentEl.innerHTML = messages.map((msg) => `
            <div class="debug-list-item" style="padding: 8px; border-bottom: 1px solid #3c3c3c; margin-bottom: 4px;">
              <div style="font-size: 10px; color: ${msg.role === 'user' ? '#2196f3' : msg.role === 'assistant' ? '#4caf50' : '#999'}; margin-bottom: 4px;">
                ${msg.role === 'user' ? '👤 用户' : msg.role === 'assistant' ? '🤖 助手' : '❓ 未知'} #${msg.index + 1}
              </div>
              <div style="font-size: 12px; color: #ccc; word-break: break-word;">
                ${this.escapeHtml(msg.content.substring(0, 200))}${msg.content.length > 200 ? '...' : ''}
              </div>
            </div>
          `).join('');
          // 显示导出按钮
          if (exportBtn) exportBtn.style.display = 'inline-flex';
        }
      }

      this.log('读取', `找到 ${messages.length} 条消息`, 'success');
    } else {
      if (countEl) countEl.textContent = '错误';
      if (contentEl) contentEl.innerHTML = '<div class="debug-empty">读取失败</div>';
      if (exportBtn) exportBtn.style.display = 'none';
      this.chatMessages = [];
      this.log('读取', '读取聊天内容失败', 'error');
    }
  }

  private clearChatContent(): void {
    const countEl = document.getElementById('message-count');
    const contentEl = document.getElementById('chat-content');
    const exportBtn = document.getElementById('export-content-btn');
    if (countEl) countEl.textContent = '--';
    if (contentEl) contentEl.innerHTML = '<div class="debug-empty">点击"读取内容"获取当前聊天记录</div>';
    if (exportBtn) exportBtn.style.display = 'none';
    this.chatMessages = [];
    this.log('读取', '已清空内容显示');
  }

  private exportChatContent(): void {
    if (this.chatMessages.length === 0) {
      this.log('导出', '没有内容可导出', 'error');
      return;
    }

    // 格式化导出内容
    const exportData = {
      exportTime: new Date().toISOString(),
      messageCount: this.chatMessages.length,
      messages: this.chatMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-content-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.log('导出', `已导出 ${this.chatMessages.length} 条消息`, 'success');
  }

  // ==================== Pricing Modal ====================

  private showPricingModal(): void {
    // DeepSeek 价格 (人民币/百万tokens)
    const deepseekPricing = [
      { model: 'deepseek-chat', input: '2元', cache: '0.2元', output: '3元', note: 'DeepSeek-V3.2 非思考模式' },
      { model: 'deepseek-reasoner', input: '2元', cache: '0.2元', output: '3元', note: 'DeepSeek-V3.2 思考模式' },
    ];

    // OpenAI 价格 (美元/百万tokens)
    const openaiPricing = [
      { model: 'gpt-5.2', input: '1.75', cache: '0.175', output: '14.00' },
      { model: 'gpt-5.1', input: '1.25', cache: '0.125', output: '10.00' },
      { model: 'gpt-5', input: '1.25', cache: '0.125', output: '10.00' },
      { model: 'gpt-5-mini', input: '0.25', cache: '0.025', output: '2.00' },
      { model: 'gpt-5-nano', input: '0.05', cache: '0.005', output: '0.40' },
      { model: 'gpt-5.2-chat-latest', input: '1.75', cache: '0.175', output: '14.00' },
      { model: 'gpt-5.1-chat-latest', input: '1.25', cache: '0.125', output: '10.00' },
      { model: 'gpt-5-chat-latest', input: '1.25', cache: '0.125', output: '10.00' },
      { model: 'gpt-5.2-codex', input: '1.75', cache: '0.175', output: '14.00' },
      { model: 'gpt-5.1-codex-max', input: '1.25', cache: '0.125', output: '10.00' },
      { model: 'gpt-5.1-codex', input: '1.25', cache: '0.125', output: '10.00' },
      { model: 'gpt-5-codex', input: '1.25', cache: '0.125', output: '10.00' },
      { model: 'gpt-5.2-pro', input: '21.00', cache: '-', output: '168.00' },
      { model: 'gpt-5-pro', input: '15.00', cache: '-', output: '120.00' },
      { model: 'gpt-4.1', input: '2.00', cache: '0.50', output: '8.00' },
      { model: 'gpt-4.1-mini', input: '0.40', cache: '0.10', output: '1.60' },
      { model: 'gpt-4.1-nano', input: '0.10', cache: '0.025', output: '0.40' },
      { model: 'gpt-4o', input: '2.50', cache: '1.25', output: '10.00' },
      { model: 'gpt-4o-2024-05-13', input: '5.00', cache: '-', output: '15.00' },
      { model: 'gpt-4o-mini', input: '0.15', cache: '0.075', output: '0.60' },
      { model: 'gpt-realtime', input: '4.00', cache: '0.40', output: '16.00' },
      { model: 'gpt-realtime-mini', input: '0.60', cache: '0.06', output: '2.40' },
      { model: 'gpt-4o-realtime-preview', input: '5.00', cache: '2.50', output: '20.00' },
      { model: 'gpt-4o-mini-realtime-preview', input: '0.60', cache: '0.30', output: '2.40' },
      { model: 'gpt-audio', input: '2.50', cache: '-', output: '10.00' },
      { model: 'gpt-audio-mini', input: '0.60', cache: '-', output: '2.40' },
      { model: 'gpt-4o-audio-preview', input: '2.50', cache: '-', output: '10.00' },
      { model: 'gpt-4o-mini-audio-preview', input: '0.15', cache: '-', output: '0.60' },
      { model: 'o1', input: '15.00', cache: '7.50', output: '60.00' },
      { model: 'o1-pro', input: '150.00', cache: '-', output: '600.00' },
      { model: 'o3-pro', input: '20.00', cache: '-', output: '80.00' },
      { model: 'o3', input: '2.00', cache: '0.50', output: '8.00' },
      { model: 'o3-deep-research', input: '10.00', cache: '2.50', output: '40.00' },
      { model: 'o4-mini', input: '1.10', cache: '0.275', output: '4.40' },
      { model: 'o4-mini-deep-research', input: '2.00', cache: '0.50', output: '8.00' },
      { model: 'o3-mini', input: '1.10', cache: '0.55', output: '4.40' },
      { model: 'o1-mini', input: '1.10', cache: '0.55', output: '4.40' },
      { model: 'gpt-5.1-codex-mini', input: '0.25', cache: '0.025', output: '2.00' },
      { model: 'codex-mini-latest', input: '1.50', cache: '0.375', output: '6.00' },
      { model: 'gpt-5-search-api', input: '1.25', cache: '0.125', output: '10.00' },
      { model: 'gpt-4o-mini-search-preview', input: '0.15', cache: '-', output: '0.60' },
      { model: 'gpt-4o-search-preview', input: '2.50', cache: '-', output: '10.00' },
      { model: 'computer-use-preview', input: '3.00', cache: '-', output: '12.00' },
      { model: 'gpt-image-1.5', input: '5.00', cache: '1.25', output: '10.00' },
      { model: 'chatgpt-image-latest', input: '5.00', cache: '1.25', output: '10.00' },
      { model: 'gpt-image-1', input: '5.00', cache: '1.25', output: '-' },
      { model: 'gpt-image-1-mini', input: '2.00', cache: '0.20', output: '-' },
    ];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content pricing-modal';
    content.style.maxWidth = '650px';
    content.style.maxHeight = '80vh';

    const deepseekRows = deepseekPricing.map(item => `
      <tr>
        <td>${this.escapeHtml(item.model)}</td>
        <td>${item.input}</td>
        <td>${item.cache}</td>
        <td>${item.output}</td>
        <td style="font-size: 10px; color: #888;">${item.note || ''}</td>
      </tr>
    `).join('');

    const openaiRows = openaiPricing.map(item => `
      <tr>
        <td>${this.escapeHtml(item.model)}</td>
        <td>$${item.input}</td>
        <td>${item.cache === '-' ? '-' : '$' + item.cache}</td>
        <td>${item.output === '-' ? '-' : '$' + item.output}</td>
      </tr>
    `).join('');

    content.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">API 模型价格表</span>
        <button class="btn btn-tiny btn-secondary" id="pricing-close-btn" style="margin-left: auto;">✕</button>
      </div>
      <div class="modal-body" style="overflow-y: auto; max-height: 60vh;">
        <!-- DeepSeek 价格 -->
        <div class="pricing-section">
          <h4 style="color: #4fc3f7; margin: 0 0 8px 0; font-size: 13px;">🔷 DeepSeek</h4>
          <p style="font-size: 10px; color: #888; margin-bottom: 8px;">价格单位: 人民币 / 百万 tokens | 上下文: 128K</p>
          <table class="pricing-table">
            <thead>
              <tr>
                <th>模型</th>
                <th>输入</th>
                <th>缓存命中</th>
                <th>输出</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              ${deepseekRows}
            </tbody>
          </table>
        </div>

        <!-- OpenAI 价格 -->
        <div class="pricing-section" style="margin-top: 16px;">
          <h4 style="color: #4caf50; margin: 0 0 8px 0; font-size: 13px;">🟢 OpenAI</h4>
          <p style="font-size: 10px; color: #888; margin-bottom: 8px;">价格单位: 美元 / 百万 tokens</p>
          <table class="pricing-table">
            <thead>
              <tr>
                <th>模型</th>
                <th>输入</th>
                <th>缓存输入</th>
                <th>输出</th>
              </tr>
            </thead>
            <tbody>
              ${openaiRows}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="pricing-ok-btn">关闭</button>
      </div>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    content.querySelector('#pricing-close-btn')?.addEventListener('click', cleanup);
    content.querySelector('#pricing-ok-btn')?.addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });
  }

  // ==================== Resize Handles ====================

  private initResizeHandles(): void {
    const handle = document.getElementById('ai-analysis-resize-handle');
    const container = document.getElementById('ai-analysis-result');

    if (!handle || !container) return;

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = container.offsetHeight;
      handle.classList.add('active');
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const delta = e.clientY - startY;
      const newHeight = Math.min(Math.max(startHeight + delta, 100), 600);
      container.style.maxHeight = newHeight + 'px';
      container.style.height = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        handle.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // ==================== Screenshot Preview ====================

  private showScreenshotPreview(): void {
    if (!this.lastScreenshotDataUrl) {
      this.log('预览', '没有可预览的截图', 'error');
      return;
    }

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    const overlay = document.createElement('div');
    overlay.className = 'screenshot-preview-overlay';

    const container = document.createElement('div');
    container.className = 'screenshot-preview-container';

    const img = document.createElement('img');
    img.className = 'screenshot-preview-image';
    img.src = this.lastScreenshotDataUrl;
    img.alt = '截图预览';

    const zoomInfo = document.createElement('div');
    zoomInfo.className = 'screenshot-zoom-info';
    zoomInfo.textContent = '100%';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'screenshot-preview-close';
    closeBtn.innerHTML = '×';
    closeBtn.title = '关闭 (Esc)';

    const controls = document.createElement('div');
    controls.className = 'screenshot-preview-controls';
    controls.innerHTML = `
      <button class="btn btn-secondary" id="zoom-out-btn" title="缩小">−</button>
      <button class="btn btn-secondary" id="zoom-reset-btn" title="重置">1:1</button>
      <button class="btn btn-secondary" id="zoom-in-btn" title="放大">+</button>
    `;

    container.appendChild(img);
    container.appendChild(controls);
    overlay.appendChild(zoomInfo);
    overlay.appendChild(closeBtn);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    const updateTransform = () => {
      img.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
      zoomInfo.textContent = `${Math.round(scale * 100)}%`;
    };

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    // Zoom controls
    controls.querySelector('#zoom-in-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scale = Math.min(scale * 1.25, 5);
      updateTransform();
    });

    controls.querySelector('#zoom-out-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scale = Math.max(scale / 1.25, 0.25);
      updateTransform();
    });

    controls.querySelector('#zoom-reset-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      scale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    });

    // Mouse wheel zoom
    overlay.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        scale = Math.min(scale * 1.1, 5);
      } else {
        scale = Math.max(scale / 1.1, 0.25);
      }
      updateTransform();
    });

    // Drag to pan
    img.addEventListener('mousedown', (e) => {
      if (scale > 1) {
        isDragging = true;
        dragStartX = e.clientX - translateX * scale;
        dragStartY = e.clientY - translateY * scale;
        container.classList.add('dragging');
        e.preventDefault();
      }
    });

    overlay.addEventListener('mousemove', (e) => {
      if (isDragging) {
        translateX = (e.clientX - dragStartX) / scale;
        translateY = (e.clientY - dragStartY) / scale;
        updateTransform();
      }
    });

    overlay.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.classList.remove('dragging');
      }
    });

    // Close handlers
    closeBtn.addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });

    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  // ==================== Utilities ====================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the debug console when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new DebugConsole();
});
