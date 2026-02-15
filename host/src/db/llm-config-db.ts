/**
 * @aotui/host - LLM Config Database
 * 
 * LLM 配置的数据库操作
 */

import type { Database } from 'sql.js';
import type { LLMConfigRecord, LLMConfigInput } from '../types/llm-config.js';

/**
 * 创建 llm_configs 表
 */
export function createLLMConfigsTable(db: Database): void {
    db.run(`
        CREATE TABLE IF NOT EXISTS llm_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            model TEXT NOT NULL,
            provider_id TEXT,
            base_url TEXT,
            api_key TEXT,
            temperature REAL DEFAULT 0.7,
            max_steps INTEGER DEFAULT 10,
            is_active INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_llm_configs_is_active ON llm_configs(is_active);
        CREATE INDEX IF NOT EXISTS idx_llm_configs_name ON llm_configs(name);
    `);
}

/**
 * 数据库行转换为 LLMConfigRecord
 */
function rowToConfig(row: any): LLMConfigRecord {
    return {
        id: row.id,
        name: row.name,
        model: row.model,
        providerId: row.provider_id || undefined,
        baseUrl: row.base_url || undefined,
        apiKey: row.api_key || undefined,
        temperature: row.temperature,
        maxSteps: row.max_steps,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * 创建 LLM 配置
 */
export function createLLMConfig(db: Database, input: LLMConfigInput): LLMConfigRecord {
    const now = Date.now();

    // 如果没有任何配置,自动设为激活
    const stmt = db.prepare('SELECT COUNT(*) as count FROM llm_configs');
    stmt.step();
    const count = stmt.getAsObject().count as number;
    stmt.free();

    const isActive = count === 0 ? 1 : 0;

    db.run(
        `
        INSERT INTO llm_configs (
            name, model, provider_id, base_url, api_key,
            temperature, max_steps, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
            input.name,
            input.model,
            input.providerId || null,
            input.baseUrl || null,
            input.apiKey || null,
            input.temperature ?? 0.7,
            input.maxSteps ?? 10,
            isActive,
            now,
            now,
        ]
    );

    // 获取插入的 ID
    const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;

    return {
        id,
        name: input.name,
        model: input.model,
        providerId: input.providerId,
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        temperature: input.temperature ?? 0.7,
        maxSteps: input.maxSteps ?? 10,
        isActive: isActive === 1,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * 获取激活的 LLM 配置
 */
export function getActiveLLMConfig(db: Database): LLMConfigRecord | null {
    const stmt = db.prepare('SELECT * FROM llm_configs WHERE is_active = 1 LIMIT 1');

    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return rowToConfig(row);
    }

    stmt.free();
    return null;
}

/**
 * 获取所有 LLM 配置
 */
export function getAllLLMConfigs(db: Database): LLMConfigRecord[] {
    const stmt = db.prepare('SELECT * FROM llm_configs ORDER BY created_at DESC');
    const configs: LLMConfigRecord[] = [];

    while (stmt.step()) {
        configs.push(rowToConfig(stmt.getAsObject()));
    }

    stmt.free();
    return configs;
}

/**
 * 获取单个 LLM 配置
 */
export function getLLMConfig(db: Database, id: number): LLMConfigRecord | null {
    const stmt = db.prepare('SELECT * FROM llm_configs WHERE id = ?');
    stmt.bind([id]);

    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return rowToConfig(row);
    }

    stmt.free();
    return null;
}

/**
 * 设置激活的 LLM 配置
 */
export function setActiveLLMConfig(db: Database, id: number): void {
    // 1. 取消所有激活状态
    db.run('UPDATE llm_configs SET is_active = 0');

    // 2. 设置指定配置为激活
    db.run('UPDATE llm_configs SET is_active = 1, updated_at = ? WHERE id = ?', [Date.now(), id]);
}

/**
 * 更新 LLM 配置
 */
export function updateLLMConfig(
    db: Database, 
    id: number, 
    updates: Partial<LLMConfigInput> & { isActive?: boolean }
): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
    }
    if (updates.model !== undefined) {
        fields.push('model = ?');
        values.push(updates.model);
    }
    if (updates.providerId !== undefined) {
        fields.push('provider_id = ?');
        values.push(updates.providerId || null);
    }
    if (updates.baseUrl !== undefined) {
        fields.push('base_url = ?');
        values.push(updates.baseUrl || null);
    }
    if (updates.apiKey !== undefined) {
        fields.push('api_key = ?');
        values.push(updates.apiKey || null);
    }
    if (updates.temperature !== undefined) {
        fields.push('temperature = ?');
        values.push(updates.temperature);
    }
    if (updates.maxSteps !== undefined) {
        fields.push('max_steps = ?');
        values.push(updates.maxSteps);
    }
    if (updates.isActive !== undefined) {
        fields.push('is_active = ?');
        values.push(updates.isActive ? 1 : 0);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    db.run(`UPDATE llm_configs SET ${fields.join(', ')} WHERE id = ?`, values);
}

/**
 * 删除 LLM 配置
 */
export function deleteLLMConfig(db: Database, id: number): void {
    db.run('DELETE FROM llm_configs WHERE id = ?', [id]);
}
