#!/usr/bin/env node

/**
 * TUI CLI - Third-Party App Management
 * 
 * 命令:
 *   tui add <source>     安装 App
 *   tui remove <name>    卸载 App
 *   tui list             列出已安装
 *   tui enable <name>    启用 App
 *   tui disable <name>   禁用 App
 *   tui autostart <name> <on|off>  设置自动启动
 *   tui link <path>      链接本地开发目录
 *   tui run [name]       Run installed apps (or specific app)
 * 
 * @module @aotui/cli
 */

import { AppRegistry } from './engine/app/index.js';
import { createRuntime } from './facades/index.js';
import * as readline from 'readline';

const HELP = `
TUI App Manager

Usage: tui <command> [options]

Commands:
  add <source>         Install an app
  remove <name>        Uninstall an app
  list                 List installed apps
  enable <name>        Enable an app
  disable <name>       Disable an app
  autostart <name> <on|off>  Set auto-start behavior
  link <path>          Link a local development directory
  run [name]           Run installed apps (or specific app)

Options:
  --force              Force install (overwrite existing)
  --as <alias>         Install with different name
  --no-autostart       Install without auto-start
  --help               Show help

Examples:
  tui add @tui/weather           # Install from npm
  tui add ./my-app               # Install from local directory
  tui run grep-demo              # Run grep-demo app
  tui list                       # Show all installed apps
`;

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        console.log(HELP);
        return;
    }

    const command = args[0];
    const registry = new AppRegistry();
    await registry.loadFromConfig();

    try {
        switch (command) {
            case 'add':
                await handleAdd(registry, args.slice(1));
                break;

            case 'remove':
                await handleRemove(registry, args.slice(1));
                break;

            case 'list':
                handleList(registry);
                break;

            case 'enable':
                await handleEnable(registry, args.slice(1), true);
                break;

            case 'disable':
                await handleEnable(registry, args.slice(1), false);
                break;

            case 'link':
                await handleLink(registry, args.slice(1));
                break;

            case 'autostart':
                await handleAutoStart(registry, args.slice(1));
                break;

            case 'run':
                await handleRun(registry, args.slice(1));
                break;

            default:
                console.error(`Unknown command: ${command}`);
                console.log(HELP);
                process.exit(1);
        }
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// ════════════════════════════════════════════════════════════════
//  Command Handlers
// ════════════════════════════════════════════════════════════════

async function handleAdd(registry: AppRegistry, args: string[]): Promise<void> {
    if (args.length === 0) {
        console.error('Usage: tui add <source> [--force] [--as <alias>]');
        process.exit(1);
    }

    let source = args[0];
    let force = false;
    let alias: string | undefined;
    let noAutoStart = false;

    // Parse flags
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--force') {
            force = true;
        } else if (args[i] === '--as' && args[i + 1]) {
            alias = args[++i];
        } else if (args[i] === '--no-autostart') {
            noAutoStart = true;
        }
    }

    // Normalize source
    if (!source.includes(':')) {
        if (source.startsWith('.') || source.startsWith('/')) {
            // Local path
            source = `local:${source}`;
        } else if (source.startsWith('@') || /^[a-z0-9-]+$/.test(source)) {
            // npm package
            source = `npm:${source}`;
        }
    }

    console.log(`Installing ${source}...`);
    const name = await registry.add(source, { force, alias });

    // [RFC-014] Set autoStart=false if --no-autostart flag was used
    if (noAutoStart) {
        await registry.setAutoStart(name, false);
        console.log(`✅ Successfully installed: ${name} (auto-start: off)`);
    } else {
        console.log(`✅ Successfully installed: ${name}`);
    }
}

async function handleRemove(registry: AppRegistry, args: string[]): Promise<void> {
    if (args.length === 0) {
        console.error('Usage: tui remove <name>');
        process.exit(1);
    }

    const name = args[0];
    await registry.remove(name);
    console.log(`✅ Successfully removed: ${name}`);
}

function handleList(registry: AppRegistry): void {
    const config = registry.getConfig();
    const appNames = Object.keys(config.apps);

    if (appNames.length === 0) {
        console.log('No apps installed.');
        console.log('');
        console.log('Install an app with: tui add <package>');
        return;
    }

    console.log('Installed apps:');
    console.log('');

    // Show all apps from config (including disabled ones)
    for (const name of appNames) {
        const entry = config.apps[name];
        const loadedApp = registry.get(name);
        // [RFC-014] Two-layer status: enabled + autoStart
        const enabledStatus = entry.enabled ? '✅' : '❌';
        const autoStartStatus = (entry.autoStart ?? true) ? '🚀' : '⏸️';

        // Use loaded manifest if available, otherwise show basic info
        if (loadedApp) {
            // [方案 B] manifest 在 kernelConfig 模式下可能为 undefined
            const displayName = loadedApp.manifest?.displayName ?? loadedApp.factory.displayName ?? name;
            const version = loadedApp.manifest?.version ?? 'N/A';
            console.log(`  ${enabledStatus}${autoStartStatus} ${displayName} (${name})`);
            console.log(`     Version: ${version}`);
        } else {
            console.log(`  ${enabledStatus}${autoStartStatus} ${name} (disabled)`);
        }
        console.log(`     Source: ${entry.source}`);
        console.log('');
    }

    // [RFC-014] Legend
    console.log('Legend: ✅=enabled ❌=disabled 🚀=auto-start ⏸️=manual-start');
}

async function handleEnable(registry: AppRegistry, args: string[], enable: boolean): Promise<void> {
    if (args.length === 0) {
        console.error(`Usage: tui ${enable ? 'enable' : 'disable'} <name>`);
        process.exit(1);
    }

    const name = args[0];
    await registry.setEnabled(name, enable);
    console.log(`✅ ${enable ? 'Enabled' : 'Disabled'}: ${name}`);
}

