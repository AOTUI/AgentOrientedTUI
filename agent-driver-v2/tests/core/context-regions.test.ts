import { describe, expect, it } from 'vitest';
import { assembleContextRegions, splitActiveTail } from '../../src/core/context-regions.js';
import type { MessageWithTimestamp } from '../../src/core/interfaces.js';

function toText(message: { content: any }): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content?.[0]?.text ?? message.content?.[0]?.toolName ?? '';
}

describe('context-regions', () => {
  it('orders messages by region before timestamp', () => {
    const messages: MessageWithTimestamp[] = [
      { role: 'user', content: 'dynamic-view', timestamp: 50, region: 'dynamic' },
      { role: 'user', content: 'static-msg', timestamp: 100, region: 'static' },
      { role: 'user', content: 'session-old', timestamp: 75, region: 'session' },
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'tc_1', toolName: 'tool_tail', input: {} }] as any,
        timestamp: 120,
        region: 'session',
      },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'tc_1', toolName: 'tool_tail', result: { ok: true } }] as any,
        timestamp: 121,
        region: 'session',
      },
    ];

    expect(assembleContextRegions(messages).map(toText)).toEqual([
      'static-msg',
      'session-old',
      'dynamic-view',
      'tool_tail',
      'tool_tail',
    ]);
  });

  it('moves the latest tool-call/tool-result suffix into active tail', () => {
    const { sessionMessages, activeTailMessages } = splitActiveTail([
      { role: 'user', content: 'session-old' },
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 'tc_2', toolName: 'search_files', input: {} }] as any,
      },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'tc_2', toolName: 'search_files', result: { ok: true } }] as any,
      },
    ] as any);

    expect(sessionMessages.map((message) => message.role)).toEqual(['user']);
    expect(activeTailMessages.map((message) => message.role)).toEqual(['assistant', 'tool']);
  });
});
