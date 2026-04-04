import { useState, useEffect } from '@aotui/sdk';
import path from 'path';
import type Emittery from 'emittery';
import type { AppEvents } from '../types.js';
import { fileSystemService } from '../core/index.js';

/**
 * WorkspaceView Content
 * Root View - 永久挂载，提供文件浏览功能
 * 支持 multi-folder workspace：为每个 folder 渲染独立的目录树
 */
export function WorkspaceContent({
    workspaceFolders,
    activeFiles,
    expandedDirs,
    eventBus
}: {
    workspaceFolders: string[];
    activeFiles: string[];
    expandedDirs: Set<string>;
    eventBus: Emittery<AppEvents>;
}) {
    // ==================== State 管理 ====================

    // 每个 folder 各自的目录树
    const [folderTrees, setFolderTrees] = useState<Map<string, string>>(new Map());

    // ==================== 自动加载 ====================

    // 监听 workspaceFolders 和 expandedDirs 变化，重新构建目录树
    useEffect(() => {
        async function init() {
            const nextTrees = new Map<string, string>();

            for (const folder of workspaceFolders) {
                try {
                    const tree = await fileSystemService.listDirectory(folder, {
                        ignore: ['node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'coverage'],
                        expandedDirs,
                        showExpandedMark: true,
                        showTreeLines: true
                    });

                    const treeOutput = tree ? `.\n${tree}` : '.';
                    nextTrees.set(folder, treeOutput);
                } catch (error) {
                    console.error(`[WorkspaceContent] Error loading directory tree for ${folder}:`, error);
                    nextTrees.set(folder, `Error: ${(error as Error).message}`);
                }
            }

            setFolderTrees(nextTrees);
        }

        init();
    }, [workspaceFolders, expandedDirs]);

    return (
        <div data-role="view-content">
            {workspaceFolders.length === 0 ? (
                <section>
                    <h3>📁 No Workspace Folders</h3>
                    <p>Use <strong>add_folder_to_workspace</strong> tool to add a project directory.</p>
                </section>
            ) : (
                workspaceFolders.map((folder, index) => (
                    <section key={folder}>
                        <h3>📁 [{index}] {path.basename(folder)}</h3>
                        <p>Path: {folder}</p>
                        <pre>{folderTrees.get(folder) ?? 'Loading...'}</pre>
                    </section>
                ))
            )}

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
