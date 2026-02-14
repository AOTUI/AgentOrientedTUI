import { describe, expect, it } from 'vitest';
import {
    hasChainedCd,
    isPathWithinProject,
    parseCdCommand,
    resolveNextCwd
} from '../src/core/terminal-utils.js';

describe('terminal utils', () => {
    it('parses cd commands', () => {
        expect(parseCdCommand('cd src').isCd).toBe(true);
        expect(parseCdCommand('cd src').target).toBe('src');
        expect(parseCdCommand('cd').isCd).toBe(true);
        expect(parseCdCommand('ls -la').isCd).toBe(false);
    });

    it('detects chained cd usage', () => {
        expect(hasChainedCd('cd src && ls')).toBe(true);
        expect(hasChainedCd('echo cd')).toBe(true);
        expect(hasChainedCd('cd src')).toBe(false);
    });

    it('enforces project path boundaries', () => {
        const projectPath = '/Users/demo/project';
        expect(isPathWithinProject(projectPath, '/Users/demo/project')).toBe(true);
        expect(isPathWithinProject(projectPath, '/Users/demo/project/src')).toBe(true);
        expect(isPathWithinProject(projectPath, '/Users/demo/other')).toBe(false);
    });

    it('resolves next cwd relative to current', () => {
        const projectPath = '/Users/demo/project';
        const current = '/Users/demo/project/packages';
        expect(resolveNextCwd(current, projectPath, '..')).toBe('/Users/demo/project');
        expect(resolveNextCwd(current, projectPath, 'src')).toBe('/Users/demo/project/packages/src');
        expect(resolveNextCwd(current, projectPath, undefined)).toBe('/Users/demo/project');
    });
});
