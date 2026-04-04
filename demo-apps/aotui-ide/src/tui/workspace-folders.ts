export function mergeWorkspaceFolders(persistedFolders: string[], envProjectPath: string | undefined): string[] {
    const merged = new Set<string>();
    if (envProjectPath) {
        merged.add(envProjectPath);
    }
    for (const folder of persistedFolders) {
        if (typeof folder === 'string' && folder.length > 0) {
            merged.add(folder);
        }
    }
    return Array.from(merged);
}
