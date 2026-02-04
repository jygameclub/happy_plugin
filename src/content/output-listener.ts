// src/content/output-listener.ts

export class OutputListener {
  private outputSelector: string;

  constructor(outputSelector = '.terminal-output, .output, pre') {
    this.outputSelector = outputSelector;
  }

  getRecentOutput(sessionId: string, lineCount: number): string[] {
    const container = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!container) {
      return [];
    }

    const outputElement = container.querySelector(this.outputSelector);
    if (!outputElement) {
      return [];
    }

    const children = outputElement.children;
    const lines: string[] = [];

    if (children.length > 0) {
      for (let i = 0; i < children.length; i++) {
        const text = children[i].textContent?.trim();
        if (text) {
          lines.push(text);
        }
      }
    } else {
      const text = outputElement.textContent || '';
      lines.push(...text.split('\n').map(l => l.trim()).filter(l => l));
    }

    return lines.slice(-lineCount);
  }

  detectWaitingState(sessionId: string): { waiting: boolean; signals: Record<string, unknown> } {
    const recentLines = this.getRecentOutput(sessionId, 5);
    const lastLine = recentLines[recentLines.length - 1] || '';

    const waitingPatterns = [
      /\$\s*$/,
      />\s*$/,
      /:\s*$/,
      /\?\s*$/,
      /input/i,
    ];

    const waiting = waitingPatterns.some(pattern => pattern.test(lastLine));

    return {
      waiting,
      signals: {
        lastLine,
        matchedPattern: waiting ? 'prompt_detected' : null,
        lineCount: recentLines.length,
      },
    };
  }
}
