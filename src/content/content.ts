// src/content/content.ts

import { SessionScanner } from './session-scanner';
import { InputInjector } from './input-injector';
import { OutputListener } from './output-listener';
import { PageAnalyzer } from './page-analyzer';
import type { Message } from '../types';

const scanner = new SessionScanner();
const injector = new InputInjector();
const listener = new OutputListener();
const pageAnalyzer = new PageAnalyzer();

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
    // 页面调试功能
    case 'GET_PAGE_INFO': {
      const pageInfo = pageAnalyzer.getPageInfo();
      sendResponse({ success: true, data: pageInfo });
      break;
    }
    case 'ANALYZE_PAGE_STRUCTURE': {
      const structure = pageAnalyzer.analyzeStructure();
      sendResponse({ success: true, data: structure });
      break;
    }
    case 'GET_SESSIONS_LIST': {
      const sessionsList = pageAnalyzer.getSessionsList();
      sendResponse({ success: true, data: sessionsList });
      break;
    }
    case 'GET_CONTENT_STATE': {
      const contentState = pageAnalyzer.getContentState();
      sendResponse({ success: true, data: contentState });
      break;
    }
    case 'GET_ELEMENT_INFO': {
      const elementInfo = pageAnalyzer.getElementInfo(message.selector);
      sendResponse({ success: true, data: elementInfo });
      break;
    }
    case 'HIGHLIGHT_ELEMENT': {
      const highlighted = pageAnalyzer.highlightElement(message.selector, message.duration);
      sendResponse({ success: highlighted });
      break;
    }
    case 'CLICK_ELEMENT': {
      const clicked = pageAnalyzer.clickElement(message.selector);
      sendResponse({ success: clicked });
      break;
    }
    case 'INPUT_TEXT': {
      const inputted = pageAnalyzer.inputText(message.selector, message.text);
      sendResponse({ success: inputted });
      break;
    }
    // Happy 测试功能
    case 'CLEAR_INPUT': {
      const cleared = pageAnalyzer.clearInput();
      sendResponse({ success: cleared });
      break;
    }
    case 'SIMULATE_SEND': {
      const sent = pageAnalyzer.simulateSend();
      sendResponse({ success: sent });
      break;
    }
    case 'GET_CHAT_MESSAGES': {
      const chatMessages = pageAnalyzer.getChatMessages();
      sendResponse({ success: true, data: chatMessages });
      break;
    }
    case 'GET_INPUT_VALUE': {
      const inputValue = pageAnalyzer.getInputValue();
      sendResponse({ success: true, data: inputValue });
      break;
    }
    default:
      break;
  }
  return true; // Keep channel open for async response
});

console.log('[Happy Debug] Content script loaded on:', window.location.href);

// 测试 PageAnalyzer 是否正常工作
try {
  const testInfo = pageAnalyzer.getPageInfo();
  console.log('[Happy Debug] PageAnalyzer test - getPageInfo:', testInfo);
} catch (e) {
  console.error('[Happy Debug] PageAnalyzer test failed:', e);
}
