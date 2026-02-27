import React, { useRef, useEffect } from 'react';
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody } from "@heroui/card";
import { IconPlay, IconPause, IconAgentSleeping, IconAgentIdle, IconAgentWorking, IconAgentPaused, IconApps, IconSkills, IconPlug, IconBrain, IconPrompt, IconWrench } from './Icons.js';
import { EmptyState } from './EmptyState.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import type { Message } from '../../types.js';

export type DisplayAgentState = 'sleeping' | 'idle' | 'working' | 'paused';

type CapabilityItem = {
    name: string;
    enabled: boolean;
    scope?: 'global' | 'project';
};

type CapabilityGroup = {
    enabled: boolean;
    items: CapabilityItem[];
};

type TopicCapabilities = {
    mcp: {
        enabled: boolean;
        groups: Array<{
            key: string;
            serverName: string;
            enabled: boolean;
            connected: boolean;
            items: Array<{ key: string; name: string; enabled: boolean }>;
        }>;
    };
    skill: CapabilityGroup;
    apps: CapabilityGroup;
};

interface ChatAreaProps {
    messages: Message[];
    agentThinking: string;
    agentReasoning: string;
    onSendMessage: (content: string) => void;
    canSendMessage?: boolean;
    sendBlockedReason?: string | null;
    onOpenSettings?: (tab?: 'model' | 'agent' | 'prompt' | 'theme' | 'apps' | 'mcp' | 'skills') => void;
    displayAgentState?: DisplayAgentState;
    onPauseAgent?: () => void;
    onResumeAgent?: () => void;
    topicCapabilities?: TopicCapabilities | null;
    onToggleCapabilityGroup?: (source: 'apps' | 'mcp' | 'skill', enabled: boolean) => void;
    onToggleCapabilityItem?: (source: 'apps' | 'mcp' | 'skill', itemName: string, enabled: boolean) => void;
    capabilityHint?: string | null;
    modelGroups?: Array<{ providerId: string; models: string[]; displayName?: string }>;
    selectedModel?: string | null;
    onSelectModel?: (modelId: string) => void;
    promptTemplates?: Array<{ id: string; name: string; content: string }>;
    topicPrompt?: string | null;
    onChangeTopicPrompt?: (prompt: string) => void;
    onApplyPromptTemplate?: (templateId: string) => void;
    agents?: Array<{ id: string; name: string; skin?: any }>;
    selectedAgentId?: string | null;
    onSelectAgent?: (agentId: string | null) => void;
}

type ToolTraceStep = {
    toolCallId?: string;
    toolName: string;
    status: 'called' | 'success' | 'error';
    args?: unknown;
    result?: unknown;
    isError?: boolean;
};

// A tool round pairs a tool call with its result
type ToolRound = {
    toolCallId?: string;
    toolName: string;
    callArgs?: unknown;
    result?: unknown;
    status: 'pending' | 'success' | 'error';  // pending = call only, success/error = has result
    isLatest: boolean;  // whether this is the latest round
};

type TraceItem =
    | { kind: 'reasoning'; text: string }
    | { kind: 'text'; text: string }
    | { kind: 'tool'; step: ToolTraceStep }  // Internal format during collection
    | { kind: 'toolRound'; round: ToolRound };  // Final format after pairing

// Max length for a single parameter before truncation
const MAX_PARAM_LENGTH = 500;

/**
 * Safely stringify any value to a string.
 * Handles edge cases where JSON.stringify returns undefined:
 * - undefined values
 * - Symbol values
 * - Function values
 * - Circular references (throws error, caught here)
 */
const safeStringify = (value: unknown, indent: number | string = 2): string => {
    if (value === undefined) {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'symbol') {
        return value.toString();
    }
    if (typeof value === 'function') {
        return `[Function: ${value.name || 'anonymous'}]`;
    }
    try {
        const result = JSON.stringify(value, null, indent);
        // JSON.stringify returns undefined for undefined, Symbol, and functions
        // But we already handled those cases above, so this is extra safety
        return result === undefined ? 'undefined' : result;
    } catch (error) {
        // Handle circular references and other stringify errors
        if (error instanceof TypeError && error.message.includes('circular')) {
            return '[Circular Reference]';
        }
        return `[Unable to stringify: ${error instanceof Error ? error.message : String(error)}]`;
    }
};

// Truncate a single parameter value
const truncateSingleValue = (value: unknown, maxLength: number = MAX_PARAM_LENGTH): string => {
    if (value === undefined || value === null) {
        return '';
    }
    
    const str = typeof value === 'string' ? value : safeStringify(value);
    
    if (str.length <= maxLength) {
        return str;
    }
    
    return str.slice(0, maxLength) + '\n... (truncated)';
};

// Truncate parameters by key - only truncate long params, keep short ones intact
const truncateValue = (value: unknown, maxLength: number = MAX_PARAM_LENGTH): string => {
    // If it's a string, truncate directly
    if (typeof value === 'string') {
        return truncateSingleValue(value, maxLength);
    }
    
    if (value === undefined || value === null) {
        return '';
    }
    
    // If it's an object with keys, truncate each key's value independently
    if (typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        
        for (const [key, val] of Object.entries(obj)) {
            // Use safeStringify to handle all edge cases
            const valStr = typeof val === 'string' ? val : safeStringify(val);
            if (valStr.length > maxLength) {
                result[key] = valStr.slice(0, maxLength) + '\n... (truncated)';
            } else {
                result[key] = val;
            }
        }
        
        return JSON.stringify(result, null, 2);
    }
    
    // For arrays or other types, use simple truncation
    return truncateSingleValue(value, maxLength);
};

const hasMeaningfulPayload = (value: unknown): boolean => {
    if (value === undefined || value === null) {
        return false;
    }
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return true;
};

