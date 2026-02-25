/**
 * System Chat Database Module
 * 
 * WASM (sql.js) persistence for topics and messages.
 * 
 * **Architecture**:
 * - Engine: SQLite compiled to WebAssembly (pure JS/WASM).
 * - Persistence: In-Memory DB loaded from/saved to Disk.
 * - Compatibility: CRUD methods are synchronous (Memory I/O), initialization is async.
 */
import initSqlJs, { type Database } from 'sql.js';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import type { Message, Topic, Project } from '../types.js';
import type {
    MessagePart,
    MessageWithParts,
    TextMessagePart,
    ReasoningMessagePart,
    ToolCallMessagePart,
    ToolResultMessagePart
} from '../types.js';
import { createLLMConfigsTable } from './llm-config-db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const DEFAULT_DATA_DIR = join(PROJECT_ROOT, 'data');
const DEFAULT_DB_FILE = join(DEFAULT_DATA_DIR, 'chat.sqlite');
const DB_FILE = process.env.DB_PATH ? resolve(process.env.DB_PATH) : DEFAULT_DB_FILE;
const DATA_DIR = dirname(DB_FILE);

// Singleton instance
let db: Database | null = null;
let SQL: initSqlJs.SqlJsStatic | null = null;

/**
 * Initialize database (Async)
 */
export async function initDatabase(): Promise<Database> {
    if (db) return db;

    // 1. Ensure Data Directory
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }

    // 2. Load WASM Engine
    if (!SQL) {
        SQL = await initSqlJs();
    }

    // 3. Load Data from Disk (if exists) or Create New
    if (existsSync(DB_FILE)) {
        const buffer = readFileSync(DB_FILE);
        db = new SQL.Database(buffer);
        console.log('[DB] WASM Database loaded from disk:', DB_FILE);
    } else {
        db = new SQL.Database();
        console.log('[DB] New WASM Database created in memory');
        initSchema(); // Only init schema for new DB
        saveToDisk();
    }

    // 4. Run Migrations (Safe to run multiple times)
    migrateSchema();

    return db;
}

/**
 * Persist Memory DB to Disk
 */
function saveToDisk() {
    if (!db) return;
    const data = db.export();
    writeFileSync(DB_FILE, data);
}

/**
 * Export saveToDisk for use by other modules (e.g., MessageServiceV2)
 */
export function persistDatabase(): void {
    saveToDisk();
}

/**
 * Initialize Tables
 */
function initSchema() {
    if (!db) return;

    db.run(`
        CREATE TABLE IF NOT EXISTS topics (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'hot',
            -- Chat App Enhancement Fields
            summary TEXT DEFAULT NULL,
            stage TEXT DEFAULT NULL,
            last_snapshot_time INTEGER DEFAULT NULL,
            project_id TEXT REFERENCES projects(id),
            model_override TEXT DEFAULT NULL,
            prompt_override TEXT DEFAULT NULL,
            source_controls TEXT DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            message_type TEXT DEFAULT 'text',
            metadata TEXT DEFAULT NULL,
            content_summary TEXT DEFAULT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_messages_topic_id ON messages(topic_id);
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

        CREATE TABLE IF NOT EXISTS message_parts (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            part_type TEXT NOT NULL,
            part_order INTEGER NOT NULL,
            text_content TEXT DEFAULT NULL,
            input TEXT DEFAULT NULL,
            output TEXT DEFAULT NULL,
            tool_call_id TEXT DEFAULT NULL,
            tool_name TEXT DEFAULT NULL,
            is_error INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_message_parts_message_id ON message_parts(message_id);
        CREATE INDEX IF NOT EXISTS idx_message_parts_type ON message_parts(part_type);
        CREATE INDEX IF NOT EXISTS idx_message_parts_order ON message_parts(message_id, part_order);
        CREATE INDEX IF NOT EXISTS idx_message_parts_tool_call_id ON message_parts(tool_call_id);
        
        -- V2: 完全对齐 AI SDK v6 的 messages_v2 表
        CREATE TABLE IF NOT EXISTS messages_v2 (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            provider_options TEXT DEFAULT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_v2_topic_id ON messages_v2(topic_id);
        CREATE INDEX IF NOT EXISTS idx_messages_v2_timestamp ON messages_v2(timestamp);

        -- Projects table
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            name TEXT NOT NULL,
            last_opened_at INTEGER,
            created_at INTEGER NOT NULL
        );
    `);
}

