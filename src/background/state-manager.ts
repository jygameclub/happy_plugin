// src/background/state-manager.ts

import type { Session, APIStatus } from '../types';

export interface ActionLog {
  timestamp: number;
  action: string;
  data: Record<string, unknown>;
}

export interface DebugSnapshot {
  sessions: Session[];
  activeSessionId: string | null;
  apiStatuses: Record<string, APIStatus>;
  logs: ActionLog[];
  exportedAt: number;
}

export class StateManager {
  private sessions: Session[] = [];
  private activeSessionId: string | null = null;
  private apiStatuses: Map<string, APIStatus> = new Map();
  private logs: ActionLog[] = [];

  setSessions(sessions: Session[]): void {
    this.sessions = sessions;
    this.logAction('SESSIONS_UPDATED', { count: sessions.length });
  }

  getSessions(): Session[] {
    return this.sessions;
  }

  setActiveSession(sessionId: string | null): void {
    this.activeSessionId = sessionId;
    this.logAction('ACTIVE_SESSION_CHANGED', { sessionId });
  }

  getActiveSession(): string | null {
    return this.activeSessionId;
  }

  setAPIStatus(provider: string, status: Partial<APIStatus>): void {
    const current = this.apiStatuses.get(provider) || {
      provider: provider as 'minimax' | 'glm',
      connected: false,
      latency: null,
      error: null,
    };
    this.apiStatuses.set(provider, { ...current, ...status });
  }

  getAPIStatus(provider: string): APIStatus | undefined {
    return this.apiStatuses.get(provider);
  }

  logAction(action: string, data: Record<string, unknown>): void {
    this.logs.push({
      timestamp: Date.now(),
      action,
      data,
    });

    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  getLogs(): ActionLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportSnapshot(): DebugSnapshot {
    return {
      sessions: this.sessions,
      activeSessionId: this.activeSessionId,
      apiStatuses: Object.fromEntries(this.apiStatuses),
      logs: this.logs,
      exportedAt: Date.now(),
    };
  }
}
