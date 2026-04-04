import { completeCreateFileWorkflow } from '../tui/create-file-workflow.js';

describe('completeCreateFileWorkflow', () => {
    it('creates a file and opens it in a new FileDetail view', async () => {
        const filePath = '/project/src/new-file.ts';
        const fileSystemService = {
            createFile: jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined),
        };
        const persistenceService = {
            addOpenFile: jest.fn<Promise<void>, [string, { path: string; lastOpened: number }]>().mockResolvedValue(undefined),
        };
        const eventBus = {
            emit: jest.fn<Promise<void>, [string, unknown]>().mockResolvedValue(undefined),
        };
        const onOpenFileDetail = jest.fn<void, [string]>();

        const result = await completeCreateFileWorkflow({
            filePath,
            content: 'export const created = true;\n',
            activeFiles: ['/project/src/existing.ts'],
            workspaceFolders: ['/project'],
            fileSystemService,
            persistenceService,
            eventBus,
            onOpenFileDetail,
        });

        expect(fileSystemService.createFile).toHaveBeenCalledWith(filePath, 'export const created = true;\n');
        expect(onOpenFileDetail).toHaveBeenCalledWith(filePath);
        expect(persistenceService.addOpenFile).toHaveBeenCalledWith(
            '/project',
            expect.objectContaining({
                path: filePath,
                lastOpened: expect.any(Number),
            }),
        );
        expect(eventBus.emit.mock.calls).toEqual([
            ['open_files_updated', {}],
            ['file_changed', { filePath }],
        ]);
        expect(result).toEqual({
            message: `File created and opened in FileDetail View (fd_1). Check the Workspace View and FileDetail View (fd_1): ${filePath}`,
            viewId: 'fd_1',
        });
    });
});