/**
 * Migrate Schema (Add new columns/tables)
 */
function migrateSchema() {
    if (!db) return;

    // [LLM Configs] Create llm_configs table
    console.log('[DB] Ensuring llm_configs table exists...');
    createLLMConfigsTable(db);

    // [Message Parts] Create message_parts table if not exists
    // This fixes the issue where existing DBs don't have this table
    console.log('[DB] Ensuring message_parts table exists...');
    db.run(`
        CREATE TABLE IF NOT EXISTS message_parts (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            part_type TEXT NOT NULL,
            part_order INTEGER NOT NULL,
            text_content TEXT DEFAULT NULL,
            input TEXT DEFAULT NULL,
            output TEXT DEFAULT NULL,
            tool_call_id TEXT DEFAULT NULL,
            tool_name TEXT DEFAULT NULL,
            is_error INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_message_parts_message_id ON message_parts(message_id);
        CREATE INDEX IF NOT EXISTS idx_message_parts_type ON message_parts(part_type);
        CREATE INDEX IF NOT EXISTS idx_message_parts_order ON message_parts(message_id, part_order);
        CREATE INDEX IF NOT EXISTS idx_message_parts_tool_call_id ON message_parts(tool_call_id);
    `);

    // ✅ [V2] Ensure messages_v2 table exists (for AI SDK v6 compatibility)
    console.log('[DB] Ensuring messages_v2 table exists...');
    db.run(`
        CREATE TABLE IF NOT EXISTS messages_v2 (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            provider_options TEXT DEFAULT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_v2_topic_id ON messages_v2(topic_id);
        CREATE INDEX IF NOT EXISTS idx_messages_v2_timestamp ON messages_v2(timestamp);
    `);

    // [RFC-025] Add Projects table
    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            path TEXT NOT NULL,
            name TEXT NOT NULL,
            last_opened_at INTEGER,
            created_at INTEGER NOT NULL
        );
    `);

    // [RFC-025] Add project_id to topics
    try {
        // Check if column exists
        const result = db.exec("SELECT project_id FROM topics LIMIT 1");
    } catch (e) {
        // Column doesn't exist, add it
        console.log('[DB] Migrating: Adding project_id to topics table');
        try {
            db.run("ALTER TABLE topics ADD COLUMN project_id TEXT REFERENCES projects(id)");
            saveToDisk();
        } catch (alterError) {
            console.error('[DB] Migration failed:', alterError);
        }
    }

    // Topic model override
    try {
        db.exec("SELECT model_override FROM topics LIMIT 1");
    } catch {
        console.log('[DB] Migrating: Adding model_override to topics table');
        try {
            db.run("ALTER TABLE topics ADD COLUMN model_override TEXT DEFAULT NULL");
            saveToDisk();
        } catch (alterError) {
            console.error('[DB] Migration failed:', alterError);
        }
    }

    // Topic prompt override
    try {
        db.exec("SELECT prompt_override FROM topics LIMIT 1");
    } catch {
        console.log('[DB] Migrating: Adding prompt_override to topics table');
        try {
            db.run("ALTER TABLE topics ADD COLUMN prompt_override TEXT DEFAULT NULL");
            saveToDisk();
        } catch (alterError) {
            console.error('[DB] Migration failed:', alterError);
        }
    }

    // Topic source controls snapshot
    try {
        db.exec("SELECT source_controls FROM topics LIMIT 1");
    } catch {
        console.log('[DB] Migrating: Adding source_controls to topics table');
        try {
            db.run("ALTER TABLE topics ADD COLUMN source_controls TEXT DEFAULT NULL");
            saveToDisk();
        } catch (alterError) {
            console.error('[DB] Migration failed:', alterError);
        }
    }

    // [Message System Optimization] Add message_type column
    try {
        db.exec("SELECT message_type FROM messages LIMIT 1");
    } catch (e) {
        console.log('[DB] Migrating: Adding message_type to messages table');
        try {
            db.run("ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text'");
            db.run("ALTER TABLE messages ADD COLUMN metadata TEXT DEFAULT NULL");
            saveToDisk();
        } catch (alterError) {
            console.error('[DB] Migration failed:', alterError);
        }
    }

    // [Message Parts] Add content_summary column
    try {
        db.exec("SELECT content_summary FROM messages LIMIT 1");
    } catch (e) {
        console.log('[DB] Migrating: Adding content_summary to messages table');
        try {
            db.run("ALTER TABLE messages ADD COLUMN content_summary TEXT DEFAULT NULL");
            saveToDisk();
        } catch (alterError) {
            console.error('[DB] Migration failed:', alterError);
        }
    }
}

/**
 * Get DB instance (Sync)
 * Assumes initDatabase() has been called and awaited at startup.
 */
export function getDb(): Database {
    if (!db) {
        throw new Error('Database not initialized. Call await initDatabase() first.');
    }
    return db;
}

// ============ Helper for sql.js Results ============

function rowToTopic(row: any): Topic {
    // sql.js getAsObject returns {col: val}
    return {
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: row.status,
        summary: row.summary ?? undefined,
        stage: row.stage ?? undefined,
        lastSnapshotTime: row.last_snapshot_time ?? undefined,
        projectId: row.project_id ?? undefined,
        modelOverride: row.model_override ?? undefined,
        promptOverride: row.prompt_override ?? undefined,
        sourceControls: (() => {
            if (!row.source_controls) return undefined;
            try {
                return JSON.parse(row.source_controls);
            } catch {
                return undefined;
            }
        })(),
    };
}

function rowToProject(row: any): Project {
    return {
        id: row.id,
        path: row.path,
        name: row.name,
        lastOpenedAt: row.last_opened_at ?? undefined,
        createdAt: row.created_at
    };
}

function rowToMessage(row: any): Message {
    const message: Message = {
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp
    };

    // Parse optional fields
    if (row.message_type) {
        message.messageType = row.message_type;
    }

    if (row.metadata) {
        try {
            message.metadata = JSON.parse(row.metadata);
        } catch (e) {
            console.warn('[DB] Failed to parse metadata for message', row.id, e);
        }
    }

    return message;
}

/**
 * Execute query and return typed array
 */
function queryAll<T>(sql: string, params: any[] = [], mapper: (row: any) => T): T[] {
    const db = getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);

    const results: T[] = [];
    while (stmt.step()) {
        results.push(mapper(stmt.getAsObject()));
    }
    stmt.free();
    return results;
}

/**
 * Execute query and return single item
 */
function queryOne<T>(sql: string, params: any[] = [], mapper: (row: any) => T): T | null {
    const items = queryAll(sql, params, mapper);
    return items.length > 0 ? items[0] : null;
}

// ============ Topics CRUD ============

export function createTopic(topic: Topic): void {
    const db = getDb();
    db.run(`
        INSERT INTO topics (id, title, created_at, updated_at, status, summary, stage, last_snapshot_time, project_id, model_override, prompt_override, source_controls)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        topic.id, topic.title, topic.createdAt, topic.updatedAt, topic.status,
        topic.summary ?? null, topic.stage ?? null, topic.lastSnapshotTime ?? null, topic.projectId ?? null,
        topic.modelOverride ?? null, topic.promptOverride ?? null, topic.sourceControls ? JSON.stringify(topic.sourceControls) : null
    ]);
    saveToDisk();
}

