import path from 'path';
import { readdir } from 'fs/promises';
import { Logger } from '../utils/logger.js';
import { parseSkillFile } from './skill-parser.js';
import type { SkillInfo } from './types.js';
import { resolveSkillSources } from './skill-config.js';
import { SkillDiscovery } from './skill-discovery.js';

async function walkSkillFiles(root: string): Promise<string[]> {
    const result: string[] = [];

    const visit = async (dir: string) => {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }

        await Promise.all(entries.map(async (entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await visit(full);
                return;
            }
            if (entry.isFile() && entry.name === 'SKILL.md') {
                result.push(full);
            }
        }));
    };

    await visit(root);
    return result;
}

export interface SkillCatalogOptions {
    projectPath?: string;
}

export class SkillCatalogService {
    private logger = new Logger('SkillCatalogService');
    private discovery = new SkillDiscovery();
    private cache: SkillInfo[] | null = null;

    constructor(private options: SkillCatalogOptions = {}) { }

    async listSkills(): Promise<SkillInfo[]> {
        if (this.cache) {
            return this.cache;
        }

        const byName = new Map<string, SkillInfo>();
        const sources = await resolveSkillSources(this.options.projectPath);

        const applySkill = (skill: SkillInfo) => {
            const existing = byName.get(skill.name);
            if (!existing) {
                byName.set(skill.name, skill);
                return;
            }

            if (existing.scope === 'global' && skill.scope === 'project') {
                this.logger.warn('Project skill overrides global skill', {
                    name: skill.name,
                    global: existing.location,
                    project: skill.location,
                });
                byName.set(skill.name, skill);
                return;
            }

            if (existing.scope === skill.scope) {
                this.logger.warn('Duplicate skill in same scope, overriding by last discovered', {
                    name: skill.name,
                    previous: existing.location,
                    next: skill.location,
                    scope: skill.scope,
                });
                byName.set(skill.name, skill);
            }
        };

        const loadFrom = async (dir: string, scope: 'global' | 'project') => {
            const files = await walkSkillFiles(dir);
            for (const file of files) {
                try {
                    const parsed = await parseSkillFile(file, scope);
                    if (!parsed) {
                        this.logger.warn('Invalid SKILL.md, missing required frontmatter fields', { file });
                        continue;
                    }
                    applySkill(parsed);
                } catch (error) {
                    this.logger.warn('Failed to parse skill file', {
                        file,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        };

        const loadFromRemote = async (url: string, scope: 'global' | 'project') => {
            const roots = await this.discovery.pull(url);
            for (const root of roots) {
                await loadFrom(root, scope);
            }
        };

        for (const dir of sources.global.paths) {
            await loadFrom(dir, 'global');
        }
        for (const url of sources.global.urls) {
            await loadFromRemote(url, 'global');
        }

        for (const dir of sources.project.paths) {
            await loadFrom(dir, 'project');
        }
        for (const url of sources.project.urls) {
            await loadFromRemote(url, 'project');
        }

        this.cache = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
        return this.cache;
    }

    async getSkill(name: string): Promise<SkillInfo | undefined> {
        const all = await this.listSkills();
        return all.find((skill) => skill.name === name);
    }

    invalidate(): void {
        this.cache = null;
    }
}
