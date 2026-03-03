export interface ChannelStartContext {
  config: Record<string, unknown>
  channelConfig: Record<string, unknown>
}

/**
 * IReplyHandler — per-session outbound reply lifecycle.
 *
 * Each IM session gets its own handler instance via
 * `IChannelPlugin.createReplyHandler()`.  The bridge delegates
 * AgentDriver events to the handler without knowing channel specifics.
 */
export interface IReplyHandler {
  /** Incremental streaming text (accumulated by the bridge). */
  onPartialReply(text: string): Promise<void>
  /** Final complete assistant reply — handler should close streaming and/or send. */
  onFinalReply(text: string): Promise<void>
  /** Optional: incremental reasoning/thinking text. */
  onReasoningDelta?(text: string): Promise<void>
  /** Cleanup resources (e.g. close an in-flight streaming card). */
  cleanup(): Promise<void>
}

/**
 * Context passed to `createReplyHandler` so the channel can build
 * a handler for the specific IM conversation.
 */
export interface ReplyHandlerContext {
  chatType: 'direct' | 'group'
  chatId: string
  senderId: string
  accountId?: string
}

export interface IChannelPlugin {
  readonly id: string
  start(ctx: ChannelStartContext): Promise<void>
  stop(): Promise<void>

  /**
   * Create a per-session reply handler for outbound messages.
   *
   * When present, IMRuntimeBridge delegates all outbound events
   * (text_delta, reasoning_delta, assistant) to the returned handler.
   * This keeps channel-specific rendering (streaming cards, message
   * editing, etc.) inside the plugin — the bridge stays generic.
   */
  createReplyHandler?(ctx: ReplyHandlerContext): IReplyHandler
}
