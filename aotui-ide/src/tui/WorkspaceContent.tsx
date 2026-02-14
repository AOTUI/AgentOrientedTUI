import { useState, useEffect } from '@aotui/sdk';
import path from 'path';
import type Emittery from 'emittery';
import type { AppEvents } from '../types.js';
import { fileSystemService } from '../core/index.js';

/**
 * WorkspaceView Content
 * Root View - 永久挂载，提供文件浏览、搜索、读写功能
 */
export function WorkspaceContent({
    workspacePath,
    activeFiles,
    expandedDirs,
    eventBus
}: {
    workspacePath: string;
    activeFiles: string[];
    expandedDirs: Set<string>;
    eventBus: Emittery<AppEvents>;
}) {
    // ==================== State 管理 ====================

    // 目录树 - 使用 props 传入的 expandedDirs (State Lifted)
    const [directoryTree, setDirectoryTree] = useState<string>('Loading directory tree...');

    // ==================== 自动加载 ====================

    // 监听 expandedDirs 变化，重新构建目录树
    useEffect(() => {
        async function init() {
            try {
                // ✅ 使用 fileSystemService 替代直接 fs 调用
                const tree = await fileSystemService.listDirectory(workspacePath, {
                    ignore: ['node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'coverage'],
                    expandedDirs,           // ← 传递展开的目录集合
                    showExpandedMark: true, // ← 显示 (expanded) 标记
                    showTreeLines: true
                });

                const treeOutput = tree ? `.\n${tree}` : '.';
                setDirectoryTree(treeOutput);

            } catch (error) {
                console.error('[WorkspaceContent] Initialization error:', error);
                setDirectoryTree(`Error loading directory: ${(error as Error).message}`);
            }
        }

        init();
    }, [workspacePath, expandedDirs]); // ← 依赖 expandedDirs，确保状态变化时重新构建




    return (
        <div data-role="view-content">
            <section>
                <h3>📁 Directory Tree</h3>
                <p>Project Path: {workspacePath}</p>
                <pre>{directoryTree}</pre>
            </section>

            {activeFiles.length > 0 && (
                <section>
                    <h3>📂 Opened Files</h3>
                    <ul>
                        {activeFiles.map((filePath, idx) => (
                            <li key={idx}>
                                {filePath}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
};

export default WorkspaceContent;
