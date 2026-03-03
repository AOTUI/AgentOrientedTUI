import type { ModelMessage } from 'ai'
import type { HostManagerV2, GuiUpdateEvent } from '../core/host-manager-v2.js'
import { Config, type Info } from '../config/config.js'
import * as db from '../db/index.js'
import { IMGatewayManager } from './im-gateway-manager.js'
import type { IChannelPlugin, IReplyHandler } from './channel-plugin.js'
import type { IMInboundMessage } from './types.js'

type IMGatewayLike = Pick<IMGatewayManager, 'register' | 'startAll' | 'stopAll' | 'getChannel'>

type SessionRouteContext = {
  channel: string
  chatType: 'direct' | 'group'
  chatId: string
  senderId: string
  accountId?: string
  agentId?: string
}

export interface IMRuntimeBridgeOptions {
  hostManager: Pick<HostManagerV2, 'sendUserMessage' | 'onGuiUpdate'>
  getConfig?: () => Promise<Info>
  createGatewayManager?: () => IMGatewayLike
  /**
   * Factory that creates channel plugins.
   * Receives the bridge's inbound dispatch function so plugins can
   * route incoming IM messages back into the host pipeline.
   * When omitted, no channels are registered.
   */
  createChannelPlugins?: (dispatch: (message: IMInboundMessage) => Promise<void>) => IChannelPlugin[]
  ensureTopic?: (topicId: string, agentId: string) => void
}

function extractTextContent(message: ModelMessage | undefined): string {
  if (!message) {
    return ''
  }

  if (typeof message.content === 'string') {
    return message.content
  }

  if (Array.isArray(message.content)) {
    const firstTextPart = message.content.find(
      (part): part is { type: 'text'; text: string } =>
        Boolean(part) &&
        typeof part === 'object' &&
        'type' in part &&
        (part as { type?: unknown }).type === 'text' &&
        'text' in part &&
        typeof (part as { text?: unknown }).text === 'string',
    )
    return firstTextPart?.text ?? ''
  }

  return ''
}

/**
 * Normalize streaming text payload.
 *
 * Some upstreams emit true delta chunks, while others may emit cumulative
 * partial text. This helper supports both forms to avoid duplicated content.
 */
function normalizeStreamText(previous: string, incoming: string): string {
  if (!incoming) {
    return previous
  }
  if (!previous) {
    return incoming
  }

  // Incoming is cumulative snapshot (starts with previous): replace with incoming.
  if (incoming.startsWith(previous)) {
    return incoming
  }

  // Exact duplicate chunk: keep as-is.
  if (incoming === previous) {
    return previous
  }

  // Normal incremental delta: append.
  return previous + incoming
}

/**
 * Ensure a Topic record exists in the DB for an IM session.
 *
 * This is required because SessionManagerV3.createSession() reads
 * topic.agentId from the DB to apply agent customization (prompt,
 * model, tools, etc.). Without a DB record, the session falls back
 * to system defaults regardless of the configured botAgentId.
 */
