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

class DebugConsole {
  private sessions: Session[] = [];
  private activeSessionId: string | null = null;
  private pendingAction: PendingAction | null = null;
  private logs: LogEntry[] = [];
  private configStorage: ConfigStorage;

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
  }

  // ==================== Communication ====================

  private async sendToContent<T>(message: Message): Promise<T | null> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        this.log('错误', '未找到活动标签页');
        return null;
      }
      const response = await chrome.tabs.sendMessage(tab.id, message);
      return response as T;
    } catch (error) {
      this.log('错误', `内容脚本错误: ${error}`);
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

    this.log('动作', `正在执行: "${this.pendingAction.command.substring(0, 50)}..."`);

    // Send execute command to content script
    await this.sendToContent({
      type: 'PREVIEW_INPUT',
      sessionId: this.pendingAction.sessionId,
      text: this.pendingAction.command,
    });

    // Note: Actual execution (pressing Enter) would be handled by content script
    // For now, we log the action
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
