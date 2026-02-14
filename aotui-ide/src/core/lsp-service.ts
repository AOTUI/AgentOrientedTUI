import { LSP } from './lsp/index.js';
import { fileURLToPath } from 'url';
import type {
    HoverResult,
    LocationResult,
    Diagnostic,
    DocumentSymbol,
    CallHierarchyItem
} from '../types.js';
import { Instance } from './lsp/adapters.js';
import { EventEmitter } from 'events';

export type LSPServerStatus = {
    id: string;
    name: string;
    root: string;
    status: 'connected' | 'error' | 'starting';
};

/**
 * LSP Service
 * 
 * 集成 opencode LSP client，提供语言分析服务。
 * 负责将 IDE 的请求转发给底层的 Language Servers。
 */
class LSPService {
    private isInitialized = false;
    private eventEmitter = new EventEmitter();
    private workspacePath: string = '';

    constructor() {
        this.eventEmitter.setMaxListeners(50);
    }

    /**
     * 初始化 LSP 服务
     */
    async init(workspacePath: string) {
        if (this.isInitialized && this.workspacePath === workspacePath) {
            console.log('[LSPService] Already initialized with same workspace');
            return;
        }

        console.log('[LSPService] Initializing with workspace:', workspacePath);

        // 设置工作区目录 (来自 LSPManager 的逻辑)
        Instance.setDirectory(workspacePath);
        LSP.setWorkspace(workspacePath);
        this.workspacePath = workspacePath;

        try {
            // 初始化LSP状态
            await LSP.init();
            this.isInitialized = true;

            console.log('[LSPService] Initialization completed successfully');
            this.eventEmitter.emit('initialized', { workspacePath });
        } catch (error) {
            console.warn('[LSPService] Failed to initialize, LSP features will be disabled:', error);
            // ✅ 设置标志为 false,所有 LSP 方法返回空结果而非抛错
            this.isInitialized = false;
            this.eventEmitter.emit('error', error);
        }
    }

    /**
     * 关闭 LSP 服务
     */
    async shutdown(): Promise<void> {
        if (!this.isInitialized) {
            console.log('[LSPService] Not initialized, nothing to shutdown');
            return;
        }

        console.log('[LSPService] Shutting down');

        try {
            // 清理所有状态
            await Instance.cleanupAll();

            this.isInitialized = false;
            this.workspacePath = '';

            console.log('[LSPService] Shutdown complete');
            this.eventEmitter.emit('shutdown');
        } catch (error) {
            console.error('[LSPService] Shutdown error:', error);
            this.eventEmitter.emit('error', error);
        }
    }

    /**
     * 获取所有LSP服务器的状态
     */
    async getStatus(): Promise<LSPServerStatus[]> {
        if (!this.isInitialized) {
            return [];
        }

        try {
            const statuses = await LSP.status();
            return statuses.map((status: any) => ({
                id: status.id,
                name: status.name,
                root: status.root,
                status: status.status
            }));
        } catch (error) {
            console.error('[LSPService] Failed to get status:', error);
            return [];
        }
    }

    /**
     * 重启特定的LSP服务器
     */
    async restartServer(serverID: string): Promise<void> {
        console.log(`[LSPService] Restarting server: ${serverID}`);
        // TODO: 实现服务器重启逻辑
        throw new Error('restartServer not implemented yet');
    }

    /**
     * 监听事件
     */
    on(event: 'initialized' | 'shutdown' | 'error', handler: (...args: any[]) => void): void {
        this.eventEmitter.on(event, handler);
    }

    /**
     * 取消监听事件
     */
    off(event: 'initialized' | 'shutdown' | 'error', handler: (...args: any[]) => void): void {
        this.eventEmitter.off(event, handler);
    }

    /**
     * 触发一次性事件监听
     */
    once(event: 'initialized' | 'shutdown' | 'error', handler: (...args: any[]) => void): void {
        this.eventEmitter.once(event, handler);
    }

    /**
     * 检查 LSP 是否可用
     */
    async isAvailable(filePath: string): Promise<boolean> {
        if (!this.isInitialized) return false;
        return LSP.hasClients(filePath);
    }

