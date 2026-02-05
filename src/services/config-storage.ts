// src/services/config-storage.ts

export interface APIProviderConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  model?: string; // 可选的模型名称
}

export interface AllAPIConfigs {
  openai: APIProviderConfig;
}

const DEFAULT_CONFIGS: AllAPIConfigs = {
  openai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    enabled: false,
  },
};

const STORAGE_KEY = 'happy_api_configs';

export class ConfigStorage {
  /**
   * 获取所有 API 配置
   */
  async getAll(): Promise<AllAPIConfigs> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] as Partial<AllAPIConfigs> | undefined;
      return {
        openai: { ...DEFAULT_CONFIGS.openai, ...stored?.openai },
      };
    } catch {
      return { ...DEFAULT_CONFIGS };
    }
  }

  /**
   * 获取 OpenAI 配置
   */
  async get(provider: 'openai'): Promise<APIProviderConfig> {
    const all = await this.getAll();
    return all[provider];
  }

  /**
   * 保存 OpenAI 配置
   */
  async save(provider: 'openai', config: Partial<APIProviderConfig>): Promise<void> {
    const all = await this.getAll();
    all[provider] = { ...all[provider], ...config };
    await chrome.storage.local.set({ [STORAGE_KEY]: all });
  }

  /**
   * 保存所有配置
   */
  async saveAll(configs: AllAPIConfigs): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: configs });
  }

  /**
   * 检查配置是否有效（有 API Key 和 Base URL）
   */
  isConfigValid(config: APIProviderConfig): boolean {
    return Boolean(config.apiKey && config.apiKey.trim() && config.baseUrl && config.baseUrl.trim());
  }

  /**
   * 清除所有配置
   */
  async clear(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
  }
}
