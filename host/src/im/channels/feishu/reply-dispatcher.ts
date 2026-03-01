import type { FeishuReceiveIdType } from './targets.js'

export interface FeishuStreamingSessionLike {
  isActive: () => boolean
  start: (receiveId: string, receiveIdType: FeishuReceiveIdType, options?: { replyToMessageId?: string }) => Promise<void>
  update: (text: string) => Promise<void>
  close: (text?: string) => Promise<void>
}

export interface FeishuReplyDispatcherDeps {
  createStreamingSession: () => FeishuStreamingSessionLike
  sendMarkdownCard: (payload: {
    receiveId: string
    receiveIdType: FeishuReceiveIdType
    text: string
    replyToMessageId?: string
  }) => Promise<void>
  receiveId: string
  receiveIdType: FeishuReceiveIdType
  replyToMessageId?: string
}

export function createFeishuReplyDispatcher(deps: FeishuReplyDispatcherDeps) {
  let streaming: FeishuStreamingSessionLike | null = null
  let started = false

  function ensureStreaming(): FeishuStreamingSessionLike {
    if (!streaming) {
      streaming = deps.createStreamingSession()
    }
    return streaming
  }

  return {
    async onPartialReply(text: string): Promise<void> {
      const stream = ensureStreaming()
      if (!started) {
        await stream.start(deps.receiveId, deps.receiveIdType, {
          replyToMessageId: deps.replyToMessageId,
        })
        started = true
      }
      await stream.update(text)
    },

    async onFinalReply(text: string): Promise<void> {
      if (streaming?.isActive()) {
        await streaming.close(text)
        return
      }

      await deps.sendMarkdownCard({
        receiveId: deps.receiveId,
        receiveIdType: deps.receiveIdType,
        text,
        replyToMessageId: deps.replyToMessageId,
      })
    },

    async cleanup(): Promise<void> {
      if (streaming?.isActive()) {
        await streaming.close()
      }
    },
  }
}
