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
  let startAttempted = false
  let startPromise: Promise<void> | null = null
  let lastPartial = ''
  let lastSentPartial = ''
  let partialUpdateQueue: Promise<void> = Promise.resolve()

  function ensureStreaming(): FeishuStreamingSessionLike {
    if (!streaming) {
      streaming = deps.createStreamingSession()
    }
    return streaming
  }

  async function ensureStarted(): Promise<boolean> {
    if (started) {
      return true
    }

    if (startPromise) {
      await startPromise
      return started
    }

    // One start attempt per dispatcher lifecycle.
    // If streaming start fails, we degrade to final plain-text/card send in onFinalReply.
    if (startAttempted) {
      return false
    }

    startAttempted = true
    const stream = ensureStreaming()
    startPromise = (async () => {
      await stream.start(deps.receiveId, deps.receiveIdType, {
        replyToMessageId: deps.replyToMessageId,
      })
      started = true
    })()

    try {
      await startPromise
    } catch {
      started = false
    } finally {
      startPromise = null
    }

    return started
  }

  return {
    async onPartialReply(text: string): Promise<void> {
      if (!text || text === lastPartial) {
        return
      }
      lastPartial = text
      const textSnapshot = text

      partialUpdateQueue = partialUpdateQueue.then(async () => {
        const ok = await ensureStarted()
        if (!ok || !streaming?.isActive()) {
          return
        }
        if (textSnapshot === lastSentPartial) {
          return
        }
        await streaming.update(textSnapshot)
        lastSentPartial = textSnapshot
      })

      await partialUpdateQueue
    },

    async onFinalReply(text: string): Promise<void> {
      await partialUpdateQueue
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
      await partialUpdateQueue
      if (streaming?.isActive()) {
        await streaming.close()
      }
    },
  }
}
