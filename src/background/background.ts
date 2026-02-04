// src/background/background.ts

import { StateManager } from './state-manager';
import { APIClient, APIConfig } from '../services/api-client';
import { AIJudge } from '../services/ai-judge';

const state = new StateManager();
const aiJudge = new AIJudge();
let apiClient: APIClient | null = null;

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
      const config = message.config as APIConfig;
      const provider = message.provider as 'minimax' | 'glm';
      if (!config || !config.apiKey || !config.baseUrl) {
        sendResponse({
          provider,
          connected: false,
          latency: null,
          error: '未配置 API Key 或 Base URL',
        });
        break;
      }
      apiClient = new APIClient(config);
      aiJudge.setClient(apiClient);
      apiClient.checkConnection().then((result) => {
        sendResponse({
          provider,
          connected: result.success && result.data?.connected === true,
          latency: result.latency ?? null,
          error: result.error ?? null,
        });
      });
      return true; // Keep channel open for async response
    }
    case 'ANALYZE_SESSION': {
      const { recentText, signals } = message;
      if (!Array.isArray(recentText)) {
        sendResponse({ success: false, error: 'Invalid input: recentText must be an array' });
        break;
      }
      const input = aiJudge.formatInput(recentText, signals || {});
      aiJudge.analyze(input).then((result) => {
        sendResponse({ success: true, data: result });
      });
      return true; // Keep channel open for async response
    }
    case 'CHECK_DANGEROUS': {
      const { command } = message;
      if (typeof command !== 'string') {
        sendResponse({ success: false, error: 'Invalid input: command must be a string' });
        break;
      }
      const isDangerous = aiJudge.isDangerousCommand(command);
      sendResponse({ success: true, data: { isDangerous } });
      break;
    }
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      break;
  }
  return true;
});

console.log('[Happy Debug] Background service worker started');
