import { app, BrowserWindow, ipcMain } from 'electron';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createIPCHandler } from 'electron-trpc/main';
import { appRouter } from '../trpc/router.js';
import { createHostV2Core } from '../server/host-v2.js';
import { ModelRegistry } from '../services/model-registry.js';

// ESM Polyfill for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Suppress EPIPE errors on stdout/stderr in packaged app (pipe closed during shutdown)
process.stdout?.on?.('error', () => {});
process.stderr?.on?.('error', () => {});

// Fix PATH for packaged Electron — Finder/Dock launches have a minimal PATH
// that won't include Homebrew, nvm, volta, pyenv, etc.
if (app.isPackaged) {
    try {
        const shell = process.env.SHELL || '/bin/zsh';
        const shellPath = execSync(`${shell} -ilc 'echo $PATH'`, { encoding: 'utf8' }).trim();
        if (shellPath) {
            process.env.PATH = shellPath;
        }
    } catch {
        // Fallback: append common macOS paths
        process.env.PATH = [
            process.env.PATH,
            '/opt/homebrew/bin',
            '/opt/homebrew/sbin',
            '/usr/local/bin',
            join(process.env.HOME || '', '.nvm/versions/node/*/bin'),
            join(process.env.HOME || '', '.volta/bin'),
        ].join(':');
    }
}

let serverPort = 0;
let ipcHandler: ReturnType<typeof createIPCHandler> | null = null;
let hostCore: Awaited<ReturnType<typeof createHostV2Core>> | null = null;
let modelRegistry: ModelRegistry | null = null;
let isShuttingDown = false;

async function gracefulShutdownHost(): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    try {
        if (hostCore) {
            console.log('[Main] Shutting down host core...');
            await hostCore.imRuntimeBridge.stop();
            await hostCore.hostManager.dispose();
            console.log('[Main] Host core shutdown complete');
        }
    } catch (error) {
        console.error('[Main] Failed to shutdown host core:', error);
    }
}

async function ensureModelRegistry(): Promise<ModelRegistry> {
    if (!modelRegistry) {
        console.log('[Main] Initializing ModelRegistry...');
        modelRegistry = new ModelRegistry();
        
        // 异步预加载数据（不阻塞启动）
        modelRegistry.getProviders().catch(err => {
            console.error('[Main] Failed to preload model registry:', err);
        });
        
        console.log('[Main] ModelRegistry initialized');
    }
    return modelRegistry;
}

async function ensureHostCore() {
    if (!hostCore) {
        const registry = await ensureModelRegistry();
        hostCore = await createHostV2Core(registry);
    }
    return hostCore;
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        transparent: true,          // macOS 26: transparent window for rounded corners
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 20, y: 18 },
        webPreferences: {
            preload: resolve(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Required for CommonJS preload with Node APIs
        },
    });

    // Dev: Load from Vite Server
    // Prod: Load from dist-gui
    const isDev = !app.isPackaged;
    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(join(__dirname, '../../dist-gui/index.html'));
    }

    if (ipcHandler) {
        ipcHandler.attachWindow(win);
    } else {
        ipcHandler = createIPCHandler({
            router: appRouter,
            windows: [win],
            createContext: async () => {
                const { hostManager, llmConfigService } = await ensureHostCore();
                const registry = await ensureModelRegistry();
                // ✅ 添加 MessageServiceV2 到 context
                const { MessageServiceV2 } = await import('../core/message-service-v2.js');
                const messageService = new MessageServiceV2();
                
                return { 
                    hostManager, 
                    llmConfigService,
                    modelRegistry: registry,
                    messageService,
                };
            }
        });
    }

    win.on('closed', () => {
        ipcHandler?.detachWindow(win);
    });
}

app.whenReady().then(async () => {
    const userDataPath = app.getPath('userData');
    process.env.DB_PATH = join(userDataPath, 'chat.db');
    console.log('[Electron] DB Path:', process.env.DB_PATH);

    await ensureHostCore();
    createWindow();

    // IPC Handlers
    ipcMain.handle('get-server-port', () => serverPort);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    void gracefulShutdownHost().finally(() => {
        app.quit();
    });
});

app.on('before-quit', () => {
    void gracefulShutdownHost();
});
