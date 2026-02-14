import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import type { FileInfo } from '../types.js';

interface Schema {
    workspaces: {
        [workspacePath: string]: {
            openFiles: FileInfo[];
        };
    };
}

let db: Low<Schema> | null = null;

/**
 * 持久化服务
 * 使用 LowDB 管理 openFiles（按 workspace 隔离）
 */
export const persistenceService = {
    /**
     * 初始化数据库
     */
    async initDatabase(): Promise<void> {
        if (db) return;

        const dbDir = path.join(os.homedir(), '.aotui');
        const dbPath = path.join(dbDir, 'system-ide-db.json');
        await fs.mkdir(dbDir, { recursive: true });
        const adapter = new JSONFile<Schema>(dbPath);
        db = new Low(adapter, { workspaces: {} });

        await db.read();
        db.data ||= { workspaces: {} };
        await db.write();
    },

    /**
     * 获取某个 workspace 的 openFiles
     */
    async getOpenFiles(workspacePath: string): Promise<FileInfo[]> {
        if (!db) throw new Error('Database not initialized');

        await db.read();
        const workspace = db.data.workspaces[workspacePath];
        return workspace?.openFiles || [];
    },

    /**
     * 添加到 openFiles（去重 + LRU 策略，最多 10 个）
     */
    async addOpenFile(workspacePath: string, fileInfo: FileInfo): Promise<void> {
        if (!db) throw new Error('Database not initialized');

        await db.read();

        // 初始化 workspace（如果不存在）
        if (!db.data.workspaces[workspacePath]) {
            db.data.workspaces[workspacePath] = { openFiles: [] };
        }

        const openFiles = db.data.workspaces[workspacePath].openFiles;

        // 去重：移除相同 path 的旧记录
        const filtered = openFiles.filter((f: FileInfo) => f.path !== fileInfo.path);

        // 添加新记录到头部
        filtered.unshift(fileInfo);

        // LRU 策略：限制最多 10 个
        if (filtered.length > 10) {
            filtered.length = 10;
        }

        db.data.workspaces[workspacePath].openFiles = filtered;
        await db.write();
    },

    /**
     * 移除 openFile
     */
    async removeOpenFile(workspacePath: string, filePath: string): Promise<void> {
        if (!db) throw new Error('Database not initialized');

        await db.read();

        const workspace = db.data.workspaces[workspacePath];
        if (!workspace) return;

        workspace.openFiles = workspace.openFiles.filter((f: FileInfo) => f.path !== filePath);
        await db.write();
    },
};
