import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import type { ListDirectoryOptions, ReadFileOptions } from '../types.js';

interface IncrementalListOptions extends ListDirectoryOptions {
    /** 已展开的目录路径集合（绝对路径） */
    expandedDirs?: Set<string>;
    /** 是否显示展开标记 */
    showExpandedMark?: boolean;
    /** 是否显示 tree 线条 */
    showTreeLines?: boolean;
}

type Replacer = (content: string, find: string) => Generator<string, void, unknown>;

const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD = 0.0;
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD = 0.3;

function levenshtein(a: string, b: string): number {
    if (a === '' || b === '') {
        return Math.max(a.length, b.length);
    }

    const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[a.length][b.length];
}

const simpleReplacer: Replacer = function* (_content, find) {
    yield find;
};

const lineTrimmedReplacer: Replacer = function* (content, find) {
    const originalLines = content.split('\n');
    const searchLines = find.split('\n');

    if (searchLines[searchLines.length - 1] === '') {
        searchLines.pop();
    }

    for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
        let matches = true;

        for (let j = 0; j < searchLines.length; j++) {
            const originalTrimmed = originalLines[i + j].trim();
            const searchTrimmed = searchLines[j].trim();

            if (originalTrimmed !== searchTrimmed) {
                matches = false;
                break;
            }
        }

        if (matches) {
            let matchStartIndex = 0;
            for (let k = 0; k < i; k++) {
                matchStartIndex += originalLines[k].length + 1;
            }

            let matchEndIndex = matchStartIndex;
            for (let k = 0; k < searchLines.length; k++) {
                matchEndIndex += originalLines[i + k].length;
                if (k < searchLines.length - 1) {
                    matchEndIndex += 1;
                }
            }

            yield content.substring(matchStartIndex, matchEndIndex);
        }
    }
};

const blockAnchorReplacer: Replacer = function* (content, find) {
    const originalLines = content.split('\n');
    const searchLines = find.split('\n');

    if (searchLines.length < 3) {
        return;
    }

    if (searchLines[searchLines.length - 1] === '') {
        searchLines.pop();
    }

    const firstLineSearch = searchLines[0].trim();
    const lastLineSearch = searchLines[searchLines.length - 1].trim();
    const searchBlockSize = searchLines.length;

    const candidates: Array<{ startLine: number; endLine: number }> = [];
    for (let i = 0; i < originalLines.length; i++) {
        if (originalLines[i].trim() !== firstLineSearch) {
            continue;
        }

        for (let j = i + 2; j < originalLines.length; j++) {
            if (originalLines[j].trim() === lastLineSearch) {
                candidates.push({ startLine: i, endLine: j });
                break;
            }
        }
    }

    if (candidates.length === 0) {
        return;
    }

    if (candidates.length === 1) {
        const { startLine, endLine } = candidates[0];
        const actualBlockSize = endLine - startLine + 1;

        let similarity = 0;
        const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2);

        if (linesToCheck > 0) {
            for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
                const originalLine = originalLines[startLine + j].trim();
                const searchLine = searchLines[j].trim();
                const maxLen = Math.max(originalLine.length, searchLine.length);
                if (maxLen === 0) {
                    continue;
                }
                const distance = levenshtein(originalLine, searchLine);
                similarity += (1 - distance / maxLen) / linesToCheck;

                if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
                    break;
                }
            }
        } else {
            similarity = 1.0;
        }

        if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
            let matchStartIndex = 0;
            for (let k = 0; k < startLine; k++) {
                matchStartIndex += originalLines[k].length + 1;
            }
            let matchEndIndex = matchStartIndex;
            for (let k = startLine; k <= endLine; k++) {
                matchEndIndex += originalLines[k].length;
                if (k < endLine) {
                    matchEndIndex += 1;
                }
            }
            yield content.substring(matchStartIndex, matchEndIndex);
        }
        return;
    }

    let bestMatch: { startLine: number; endLine: number } | null = null;
    let maxSimilarity = -1;

    for (const candidate of candidates) {
        const { startLine, endLine } = candidate;
        const actualBlockSize = endLine - startLine + 1;

        let similarity = 0;
        const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2);

        if (linesToCheck > 0) {
            for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
                const originalLine = originalLines[startLine + j].trim();
                const searchLine = searchLines[j].trim();
                const maxLen = Math.max(originalLine.length, searchLine.length);
                if (maxLen === 0) {
                    continue;
                }
                const distance = levenshtein(originalLine, searchLine);
                similarity += 1 - distance / maxLen;
            }
            similarity /= linesToCheck;
        } else {
            similarity = 1.0;
        }

        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            bestMatch = candidate;
        }
    }

    if (maxSimilarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD && bestMatch) {
        const { startLine, endLine } = bestMatch;
        let matchStartIndex = 0;
        for (let k = 0; k < startLine; k++) {
            matchStartIndex += originalLines[k].length + 1;
        }
        let matchEndIndex = matchStartIndex;
        for (let k = startLine; k <= endLine; k++) {
            matchEndIndex += originalLines[k].length;
            if (k < endLine) {
                matchEndIndex += 1;
            }
        }
        yield content.substring(matchStartIndex, matchEndIndex);
    }
};

