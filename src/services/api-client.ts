// src/services/api-client.ts

export interface APIConfig {
  provider: 'deepseek';
  apiKey: string;
  baseUrl: string;
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

  async checkConnection(): Promise<APIResponse<{ connected: boolean }>> {
    const start = Date.now();
    try {
      const response = await fetch(this.config.baseUrl, {
        method: 'HEAD',
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });
      return {
        success: response.ok,
        data: { connected: response.ok },
        latency: Date.now() - start,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
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
