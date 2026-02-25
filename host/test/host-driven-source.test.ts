import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HostDrivenSourceV2 } from '../src/adapters/host-driven-source.js';

describe('HostDrivenSourceV2', () => {
    const topicId = 'topic_compact_test';
    let messageServiceMock: any;
    let source: HostDrivenSourceV2;

    beforeEach(() => {
        messageServiceMock = {
            getMessagesForLLM: vi.fn().mockResolvedValue([{ role: 'user', content: 'hello', timestamp: 1, id: 'm1' }]),
            compactContext: vi.fn().mockReturnValue({
                compacted: true,
                trigger: 'agent',
                summary: 'summary',
                compactedMessageCount: 12,
                cleanedToolResultCount: 3,
                syntheticMessages: [],
            }),
            estimateContextTokens: vi.fn().mockReturnValue(5_001),
            markCompactionAnchor: vi.fn(),
        };
        source = new HostDrivenSourceV2(messageServiceMock, topicId);
    });

    it('should return LLM filtered messages from MessageService', async () => {
        const messages = await source.getMessages();
        expect(messageServiceMock.getMessagesForLLM).toHaveBeenCalledWith(topicId);
        expect(messages).toHaveLength(1);
    });

    it('should expose context_compact tool', async () => {
        const tools = await source.getTools();
        expect(Object.keys(tools)).toContain('context_compact');
        expect((tools as any).context_compact.description).toContain('## Goal');
        expect((tools as any).context_compact.description).toContain('When to trigger compaction:');
        expect((tools as any).context_compact.description).toContain('## Relevant files / directories');
        expect((tools as any).context_compact.inputSchema.jsonSchema.required).toContain('summary');
    });

    it('should route context_compact execution to MessageService with agent trigger', async () => {
        const result = await source.executeTool('context_compact', {
            reason: 'manual request',
            summary: '## Goal\nmanual compact',
        }, 'tc_1');

        expect(messageServiceMock.compactContext).toHaveBeenCalledWith(topicId, {
            trigger: 'agent',
            reason: 'manual request',
            summary: '## Goal\nmanual compact',
            createSyntheticMessages: false,
        });

        expect(result).toEqual({
            toolCallId: 'tc_1',
            toolName: 'context_compact',
            result: {
                success: true,
                trigger: 'agent',
                summary: 'summary',
                compactedMessageCount: 12,
                cleanedToolResultCount: 3,
            },
        });
    });

    it('should allow force-triggering context_compact from agent tool call', async () => {
        await source.executeTool('context_compact', {
            reason: 'force test',
            summary: '## Goal\nforce compact',
            force: true,
        }, 'tc_force');

        expect(messageServiceMock.compactContext).toHaveBeenCalledWith(topicId, {
            trigger: 'agent',
            reason: 'force test',
            summary: '## Goal\nforce compact',
            minMessages: 1,
            keepRecentMessages: undefined,
            createSyntheticMessages: false,
        });
    });

    it('should reject context_compact call when summary is missing', async () => {
        const result = await source.executeTool('context_compact', { reason: 'missing summary' }, 'tc_missing');

        expect(messageServiceMock.compactContext).not.toHaveBeenCalled();
        expect(result).toEqual({
            toolCallId: 'tc_missing',
            toolName: 'context_compact',
            result: {
                success: false,
                trigger: 'agent',
                summary: '',
                compactedMessageCount: 0,
                cleanedToolResultCount: 0,
                note: 'context_compact requires a non-empty summary. Provide a continuation summary using the required template.',
            },
        });
    });

    it('should pass LLM-provided summary into context_compact call', async () => {
        await source.executeTool('context_compact', {
            reason: 'llm summary path',
            summary: '## Goal\ncompress now',
            force: true,
        }, 'tc_summary');

        expect(messageServiceMock.compactContext).toHaveBeenCalledWith(topicId, {
            trigger: 'agent',
            reason: 'llm summary path',
            summary: '## Goal\ncompress now',
            minMessages: 1,
            keepRecentMessages: undefined,
            createSyntheticMessages: false,
        });
    });

    it('should run hard fallback compaction with synthetic messages', () => {
        messageServiceMock.compactContext.mockReturnValueOnce({
            compacted: true,
            trigger: 'host_fallback',
            summary: 'fallback summary',
            compactedMessageCount: 9,
            cleanedToolResultCount: 2,
            syntheticMessages: [
                { id: 'a1', role: 'assistant', content: [], timestamp: Date.now() },
                { id: 't1', role: 'tool', content: [], timestamp: Date.now() },
            ],
        });

        const result = source.runHardFallbackCompaction('hard fallback');

        expect(messageServiceMock.compactContext).toHaveBeenCalledWith(topicId, {
            trigger: 'host_fallback',
            reason: 'hard fallback',
            createSyntheticMessages: true,
        });
        expect(result.compacted).toBe(true);
        expect(result.syntheticMessages).toHaveLength(2);
    });

    it('should only trigger threshold fallback when context exceeds threshold', () => {
        messageServiceMock.estimateContextTokens.mockReturnValueOnce(4_200);
        const low = source.maybeCompactByThreshold({ maxContextTokens: 4_500 });
        expect(low.compacted).toBe(false);
        expect(low.currentTokens).toBe(4_200);
        expect(low.thresholdTokens).toBe(4_500);

        messageServiceMock.estimateContextTokens.mockReturnValueOnce(4_900);
        const high = source.maybeCompactByThreshold({ maxContextTokens: 4_500 });
        expect(high.compacted).toBe(true);
        expect(high.currentTokens).toBe(4_900);
        expect(high.thresholdTokens).toBe(4_500);
    });

    it('should skip hard fallback when policy is disabled', () => {
        const result = source.maybeCompactByThreshold({
            enabled: false,
            maxContextTokens: 4_500,
        });

        expect(result.compacted).toBe(false);
        expect(messageServiceMock.estimateContextTokens).not.toHaveBeenCalled();
    });
});
