import { useState, useEffect, View } from '@aotui/sdk';
import type Emittery from 'emittery';
import { lspService, fileSystemService } from '../core/index.js';
import type { Diagnostic, AppEvents, HoverResult, LocationResult, DocumentSymbol, CallHierarchyItem, LspEventSource } from '../types.js';

type LspState<T> = {
    status: 'idle' | 'success' | 'error';
    data?: T;
    error?: string;
    updatedAt?: number;
    request?: { line: number; character: number };
    operationName?: string;
    resultCount?: number;
    source?: LspEventSource;
};

type LspOperationRecord = {
    operationName: string;
    status: 'success' | 'error';
    filePath: string;
    viewId?: string;
    request?: { line: number; character: number };
    updatedAt?: number;
    resultCount?: number;
    error?: string;
    source?: LspEventSource;
};

/**
 * FileDetailView Content
 * Child View - 单文件 LSP 深度分析视图
 */
export function FileDetailView({
    viewId,
    filePath,
    eventBus,
    onClose
}: {
    viewId: string;
    filePath: string;
    eventBus: Emittery<AppEvents>;
    onClose: () => void;
}) {
    const fileName = filePath.split('/').pop() || filePath;

    return (
        <View
            id={viewId}
            type="FileDetail"
            name={`File: ${fileName}`}
            onClose={onClose}
        >
            <FileDetailContent initialFilePath={filePath} eventBus={eventBus} />
        </View>
    );
}

