import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import fssync from 'fs';
import os from 'os';
import path from 'path';
import { installNpmPackage } from './npm-installer.js';

describe('installNpmPackage', () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentina-npm-install-'));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('installs package into cache and returns local source', async () => {
        const runner = vi.fn(async (_command: string, args: string[], cwd: string) => {
            const spec = args[args.length - 1];
            const packageName = spec.split('@')[0] || spec;
            const packagePath = path.join(cwd, 'node_modules', packageName);
            await fs.mkdir(packagePath, { recursive: true });
            await fs.writeFile(
                path.join(packagePath, 'package.json'),
                JSON.stringify({ name: packageName, version: '1.0.1' }),
                'utf-8'
            );
        });

        const result = await installNpmPackage('demo-app@1.0.0', {
            cacheRoot: tmpDir,
            commandRunner: runner
        });

        expect(runner).toHaveBeenCalledTimes(1);
        expect(result.packageName).toBe('demo-app');
        expect(result.packageSpec).toBe('demo-app@1.0.0');
        expect(result.resolvedVersion).toBe('1.0.1');
        expect(result.localSource).toBe(`local:${result.installedPath}`);
        expect(fssync.existsSync(result.installedPath)).toBe(true);
    });

    it('skips reinstall if package is already cached', async () => {
        const runner = vi.fn(async (_command: string, args: string[], cwd: string) => {
            const spec = args[args.length - 1];
            const packageName = spec.split('@')[0] || spec;
            const packagePath = path.join(cwd, 'node_modules', packageName);
            await fs.mkdir(packagePath, { recursive: true });
            await fs.writeFile(
                path.join(packagePath, 'package.json'),
                JSON.stringify({ name: packageName, version: '2.0.0' }),
                'utf-8'
            );
        });

        await installNpmPackage('cached-app', {
            cacheRoot: tmpDir,
            commandRunner: runner
        });
        await installNpmPackage('cached-app', {
            cacheRoot: tmpDir,
            commandRunner: runner
        });

        expect(runner).toHaveBeenCalledTimes(1);
    });

    it('reinstalls when forceReinstall is true', async () => {
        const runner = vi.fn(async (_command: string, args: string[], cwd: string) => {
            const spec = args[args.length - 1];
            const packageName = spec.split('@')[0] || spec;
            const packagePath = path.join(cwd, 'node_modules', packageName);
            await fs.mkdir(packagePath, { recursive: true });
            await fs.writeFile(
                path.join(packagePath, 'package.json'),
                JSON.stringify({ name: packageName, version: '3.0.0' }),
                'utf-8'
            );
        });

        await installNpmPackage('forced-app', {
            cacheRoot: tmpDir,
            commandRunner: runner
        });
        await installNpmPackage('forced-app', {
            cacheRoot: tmpDir,
            commandRunner: runner,
            forceReinstall: true
        });

        expect(runner).toHaveBeenCalledTimes(2);
    });
});
