// src/services/api-client.ts

export interface APIConfig {
  provider: 'openai';
  apiKey: string;
  baseUrl: string;
  model?: string; // 可选的模型名称
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

export class APIClient {
  private config: APIConfig;

  constructor(config: APIConfig) {
    this.config = config;
  }

  /**
   * 获取默认模型名称
   */
  private getDefaultModel(): string {
    return this.config.model || 'gpt-4o-mini';
  }

  async checkConnection(): Promise<APIResponse<{ connected: boolean }>> {
    const start = Date.now();
    try {
      // 使用实际的 chat completions API 来检查连接
      // HEAD 请求可能不被 API 服务器支持
      const model = this.getDefaultModel();
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
      });
      const latency = Date.now() - start;
      if (response.ok) {
        return {
          success: true,
          data: { connected: true },
          latency,
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
        return {
          success: false,
          data: { connected: false },
          latency,
          error: errorMsg,
        };
      }
    } catch (error) {
      return {
        success: false,
        data: { connected: false },
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }

  async post<T>(endpoint: string, body: unknown): Promise<APIResponse<T>> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      const latency = Date.now() - start;
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}`, latency };
      }
      const data = await response.json();
      return { success: true, data, latency };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start,
      };
    }
  }
}
