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

            const newContent = replaceAll
                ? content.replaceAll(oldString, newString)
                : content.replace(oldString, newString);

            if (newContent === content) {
                throw new Error(`No match found for "${oldString.substring(0, 50)}" in file "${filePath}"`);
            }

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
