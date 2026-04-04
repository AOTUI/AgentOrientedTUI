import type { AppEvents, FileInfo } from '../types.js';

type CreateFileWorkflowDependencies = {
    filePath: string;
    content: string;
    activeFiles: string[];
    workspaceFolders: string[];
    fileSystemService: {
        createFile(filePath: string, content: string): Promise<void>;
    };
    persistenceService: {
        addOpenFile(workspacePath: string, fileInfo: FileInfo): Promise<void>;
    };
    eventBus: {
        emit<Name extends keyof AppEvents>(eventName: Name, eventData: AppEvents[Name]): Promise<void>;
    };
    onOpenFileDetail(filePath: string): void;
};

function getFileDetailViewId(activeFiles: string[], filePath: string): string {
    const existingIndex = activeFiles.indexOf(filePath);
    return `fd_${existingIndex >= 0 ? existingIndex : activeFiles.length}`;
}

export async function completeCreateFileWorkflow({
    filePath,
    content,
    activeFiles,
    workspaceFolders,
    fileSystemService,
    persistenceService,
    eventBus,
    onOpenFileDetail,
}: CreateFileWorkflowDependencies): Promise<{ message: string; viewId: string }> {
    await fileSystemService.createFile(filePath, content);

    const viewId = getFileDetailViewId(activeFiles, filePath);
    onOpenFileDetail(filePath);

    try {
        await persistenceService.addOpenFile(workspaceFolders[0] ?? 'default', {
            path: filePath,
            lastOpened: Date.now(),
        });
    } catch (error) {
        console.warn('[RootView] Failed to persist created file as open:', error);
    }

    await eventBus.emit('open_files_updated', {});
    await eventBus.emit('file_changed', { filePath });

    return {
        message: `File created and opened in FileDetail View (${viewId}). Check the Workspace View and FileDetail View (${viewId}): ${filePath}`,
        viewId,
    };
}
