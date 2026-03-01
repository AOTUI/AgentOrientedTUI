import { describe, expect, it, vi } from 'vitest'
import { createFeishuReplyDispatcher } from '../../../../src/im/channels/feishu/reply-dispatcher.js'

describe('Feishu reply dispatcher', () => {
  it('starts streaming once on first partial', async () => {
    const streaming = {
      isActive: vi.fn(() => true),
      start: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }

    const dispatcher = createFeishuReplyDispatcher({
      createStreamingSession: vi.fn(() => streaming as any),
      sendMarkdownCard: vi.fn(async () => undefined),
      receiveId: 'oc_1',
      receiveIdType: 'chat_id',
    })

    await dispatcher.onPartialReply('hello')
    await dispatcher.onPartialReply(' world')

    expect(streaming.start).toHaveBeenCalledTimes(1)
    expect(streaming.update).toHaveBeenCalledTimes(2)
  })

  it('closes streaming on final reply when active', async () => {
    const streaming = {
      isActive: vi.fn(() => true),
      start: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }

    const dispatcher = createFeishuReplyDispatcher({
      createStreamingSession: vi.fn(() => streaming as any),
      sendMarkdownCard: vi.fn(async () => undefined),
      receiveId: 'oc_1',
      receiveIdType: 'chat_id',
    })

    await dispatcher.onPartialReply('hello')
    await dispatcher.onFinalReply('final answer')

    expect(streaming.close).toHaveBeenCalledWith('final answer')
  })

  it('falls back to markdown card when streaming never started', async () => {
    const sendMarkdownCard = vi.fn(async () => undefined)

    const dispatcher = createFeishuReplyDispatcher({
      createStreamingSession: vi.fn(),
      sendMarkdownCard,
      receiveId: 'oc_1',
      receiveIdType: 'chat_id',
      replyToMessageId: 'om_1',
    })

    await dispatcher.onFinalReply('final answer')

    expect(sendMarkdownCard).toHaveBeenCalledWith({
      receiveId: 'oc_1',
      receiveIdType: 'chat_id',
      text: 'final answer',
      replyToMessageId: 'om_1',
    })
  })

  it('cleanup closes active streaming session', async () => {
    const streaming = {
      isActive: vi.fn(() => true),
      start: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }

    const dispatcher = createFeishuReplyDispatcher({
      createStreamingSession: vi.fn(() => streaming as any),
      sendMarkdownCard: vi.fn(async () => undefined),
      receiveId: 'oc_1',
      receiveIdType: 'chat_id',
    })

    await dispatcher.onPartialReply('hello')
    await dispatcher.cleanup()

    expect(streaming.close).toHaveBeenCalledTimes(1)
  })

  it('does not close inactive stream on cleanup', async () => {
    const streaming = {
      isActive: vi.fn(() => false),
      start: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }

    const dispatcher = createFeishuReplyDispatcher({
      createStreamingSession: vi.fn(() => streaming as any),
      sendMarkdownCard: vi.fn(async () => undefined),
      receiveId: 'oc_1',
      receiveIdType: 'chat_id',
    })

    await dispatcher.onPartialReply('hello')
    await dispatcher.cleanup()

    expect(streaming.close).not.toHaveBeenCalled()
  })

  it('reuses same streaming session instance', async () => {
    const streaming = {
      isActive: vi.fn(() => true),
      start: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }

    const createStreamingSession = vi.fn(() => streaming as any)
    const dispatcher = createFeishuReplyDispatcher({
      createStreamingSession,
      sendMarkdownCard: vi.fn(async () => undefined),
      receiveId: 'oc_1',
      receiveIdType: 'chat_id',
    })

    await dispatcher.onPartialReply('a')
    await dispatcher.onPartialReply('b')

    expect(createStreamingSession).toHaveBeenCalledTimes(1)
  })

  it('passes replyToMessageId into stream start', async () => {
    const streaming = {
      isActive: vi.fn(() => true),
      start: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }

    const dispatcher = createFeishuReplyDispatcher({
      createStreamingSession: vi.fn(() => streaming as any),
      sendMarkdownCard: vi.fn(async () => undefined),
      receiveId: 'oc_1',
      receiveIdType: 'chat_id',
      replyToMessageId: 'om_reply',
    })

    await dispatcher.onPartialReply('hello')

    expect(streaming.start).toHaveBeenCalledWith('oc_1', 'chat_id', { replyToMessageId: 'om_reply' })
  })

  it('passes open_id to stream start for direct messages', async () => {
    const streaming = {
      isActive: vi.fn(() => true),
      start: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    }

    const dispatcher = createFeishuReplyDispatcher({
      createStreamingSession: vi.fn(() => streaming as any),
      sendMarkdownCard: vi.fn(async () => undefined),
      receiveId: 'ou_direct_1',
      receiveIdType: 'open_id',
    })

    await dispatcher.onPartialReply('hello')

    expect(streaming.start).toHaveBeenCalledWith('ou_direct_1', 'open_id', { replyToMessageId: undefined })
  })

  it('throws when partial update fails', async () => {
    const streaming = {
      isActive: vi.fn(() => true),
      start: vi.fn(async () => undefined),
      update: vi.fn(async () => {
        throw new Error('update failed')
      }),
      close: vi.fn(async () => undefined),
    }

    const dispatcher = createFeishuReplyDispatcher({
      createStreamingSession: vi.fn(() => streaming as any),
      sendMarkdownCard: vi.fn(async () => undefined),
      receiveId: 'oc_1',
      receiveIdType: 'chat_id',
    })

    await expect(dispatcher.onPartialReply('hello')).rejects.toThrow(/update failed/i)
  })
})