const whitespaceNormalizedReplacer: Replacer = function* (content, find) {
    const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();
    const normalizedFind = normalizeWhitespace(find);

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (normalizeWhitespace(line) === normalizedFind) {
            yield line;
        } else {
            const normalizedLine = normalizeWhitespace(line);
            if (normalizedLine.includes(normalizedFind)) {
                const words = find.trim().split(/\s+/);
                if (words.length > 0) {
                    const pattern = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
                    try {
                        const regex = new RegExp(pattern);
                        const match = line.match(regex);
                        if (match) {
                            yield match[0];
                        }
                    } catch {
                        // Ignore invalid regex patterns
                    }
                }
            }
        }
    }

    const findLines = find.split('\n');
    if (findLines.length > 1) {
        for (let i = 0; i <= lines.length - findLines.length; i++) {
            const block = lines.slice(i, i + findLines.length);
            if (normalizeWhitespace(block.join('\n')) === normalizedFind) {
                yield block.join('\n');
            }
        }
    }
};

const indentationFlexibleReplacer: Replacer = function* (content, find) {
    const removeIndentation = (text: string) => {
        const lines = text.split('\n');
        const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
        if (nonEmptyLines.length === 0) return text;

        const minIndent = Math.min(
            ...nonEmptyLines.map((line) => {
                const match = line.match(/^(\s*)/);
                return match ? match[1].length : 0;
            })
        );

        return lines.map((line) => (line.trim().length === 0 ? line : line.slice(minIndent))).join('\n');
    };

    const normalizedFind = removeIndentation(find);
    const contentLines = content.split('\n');
    const findLines = find.split('\n');

    for (let i = 0; i <= contentLines.length - findLines.length; i++) {
        const block = contentLines.slice(i, i + findLines.length).join('\n');
        if (removeIndentation(block) === normalizedFind) {
            yield block;
        }
    }
};

const escapeNormalizedReplacer: Replacer = function* (content, find) {
    const unescapeString = (str: string): string => {
        return str.replace(/\\(n|t|r|'|"|`|\\|\n|\$)/g, (match, capturedChar) => {
            switch (capturedChar) {
                case 'n':
                    return '\n';
                case 't':
                    return '\t';
                case 'r':
                    return '\r';
                case "'":
                    return "'";
                case '"':
                    return '"';
                case '`':
                    return '`';
                case '\\':
                    return '\\';
                case '\n':
                    return '\n';
                case '$':
                    return '$';
                default:
                    return match;
            }
        });
    };

    const unescapedFind = unescapeString(find);

    if (content.includes(unescapedFind)) {
        yield unescapedFind;
    }

    const lines = content.split('\n');
    const findLines = unescapedFind.split('\n');

    for (let i = 0; i <= lines.length - findLines.length; i++) {
        const block = lines.slice(i, i + findLines.length).join('\n');
        const unescapedBlock = unescapeString(block);

        if (unescapedBlock === unescapedFind) {
            yield block;
        }
    }
};

const multiOccurrenceReplacer: Replacer = function* (content, find) {
    let startIndex = 0;

    while (true) {
        const index = content.indexOf(find, startIndex);
        if (index === -1) break;

        yield find;
        startIndex = index + find.length;
    }
};

const trimmedBoundaryReplacer: Replacer = function* (content, find) {
    const trimmedFind = find.trim();

    if (trimmedFind === find) {
        return;
    }

    if (content.includes(trimmedFind)) {
        yield trimmedFind;
    }

    const lines = content.split('\n');
    const findLines = find.split('\n');

    for (let i = 0; i <= lines.length - findLines.length; i++) {
        const block = lines.slice(i, i + findLines.length).join('\n');

        if (block.trim() === trimmedFind) {
            yield block;
        }
    }
};

