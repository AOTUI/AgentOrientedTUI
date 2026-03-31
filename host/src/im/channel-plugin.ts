export interface ChannelStartContext {
  config: Record<string, unknown>
  channelConfig: Record<string, unknown>
}

export interface ChannelMeta {
  label: string
  description?: string
}

export interface ChannelCapabilities {
  chatTypes: Array<'direct' | 'group'>
  media?: boolean
  threads?: boolean
  streaming?: boolean
  multiAccount?: boolean
  webhookInbound?: boolean
  websocketInbound?: boolean
}

export interface ChannelRuntimeState {
  started: boolean
  connectionMode?: 'websocket' | 'webhook'
  accountIds?: string[]
  sessionScopes?: string[]
  accounts?: Array<{
    accountId: string
    active: boolean
    appId?: string
    connectionMode?: 'websocket' | 'webhook'
    sessionScope?: string
  }>
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
  rootId?: string
}

export interface IChannelPlugin {
  readonly id: string
  readonly meta: ChannelMeta
  readonly capabilities: ChannelCapabilities
  start(ctx: ChannelStartContext): Promise<void>
  stop(): Promise<void>
  getRuntimeState?(): ChannelRuntimeState
  processWebhook?(event: unknown): Promise<{ accepted: boolean; reason?: string }>

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
