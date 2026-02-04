// src/content/session-scanner.ts

import type { Session } from '../types';

export class SessionScanner {
  private selector: string;

  constructor(selector = '[data-session-id]') {
    this.selector = selector;
  }

  scan(): Session[] {
    const elements = document.querySelectorAll(this.selector);
    const sessions: Session[] = [];

    elements.forEach((element) => {
      const el = element as HTMLElement;
      const sessionId = el.dataset.sessionId;

      if (sessionId) {
        sessions.push({
          sessionId,
          title: el.dataset.title || `Session ${sessionId}`,
          visible: this.isVisible(el),
          domSelector: this.generateSelector(el),
        });
      }
    });

    return sessions;
  }

  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  private generateSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }
    if (element.dataset.sessionId) {
      return `[data-session-id="${element.dataset.sessionId}"]`;
    }
    return '';
  }
}
