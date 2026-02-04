// src/content/__tests__/session-scanner.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionScanner } from '../session-scanner';

describe('SessionScanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find terminal elements with data-session-id attribute', () => {
    document.body.innerHTML = `
      <div data-session-id="session-1" data-title="Terminal 1"></div>
      <div data-session-id="session-2" data-title="Terminal 2"></div>
    `;

    const scanner = new SessionScanner();
    const sessions = scanner.scan();

    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe('session-1');
    expect(sessions[1].sessionId).toBe('session-2');
  });

  it('should detect visibility of sessions', () => {
    document.body.innerHTML = `
      <div data-session-id="visible" style="display: block;"></div>
      <div data-session-id="hidden" style="display: none;"></div>
    `;

    const scanner = new SessionScanner();
    const sessions = scanner.scan();

    expect(sessions.find(s => s.sessionId === 'visible')?.visible).toBe(true);
    expect(sessions.find(s => s.sessionId === 'hidden')?.visible).toBe(false);
  });

  it('should return empty array when no terminals found', () => {
    document.body.innerHTML = '<div>No terminals here</div>';

    const scanner = new SessionScanner();
    const sessions = scanner.scan();

    expect(sessions).toHaveLength(0);
  });
});