export function FileDetailContent({
    initialFilePath,
    eventBus
}: {
    initialFilePath: string;
    eventBus: Emittery<AppEvents>;
}) {
    // ==================== State 管理 ====================

    const [currentFile, setCurrentFile] = useState<{ path: string }>({ path: initialFilePath });
    const [fileContent, setFileContent] = useState<string>('Loading file...');
    const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
    const [hoverState, setHoverState] = useState<LspState<HoverResult>>({ status: 'idle' });
    const [definitionState, setDefinitionState] = useState<LspState<LocationResult[]>>({ status: 'idle' });
    const [referencesState, setReferencesState] = useState<LspState<LocationResult[]>>({ status: 'idle' });
    const [symbolsState, setSymbolsState] = useState<LspState<DocumentSymbol[]>>({ status: 'idle' });
    const [incomingCallsState, setIncomingCallsState] = useState<LspState<CallHierarchyItem[]>>({ status: 'idle' });
    const [outgoingCallsState, setOutgoingCallsState] = useState<LspState<CallHierarchyItem[]>>({ status: 'idle' });
    const [diagnosticsState, setDiagnosticsState] = useState<LspState<Diagnostic[]>>({ status: 'idle' });
    const [lastOperation, setLastOperation] = useState<LspOperationRecord | null>(null);
    const [operationLog, setOperationLog] = useState<LspOperationRecord[]>([]);
    const maxLogSize = 8;

    const formatTimestamp = (ts?: number) => (ts ? new Date(ts).toLocaleString() : 'N/A');
    const getResultCountFromData = (data?: unknown) => {
        if (Array.isArray(data)) return data.length;
        return data ? 1 : 0;
    };
    const renderMeta = (state: LspState<unknown>) => {
        const request = state.request ? `line ${state.request.line}, col ${state.request.character}` : 'N/A';
        const resultCount = typeof state.resultCount === 'number' ? state.resultCount : getResultCountFromData(state.data);
        const source = state.source ? ` | Source: ${state.source}` : '';
        return (
            <p>Request: {request} | Updated: {formatTimestamp(state.updatedAt)} | Results: {resultCount}{source}</p>
        );
    };
    const buildOperationRecord = (payload: LspState<unknown> & { filePath: string; viewId?: string }) => {
        const resultCount = typeof payload.resultCount === 'number' ? payload.resultCount : getResultCountFromData(payload.data);
        return {
            operationName: payload.operationName || 'unknown',
            status: payload.status,
            filePath: payload.filePath,
            viewId: payload.viewId,
            request: payload.request,
            updatedAt: payload.updatedAt,
            resultCount,
            error: payload.error,
            source: payload.source
        } as LspOperationRecord;
    };
    const pushOperationRecord = (record: LspOperationRecord) => {
        setLastOperation(record);
        setOperationLog(prev => [record, ...prev].slice(0, maxLogSize));
    };
    // ==================== 自动加载文件 ====================

    useEffect(() => {
        async function loadFile() {
            try {
                const content = await fileSystemService.readFile(currentFile.path);
                setFileContent(content);

                // 自动获取诊断信息
                const diags = await lspService.getDiagnostics(currentFile.path);
                setDiagnostics(diags);
                const updatedAt = Date.now();
                setDiagnosticsState({
                    status: 'success',
                    data: diags,
                    updatedAt,
                    operationName: 'lsp_get_diagnostics',
                    resultCount: diags.length,
                    source: 'auto'
                });
                pushOperationRecord({
                    operationName: 'lsp_get_diagnostics',
                    status: 'success',
                    filePath: currentFile.path,
                    updatedAt,
                    resultCount: diags.length,
                    source: 'auto'
                });
            } catch (error) {
                console.error('[FileDetailContent] Load error:', error);
                setFileContent(`Error loading file: ${(error as Error).message}`);
                const updatedAt = Date.now();
                const message = (error as Error).message;
                setDiagnosticsState({
                    status: 'error',
                    error: message,
                    updatedAt,
                    operationName: 'lsp_get_diagnostics',
                    resultCount: 0,
                    source: 'auto'
                });
                pushOperationRecord({
                    operationName: 'lsp_get_diagnostics',
                    status: 'error',
                    filePath: currentFile.path,
                    updatedAt,
                    resultCount: 0,
                    error: message,
                    source: 'auto'
                });
            }
        }

        loadFile();
    }, [currentFile.path]);

    useEffect(() => {
        setHoverState({ status: 'idle' });
        setDefinitionState({ status: 'idle' });
        setReferencesState({ status: 'idle' });
        setSymbolsState({ status: 'idle' });
        setIncomingCallsState({ status: 'idle' });
        setOutgoingCallsState({ status: 'idle' });
        setLastOperation(null);
        setOperationLog([]);
    }, [currentFile.path]);

    const renderSymbols = (symbols: DocumentSymbol[]) => (
        <ul>
            {symbols.map((symbol, idx) => (
                <li key={idx}>
                    {symbol.name} (kind {symbol.kind})
                    {symbol.children && symbol.children.length > 0 && renderSymbols(symbol.children)}
                </li>
            ))}
        </ul>
    );

    // ==================== EventBus 监听 ====================

    // 监听文件变更事件
    useEffect(() => {
        const handleFileChanged = async (e: { filePath: string }) => {
            if (e.filePath === currentFile.path) {
                console.log(`[FileDetailContent] File changed: ${e.filePath}, reloading...`);
                try {
                    const content = await fileSystemService.readFile(currentFile.path);
                    setFileContent(content);

                    // 同时刷新诊断信息
                    const diags = await lspService.getDiagnostics(currentFile.path);
                    setDiagnostics(diags);
                    const updatedAt = Date.now();
                    setDiagnosticsState({
                        status: 'success',
                        data: diags,
                        updatedAt,
                        operationName: 'lsp_get_diagnostics',
                        resultCount: diags.length,
                        source: 'auto'
                    });
                    pushOperationRecord({
                        operationName: 'lsp_get_diagnostics',
                        status: 'success',
                        filePath: currentFile.path,
                        updatedAt,
                        resultCount: diags.length,
                        source: 'auto'
                    });
                } catch (error) {
                    console.error('[FileDetailContent] Reload error:', error);
                    const updatedAt = Date.now();
                    const message = (error as Error).message;
                    setDiagnosticsState({
                        status: 'error',
                        error: message,
                        updatedAt,
                        operationName: 'lsp_get_diagnostics',
                        resultCount: 0,
                        source: 'auto'
                    });
                    pushOperationRecord({
                        operationName: 'lsp_get_diagnostics',
                        status: 'error',
                        filePath: currentFile.path,
                        updatedAt,
                        resultCount: 0,
                        error: message,
                        source: 'auto'
                    });
                }
            }
        };

        eventBus.on('file_changed', handleFileChanged);
        return () => {
            eventBus.off('file_changed', handleFileChanged);
        };
    }, [currentFile.path, eventBus]);

    // 监听文件重命名事件
    useEffect(() => {
        const handleFileRenamed = (e: { oldPath: string; newPath: string }) => {
            if (e.oldPath === currentFile.path) {
                console.log(`[FileDetailContent] File renamed: ${e.oldPath} -> ${e.newPath}`);
                setCurrentFile({ path: e.newPath });
            }
        };

        eventBus.on('file_renamed', handleFileRenamed);
        return () => {
            eventBus.off('file_renamed', handleFileRenamed);
        };
    }, [currentFile.path, eventBus]);

    useEffect(() => {
        const handleHover = (e: AppEvents['lsp_hover_result']) => {
            if (e.filePath === currentFile.path) {
                setHoverState(e);
                pushOperationRecord(buildOperationRecord(e));
            }
        };

        const handleDefinition = (e: AppEvents['lsp_definition_result']) => {
            if (e.filePath === currentFile.path) {
                setDefinitionState(e);
                pushOperationRecord(buildOperationRecord(e));
            }
        };

        const handleReferences = (e: AppEvents['lsp_references_result']) => {
            if (e.filePath === currentFile.path) {
                setReferencesState(e);
                pushOperationRecord(buildOperationRecord(e));
            }
        };

        const handleSymbols = (e: AppEvents['lsp_document_symbol_result']) => {
            if (e.filePath === currentFile.path) {
                setSymbolsState(e);
                pushOperationRecord(buildOperationRecord(e));
            }
        };

        const handleIncomingCalls = (e: AppEvents['lsp_incoming_calls_result']) => {
            if (e.filePath === currentFile.path) {
                setIncomingCallsState(e);
                pushOperationRecord(buildOperationRecord(e));
            }
        };

        const handleOutgoingCalls = (e: AppEvents['lsp_outgoing_calls_result']) => {
            if (e.filePath === currentFile.path) {
                setOutgoingCallsState(e);
                pushOperationRecord(buildOperationRecord(e));
            }
        };

        const handleDiagnostics = (e: AppEvents['lsp_diagnostics_result']) => {
            if (e.filePath === currentFile.path) {
                setDiagnosticsState(e);
                if (e.status === 'success' && e.data) {
                    setDiagnostics(e.data);
                }
                pushOperationRecord(buildOperationRecord(e));
            }
        };

        eventBus.on('lsp_hover_result', handleHover);
        eventBus.on('lsp_definition_result', handleDefinition);
        eventBus.on('lsp_references_result', handleReferences);
        eventBus.on('lsp_document_symbol_result', handleSymbols);
        eventBus.on('lsp_incoming_calls_result', handleIncomingCalls);
        eventBus.on('lsp_outgoing_calls_result', handleOutgoingCalls);
        eventBus.on('lsp_diagnostics_result', handleDiagnostics);

        return () => {
            eventBus.off('lsp_hover_result', handleHover);
            eventBus.off('lsp_definition_result', handleDefinition);
            eventBus.off('lsp_references_result', handleReferences);
            eventBus.off('lsp_document_symbol_result', handleSymbols);
            eventBus.off('lsp_incoming_calls_result', handleIncomingCalls);
            eventBus.off('lsp_outgoing_calls_result', handleOutgoingCalls);
            eventBus.off('lsp_diagnostics_result', handleDiagnostics);
        };
    }, [currentFile.path, eventBus]);

    // ==================== UI 渲染辅助 ====================

    const renderLatestResultContent = () => {
        if (!lastOperation || lastOperation.status !== 'success') return null;

        switch (lastOperation.operationName) {
            case 'lsp_hover':
                return hoverState.data ? (
                    <div className="result-preview">
                        <h4>Preview: Hover</h4>
                        <pre>{hoverState.data.content}</pre>
                    </div>
                ) : null;
            case 'lsp_definition':
                return definitionState.data ? (
                    <div className="result-preview">
                        <h4>Preview: Definition ({definitionState.data.length})</h4>
                        <ul>
                            {definitionState.data.map((loc, idx) => (
                                <li key={idx}>{loc.filePath}:{loc.range.start.line}</li>
                            ))}
                        </ul>
                    </div>
                ) : null;
            case 'lsp_references':
                return referencesState.data ? (
                    <div className="result-preview">
                        <h4>Preview: References ({referencesState.data.length})</h4>
                        <ul>
                            {referencesState.data.slice(0, 5).map((loc, idx) => (
                                <li key={idx}>{loc.filePath}:{loc.range.start.line}</li>
                            ))}
                            {referencesState.data.length > 5 && <li>...and {referencesState.data.length - 5} more</li>}
                        </ul>
                    </div>
                ) : null;
            case 'lsp_document_symbol':
                 return symbolsState.data ? (
                    <div className="result-preview">
                        <h4>Preview: Symbols ({symbolsState.data.length})</h4>
                         <p>(See Document Symbols section for tree view)</p>
                    </div>
                ) : null;
             case 'lsp_incoming_calls':
                return incomingCallsState.data ? (
                    <div className="result-preview">
                        <h4>Preview: Incoming Calls ({incomingCallsState.data.length})</h4>
                        <ul>
                            {incomingCallsState.data.map((call, idx) => (
                                <li key={idx}>{call.name} (line {call.range.start.line})</li>
                            ))}
                        </ul>
                    </div>
                ) : null;
            case 'lsp_outgoing_calls':
                return outgoingCallsState.data ? (
                    <div className="result-preview">
                        <h4>Preview: Outgoing Calls ({outgoingCallsState.data.length})</h4>
                         <ul>
                            {outgoingCallsState.data.map((call, idx) => (
                                <li key={idx}>{call.name} (line {call.range.start.line})</li>
                            ))}
                        </ul>
                    </div>
                ) : null;
            default:
                return null;
        }
    };

    // ==================== UI 渲染 ====================

    return (
        <>
            {/* View Content */}
            <div data-role="view-content">
                {/* 文件路径 */}
                <section>
                    <h3>📄 File: {currentFile.path}</h3>
                </section>

                <section>
                    <h3>🧩 LSP Summary</h3>
                    {lastOperation ? (
                        <>
                            <ul>
                                <li>Operation: {lastOperation.operationName}</li>
                                <li>Status: {lastOperation.status}</li>
                                <li>Results: {lastOperation.resultCount ?? 0}</li>
                                <li>Updated: {formatTimestamp(lastOperation.updatedAt)}</li>
                                {lastOperation.error && <li>Error: {lastOperation.error}</li>}
                            </ul>
                            {/* Latest Result Preview */}
                            {renderLatestResultContent()}
                        </>
                    ) : (
                        <p>No LSP operations yet</p>
                    )}
                </section>

                <section>
                    <h3>🧾 LSP Operation Log</h3>
                    {operationLog.length === 0 ? (
                        <p>No operations</p>
                    ) : (
                        <ol>
                            {operationLog.map((record, idx) => (
                                <li key={idx}>
                                    {record.operationName} | {record.status} | {record.resultCount ?? 0} results | {formatTimestamp(record.updatedAt)}
                                </li>
                            ))}
                        </ol>
                    )}
                </section>

                {/* Only show sections with content or active state */}
                
                {diagnosticsState.status !== 'idle' && (
                    <section>
                        <h3>⚠️ Diagnostics</h3>
                        {diagnosticsState.status === 'error' && <p>Error: {diagnosticsState.error}</p>}
                        {diagnosticsState.status === 'success' && (
                            <>
                                {diagnostics.length > 0 ? (
                                    <ul>
                                        {diagnostics.map((diag, idx) => {
                                            const severityText = typeof diag.severity === 'number' ?
                                                (diag.severity === 1 ? 'ERROR' : diag.severity === 2 ? 'WARN' : 'INFO') :
                                                diag.severity.toUpperCase();

                                            return (
                                                <li key={idx}>
                                                    [{severityText}] line {diag.line}, col {diag.character}: {diag.message}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p>No diagnostics</p>
                                )}
                            </>
                        )}
                    </section>
                )}

                {hoverState.status !== 'idle' && (
                    <section>
                        <h3>🔍 Hover</h3>
                        {hoverState.status === 'error' && <p>Error: {hoverState.error}</p>}
                        {hoverState.status === 'success' && hoverState.data && (
                            <>
                                {hoverState.request && (
                                    <p>Line {hoverState.request.line}, Col {hoverState.request.character}</p>
                                )}
                                <pre>{hoverState.data.content}</pre>
                            </>
                        )}
                    </section>
                )}

                {definitionState.status !== 'idle' && (
                    <section>
                        <h3>📍 Definition</h3>
                        {definitionState.status === 'error' && <p>Error: {definitionState.error}</p>}
                        {definitionState.status === 'success' && (
                            <>
                                {definitionState.data && definitionState.data.length > 0 ? (
                                    <ul>
                                        {definitionState.data.map((loc, idx) => (
                                            <li key={idx}>
                                                {loc.filePath} (line {loc.range.start.line}, col {loc.range.start.character})
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No results</p>
                                )}
                            </>
                        )}
                    </section>
                )}

                {referencesState.status !== 'idle' && (
                    <section>
                        <h3>🔗 References</h3>
                        {referencesState.status === 'error' && <p>Error: {referencesState.error}</p>}
                        {referencesState.status === 'success' && (
                            <>
                                {referencesState.data && referencesState.data.length > 0 ? (
                                    <ul>
                                        {referencesState.data.map((loc, idx) => (
                                            <li key={idx}>
                                                {loc.filePath} (line {loc.range.start.line}, col {loc.range.start.character})
                                                {loc.preview && <pre>{loc.preview}</pre>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No results</p>
                                )}
                            </>
                        )}
                    </section>
                )}

                {symbolsState.status !== 'idle' && (
                    <section>
                        <h3>🧭 Document Symbols</h3>
                        {symbolsState.status === 'error' && <p>Error: {symbolsState.error}</p>}
                        {symbolsState.status === 'success' && (
                            <>
                                {symbolsState.data && symbolsState.data.length > 0 ? (
                                    renderSymbols(symbolsState.data)
                                ) : (
                                    <p>No results</p>
                                )}
                            </>
                        )}
                    </section>
                )}

                {incomingCallsState.status !== 'idle' && (
                    <section>
                        <h3>📞 Incoming Calls</h3>
                        {incomingCallsState.status === 'error' && <p>Error: {incomingCallsState.error}</p>}
                        {incomingCallsState.status === 'success' && (
                            <>
                                {incomingCallsState.data && incomingCallsState.data.length > 0 ? (
                                    <ul>
                                        {incomingCallsState.data.map((call, idx) => (
                                            <li key={idx}>
                                                {call.name} ({call.uri}) line {call.range.start.line}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No results</p>
                                )}
                            </>
                        )}
                    </section>
                )}

                {outgoingCallsState.status !== 'idle' && (
                    <section>
                        <h3>📲 Outgoing Calls</h3>
                        {outgoingCallsState.status === 'error' && <p>Error: {outgoingCallsState.error}</p>}
                        {outgoingCallsState.status === 'success' && (
                            <>
                                {outgoingCallsState.data && outgoingCallsState.data.length > 0 ? (
                                    <ul>
                                        {outgoingCallsState.data.map((call, idx) => (
                                            <li key={idx}>
                                                {call.name} ({call.uri}) line {call.range.start.line}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No results</p>
                                )}
                            </>
                        )}
                    </section>
                )}

                {/* 文件内容 */}
                <section>
                    <h3>📝 File Content ({fileContent.split('\n').length} lines)</h3>
                    <pre>{fileContent}</pre>
                </section>

            </div>
        </>
    );
}
