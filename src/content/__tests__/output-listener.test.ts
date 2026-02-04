// src/content/__tests__/output-listener.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { OutputListener } from '../output-listener';

describe('OutputListener', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should extract recent lines from session output', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session">
        <div class="terminal-output">
          <div>Line 1</div>
          <div>Line 2</div>
          <div>Line 3</div>
        </div>
      </div>
    `;

    const listener = new OutputListener();
    const lines = listener.getRecentOutput('test-session', 2);

    expect(lines).toHaveLength(2);
    expect(lines).toContain('Line 2');
    expect(lines).toContain('Line 3');
  });

  it('should return all lines if requested more than available', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session">
        <div class="terminal-output">
          <div>Only line</div>
        </div>
      </div>
    `;

    const listener = new OutputListener();
    const lines = listener.getRecentOutput('test-session', 10);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Only line');
  });

  it('should return empty array when session not found', () => {
    document.body.innerHTML = '<div></div>';

    const listener = new OutputListener();
    const lines = listener.getRecentOutput('non-existent', 5);

    expect(lines).toHaveLength(0);
  });
});
