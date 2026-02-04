// src/services/ai-judge.ts

import type { AIJudgeInput, AIJudgeOutput, SessionRole } from '../types';
import { APIClient } from './api-client';

interface DangerousPattern {
  pattern: RegExp;
  description: string;
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  { pattern: /rm\s+-rf\s+[\/~]/i, description: '递归删除根目录或主目录' },
  { pattern: /rm\s+-rf\s+\*/i, description: '递归删除所有文件' },
  { pattern: /rm\s+-r\s+[\/~]/i, description: '递归删除根目录或主目录' },
  { pattern: /mkfs\./i, description: '格式化磁盘' },
  { pattern: /dd\s+if=.*of=\/dev/i, description: '直接写入磁盘设备' },
  { pattern: /format\s+[a-z]:/i, description: '格式化磁盘分区' },
  { pattern: />\s*\/dev\/sd[a-z]/i, description: '重定向到磁盘设备' },
  { pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, description: 'Fork 炸弹' },
  { pattern: /chmod\s+-R\s+777\s+\//, description: '修改根目录权限为 777' },
  { pattern: /wget.*\|\s*bash/i, description: '通过 wget 管道执行 bash' },
  { pattern: /curl.*\|\s*bash/i, description: '通过 curl 管道执行 bash' },
  { pattern: /sudo\s+rm\s+-rf/i, description: '使用 sudo 递归删除' },
  { pattern: />\s*\/etc\/passwd/i, description: '写入密码文件' },
  { pattern: />\s*\/etc\/shadow/i, description: '写入影子密码文件' },
  { pattern: /shutdown|reboot|halt|poweroff/i, description: '关机/重启命令' },
  { pattern: /kill\s+-9\s+-1/i, description: '杀死所有进程' },
  { pattern: /mv\s+\/\s+/i, description: '移动根目录' },
  { pattern: /chown\s+-R\s+.*\s+\//i, description: '递归修改根目录所有者' },
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
    return DANGEROUS_PATTERNS.some((p) => p.pattern.test(command));
  }

  checkDangerousCommand(command: string): { isDangerous: boolean; matchedPattern: string | null; description: string | null } {
    for (const p of DANGEROUS_PATTERNS) {
      if (p.pattern.test(command)) {
        return {
          isDangerous: true,
          matchedPattern: p.pattern.toString(),
          description: p.description,
        };
      }
    }
    return { isDangerous: false, matchedPattern: null, description: null };
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
