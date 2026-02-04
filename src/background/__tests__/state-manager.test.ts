// src/background/__tests__/state-manager.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../state-manager';

describe('StateManager', () => {
  let manager: StateManager;

  beforeEach(() => {
    manager = new StateManager();
  });

  it('should store and retrieve sessions', () => {
    const sessions = [
      { sessionId: '1', title: 'Test', visible: true, domSelector: '[data-session-id="1"]' },
    ];

    manager.setSessions(sessions);

    expect(manager.getSessions()).toEqual(sessions);
  });

  it('should set and get active session', () => {
    manager.setActiveSession('session-1');

    expect(manager.getActiveSession()).toBe('session-1');
  });

  it('should track API status', () => {
    manager.setAPIStatus('minimax', { connected: true, latency: 100 });

    const status = manager.getAPIStatus('minimax');
    expect(status?.connected).toBe(true);
    expect(status?.latency).toBe(100);
  });

  it('should log actions', () => {
    manager.logAction('SCAN', { count: 3 });
    manager.logAction('PREVIEW', { text: 'test' });

    const logs = manager.getLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('SCAN');
  });

  it('should export snapshot', () => {
    manager.setSessions([{ sessionId: '1', title: 'T', visible: true, domSelector: '' }]);
    manager.setActiveSession('1');
    manager.logAction('TEST', {});

    const snapshot = manager.exportSnapshot();

    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.activeSessionId).toBe('1');
    // setSessions logs SESSIONS_UPDATED, setActiveSession logs ACTIVE_SESSION_CHANGED, plus our TEST log
    expect(snapshot.logs).toHaveLength(3);
    expect(snapshot.logs[2].action).toBe('TEST');
  });

  it('should clear logs', () => {
    manager.logAction('TEST1', {});
    manager.logAction('TEST2', {});
    manager.clearLogs();

    expect(manager.getLogs()).toHaveLength(0);
  });

  it('should cap logs at 1000 entries', () => {
    for (let i = 0; i < 1050; i++) {
      manager.logAction('TEST', { index: i });
    }

    const logs = manager.getLogs();
    expect(logs.length).toBeLessThanOrEqual(1000);
  });
});
