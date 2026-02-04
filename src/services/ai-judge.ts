// src/services/ai-judge.ts

import type { AIJudgeInput, AIJudgeOutput, SessionRole } from '../types';
import { APIClient } from './api-client';

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/i,
  /rm\s+-rf\s+\*/i,
  /rm\s+-r\s+[\/~]/i,
  /mkfs\./i,
  /dd\s+if=.*of=\/dev/i,
  /format\s+[a-z]:/i,
  />\s*\/dev\/sd[a-z]/i,
  /:\(\)\s*\{\s*:\|\:&\s*\}\s*;:/,
  /chmod\s+-R\s+777\s+\//,
  /wget.*\|\s*bash/i,
  /curl.*\|\s*bash/i,
];

export class AIJudge {
  private client: APIClient | null = null;

  setClient(client: APIClient): void {
    this.client = client;
  }

  formatInput(recentText: string[], signals: Record<string, unknown>): AIJudgeInput {
    return { recent_text: recentText, signals };
  }

  parseResponse(response: unknown): AIJudgeOutput {
    const defaultOutput: AIJudgeOutput = { role: 'Other', state: 'RUNNING', confidence: 0 };
    if (typeof response !== 'object' || response === null) return defaultOutput;

    const obj = response as Record<string, unknown>;
    const validRoles: SessionRole[] = ['Advisor', 'Executor', 'Other'];
    const validStates = ['RUNNING', 'WAITING_INPUT', 'ERROR'];

    return {
      role: validRoles.includes(obj.role as SessionRole) ? (obj.role as SessionRole) : 'Other',
      state: validStates.includes(obj.state as string) ? (obj.state as 'RUNNING' | 'WAITING_INPUT' | 'ERROR') : 'RUNNING',
      confidence: typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0,
    };
  }

  isDangerousCommand(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
  }

  async analyze(input: AIJudgeInput): Promise<AIJudgeOutput> {
    if (!this.client) {
      return this.ruleBasedAnalysis(input);
    }
    try {
      const response = await this.client.post<AIJudgeOutput>('/analyze', input);
      if (response.success && response.data) {
        return this.parseResponse(response.data);
      }
      return this.ruleBasedAnalysis(input);
    } catch {
      return this.ruleBasedAnalysis(input);
    }
  }

  private ruleBasedAnalysis(input: AIJudgeInput): AIJudgeOutput {
    const lastLine = input.recent_text[input.recent_text.length - 1] || '';
    const promptPatterns = [/\$\s*$/, />\s*$/, /:\s*$/, /\?\s*$/, /input/i];
    const isWaiting = promptPatterns.some((p) => p.test(lastLine));

    let role: SessionRole = 'Other';
    const allText = input.recent_text.join(' ');
    if (/claude|gpt|ai|assistant/i.test(allText)) role = 'Advisor';
    else if (/\$|bash|shell|terminal|cmd/i.test(allText)) role = 'Executor';

    return { role, state: isWaiting ? 'WAITING_INPUT' : 'RUNNING', confidence: 0.6 };
  }
}
