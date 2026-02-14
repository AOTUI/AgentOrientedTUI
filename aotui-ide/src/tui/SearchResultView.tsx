import type { FileInfo } from '../types.js';

/**
 * SearchResultView Content
 * Child View - 搜索结果展示视图
 * 
 * 职责：
 * - 展示搜索结果列表（直接显示文件路径）
 * - 提供 close_search_view Tool
 * - 提供 open_search_result Tool（接受文件路径字符串）
 */
export function SearchResultView({
    searchQuery,
    results
}: {
    searchQuery: string;
    results: FileInfo[];
}) {
    return (
        <div data-role="view-content">
            <section>
                <h3>🔍 Search Results for: "{searchQuery}"</h3>
                <p>{results.length} file(s) found</p>
            </section>

            {results.length > 0 && (
                <section>
                    <h4>Files:</h4>
                    <ul>
                        {results.map((file, idx) => (
                            <li key={idx}>
                                {file.path}
                                {file.lastOpened && (
                                    <span style={{ color: '#666', marginLeft: '10px' }}>
                                        (last opened: {new Date(file.lastOpened).toLocaleString()})
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
