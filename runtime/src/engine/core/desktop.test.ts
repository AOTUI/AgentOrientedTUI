import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Desktop } from './index.js';
import { parseHTML } from 'linkedom';

describe('Desktop', () => {
    let desktop: Desktop;

    beforeEach(() => {
        desktop = new Desktop();
    });

    afterEach(() => {
        desktop.dispose();
    });

    it('initializes with a unique ID', () => {
        expect(desktop.id).toBeDefined();
        expect(desktop.id).toContain('dt_');
    });

    it('reinitializeApps delegates to AppManager and emits one coherent refresh signal', async () => {
        const appManager = {
            reinitializeAll: vi.fn().mockResolvedValue({
                reinitializedAppIds: ['app_0'],
                skippedAppIds: ['app_1'],
                failedAppIds: [],
            }),
            closeAll: vi.fn().mockResolvedValue(undefined),
            getInstalledApps: vi.fn().mockReturnValue([]),
            getAppStates: vi.fn().mockReturnValue([]),
            getDynamicAppIds: vi.fn().mockReturnValue([]),
            getAllWorkers: vi.fn().mockReturnValue(new Map()),
            broadcastLLMOutput: vi.fn(),
        };
        const delegatedDesktop = new Desktop('dt_phase1' as any, {
            appManager: appManager as any,
        });
        const emitSignalSpy = vi.spyOn((delegatedDesktop as any).signalBus, 'emitSignal');

        const result = await delegatedDesktop.reinitializeApps({
            reason: 'context_compaction',
        });

        expect(appManager.reinitializeAll).toHaveBeenCalledWith({
            reason: 'context_compaction',
        });
        expect(result).toEqual({
            desktopId: 'dt_phase1',
            reinitializedAppIds: ['app_0'],
            skippedAppIds: ['app_1'],
            failedAppIds: [],
        });
        expect(emitSignalSpy).toHaveBeenCalledWith('dt_phase1', 'manual_refresh');

        delegatedDesktop.dispose();
        emitSignalSpy.mockRestore();
    });



    // [Worker-Only] 以下测试使用已废弃的 installApp() API
    // Worker-Only 架构需要使用 installDynamicWorkerApp() 并提供模块路径
    // 这些测试暂时跳过，待后续重写为 Worker 模式测试

    it.skip('installs app content into isolated sandbox', async () => {

        const html = '<body view="test"><h1>Hello</h1></body>';
        const appId = await (desktop as any).installApp('Test App', html);

        expect(appId).toBe('app_0');
        const appContainer = desktop.getAppContainer(appId);
        expect(appContainer).toBeDefined();
        expect(appContainer?.innerHTML).toContain('<h1>Hello</h1>');
    });

    it.skip('emits signals on DOM mutation', async () => {

        const listener = vi.fn();
        desktop.output.subscribe(listener);

        await (desktop as any).installApp('Test', '<div>Test</div>');

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(listener).toHaveBeenCalled();
        const signal = listener.mock.calls[0][0];
        expect(signal.reason).toBe('app_opened');
        expect(signal.desktopId).toBe(desktop.id);
    });

    it.skip('isolates apps from each other', async () => {

        const app1Id = await (desktop as any).installApp('App1', '<div id="shared-id">Content A</div>');
        const app2Id = await (desktop as any).installApp('App2', '<div id="shared-id">Content B</div>');

        const container1 = desktop.getAppContainer(app1Id);
        const container2 = desktop.getAppContainer(app2Id);

        expect(container1?.querySelector('#shared-id')?.textContent).toBe('Content A');
        expect(container2?.querySelector('#shared-id')?.textContent).toBe('Content B');
        expect(container1?.querySelector('#shared-id')).not.toBe(container2?.querySelector('#shared-id'));
    });
});
