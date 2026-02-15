/**
 * LLM 配置管理器
 * 
 * 负责:
 * - 加载和保存 LLM 配置
 * - 管理多个配置 Profile
 * - API Key 加密存储（TODO: 集成 OS Keychain）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../utils/logger.js';

/**
 * LLM 配置 Profile
 */
export interface LLMConfigProfile {
    /** Profile 名称 */
    name: string;
    /** Provider 配置 */
    provider: {
        id: string;
        name: string;
        baseURL?: string;
    };
    /** Model ID */
    model: string;
    /** API Key 引用 (e.g., 'keychain:openai_api_key') */
    apiKeyRef?: string;
    /** 温度 */
    temperature?: number;
    /** 最大步数 */
    maxSteps?: number;
}

/**
 * LLM 配置文件格式
 */
export interface LLMConfigFile {
    version: string;
    profiles: Record<string, LLMConfigProfile>;
    activeProfile: string;
}

/**
 * LLMConfigManager - LLM 配置管理器
 */
export class LLMConfigManager {
    private static readonly CONFIG_DIR = path.join(os.homedir(), '.aotui', 'config');
    private static readonly CONFIG_FILE = path.join(LLMConfigManager.CONFIG_DIR, 'llm.json');

    private logger: Logger;
    private config: LLMConfigFile | null = null;

    constructor() {
        this.logger = new Logger('LLMConfigManager');
    }

    /**
     * 加载配置
     */
    async load(): Promise<LLMConfigFile> {
        try {
            const content = await fs.readFile(LLMConfigManager.CONFIG_FILE, 'utf-8');
            this.config = JSON.parse(content);

            this.logger.info('Config loaded', {
                profileCount: Object.keys(this.config!.profiles).length,
                activeProfile: this.config!.activeProfile,
            });

            return this.config!;
        } catch (error: any) {
            // 文件不存在，创建默认配置
            if (error.code === 'ENOENT') {
                this.logger.info('Config file not found, creating default config');
                return this.createDefaultConfig();
            }

            this.logger.error('Failed to load config', { error });
            throw error;
        }
    }

    /**
     * 保存配置
     */
    async save(config: LLMConfigFile): Promise<void> {
        try {
            // 确保目录存在
            await fs.mkdir(LLMConfigManager.CONFIG_DIR, { recursive: true });

            // 写入配置文件
            await fs.writeFile(
                LLMConfigManager.CONFIG_FILE,
                JSON.stringify(config, null, 2),
                'utf-8'
            );

            this.config = config;

            this.logger.info('Config saved', {
                profileCount: Object.keys(config.profiles).length,
                activeProfile: config.activeProfile,
            });
        } catch (error) {
            this.logger.error('Failed to save config', { error });
            throw error;
        }
    }

    /**
     * 获取当前激活的 Profile
     */
    async getActiveProfile(): Promise<LLMConfigProfile | null> {
        if (!this.config) {
            await this.load();
        }

        const profileName = this.config!.activeProfile;
        return this.config!.profiles[profileName] || null;
    }

    /**
     * 设置激活的 Profile
     */
    async setActiveProfile(profileName: string): Promise<void> {
        if (!this.config) {
            await this.load();
        }

        if (!this.config!.profiles[profileName]) {
            throw new Error(`Profile not found: ${profileName}`);
        }

        this.config!.activeProfile = profileName;
        await this.save(this.config!);
    }

    /**
     * 添加或更新 Profile
     */
    async saveProfile(profile: LLMConfigProfile): Promise<void> {
        if (!this.config) {
            await this.load();
        }

        this.config!.profiles[profile.name] = profile;
        await this.save(this.config!);
    }

    /**
     * 删除 Profile
     */
    async deleteProfile(profileName: string): Promise<void> {
        if (!this.config) {
            await this.load();
        }

        if (profileName === 'default') {
            throw new Error('Cannot delete default profile');
        }

        delete this.config!.profiles[profileName];

        // 如果删除的是激活的 Profile，切换到 default
        if (this.config!.activeProfile === profileName) {
            this.config!.activeProfile = 'default';
        }

        await this.save(this.config!);
    }

    /**
     * 获取所有 Profile
     */
    async getAllProfiles(): Promise<LLMConfigProfile[]> {
        if (!this.config) {
            await this.load();
        }

        return Object.values(this.config!.profiles);
    }

    /**
     * 创建默认配置
     */
    private async createDefaultConfig(): Promise<LLMConfigFile> {
        const defaultConfig: LLMConfigFile = {
            version: '1.0',
            profiles: {
                default: {
                    name: 'default',
                    provider: {
                        id: 'openai',
                        name: 'OpenAI',
                    },
                    model: 'gpt-4',
                    temperature: 0.7,
                    maxSteps: 5,
                },
            },
            activeProfile: 'default',
        };

        await this.save(defaultConfig);
        return defaultConfig;
    }

    /**
     * 解析 API Key (从 keychain 引用或环境变量)
     * 
     * TODO: 集成 OS Keychain
     */
    async resolveApiKey(profile: LLMConfigProfile): Promise<string | undefined> {
        // 1. 如果有 apiKeyRef，尝试从 keychain 读取
        if (profile.apiKeyRef) {
            if (profile.apiKeyRef.startsWith('keychain:')) {
                // TODO: 从 OS Keychain 读取
                const keyName = profile.apiKeyRef.replace('keychain:', '');
                this.logger.warn(`Keychain not implemented, key: ${keyName}`);
            }
        }

        // 2. 从环境变量读取
        const envMap: Record<string, string> = {
            openai: 'OPENAI_API_KEY',
            anthropic: 'ANTHROPIC_API_KEY',
            google: 'GOOGLE_API_KEY',
            xai: 'XAI_API_KEY',
            alibaba: 'DASHSCOPE_API_KEY',
            moonshotai: 'MOONSHOT_API_KEY',
            deepseek: 'DEEPSEEK_API_KEY',
        };

        const envKey = envMap[profile.provider.id];
        if (envKey) {
            return process.env[envKey];
        }

        return undefined;
    }
}