const contextAwareReplacer: Replacer = function* (content, find) {
    const findLines = find.split('\n');
    if (findLines.length < 3) {
        return;
    }

    if (findLines[findLines.length - 1] === '') {
        findLines.pop();
    }

    const contentLines = content.split('\n');
    const firstLine = findLines[0].trim();
    const lastLine = findLines[findLines.length - 1].trim();

    for (let i = 0; i < contentLines.length; i++) {
        if (contentLines[i].trim() !== firstLine) continue;

        for (let j = i + 2; j < contentLines.length; j++) {
            if (contentLines[j].trim() === lastLine) {
                const blockLines = contentLines.slice(i, j + 1);
                const block = blockLines.join('\n');

                if (blockLines.length === findLines.length) {
                    let matchingLines = 0;
                    let totalNonEmptyLines = 0;

                    for (let k = 1; k < blockLines.length - 1; k++) {
                        const blockLine = blockLines[k].trim();
                        const findLine = findLines[k].trim();

                        if (blockLine.length > 0 || findLine.length > 0) {
                            totalNonEmptyLines++;
                            if (blockLine === findLine) {
                                matchingLines++;
                            }
                        }
                    }

                    if (totalNonEmptyLines === 0 || matchingLines / totalNonEmptyLines >= 0.5) {
                        yield block;
                        break;
                    }
                }
                break;
            }
        }
    }
};

function applyEditReplacement(content: string, oldString: string, newString: string, replaceAll = false): string {
    if (oldString === newString) {
        throw new Error('No changes to apply: oldString and newString are identical.');
    }

    let notFound = true;

    for (const replacer of [
        simpleReplacer,
        lineTrimmedReplacer,
        blockAnchorReplacer,
        whitespaceNormalizedReplacer,
        indentationFlexibleReplacer,
        escapeNormalizedReplacer,
        trimmedBoundaryReplacer,
        contextAwareReplacer,
        multiOccurrenceReplacer,
    ]) {
        for (const search of replacer(content, oldString)) {
            const index = content.indexOf(search);
            if (index === -1) continue;
            notFound = false;
            if (replaceAll) {
                return content.replaceAll(search, newString);
            }
            const lastIndex = content.lastIndexOf(search);
            if (index !== lastIndex) continue;
            return content.substring(0, index) + newString + content.substring(index + search.length);
        }
    }

    if (notFound) {
        throw new Error('Could not find oldString in the file. It must match exactly, including whitespace, indentation, and line endings.');
    }

    throw new Error('Found multiple matches for oldString. Provide more surrounding context to make the match unique.');
}

/**
 * 文件系统服务
 * 封装所有文件操作，Worker Thread 可直接访问 Node.js fs 模块
 */
