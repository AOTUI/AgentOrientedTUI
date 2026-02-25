import React, { useRef, useEffect } from 'react';
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody } from "@heroui/card";
import { IconPlay, IconPause, IconAgentSleeping, IconAgentIdle, IconAgentWorking, IconAgentPaused, IconApps, IconSkills, IconMCP, IconBrain, IconPrompt } from './Icons.js';
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
    onOpenSettings?: (tab?: 'model' | 'prompt' | 'theme' | 'apps' | 'mcp' | 'skills') => void;
    displayAgentState?: DisplayAgentState;
    onPauseAgent?: () => void;
    onResumeAgent?: () => void;
    topicCapabilities?: TopicCapabilities | null;
    onToggleCapabilityGroup?: (source: 'apps' | 'mcp' | 'skill', enabled: boolean) => void;
    onToggleCapabilityItem?: (source: 'apps' | 'mcp' | 'skill', itemName: string, enabled: boolean) => void;
    capabilityHint?: string | null;
    modelGroups?: Array<{ providerId: string; models: string[] }>;
    selectedModel?: string | null;
    onSelectModel?: (modelId: string) => void;
    promptTemplates?: Array<{ id: string; name: string; content: string }>;
    topicPrompt?: string | null;
    onChangeTopicPrompt?: (prompt: string) => void;
    onApplyPromptTemplate?: (templateId: string) => void;
}

type ToolTraceStep = {
    toolCallId?: string;
    toolName: string;
    status: 'called' | 'success' | 'error';
    args?: unknown;
    result?: unknown;
    isError?: boolean;
};

type TraceItem =
    | { kind: 'reasoning'; text: string }
    | { kind: 'text'; text: string }
    | { kind: 'tool'; step: ToolTraceStep };

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

