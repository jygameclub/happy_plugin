// src/background/background.ts

import { StateManager } from './state-manager';

const state = new StateManager();

// Handle extension icon click - open side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle messages from side panel and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATE': {
      sendResponse({
        sessions: state.getSessions(),
        activeSessionId: state.getActiveSession(),
      });
      break;
    }
    case 'SET_SESSIONS': {
      state.setSessions(message.sessions);
      sendResponse({ success: true });
      break;
    }
    case 'SET_ACTIVE_SESSION': {
      state.setActiveSession(message.sessionId);
      sendResponse({ success: true });
      break;
    }
    case 'LOG_ACTION': {
      state.logAction(message.action, message.data);
      sendResponse({ success: true });
      break;
    }
    case 'GET_LOGS': {
      sendResponse({ logs: state.getLogs() });
      break;
    }
    case 'EXPORT_SNAPSHOT': {
      sendResponse({ snapshot: state.exportSnapshot() });
      break;
    }
    case 'CHECK_API': {
      // Will be implemented in Task 9
      sendResponse({ success: false, error: 'Not implemented' });
      break;
    }
  }
  return true;
});

console.log('[Happy Debug] Background service worker started');
