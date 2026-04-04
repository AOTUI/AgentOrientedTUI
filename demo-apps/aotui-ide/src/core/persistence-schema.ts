import type { FileInfo } from '../types.js';

export interface WorkspacePersistenceState {
    openFiles: FileInfo[];
}

export interface PersistenceSchema {
    workspaceFolders: string[];
    workspaces: Record<string, WorkspacePersistenceState>;
}

export function normalizeWorkspaceFolders(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0)));
}

export function normalizePersistenceSchema(value: unknown): PersistenceSchema {
    const candidate = value && typeof value === 'object' ? value as {
        workspaceFolders?: unknown;
        workspaces?: Record<string, { openFiles?: unknown }>;
    } : {};

    const normalizedWorkspaces: Record<string, WorkspacePersistenceState> = {};
    const rawWorkspaces = candidate.workspaces && typeof candidate.workspaces === 'object'
        ? candidate.workspaces
        : {};

    for (const [workspacePath, workspaceValue] of Object.entries(rawWorkspaces)) {
        const openFiles = Array.isArray(workspaceValue?.openFiles)
            ? workspaceValue.openFiles.filter((item): item is FileInfo => {
                if (!item || typeof item !== 'object') {
                    return false;
                }
                const file = item as Partial<FileInfo>;
                return typeof file.path === 'string' && typeof file.lastOpened === 'number';
            })
            : [];
        normalizedWorkspaces[workspacePath] = { openFiles };
    }

    return {
        workspaceFolders: normalizeWorkspaceFolders(candidate.workspaceFolders),
        workspaces: normalizedWorkspaces,
    };
}
