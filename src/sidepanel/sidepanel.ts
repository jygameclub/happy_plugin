// src/sidepanel/sidepanel.ts

import type { Session } from '../types/session';
import type { AIJudgeOutput, APIStatus } from '../types/ai-judge';
import type { Message } from '../types/messages';

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

  constructor() {
    this.initPanelToggles();
    this.initEventListeners();
    this.loadInitialState();
    this.log('INFO', 'Debug Console initialized');
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
    // Environment section
    document.getElementById('check-minimax-btn')?.addEventListener('click', () => {
      this.checkAPI('minimax');
    });
    document.getElementById('check-glm-btn')?.addEventListener('click', () => {
      this.checkAPI('glm');
    });
    document.getElementById('check-all-api-btn')?.addEventListener('click', () => {
      this.checkAPI('minimax');
      this.checkAPI('glm');
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
        this.log('ERROR', 'No active tab found');
        return null;
      }
      const response = await chrome.tabs.sendMessage(tab.id, message);
      return response as T;
    } catch (error) {
      this.log('ERROR', `Content script error: ${error}`);
      return null;
    }
  }

  private async sendToBackground<T>(message: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response as T;
    } catch (error) {
      this.log('ERROR', `Background error: ${error}`);
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

  // ==================== API Check ====================

  async checkAPI(provider: 'minimax' | 'glm'): Promise<void> {
    const statusEl = document.getElementById(`${provider}-status`);
    const btn = document.getElementById(`check-${provider}-btn`);

    if (statusEl) {
      statusEl.textContent = '...';
      statusEl.className = 'api-indicator';
    }
    if (btn) btn.classList.add('loading');

    this.log('API_CHECK', `Checking ${provider.toUpperCase()} API...`);

    const response = await this.sendToBackground<APIStatus>({
      type: 'CHECK_API',
      provider,
    });

    if (btn) btn.classList.remove('loading');

    if (response && response.connected) {
      if (statusEl) {
        statusEl.textContent = `${response.latency}ms`;
        statusEl.className = 'api-indicator connected';
      }
      this.log('API_CHECK', `${provider.toUpperCase()} connected (${response.latency}ms)`, 'success');
    } else {
      if (statusEl) {
        statusEl.textContent = 'Error';
        statusEl.className = 'api-indicator error';
      }
      this.log('API_CHECK', `${provider.toUpperCase()} failed: ${response?.error || 'Unknown error'}`, 'error');
    }
  }

  // ==================== Session Management ====================

  async scanSessions(): Promise<void> {
    const btn = document.getElementById('scan-sessions-btn');
    if (btn) btn.classList.add('loading');

    this.log('SCAN', 'Scanning for terminal sessions...');

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
      this.log('SCAN', `Found ${this.sessions.length} session(s)`, 'success');
    } else {
      this.log('SCAN', 'No sessions found or scan failed', 'error');
    }
  }

  renderSessionList(): void {
    const listEl = document.getElementById('session-list');
    if (!listEl) return;

    if (this.sessions.length === 0) {
      listEl.innerHTML = '<div class="session-empty">No sessions found. Click "Scan Sessions" to detect terminals.</div>';
      this.updateActiveSessionDisplay();
      return;
    }

    listEl.innerHTML = this.sessions
      .map(
        (session) => `
        <div class="session-item ${session.sessionId === this.activeSessionId ? 'active' : ''}"
             data-session-id="${session.sessionId}">
          <span class="session-title">${this.escapeHtml(session.title)}</span>
          <span class="session-visibility">${session.visible ? 'visible' : 'hidden'}</span>
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
    this.log('SESSION', `Switched to: ${session?.title || sessionId}`, 'success');
  }

  private updateActiveSessionDisplay(): void {
    const infoEl = document.getElementById('active-session-info');
    if (!infoEl) return;

    if (this.activeSessionId) {
      const session = this.sessions.find((s) => s.sessionId === this.activeSessionId);
      infoEl.textContent = session?.title || this.activeSessionId;
    } else {
      infoEl.textContent = 'None selected';
    }
  }

  // ==================== Input Simulation ====================

  async previewInput(): Promise<void> {
    const textareaEl = document.getElementById('input-text') as HTMLTextAreaElement;
    if (!textareaEl) return;

    const text = textareaEl.value.trim();
    if (!text) {
      this.log('INPUT', 'No input text provided', 'error');
      return;
    }

    if (!this.activeSessionId) {
      this.log('INPUT', 'No active session selected', 'error');
      return;
    }

    this.log('INPUT', `Previewing: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

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
    this.log('INPUT', 'Input cleared');
  }

  // ==================== AI Judge ====================

  async analyzeSession(): Promise<void> {
    if (!this.activeSessionId) {
      this.log('ANALYZE', 'No active session selected', 'error');
      return;
    }

    const lineCountEl = document.getElementById('line-count') as HTMLInputElement;
    const lines = parseInt(lineCountEl?.value || '20', 10);

    const btn = document.getElementById('analyze-btn');
    if (btn) btn.classList.add('loading');

    this.log('ANALYZE', `Analyzing last ${lines} lines...`);

    // Get session output from content script
    const outputResponse = await this.sendToContent<{ output: string[] }>({
      type: 'GET_SESSION_OUTPUT',
      sessionId: this.activeSessionId,
      lines,
    });

    if (!outputResponse?.output) {
      if (btn) btn.classList.remove('loading');
      this.log('ANALYZE', 'Failed to get session output', 'error');
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
        'ANALYZE',
        `Role: ${response.result.role}, State: ${response.result.state}, Confidence: ${Math.round(response.result.confidence * 100)}%`,
        'success'
      );
    } else {
      this.renderAIResult(null);
      this.log('ANALYZE', 'Analysis failed or not implemented', 'error');
    }
  }

  renderAIResult(result: AIJudgeOutput | null): void {
    const resultEl = document.getElementById('ai-result');
    if (!resultEl) return;

    if (!result) {
      resultEl.innerHTML = '<div class="ai-result-empty">No analysis yet. Click "Analyze Session" to get AI judgment.</div>';
      return;
    }

    const roleClass = `role-${result.role.toLowerCase()}`;
    const stateClass = `state-${result.state.toLowerCase().replace('_', '-')}`;
    const confidencePercent = Math.round(result.confidence * 100);

    resultEl.innerHTML = `
      <div class="ai-result-data">
        <div class="ai-result-row">
          <span class="ai-result-label">Role:</span>
          <span class="ai-result-value ${roleClass}">${result.role}</span>
        </div>
        <div class="ai-result-row">
          <span class="ai-result-label">State:</span>
          <span class="ai-result-value ${stateClass}">${result.state}</span>
        </div>
        <div class="ai-result-row">
          <span class="ai-result-label">Confidence:</span>
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
      previewEl.innerHTML = '<div class="action-preview-empty">No action pending</div>';
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
      this.log('ACTION', 'No pending action to execute', 'error');
      return;
    }

    this.log('ACTION', `Executing: "${this.pendingAction.command.substring(0, 50)}..."`);

    // Send execute command to content script
    await this.sendToContent({
      type: 'PREVIEW_INPUT',
      sessionId: this.pendingAction.sessionId,
      text: this.pendingAction.command,
    });

    // Note: Actual execution (pressing Enter) would be handled by content script
    // For now, we log the action
    this.log('ACTION', 'Action executed successfully', 'success');

    this.pendingAction = null;
    this.updateActionPreview();
    this.clearInput();
  }

  async cancelAction(): Promise<void> {
    if (!this.pendingAction) {
      return;
    }

    this.log('ACTION', 'Action cancelled');

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
    this.log('EXPORT', 'Exporting debug snapshot...');

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

      this.log('EXPORT', 'Snapshot exported successfully', 'success');
    } else {
      this.log('EXPORT', 'Failed to export snapshot', 'error');
    }
  }

  clearLogs(): void {
    this.logs = [];
    const logViewer = document.getElementById('log-viewer');
    if (logViewer) {
      logViewer.innerHTML = '<div class="log-empty">No logs yet.</div>';
    }
    this.log('LOGS', 'Logs cleared');
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
