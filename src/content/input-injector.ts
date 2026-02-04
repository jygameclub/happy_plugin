// src/content/input-injector.ts

export interface InjectionResult {
  success: boolean;
  error?: string;
  previousValue?: string;
}

export class InputInjector {
  private inputSelector: string;
  private previousValues: Map<string, string> = new Map();

  constructor(inputSelector = '.terminal-input, input[type="text"], textarea') {
    this.inputSelector = inputSelector;
  }

  preview(sessionId: string, text: string): InjectionResult {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!container) {
      return { success: false, error: `Session ${sessionId} not found` };
    }

    const input = container.querySelector(this.inputSelector) as HTMLInputElement | HTMLTextAreaElement;
    if (!input) {
      return { success: false, error: `Input field not found in session ${sessionId}` };
    }

    this.previousValues.set(sessionId, input.value);
    input.value = text;
    input.style.backgroundColor = '#fffbcc';

    return { success: true, previousValue: this.previousValues.get(sessionId) };
  }

  clearPreview(sessionId: string): InjectionResult {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!container) {
      return { success: false, error: `Session ${sessionId} not found` };
    }

    const input = container.querySelector(this.inputSelector) as HTMLInputElement | HTMLTextAreaElement;
    if (!input) {
      return { success: false, error: `Input field not found in session ${sessionId}` };
    }

    input.value = '';
    input.style.backgroundColor = '';

    return { success: true };
  }

  rollback(sessionId: string): InjectionResult {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!container) {
      return { success: false, error: `Session ${sessionId} not found` };
    }

    const input = container.querySelector(this.inputSelector) as HTMLInputElement | HTMLTextAreaElement;
    if (!input) {
      return { success: false, error: `Input field not found in session ${sessionId}` };
    }

    const previousValue = this.previousValues.get(sessionId) || '';
    input.value = previousValue;
    input.style.backgroundColor = '';

    return { success: true };
  }

  highlight(sessionId: string, enabled: boolean): InjectionResult {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`) as HTMLElement;
    if (!container) {
      return { success: false, error: `Session ${sessionId} not found` };
    }

    if (enabled) {
      container.style.outline = '2px solid #4CAF50';
      container.style.outlineOffset = '2px';
    } else {
      container.style.outline = '';
      container.style.outlineOffset = '';
    }

    return { success: true };
  }
}
