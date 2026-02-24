import { describe, expect, it, vi } from 'vitest';
import { AOTUIDrivenSource } from './aotui-driven-source.js';

describe('AOTUIDrivenSource type tool routing', () => {
    it('routes app_name based toolName via indexMap metadata (implicit app_id)', async () => {
        const executeSpy = vi.fn().mockResolvedValue({ success: true, data: { ok: true } });

        const kernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({
                id: 'snap_1',
                indexMap: {
                    'tool:system_ide-FileDetail-lsp_hover': {
                        description: 'hover',
                        params: [],
                        appId: 'app_7',
                        appName: 'system_ide',
                        viewType: 'FileDetail',
                        toolName: 'lsp_hover',
                    },
                },
            }),
            releaseSnapshot: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            execute: executeSpy,
            getSystemToolDefinitions: vi.fn().mockReturnValue([]),
        } as any;

        const desktop = {
            id: 'desktop_1',
            output: {
                subscribe: vi.fn(),
                unsubscribe: vi.fn(),
            },
        } as any;

        const source = new AOTUIDrivenSource(desktop, kernel);
        const result = await source.executeTool('system_ide-FileDetail-lsp_hover', { line: 1 }, 'call_1');

        expect(result?.error).toBeUndefined();
        expect(executeSpy).toHaveBeenCalledTimes(1);

        const operation = executeSpy.mock.calls[0][1];
        expect(operation.context.appId).toBe('app_7');
        expect(operation.context.viewId).toBe('FileDetail');
        expect(operation.name).toBe('lsp_hover');
    });
});
