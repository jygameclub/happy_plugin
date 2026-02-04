// src/sidepanel/sidepanel.ts

import type { Session } from '../types/session';
import type { AIJudgeOutput, APIStatus } from '../types/ai-judge';
import type { Message } from '../types/messages';
import { ConfigStorage, type APIProviderConfig } from '../services/config-storage';

interface LogEntry {
  timestamp: string;
  action: string;
  message: string;
  type?: 'info' | 'success' | 'error';
}

interface PendingAction {
  type: 'input' | 'execute';
  sessionId: string;
  command: string;
}

interface TimeoutState {
  intervalId: number | null;
  remaining: number;
  isRunning: boolean;
}

interface RollbackState {
  previousValue: string | null;
  sessionId: string | null;
  isInjected: boolean;
}

class DebugConsole {
  private sessions: Session[] = [];
  private activeSessionId: string | null = null;
  private pendingAction: PendingAction | null = null;
  private logs: LogEntry[] = [];
  private configStorage: ConfigStorage;
  private currentScreenshot: string | null = null;
  private timeoutState: TimeoutState = { intervalId: null, remaining: 30, isRunning: false };
  private rollbackState: RollbackState = { previousValue: null, sessionId: null, isInjected: false };

  constructor() {
    this.configStorage = new ConfigStorage();
    this.initPanelToggles();
    this.initEventListeners();
    this.loadInitialState();
    this.loadAPIConfigs();
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
    // Environment / API Config section
    document.getElementById('save-deepseek-btn')?.addEventListener('click', () => {
      this.saveAPIConfig('deepseek');
    });
    document.getElementById('check-deepseek-btn')?.addEventListener('click', () => {
      this.checkAPI('deepseek');
    });

    // Auto-save on blur for API config inputs
    const baseUrlEl = document.getElementById('deepseek-base-url');
    const apiKeyEl = document.getElementById('deepseek-api-key');
    baseUrlEl?.addEventListener('blur', () => this.saveAPIConfig('deepseek'));
    apiKeyEl?.addEventListener('blur', () => this.saveAPIConfig('deepseek'));

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

    // Session section
    document.getElementById('scan-sessions-btn')?.addEventListener('click', () => {
      this.scanSessions();
    });

    // Input section
    document.getElementById('preview-input-btn')?.addEventListener('click', () => {
      this.previewInput();
    });
    document.getElementById('clear-input-btn')?.addEventListener('click', () => {
      this.clearInput();
    });

    // AI Judge section
    document.getElementById('analyze-btn')?.addEventListener('click', () => {
      this.analyzeSession();
    });

    // Action section
    document.getElementById('execute-action-btn')?.addEventListener('click', () => {
      this.executeAction();
    });
    document.getElementById('cancel-action-btn')?.addEventListener('click', () => {
      this.cancelAction();
    });

    // Logs section
    document.getElementById('export-logs-btn')?.addEventListener('click', () => {
      this.exportSnapshot();
    });
    document.getElementById('clear-logs-btn')?.addEventListener('click', () => {
      this.clearLogs();
    });

    // Page Debug section
    document.getElementById('refresh-page-info-btn')?.addEventListener('click', () => {
      this.refreshPageInfo();
    });
    document.getElementById('scan-structure-btn')?.addEventListener('click', () => {
      this.scanPageStructure();
    });
    document.getElementById('scan-sessions-list-btn')?.addEventListener('click', () => {
      this.scanSessionsList();
    });
    document.getElementById('scan-content-btn')?.addEventListener('click', () => {
      this.scanContentState();
    });
    document.getElementById('highlight-element-btn')?.addEventListener('click', () => {
      this.highlightElement();
    });
    document.getElementById('click-element-btn')?.addEventListener('click', () => {
      this.clickElement();
    });
    document.getElementById('get-element-info-btn')?.addEventListener('click', () => {
      this.getElementInfo();
    });

    // Screenshot section
    document.getElementById('capture-screenshot-btn')?.addEventListener('click', () => {
      this.captureScreenshot();
    });
    document.getElementById('analyze-screenshot-btn')?.addEventListener('click', () => {
      this.analyzeScreenshot();
    });

    // Happy test section
    document.getElementById('test-get-sessions-btn')?.addEventListener('click', () => {
      this.testGetSessions();
    });
    document.getElementById('test-input-btn')?.addEventListener('click', () => {
      this.testInputText();
    });
    document.getElementById('test-send-btn')?.addEventListener('click', () => {
      this.testSimulateSend();
    });
    document.getElementById('test-clear-input-btn')?.addEventListener('click', () => {
      this.testClearInput();
    });
    document.getElementById('test-get-chat-btn')?.addEventListener('click', () => {
      this.testGetChatMessages();
    });

    // Debug tools section
    document.getElementById('test-output-listener-btn')?.addEventListener('click', () => {
      this.testOutputListener();
    });
    document.getElementById('detect-waiting-btn')?.addEventListener('click', () => {
      this.detectWaitingState();
    });
    document.getElementById('start-timeout-btn')?.addEventListener('click', () => {
      this.startTimeoutSimulation();
    });
    document.getElementById('stop-timeout-btn')?.addEventListener('click', () => {
      this.stopTimeoutSimulation();
    });
    document.getElementById('check-danger-btn')?.addEventListener('click', () => {
      this.checkDangerousCommand();
    });
    document.getElementById('inject-test-btn')?.addEventListener('click', () => {
      this.injectTestText();
    });
    document.getElementById('rollback-test-btn')?.addEventListener('click', () => {
      this.rollbackTestText();
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

  // ==================== Initial State ====================

  private async loadInitialState(): Promise<void> {
    const response = await this.sendToBackground<{
      sessions: Session[];
      activeSessionId: string | null;
    }>({ type: 'GET_STATE' });

    if (response) {
      this.sessions = response.sessions || [];
      this.activeSessionId = response.activeSessionId;
      this.renderSessionList();
    }
  }

  // ==================== API Config ====================

  private async loadAPIConfigs(): Promise<void> {
    const configs = await this.configStorage.getAll();

    // 加载 DeepSeek 配置
    const deepseekBaseUrl = document.getElementById('deepseek-base-url') as HTMLInputElement;
    const deepseekApiKey = document.getElementById('deepseek-api-key') as HTMLInputElement;
    if (deepseekBaseUrl) deepseekBaseUrl.value = configs.deepseek.baseUrl;
    if (deepseekApiKey) deepseekApiKey.value = configs.deepseek.apiKey;

    this.log('配置', '已加载 API 配置');
  }

  private async saveAPIConfig(provider: 'deepseek'): Promise<void> {
    const baseUrlEl = document.getElementById(`${provider}-base-url`) as HTMLInputElement;
    const apiKeyEl = document.getElementById(`${provider}-api-key`) as HTMLInputElement;
    const saveBtn = document.getElementById(`save-${provider}-btn`);

    if (!baseUrlEl || !apiKeyEl) return;

    const config: Partial<APIProviderConfig> = {
      baseUrl: baseUrlEl.value.trim(),
      apiKey: apiKeyEl.value.trim(),
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

  private getAPIConfigFromForm(provider: 'deepseek'): { apiKey: string; baseUrl: string } | null {
    const baseUrlEl = document.getElementById(`${provider}-base-url`) as HTMLInputElement;
    const apiKeyEl = document.getElementById(`${provider}-api-key`) as HTMLInputElement;

    if (!baseUrlEl || !apiKeyEl) return null;

    const baseUrl = baseUrlEl.value.trim();
    const apiKey = apiKeyEl.value.trim();

    if (!baseUrl || !apiKey) {
      return null;
    }

    return { baseUrl, apiKey };
  }

  // ==================== API Check ====================

  async checkAPI(provider: 'deepseek'): Promise<void> {
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

    const formConfig = this.getAPIConfigFromForm('deepseek');

    if (!formConfig) {
      this.addChatMessage('请先配置 DeepSeek 的 API Key 和 Base URL', 'error');
      this.log('聊天', 'DeepSeek 未配置', 'error');
      return;
    }

    // 显示用户消息
    this.addChatMessage(message, 'user');
    inputEl.value = '';

    if (sendBtn) sendBtn.classList.add('loading');
    this.log('聊天', `发送到 DeepSeek: ${message.substring(0, 30)}...`);

    const response = await this.sendToBackground<{
      success: boolean;
      content?: string;
      error?: string;
      latency?: number;
    }>({
      type: 'CHAT_TEST',
      provider: 'deepseek',
      message,
      config: {
        provider: 'deepseek',
        apiKey: formConfig.apiKey,
        baseUrl: formConfig.baseUrl,
      },
    });

    if (sendBtn) sendBtn.classList.remove('loading');

    if (response?.success && response.content) {
      this.addChatMessage(response.content, 'assistant', response.latency);
      this.log('聊天', `DeepSeek 响应成功 (${response.latency}ms)`, 'success');
    } else {
      this.addChatMessage(response?.error || '请求失败', 'error');
      this.log('聊天', `DeepSeek 失败: ${response?.error || '未知错误'}`, 'error');
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

  // ==================== Session Management ====================

  async scanSessions(): Promise<void> {
    const btn = document.getElementById('scan-sessions-btn');
    if (btn) btn.classList.add('loading');

    this.log('扫描', '正在扫描终端会话...');

    const response = await this.sendToContent<{ sessions: Session[] }>({
      type: 'SCAN_SESSIONS',
    });

    if (btn) btn.classList.remove('loading');

    if (response?.sessions) {
      this.sessions = response.sessions;
      await this.sendToBackground({
        type: 'SET_SESSIONS',
        sessions: this.sessions,
      });
      this.renderSessionList();
      this.log('扫描', `找到 ${this.sessions.length} 个会话`, 'success');
    } else {
      this.log('扫描', '未找到会话或扫描失败', 'error');
    }
  }

  renderSessionList(): void {
    const listEl = document.getElementById('session-list');
    if (!listEl) return;

    if (this.sessions.length === 0) {
      listEl.innerHTML = '<div class="session-empty">未找到会话。点击"扫描会话"来检测终端。</div>';
      this.updateActiveSessionDisplay();
      return;
    }

    listEl.innerHTML = this.sessions
      .map(
        (session) => `
        <div class="session-item ${session.sessionId === this.activeSessionId ? 'active' : ''}"
             data-session-id="${session.sessionId}">
          <span class="session-title">${this.escapeHtml(session.title)}</span>
          <span class="session-visibility">${session.visible ? '可见' : '隐藏'}</span>
        </div>
      `
      )
      .join('');

    // Add click handlers
    listEl.querySelectorAll('.session-item').forEach((item) => {
      item.addEventListener('click', () => {
        const sessionId = item.getAttribute('data-session-id');
        if (sessionId) {
          this.switchSession(sessionId);
        }
      });
    });

    this.updateActiveSessionDisplay();
  }

  async switchSession(sessionId: string): Promise<void> {
    this.activeSessionId = sessionId;
    await this.sendToBackground({
      type: 'SET_ACTIVE_SESSION',
      sessionId,
    });
    await this.sendToContent({
      type: 'SWITCH_SESSION',
      sessionId,
    });

    this.renderSessionList();
    const session = this.sessions.find((s) => s.sessionId === sessionId);
    this.log('会话', `已切换到: ${session?.title || sessionId}`, 'success');
  }

  private updateActiveSessionDisplay(): void {
    const infoEl = document.getElementById('active-session-info');
    if (!infoEl) return;

    if (this.activeSessionId) {
      const session = this.sessions.find((s) => s.sessionId === this.activeSessionId);
      infoEl.textContent = session?.title || this.activeSessionId;
    } else {
      infoEl.textContent = '未选择';
    }
  }

  // ==================== Input Simulation ====================

  async previewInput(): Promise<void> {
    const textareaEl = document.getElementById('input-text') as HTMLTextAreaElement;
    if (!textareaEl) return;

    const text = textareaEl.value.trim();
    if (!text) {
      this.log('输入', '未提供输入文本', 'error');
      return;
    }

    if (!this.activeSessionId) {
      this.log('输入', '未选择活动会话', 'error');
      return;
    }

    this.log('输入', `预览: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    await this.sendToContent({
      type: 'PREVIEW_INPUT',
      sessionId: this.activeSessionId,
      text,
    });

    // Set up pending action
    this.pendingAction = {
      type: 'input',
      sessionId: this.activeSessionId,
      command: text,
    };
    this.updateActionPreview();
  }

  async clearInput(): Promise<void> {
    const textareaEl = document.getElementById('input-text') as HTMLTextAreaElement;
    if (textareaEl) {
      textareaEl.value = '';
    }

    if (this.activeSessionId) {
      await this.sendToContent({
        type: 'CLEAR_PREVIEW',
        sessionId: this.activeSessionId,
      });
    }

    this.pendingAction = null;
    this.updateActionPreview();
    this.log('输入', '输入已清空');
  }

  // ==================== AI Judge ====================

  async analyzeSession(): Promise<void> {
    if (!this.activeSessionId) {
      this.log('分析', '未选择活动会话', 'error');
      return;
    }

    const lineCountEl = document.getElementById('line-count') as HTMLInputElement;
    const lines = parseInt(lineCountEl?.value || '20', 10);

    const btn = document.getElementById('analyze-btn');
    if (btn) btn.classList.add('loading');

    this.log('分析', `正在分析最后 ${lines} 行...`);

    // Get session output from content script
    const outputResponse = await this.sendToContent<{ output: string[] }>({
      type: 'GET_SESSION_OUTPUT',
      sessionId: this.activeSessionId,
      lines,
    });

    if (!outputResponse?.output) {
      if (btn) btn.classList.remove('loading');
      this.log('分析', '获取会话输出失败', 'error');
      this.renderAIResult(null);
      return;
    }

    // Send to background for AI analysis (will be implemented in Task 9)
    const response = await this.sendToBackground<{ result: AIJudgeOutput }>({
      type: 'ANALYZE_SESSION',
      sessionId: this.activeSessionId,
      output: outputResponse.output,
    });

    if (btn) btn.classList.remove('loading');

    if (response?.result) {
      this.renderAIResult(response.result);
      this.log(
        '分析',
        `角色: ${response.result.role}, 状态: ${response.result.state}, 置信度: ${Math.round(response.result.confidence * 100)}%`,
        'success'
      );
    } else {
      this.renderAIResult(null);
      this.log('分析', '分析失败或未实现', 'error');
    }
  }

  renderAIResult(result: AIJudgeOutput | null): void {
    const resultEl = document.getElementById('ai-result');
    if (!resultEl) return;

    if (!result) {
      resultEl.innerHTML = '<div class="ai-result-empty">暂无分析结果。点击"分析会话"获取 AI 判断。</div>';
      return;
    }

    const roleClass = `role-${result.role.toLowerCase()}`;
    const stateClass = `state-${result.state.toLowerCase().replace('_', '-')}`;
    const confidencePercent = Math.round(result.confidence * 100);

    resultEl.innerHTML = `
      <div class="ai-result-data">
        <div class="ai-result-row">
          <span class="ai-result-label">角色:</span>
          <span class="ai-result-value ${roleClass}">${result.role}</span>
        </div>
        <div class="ai-result-row">
          <span class="ai-result-label">状态:</span>
          <span class="ai-result-value ${stateClass}">${result.state}</span>
        </div>
        <div class="ai-result-row">
          <span class="ai-result-label">置信度:</span>
          <span class="ai-result-value">${confidencePercent}%</span>
        </div>
      </div>
    `;
  }

  // ==================== Action Simulation ====================

  updateActionPreview(): void {
    const previewEl = document.getElementById('action-preview');
    const executeBtn = document.getElementById('execute-action-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancel-action-btn') as HTMLButtonElement;

    if (!previewEl) return;

    if (!this.pendingAction) {
      previewEl.innerHTML = '<div class="action-preview-empty">暂无待执行动作</div>';
      if (executeBtn) executeBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
      return;
    }

    previewEl.innerHTML = `
      <div class="action-preview-command">${this.escapeHtml(this.pendingAction.command)}</div>
    `;
    if (executeBtn) executeBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
  }

  async executeAction(): Promise<void> {
    if (!this.pendingAction) {
      this.log('动作', '无待执行动作', 'error');
      return;
    }

    // 检查是否为危险命令
    const dangerCheck = await this.sendToBackground<{
      success: boolean;
      data: { isDangerous: boolean; description: string | null };
    }>({
      type: 'CHECK_DANGEROUS',
      command: this.pendingAction.command,
    });

    if (dangerCheck?.data?.isDangerous) {
      this.log('动作', `危险命令被拦截: ${dangerCheck.data.description}`, 'error');
      alert(`危险命令被拦截!\n\n原因: ${dangerCheck.data.description}\n\n命令: ${this.pendingAction.command}`);
      return;
    }

    // 显示确认弹窗
    const confirmed = await this.showConfirmationModal(this.pendingAction);

    if (!confirmed) {
      this.log('动作', '用户取消执行', 'info');
      return;
    }

    this.log('动作', `正在执行: "${this.pendingAction.command.substring(0, 50)}..."`);

    // Send execute command to content script
    await this.sendToContent({
      type: 'PREVIEW_INPUT',
      sessionId: this.pendingAction.sessionId,
      text: this.pendingAction.command,
    });

    // 模拟按下 Enter 键发送
    await this.sendToContent({
      type: 'SIMULATE_SEND',
    });

    this.log('动作', '动作执行成功', 'success');

    this.pendingAction = null;
    this.updateActionPreview();
    this.clearInput();
  }

  async cancelAction(): Promise<void> {
    if (!this.pendingAction) {
      return;
    }

    this.log('动作', '动作已取消');

    if (this.pendingAction.sessionId) {
      await this.sendToContent({
        type: 'CLEAR_PREVIEW',
        sessionId: this.pendingAction.sessionId,
      });
    }

    this.pendingAction = null;
    this.updateActionPreview();
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

  // ==================== Page Debug ====================

  private async refreshPageInfo(): Promise<void> {
    const btn = document.getElementById('refresh-page-info-btn');
    if (btn) btn.classList.add('loading');

    this.log('页面', '正在获取页面信息...');

    const response = await this.sendToContent<{
      success: boolean;
      data: { url: string; title: string; domain: string };
    }>({ type: 'GET_PAGE_INFO' });

    if (btn) btn.classList.remove('loading');

    console.log('[Happy Debug] refreshPageInfo response:', response);

    if (response?.success && response.data) {
      const urlEl = document.getElementById('page-url');
      const titleEl = document.getElementById('page-title');

      if (urlEl) urlEl.textContent = response.data.url.substring(0, 50) + (response.data.url.length > 50 ? '...' : '');
      if (titleEl) titleEl.textContent = response.data.title.substring(0, 30) + (response.data.title.length > 30 ? '...' : '');

      this.log('页面', `域名: ${response.data.domain}`, 'success');
    } else {
      this.log('页面', `获取页面信息失败 (response: ${JSON.stringify(response)})`, 'error');
    }
  }

  private async scanPageStructure(): Promise<void> {
    const btn = document.getElementById('scan-structure-btn');
    if (btn) btn.classList.add('loading');

    this.log('页面', '正在扫描页面结构...');

    const response = await this.sendToContent<{
      success: boolean;
      data: {
        sidebar: { exists: boolean; selector: string | null; width: number; items: number };
        mainContent: { exists: boolean; selector: string | null; width: number; type: string };
        rightPanel: { exists: boolean; selector: string | null; width: number };
      };
    }>({ type: 'ANALYZE_PAGE_STRUCTURE' });

    if (btn) btn.classList.remove('loading');

    const structureEl = document.getElementById('page-structure');
    if (!structureEl) return;

    if (response?.success && response.data) {
      const { sidebar, mainContent, rightPanel } = response.data;
      structureEl.innerHTML = `
        <div class="debug-structure-item">
          <span class="debug-structure-label">左侧边栏:</span>
          <span class="debug-structure-value ${sidebar.exists ? 'found' : 'not-found'}">
            ${sidebar.exists ? `找到 (${sidebar.width}px, ${sidebar.items} 项)` : '未找到'}
          </span>
        </div>
        <div class="debug-structure-item">
          <span class="debug-structure-label">主内容区:</span>
          <span class="debug-structure-value ${mainContent.exists ? 'found' : 'not-found'}">
            ${mainContent.exists ? `找到 (${mainContent.width}px, ${mainContent.type})` : '未找到'}
          </span>
        </div>
        <div class="debug-structure-item">
          <span class="debug-structure-label">右侧面板:</span>
          <span class="debug-structure-value ${rightPanel.exists ? 'found' : 'not-found'}">
            ${rightPanel.exists ? `找到 (${rightPanel.width}px)` : '未找到'}
          </span>
        </div>
      `;
      this.log('页面', '页面结构扫描完成', 'success');
    } else {
      structureEl.innerHTML = '<div class="debug-empty">扫描失败</div>';
      this.log('页面', '扫描页面结构失败', 'error');
    }
  }

  private async scanSessionsList(): Promise<void> {
    const btn = document.getElementById('scan-sessions-list-btn');
    if (btn) btn.classList.add('loading');

    this.log('页面', '正在获取会话列表...');

    const response = await this.sendToContent<{
      success: boolean;
      data: Array<{ id: string; title: string; active: boolean; selector: string }>;
    }>({ type: 'GET_SESSIONS_LIST' });

    if (btn) btn.classList.remove('loading');

    const listEl = document.getElementById('sessions-list');
    if (!listEl) return;

    if (response?.success && response.data && response.data.length > 0) {
      listEl.innerHTML = response.data.map((item) => `
        <div class="debug-list-item ${item.active ? 'active' : ''}">
          <span class="debug-list-title">${this.escapeHtml(item.title)}</span>
          <span class="debug-list-badge">${item.active ? '活动' : ''}</span>
        </div>
      `).join('');
      this.log('页面', `找到 ${response.data.length} 个会话`, 'success');
    } else {
      listEl.innerHTML = '<div class="debug-empty">未找到会话列表</div>';
      this.log('页面', '未找到会话列表', 'error');
    }
  }

  private async scanContentState(): Promise<void> {
    const btn = document.getElementById('scan-content-btn');
    if (btn) btn.classList.add('loading');

    this.log('页面', '正在检测内容区状态...');

    const response = await this.sendToContent<{
      success: boolean;
      data: {
        type: string;
        status: string;
        hasInput: boolean;
        hasMessages: boolean;
      };
    }>({ type: 'GET_CONTENT_STATE' });

    if (btn) btn.classList.remove('loading');

    if (response?.success && response.data) {
      const typeEl = document.getElementById('content-type');
      const statusEl = document.getElementById('content-status');

      const typeMap: Record<string, string> = {
        chat: '聊天',
        code: '代码',
        settings: '设置',
        empty: '空',
        unknown: '未知',
      };

      const statusMap: Record<string, string> = {
        idle: '空闲',
        loading: '加载中',
        streaming: '流式输出',
        error: '错误',
        empty: '空',
        unknown: '未知',
      };

      if (typeEl) typeEl.textContent = typeMap[response.data.type] || response.data.type;
      if (statusEl) statusEl.textContent = statusMap[response.data.status] || response.data.status;

      this.log('页面', `内容类型: ${typeMap[response.data.type]}, 状态: ${statusMap[response.data.status]}`, 'success');
    } else {
      this.log('页面', '检测内容区状态失败', 'error');
    }
  }

  private async highlightElement(): Promise<void> {
    const selectorEl = document.getElementById('element-selector') as HTMLInputElement;
    const selector = selectorEl?.value.trim();

    if (!selector) {
      this.log('元素', '请输入 CSS 选择器', 'error');
      return;
    }

    this.log('元素', `高亮元素: ${selector}`);

    const response = await this.sendToContent<{ success: boolean }>({
      type: 'HIGHLIGHT_ELEMENT',
      selector,
      duration: 2000,
    });

    if (response?.success) {
      this.log('元素', '元素已高亮', 'success');
    } else {
      this.log('元素', '未找到元素', 'error');
    }
  }

  private async clickElement(): Promise<void> {
    const selectorEl = document.getElementById('element-selector') as HTMLInputElement;
    const selector = selectorEl?.value.trim();

    if (!selector) {
      this.log('元素', '请输入 CSS 选择器', 'error');
      return;
    }

    this.log('元素', `点击元素: ${selector}`);

    const response = await this.sendToContent<{ success: boolean }>({
      type: 'CLICK_ELEMENT',
      selector,
    });

    if (response?.success) {
      this.log('元素', '元素已点击', 'success');
    } else {
      this.log('元素', '点击失败', 'error');
    }
  }

  private async getElementInfo(): Promise<void> {
    const selectorEl = document.getElementById('element-selector') as HTMLInputElement;
    const selector = selectorEl?.value.trim();

    if (!selector) {
      this.log('元素', '请输入 CSS 选择器', 'error');
      return;
    }

    this.log('元素', `获取元素信息: ${selector}`);

    const response = await this.sendToContent<{
      success: boolean;
      data: {
        exists: boolean;
        tagName: string;
        id: string;
        className: string;
        text: string;
        rect: { x: number; y: number; width: number; height: number };
        visible: boolean;
        clickable: boolean;
      };
    }>({
      type: 'GET_ELEMENT_INFO',
      selector,
    });

    const resultEl = document.getElementById('element-result');
    if (!resultEl) return;

    if (response?.success && response.data?.exists) {
      const info = response.data;
      resultEl.innerHTML = `
        <div class="debug-info-grid">
          <div class="debug-info-item">
            <span class="debug-info-label">标签:</span>
            <span class="debug-info-value">${info.tagName}</span>
          </div>
          <div class="debug-info-item">
            <span class="debug-info-label">位置:</span>
            <span class="debug-info-value">(${info.rect.x}, ${info.rect.y})</span>
          </div>
          <div class="debug-info-item">
            <span class="debug-info-label">大小:</span>
            <span class="debug-info-value">${info.rect.width} x ${info.rect.height}</span>
          </div>
          <div class="debug-info-item">
            <span class="debug-info-label">可见:</span>
            <span class="debug-info-value">${info.visible ? '是' : '否'}</span>
          </div>
          <div class="debug-info-item">
            <span class="debug-info-label">可点击:</span>
            <span class="debug-info-value">${info.clickable ? '是' : '否'}</span>
          </div>
          <div class="debug-info-item">
            <span class="debug-info-label">文本:</span>
            <span class="debug-info-value">${this.escapeHtml(info.text.substring(0, 50))}</span>
          </div>
        </div>
      `;
      this.log('元素', `找到元素: ${info.tagName}`, 'success');
    } else {
      resultEl.innerHTML = '<div class="debug-empty">未找到元素</div>';
      this.log('元素', '未找到元素', 'error');
    }
  }

  // ==================== Screenshot ====================

  private async captureScreenshot(): Promise<void> {
    const btn = document.getElementById('capture-screenshot-btn');
    const previewEl = document.getElementById('screenshot-preview');
    const analyzeBtn = document.getElementById('analyze-screenshot-btn') as HTMLButtonElement;

    if (btn) btn.classList.add('loading');
    this.log('截图', '正在捕获页面截图...');

    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        this.log('截图', '未找到活动标签页', 'error');
        return;
      }

      // 使用 chrome.tabs.captureVisibleTab 捕获截图
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 90,
      });

      this.currentScreenshot = dataUrl;

      // 显示截图预览
      if (previewEl) {
        previewEl.innerHTML = `<img src="${dataUrl}" alt="页面截图" />`;
      }

      // 启用分析按钮
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
      }

      this.log('截图', '截图捕获成功', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('截图', `截图失败: ${errorMessage}`, 'error');

      if (previewEl) {
        previewEl.innerHTML = `<div class="debug-empty">截图失败: ${errorMessage}</div>`;
      }
    } finally {
      if (btn) btn.classList.remove('loading');
    }
  }

  private async analyzeScreenshot(): Promise<void> {
    if (!this.currentScreenshot) {
      this.log('截图', '请先截图', 'error');
      return;
    }

    const formConfig = this.getAPIConfigFromForm('deepseek');
    if (!formConfig) {
      this.log('截图', '请先配置 DeepSeek API', 'error');
      return;
    }

    const btn = document.getElementById('analyze-screenshot-btn');
    const resultEl = document.getElementById('screenshot-analysis-result');
    const promptEl = document.getElementById('screenshot-prompt') as HTMLTextAreaElement;
    const prompt = promptEl?.value.trim() || '请分析这个网页截图的布局和内容';

    if (btn) btn.classList.add('loading');
    this.log('截图', '正在发送给 AI 分析...');

    try {
      const response = await this.sendToBackground<{
        success: boolean;
        content?: string;
        error?: string;
        latency?: number;
      }>({
        type: 'ANALYZE_SCREENSHOT',
        image: this.currentScreenshot,
        prompt,
        config: {
          provider: 'deepseek',
          apiKey: formConfig.apiKey,
          baseUrl: formConfig.baseUrl,
        },
      });

      if (response?.success && response.content) {
        if (resultEl) {
          resultEl.innerHTML = `<div class="ai-analysis-text">${this.escapeHtml(response.content)}</div>`;
        }
        this.log('截图', `AI 分析完成 (${response.latency}ms)`, 'success');
      } else {
        if (resultEl) {
          resultEl.innerHTML = `<div class="ai-result-empty">分析失败: ${response?.error || '未知错误'}</div>`;
        }
        this.log('截图', `分析失败: ${response?.error || '未知错误'}`, 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log('截图', `分析出错: ${errorMessage}`, 'error');

      if (resultEl) {
        resultEl.innerHTML = `<div class="ai-result-empty">分析出错: ${errorMessage}</div>`;
      }
    } finally {
      if (btn) btn.classList.remove('loading');
    }
  }

  // ==================== Happy Test ====================

  private async testGetSessions(): Promise<void> {
    const btn = document.getElementById('test-get-sessions-btn');
    const countEl = document.getElementById('test-session-count');
    const listEl = document.getElementById('test-sessions-list');

    if (btn) btn.classList.add('loading');
    this.log('测试', '正在获取会话列表...');

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
          listEl.innerHTML = sessions.map((session, index) => `
            <div class="debug-list-item" style="padding: 8px; border-bottom: 1px solid #3c3c3c; cursor: pointer;"
                 data-selector="${this.escapeHtml(session.selector)}" data-index="${index}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: ${session.active ? '#4caf50' : '#cccccc'};">
                  ${session.active ? '● ' : ''}${index + 1}. ${this.escapeHtml(session.title)}
                </span>
                <button class="btn btn-small btn-secondary test-click-session-btn" data-selector="${this.escapeHtml(session.selector)}">点击</button>
              </div>
            </div>
          `).join('');

          // 添加点击事件
          listEl.querySelectorAll('.test-click-session-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const selector = (btn as HTMLElement).dataset.selector;
              if (selector) this.testClickSession(selector);
            });
          });
        }
      }

      this.log('测试', `找到 ${sessions.length} 个会话`, 'success');
    } else {
      if (countEl) countEl.textContent = '错误';
      if (listEl) listEl.innerHTML = '<div class="debug-empty">获取失败</div>';
      this.log('测试', '获取会话列表失败', 'error');
    }
  }

  private async testClickSession(selector: string): Promise<void> {
    this.log('测试', `正在点击会话: ${selector}`);

    const response = await this.sendToContent<{ success: boolean }>({
      type: 'CLICK_ELEMENT',
      selector,
    });

    if (response?.success) {
      this.log('测试', '点击成功', 'success');
      // 延迟后刷新会话列表
      setTimeout(() => this.testGetSessions(), 500);
    } else {
      this.log('测试', '点击失败', 'error');
    }
  }

  private async testInputText(): Promise<void> {
    const inputEl = document.getElementById('test-input-text') as HTMLInputElement;
    const resultEl = document.getElementById('test-input-result');
    const text = inputEl?.value || '';

    if (!text) {
      this.log('测试', '请输入测试文字', 'error');
      return;
    }

    this.log('测试', `正在输入: ${text.substring(0, 20)}...`);

    const response = await this.sendToContent<{ success: boolean }>({
      type: 'INPUT_TEXT',
      selector: 'happy-input',
      text,
    });

    if (response?.success) {
      if (resultEl) resultEl.innerHTML = `<div style="color: #4caf50;">✓ 输入成功: "${this.escapeHtml(text)}"</div>`;
      this.log('测试', '输入成功', 'success');
    } else {
      if (resultEl) resultEl.innerHTML = '<div style="color: #f44336;">✗ 输入失败</div>';
      this.log('测试', '输入失败', 'error');
    }
  }

  private async testSimulateSend(): Promise<void> {
    const resultEl = document.getElementById('test-input-result');
    this.log('测试', '正在模拟发送...');

    const response = await this.sendToContent<{ success: boolean }>({
      type: 'SIMULATE_SEND',
    });

    if (response?.success) {
      if (resultEl) resultEl.innerHTML = '<div style="color: #4caf50;">✓ 发送指令已执行</div>';
      this.log('测试', '发送指令已执行', 'success');
    } else {
      if (resultEl) resultEl.innerHTML = '<div style="color: #f44336;">✗ 发送失败</div>';
      this.log('测试', '发送失败', 'error');
    }
  }

  private async testClearInput(): Promise<void> {
    const resultEl = document.getElementById('test-input-result');
    this.log('测试', '正在清空输入框...');

    const response = await this.sendToContent<{ success: boolean }>({
      type: 'CLEAR_INPUT',
    });

    if (response?.success) {
      if (resultEl) resultEl.innerHTML = '<div style="color: #4caf50;">✓ 输入框已清空</div>';
      this.log('测试', '输入框已清空', 'success');
    } else {
      if (resultEl) resultEl.innerHTML = '<div style="color: #f44336;">✗ 清空失败</div>';
      this.log('测试', '清空失败', 'error');
    }
  }

  private async testGetChatMessages(): Promise<void> {
    const btn = document.getElementById('test-get-chat-btn');
    const countEl = document.getElementById('test-message-count');
    const contentEl = document.getElementById('test-chat-content');

    if (btn) btn.classList.add('loading');
    this.log('测试', '正在读取聊天内容...');

    const response = await this.sendToContent<{
      success: boolean;
      data: Array<{ role: string; content: string; index: number }>;
    }>({ type: 'GET_CHAT_MESSAGES' });

    if (btn) btn.classList.remove('loading');

    if (response?.success && response.data) {
      const messages = response.data;
      if (countEl) countEl.textContent = String(messages.length);

      if (contentEl) {
        if (messages.length === 0) {
          contentEl.innerHTML = '<div class="debug-empty">未找到聊天消息</div>';
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
        }
      }

      this.log('测试', `找到 ${messages.length} 条消息`, 'success');
    } else {
      if (countEl) countEl.textContent = '错误';
      if (contentEl) contentEl.innerHTML = '<div class="debug-empty">读取失败</div>';
      this.log('测试', '读取聊天内容失败', 'error');
    }
  }

  // ==================== Debug Tools (6.7 - 6.11) ====================

  // 6.7 输出监听测试
  private async testOutputListener(): Promise<void> {
    if (!this.activeSessionId) {
      this.log('输出测试', '请先选择活动会话', 'error');
      return;
    }

    const linesEl = document.getElementById('output-listener-lines') as HTMLInputElement;
    const resultEl = document.getElementById('output-listener-result');
    const lines = parseInt(linesEl?.value || '10', 10);

    this.log('输出测试', `正在捕获最后 ${lines} 行输出...`);

    const response = await this.sendToContent<{ output: string[] }>({
      type: 'GET_SESSION_OUTPUT',
      sessionId: this.activeSessionId,
      lines,
    });

    if (!resultEl) return;

    if (response?.output && response.output.length > 0) {
      const outputHtml = response.output.map((line, index) => `
        <div class="output-line" style="padding: 2px 0; border-bottom: 1px solid #2a2a2a; font-family: monospace; font-size: 11px;">
          <span style="color: #888; margin-right: 8px;">${index + 1}</span>
          <span style="color: #ccc;">${this.escapeHtml(line)}</span>
        </div>
      `).join('');

      resultEl.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 11px; color: #4caf50;">✓ 成功捕获 ${response.output.length} 行</div>
        <div style="max-height: 150px; overflow-y: auto; background: #1e1e1e; border-radius: 4px; padding: 8px;">
          ${outputHtml}
        </div>
      `;
      this.log('输出测试', `成功捕获 ${response.output.length} 行`, 'success');
    } else {
      resultEl.innerHTML = '<div class="debug-empty">未捕获到输出内容</div>';
      this.log('输出测试', '未捕获到输出内容', 'error');
    }
  }

  // 6.8 等待状态检测对比
  private async detectWaitingState(): Promise<void> {
    if (!this.activeSessionId) {
      this.log('等待检测', '请先选择活动会话', 'error');
      return;
    }

    const resultEl = document.getElementById('waiting-state-result');
    if (!resultEl) return;

    resultEl.innerHTML = '<div class="debug-empty">正在检测...</div>';
    this.log('等待检测', '正在检测等待状态...');

    // 先获取输出
    const outputResponse = await this.sendToContent<{ output: string[] }>({
      type: 'GET_SESSION_OUTPUT',
      sessionId: this.activeSessionId,
      lines: 10,
    });

    if (!outputResponse?.output) {
      resultEl.innerHTML = '<div class="debug-empty">获取会话输出失败</div>';
      this.log('等待检测', '获取会话输出失败', 'error');
      return;
    }

    // 发送到后台进行检测
    const response = await this.sendToBackground<{
      success: boolean;
      data: {
        ruleBasedResult: { waiting: boolean; matchedPattern: string | null; lastLine: string };
        aiResult: { waiting: boolean; state: string; confidence: number; role: string };
      };
    }>({
      type: 'DETECT_WAITING_STATE',
      recentText: outputResponse.output,
    });

    if (response?.success && response.data) {
      const { ruleBasedResult, aiResult } = response.data;

      resultEl.innerHTML = `
        <div class="waiting-comparison-row">
          <span class="waiting-comparison-label">规则检测:</span>
          <span class="waiting-comparison-value ${ruleBasedResult.waiting ? 'waiting' : 'not-waiting'}">
            ${ruleBasedResult.waiting ? '等待输入' : '运行中'}
          </span>
        </div>
        <div class="waiting-comparison-row">
          <span class="waiting-comparison-label">AI 检测:</span>
          <span class="waiting-comparison-value ${aiResult.waiting ? 'waiting' : 'not-waiting'}">
            ${aiResult.waiting ? '等待输入' : '运行中'} (${Math.round(aiResult.confidence * 100)}%)
          </span>
        </div>
        <div class="waiting-comparison-row">
          <span class="waiting-comparison-label">判定一致:</span>
          <span class="waiting-comparison-value ${ruleBasedResult.waiting === aiResult.waiting ? 'not-waiting' : 'waiting'}">
            ${ruleBasedResult.waiting === aiResult.waiting ? '一致' : '不一致'}
          </span>
        </div>
        <div class="waiting-signals">
          <div><strong>规则匹配:</strong> ${ruleBasedResult.matchedPattern || '无匹配'}</div>
          <div><strong>AI 角色:</strong> ${aiResult.role}</div>
          <div><strong>最后一行:</strong> ${this.escapeHtml(ruleBasedResult.lastLine)}</div>
        </div>
      `;

      this.log('等待检测', `规则: ${ruleBasedResult.waiting ? '等待' : '运行'}, AI: ${aiResult.waiting ? '等待' : '运行'}`, 'success');
    } else {
      resultEl.innerHTML = '<div class="debug-empty">检测失败</div>';
      this.log('等待检测', '检测失败', 'error');
    }
  }

  // 6.9 超时模拟
  private startTimeoutSimulation(): void {
    if (this.timeoutState.isRunning) return;

    const displayEl = document.getElementById('timeout-display');
    const valueEl = displayEl?.querySelector('.timeout-value');
    const statusEl = document.getElementById('timeout-status');
    const statusTextEl = statusEl?.querySelector('.timeout-status-text');
    const startBtn = document.getElementById('start-timeout-btn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stop-timeout-btn') as HTMLButtonElement;

    this.timeoutState.remaining = 30;
    this.timeoutState.isRunning = true;

    if (displayEl) displayEl.classList.add('running');
    if (displayEl) displayEl.classList.remove('expired');
    if (valueEl) valueEl.textContent = '30';
    if (statusTextEl) {
      statusTextEl.textContent = '正在模拟 WAITING_INPUT 状态...';
      statusTextEl.classList.add('waiting');
      statusTextEl.classList.remove('expired');
    }
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;

    this.log('超时模拟', '开始 30 秒倒计时');

    this.timeoutState.intervalId = window.setInterval(() => {
      this.timeoutState.remaining--;

      if (valueEl) valueEl.textContent = String(this.timeoutState.remaining);

      if (this.timeoutState.remaining <= 0) {
        this.onTimeoutExpired();
      }
    }, 1000);
  }

  private stopTimeoutSimulation(): void {
    if (!this.timeoutState.isRunning) return;

    if (this.timeoutState.intervalId !== null) {
      clearInterval(this.timeoutState.intervalId);
      this.timeoutState.intervalId = null;
    }

    this.timeoutState.isRunning = false;

    const displayEl = document.getElementById('timeout-display');
    const valueEl = displayEl?.querySelector('.timeout-value');
    const statusEl = document.getElementById('timeout-status');
    const statusTextEl = statusEl?.querySelector('.timeout-status-text');
    const startBtn = document.getElementById('start-timeout-btn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stop-timeout-btn') as HTMLButtonElement;

    if (displayEl) displayEl.classList.remove('running', 'expired');
    if (valueEl) valueEl.textContent = '--';
    if (statusTextEl) {
      statusTextEl.textContent = '已停止';
      statusTextEl.classList.remove('waiting', 'expired');
    }
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;

    this.log('超时模拟', '倒计时已停止');
  }

  private onTimeoutExpired(): void {
    if (this.timeoutState.intervalId !== null) {
      clearInterval(this.timeoutState.intervalId);
      this.timeoutState.intervalId = null;
    }

    this.timeoutState.isRunning = false;

    const displayEl = document.getElementById('timeout-display');
    const valueEl = displayEl?.querySelector('.timeout-value');
    const statusEl = document.getElementById('timeout-status');
    const statusTextEl = statusEl?.querySelector('.timeout-status-text');
    const startBtn = document.getElementById('start-timeout-btn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stop-timeout-btn') as HTMLButtonElement;

    if (displayEl) {
      displayEl.classList.remove('running');
      displayEl.classList.add('expired');
    }
    if (valueEl) valueEl.textContent = '0';
    if (statusTextEl) {
      statusTextEl.textContent = '超时! 等待输入已超过 30 秒';
      statusTextEl.classList.remove('waiting');
      statusTextEl.classList.add('expired');
    }
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;

    this.log('超时模拟', '30 秒超时已到期!', 'error');
  }

  // 6.10 危险命令测试
  private async checkDangerousCommand(): Promise<void> {
    const inputEl = document.getElementById('danger-command-input') as HTMLInputElement;
    const resultEl = document.getElementById('danger-result');
    const command = inputEl?.value.trim() || '';

    if (!command) {
      this.log('危险检测', '请输入命令', 'error');
      return;
    }

    this.log('危险检测', `检测命令: ${command.substring(0, 50)}...`);

    const response = await this.sendToBackground<{
      success: boolean;
      data: { isDangerous: boolean; matchedPattern: string | null; description: string | null };
    }>({
      type: 'CHECK_DANGEROUS',
      command,
    });

    if (!resultEl) return;

    if (response?.success && response.data) {
      const { isDangerous, description } = response.data;

      if (isDangerous) {
        resultEl.className = 'danger-result dangerous';
        resultEl.innerHTML = `
          <div style="display: flex; align-items: center;">
            <span class="danger-result-icon">⚠️</span>
            <span class="danger-result-text">危险命令!</span>
          </div>
          <div class="danger-matched-pattern">
            <strong>原因:</strong> ${description || '匹配危险模式'}
          </div>
        `;
        this.log('危险检测', `危险! ${description}`, 'error');
      } else {
        resultEl.className = 'danger-result safe';
        resultEl.innerHTML = `
          <div style="display: flex; align-items: center;">
            <span class="danger-result-icon">✓</span>
            <span class="danger-result-text">命令安全</span>
          </div>
        `;
        this.log('危险检测', '命令安全', 'success');
      }
    } else {
      resultEl.className = 'danger-result';
      resultEl.innerHTML = '<div class="debug-empty">检测失败</div>';
      this.log('危险检测', '检测失败', 'error');
    }
  }

  // 6.11 注入回滚测试
  private async injectTestText(): Promise<void> {
    if (!this.activeSessionId) {
      this.log('注入测试', '请先选择活动会话', 'error');
      return;
    }

    const inputEl = document.getElementById('rollback-test-input') as HTMLInputElement;
    const statusEl = document.getElementById('rollback-status');
    const rollbackBtn = document.getElementById('rollback-test-btn') as HTMLButtonElement;
    const text = inputEl?.value || '测试注入文本';

    this.log('注入测试', `正在注入: ${text.substring(0, 30)}...`);

    // 先获取当前值用于回滚
    const currentValueResponse = await this.sendToContent<{ value: string }>({
      type: 'GET_INPUT_VALUE',
    });

    this.rollbackState.previousValue = currentValueResponse?.value || '';
    this.rollbackState.sessionId = this.activeSessionId;

    // 执行注入
    const response = await this.sendToContent<{ success: boolean }>({
      type: 'PREVIEW_INPUT',
      sessionId: this.activeSessionId,
      text,
    });

    if (!statusEl) return;

    if (response?.success) {
      this.rollbackState.isInjected = true;
      statusEl.className = 'rollback-status injected';
      statusEl.innerHTML = `
        <div class="rollback-step">
          <span class="rollback-step-icon done">✓</span>
          <span>已注入: "${this.escapeHtml(text.substring(0, 30))}${text.length > 30 ? '...' : ''}"</span>
        </div>
        <div class="rollback-step">
          <span class="rollback-step-icon pending">2</span>
          <span>点击"回滚"恢复原值</span>
        </div>
      `;
      if (rollbackBtn) rollbackBtn.disabled = false;
      this.log('注入测试', '注入成功', 'success');
    } else {
      statusEl.innerHTML = '<div class="debug-empty">注入失败</div>';
      this.log('注入测试', '注入失败', 'error');
    }
  }

  private async rollbackTestText(): Promise<void> {
    if (!this.rollbackState.isInjected || !this.rollbackState.sessionId) {
      this.log('回滚测试', '没有可回滚的内容', 'error');
      return;
    }

    const statusEl = document.getElementById('rollback-status');
    const rollbackBtn = document.getElementById('rollback-test-btn') as HTMLButtonElement;

    this.log('回滚测试', '正在回滚...');

    // 清除预览并恢复
    await this.sendToContent({
      type: 'CLEAR_PREVIEW',
      sessionId: this.rollbackState.sessionId,
    });

    // 如果有之前的值，恢复它
    if (this.rollbackState.previousValue) {
      await this.sendToContent({
        type: 'PREVIEW_INPUT',
        sessionId: this.rollbackState.sessionId,
        text: this.rollbackState.previousValue,
      });
      // 再清除高亮
      await this.sendToContent({
        type: 'CLEAR_PREVIEW',
        sessionId: this.rollbackState.sessionId,
      });
    }

    this.rollbackState.isInjected = false;

    if (statusEl) {
      statusEl.className = 'rollback-status rolledback';
      statusEl.innerHTML = `
        <div class="rollback-step">
          <span class="rollback-step-icon done">✓</span>
          <span>已注入</span>
        </div>
        <div class="rollback-step">
          <span class="rollback-step-icon done">✓</span>
          <span>已回滚到原值${this.rollbackState.previousValue ? `: "${this.escapeHtml(this.rollbackState.previousValue.substring(0, 20))}"` : ''}</span>
        </div>
      `;
    }
    if (rollbackBtn) rollbackBtn.disabled = true;
    this.log('回滚测试', '回滚成功', 'success');
  }

  // ==================== Action Confirmation Modal ====================

  private showConfirmationModal(action: PendingAction): Promise<boolean> {
    return new Promise((resolve) => {
      // 创建模态框
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const content = document.createElement('div');
      content.className = 'modal-content';

      content.innerHTML = `
        <div class="modal-header">
          <span class="modal-icon warning">⚠️</span>
          <span class="modal-title">确认执行</span>
        </div>
        <div class="modal-body">
          <p class="modal-message">确定要执行以下命令吗？</p>
          <div class="modal-command">${this.escapeHtml(action.command)}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel-btn">取消</button>
          <button class="btn btn-warning" id="modal-confirm-btn">确认执行</button>
        </div>
      `;

      overlay.appendChild(content);
      document.body.appendChild(overlay);

      const cancelBtn = content.querySelector('#modal-cancel-btn');
      const confirmBtn = content.querySelector('#modal-confirm-btn');

      const cleanup = () => {
        document.body.removeChild(overlay);
      };

      cancelBtn?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });

      confirmBtn?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      });
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
