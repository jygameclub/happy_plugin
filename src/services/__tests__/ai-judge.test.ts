// src/services/__tests__/ai-judge.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { AIJudge } from '../ai-judge';

describe('AIJudge', () => {
  let judge: AIJudge;

  beforeEach(() => {
    judge = new AIJudge();
  });

  it('should format input for API call', () => {
    const recentText = ['$ npm install', 'Installing...', 'Done'];
    const signals = { hasPrompt: true };

    const formatted = judge.formatInput(recentText, signals);

    expect(formatted.recent_text).toEqual(recentText);
    expect(formatted.signals).toEqual(signals);
  });

  it('should parse valid API response', () => {
    const response = {
      role: 'Executor',
      state: 'WAITING_INPUT',
      confidence: 0.85,
    };

    const parsed = judge.parseResponse(response);

    expect(parsed.role).toBe('Executor');
    expect(parsed.state).toBe('WAITING_INPUT');
    expect(parsed.confidence).toBe(0.85);
  });

  it('should handle invalid response with defaults', () => {
    const response = { invalid: 'data' };

    const parsed = judge.parseResponse(response);

    expect(parsed.role).toBe('Other');
    expect(parsed.state).toBe('RUNNING');
    expect(parsed.confidence).toBe(0);
  });

  it('should detect dangerous commands', () => {
    const dangerousCommands = [
      'rm -rf /',
      'sudo rm -rf *',
      'format c:',
      ':(){:|:&};:',
    ];

    dangerousCommands.forEach((cmd) => {
      expect(judge.isDangerousCommand(cmd)).toBe(true);
    });
  });

  it('should allow safe commands', () => {
    const safeCommands = [
      'ls -la',
      'npm install',
      'git status',
      'echo hello',
    ];

    safeCommands.forEach((cmd) => {
      expect(judge.isDangerousCommand(cmd)).toBe(false);
    });
  });

  it('should detect waiting state using rule-based analysis', async () => {
    const judge = new AIJudge();
    const input = judge.formatInput(['some output', 'user@host:~$ '], {});
    const result = await judge.analyze(input);

    expect(result.state).toBe('WAITING_INPUT');
    expect(result.confidence).toBe(0.6);
  });
});
