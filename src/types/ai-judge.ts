// src/types/ai-judge.ts

export type SessionRole = 'Advisor' | 'Executor' | 'Other';
export type SessionState = 'RUNNING' | 'WAITING_INPUT' | 'ERROR';

export interface AIJudgeInput {
  recent_text: string[];
  signals: Record<string, unknown>;
}

export interface AIJudgeOutput {
  role: SessionRole;
  state: SessionState;
  confidence: number;
}

export interface APIStatus {
  provider: 'minimax' | 'glm';
  connected: boolean;
  latency: number | null;
  error: string | null;
}
