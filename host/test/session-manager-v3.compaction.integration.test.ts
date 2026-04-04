import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ModelMessage } from 'ai';
import { SessionManagerV3 } from '../src/core/session-manager-v3.js';

const getTopicMock = vi.fn();
const configGetMock = vi.fn();

vi.mock('../src/db/index.js', () => ({
  getTopic: (...args: unknown[]) => getTopicMock(...args),
  updateTopic: vi.fn(),
}));

vi.mock('../src/config/config.js', () => ({
  Config: {
    get: (...args: unknown[]) => configGetMock(...args),
  },
}));

vi.mock('../src/mcp/source.js', () => ({
  McpDrivenSource: class McpDrivenSource {},
}));

describe('SessionManagerV3 compaction integration', () => {
  let manager: SessionManagerV3;
  let messageService: {
    addMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    messageService = {
      addMessage: vi.fn((topicId: string, message: ModelMessage) => ({
        ...(message as object),
        id: 'user_msg_1',
        timestamp: Date.now(),
      })),
    };

    manager = new SessionManagerV3(
      {} as any,
      {} as any,
      {} as any,
      messageService as any,
    );
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  it('applies merged compaction policy and emits synthetic compaction events before user message', async () => {
    getTopicMock.mockReturnValue({
      id: 'topic_1',
      modelOverride: 'openai:gpt-4o',
      contextCompaction: {
        keepRecentMessages: 6,
        hardFallbackThresholdTokens: 3200,
      },
    });

    configGetMock.mockResolvedValue({
      experimental: {
        contextCompaction: {
          enabled: true,
          minMessages: 20,
          keepRecentMessages: 10,
          hardFallbackThresholdTokens: 5000,
        },
      },
    });

    const maybeCompactByThreshold = vi.fn().mockReturnValue({
      compacted: true,
      syntheticMessages: [
        { id: 'compact_a', role: 'assistant', content: [], timestamp: Date.now() },
        { id: 'compact_t', role: 'tool', content: [], timestamp: Date.now() },
      ],
      summary: 'compacted',
      compactedMessageCount: 12,
      cleanedToolResultCount: 4,
      currentTokens: 4100,
      thresholdTokens: 3200,
    });

    const notifyNewMessage = vi.fn();
    (manager as any).ensureSession = vi.fn().mockResolvedValue({
      sources: {
        host: {
          maybeCompactByThreshold,
          notifyNewMessage,
        },
      },
    });

    const events: Array<{ type: string; message?: ModelMessage }> = [];
    manager.on('message', (event: any) => {
      events.push({ type: event.type, message: event.message });
    });

    await manager.sendMessage('topic_1', 'hello world');

    expect(maybeCompactByThreshold).toHaveBeenCalledWith({
      enabled: true,
      maxContextTokens: 3200,
      minMessages: 20,
      keepRecentMessages: 6,
      modelHint: 'openai:gpt-4o',
    });

    expect(messageService.addMessage).toHaveBeenCalledWith(
      'topic_1',
      expect.objectContaining({
        role: 'user',
        content: 'hello world',
      }),
    );

    expect(notifyNewMessage).toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual(['assistant', 'tool', 'user']);
  });

  it('marks compaction anchor only when context_compact succeeds', () => {
    const markToolCompactionAnchor = vi.fn();
    (manager as any).sessions.set('topic_1', {
      sources: {
        host: {
          getCompactionToolName: () => 'context_compact',
          markToolCompactionAnchor,
        },
      },
    });

    const successToolMessage: ModelMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolName: 'context_compact',
          toolCallId: 'tc_success',
          result: {
            success: true,
            summary: '## Goal\ncontinue',
          },
        },
      ],
    } as any;

    (manager as any).handleMessage('topic_1', 'tool', successToolMessage);

    expect(markToolCompactionAnchor).toHaveBeenCalledWith('user_msg_1', '## Goal\ncontinue');
    (manager as any).sessions.clear();
  });

  it('does not mark compaction anchor when context_compact is skipped/failed', () => {
    const markToolCompactionAnchor = vi.fn();
    (manager as any).sessions.set('topic_1', {
      sources: {
        host: {
          getCompactionToolName: () => 'context_compact',
          markToolCompactionAnchor,
        },
      },
    });

    const failedToolMessage: ModelMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolName: 'context_compact',
          toolCallId: 'tc_failed',
          result: {
            success: false,
            summary: '',
            note: 'skipped due threshold',
          },
        },
      ],
    } as any;

    (manager as any).handleMessage('topic_1', 'tool', failedToolMessage);

    expect(markToolCompactionAnchor).not.toHaveBeenCalled();
    (manager as any).sessions.clear();
  });
});
