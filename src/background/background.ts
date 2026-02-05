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
      const provider = message.provider as 'deepseek';
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
      const result = aiJudge.checkDangerousCommand(command);
      sendResponse({ success: true, data: result });
      break;
    }
    case 'DETECT_WAITING_STATE': {
      const { recentText } = message;
      if (!Array.isArray(recentText)) {
        sendResponse({ success: false, error: 'Invalid input: recentText must be an array' });
        break;
      }
      // 规则检测
      const lastLine = recentText[recentText.length - 1] || '';
      const promptPatterns = [
        { pattern: /\$\s*$/, name: 'Shell 提示符 ($)' },
        { pattern: />\s*$/, name: '箭头提示符 (>)' },
        { pattern: /:\s*$/, name: '冒号提示符 (:)' },
        { pattern: /\?\s*$/, name: '问号提示符 (?)' },
        { pattern: /input/i, name: '包含 "input"' },
        { pattern: /enter/i, name: '包含 "enter"' },
        { pattern: /password/i, name: '包含 "password"' },
        { pattern: /y\/n/i, name: '确认提示 (y/n)' },
        { pattern: /\[Y\/n\]/i, name: '确认提示 [Y/n]' },
        { pattern: /press\s+any\s+key/i, name: '按任意键继续' },
      ];

      let ruleWaiting = false;
      let matchedPatternName = null;
      for (const p of promptPatterns) {
        if (p.pattern.test(lastLine)) {
          ruleWaiting = true;
          matchedPatternName = p.name;
          break;
        }
      }

      // AI 检测（使用现有的 analyze 方法）
      const input = aiJudge.formatInput(recentText, {});
      aiJudge.analyze(input).then((aiResult) => {
        sendResponse({
          success: true,
          data: {
            ruleBasedResult: {
              waiting: ruleWaiting,
              matchedPattern: matchedPatternName,
              lastLine: lastLine.substring(0, 100),
            },
            aiResult: {
              waiting: aiResult.state === 'WAITING_INPUT',
              state: aiResult.state,
              confidence: aiResult.confidence,
              role: aiResult.role,
            },
          },
        });
      });
      return true; // Keep channel open for async response
    }
    case 'CHAT_TEST': {
      const chatConfig = message.config as APIConfig;
      const chatMessage = message.message as string;

      if (!chatConfig || !chatConfig.apiKey || !chatConfig.baseUrl) {
        sendResponse({
          success: false,
          error: '未配置 API Key 或 Base URL',
        });
        break;
      }

      if (!chatMessage) {
        sendResponse({
          success: false,
          error: '消息不能为空',
        });
        break;
      }

      const chatClient = new APIClient(chatConfig);
      const start = Date.now();

      // 使用配置中的模型，如果没有则使用默认值
      const defaultModel = chatConfig.provider === 'openai' ? 'gpt-4o' : 'deepseek-chat';
      const chatModel = chatConfig.model || defaultModel;
      const endpoint = '/chat/completions';
      const body = {
        model: chatModel,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: chatMessage },
        ],
        stream: false,
      };

      chatClient.post<{
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      }>(endpoint, body).then((result) => {
        const latency = Date.now() - start;

        const content = result.data?.choices?.[0]?.message?.content;

        if (result.success && content) {
          sendResponse({
            success: true,
            content,
            latency,
          });
        } else {
          let errorMsg = result.error || 'API 响应格式错误';
          if (result.data?.error?.message) {
            errorMsg = result.data.error.message;
          }
          if (!content && result.data) {
            errorMsg += ` (响应: ${JSON.stringify(result.data).substring(0, 200)})`;
          }
          sendResponse({
            success: false,
            error: errorMsg,
            latency,
          });
        }
      }).catch((err) => {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : '请求失败',
        });
      });

      return true; // Keep channel open for async response
    }
    case 'ANALYZE_SCREENSHOT': {
      const screenshotConfig = message.config as APIConfig;
      const imageData = message.image as string;
      const prompt = message.prompt as string;

      if (!screenshotConfig || !screenshotConfig.apiKey || !screenshotConfig.baseUrl) {
        sendResponse({
          success: false,
          error: '未配置 API Key 或 Base URL',
        });
        break;
      }

      if (!imageData) {
        sendResponse({
          success: false,
          error: '没有截图数据',
        });
        break;
      }

      const screenshotClient = new APIClient(screenshotConfig);
      const startTime = Date.now();

      // 使用配置中的模型，如果没有则使用默认视觉模型
      const defaultVisionModel = screenshotConfig.provider === 'openai' ? 'gpt-4o' : 'deepseek-chat';
      const visionModel = screenshotConfig.model || defaultVisionModel;
      const visionEndpoint = '/chat/completions';
      const visionBody = {
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || '请分析这个网页截图的布局和内容',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        stream: false,
      };

      screenshotClient.post<{
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      }>(visionEndpoint, visionBody).then((result) => {
        const latency = Date.now() - startTime;

        const content = result.data?.choices?.[0]?.message?.content;

        if (result.success && content) {
          sendResponse({
            success: true,
            content,
            latency,
          });
        } else {
          let errorMsg = result.error || 'API 响应格式错误';
          if (result.data?.error?.message) {
            errorMsg = result.data.error.message;
          }
          if (!content && result.data) {
            errorMsg += ` (响应: ${JSON.stringify(result.data).substring(0, 200)})`;
          }
          sendResponse({
            success: false,
            error: errorMsg,
            latency,
          });
        }
      }).catch((err) => {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : '请求失败',
        });
      });

      return true; // Keep channel open for async response
    }
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      break;
  }
  return true;
});

console.log('[Happy Debug] Background service worker started');