    /**
     * 转换 DocumentSymbol 格式
     * 
     * LSP 可能返回两种格式:
     * 1. DocumentSymbol: 有 range, selectionRange, children
     * 2. SymbolInformation: 有 location.range, 无 children
     */
    private convertSymbol(s: any): DocumentSymbol {
        // 判断是否是 SymbolInformation 格式 (有 location 字段)
        const isSymbolInformation = s.location && s.location.range;

        if (isSymbolInformation) {
            // SymbolInformation 格式转换
            return {
                name: s.name,
                kind: s.kind,
                detail: s.detail,
                range: {
                    start: this.fromLspPosition(s.location.range.start),
                    end: this.fromLspPosition(s.location.range.end)
                },
                selectionRange: {
                    start: this.fromLspPosition(s.location.range.start),
                    end: this.fromLspPosition(s.location.range.end)
                },
                children: [] // SymbolInformation 没有 children
            };
        }

        // DocumentSymbol 格式转换
        return {
            name: s.name,
            kind: s.kind,
            detail: s.detail,
            range: {
                start: this.fromLspPosition(s.range.start),
                end: this.fromLspPosition(s.range.end)
            },
            selectionRange: {
                start: this.fromLspPosition(s.selectionRange?.start || s.range.start),
                end: this.fromLspPosition(s.selectionRange?.end || s.range.end)
            },
            children: s.children?.map((c: any) => this.convertSymbol(c)) || []
        };
    }

    private toLspPosition(line: number, character: number) {
        return { line: Math.max(0, line - 1), character: Math.max(0, character - 1) };
    }

    private fromLspPosition(pos: { line: number, character: number }) {
        return { line: pos.line + 1, character: pos.character + 1 };
    }

    // ==================== Document Features ====================

    async documentSymbol(filePath: string): Promise<DocumentSymbol[]> {
        if (!await this.isAvailable(filePath)) return [];

        await LSP.touchFile(filePath);

        // 注意：LSP.documentSymbol 需要 URI 格式
        const uri = `file://${filePath}`;
        const symbols = await LSP.documentSymbol(uri);

        return symbols.map(s => this.convertSymbol(s));
    }

    async workspaceSymbol(query: string): Promise<DocumentSymbol[]> {
        if (!this.isInitialized) return [];

        const symbols = await LSP.workspaceSymbol(query);
        return symbols.map(s => ({
            name: s.name,
            kind: s.kind,
            range: {
                start: this.fromLspPosition(s.location.range.start),
                end: this.fromLspPosition(s.location.range.end)
            },
            selectionRange: {
                start: this.fromLspPosition(s.location.range.start),
                end: this.fromLspPosition(s.location.range.end)
            },
            children: []
        }));
    }

    async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
        if (!this.isInitialized) return [];

        await LSP.touchFile(filePath);

        // Wait a bit for diagnostics to arrive? 
        // In real implementations, diagnostics come via events. 
        // Since we pull, we might miss them if we don't wait.
        // But for now, just return what we have.

        const allDiagnostics = await LSP.diagnostics();
        const fileDiagnostics = allDiagnostics[filePath] || [];

