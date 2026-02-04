// src/types/session.ts

export interface Session {
  sessionId: string;
  title: string;
  visible: boolean;
  domSelector: string;
}

export interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  lastScanTime: number | null;
}