function defaultEnsureTopic(topicId: string, agentId: string): void {
  const existing = db.getTopic(topicId)
  if (existing) {
    // Topic exists — update agentId if changed
    if (existing.agentId !== agentId) {
      db.updateTopic(topicId, { agentId, updatedAt: Date.now() })
      console.log(`[IM] updated topic agentId: ${topicId} → ${agentId}`)
    }
    return
  }

  // Create a new topic for this IM session
  db.createTopic({
    id: topicId,
    title: `IM: ${topicId.replace(/^agent:[^:]+:/, '')}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'hot',
    agentId,
  })
  console.log(`[IM] created topic for IM session: ${topicId} (agentId=${agentId})`)
}

export class IMRuntimeBridge {
  private readonly hostManager: Pick<HostManagerV2, 'sendUserMessage' | 'onGuiUpdate'>
  private readonly getConfig: () => Promise<Info>
  private readonly gatewayManager: IMGatewayLike
  private readonly createChannelPlugins: (dispatch: (message: IMInboundMessage) => Promise<void>) => IChannelPlugin[]
  private readonly ensureTopic: (topicId: string, agentId: string) => void

  private unsubscribeGui: (() => void) | null = null
  private started = false
  private currentConfig: Info | null = null
  private readonly sessionRouteContext = new Map<string, SessionRouteContext>()

  /** Active reply handlers per session (manages streaming lifecycle) */
  private readonly replyHandlers = new Map<string, IReplyHandler>()
  /** Normalized stream text per session for text_delta events */
  private readonly accumulatedText = new Map<string, string>()
  /** Accumulated reasoning text per session for reasoning_delta events */
  private readonly accumulatedReasoning = new Map<string, string>()

  constructor(options: IMRuntimeBridgeOptions) {
    this.hostManager = options.hostManager
    this.getConfig = options.getConfig ?? (() => Config.get())
    this.gatewayManager = options.createGatewayManager ? options.createGatewayManager() : new IMGatewayManager()
    this.createChannelPlugins = options.createChannelPlugins ?? (() => [])
    this.ensureTopic = options.ensureTopic ?? defaultEnsureTopic
  }

  async start(): Promise<void> {
    if (this.started) {
      return
    }

    console.log('[IM] IMRuntimeBridge starting...')
    this.currentConfig = await this.getConfig()

    // Build the inbound dispatch function that wires IM → HostManager
    const dispatch = async (message: IMInboundMessage): Promise<void> => {
      console.log(`[IM] dispatching inbound message: session=${message.sessionKey}, channel=${message.channel}, agentId=${message.agentId}`)
      this.sessionRouteContext.set(message.sessionKey, {
        channel: message.channel,
        chatType: message.chatType,
        chatId: message.chatId,
        senderId: message.senderId,
        accountId: message.accountId,
        agentId: message.agentId,
      })

      // Ensure a Topic record exists in the DB with the correct agentId
      // so that SessionManagerV3.createSession() can apply agent customization.
      try {
        this.ensureTopic(message.sessionKey, message.agentId)
      } catch (err) {
        console.error(`[IM] failed to ensure topic for ${message.sessionKey}:`, err)
      }

      await this.hostManager.sendUserMessage(message.body, message.sessionKey, message.messageId)
    }

    // Create and register all channel plugins
    const plugins = this.createChannelPlugins(dispatch)
    for (const plugin of plugins) {
      this.gatewayManager.register(plugin)
    }

    await this.gatewayManager.startAll(this.currentConfig as Record<string, unknown>)

    this.unsubscribeGui = this.hostManager.onGuiUpdate((event: GuiUpdateEvent) => {
      void this.onGuiUpdate(event)
    })

    this.started = true
    console.log('[IM] IMRuntimeBridge started')
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return
    }

    if (this.unsubscribeGui) {
      this.unsubscribeGui()
      this.unsubscribeGui = null
    }

    // Cleanup any in-flight streaming sessions
    for (const [key, handler] of this.replyHandlers) {
      try {
        await handler.cleanup()
      } catch (e) {
        console.error(`[IM] failed to cleanup streaming for ${key}:`, e)
      }
    }
    this.replyHandlers.clear()
    this.accumulatedText.clear()
    this.accumulatedReasoning.clear()

    await this.gatewayManager.stopAll()

    this.sessionRouteContext.clear()
    this.started = false
  }

  private async onGuiUpdate(event: GuiUpdateEvent): Promise<void> {
    // Handle text_delta (streaming), reasoning_delta (thinking), and assistant (final) events
    if (event.type !== 'text_delta' && event.type !== 'reasoning_delta' && event.type !== 'assistant') {
      return
    }

    const context = this.sessionRouteContext.get(event.topicId)
    if (!context) {
      return
    }

    // Look up the channel plugin — delegate outbound to the plugin's reply handler
    const plugin = this.gatewayManager.getChannel(context.channel)
    if (!plugin?.createReplyHandler) {
      return
    }

    // ── reasoning_delta: accumulate & stream to reasoning element ────────
    if (event.type === 'reasoning_delta' && event.delta) {
      const prev = this.accumulatedReasoning.get(event.topicId) ?? ''
      const accumulated = normalizeStreamText(prev, event.delta)
      this.accumulatedReasoning.set(event.topicId, accumulated)

      let handler = this.replyHandlers.get(event.topicId)
      if (!handler) {
        handler = plugin.createReplyHandler({
          chatType: context.chatType,
          chatId: context.chatId,
          senderId: context.senderId,
          accountId: context.accountId,
        })
        this.replyHandlers.set(event.topicId, handler)
      }

      try {
        await handler.onReasoningDelta?.(accumulated)
      } catch (err) {
        console.error(`[IM] reasoning delta update failed for ${event.topicId}:`, err)
      }
      return
    }

    // ── text_delta: accumulate & stream ────────────────────────────
    if (event.type === 'text_delta' && event.delta) {
      const prev = this.accumulatedText.get(event.topicId) ?? ''
      const accumulated = normalizeStreamText(prev, event.delta)
      this.accumulatedText.set(event.topicId, accumulated)

      // Get or create reply handler for this session
      let handler = this.replyHandlers.get(event.topicId)
      if (!handler) {
        handler = plugin.createReplyHandler({
          chatType: context.chatType,
          chatId: context.chatId,
          senderId: context.senderId,
          accountId: context.accountId,
        })
        this.replyHandlers.set(event.topicId, handler)
      }

      try {
        await handler.onPartialReply(accumulated)
      } catch (err) {
        console.error(`[IM] streaming update failed for ${event.topicId}:`, err)
      }
      return
    }

    // ── assistant: finalize reply ──────────────────────────────────
    if (event.type === 'assistant') {
      const text = extractTextContent(event.message)
      if (!text.trim()) return

      console.log(`[IM] outbound reply for session=${event.topicId}, channel=${context.channel}, chatType=${context.chatType}`)

      const handler = this.replyHandlers.get(event.topicId)
      if (handler) {
        // Streaming was active — close with final text
        try {
          await handler.onFinalReply(text)
          console.log(`[IM] streaming reply finalized for ${event.topicId}`)
        } catch (err) {
          console.error(`[IM] failed to finalize streaming reply for ${event.topicId}:`, err)
        }
        this.replyHandlers.delete(event.topicId)
        this.accumulatedText.delete(event.topicId)
        this.accumulatedReasoning.delete(event.topicId)
      } else {
        // No streaming was started (very fast response) — create handler for one-shot send
        const oneshot = plugin.createReplyHandler({
          chatType: context.chatType,
          chatId: context.chatId,
          senderId: context.senderId,
          accountId: context.accountId,
        })
        try {
          await oneshot.onFinalReply(text)
          console.log(`[IM] one-shot reply sent for ${event.topicId}`)
        } catch (err) {
          console.error(`[IM] failed to send one-shot reply for ${event.topicId}:`, err)
        }
      }
    }
  }
}
