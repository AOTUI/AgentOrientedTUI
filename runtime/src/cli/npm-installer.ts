import path from 'path';
import os from 'os';
import fs from 'fs';
import fsp from 'fs/promises';
import { execFile as nodeExecFile } from 'child_process';
import { promisify } from 'util';
import { parseNpmSpecifier } from './sources.js';

const execFile = promisify(nodeExecFile);

export interface NpmInstallOptions {
    cacheRoot?: string;
    forceReinstall?: boolean;
    npmBinary?: string;
    commandRunner?: (command: string, args: string[], cwd: string) => Promise<void>;
}

export interface NpmInstallResult {
    packageName: string;
    packageSpec: string;
    requestedVersion: string | null;
    resolvedVersion: string | null;
    installRoot: string;
    installedPath: string;
    localSource: string;
}

export async function installNpmPackage(packageInput: string, options?: NpmInstallOptions): Promise<NpmInstallResult> {
    const parsed = parseNpmSpecifier(packageInput);
    const cacheRoot = options?.cacheRoot ?? getDefaultAppCacheRoot();
    const npmBinary = options?.npmBinary ?? 'npm';
    const requestedVersion = parsed.version;
    const versionSegment = sanitizeSegment(parsed.version ?? 'latest');
    const packageSegment = sanitizePackageName(parsed.packageName);
    const installRoot = path.join(cacheRoot, packageSegment, versionSegment);

    await fsp.mkdir(installRoot, { recursive: true });
    await ensureInstallWorkspace(installRoot);

    const installedPath = path.join(installRoot, 'node_modules', parsed.packageName);
    const alreadyInstalled = fs.existsSync(installedPath);

    if (!alreadyInstalled || options?.forceReinstall) {
        await runInstallCommand(
            npmBinary,
            ['install', '--no-save', '--omit=dev', '--ignore-scripts', parsed.packageSpec],
            installRoot,
            options?.commandRunner
        );
    }

    if (!fs.existsSync(installedPath)) {
        throw new Error(`Package install succeeded but app path was not found: ${installedPath}`);
    }

    const resolvedVersion = await readPackageVersion(installedPath);

    return {
        packageName: parsed.packageName,
        packageSpec: parsed.packageSpec,
        requestedVersion,
        resolvedVersion,
        installRoot,
        installedPath,
        localSource: `local:${installedPath}`
    };
}

function getDefaultAppCacheRoot(): string {
    return path.join(os.homedir(), '.agentina', 'apps', 'npm');
}

async function ensureInstallWorkspace(workspaceRoot: string): Promise<void> {
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        return;
    }
    await fsp.writeFile(
        packageJsonPath,
        JSON.stringify(
            {
                name: 'agentina-app-cache',
                private: true
            },
            null,
            2
        ),
        'utf-8'
    );
}

async function runInstallCommand(
    command: string,
    args: string[],
    cwd: string,
    commandRunner?: (command: string, args: string[], cwd: string) => Promise<void>
): Promise<void> {
    if (commandRunner) {
        await commandRunner(command, args, cwd);
        return;
    }

    try {
        await execFile(command, args, { cwd });
    } catch (error: any) {
        const stderr = error?.stderr ? String(error.stderr).trim() : '';
        const reason = stderr ? `: ${stderr}` : '';
        throw new Error(`Failed to install npm package with "${command} ${args.join(' ')}"${reason}`);
    }
}

async function readPackageVersion(installedPath: string): Promise<string | null> {
    const packageJsonPath = path.join(installedPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        return null;
    }
    try {
        const raw = await fsp.readFile(packageJsonPath, 'utf-8');
        const json = JSON.parse(raw) as { version?: unknown };
        return typeof json.version === 'string' ? json.version : null;
    } catch {
        return null;
    }
}

function sanitizePackageName(value: string): string {
    return value
        .replace(/^@/, 'scope-')
        .replace(/[\\/]/g, '__')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sanitizeSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}
