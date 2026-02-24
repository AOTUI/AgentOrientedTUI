import path from 'path';
import os from 'os';
import { Config } from '../config/config.js';

export interface SkillSourceSet {
    paths: string[];
    urls: string[];
}

export interface SkillSourcesByScope {
    global: SkillSourceSet;
    project: SkillSourceSet;
}

function normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function toAbsolutePath(raw: string, baseDir: string): string {
    const expanded = raw.startsWith('~/') ? path.join(os.homedir(), raw.slice(2)) : raw;
    return path.isAbsolute(expanded) ? expanded : path.join(baseDir, expanded);
}

function unique(items: string[]): string[] {
    return Array.from(new Set(items));
}

export async function resolveSkillSources(projectPath?: string): Promise<SkillSourcesByScope> {
    const globalConfig = await Config.getGlobal();
    const globalSkills = (globalConfig.skills ?? {}) as Record<string, unknown>;

    const globalPaths = unique([
        path.join(os.homedir(), '.tui', 'skills'),
        ...normalizeStringList(globalSkills.paths).map((entry) => toAbsolutePath(entry, os.homedir())),
    ]);
    const globalUrls = unique(normalizeStringList(globalSkills.urls));

    if (!projectPath) {
        return {
            global: { paths: globalPaths, urls: globalUrls },
            project: { paths: [], urls: [] },
        };
    }

    const projectConfig = await Config.getProject(projectPath);
    const projectSkills = (projectConfig.skills ?? {}) as Record<string, unknown>;

    const projectPaths = unique([
        path.join(projectPath, '.tui', 'skills'),
        ...normalizeStringList(projectSkills.paths).map((entry) => toAbsolutePath(entry, projectPath)),
    ]);
    const projectUrls = unique(normalizeStringList(projectSkills.urls));

    return {
        global: { paths: globalPaths, urls: globalUrls },
        project: { paths: projectPaths, urls: projectUrls },
    };
}
