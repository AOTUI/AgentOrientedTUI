import { readFile } from 'fs/promises';
import type { SkillInfo, SkillScope } from './types.js';

export interface ParsedSkill {
    name: string;
    description: string;
    content: string;
}

function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
    const normalized = raw.replace(/^\uFEFF/, '');
    if (!normalized.startsWith('---\n')) {
        return { data: {}, content: normalized };
    }

    const end = normalized.indexOf('\n---\n', 4);
    if (end === -1) {
        return { data: {}, content: normalized };
    }

    const header = normalized.slice(4, end);
    const content = normalized.slice(end + 5);
    const data: Record<string, string> = {};

    for (const line of header.split('\n')) {
        const idx = line.indexOf(':');
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (!key) continue;
        data[key] = value;
    }

    return { data, content };
}

export async function parseSkillFile(filePath: string, scope: SkillScope): Promise<SkillInfo | null> {
    const raw = await readFile(filePath, 'utf-8');
    const { data, content } = parseFrontmatter(raw);
    const name = data.name?.trim();
    const description = data.description?.trim();

    if (!name || !description) {
        return null;
    }

    return {
        name,
        description,
        location: filePath,
        content: content.trim(),
        scope,
    };
}
