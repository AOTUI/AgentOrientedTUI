import path from 'path';
import os from 'os';

export const DEFAULT_TAIL_LINES = 50;

export type CdParseResult = {
    isCd: boolean;
    target?: string;
};

export function parseCdCommand(command: string): CdParseResult {
    const match = command.trim().match(/^cd(?:\s+(.+))?$/);
    if (!match) {
        return { isCd: false };
    }
    const target = match[1]?.trim();
    return { isCd: true, target: target === '' ? undefined : target };
}

export function hasChainedCd(command: string): boolean {
    const trimmed = command.trim();
    const parsed = parseCdCommand(trimmed);
    if (parsed.isCd) {
        const target = parsed.target ?? '';
        if (/(&&|\|\||;|\|)/.test(target)) {
            return true;
        }
        return false;
    }
    return /\bcd\b/.test(trimmed);
}

export function normalizePath(input: string): string {
    return path.resolve(input);
}

export function isPathWithinProject(projectPath: string, candidatePath: string): boolean {
    const project = normalizePath(projectPath);
    const candidate = normalizePath(candidatePath);
    if (candidate === project) {
        return true;
    }
    return candidate.startsWith(project + path.sep);
}

export function resolveNextCwd(currentCwd: string, projectPath: string, target?: string): string {
    if (!target) {
        return normalizePath(projectPath);
    }
    if (target === '~') {
        return normalizePath(os.homedir());
    }
    if (target.startsWith('~/')) {
        return normalizePath(path.join(os.homedir(), target.slice(2)));
    }
    return normalizePath(path.resolve(currentCwd, target));
}

export function splitLines(chunk: string): string[] {
    return chunk.replace(/\r\n/g, '\n').split('\n').filter(line => line.length > 0);
}
