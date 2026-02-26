import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../utils/logger.js';

export type CustomProviderProtocol = 'openai' | 'anthropic';

export interface CustomProviderRecord {
    id: string;
    name: string;
    baseUrl: string;
    protocol: CustomProviderProtocol;
    apiKey?: string;
    createdAt: number;
    updatedAt: number;
}

interface StoreSchema {
    version: 1;
    providers: CustomProviderRecord[];
}

export class CustomProviderStore {
    private readonly logger = new Logger('CustomProviderStore');
    private readonly dir = path.join(os.homedir(), '.aotui', 'config');
    private readonly file = path.join(this.dir, 'custom-providers.json');

    async list(): Promise<CustomProviderRecord[]> {
        const store = await this.readStore();
        return [...store.providers].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async getById(id: string): Promise<CustomProviderRecord | null> {
        const normalizedId = this.normalizeId(id);
        const providers = await this.list();
        return providers.find((item) => item.id === normalizedId) || null;
    }

    async create(input: {
        name: string;
        baseUrl: string;
        protocol: CustomProviderProtocol;
        apiKey?: string;
        id?: string;
    }): Promise<CustomProviderRecord> {
        const store = await this.readStore();
        const now = Date.now();
        const name = input.name.trim();
        const candidateId = input.id?.trim() ? input.id : name;
        const id = this.normalizeId(candidateId);

        if (!name) {
            throw new Error('Custom provider name is required.');
        }
        if (!input.baseUrl?.trim()) {
            throw new Error('Custom provider baseUrl is required.');
        }
        if (store.providers.some((item) => item.id === id)) {
            throw new Error(`Custom provider already exists: ${id}`);
        }

        const record: CustomProviderRecord = {
            id,
            name,
            baseUrl: input.baseUrl.trim(),
            protocol: input.protocol,
            apiKey: input.apiKey?.trim() || undefined,
            createdAt: now,
            updatedAt: now,
        };

        store.providers.push(record);
        await this.writeStore(store);

        this.logger.info('Custom provider created', { id, protocol: record.protocol });
        return record;
    }

    async update(
        id: string,
        updates: Partial<{
            name: string;
            baseUrl: string;
            protocol: CustomProviderProtocol;
            apiKey?: string;
        }>
    ): Promise<CustomProviderRecord> {
        const store = await this.readStore();
        const normalizedId = this.normalizeId(id);
        const target = store.providers.find((item) => item.id === normalizedId);
        if (!target) {
            throw new Error(`Custom provider not found: ${normalizedId}`);
        }

        if (updates.name !== undefined) {
            const nextName = updates.name.trim();
            if (!nextName) {
                throw new Error('Custom provider name cannot be empty.');
            }
            target.name = nextName;
        }

        if (updates.baseUrl !== undefined) {
            const nextBaseUrl = updates.baseUrl.trim();
            if (!nextBaseUrl) {
                throw new Error('Custom provider baseUrl cannot be empty.');
            }
            target.baseUrl = nextBaseUrl;
        }

        if (updates.protocol !== undefined) {
            target.protocol = updates.protocol;
        }

        if (updates.apiKey !== undefined) {
            target.apiKey = updates.apiKey.trim() || undefined;
        }

        target.updatedAt = Date.now();
        await this.writeStore(store);

        this.logger.info('Custom provider updated', { id: target.id });
        return target;
    }

    async delete(id: string): Promise<void> {
        const store = await this.readStore();
        const normalizedId = this.normalizeId(id);
        const before = store.providers.length;
        store.providers = store.providers.filter((item) => item.id !== normalizedId);
        if (store.providers.length === before) {
            return;
        }
        await this.writeStore(store);
        this.logger.info('Custom provider deleted', { id: normalizedId });
    }

    private normalizeId(raw: string): string {
        const candidate = raw.trim().toLowerCase().startsWith('custom:')
            ? raw.trim().slice('custom:'.length)
            : raw;

        const normalized = candidate
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        if (!normalized) {
            throw new Error('Invalid custom provider id.');
        }
        return `custom:${normalized}`;
    }

    private async readStore(): Promise<StoreSchema> {
        try {
            const text = await fs.readFile(this.file, 'utf8');
            const data = JSON.parse(text) as Partial<StoreSchema>;
            const providers = Array.isArray(data.providers) ? data.providers : [];
            return {
                version: 1,
                providers,
            };
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return { version: 1, providers: [] };
            }
            this.logger.error('Failed to read custom provider store', { error });
            throw error;
        }
    }

    private async writeStore(store: StoreSchema): Promise<void> {
        await fs.mkdir(this.dir, { recursive: true });
        await fs.writeFile(this.file, JSON.stringify(store, null, 2), 'utf8');
    }
}
