import { parentPort } from 'worker_threads';

// Mimic SDK Runtime behavior
if (parentPort) {
    // 1. Send READY
    parentPort.postMessage({ type: 'READY' });

    // 2. Listen for INIT
    parentPort.on('message', (msg) => {
        if (msg.type === 'INIT') {
            const config = msg.config;
            const requestId = msg.requestId;

            // 3. Send INIT_RESPONSE (Standard Protocol)
            parentPort.postMessage({
                type: 'INIT_RESPONSE',
                requestId: requestId,
                success: true
            });

            // 4. Send Custom Validation Message (Verification)
            parentPort.postMessage({
                type: 'ECHO_CONFIG',
                config: config
            });
        }
    });
}