/**
 * [RFC-014] Handle autostart command
 */
async function handleAutoStart(registry: AppRegistry, args: string[]): Promise<void> {
    if (args.length < 2) {
        console.error('Usage: tui autostart <name> <on|off>');
        process.exit(1);
    }

    const name = args[0];
    const value = args[1].toLowerCase();

    if (value !== 'on' && value !== 'off') {
        console.error('Value must be "on" or "off"');
        process.exit(1);
    }

    await registry.setAutoStart(name, value === 'on');
    console.log(`✅ Auto-start ${value === 'on' ? 'enabled' : 'disabled'}: ${name}`);
}

async function handleLink(registry: AppRegistry, args: string[]): Promise<void> {
    if (args.length === 0) {
        console.error('Usage: tui link <path>');
        process.exit(1);
    }

    const localPath = args[0];
    const path = await import('path');
    const absolutePath = path.resolve(localPath);

    console.log(`Linking ${absolutePath}...`);
    const name = await registry.add(`local:${absolutePath}`);
    console.log(`✅ Successfully linked: ${name}`);
}

async function handleRun(registry: AppRegistry, args: string[]): Promise<void> {
    const targetApp = args[0]; // Optional: run specific app

    console.log('[TUI] Starting Runtime...');
    const runtime = createRuntime();
    const desktopId = await runtime.createDesktop();
    const desktop = (runtime as any).desktopManager.get(desktopId);

    console.log(`[TUI] Desktop created: ${desktopId}`);

    // [Fix] Move rl creation before signal subscription so callback can use it
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'tui> '
    });

    let isInteractive = false;

    // Auto-print snapshots on update
    if ((desktop as any).signalBus) {
        (desktop as any).signalBus.subscribe(desktopId, (signal: any) => {
            // Filter relevant signals
            if (signal.reason === 'dom_mutation' || signal.reason === 'manual_refresh' || signal.reason === 'app_opened') {
                 console.log('\n[TUI] UI Updated:');
                 const fragments = desktop.getSnapshotFragments();
                 fragments.forEach((f: any) => {
                     console.log(`--- App ${f.appId} ---`);
                     console.log(f.markup);
                 });
                 // Only prompt if in interactive loop
                 if (isInteractive) {
                     rl.prompt(true);
                 }
            }
        });
    }

    // Install apps from registry
    const config = registry.getConfig();
    const appsToRun = targetApp ? [targetApp] : Object.keys(config.apps);

    const runningAppIds: string[] = [];

    for (const name of appsToRun) {
        const entry = config.apps[name];
        if (!entry) {
            console.error(`App "${name}" not found in registry.`);
            continue;
        }
        if (!entry.enabled && !targetApp) {
            continue;
        }

        const loadedApp = registry.get(name);
        if (!loadedApp) {
             console.error(`App "${name}" could not be loaded (check if enabled or valid source).`);
             continue;
        }

        // HACK: for local apps, source starts with local:
        let realPath = loadedApp.source;
        if (realPath.startsWith('local:')) {
            realPath = realPath.substring(6);
            // Resolve relative to cwd
            const path = await import('path');
            const fs = await import('fs');
            const url = await import('url');
            
            realPath = path.resolve(process.cwd(), realPath);
            // Add dist/index.js if directory
            if (fs.statSync(realPath).isDirectory()) {
                realPath = path.join(realPath, 'dist/index.js');
            }
             // Convert to file URL
            realPath = url.pathToFileURL(realPath).href;
        }

        console.log(`[TUI] Installing ${name} from ${realPath}...`);
        
        try {
            const appId = await desktop.installDynamicWorkerApp(realPath, {
                name: name,
                config: {} // TODO: support config injection
            });
            runningAppIds.push(appId);
            console.log(`[TUI] Started ${name} (AppID: ${appId})`);
            
            // Auto open
            await desktop.appManager.openApp(appId);
        } catch (e: any) {
            console.error(`[TUI] Failed to start ${name}: ${e.message}`);
        }
    }

    if (runningAppIds.length === 0) {
        console.log('[TUI] No apps started.');
        process.exit(0);
    }

    console.log('[TUI] Runtime ready. Type JSON event to send, or "exit" to quit.');
    console.log('Example: {"type":"EXTERNAL_EVENT", "eventType":"grep-result", "data":{"line":"foo"}}');

    isInteractive = true;
    rl.prompt();

    rl.on('line', async (line: string) => {
        const input = line.trim();
        if (input === 'exit') {
            rl.close();
            process.exit(0);
        }

        if (input.startsWith('{')) {
            try {
                const event = JSON.parse(input);
                if (event.type === 'EXTERNAL_EVENT') {
                    // Send to all running apps
                    for (const appId of runningAppIds) {
                        const workerSandbox = (desktop.appManager as any).workers.get(appId);
                        if (workerSandbox && workerSandbox.workerHost) {
                             workerSandbox.workerHost.worker.postMessage({
                                type: 'EXTERNAL_EVENT',
                                requestId: `cli_${Date.now()}`,
                                viewId: event.viewId || 'view_0',
                                eventType: event.eventType,
                                data: event.data
                             });
                             console.log(`[TUI] Sent event to ${appId}`);
                        }
                    }
                } else {
                    console.log('Unknown command. Support JSON with type="EXTERNAL_EVENT"');
                }
            } catch (e) {
                console.error('Invalid JSON');
            }
        } else {
             // Render Snapshot check
             if (input === 'snapshot') {
                 const fragments = desktop.getSnapshotFragments();
                 fragments.forEach((f: any) => {
                     console.log(`--- App ${f.appId} ---`);
                     console.log(f.markup);
                 });
             }
        }
        rl.prompt();
    });
}

// Run
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
