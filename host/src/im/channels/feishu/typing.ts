export interface FeishuTypingDeps {
  sendReaction: (input: {
    chatId: string
    messageId: string
    action: 'add' | 'remove'
    emojiType: string
  }) => Promise<void>
  chatId: string
  messageId: string
  emojiType?: string
}

export function createFeishuTypingController(deps: FeishuTypingDeps) {
  let started = false
  const emojiType = deps.emojiType ?? 'hourglass'

  return {
    async start(): Promise<void> {
      if (started) {
        return
      }
      await deps.sendReaction({
        chatId: deps.chatId,
        messageId: deps.messageId,
        action: 'add',
        emojiType,
      })
      started = true
    },

    async stop(): Promise<void> {
      if (!started) {
        return
      }
      await deps.sendReaction({
        chatId: deps.chatId,
        messageId: deps.messageId,
        action: 'remove',
        emojiType,
      })
      started = false
    },

    async cleanup(): Promise<void> {
      await this.stop()
    },
  }
}