        return fileDiagnostics.map(d => ({
            message: d.message,
            range: {
                start: this.fromLspPosition(d.range.start),
                end: this.fromLspPosition(d.range.end)
            },
            line: d.range.start.line + 1,
            character: d.range.start.character + 1,
            severity: d.severity || 1,
            code: d.code,
            source: d.source
        }));
    }

    // ==================== Language Features ====================

    async hover(filePath: string, line: number, character: number): Promise<HoverResult> {
        if (!await this.isAvailable(filePath)) {
            return { line, character, content: '(LSP not available)' };
        }

        await LSP.touchFile(filePath);
        const lspPos = this.toLspPosition(line, character);

        const results = await LSP.hover({ file: filePath, ...lspPos });
        const result = results[0];

        if (!result || !(result as any).contents) {
            return { line, character, content: '' };
        }

        const contents = (result as any).contents;
        let content = '';

        if (typeof contents === 'string') {
            content = contents;
        } else if ('kind' in contents) {
            content = contents.value;
        } else if (Array.isArray(contents)) {
            content = contents.map((c: any) => typeof c === 'string' ? c : c.value).join('\n');
        }

        return { line, character, content };
    }

    async goToDefinition(filePath: string, line: number, character: number): Promise<LocationResult[]> {
        if (!await this.isAvailable(filePath)) return [];

        await LSP.touchFile(filePath);
        const lspPos = this.toLspPosition(line, character);

        const locations = await LSP.definition({ file: filePath, ...lspPos });

        return locations.map((loc: any) => ({
            filePath: fileURLToPath(loc.uri),
            uri: loc.uri,
            range: {
                start: this.fromLspPosition(loc.range.start),
                end: this.fromLspPosition(loc.range.end)
            }
        }));
    }

    async findReferences(filePath: string, line: number, character: number): Promise<LocationResult[]> {
        if (!await this.isAvailable(filePath)) return [];

        await LSP.touchFile(filePath);
        const lspPos = this.toLspPosition(line, character);

        const locations = await LSP.references({ file: filePath, ...lspPos });

        return locations.map((loc: any) => ({
            filePath: fileURLToPath(loc.uri),
            uri: loc.uri,
            range: {
                start: this.fromLspPosition(loc.range.start),
                end: this.fromLspPosition(loc.range.end)
            }
        }));
    }

    async goToImplementation(filePath: string, line: number, character: number): Promise<LocationResult[]> {
        if (!await this.isAvailable(filePath)) return [];

        await LSP.touchFile(filePath);
        const lspPos = this.toLspPosition(line, character);

        const locations = await LSP.implementation({ file: filePath, ...lspPos });

        return locations.map((loc: any) => ({
            filePath: fileURLToPath(loc.uri),
            uri: loc.uri,
            range: {
                start: this.fromLspPosition(loc.range.start),
                end: this.fromLspPosition(loc.range.end)
            }
        }));
    }

    async incomingCalls(filePath: string, line: number, character: number): Promise<CallHierarchyItem[]> {
        if (!await this.isAvailable(filePath)) return [];

        await LSP.touchFile(filePath);
        const lspPos = this.toLspPosition(line, character);

        const items = await LSP.incomingCalls({ file: filePath, ...lspPos });

        return items.map((item: any) => ({
            name: item.from.name,
            kind: item.from.kind,
            detail: item.from.detail,
            uri: item.from.uri,
            range: {
                start: this.fromLspPosition(item.from.range.start),
                end: this.fromLspPosition(item.from.range.end)
            },
            selectionRange: {
                start: this.fromLspPosition(item.from.selectionRange.start),
                end: this.fromLspPosition(item.from.selectionRange.end)
            },
            fromRanges: item.fromRanges.map((r: any) => ({
                start: this.fromLspPosition(r.start),
                end: this.fromLspPosition(r.end)
            })) // map range
        }));
    }

    async outgoingCalls(filePath: string, line: number, character: number): Promise<CallHierarchyItem[]> {
        if (!await this.isAvailable(filePath)) return [];

        await LSP.touchFile(filePath);
        const lspPos = this.toLspPosition(line, character);

        const items = await LSP.outgoingCalls({ file: filePath, ...lspPos });

        return items.map((item: any) => ({
            name: item.to.name,
            kind: item.to.kind,
            detail: item.to.detail,
            uri: item.to.uri,
            range: {
                start: this.fromLspPosition(item.to.range.start),
                end: this.fromLspPosition(item.to.range.end)
            },
            selectionRange: {
                start: this.fromLspPosition(item.to.selectionRange.start),
                end: this.fromLspPosition(item.to.selectionRange.end)
            },
            fromRanges: item.fromRanges.map((r: any) => ({
                start: this.fromLspPosition(r.start),
                end: this.fromLspPosition(r.end)
            }))
        }));
    }
}

export const lspService = new LSPService();
