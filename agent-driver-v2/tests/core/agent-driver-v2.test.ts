/**
 * @aotui/agent-driver-v2 - AgentDriver V2 Tests
 * 
 * 验证核心功能：
 * - 消息聚合和时间戳排序
 * - 工具收集
 * - ToolCall 路由
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentDriverV2 } from '../../src/core/agent-driver-v2.js';
import type { IDrivenSource, MessageWithTimestamp, ToolResult } from '../../src/core/interfaces.js';

// Mock DrivenSource
class MockDrivenSource implements IDrivenSource {
    name: string;
    private messages: MessageWithTimestamp[];
    private tools: Record<string, any>;
    private updateCallback: (() => void) | null = null;

    constructor(name: string, messages: MessageWithTimestamp[] = [], tools: Record<string, any> = {}) {
        this.name = name;
        this.messages = messages;
        this.tools = tools;
    }

    async getMessages(): Promise<MessageWithTimestamp[]> {
        return this.messages;
    }

    async getTools(): Promise<Record<string, any>> {
        return this.tools;
    }

    async executeTool(toolName: string, args: unknown, toolCallId: string): Promise<ToolResult | undefined> {
        if (!this.tools[toolName]) {
            return undefined;
        }
        return {
            toolCallId,
            toolName,
            result: { success: true, data: args },
        };
    }

    onUpdate(callback: () => void): () => void {
        this.updateCallback = callback;
        return () => {
            this.updateCallback = null;
        };
    }

    triggerUpdate(): void {
        this.updateCallback?.();
    }
}

describe('AgentDriverV2', () => {
    let driver: AgentDriverV2;
    let source1: MockDrivenSource;
    let source2: MockDrivenSource;

    beforeEach(() => {
        source1 = new MockDrivenSource(
            'Source1',
            [
                { role: 'user', content: [{ type: 'text', text: 'Message 1' }], timestamp: 100 },
                { role: 'user', content: [{ type: 'text', text: 'Message 3' }], timestamp: 300 },
            ],
            { tool1: { type: 'function', description: 'Tool 1', parameters: { type: 'object', properties: {} } } }
        );

        source2 = new MockDrivenSource(
            'Source2',
            [
                { role: 'user', content: [{ type: 'text', text: 'Message 2' }], timestamp: 200 },
                { role: 'user', content: [{ type: 'text', text: 'Message 4' }], timestamp: 400 },
            ],
            { tool2: { type: 'function', description: 'Tool 2', parameters: { type: 'object', properties: {} } } }
        );

        driver = new AgentDriverV2({
            sources: [source1, source2],
            llm: {
                model: 'gpt-4',
            },
            workLoop: {
                debounceMs: 10,
            },
        });
    });

    it('应该正确聚合来自多个源的消息', async () => {
        const messages = await driver['collectMessages']();

        expect(messages).toHaveLength(4);
    });

    it('应该按时间戳排序消息', async () => {
        const messages = await driver['collectMessages']();

        expect((messages[0].content as any)[0].text).toBe('Message 1');
        expect((messages[1].content as any)[0].text).toBe('Message 2');
        expect((messages[2].content as any)[0].text).toBe('Message 3');
        expect((messages[3].content as any)[0].text).toBe('Message 4');
    });

    it('应该移除时间戳字段返回纯 CoreMessage', async () => {
        const messages = await driver['collectMessages']();

        messages.forEach((message) => {
            expect(message).not.toHaveProperty('timestamp');
        });
    });

    it('应该按 region 优先级组装上下文，并把最新执行尾巴放到底部', async () => {
        source1 = new MockDrivenSource(
            'StaticSource',
            [
                { role: 'user', content: [{ type: 'text', text: 'dynamic-view' }], timestamp: 50, region: 'dynamic' as const },
                { role: 'user', content: [{ type: 'text', text: 'static-msg' }], timestamp: 100, region: 'static' as const },
            ],
        );

        source2 = new MockDrivenSource(
            'SessionSource',
            [
                { role: 'user', content: [{ type: 'text', text: 'session-old' }], timestamp: 75, region: 'session' as const },
                {
                    role: 'assistant',
                    content: [{ type: 'tool-call', toolCallId: 'tc_tail', toolName: 'tool_tail', input: {} }],
                    timestamp: 120,
                    region: 'session' as const,
                } as any,
                {
                    role: 'tool',
                    content: [{ type: 'tool-result', toolCallId: 'tc_tail', toolName: 'tool_tail', output: { type: 'json', value: { ok: true } } }],
                    timestamp: 121,
                    region: 'session' as const,
                } as any,
            ],
        );

        const localDriver = new AgentDriverV2({
            sources: [source1, source2],
            llm: { model: 'gpt-4' },
            workLoop: { debounceMs: 10 },
        });

        const messages = await localDriver['collectMessages']();
        localDriver.stop();
        localDriver.dispose();

        expect((messages[0].content as any)[0].text).toBe('static-msg');
        expect((messages[1].content as any)[0].text).toBe('session-old');
        expect((messages[2].content as any)[0].text).toBe('dynamic-view');
        expect(((messages[3].content as any[])[0]).toolName).toBe('tool_tail');
        expect(((messages[4].content as any[])[0]).toolName).toBe('tool_tail');
    });

    it('应该丢弃没有前置 assistant tool-call 的孤儿 tool message', async () => {
        source1 = new MockDrivenSource(
            'Source1',
            [
                {
                    role: 'assistant',
                    content: [{ type: 'tool-call', toolCallId: 'tc_1', toolName: 'tool1', input: {} }],
                    timestamp: 100,
                } as any,
                {
                    role: 'tool',
                    content: [{ type: 'tool-result', toolCallId: 'tc_1', toolName: 'tool1', output: { type: 'json', value: { ok: true } } }],
                    timestamp: 110,
                } as any,
                {
                    role: 'tool',
                    content: [{ type: 'tool-result', toolCallId: 'tc_orphan', toolName: 'tool1', output: { type: 'json', value: { ok: true } } }],
                    timestamp: 120,
                } as any,
            ],
            { tool1: { type: 'function', description: 'Tool 1', parameters: { type: 'object', properties: {} } } }
        );

        const localDriver = new AgentDriverV2({
            sources: [source1],
            llm: { model: 'gpt-4' },
            workLoop: { debounceMs: 10 },
        });

        const messages = await localDriver['collectMessages']();
        localDriver.stop();
        localDriver.dispose();

        const toolMessages = messages.filter((m) => m.role === 'tool');
        expect(toolMessages).toHaveLength(1);
        expect((toolMessages[0].content as any[])[0].toolCallId).toBe('tc_1');
    });

    it('应该在混合 tool-result 时仅保留与前置 tool-call 匹配的结果', async () => {
        source1 = new MockDrivenSource(
            'Source1',
            [
                {
                    role: 'assistant',
                    content: [{ type: 'tool-call', toolCallId: 'tc_1', toolName: 'tool1', input: {} }],
                    timestamp: 100,
                } as any,
                {
                    role: 'tool',
                    content: [
                        { type: 'tool-result', toolCallId: 'tc_1', toolName: 'tool1', output: { type: 'json', value: { ok: true } } },
                        { type: 'tool-result', toolCallId: 'tc_orphan', toolName: 'tool1', output: { type: 'json', value: { ok: false } } },
                    ],
                    timestamp: 110,
                } as any,
            ],
            { tool1: { type: 'function', description: 'Tool 1', parameters: { type: 'object', properties: {} } } }
        );

        const localDriver = new AgentDriverV2({
            sources: [source1],
            llm: { model: 'gpt-4' },
            workLoop: { debounceMs: 10 },
        });

        const messages = await localDriver['collectMessages']();
        localDriver.stop();
        localDriver.dispose();

        const toolMessages = messages.filter((m) => m.role === 'tool');
        expect(toolMessages).toHaveLength(1);
        expect((toolMessages[0].content as any[])).toHaveLength(1);
        expect((toolMessages[0].content as any[])[0].toolCallId).toBe('tc_1');
    });

    it('应该正确聚合工具', async () => {
        const tools = await driver['collectTools']();

        expect(tools).toHaveProperty('tool1');
        expect(tools).toHaveProperty('tool2');
        expect(Object.keys(tools)).toHaveLength(2);
    });

    it('应该将 ToolCall 路由到正确的 DrivenSource', async () => {
        // 先初始化映射
        await driver['updateToolMapping']();

        const toolCalls = [
            { toolCallId: '1', toolName: 'tool1', args: { foo: 'bar' } },
            { toolCallId: '2', toolName: 'tool2', args: { baz: 'qux' } },
        ];

        const results = await driver['executeToolCalls'](toolCalls);

        expect(results).toHaveLength(2);
        expect(results[0].toolName).toBe('tool1');
        expect(results[0].result).toEqual({ success: true, data: { foo: 'bar' } });
        expect(results[1].toolName).toBe('tool2');
        expect(results[1].result).toEqual({ success: true, data: { baz: 'qux' } });
    });

    it('应该处理工具未找到的情况', async () => {
        await driver['updateToolMapping']();
        const toolCalls = [{ toolCallId: '1', toolName: 'nonExistentTool', args: {} }];

        const results = await driver['executeToolCalls'](toolCalls);

        expect(results).toHaveLength(1);
        expect(results[0].error).toBeDefined();
        expect(results[0].error?.code).toBe('E_TOOL_NOT_FOUND');
    });

    it.skip('应该监听更新信号', async () => {
        vi.useFakeTimers();

        // Create a dedicated driver instance for this test to ensure timers are faked
        const localDriver = new AgentDriverV2({
            sources: [source1],
            llm: { model: 'gpt-4' },
            workLoop: { debounceMs: 10 },
        });

        const promise = new Promise<void>((resolve) => {
            const runSpy = vi.spyOn(localDriver as any, 'run');
            runSpy.mockImplementation(async () => {
                resolve();
            });
        });

        // Trigger update
        source1.triggerUpdate();

        // Advance time
        vi.advanceTimersByTime(300);

        await promise;

        localDriver.stop();
        vi.useRealTimers();
    });

    it('应该正确清理资源', () => {
        const unsubscribeSpy = vi.fn();
        source1.onUpdate = vi.fn(() => unsubscribeSpy);

        const newDriver = new AgentDriverV2({
            sources: [source1],
            llm: { model: 'gpt-4' },
        });

        newDriver.dispose();

        expect(unsubscribeSpy).toHaveBeenCalled();
    });
});
