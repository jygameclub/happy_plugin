// src/types/messages.ts

export type MessageType =
  | 'SCAN_SESSIONS'
  | 'SCAN_SESSIONS_RESULT'
  | 'SWITCH_SESSION'
  | 'PREVIEW_INPUT'
  | 'CLEAR_PREVIEW'
  | 'HIGHLIGHT_SESSION'
  | 'GET_SESSION_OUTPUT'
  | 'SESSION_OUTPUT_RESULT'
  // Page debug messages
  | 'GET_PAGE_INFO'
  | 'ANALYZE_PAGE_STRUCTURE'
  | 'GET_SESSIONS_LIST'
  | 'GET_CONTENT_STATE'
  | 'GET_ELEMENT_INFO'
  | 'HIGHLIGHT_ELEMENT'
  | 'CLICK_ELEMENT'
  | 'INPUT_TEXT'
  // Happy test messages
  | 'CLEAR_INPUT'
  | 'SIMULATE_SEND'
  | 'GET_CHAT_MESSAGES'
  | 'GET_INPUT_VALUE';

export interface BaseMessage {
  type: MessageType;
}

export interface ScanSessionsMessage extends BaseMessage {
  type: 'SCAN_SESSIONS';
}

export interface ScanSessionsResultMessage extends BaseMessage {
  type: 'SCAN_SESSIONS_RESULT';
  sessions: import('./session').Session[];
}

export interface SwitchSessionMessage extends BaseMessage {
  type: 'SWITCH_SESSION';
  sessionId: string;
}

export interface PreviewInputMessage extends BaseMessage {
  type: 'PREVIEW_INPUT';
  sessionId: string;
  text: string;
}

export interface ClearPreviewMessage extends BaseMessage {
  type: 'CLEAR_PREVIEW';
  sessionId: string;
}

export interface HighlightSessionMessage extends BaseMessage {
  type: 'HIGHLIGHT_SESSION';
  sessionId: string;
  highlight: boolean;
}

export interface GetSessionOutputMessage extends BaseMessage {
  type: 'GET_SESSION_OUTPUT';
  sessionId: string;
  lines: number;
}

export interface SessionOutputResultMessage extends BaseMessage {
  type: 'SESSION_OUTPUT_RESULT';
  sessionId: string;
  output: string[];
}

// Page debug message interfaces
export interface GetPageInfoMessage extends BaseMessage {
  type: 'GET_PAGE_INFO';
}

export interface AnalyzePageStructureMessage extends BaseMessage {
  type: 'ANALYZE_PAGE_STRUCTURE';
}

export interface GetSessionsListMessage extends BaseMessage {
  type: 'GET_SESSIONS_LIST';
}

export interface GetContentStateMessage extends BaseMessage {
  type: 'GET_CONTENT_STATE';
}

export interface GetElementInfoMessage extends BaseMessage {
  type: 'GET_ELEMENT_INFO';
  selector: string;
}

export interface HighlightElementMessage extends BaseMessage {
  type: 'HIGHLIGHT_ELEMENT';
  selector: string;
  duration?: number;
}

export interface ClickElementMessage extends BaseMessage {
  type: 'CLICK_ELEMENT';
  selector: string;
}

export interface InputTextMessage extends BaseMessage {
  type: 'INPUT_TEXT';
  selector: string;
  text: string;
}

// Happy test message interfaces
export interface ClearInputMessage extends BaseMessage {
  type: 'CLEAR_INPUT';
}

export interface SimulateSendMessage extends BaseMessage {
  type: 'SIMULATE_SEND';
}

export interface GetChatMessagesMessage extends BaseMessage {
  type: 'GET_CHAT_MESSAGES';
}

export interface GetInputValueMessage extends BaseMessage {
  type: 'GET_INPUT_VALUE';
}

export type Message =
  | ScanSessionsMessage
  | ScanSessionsResultMessage
  | SwitchSessionMessage
  | PreviewInputMessage
  | ClearPreviewMessage
  | HighlightSessionMessage
  | GetSessionOutputMessage
  | SessionOutputResultMessage
  // Page debug messages
  | GetPageInfoMessage
  | AnalyzePageStructureMessage
  | GetSessionsListMessage
  | GetContentStateMessage
  | GetElementInfoMessage
  | HighlightElementMessage
  | ClickElementMessage
  | InputTextMessage
  // Happy test messages
  | ClearInputMessage
  | SimulateSendMessage
  | GetChatMessagesMessage
  | GetInputValueMessage;
