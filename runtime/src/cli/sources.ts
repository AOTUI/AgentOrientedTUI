import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

export interface NpmSpecifier {
    packageName: string;
    version: string | null;
    packageSpec: string;
}

export type ParsedInstallSource = ParsedLocalSource | ParsedNpmSource;

export interface ParsedLocalSource {
    kind: 'local';
    source: string;
    absolutePath: string;
}

export interface ParsedNpmSource {
    kind: 'npm';
    source: string;
    packageName: string;
    version: string | null;
    packageSpec: string;
}

export function parseInstallSource(input: string, cwd: string = process.cwd()): ParsedInstallSource {
    const value = input.trim();
    if (!value) {
        throw new Error('Install source is required');
    }

    if (value.startsWith('git:')) {
        throw new Error('git source is not supported yet. Use npm package or local path');
    }

    if (value.startsWith('local:')) {
        const localPath = value.slice('local:'.length);
        return parseLocalSource(localPath, cwd);
    }

    if (value.startsWith('file://')) {
        const absolutePath = fileURLToPath(value);
        return {
            kind: 'local',
            source: `local:${absolutePath}`,
            absolutePath
        };
    }

    if (value.startsWith('npm:')) {
        const npm = parseNpmSpecifier(value.slice('npm:'.length));
        return {
            kind: 'npm',
            source: `npm:${npm.packageSpec}`,
            packageName: npm.packageName,
            version: npm.version,
            packageSpec: npm.packageSpec
        };
    }

    if (looksLikeLocalPath(value)) {
        return parseLocalSource(value, cwd);
    }

    const npm = parseNpmSpecifier(value);
    return {
        kind: 'npm',
        source: `npm:${npm.packageSpec}`,
        packageName: npm.packageName,
        version: npm.version,
        packageSpec: npm.packageSpec
    };
}

function parseLocalSource(localPathInput: string, cwd: string): ParsedLocalSource {
    const expanded = expandHomePath(localPathInput.trim());
    const absolutePath = path.isAbsolute(expanded)
        ? expanded
        : path.resolve(cwd, expanded);

    return {
        kind: 'local',
        source: `local:${absolutePath}`,
        absolutePath
    };
}

export function parseNpmSpecifier(raw: string): NpmSpecifier {
    const spec = raw.trim();
    if (!spec) {
        throw new Error('npm package spec cannot be empty');
    }

    if (spec.startsWith('@')) {
        const slashIndex = spec.indexOf('/');
        if (slashIndex <= 1) {
            throw new Error(`Invalid scoped npm package spec: ${raw}`);
        }
        const atAfterScope = spec.lastIndexOf('@');
        if (atAfterScope > slashIndex) {
            const packageName = spec.slice(0, atAfterScope);
            const version = spec.slice(atAfterScope + 1);
            validatePackageName(packageName, raw);
            return {
                packageName,
                version: version || null,
                packageSpec: version ? `${packageName}@${version}` : packageName
            };
        }
        validatePackageName(spec, raw);
        return {
            packageName: spec,
            version: null,
            packageSpec: spec
        };
    }

    const atIndex = spec.lastIndexOf('@');
    if (atIndex > 0) {
        const packageName = spec.slice(0, atIndex);
        const version = spec.slice(atIndex + 1);
        validatePackageName(packageName, raw);
        return {
            packageName,
            version: version || null,
            packageSpec: version ? `${packageName}@${version}` : packageName
        };
    }

    validatePackageName(spec, raw);
    return {
        packageName: spec,
        version: null,
        packageSpec: spec
    };
}

export function looksLikeLocalPath(value: string): boolean {
    if (!value) return false;
    if (value.startsWith('.') || value.startsWith('/') || value.startsWith('~')) return true;
    if (/^[a-zA-Z]:[\\/]/.test(value)) return true;
    if (value.startsWith('file://')) return true;
    if (value.startsWith('@')) return false;
    if (fs.existsSync(value)) return true;
    return false;
}

function expandHomePath(input: string): string {
    if (!input.startsWith('~')) {
        return input;
    }
    return path.join(os.homedir(), input.slice(1));
}

function validatePackageName(name: string, raw: string): void {
    const npmNamePattern = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    if (!npmNamePattern.test(name)) {
        throw new Error(`Invalid npm package name in spec "${raw}"`);
    }
}
