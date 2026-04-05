import { describe, expect, it, vi } from 'vitest'
import type { ModelMessage } from 'ai'
import { IMDrivenSource } from '../../src/im/im-driven-source'

describe('IMDrivenSource', () => {
  it('exposes stable source name', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })
    expect(source.name).toBe('IM')
    const tools = await source.getTools()
    expect(tools).toHaveProperty('context_compact')
    expect((tools as any).context_compact.description).toContain('## Goal')
    expect((tools as any).context_compact.description).toContain('protocol continuity')
    expect((tools as any).context_compact.description).toContain('## Relevant files / systems')
  })

  it('returns empty messages by default', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })
    expect(await source.getMessages()).toEqual([])
  })

  it('loads history once from loader', async () => {
    const loadHistory = vi.fn().mockResolvedValue([
      { role: 'user', content: 'old', timestamp: 1_000 },
    ])

    const source = new IMDrivenSource({ sessionKey: 's1', loadHistory })
    const first = await source.getMessages()
    const second = await source.getMessages()

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(first[0]).toMatchObject({
      role: 'user',
      content: 'old',
      timestamp: 1_000,
      region: 'session',
    })
    expect(loadHistory).toHaveBeenCalledTimes(1)
  })

  it('deduplicates persisted history against messages appended before first load', async () => {
    const loadHistory = vi.fn().mockResolvedValue([
      { role: 'user', content: 'hello', timestamp: 2_000 },
    ])
    const source = new IMDrivenSource({
      sessionKey: 's1',
      now: () => 2_000,
      loadHistory,
    })

    source.addMessage({ role: 'user', content: 'hello' })

    await expect(source.getMessages()).resolves.toEqual([
      { role: 'user', content: 'hello', timestamp: 2_000, region: 'session' },
    ])
  })

  it('adds message with generated timestamp', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1', now: () => 2_000 })

    const input: ModelMessage = { role: 'user', content: 'hello' }
    source.addMessage(input)

    expect(await source.getMessages()).toEqual([
      { role: 'user', content: 'hello', timestamp: 2_000, region: 'session' },
    ])
  })

  it('adds message with explicit timestamp override', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1', now: () => 2_000 })

    source.addMessage({ role: 'assistant', content: 'ok' }, 1_234)

    expect(await source.getMessages()).toEqual([
      { role: 'assistant', content: 'ok', timestamp: 1_234, region: 'session' },
    ])
  })

  it('executeTool returns undefined for unknown tools', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })
    await expect(source.executeTool('unknown', {}, 'tc1')).resolves.toBeUndefined()
  })

  it('context_compact requires a non-empty summary', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })

    await expect(source.executeTool('context_compact', {}, 'tc1')).resolves.toEqual({
      toolCallId: 'tc1',
      toolName: 'context_compact',
      result: expect.objectContaining({
        success: false,
        note: expect.stringContaining('non-empty summary'),
      }),
    })
  })

  it('context_compact rewrites IM history and persists replacement', async () => {
    const replaceHistory = vi.fn(async () => undefined)
    const source = new IMDrivenSource({
      sessionKey: 's1',
      replaceHistory,
      now: () => 9_999,
      loadHistory: async () => [
        { role: 'user', content: 'u1', timestamp: 1_000 },
        { role: 'assistant', content: 'a1', timestamp: 1_100 },
        { role: 'user', content: 'u2', timestamp: 1_200 },
        { role: 'assistant', content: 'a2', timestamp: 1_300 },
      ],
    })

    const result = await source.executeTool('context_compact', {
      summary: 'Summarized prior IM work.',
      minMessages: 1,
      keepRecentMessages: 2,
    }, 'tc2')

    expect(result).toEqual({
      toolCallId: 'tc2',
      toolName: 'context_compact',
      result: expect.objectContaining({
        success: true,
        summary: 'Summarized prior IM work.',
        compactedMessageCount: 2,
        cleanedToolResultCount: 0,
      }),
    })

    await expect(source.getMessages()).resolves.toEqual([
      {
        role: 'assistant',
        content: [
          expect.objectContaining({
            type: 'tool-call',
            toolName: 'context_compact',
            input: expect.objectContaining({
              trigger: 'agent',
            }),
          }),
        ],
        timestamp: 1_198,
        region: 'session',
      },
      {
        role: 'tool',
        content: [
          expect.objectContaining({
            type: 'tool-result',
            toolName: 'context_compact',
            result: expect.objectContaining({
              success: true,
              trigger: 'agent',
              summary: 'Summarized prior IM work.',
              compactedMessageCount: 4,
              cleanedToolResultCount: 0,
            }),
          }),
        ],
        timestamp: 1_199,
        region: 'session',
      },
      { role: 'user', content: 'u2', timestamp: 1_200, region: 'session' },
      { role: 'assistant', content: 'a2', timestamp: 1_300, region: 'session' },
    ])

    expect(replaceHistory).toHaveBeenCalledWith('s1', [
      expect.objectContaining({
        role: 'assistant',
        content: [
          expect.objectContaining({
            type: 'tool-call',
            toolName: 'context_compact',
          }),
        ],
        timestamp: 1_198,
        region: 'session',
      }),
      expect.objectContaining({
        role: 'tool',
        content: [
          expect.objectContaining({
            type: 'tool-result',
            toolName: 'context_compact',
          }),
        ],
        timestamp: 1_199,
        region: 'session',
      }),
      { role: 'user', content: 'u2', timestamp: 1_200 },
      { role: 'assistant', content: 'a2', timestamp: 1_300 },
    ])
  })

  it('context_compact skips when threshold is not met unless forced', async () => {
    const replaceHistory = vi.fn(async () => undefined)
    const source = new IMDrivenSource({
      sessionKey: 's1',
      replaceHistory,
      loadHistory: async () => [
        { role: 'user', content: 'only one', timestamp: 1_000 },
      ],
    })

    const result = await source.executeTool('context_compact', {
      summary: 'Keep going.',
      minMessages: 2,
    }, 'tc3')

    expect(result).toEqual({
      toolCallId: 'tc3',
      toolName: 'context_compact',
      result: expect.objectContaining({
        success: false,
        note: expect.stringContaining('did not meet minMessages threshold'),
      }),
    })
    expect(replaceHistory).not.toHaveBeenCalled()
  })

  it('keeps tool-call and tool-result together when preserving recent execution state', async () => {
    const source = new IMDrivenSource({
      sessionKey: 's1',
      loadHistory: async () => [
        { role: 'user', content: 'before tool', timestamp: 1_000 },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'call_1', toolName: 'search_files', input: { query: 'foo' } },
          ],
          timestamp: 1_100,
        },
        {
          role: 'tool',
          content: [
            { type: 'tool-result', toolCallId: 'call_1', toolName: 'search_files', result: { hits: 2 } },
          ],
          timestamp: 1_200,
        },
        { role: 'assistant', content: 'tool done', timestamp: 1_300 },
      ],
    })

    await source.executeTool('context_compact', {
      summary: '## Goal\nContinue after file search.',
      minMessages: 1,
      keepRecentMessages: 2,
    }, 'tc4')

    const messages = await source.getMessages()
    expect(messages).toEqual([
      expect.objectContaining({ role: 'assistant' }),
      expect.objectContaining({ role: 'tool' }),
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call_1', toolName: 'search_files', input: { query: 'foo' } },
        ],
        timestamp: 1_100,
        region: 'session',
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'call_1', toolName: 'search_files', result: { hits: 2 } },
        ],
        timestamp: 1_200,
        region: 'session',
      },
      { role: 'assistant', content: 'tool done', timestamp: 1_300, region: 'session' },
    ])
  })

  it('returns only the latest active window after a historical compaction anchor', async () => {
    const source = new IMDrivenSource({
      sessionKey: 's1',
      loadHistory: async () => [
        { role: 'user', content: 'old user', timestamp: 900 },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'compact_old', toolName: 'context_compact', input: { trigger: 'agent' } },
          ],
          timestamp: 998,
        },
        {
          role: 'tool',
          content: [
            { type: 'tool-result', toolCallId: 'compact_old', toolName: 'context_compact', result: { success: true, summary: 'old summary' } },
          ],
          timestamp: 999,
        },
        { role: 'user', content: 'new user', timestamp: 1_000 },
      ],
    })

    await expect(source.getMessages()).resolves.toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'compact_old', toolName: 'context_compact', input: { trigger: 'agent' } },
        ],
        timestamp: 998,
        region: 'session',
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-result', toolCallId: 'compact_old', toolName: 'context_compact', result: { success: true, summary: 'old summary' } },
        ],
        timestamp: 999,
        region: 'session',
      },
      { role: 'user', content: 'new user', timestamp: 1_000, region: 'session' },
    ])
  })

  it('notifyUpdate triggers subscriptions and unsubscribe works', () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })
    const callback = vi.fn()

    const unsubscribe = source.onUpdate(callback)

    source.notifyUpdate()
    expect(callback).toHaveBeenCalledTimes(1)

    unsubscribe()
    source.notifyUpdate()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('persists appended messages through callback', () => {
    const persistMessage = vi.fn()
    const source = new IMDrivenSource({ sessionKey: 's1', now: () => 9_999, persistMessage })

    source.addMessage({ role: 'user', content: 'persist-me' })

    expect(persistMessage).toHaveBeenCalledWith('s1', {
      role: 'user',
      content: 'persist-me',
      timestamp: 9_999,
      region: 'session',
    })
  })

  it('exposes compaction tool name and skips threshold compaction when disabled', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })

    expect(source.getCompactionToolName()).toBe('context_compact')
    await expect(source.maybeCompactByThreshold({
      enabled: false,
      maxContextTokens: 100,
    })).resolves.toEqual({
      compacted: false,
      syntheticMessages: [],
      summary: '',
      compactedMessageCount: 0,
      cleanedToolResultCount: 0,
      currentTokens: 0,
      thresholdTokens: 100,
    })
  })

  it('runs hard fallback compaction and emits synthetic anchor messages', async () => {
    const replaceHistory = vi.fn(async () => undefined)
    const source = new IMDrivenSource({
      sessionKey: 's1',
      replaceHistory,
      loadHistory: async () => [
        { role: 'user', content: 'need help', timestamp: 1_000 },
        { role: 'assistant', content: 'working', timestamp: 1_100 },
        { role: 'user', content: 'more context', timestamp: 1_200 },
        { role: 'assistant', content: 'more work', timestamp: 1_300 },
      ],
    })

    const result = await source.runHardFallbackCompaction('threshold reached', {
      minMessages: 1,
      keepRecentMessages: 2,
    })

    expect(result).toEqual({
      compacted: true,
      syntheticMessages: [
        expect.objectContaining({ role: 'assistant' }),
        expect.objectContaining({ role: 'tool' }),
      ],
      summary: expect.stringContaining('## Goal'),
      compactedMessageCount: 2,
      cleanedToolResultCount: 0,
    })
    expect(replaceHistory).toHaveBeenCalledTimes(1)
    await expect(source.getMessages()).resolves.toEqual([
      expect.objectContaining({ role: 'assistant' }),
      expect.objectContaining({ role: 'tool' }),
      { role: 'user', content: 'more context', timestamp: 1_200, region: 'session' },
      { role: 'assistant', content: 'more work', timestamp: 1_300, region: 'session' },
    ])
  })

  it('threshold compaction triggers when estimated tokens exceed the configured limit', async () => {
    const source = new IMDrivenSource({
      sessionKey: 's1',
      loadHistory: async () => [
        { role: 'user', content: 'x'.repeat(600), timestamp: 1_000 },
        { role: 'assistant', content: 'y'.repeat(600), timestamp: 1_100 },
        { role: 'user', content: 'z'.repeat(600), timestamp: 1_200 },
      ],
    })

    const result = await source.maybeCompactByThreshold({
      enabled: true,
      maxContextTokens: 50,
      minMessages: 1,
      keepRecentMessages: 1,
      modelHint: 'openai:gpt-4o',
    })

    expect(result.compacted).toBe(true)
    expect(result.currentTokens).toBeGreaterThan(50)
    expect(result.syntheticMessages).toHaveLength(2)
    await expect(source.getMessages()).resolves.toEqual([
      expect.objectContaining({ role: 'assistant' }),
      expect.objectContaining({ role: 'tool' }),
      { role: 'user', content: 'z'.repeat(600), timestamp: 1_200, region: 'session' },
    ])
  })
})
