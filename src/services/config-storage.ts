// src/services/config-storage.ts

export interface APIProviderConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
}

export interface AllAPIConfigs {
  minimax: APIProviderConfig;
  glm: APIProviderConfig;
}

const DEFAULT_CONFIGS: AllAPIConfigs = {
  minimax: {
    apiKey: '',
    baseUrl: 'https://api.minimax.chat',
    enabled: false,
  },
  glm: {
    apiKey: '',
    baseUrl: 'https://open.bigmodel.cn',
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
        minimax: { ...DEFAULT_CONFIGS.minimax, ...stored?.minimax },
        glm: { ...DEFAULT_CONFIGS.glm, ...stored?.glm },
      };
    } catch {
      return { ...DEFAULT_CONFIGS };
    }
  }

  /**
   * 获取单个提供商的配置
   */
  async get(provider: 'minimax' | 'glm'): Promise<APIProviderConfig> {
    const all = await this.getAll();
    return all[provider];
  }

  /**
   * 保存单个提供商的配置
   */
  async save(provider: 'minimax' | 'glm', config: Partial<APIProviderConfig>): Promise<void> {
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
