import path from 'path';
import os from 'os';

export interface SkillSourceSet {
    paths: string[];
}

export interface SkillSourcesByScope {
    global: SkillSourceSet;
    project: SkillSourceSet;
}

export function getGlobalSkillsDir(): string {
    return path.join(os.homedir(), '.tui', 'agent', 'skills');
}

export function getProjectSkillsDir(projectPath: string): string {
    return path.join(projectPath, '.agent', 'skills');
}

export async function resolveSkillSources(projectPath?: string): Promise<SkillSourcesByScope> {
    const globalPaths = [getGlobalSkillsDir()];

    if (!projectPath) {
        return {
            global: { paths: globalPaths },
            project: { paths: [] },
        };
    }

    const projectPaths = [
        getProjectSkillsDir(projectPath),
    ];

    return {
        global: { paths: globalPaths },
        project: { paths: projectPaths },
    };
}