export function ChatArea({ messages, agentThinking, agentReasoning, onSendMessage, canSendMessage = true, sendBlockedReason = null, onOpenSettings, displayAgentState = 'sleeping', onPauseAgent, onResumeAgent, topicCapabilities = null, onToggleCapabilityGroup, onToggleCapabilityItem, capabilityHint = null, modelGroups = [], selectedModel = null, onSelectModel, promptTemplates = [], topicPrompt = '', onChangeTopicPrompt, onApplyPromptTemplate }: ChatAreaProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const capPanelRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = React.useState('');
    const [expandedTraceKeys, setExpandedTraceKeys] = React.useState<Record<string, boolean>>({});
    const [openCapPanel, setOpenCapPanel] = React.useState<'model' | 'prompt' | 'apps' | 'skills' | 'mcp' | null>(null);
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

    const toggleCapPanel = (panel: 'model' | 'prompt' | 'apps' | 'skills' | 'mcp') => {
        setOpenCapPanel(prev => prev === panel ? null : panel);
    };

    const filteredModelGroups = modelGroups
        .map((group) => ({
            ...group,
            models: group.models.filter((model) => {
                if (!modelSearch.trim()) return true;
                const q = modelSearch.toLowerCase();
                return group.providerId.toLowerCase().includes(q) || model.toLowerCase().includes(q);
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

    const renderTraceBlock = (key: string, items: TraceItem[]) => {
        if (items.length === 0) {
            return null;
        }

        const toolItems = items.filter((item): item is { kind: 'tool'; step: ToolTraceStep } => item.kind === 'tool');
        const contextItems = items.filter(
            (item): item is { kind: 'reasoning' | 'text'; text: string } =>
                (item.kind === 'reasoning' || item.kind === 'text') && item.text.trim().length > 0
        );
        const isExpanded = expandedTraceKeys[key] ?? false;
        const lastToolCall = [...toolItems].reverse().find(item => item.step.status === 'called');
        const lastToolResult = [...toolItems].reverse().find(item => item.step.status === 'success' || item.step.status === 'error');
        const callInputById = new Map<string, unknown>();
        toolItems.forEach((item) => {
            if (item.step.status === 'called' && item.step.toolCallId && hasMeaningfulPayload(item.step.args)) {
                callInputById.set(item.step.toolCallId, item.step.args);
            }
        });

        const collapsedItems: TraceItem[] = [
            ...contextItems,
            ...(lastToolCall ? [lastToolCall] : []),
            ...(lastToolResult ? [lastToolResult] : []),
        ];
        const visibleItems = isExpanded || collapsedItems.length === 0 ? items : collapsedItems;
        const isRunning = toolItems.length > 0 && toolItems[toolItems.length - 1].step.status === 'called';
        const hiddenToolCount = Math.max(0, toolItems.length - ((lastToolCall ? 1 : 0) + (lastToolResult ? 1 : 0)));
        const firstVisibleToolIndex = visibleItems.findIndex((item) => item.kind === 'tool');

        const renderTraceItem = (item: TraceItem, index: number) => {
            if (item.kind === 'reasoning' || item.kind === 'text') {
                if (!item.text.trim()) {
                    return null;
                }
                const nextItem = visibleItems[index + 1];
                const showFoldedBarAfter = !isExpanded && hiddenToolCount > 0 && !!nextItem;

                return (
                    <React.Fragment key={`trace-reasoning-${index}`}>
                        <div className="text-[11px] leading-5 text-[var(--color-text-primary)] px-3 py-2 rounded-xl bg-[var(--mat-toolchain-block-bg)]">
                            <MarkdownRenderer content={item.text} />
                        </div>
                        {showFoldedBarAfter && (
                            <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-[var(--mat-toolchain-bar-bg)] text-[11px] text-[var(--color-text-secondary)]">
                                <span className="h-[1px] flex-1 bg-[var(--color-border)]" />
                                <span className="font-medium">Folded Toolcalls</span>
                                <span className="h-[1px] flex-1 bg-[var(--color-border)]" />
                            </div>
                        )}
                    </React.Fragment>
                );
            }

            const step = item.step;
            const derivedInput = hasMeaningfulPayload(step.args)
                ? step.args
                : (step.toolCallId ? callInputById.get(step.toolCallId) : undefined);
            const hasInput = step.status === 'called' && hasMeaningfulPayload(derivedInput);
            const hasOutput = hasMeaningfulPayload(step.result);
            const showOutput = step.status !== 'called' && hasOutput;
            const dotClass = step.status === 'called'
                ? 'bg-[var(--color-accent)]'
                : step.status === 'error'
                    ? 'bg-[var(--color-danger)]'
                    : 'bg-[var(--color-success)]';
            const isLatestToolCall =
                lastToolCall?.step === step ||
                (
                    !!lastToolCall?.step.toolCallId &&
                    !!step.toolCallId &&
                    lastToolCall.step.toolCallId === step.toolCallId &&
                    step.status === 'called'
                );
            const summaryTitle = step.status === 'called'
                ? `Call ${step.toolName} tool`
                : step.status === 'error'
                    ? 'Failed'
                    : 'Succeeded';

            return (
                <details
                    key={`${step.toolCallId || step.toolName}-${index}`}
                    className="group"
                    open={step.status === 'called'}
                    data-latest-toolcall-anchor={isLatestToolCall ? 'true' : undefined}
                >
                    <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                        <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)]">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                            <span className="font-medium text-[var(--color-text-secondary)]">{summaryTitle}</span>
                        </div>
                    </summary>
                    {(hasInput || showOutput) && (
                        <div className="mt-2 pl-3 text-[10px] leading-5 text-[var(--color-text-secondary)] space-y-2 opacity-85">
                            {hasInput && (
                                <div>
                                    <div className="text-[12px] font-medium text-[var(--color-text-secondary)]">Input</div>
                                    <pre className="font-mono text-[10px] leading-4 whitespace-pre-wrap break-words">
                                        {typeof derivedInput === 'string' ? derivedInput : JSON.stringify(derivedInput, null, 2)}
                                    </pre>
                                </div>
                            )}
                            {showOutput && (
                                <div>
                                    <div className="text-[12px] font-medium text-[var(--color-text-secondary)]">Output</div>
                                    {typeof step.result === 'string' ? (
                                        <div className="text-[11px] leading-5">
                                            <MarkdownRenderer content={step.result} />
                                        </div>
                                    ) : (
                                        <pre className="font-mono text-[10px] leading-4 whitespace-pre-wrap break-words">
                                            {JSON.stringify(step.result, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </details>
            );
        };

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

                        {!isExpanded && hiddenToolCount > 0 && (
                            <div className="h-1.5 mb-3 rounded-full bg-[var(--mat-toolchain-bar-bg)] overflow-hidden">
                                <div className={`h-full w-1/3 rounded-full ${isRunning ? 'bg-[var(--color-text-secondary)]' : 'bg-[var(--color-accent)] opacity-40'}`} />
                            </div>
                        )}

                        <div className="space-y-2">
                            {visibleItems.map((item, index) => (
                                <React.Fragment key={`trace-item-${index}`}>
                                    {!isExpanded && index === firstVisibleToolIndex && firstVisibleToolIndex >= 0 && hiddenToolCount > 0 && (
                                        <button
                                                className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-full bg-[var(--mat-toolchain-bar-bg)] text-[11px] text-[var(--color-text-secondary)]"
                                            onClick={() => toggleTraceExpand(key)}
                                            aria-label="Click to expand tool chain"
                                        >
                                            <span className="px-1.5 py-0.5 rounded bg-[var(--mat-toolchain-block-bg)] text-[var(--color-text-secondary)]">
                                                +{hiddenToolCount} hidden
                                            </span>
                                            <span className="normal-case tracking-normal">click to expand</span>
                                        </button>
                                    )}
                                    {renderTraceItem(item, index)}
                                </React.Fragment>
                            ))}
                        </div>

                        {isExpanded && (
                            <div className="mt-3 sticky bottom-2 z-10 flex justify-end">
                                <button
                                    className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                    onClick={() => toggleTraceExpand(key)}
                                    aria-label="Collapse tool chain"
                                >
                                    Collapse Toolchain
                                </button>
                            </div>
                        )}
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
                        const node = renderTraceBlock(key, traceItems);
                        if (node) {
                            rendered.push(node);
                        }
                        traceItems = [];
                    };

                    messages.forEach((msg, index) => {
                        const isAgent = msg.role === 'assistant';
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
                                        ${isAgent
                                            ? 'bg-[var(--mat-content-bubble-bg)] rounded-2xl rounded-tl-sm'
                                            : 'bg-[var(--mat-lg-clear-accent-bg)] rounded-2xl rounded-tr-sm'}
                                    `}
                                >
                                    <CardBody className="p-4 overflow-hidden">
                                        <div className={`flex items-center gap-2 mb-2 text-[12px] font-medium ${isAgent ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-tertiary)]'}`}>
                                            <span>{isAgent ? 'System Agent' : 'User Command'}</span>
                                            <span>•</span>
                                            <span className="font-system text-[11px] opacity-70">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="text-[13px] leading-6 text-[var(--color-text-primary)]">
                                            <MarkdownRenderer content={msg.content} />
                                        </div>
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
                        <div className="relative flex flex-col">
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
                            <div ref={capPanelRef} className="relative flex items-center gap-1">
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
                                                                <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">{group.providerId}</div>
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
                                            <IconMCP className="w-4 h-4" />
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
