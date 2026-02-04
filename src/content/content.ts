// src/content/content.ts

import { SessionScanner } from './session-scanner';
import { InputInjector } from './input-injector';
import { OutputListener } from './output-listener';
import type { Message } from '../types';

const scanner = new SessionScanner();
const injector = new InputInjector();
const listener = new OutputListener();

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
    case 'GET_SESSION_OUTPUT': {
      const output = listener.getRecentOutput(message.sessionId, message.lines);
      sendResponse({ type: 'SESSION_OUTPUT_RESULT', sessionId: message.sessionId, output });
      break;
    }
    default:
      break;
  }
  return true; // Keep channel open for async response
});

console.log('[Happy Debug] Content script loaded');
