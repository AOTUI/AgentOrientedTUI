import React, { useRef, useEffect } from 'react';
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody } from "@heroui/card";
import { IconNewChat, IconSend } from './Icons.js';
import { EmptyState } from './EmptyState.js';
import { MarkdownRenderer } from './MarkdownRenderer.js';
import type { Message } from '../../types.js';

interface ChatAreaProps {
    messages: Message[];
    agentThinking: string;
    agentReasoning: string;
    onSendMessage: (content: string) => void;
    canSendMessage?: boolean;
    sendBlockedReason?: string | null;
    onOpenSettings?: () => void;
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

export function ChatArea({ messages, agentThinking, agentReasoning, onSendMessage, canSendMessage = true, sendBlockedReason = null, onOpenSettings }: ChatAreaProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = React.useState('');
    const [expandedTraceKeys, setExpandedTraceKeys] = React.useState<Record<string, boolean>>({});

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
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
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

    const renderLiveReasoningBlock = () => (
        <div className="flex justify-start">
            <Card className="max-w-[85%] mat-content rounded-2xl rounded-tl-sm">
                <CardBody className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-[var(--color-accent)] text-[12px] font-medium">
                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                        <span>Reasoning Chain</span>
                    </div>
                    <div className="text-[11px] leading-5 text-[var(--color-text-secondary)] opacity-90 pl-2 border-l-2 border-[var(--color-accent)]/30">
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
        const reasoningItems = items.filter((item): item is { kind: 'reasoning'; text: string } => item.kind === 'reasoning' && item.text.trim().length > 0);
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
            ...reasoningItems,
            ...(lastToolCall ? [lastToolCall] : []),
            ...(lastToolResult ? [lastToolResult] : []),
        ];
        const visibleItems = isExpanded || collapsedItems.length === 0 ? items : collapsedItems;
        const isRunning = toolItems.length > 0 && toolItems[toolItems.length - 1].step.status === 'called';
        const hiddenToolCount = Math.max(0, toolItems.length - ((lastToolCall ? 1 : 0) + (lastToolResult ? 1 : 0)));
        const firstVisibleToolIndex = visibleItems.findIndex((item) => item.kind === 'tool');

        const renderTraceItem = (item: TraceItem, index: number) => {
            if (item.kind === 'reasoning') {
                if (!item.text.trim()) {
                    return null;
                }
                const nextItem = visibleItems[index + 1];
                const showFoldedBarAfter = !isExpanded && hiddenToolCount > 0 && !!nextItem;

                return (
                    <React.Fragment key={`trace-reasoning-${index}`}>
                        <div className="text-[11px] leading-5 text-[var(--color-text-primary)] px-3 py-2 rounded-xl bg-[var(--mat-lg-clear-bg)] border border-[var(--mat-border)]">
                            <MarkdownRenderer content={item.text} />
                        </div>
                        {showFoldedBarAfter && (
                            <div className="flex items-center gap-2 px-2 py-1 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--mat-content-card-hover-bg)] text-[11px] text-[var(--color-text-secondary)]">
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
                        <div className="mt-2 pl-3 border-l border-[var(--color-border)] text-[10px] leading-5 text-[var(--color-text-secondary)] space-y-2 opacity-85">
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
                <Card className="max-w-[92%] mat-content rounded-2xl rounded-tl-sm overflow-hidden">
                    <CardBody className="p-4">
                        <div className="flex items-center justify-between gap-2 mb-2 text-[12px] font-medium text-[var(--color-text-tertiary)]">
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-[var(--color-text-secondary)]' : 'bg-[var(--color-text-tertiary)]'}`} />
                                <span>{isRunning ? 'Tool Chain Running' : 'Tool Chain'}</span>
                            </div>
                        </div>

                        {!isExpanded && hiddenToolCount > 0 && (
                            <div className="h-1.5 mb-3 rounded-full bg-[var(--mat-content-card-hover-bg)] overflow-hidden">
                                <div className={`h-full w-1/3 rounded-full ${isRunning ? 'bg-[var(--color-text-secondary)]' : 'bg-[var(--color-accent)] opacity-40'}`} />
                            </div>
                        )}

                        <div className="space-y-2">
                            {visibleItems.map((item, index) => (
                                <React.Fragment key={`trace-item-${index}`}>
                                    {!isExpanded && index === firstVisibleToolIndex && firstVisibleToolIndex >= 0 && hiddenToolCount > 0 && (
                                        <button
                                                className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-full bg-[var(--mat-content-card-hover-bg)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
                                            onClick={() => toggleTraceExpand(key)}
                                            aria-label="Click to expand tool chain"
                                        >
                                            <span className="px-1.5 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]">
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
                                    className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--color-border)] bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]"
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
            <div
                className="absolute top-0 left-0 right-0 h-20 z-10 pointer-events-none"
                style={{
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)'
                }}
            />

            <div
                className="absolute bottom-0 left-0 right-0 h-24 z-10 pointer-events-none"
                style={{
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)'
                }}
            />

            <div ref={scrollAreaRef} className="flex-1 px-6 pt-20 pb-32 space-y-6 h-full overflow-y-auto custom-scrollbar">
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
                                        max-w-[85%] shadow-sm
                                        ${isAgent
                                            ? 'mat-content rounded-2xl rounded-tl-sm'
                                            : 'mat-lg-clear-accent rounded-2xl rounded-tr-sm'}
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
                        <Card className="max-w-[85%] mat-content rounded-2xl rounded-tl-sm">
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

            {/* Input Area */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-20 pointer-events-none">
                <div className="relative w-full max-w-3xl mx-auto mat-lg-regular rounded-[24px] flex items-end gap-2 p-1 pr-2 transition-all duration-200 focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_var(--color-accent-ring),inset_0_1px_0_var(--mat-inset-highlight)] pointer-events-auto shadow-lg">
                    <textarea
                        ref={textareaRef}
                        className="w-full bg-transparent border-none outline-none focus:ring-0 focus:outline-none text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] px-4 py-2 min-h-[36px] max-h-48 resize-none overflow-y-auto scrollbar-hide"
                        placeholder="Enter command..."
                        rows={1}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="pb-0.5">
                        <Button
                            isIconOnly
                            size="sm"
                            className={`min-w-8 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 motion-reduce:active:scale-100 ${inputValue.trim() ? 'bg-[var(--color-accent)] text-white shadow-md' : 'bg-[var(--mat-lg-clear-bg)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'}`}
                            onClick={handleSendClick}
                        >
                            <IconSend />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
