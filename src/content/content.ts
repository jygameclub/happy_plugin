// src/content/content.ts

import { SessionScanner } from './session-scanner';
import { InputInjector } from './input-injector';
import type { Message } from '../types';

const scanner = new SessionScanner();
const injector = new InputInjector();

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  switch (message.type) {
    case 'SCAN_SESSIONS': {
      const sessions = scanner.scan();
      sendResponse({ type: 'SCAN_SESSIONS_RESULT', sessions });
      break;
    }
    case 'PREVIEW_INPUT': {
      const result = injector.preview(message.sessionId, message.text);
      sendResponse(result);
      break;
    }
    case 'CLEAR_PREVIEW': {
      const result = injector.clearPreview(message.sessionId);
      sendResponse(result);
      break;
    }
    case 'HIGHLIGHT_SESSION': {
      const result = injector.highlight(message.sessionId, message.highlight);
      sendResponse(result);
      break;
    }
    default:
      // Other message types will be handled in future tasks
      break;
  }
  return true; // Keep channel open for async response
});

console.log('[Happy Debug] Content script loaded');
