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
