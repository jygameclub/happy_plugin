// src/content/content.ts

import { SessionScanner } from './session-scanner';
import type { Message, Session } from '../types';

const scanner = new SessionScanner();

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  switch (message.type) {
    case 'SCAN_SESSIONS': {
      const sessions = scanner.scan();
      sendResponse({ type: 'SCAN_SESSIONS_RESULT', sessions });
      break;
    }
  }
  return true; // Keep channel open for async response
});

console.log('[Happy Debug] Content script loaded');
