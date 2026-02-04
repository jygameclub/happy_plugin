// src/content/__tests__/input-injector.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { InputInjector } from '../input-injector';

describe('InputInjector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should preview text in input field without submitting', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session">
        <input type="text" class="terminal-input" />
      </div>
    `;

    const injector = new InputInjector();
    const result = injector.preview('test-session', 'test input');

    expect(result.success).toBe(true);
    const input = document.querySelector('.terminal-input') as HTMLInputElement;
    expect(input.value).toBe('test input');
  });

  it('should clear preview from input field', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session">
        <input type="text" class="terminal-input" value="existing" />
      </div>
    `;

    const injector = new InputInjector();
    injector.preview('test-session', 'test input');
    injector.clearPreview('test-session');

    const input = document.querySelector('.terminal-input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('should highlight session container', () => {
    document.body.innerHTML = `
      <div data-session-id="test-session"></div>
    `;

    const injector = new InputInjector();
    injector.highlight('test-session', true);

    const container = document.querySelector('[data-session-id="test-session"]') as HTMLElement;
    expect(container.style.outline).toContain('2px solid');
  });

  it('should return error when session not found', () => {
    document.body.innerHTML = '<div></div>';

    const injector = new InputInjector();
    const result = injector.preview('non-existent', 'test');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
