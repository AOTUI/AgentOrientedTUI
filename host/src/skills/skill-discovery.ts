import path from 'path';
import os from 'os';
import { mkdir, access, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { Logger } from '../utils/logger.js';

interface SkillIndexEntry {
    name: string;
    files: string[];
}

interface SkillIndex {
    skills: SkillIndexEntry[];
}

function isValidIndex(payload: unknown): payload is SkillIndex {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const skills = (payload as Record<string, unknown>).skills;
    if (!Array.isArray(skills)) {
        return false;
    }

    return skills.every((entry) => {
        if (!entry || typeof entry !== 'object') {
            return false;
        }
        const name = (entry as Record<string, unknown>).name;
        const files = (entry as Record<string, unknown>).files;
        return typeof name === 'string' && Array.isArray(files) && files.every((f) => typeof f === 'string');
    });
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

function cacheRootFor(baseUrl: string): string {
    const hash = createHash('sha256').update(baseUrl).digest('hex').slice(0, 16);
    return path.join(os.homedir(), '.tui', 'cache', 'skills', hash);
}

export class SkillDiscovery {
    private logger = new Logger('SkillDiscovery');

    async pull(url: string): Promise<string[]> {
        const result: string[] = [];
        const base = url.endsWith('/') ? url : `${url}/`;
        const indexUrl = new URL('index.json', base).href;

        let payload: unknown;
        try {
            const response = await fetch(indexUrl);
            if (!response.ok) {
                this.logger.warn('Failed to fetch remote skill index', { indexUrl, status: response.status });
                return result;
            }
            payload = await response.json();
        } catch (error) {
            this.logger.warn('Failed to load remote skill index', {
                indexUrl,
                error: error instanceof Error ? error.message : String(error),
            });
            return result;
        }

        if (!isValidIndex(payload)) {
            this.logger.warn('Invalid remote skill index format', { indexUrl });
            return result;
        }

        const root = cacheRootFor(base);
        for (const skill of payload.skills) {
            const skillRoot = path.join(root, skill.name);
            for (const relativeFile of skill.files) {
                const remoteFileUrl = new URL(relativeFile, `${base}${skill.name}/`).href;
                const destination = path.join(skillRoot, relativeFile);
                await mkdir(path.dirname(destination), { recursive: true });

                if (!(await fileExists(destination))) {
                    try {
                        const response = await fetch(remoteFileUrl);
                        if (!response.ok) {
                            this.logger.warn('Failed to fetch remote skill file', {
                                remoteFileUrl,
                                status: response.status,
                            });
                            continue;
                        }

                        const content = await response.text();
                        await writeFile(destination, content, 'utf-8');
                    } catch (error) {
                        this.logger.warn('Failed to download remote skill file', {
                            remoteFileUrl,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
            }

            const skillFile = path.join(skillRoot, 'SKILL.md');
            if (await fileExists(skillFile)) {
                result.push(skillRoot);
            }
        }

        return result;
    }
}
