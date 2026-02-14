/**
 * 文件信息（最近打开的文件）
 */
export interface FileInfo {
    path: string;
    lastOpened: number;
}

/**
 * 文件内容（最后读取的文件）
 */
export interface FileContent {
    path: string;
    content: string;
}

/**
 * 编辑操作（用于 batch_edit）
 */
export interface EditTool {
    filePath: string;
    oldString: string;
    newString: string;
}

/**
 * 目录列表选项
 */
export interface ListDirectoryOptions {
    ignore?: string[];
}

/**
 * 文件读取选项
 */
export interface ReadFileOptions {
    offset?: number;
    limit?: number;
}

// ==================== LSP Types ====================

/**
 * 文档符号（类、方法、函数、变量）
 */
export interface DocumentSymbol {
    name: string;
    kind: number;
    detail?: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    selectionRange: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    children?: DocumentSymbol[];
}

export interface HoverResult {
    line: number;
    character: number;
    content: string;
}

export interface LocationResult {
    filePath: string;
    uri?: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    preview?: string;
}

export interface Diagnostic {
    line?: number;
    character?: number;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    severity: number | 'error' | 'warning' | 'info' | 'hint';
    code?: string | number;
    message: string;
    source?: string;
}

export interface CallHierarchyItem {
    name: string;
    kind: number;
    detail?: string;
    uri: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    selectionRange: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    // 兼容旧定义，用于 UI 显示调用关系
    fromRanges?: Array<{ line: number; character: number }>;
}

export type LspEventStatus = 'success' | 'error';

export type LspEventSource = 'manual' | 'auto';

export type LspRequestLocation = {
    line: number;
    character: number;
};

export interface LspEventBase {
    filePath: string;
    viewId?: string;
    status: LspEventStatus;
    error?: string;
    updatedAt: number;
    request?: LspRequestLocation;
    operationName?: string;
    resultCount?: number;
    source?: LspEventSource;
}

export interface LspHoverEvent extends LspEventBase {
    data?: HoverResult;
}

export interface LspDefinitionEvent extends LspEventBase {
    data?: LocationResult[];
}

export interface LspReferencesEvent extends LspEventBase {
    data?: LocationResult[];
}

export interface LspDocumentSymbolEvent extends LspEventBase {
    data?: DocumentSymbol[];
}

export interface LspIncomingCallsEvent extends LspEventBase {
    data?: CallHierarchyItem[];
}

export interface LspOutgoingCallsEvent extends LspEventBase {
    data?: CallHierarchyItem[];
}

export interface LspDiagnosticsEvent extends LspEventBase {
    data?: Diagnostic[];
}

export type AppEvents = {
    file_changed: { filePath: string };
    file_renamed: { oldPath: string; newPath: string };
    open_files_updated: {};
    expand_dirs: { dirPaths: string[] };
    collapse_dirs: { dirPaths: string[] };
    refresh_workspace: {};
    lsp_hover_result: LspHoverEvent;
    lsp_definition_result: LspDefinitionEvent;
    lsp_references_result: LspReferencesEvent;
    lsp_document_symbol_result: LspDocumentSymbolEvent;
    lsp_incoming_calls_result: LspIncomingCallsEvent;
    lsp_outgoing_calls_result: LspOutgoingCallsEvent;
    lsp_diagnostics_result: LspDiagnosticsEvent;
};
