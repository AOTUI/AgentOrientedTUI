import { describe, it, expect } from 'vitest';
import os from 'os';
import path from 'path';
import { parseInstallSource, parseNpmSpecifier } from './sources.js';

describe('parseNpmSpecifier', () => {
    it('parses unscoped package', () => {
        const parsed = parseNpmSpecifier('weather-app');
        expect(parsed.packageName).toBe('weather-app');
        expect(parsed.version).toBeNull();
    });

    it('parses unscoped package with version', () => {
        const parsed = parseNpmSpecifier('weather-app@1.2.3');
        expect(parsed.packageName).toBe('weather-app');
        expect(parsed.version).toBe('1.2.3');
    });

    it('parses scoped package with version', () => {
        const parsed = parseNpmSpecifier('@aotui/weather@beta');
        expect(parsed.packageName).toBe('@aotui/weather');
        expect(parsed.version).toBe('beta');
    });

    it('throws for invalid package name', () => {
        expect(() => parseNpmSpecifier('Invalid Package Name')).toThrowError();
    });
});

describe('parseInstallSource', () => {
    it('resolves local relative path', () => {
        const cwd = path.join(os.tmpdir(), 'aotui-test');
        const parsed = parseInstallSource('./app', cwd);
        expect(parsed.kind).toBe('local');
        if (parsed.kind !== 'local') return;
        expect(parsed.absolutePath).toBe(path.resolve(cwd, './app'));
        expect(parsed.source).toBe(`local:${path.resolve(cwd, './app')}`);
    });

    it('keeps npm source with prefix', () => {
        const parsed = parseInstallSource('npm:@aotui/weather@1.0.0');
        expect(parsed.kind).toBe('npm');
        if (parsed.kind !== 'npm') return;
        expect(parsed.packageName).toBe('@aotui/weather');
        expect(parsed.version).toBe('1.0.0');
    });

    it('treats scoped package as npm source', () => {
        const parsed = parseInstallSource('@aotui/weather');
        expect(parsed.kind).toBe('npm');
        if (parsed.kind !== 'npm') return;
        expect(parsed.packageName).toBe('@aotui/weather');
    });

    it('rejects git source currently', () => {
        expect(() => parseInstallSource('git:github:user/repo')).toThrowError();
    });
});