export function ChatArea({ messages, agentThinking, agentReasoning, onSendMessage, canSendMessage = true, sendBlockedReason = null, onOpenSettings, displayAgentState = 'sleeping', onPauseAgent, onResumeAgent, topicCapabilities = null, onToggleCapabilityGroup, onToggleCapabilityItem, capabilityHint = null, modelGroups = [], selectedModel = null, onSelectModel, promptTemplates = [], topicPrompt = '', onChangeTopicPrompt, onApplyPromptTemplate, agents = [], selectedAgentId = null, onSelectAgent }: ChatAreaProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const capPanelRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = React.useState('');
    const [expandedTraceKeys, setExpandedTraceKeys] = React.useState<Record<string, boolean>>({});
    const [openCapPanel, setOpenCapPanel] = React.useState<'agent' | 'model' | 'prompt' | 'apps' | 'skills' | 'mcp' | null>(null);
    const [modelSearch, setModelSearch] = React.useState('');
    const [promptSearch, setPromptSearch] = React.useState('');

    // Close capability panels when clicking outside
    useEffect(() => {
        if (!openCapPanel) return;
        const handleOutside = (e: MouseEvent) => {
            if (capPanelRef.current && !capPanelRef.current.contains(e.target as Node)) {
                setOpenCapPanel(null);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [openCapPanel]);

    const toggleCapPanel = (panel: 'agent' | 'model' | 'prompt' | 'apps' | 'skills' | 'mcp') => {
        setOpenCapPanel(prev => prev === panel ? null : panel);
    };

    const filteredModelGroups = modelGroups
        .map((group) => ({
            ...group,
            models: group.models.filter((model) => {
                if (!modelSearch.trim()) return true;
                const q = modelSearch.toLowerCase();
                const providerMatch = group.providerId.toLowerCase().includes(q)
                    || (group.displayName ?? '').toLowerCase().includes(q);
                return providerMatch || model.toLowerCase().includes(q);
            }),
        }))
        .filter((group) => group.models.length > 0);

    const filteredPromptTemplates = promptTemplates
        .filter((template) => {
            if (!promptSearch.trim()) return true;
            const q = promptSearch.toLowerCase();
            return template.name.toLowerCase().includes(q) || template.content.toLowerCase().includes(q);
        })
        .slice(0, 20);

    const currentModelSelection = React.useMemo(() => {
        if (!selectedModel) {
            return { provider: '—', model: 'Not selected' };
        }
        const separatorIndex = selectedModel.indexOf(':');
        if (separatorIndex < 0) {
            return { provider: '—', model: selectedModel };
        }
        return {
            provider: selectedModel.slice(0, separatorIndex),
            model: selectedModel.slice(separatorIndex + 1),
        };
    }, [selectedModel]);

    const modelButtonLabel = currentModelSelection.model && currentModelSelection.model !== 'Not selected'
        ? currentModelSelection.model
        : 'Model';

    const contextPillMaterialStyle: React.CSSProperties = {
        backgroundColor: 'color-mix(in srgb, var(--mat-lg-regular-bg) 60%, transparent)',
        backdropFilter: 'blur(40px) saturate(150%)',
        WebkitBackdropFilter: 'blur(40px) saturate(150%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    };

    // Popovers use the same visual material as the context pill.
    // backdrop-filter works correctly here because the pill's blur layer is now an isolated
    // sibling element (absolute inset-0, no children), NOT an ancestor — so these popovers
    // are outside the compositing group and their blur reaches the real page background.
    // We locally override the inner-card tokens (global dark value is only 0.06 alpha) so
    // search inputs and group cards remain visible on top of the popover surface.
    // color-mix against --color-text-primary gives theme-adaptive tints:
    //   dark mode  → text-primary ≈ white  → white-tinted borders/cards (same feel as before)
    //   light mode → text-primary ≈ black  → dark-gray borders/cards (visible on light bg)
    const popoverMaterialStyle: React.CSSProperties = {
        backgroundColor: 'color-mix(in srgb, var(--mat-lg-regular-bg) 80%, transparent)',
        backdropFilter: 'blur(40px) saturate(150%)',
        WebkitBackdropFilter: 'blur(40px) saturate(150%)',
        // Outer border and shadow
        border: '1px solid color-mix(in srgb, var(--color-text-primary) 6%, transparent)',
        boxShadow: '0 8px 32px var(--mat-floating-shadow-strong), 0 2px 8px var(--mat-floating-shadow-soft), 0 2px 10px var(--mat-floating-accent-glow)',
        // Inner element token overrides (theme-adaptive)
        ['--mat-border' as any]: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
        ['--mat-content-card-bg' as any]: 'color-mix(in srgb, var(--color-text-primary) 4%, transparent)',
        ['--mat-content-card-hover-bg' as any]: 'color-mix(in srgb, var(--color-text-primary) 7%, transparent)',
        ['--mat-content-bubble-bg' as any]: 'color-mix(in srgb, var(--color-text-primary) 9%, transparent)',
    };

    const renderToggle = (checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
        <button
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onChange(!checked);
            }}
            className={`
                relative inline-flex items-center shrink-0 rounded-full border border-transparent
                transition-colors duration-200 focus:outline-none w-7 h-4
                ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            <span
                className={`
                    inline-block rounded-full bg-white shadow transition-transform duration-200
                    w-3 h-3 translate-x-0.5
                    ${checked ? 'translate-x-3' : ''}
                `}
            />
        </button>
    );

    const toggleTraceExpand = (traceKey: string) => {
        const scrollArea = scrollAreaRef.current;
        const beforeBlock = scrollArea?.querySelector(`[data-trace-key="${traceKey}"]`) as HTMLElement | null;
        const beforeAnchor = beforeBlock?.querySelector('[data-latest-toolcall-anchor="true"]') as HTMLElement | null;
        const beforeAnchorTop = beforeAnchor?.getBoundingClientRect().top ?? null;
        const beforeHeight = beforeBlock?.offsetHeight ?? null;
        let nextExpanded = false;

        setExpandedTraceKeys((prev) => {
            nextExpanded = !prev[traceKey];
            return { ...prev, [traceKey]: nextExpanded };
        });

        requestAnimationFrame(() => {
            const nextScrollArea = scrollAreaRef.current;
            if (!nextScrollArea) {
                return;
            }
            const afterBlock = nextScrollArea.querySelector(`[data-trace-key="${traceKey}"]`) as HTMLElement | null;
            const afterAnchor = afterBlock?.querySelector('[data-latest-toolcall-anchor="true"]') as HTMLElement | null;
            const afterAnchorTop = afterAnchor?.getBoundingClientRect().top ?? null;

            if (beforeAnchorTop !== null && afterAnchorTop !== null) {
                nextScrollArea.scrollTop += afterAnchorTop - beforeAnchorTop;
                return;
            }

            if (beforeHeight !== null && afterBlock) {
                const afterHeight = afterBlock.offsetHeight;
                nextScrollArea.scrollTop += afterHeight - beforeHeight;
            }
        });
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            const maxHeight = 160;
            textareaRef.current.style.height = '0px';
            const nextHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
            textareaRef.current.style.height = `${nextHeight}px`;
            textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
    }, [inputValue]);

    // Scroll to bottom on new messages or thinking update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, agentThinking, agentReasoning]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (inputValue.trim()) {
                onSendMessage(inputValue.trim());
                setInputValue('');
            }
        }
    };

    const handleSendClick = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const normalizeReasoningText = (text: string) => {
        const trimmed = text.trim();
        if (trimmed.startsWith('Reasoning:')) {
            return trimmed.replace(/^Reasoning:\s*/, '');
        }
        return trimmed;
    };

    // 解析多部分消息内容
    const parseMultiPartContent = (content: any): Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; input?: any }> => {
        if (!content) return [];
        
        // 如果是字符串，当作普通文本
        if (typeof content === 'string') {
            return [{ type: 'text', text: content }];
        }
        
        // 如果是数组，解析每个部分
        if (Array.isArray(content)) {
            return content.map(part => {
                if (part?.type === 'text' && part?.text) {
                    return { type: 'text', text: part.text };
                } else if (part?.type === 'tool-call' && part?.toolName) {
                    return { 
                        type: 'tool-call', 
                        toolCallId: part.toolCallId,
                        toolName: part.toolName,
                        input: part.input
                    };
                }
                return null;
            }).filter(Boolean) as Array<{ type: string; text?: string; toolCallId?: string; toolName?: string; input?: any }>;
        }
        
        return [];
    };

    const renderLiveReasoningBlock = () => (
        <div className="flex justify-start">
            <Card className="max-w-[85%] bg-[var(--mat-content-bubble-bg)] rounded-2xl rounded-tl-sm !border-0 shadow-none">
                <CardBody className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-[var(--color-accent)] text-[12px] font-medium">
                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                        <span>Reasoning Chain</span>
                    </div>
                    <div className="text-[11px] leading-5 text-[var(--color-text-secondary)] opacity-90 pl-2">
                        <MarkdownRenderer content={agentReasoning} />
                    </div>
                </CardBody>
            </Card>
        </div>
    );

    // Build tool rounds from trace items (pair tool-call with tool-result)
    const buildToolRoundsFromItems = (items: TraceItem[]): TraceItem[] => {
        const result: TraceItem[] = [];
        const callMap = new Map<string, { args?: unknown; toolName: string; index: number }>();
        
        // First pass: collect all tool calls
        items.forEach((item, index) => {
            if (item.kind === 'tool') {
                if (item.step.status === 'called' && item.step.toolCallId) {
                    callMap.set(item.step.toolCallId, {
                        args: item.step.args,
                        toolName: item.step.toolName,
                        index,
                    });
                }
            }
        });
        
        // Second pass: build rounds
        const processedCalls = new Set<string>();
        let roundIndex = 0;
        
        items.forEach((item) => {
            if (item.kind === 'reasoning') {
                result.push(item);
            } else if (item.kind === 'text') {
                result.push(item);
            } else if (item.kind === 'tool') {
                const step = item.step;
                if (step.status === 'called') {
                    const toolCallId = step.toolCallId;
                    if (toolCallId && !processedCalls.has(toolCallId)) {
                        processedCalls.add(toolCallId);
                        // Find matching result (type predicate narrows to the 'tool' variant)
                        const matchingResult = items.find(
                            (i): i is Extract<TraceItem, { kind: 'tool' }> =>
                                i.kind === 'tool' &&
                                i.step.toolCallId === toolCallId &&
                                (i.step.status === 'success' || i.step.status === 'error')
                        );
                        
                        result.push({
                            kind: 'toolRound',
                            round: {
                                toolCallId,
                                toolName: step.toolName || 'Unknown Tool',
                                callArgs: step.args,
                                result: matchingResult?.step?.result,
                                status: matchingResult ? (matchingResult.step.status === 'error' ? 'error' : 'success') : 'pending',
                                isLatest: false, // Will update later
                            },
                        });
                        roundIndex++;
                    }
                }
                // Skip tool results - they're already paired with calls
            }
        });
        
        // Mark the last round as latest
        const toolRounds = result.filter(i => i.kind === 'toolRound');
        if (toolRounds.length > 0) {
            (toolRounds[toolRounds.length - 1] as { kind: 'toolRound'; round: ToolRound }).round.isLatest = true;
        }
        
        return result;
    };

    const renderTraceBlock = (key: string, items: TraceItem[]) => {
        if (items.length === 0) {
            return null;
        }

        const toolRounds = items.filter((item): item is { kind: 'toolRound'; round: ToolRound } => item.kind === 'toolRound');
        const isRunning = toolRounds.length > 0 && toolRounds[toolRounds.length - 1].round.status === 'pending';

        // Render a single reasoning item (collapsible with brain icon)
        const renderReasoningItem = (item: { kind: 'reasoning'; text: string }, index: number) => {
            const reasoningExpandedKey = `${key}-reasoning-${index}`;
            const isReasoningExpanded = expandedTraceKeys[reasoningExpandedKey] ?? false;

            return (
                <div key={`reasoning-${index}`} className="space-y-1">
                    {/* Reasoning header - always visible, clickable to expand/collapse */}
                    <button
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)] transition-colors"
                        onClick={() => {
                            setExpandedTraceKeys(prev => ({
                                ...prev,
                                [reasoningExpandedKey]: !prev[reasoningExpandedKey]
                            }));
                        }}
                        aria-label={isReasoningExpanded ? 'Collapse reasoning' : 'Expand reasoning'}
                    >
                        <IconBrain className="w-3 h-3 text-[var(--color-accent)]" />
                        <span className="font-medium">Reasoning</span>
                        <span className="text-[var(--color-text-tertiary)] text-[9px]">
                            {isReasoningExpanded ? '▼' : '▶'}
                        </span>
                    </button>

                    {/* Expanded reasoning content - no bubble, just left border */}
                    {isReasoningExpanded && (
                        <div className="border-l-2 border-[var(--color-border)] pl-3 py-1 ml-3 text-[10px] leading-5 text-[var(--color-text-secondary)]">
                            <MarkdownRenderer content={item.text} />
                        </div>
                    )}
                </div>
            );
        };

        // Render a single text item (always visible)
        const renderTextItem = (item: { kind: 'text'; text: string }, index: number) => (
            <div key={`text-${index}`} className="text-[11px] leading-5 text-[var(--color-text-primary)] px-3 py-2 rounded-xl bg-[var(--mat-toolchain-block-bg)]">
                <MarkdownRenderer content={item.text} />
            </div>
        );

        // Render a tool round (call + result paired)
        const renderToolRound = (item: { kind: 'toolRound'; round: ToolRound }, index: number) => {
            const round = item.round;
            const toolExpandedKey = `${key}-tool-${index}`;
            // Only expand input for the latest round by default
            const isToolExpanded = expandedTraceKeys[toolExpandedKey] ?? round.isLatest;

            const statusLabel = round.status === 'pending'
                ? 'Running'
                : round.status === 'error'
                    ? 'Failed'
                    : 'Succeeded';

            return (
                <div key={`tool-round-${round.toolCallId || index}`} className="space-y-0">
                    {/* Tool round header - always visible */}
                    <div className="flex items-center gap-1.5 px-2 py-1">
                        {/* Icon - centered with toolname + status column */}
                        <IconWrench className="w-3 h-3 text-[var(--color-text-tertiary)] shrink-0 mt-2" />
                        {/* Tool name and status column */}
                        <div className="flex-1 min-w-0">
                            <button
                                className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                                onClick={() => {
                                    setExpandedTraceKeys(prev => ({
                                        ...prev,
                                        [toolExpandedKey]: !prev[toolExpandedKey]
                                    }));
                                }}
                                aria-label={isToolExpanded ? 'Collapse tool' : 'Expand tool'}
                            >
                                <span className="font-medium truncate">{round.toolName}</span>
                                <span className="text-[var(--color-text-tertiary)] text-[9px]">
                                    {isToolExpanded ? '▼' : '▶'}
                                </span>
                            </button>
                            {/* Status label - directly below tool name */}
                            {round.status !== 'pending' && (
                                <div className={`text-[9px] leading-tight ${round.status === 'error' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                                    {statusLabel}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tool round content - expanded state with left border like reasoning */}
                    {isToolExpanded && (
                        <div className="border-l-2 border-[var(--color-border)] pl-3 py-1 ml-3 space-y-2">
                            {/* Input - only show for latest round or if explicitly expanded */}
                            {(round.isLatest || isToolExpanded) && hasMeaningfulPayload(round.callArgs) && (
                                <div>
                                    <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Input</div>
                                    <pre className="font-mono text-[10px] leading-4 whitespace-pre-wrap break-words text-[var(--color-text-secondary)] overflow-x-auto">
                                        {truncateValue(round.callArgs)}
                                    </pre>
                                </div>
                            )}
                            {/* Output */}
                            {round.status !== 'pending' && hasMeaningfulPayload(round.result) && (
                                <div>
                                    <div className="text-[10px] font-medium text-[var(--color-text-secondary)] mb-1">Output</div>
                                    {typeof round.result === 'string' ? (
                                        <div className="text-[10px] leading-5 text-[var(--color-text-secondary)] overflow-x-auto">
                                            <MarkdownRenderer content={truncateValue(round.result)} />
                                        </div>
                                    ) : (
                                        <pre className="font-mono text-[10px] leading-4 whitespace-pre-wrap break-words text-[var(--color-text-secondary)] overflow-x-auto">
                                            {truncateValue(round.result)}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        };

        // Build content - preserve original order!
        const contentItems: React.ReactNode[] = [];

        items.forEach((item, index) => {
            if (item.kind === 'reasoning') {
                if (item.text.trim()) {
                    contentItems.push(renderReasoningItem(item, index));
                }
            } else if (item.kind === 'text') {
                if (item.text.trim()) {
                    contentItems.push(renderTextItem(item, index));
                }
            } else if (item.kind === 'toolRound') {
                contentItems.push(renderToolRound(item, index));
            }
        });

        return (
            <div key={key} data-trace-key={key} className="flex justify-start">
                <Card className="max-w-[92%] bg-[var(--mat-content-bubble-bg)] rounded-2xl rounded-tl-sm overflow-hidden !border-0 shadow-none">
                    <CardBody className="p-4">
                        <div className="flex items-center justify-between gap-2 mb-2 text-[12px] font-medium text-[var(--color-text-tertiary)]">
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-[var(--color-text-secondary)]' : 'bg-[var(--color-text-tertiary)]'}`} />
                                <span>{isRunning ? 'Tool Chain Running' : 'Tool Chain'}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {contentItems}
                        </div>
                    </CardBody>
                </Card>
            </div>
        );
    };

    return (
        <div className="absolute inset-0 flex flex-col min-h-0">

            {/* Top fade — blurs messages as they scroll under the header pills */}
            <div
                className="absolute top-0 left-0 right-0 h-[44px] z-10 pointer-events-none"
                style={{
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    maskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 100%)',
                }}
            />

            {/* Bottom fade — blurs messages as they scroll toward the input pill */}
            <div
                className="absolute bottom-0 left-0 right-0 h-[40px] z-10 pointer-events-none"
                style={{
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    maskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to top, black 0%, black 20%, transparent 100%)',
                }}
            />

            <div ref={scrollAreaRef} className="absolute inset-0 px-6 pt-[78px] pb-[60px] space-y-6 overflow-y-auto custom-scrollbar">
                {messages.length === 0 && (
                    <EmptyState onNewChat={() => { }} />
                )}

                {agentReasoning && messages.length === 0 && renderLiveReasoningBlock()}

                {(() => {
                    const rendered: React.ReactNode[] = [];
                    let traceItems: TraceItem[] = [];

                    const flushTrace = (key: string) => {
                        // Transform tool items into tool rounds before rendering
                        const transformedItems = buildToolRoundsFromItems(traceItems);
                        const node = renderTraceBlock(key, transformedItems);
                        if (node) {
                            rendered.push(node);
                        }
                        traceItems = [];
                    };

                    messages.forEach((msg, index) => {
                        const isAgent = msg.role === 'assistant';
                        const isAgentError = isAgent && Boolean(msg.metadata?.isAgentError);
                        const messageType = msg.messageType || 'text';
                        const isReasoning = messageType === 'reasoning';
                        const isToolCall = messageType === 'tool_call';
                        const isToolResult = messageType === 'tool_result';
                        const shouldTrace = isReasoning || isToolCall || isToolResult;
                        const hasVisibleText = typeof msg.content === 'string' && msg.content.trim().length > 0;

                        if (shouldTrace) {
                            if (isReasoning) {
                                const normalizedReasoning = normalizeReasoningText(msg.content || '');
                                if (!normalizedReasoning.trim()) {
                                    return;
                                }
                                traceItems.push({
                                    kind: 'reasoning',
                                    text: normalizedReasoning,
                                });
                            } else if (isToolCall) {
                                if (msg.metadata?.reasoning) {
                                    const normalizedReasoning = normalizeReasoningText(msg.metadata.reasoning);
                                    if (normalizedReasoning.trim()) {
                                    traceItems.push({
                                        kind: 'reasoning',
                                        text: normalizedReasoning,
                                    });
                                    }
                                }
                                if (typeof msg.metadata?.text === 'string' && msg.metadata.text.trim()) {
                                    traceItems.push({
                                        kind: 'text',
                                        text: msg.metadata.text.trim(),
                                    });
                                }
                                traceItems.push({
                                    kind: 'tool',
                                    step: {
                                        toolCallId: msg.metadata?.toolCallId,
                                        toolName: msg.metadata?.toolName || 'Unknown Tool',
                                        status: 'called',
                                        args: msg.metadata?.args ?? msg.metadata?.input,
                                    },
                                });
                            } else if (isToolResult) {
                                traceItems.push({
                                    kind: 'tool',
                                    step: {
                                        toolCallId: msg.metadata?.toolCallId,
                                        toolName: msg.metadata?.toolName || 'Unknown Tool',
                                        status: msg.metadata?.isError ? 'error' : 'success',
                                        result: msg.metadata?.result,
                                        isError: Boolean(msg.metadata?.isError),
                                    },
                                });
                            }
                            return;
                        }

                        if (!hasVisibleText) {
                            return;
                        }

                        flushTrace(`trace-${index}`);

                        const messageNode = (
                            <div
                                key={msg.id}
                                className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
                            >
                                <Card
                                    className={`
                                        max-w-[85%] !border-0 shadow-none
                                        ${isAgentError
                                            ? 'bg-[var(--mat-content-card-bg)] rounded-2xl rounded-tl-sm border border-[var(--color-danger,#FF453A)]'
                                            : isAgent
                                            ? 'bg-[var(--mat-content-bubble-bg)] rounded-2xl rounded-tl-sm'
                                            : 'bg-[var(--mat-lg-clear-accent-bg)] rounded-2xl rounded-tr-sm'}
                                    `}
                                >
                                    <CardBody className="p-4 overflow-hidden">
                                        <div className={`flex items-center gap-2 mb-2 text-[12px] font-medium ${isAgent ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-tertiary)]'}`}>
                                            <span>{isAgentError ? 'System Agent Error' : isAgent ? 'System Agent' : 'User Command'}</span>
                                            <span>•</span>
                                            <span className="font-system text-[11px] opacity-70">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="text-[13px] leading-6 text-[var(--color-text-primary)]">
                                            <MarkdownRenderer content={msg.content} />
                                        </div>
                                        {isAgentError && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSettings?.('model')}
                                                    className="text-[12px] px-2.5 py-1.5 rounded-full bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-primary)] hover:opacity-90"
                                                >
                                                    Open Settings
                                                </button>
                                            </div>
                                        )}
                                    </CardBody>
                                </Card>
                            </div>
                        );

                        rendered.push(messageNode);
                    });

                    flushTrace('trace-final');
                    return rendered;
                })()}

                {agentReasoning && messages.length > 0 && renderLiveReasoningBlock()}

                {/* Thinking / Output Block */}
                {agentThinking && (
                    <div className="flex justify-start">
                        <Card className="max-w-[85%] bg-[var(--mat-content-bubble-bg)] rounded-2xl rounded-tl-sm !border-0 shadow-none">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-2 mb-2 text-[var(--color-text-secondary)] text-[11px] font-medium">
                                    <Spinner size="sm" color="current" />
                                    <span>Generating Response...</span>
                                </div>
                                <div className="font-mono text-[12px] text-[var(--color-text-secondary)] opacity-90 whitespace-pre-wrap border-l-2 border-[var(--mat-border)] pl-3">
                                    {agentThinking}
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                )}
                <div className="h-10 shrink-0" />
                <div ref={messagesEndRef} />
            </div>

            {/* ──────────────────────────────────────────
                 Chat Hub: Unified Control + Input Pill
                 ────────────────────────────────────────── */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 z-20 pointer-events-none">
                <div className="w-full max-w-[512px] mx-auto pointer-events-auto">

                    {/* Single unified pill */}
                    <div 
                        className="
                            relative flex flex-col
                            rounded-[32px]
                            transition-all duration-200
                        "
                        style={{ boxShadow: '0 8px 32px var(--mat-floating-shadow-strong), 0 2px 8px var(--mat-floating-shadow-soft), 0 2px 10px var(--mat-floating-accent-glow)' }}
                    >
                        {/* Frosted glass layer — isolated element with NO children.
                            Its backdrop-filter creates a compositing group only for itself,
                            so popovers in the sibling content div are free to apply their
                            own backdrop-filter to the real page background (not this layer). */}
                        <div
                            className="absolute inset-0 rounded-[32px] pointer-events-none"
                            style={{
                                backgroundColor: 'color-mix(in srgb, var(--mat-lg-regular-bg) 60%, transparent)',
                                backdropFilter: 'blur(40px) saturate(150%)',
                                WebkitBackdropFilter: 'blur(40px) saturate(150%)',
                                border: '1px solid color-mix(in srgb, var(--color-text-primary) 8%, transparent)'
                            }}
                        />
                        {/* Content layer — sibling of the backdrop-filter div, not nested inside it.
                            Popovers here can freely blur the actual page background. */}
                        <div ref={capPanelRef} className="relative flex flex-col">
                        {/* ── Agent Controls Section ── */}
                        <div
                            data-testid="agent-control-pill"
                            className="w-full h-[36px] shrink-0 flex items-center justify-between px-4 mt-1"
                        >
                            {/* Left: Context */}
                            <div className="flex items-center gap-2">
                                {/* State icon */}
                                {displayAgentState === 'sleeping' && (
                                    <IconAgentSleeping className="w-7 h-7 text-[var(--color-text-tertiary)]" />
                                )}
                                {displayAgentState === 'idle' && (
                                    <IconAgentIdle className="w-7 h-7" />
                                )}
                                {displayAgentState === 'working' && (
                                    <IconAgentWorking className="w-7 h-7" />
                                )}
                                {displayAgentState === 'paused' && (
                                    <IconAgentPaused className="w-7 h-7 text-[var(--color-warning,#FF9F0A)]" />
                                )}

                                {/* Agent Switcher */}
                                <div className="relative">
                                    <button
                                        onClick={() => toggleCapPanel('agent')}
                                        className={`h-7 max-w-[120px] px-2 rounded-full text-[11px] inline-flex items-center justify-start gap-1.5 transition-all duration-200 hover:scale-105
                                            ${openCapPanel === 'agent'
                                                ? 'bg-[var(--color-accent)] text-white'
                                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)]'}`}
                                        aria-label="Agent"
                                    >
                                        <span className="truncate leading-none">
                                            {agents?.find(a => a.id === selectedAgentId)?.name || 'No Agent'}
                                        </span>
                                    </button>

                                    {openCapPanel === 'agent' && (
                                        <div className="absolute bottom-[52px] left-0 w-[240px] rounded-2xl p-3 z-40" style={popoverMaterialStyle}>
                                            <div className="text-[12px] font-medium text-[var(--color-text-primary)] mb-2">Agent</div>
                                            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                                                <span aria-hidden="true" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--mat-border)] text-[9px] leading-none">i</span>
                                                <span>Select an agent for this topic.</span>
                                            </div>

                                            <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onSelectAgent?.(null);
                                                        setOpenCapPanel(null);
                                                    }}
                                                    className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md transition-colors ${!selectedAgentId
                                                        ? 'bg-[var(--color-accent)] text-white'
                                                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-bg)]'
                                                        }`}
                                                >
                                                    No Agent (Use Global Config)
                                                </button>
                                                {agents?.map((agent) => {
                                                    const active = selectedAgentId === agent.id;
                                                    return (
                                                        <button
                                                            key={agent.id}
                                                            type="button"
                                                            onClick={() => {
                                                                onSelectAgent?.(agent.id);
                                                                setOpenCapPanel(null);
                                                            }}
                                                            className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md transition-colors ${active
                                                                ? 'bg-[var(--color-accent)] text-white'
                                                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-bg)]'
                                                                }`}
                                                        >
                                                            {agent.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Pause / Resume — hidden while sleeping */}
                                {displayAgentState !== 'sleeping' && (
                                    displayAgentState === 'paused' ? (
                                        <Button
                                            isIconOnly size="sm" variant="light"
                                            onClick={onResumeAgent}
                                            className="min-w-7 w-7 h-7 rounded-full text-[var(--color-success)] hover:bg-[var(--color-success)]/10 hover:scale-110 transition-all"
                                            aria-label="Resume Agent"
                                        >
                                            <IconPlay />
                                        </Button>
                                    ) : (
                                        <Button
                                            isIconOnly size="sm" variant="light"
                                            onClick={onPauseAgent}
                                            className={`
                                                min-w-7 w-7 h-7 rounded-full transition-all
                                                text-[var(--color-text-tertiary)] hover:bg-white/5
                                                hover:text-[var(--color-text-secondary)] hover:scale-110
                                                ${displayAgentState === 'idle' ? 'opacity-30 pointer-events-none' : 'opacity-100'}
                                            `}
                                            aria-label="Pause Agent"
                                        >
                                            <IconPause />
                                        </Button>
                                    )
                                )}
                            </div>

                            {/* Right: Control */}
                            <div className="relative flex items-center gap-1">
                                    <div className="relative">
                                        <button
                                            onClick={() => toggleCapPanel('model')}
                                            className={`h-7 min-w-[132px] max-w-[180px] px-2 rounded-full text-[11px] inline-flex items-center justify-start gap-1.5 transition-all duration-200 hover:scale-105
                                                ${openCapPanel === 'model'
                                                    ? 'bg-[var(--color-accent)] text-white'
                                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)]'}`}
                                            aria-label="Model"
                                            title={`${currentModelSelection.provider}/${currentModelSelection.model}`}
                                        >
                                            <IconBrain className="w-4 h-4" />
                                            <span className="truncate leading-none">{modelButtonLabel}</span>
                                        </button>

                                        {openCapPanel === 'model' && (
                                            <div className="absolute bottom-[52px] left-1/2 -translate-x-1/2 w-[360px] rounded-2xl p-3 z-40" style={popoverMaterialStyle}>
                                                <div className="text-[12px] font-medium text-[var(--color-text-primary)] mb-2">Model</div>
                                                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                                                    <span aria-hidden="true" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--mat-border)] text-[9px] leading-none">i</span>
                                                    <span>Temporary overrides for current topic only.</span>
                                                </div>

                                                <div className="mb-2">
                                                    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">Current</div>
                                                    <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-primary)] truncate">
                                                        <span className="text-[var(--color-success)]" aria-hidden="true">✅</span>
                                                        <span className="truncate">
                                                            {currentModelSelection.provider}
                                                            <span className="mx-1 text-[var(--color-text-tertiary)]">/</span>
                                                            {currentModelSelection.model}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Provider</div>
                                                    <input
                                                        value={modelSearch}
                                                        onChange={(event) => setModelSearch(event.target.value)}
                                                        placeholder="Search model ..."
                                                        className="w-[190px] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                                                    />
                                                </div>

                                                {filteredModelGroups.length === 0 ? (
                                                    <div className="text-[11px] text-[var(--color-text-tertiary)]">No models found</div>
                                                ) : (
                                                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-2">
                                                        {filteredModelGroups.map((group) => (
                                                            <div key={`model-group-${group.providerId}`} className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 mr-1 min-h-[118px]">
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{group.displayName ?? group.providerId}</div>
                                                                    {group.providerId.startsWith('custom:') && (
                                                                        <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-[0.04em]
                                                                            bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
                                                                            Custom
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="space-y-1 max-h-[98px] overflow-y-auto pr-1">
                                                                    {group.models.map((model) => {
                                                                        const fullId = `${group.providerId}:${model}`;
                                                                        const active = selectedModel === fullId;
                                                                        return (
                                                                            <button
                                                                                key={fullId}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    onSelectModel?.(fullId);
                                                                                    setOpenCapPanel(null);
                                                                                }}
                                                                                className={`w-full text-left text-[11px] px-2 py-1.5 rounded-md transition-colors ${active
                                                                                    ? 'bg-[var(--color-accent)] text-white'
                                                                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-bg)]'
                                                                                    }`}
                                                                            >
                                                                                {model}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <button
                                            onClick={() => toggleCapPanel('prompt')}
                                            className={`w-7 h-7 rounded-full text-[11px] inline-flex items-center justify-center transition-all duration-200 hover:scale-105
                                                ${openCapPanel === 'prompt'
                                                    ? 'bg-[var(--color-accent)] text-white'
                                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)]'}`}
                                            aria-label="Prompt"
                                        >
                                            <IconPrompt className="w-4 h-4" />
                                        </button>

                                        {openCapPanel === 'prompt' && (
                                            <div className="absolute bottom-[52px] left-1/2 -translate-x-1/2 w-[360px] rounded-2xl p-3 z-40" style={popoverMaterialStyle}>
                                                <div className="text-[12px] font-medium text-[var(--color-text-primary)] mb-2">Prompt</div>
                                                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                                                    <span aria-hidden="true" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--mat-border)] text-[9px] leading-none">i</span>
                                                    <span>Temporary overrides for current topic only.</span>
                                                </div>

                                                <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">Current</div>
                                                <textarea
                                                    value={topicPrompt || ''}
                                                    onChange={(event) => onChangeTopicPrompt?.(event.target.value)}
                                                    placeholder="Topic prompt override..."
                                                    className="w-full h-[140px] overflow-y-auto bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-2.5 py-2 text-[12px] resize-none mb-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                                                />
                                                <div className="mb-2 text-[10px] text-[var(--color-text-tertiary)]">Undo: ⌘Z / Ctrl+Z</div>

                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Templates</div>
                                                    <input
                                                        value={promptSearch}
                                                        onChange={(event) => setPromptSearch(event.target.value)}
                                                        placeholder="Search templates..."
                                                        className="w-[190px] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                                                    />
                                                </div>

                                                <div className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2">
                                                    <div className="max-h-[90px] overflow-y-auto space-y-0.5 pr-0.5">
                                                        {filteredPromptTemplates.length === 0 ? (
                                                            <div className="text-[11px] text-[var(--color-text-tertiary)] px-1 py-0.5">No templates found</div>
                                                        ) : filteredPromptTemplates.map((template) => (
                                                            <button
                                                                key={template.id}
                                                                type="button"
                                                                onClick={() => onApplyPromptTemplate?.(template.id)}
                                                                className="w-full text-left text-[11px] px-2 py-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-bg)] transition-colors"
                                                            >
                                                                {template.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Apps Button ── */}
                                    <div className="relative">
                                        <button
                                            onClick={() => toggleCapPanel('apps')}
                                            className={`w-7 h-7 rounded-full text-[11px] inline-flex items-center justify-center transition-all duration-200 hover:scale-105
                                                ${openCapPanel === 'apps'
                                                    ? 'bg-[var(--color-accent)] text-white'
                                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)]'}`}
                                            aria-label="Apps"
                                        >
                                            <IconApps className="w-4 h-4" />
                                        </button>

                                        {openCapPanel === 'apps' && (
                                            <div className="absolute bottom-[52px] left-1/2 -translate-x-1/2 w-[300px] max-h-[280px] overflow-auto rounded-2xl p-3 z-40" style={popoverMaterialStyle}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[12px] font-medium text-[var(--color-text-primary)]">Apps</span>
                                                    {renderToggle(topicCapabilities?.apps.enabled ?? true, (value) => onToggleCapabilityGroup?.('apps', value))}
                                                </div>
                                                {capabilityHint && (
                                                    <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                                                        <span aria-hidden="true" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--mat-border)] text-[9px] leading-none">i</span>
                                                        <span>{capabilityHint}</span>
                                                    </div>
                                                )}
                                                {(topicCapabilities?.apps.items.length ?? 0) === 0 ? (
                                                    <div className="text-[11px] text-[var(--color-text-tertiary)]">No apps found</div>
                                                ) : (
                                                    <div className={`rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 space-y-1 ${(topicCapabilities?.apps.enabled ?? true) ? '' : 'opacity-45'}`}>
                                                        {(topicCapabilities?.apps.items ?? []).map((app) => (
                                                            <label key={`app-${app.name}`} className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-secondary)]">
                                                                <span className="truncate">{app.name}</span>
                                                                {renderToggle(
                                                                    app.enabled,
                                                                    (value) => onToggleCapabilityItem?.('apps', app.name, value),
                                                                    !(topicCapabilities?.apps.enabled ?? true),
                                                                )}
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <button
                                            onClick={() => toggleCapPanel('skills')}
                                            className={`w-7 h-7 rounded-full text-[11px] inline-flex items-center justify-center transition-all duration-200 hover:scale-105
                                                ${openCapPanel === 'skills'
                                                    ? 'bg-[var(--color-accent)] text-white'
                                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)]'}`}
                                            aria-label="Skills"
                                        >
                                            <IconSkills className="w-4 h-4" />
                                        </button>

                                        {openCapPanel === 'skills' && (() => {
                                            const allSkills = topicCapabilities?.skill.items ?? [];
                                            const globalSkills = allSkills.filter(s => s.scope !== 'project');
                                            const projectSkills = allSkills.filter(s => s.scope === 'project');
                                            const skillsEnabled = topicCapabilities?.skill.enabled ?? true;
                                            const renderSkillList = (items: typeof allSkills) => (
                                                <div className={`rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 space-y-1 ${skillsEnabled ? '' : 'opacity-45'}`}>
                                                    {items.map((item) => (
                                                        <label key={`skill-${item.name}`} className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-secondary)]">
                                                            <span className="truncate">{item.name}</span>
                                                            {renderToggle(
                                                                item.enabled,
                                                                (value) => onToggleCapabilityItem?.('skill', item.name, value),
                                                                !skillsEnabled,
                                                            )}
                                                        </label>
                                                    ))}
                                                </div>
                                            );
                                            return (
                                                <div className="absolute bottom-[52px] left-1/2 -translate-x-1/2 w-[300px] max-h-[340px] overflow-auto rounded-2xl p-3 z-40" style={popoverMaterialStyle}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[12px] font-medium text-[var(--color-text-primary)]">Skills</span>
                                                        {renderToggle(skillsEnabled, (value) => onToggleCapabilityGroup?.('skill', value))}
                                                    </div>
                                                    {capabilityHint && (
                                                        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                                                            <span aria-hidden="true" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--mat-border)] text-[9px] leading-none">i</span>
                                                            <span>{capabilityHint}</span>
                                                        </div>
                                                    )}
                                                    {allSkills.length === 0 ? (
                                                        <div className="text-[11px] text-[var(--color-text-tertiary)]">No skills available</div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {globalSkills.length > 0 && (
                                                                <div>
                                                                    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">Global</div>
                                                                    {renderSkillList(globalSkills)}
                                                                </div>
                                                            )}
                                                            {projectSkills.length > 0 && (
                                                                <div>
                                                                    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">Project</div>
                                                                    {renderSkillList(projectSkills)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    <div className="relative">
                                        <button
                                            onClick={() => toggleCapPanel('mcp')}
                                            className={`w-7 h-7 rounded-full text-[11px] inline-flex items-center justify-center transition-all duration-200 hover:scale-105
                                                ${openCapPanel === 'mcp'
                                                    ? 'bg-[var(--color-accent)] text-white'
                                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)]'}`}
                                            aria-label="MCP"
                                        >
                                            <IconPlug className="w-4 h-4" />
                                        </button>

                                        {openCapPanel === 'mcp' && (() => {
                                            const mcpEnabled = topicCapabilities?.mcp.enabled ?? true;
                                            const allGroups = topicCapabilities?.mcp.groups ?? [];
                                            const activeGroups = allGroups.filter(g => g.connected);
                                            const inactiveGroups = allGroups.filter(g => !g.connected);
                                            return (
                                                <div className="absolute bottom-[52px] left-1/2 -translate-x-1/2 w-[320px] max-h-[360px] overflow-auto rounded-2xl p-3 z-40" style={popoverMaterialStyle}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[12px] font-medium text-[var(--color-text-primary)]">MCP</span>
                                                        {renderToggle(mcpEnabled, (value) => onToggleCapabilityGroup?.('mcp', value))}
                                                    </div>
                                                    {capabilityHint && (
                                                        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                                                            <span aria-hidden="true" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--mat-border)] text-[9px] leading-none">i</span>
                                                            <span>{capabilityHint}</span>
                                                        </div>
                                                    )}
                                                    <div className="space-y-3">
                                                        {/* Active servers */}
                                                        {activeGroups.length > 0 && (
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">Active</div>
                                                                <div className={`space-y-2 ${mcpEnabled ? '' : 'opacity-45'}`}>
                                                                    {activeGroups.map((group) => (
                                                                        <details key={`mcp-group-${group.serverName}`} className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2" open>
                                                                            <summary className="list-none cursor-pointer flex items-center justify-between gap-2">
                                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-success)]" />
                                                                                    <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] truncate">{group.serverName}</span>
                                                                                </div>
                                                                                {renderToggle(
                                                                                    group.enabled,
                                                                                    (value) => onToggleCapabilityItem?.('mcp', group.key, value),
                                                                                    !mcpEnabled,
                                                                                )}
                                                                            </summary>
                                                                            <div className={`mt-1 space-y-1 ${(mcpEnabled && group.enabled) ? '' : 'opacity-45'}`}>
                                                                                {group.items.map((item) => (
                                                                                    <label key={`mcp-${item.key}`} className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-secondary)]">
                                                                                        <span className="truncate">{item.name}</span>
                                                                                        {renderToggle(
                                                                                            item.enabled,
                                                                                            (value) => onToggleCapabilityItem?.('mcp', item.key, value),
                                                                                            !mcpEnabled || !group.enabled,
                                                                                        )}
                                                                                    </label>
                                                                                ))}
                                                                            </div>
                                                                        </details>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* Inactive servers */}
                                                        {inactiveGroups.length > 0 && (
                                                            <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Inactive</div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setOpenCapPanel(null); onOpenSettings?.('mcp'); }}
                                                                        className="text-[10px] text-[var(--color-accent)] hover:underline"
                                                                    >
                                                                        Open Settings To Activate →
                                                                    </button>
                                                                </div>
                                                                <div className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 space-y-1.5 opacity-50">
                                                                    {inactiveGroups.map((group) => (
                                                                        <div key={`mcp-inactive-${group.serverName}`} className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                                                                            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-text-tertiary)]" />
                                                                            <span className="truncate">{group.serverName}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {allGroups.length === 0 && (
                                                            <div className="text-[11px] text-[var(--color-text-tertiary)]">No MCP servers configured</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                        </div>

                        {/* ── Input Section ── */}
                        <div className="w-full min-h-[44px] px-3 pb-3 pt-2">
                            <div className="w-full flex items-end rounded-[22px] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)]">
                                <textarea
                                    ref={textareaRef}
                                    className="
                                    flex-1 bg-transparent border-none outline-none
                                    focus:ring-0 focus:outline-none
                                    text-[15px] leading-relaxed text-[var(--color-text-primary)]
                                    placeholder:text-[var(--color-text-tertiary)]
                                    px-4 py-3
                                    max-h-40
                                        resize-none overflow-y-hidden scrollbar-hide
                                    font-['SF_Pro_Rounded',system-ui,sans-serif]
                                "
                                    placeholder={
                                        displayAgentState === 'paused'
                                            ? 'Agent paused — resume to continue…'
                                            : displayAgentState === 'working'
                                                ? 'Agent is working…'
                                                : 'Message the agent…'
                                    }
                                    rows={1}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                />

                                {/* Send button */}
                                <div className="pr-2 py-2 shrink-0">
                                    <Button
                                        isIconOnly size="sm"
                                        className={`
                                        min-w-9 w-9 h-9 rounded-full flex items-center justify-center
                                        transition-all duration-[var(--dur-fast)]
                                        active:scale-[0.94] motion-reduce:active:scale-100
                                        ${inputValue.trim()
                                                ? 'bg-[var(--color-accent)] text-white'
                                                : 'bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}
                                        `}
                                        onClick={handleSendClick}
                                        aria-label="Send message"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                                            <path d="M12 18V6" />
                                            <path d="M7 11L12 6L17 11" />
                                        </svg>
                                    </Button>
                                </div>
                            </div>
                        </div>
                        </div> {/* content layer */}
                    </div>

                </div>
            </div>
        </div>
    );
}