export const fileSystemService = {
    /**
     * 列出目录结构（类似 tree 命令）
     * 
     * @param rootPath 根目录路径
     * @param options 选项
     * @param options.ignore 忽略的目录/文件名列表
     * @param options.expandedDirs 已展开的目录路径集合（支持增量展开）
     * @param options.showExpandedMark 是否显示 (expanded) 标记
     */
    async listDirectory(rootPath: string, options: IncrementalListOptions = {}): Promise<string> {
        const ignore = options.ignore || [];
        const expandedDirs = options.expandedDirs;
        const showExpandedMark = options.showExpandedMark ?? false;
        const showTreeLines = options.showTreeLines ?? false;
        const lines: string[] = [];

        async function walk(dir: string, prefix: string = ''): Promise<void> {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                const filtered = entries.filter(entry => !ignore.includes(entry.name));

                for (let index = 0; index < filtered.length; index++) {
                    const entry = filtered[index];
                    const isLast = index === filtered.length - 1;

                    const fullPath = path.join(dir, entry.name);
                    const isDirectory = entry.isDirectory();
                    const connector = showTreeLines ? (isLast ? '└── ' : '├── ') : '';
                    const childPrefix = showTreeLines ? `${prefix}${isLast ? '    ' : '│   '}` : `${prefix}  `;

                    if (isDirectory) {
                        const isExpanded = expandedDirs ? expandedDirs.has(fullPath) : true;
                        const mark = showExpandedMark && isExpanded ? ' (expanded)' : '';
                        const displayName = `${entry.name}/${mark}`;
                        lines.push(`${prefix}${connector}${displayName}`);

                        // 如果提供了 expandedDirs，只展开已标记的目录
                        // 如果没有提供，全部展开（默认行为）
                        if (!expandedDirs || isExpanded) {
                            await walk(fullPath, childPrefix);
                        }
                    } else {
                        lines.push(`${prefix}${connector}${entry.name}`);
                    }
                }
            } catch (error) {
                // 权限问题或其他错误，记录并继续
                console.error(`[FileSystemService] Error reading directory ${dir}:`, error);
            }
        }

        await walk(rootPath);
        return lines.join('\n');
    },

    /**
     * glob 搜索文件
     */
    async searchByPattern(pattern: string, cwd: string): Promise<string[]> {
        try {
            const results = await glob(pattern, {
                cwd,
                absolute: true,
                ignore: [
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/build/**',
                    '**/coverage/**',
                    '**/.git/**',
                    '**/.next/**',
                    '**/.turbo/**',
                    '**/out/**'
                ]
            });
            return results;
        } catch (error) {
            console.error(`[FileSystemService] Error searching by pattern "${pattern}":`, error);
            return [];
        }
    },

    /**
     * grep 搜索文件内容
     * 简化实现：遍历所有文件，查找匹配的行
     */
    async searchByContent(pattern: string, cwd: string, include?: string): Promise<string[]> {
        try {
            // 1. 使用 glob 找到所有文件
            const globPattern = include || '**/*';
            const files = await glob(globPattern, {
                cwd,
                absolute: true,
                nodir: true,
                ignore: [
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/build/**',
                    '**/coverage/**',
                    '**/.git/**',
                    '**/.next/**',
                    '**/.turbo/**',
                    '**/out/**'
                ]
            });

            const matchedFiles: string[] = [];
            const regex = new RegExp(pattern);

            // 2. 遍历文件，查找匹配的内容
            for (const file of files) {
                try {
                    const content = await fs.readFile(file, 'utf-8');
                    if (regex.test(content)) {
                        matchedFiles.push(file);
                    }
                } catch (error) {
                    // 跳过无法读取的文件（二进制文件、权限问题等）
                    continue;
                }
            }

            return matchedFiles;
        } catch (error) {
            console.error(`[FileSystemService] Error searching by content "${pattern}":`, error);
            return [];
        }
    },

    /**
     * 读取文件内容（带行号）
     * 同时触发LSP touchFile以获取诊断信息
     */
    async readFile(filePath: string, options: ReadFileOptions = {}): Promise<string> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            const start = options.offset || 0;
            const end = Math.min(start + (options.limit || 2000), lines.length);

            const numberedLines = lines
                .slice(start, end)
                .map((line: string, idx: number) => {
                    const lineNumber = start + idx + 1;
                    return `${String(lineNumber).padStart(5, '0')}| ${line}`;
                });

            const result = numberedLines.join('\n');
            const totalLines = lines.length;
            const suffix = end < totalLines ? `\n\n(Showing lines ${start + 1}-${end} of ${totalLines})` : `\n\n(End of file - total ${totalLines} lines)`;

            // 触发LSP touchFile（异步，不阻塞返回）
            this._touchFileForLSP(filePath).catch(err => {
                console.warn('[FileSystemService] LSP touchFile failed:', err);
            });

            return result + suffix;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                throw new Error(`File not found: ${filePath}`);
            }
            throw error;
        }
    },
    async exists(filePath: string): Promise<boolean> {
        try {
            await fs.stat(filePath);
            return true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    },

    /**
     * 内部方法：触发LSP touchFile
     * @private
     */
    async _touchFileForLSP(filePath: string): Promise<void> {
        try {
            // 动态导入避免循环依赖
            const { LSP } = await import('./lsp/index.js');
            const { lspService } = await import('./lsp-service.js');

            // 检查 LSP 是否可用（包含初始化状态和 Clients 检查）
            if (!await lspService.isAvailable(filePath)) {
                return;
            }

            // 触发touchFile（不等待诊断）
            await LSP.touchFile(filePath, false);
        } catch (error) {
            // 静默失败，不影响文件读取
            console.debug('[FileSystemService] LSP touchFile error:', error);
        }
    },

    /**
     * 写入文件（自动创建父目录）
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        try {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8');
        } catch (error) {
            throw new Error(`Failed to write file "${filePath}": ${(error as Error).message}`);
        }
    },

    /**
     * 编辑文件（精确替换）
     */
    async editFile(filePath: string, oldString: string, newString: string, replaceAll: boolean = false): Promise<void> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');

            const newContent = applyEditReplacement(content, oldString, newString, replaceAll);

            await fs.writeFile(filePath, newContent, 'utf-8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                throw new Error(`File not found: ${filePath}`);
            }
            throw error;
        }
    },

    /**
     * 创建文件
     */
    async createFile(filePath: string, content: string): Promise<void> {
        // 检查文件是否已存在
        try {
            await fs.access(filePath);
            throw new Error(`File already exists: ${filePath}`);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }

        // 创建文件
        await this.writeFile(filePath, content);
    },

    /**
     * 删除文件
     */
    async deleteFile(filePath: string): Promise<void> {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                throw new Error(`File not found: ${filePath}`);
            }
            throw error;
        }
    },

    /**
     * 重命名/移动文件
     */
    async renameFile(oldPath: string, newPath: string): Promise<void> {
        try {
            // 确保目标目录存在
            const dir = path.dirname(newPath);
            await fs.mkdir(dir, { recursive: true });

            await fs.rename(oldPath, newPath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                throw new Error(`File not found: ${oldPath}`);
            }
            throw error;
        }
    },
};
