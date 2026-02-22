import React, { useState, useEffect } from 'react';
import { useChatBridge } from '../../../ChatBridge.js';
import { McpVisualEditor } from './McpVisualEditor.js';
import { McpJsonEditor } from './McpJsonEditor.js';
import { LoadingState } from '../LoadingState.js';

function toObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function normalizeServerEntry(entry: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = { ...entry };

    if (normalized.enabled === undefined && typeof normalized.disabled === 'boolean') {
        normalized.enabled = !normalized.disabled;
    }

    if (typeof normalized.command === 'string') {
        const args = Array.isArray(normalized.args)
            ? normalized.args.filter((arg: unknown): arg is string => typeof arg === 'string')
            : [];
        normalized.command = [normalized.command, ...args];
    }

    if (!normalized.type && Array.isArray(normalized.command)) {
        normalized.type = 'local';
    }

    if (!normalized.environment && normalized.env && typeof normalized.env === 'object') {
        normalized.environment = normalized.env;
    }

    return normalized;
}

function normalizeMcpConfig(input: unknown): Record<string, any> {
    const obj = toObject(input);
    const rawServers = toObject(obj.mcpServers ?? obj);

    const entries = Object.entries(rawServers)
        .filter(([, value]) => value && typeof value === 'object')
        .map(([name, value]) => [name, normalizeServerEntry(value as Record<string, any>)]);

    return Object.fromEntries(entries);
}

/**
 * MCP Tab Root Component
 */
export const McpTab: React.FC = () => {
    const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
    const [mcpConfig, setMcpConfig] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [savedBanner, setSavedBanner] = useState(false);

    const bridge = useChatBridge();

    const fetchConfig = async () => {
        try {
            const data = await bridge.getTrpcClient().mcp.getConfig.query();
            setMcpConfig(normalizeMcpConfig(data));
        } catch (err) {
            console.error('Failed to load MCP config:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleSave = async (updatedConfig: Record<string, any>) => {
        setIsSaving(true);
        setSavedBanner(false);
        const normalizedConfig = normalizeMcpConfig(updatedConfig);
        try {
            await bridge.getTrpcClient().mcp.updateConfig.mutate({ mcp: normalizedConfig });
            setMcpConfig(normalizedConfig); // Sync local state
            setSavedBanner(true);
            setTimeout(() => setSavedBanner(false), 3000);
        } catch (err) {
            console.error('[McpTab] Failed to save MCP config:', err);
            alert('Failed to save MCP configuration. Check the console for details.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <LoadingState message="Loading MCP Configurations..." size="md" />;
    }

    return (
        <div className="relative flex flex-col h-full min-h-0 gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                <div>
                    <h3 className="text-[13px] font-medium text-[var(--color-text-secondary)]">
                        Model Context Protocol Nodes
                    </h3>
                    <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
                        Connect external tools, databases, and capabilities to your LLM using MCP servers.
                    </p>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center mat-lg-regular rounded-full p-1 shadow-sm">
                    <button
                        onClick={() => setViewMode('visual')}
                        className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-colors ${viewMode === 'visual' ? 'bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-primary)] shadow-sm border border-[var(--mat-border)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                        Visual Form
                    </button>
                    <button
                        onClick={() => setViewMode('json')}
                        className={`px-3 py-1.5 text-[12px] font-medium rounded-full transition-colors ${viewMode === 'json' ? 'bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-primary)] shadow-sm border border-[var(--mat-border)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                        Raw JSON
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 relative mat-content rounded-[16px] overflow-hidden" style={{ transform: 'translateZ(0)' }}>
                {viewMode === 'visual' ? (
                    <McpVisualEditor
                        config={mcpConfig}
                        onChange={setMcpConfig}
                        onSave={handleSave}
                        isSaving={isSaving}
                        runtimeApi={{
                            getRuntime: () => bridge.getTrpcClient().mcp.getRuntime.query(),
                            setServerEnabled: (args) => bridge.getTrpcClient().mcp.setServerEnabled.mutate(args),
                            setToolEnabled: (args) => bridge.getTrpcClient().mcp.setToolEnabled.mutate(args),
                        }}
                    />
                ) : (
                    <McpJsonEditor
                        config={mcpConfig}
                        onSave={handleSave}
                        isSaving={isSaving}
                    />
                )}
            </div>
            {/* Save Success Banner */}
            {savedBanner && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-success)]/90 text-white text-[13px] shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    MCP config saved to ~/.tui/mcp.json
                </div>
            )}
        </div>
    );
};
