import { describe, it, expect } from 'vitest';
import { AppWorkerHost } from '../engine/app/worker-host.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerScriptPath = path.resolve(__dirname, 'fixtures/echo-worker.js');

describe('E2E: Configuration Injection', () => {

    it('should inject config into real worker and echo it back', async () => {
        const config = { env: { E2E_TEST_VAR: 'confirmed' } };

        const testHost = new AppWorkerHost({
            appId: 'e2e_app',
            desktopId: 'e2e_desktop',
            appModulePath: '/mock/app/path', // Not used by echo-worker
            workerScriptPath: workerScriptPath,
            config
        });

        // Use a promise to capture the echo message
        const echoPromise = new Promise((resolve) => {
            // @ts-ignore - Access private worker instance for testing
            const checkWorker = () => {
                // @ts-ignore
                const worker = testHost.worker;
                if (worker) {
                    worker.on('message', (msg: any) => {
                        if (msg.type === 'ECHO_CONFIG') {
                            resolve(msg.config);
                        }
                    });
                } else {
                    // Retry if worker not yet created (should be created in start)
                    setTimeout(checkWorker, 10);
                }
            };
            // Monitor testHost property 'worker' using a timer loop started BEFORE start().
            checkWorker();
        });

        const startTime = Date.now();
        await testHost.start();
        const duration = Date.now() - startTime;

        console.log(`[Performance] App Start + Config Echo took ${duration}ms`);

        const receivedConfig = await echoPromise;

        expect(receivedConfig).toEqual(config);

        testHost.terminate();
    });
});