export function getTopic(id: string): Topic | null {
    return queryOne('SELECT * FROM topics WHERE id = ?', [id], rowToTopic);
}

export function getAllTopics(): Topic[] {
    return queryAll('SELECT * FROM topics ORDER BY updated_at DESC', [], rowToTopic);
}

export function updateTopic(id: string, updates: Partial<Topic>): void {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.updatedAt !== undefined) { fields.push('updated_at = ?'); values.push(updates.updatedAt); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.summary !== undefined) { fields.push('summary = ?'); values.push(updates.summary); }
    if (updates.stage !== undefined) { fields.push('stage = ?'); values.push(updates.stage); }
    if (updates.lastSnapshotTime !== undefined) { fields.push('last_snapshot_time = ?'); values.push(updates.lastSnapshotTime); }
    if (updates.projectId !== undefined) { fields.push('project_id = ?'); values.push(updates.projectId); }
    if (updates.modelOverride !== undefined) { fields.push('model_override = ?'); values.push(updates.modelOverride); }
    if (updates.promptOverride !== undefined) { fields.push('prompt_override = ?'); values.push(updates.promptOverride); }
    if (updates.sourceControls !== undefined) { fields.push('source_controls = ?'); values.push(updates.sourceControls ? JSON.stringify(updates.sourceControls) : null); }

    if (fields.length === 0) return;

    values.push(id);
    db.run(`UPDATE topics SET ${fields.join(', ')} WHERE id = ?`, values);

    if (db.getRowsModified() > 0) saveToDisk();
}

