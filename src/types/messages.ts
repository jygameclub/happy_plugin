// src/types/messages.ts

export type MessageType =
  | 'SCAN_SESSIONS'
  | 'SCAN_SESSIONS_RESULT'
  | 'SWITCH_SESSION'
  | 'PREVIEW_INPUT'
  | 'CLEAR_PREVIEW'
  | 'HIGHLIGHT_SESSION'
  | 'GET_SESSION_OUTPUT'
  | 'SESSION_OUTPUT_RESULT';

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

export type Message =
  | ScanSessionsMessage
  | ScanSessionsResultMessage
  | SwitchSessionMessage
  | PreviewInputMessage
  | ClearPreviewMessage
  | HighlightSessionMessage
  | GetSessionOutputMessage
  | SessionOutputResultMessage;