// ============ Projects CRUD ============

export function createProject(project: Project): void {
    const db = getDb();
    db.run(`
        INSERT INTO projects (id, path, name, last_opened_at, created_at)
        VALUES (?, ?, ?, ?, ?)
    `, [
        project.id, project.path, project.name,
        project.lastOpenedAt ?? null, project.createdAt
    ]);
    saveToDisk();
}

export function getProject(id: string): Project | null {
    return queryOne('SELECT * FROM projects WHERE id = ?', [id], rowToProject);
}

export function getAllProjects(): Project[] {
    return queryAll('SELECT * FROM projects ORDER BY last_opened_at DESC', [], rowToProject);
}

export function updateProject(id: string, updates: Partial<Project>): void {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.path !== undefined) { fields.push('path = ?'); values.push(updates.path); }
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.lastOpenedAt !== undefined) { fields.push('last_opened_at = ?'); values.push(updates.lastOpenedAt); }

    if (fields.length === 0) return;

    values.push(id);
    db.run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values);

    if (db.getRowsModified() > 0) saveToDisk();
}

export function deleteProject(id: string): void {
    const db = getDb();
    db.run('UPDATE topics SET project_id = NULL WHERE project_id = ?', [id]);
    db.run('DELETE FROM projects WHERE id = ?', [id]);
    saveToDisk();
}

export function deleteTopic(id: string): void {
    const db = getDb();
    // Enable FK support for cascade delete?
    // sql.js defaults FK off unless PRAGMA foreign_keys = ON;
    // Let's enforce it manually or use PRAGMA.
    db.run('PRAGMA foreign_keys = ON');
    db.run('DELETE FROM topics WHERE id = ?', [id]);

    if (db.getRowsModified() > 0) saveToDisk();
}

// ============ Messages CRUD ============

export function createMessage(topicId: string, message: Message): void {
    const db = getDb();

    const messageType = message.messageType || 'text';
    const metadata = message.metadata ? JSON.stringify(message.metadata) : null;

    db.run(`
        INSERT INTO messages (id, topic_id, role, content, timestamp, message_type, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [message.id, topicId, message.role, message.content, message.timestamp, messageType, metadata]);
    saveToDisk();
}

export function getMessages(topicId: string): Message[] {
    return queryAll('SELECT * FROM messages WHERE topic_id = ? ORDER BY timestamp ASC', [topicId], rowToMessage);
}

export function getMessage(id: string): Message | null {
    return queryOne('SELECT * FROM messages WHERE id = ?', [id], rowToMessage);
}

export function deleteMessage(id: string): void {
    const db = getDb();
    db.run('DELETE FROM messages WHERE id = ?', [id]);
    if (db.getRowsModified() > 0) saveToDisk();
}

export function updateMessage(id: string, updates: Partial<Message>): void {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.metadata !== undefined) {
        fields.push('metadata = ?');
        values.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) return;

    values.push(id);
    db.run(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, values);

    if (db.getRowsModified() > 0) saveToDisk();
}

// ============ Batch Operations ============

export function getAllMessagesGroupedByTopic(): Map<string, Message[]> {
    const messages = queryAll('SELECT * FROM messages ORDER BY timestamp ASC', [], (row: any) => ({
        ...rowToMessage(row),
        topic_id: row.topic_id
    }));

    const result = new Map<string, Message[]>();
    for (const msg of messages) {
        const topicId = (msg as any).topic_id;
        if (!result.has(topicId)) {
            result.set(topicId, []);
        }
        result.get(topicId)!.push(msg);
    }
    return result;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        console.log('[DB] Database closed');
    }
}

// ============ Message Parts CRUD ============

export function createMessagePart(part: MessagePart): void {
    const db = getDb();

    let textContent: string | null = null;
    let input: string | null = null;
    let output: string | null = null;
    let toolCallId: string | null = null;
    let toolName: string | null = null;
    let isError = 0;

    if (part.partType === 'text' || part.partType === 'reasoning') {
        textContent = (part as TextMessagePart | ReasoningMessagePart).textContent;
    } else if (part.partType === 'tool-call') {
        const tc = part as ToolCallMessagePart;
        toolCallId = tc.toolCallId;
        toolName = tc.toolName;
        input = JSON.stringify(tc.input);
    } else if (part.partType === 'tool-result') {
        const tr = part as ToolResultMessagePart;
        toolCallId = tr.toolCallId;
        toolName = tr.toolName;
        output = JSON.stringify(tr.output);
        isError = tr.isError ? 1 : 0;
    }

    db.run(`
        INSERT INTO message_parts (
            id, message_id, part_type, part_order,
            text_content, input, output,
            tool_call_id, tool_name, is_error,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        part.id, part.messageId, part.partType, part.partOrder,
        textContent, input, output,
        toolCallId, toolName, isError,
        part.createdAt
    ]);
    saveToDisk();
}

function rowToMessagePart(row: any): MessagePart {
    const base = {
        id: row.id,
        messageId: row.message_id,
        partType: row.part_type,
        partOrder: row.part_order,
        createdAt: row.created_at
    };

    switch (row.part_type) {
        case 'text':
            return { ...base, partType: 'text', textContent: row.text_content };
        case 'reasoning':
            return { ...base, partType: 'reasoning', textContent: row.text_content };
        case 'tool-call':
            return {
                ...base,
                partType: 'tool-call',
                toolCallId: row.tool_call_id,
                toolName: row.tool_name,
                input: row.input ? JSON.parse(row.input) : {}
            };
        case 'tool-result':
            return {
                ...base,
                partType: 'tool-result',
                toolCallId: row.tool_call_id,
                toolName: row.tool_name,
                output: row.output ? JSON.parse(row.output) : { type: 'text', value: '' },
                isError: row.is_error === 1
            };
        default:
            throw new Error(`Unknown part_type: ${row.part_type}`);
    }
}

export function getMessageParts(messageId: string): MessagePart[] {
    return queryAll(
        'SELECT * FROM message_parts WHERE message_id = ? ORDER BY part_order ASC',
        [messageId],
        rowToMessagePart
    );
}

export function getMessagesWithParts(topicId: string): MessageWithParts[] {
    const messages = getMessages(topicId);
    const allParts = new Map<string, MessagePart[]>();

    // Batch load all parts (避免N+1查询)
    const db = getDb();
    const stmt = db.prepare(`
        SELECT * FROM message_parts 
        WHERE message_id IN (SELECT id FROM messages WHERE topic_id = ?)
        ORDER BY message_id, part_order ASC
    `);
    stmt.bind([topicId]);

    while (stmt.step()) {
        const part = rowToMessagePart(stmt.getAsObject());
        if (!allParts.has(part.messageId)) {
            allParts.set(part.messageId, []);
        }
        allParts.get(part.messageId)!.push(part);
    }
    stmt.free();

    return messages.map(msg => ({
        ...msg,
        parts: allParts.get(msg.id) || []
    }));
}

