import type { ModelMessage } from 'ai'
import type { HostManagerV2, GuiUpdateEvent } from '../core/host-manager-v2.js'
import { Config, type Info } from '../config/config.js'
import * as db from '../db/index.js'
import { IMGatewayManager } from './im-gateway-manager.js'
import { FeishuChannelPlugin } from './channels/feishu/channel.js'
import { resolveFeishuAccount } from './channels/feishu/accounts.js'
import { buildFeishuApiBase } from './channels/feishu/client.js'
import { sendTextMessage } from './channels/feishu/send.js'
import { getTenantAccessToken } from './channels/feishu/token-manager.js'
import { FeishuStreamingSession, type StreamingCardCredentials, type StreamingCardDeps } from './channels/feishu/streaming-card.js'
import { createFeishuReplyDispatcher, type FeishuStreamingSessionLike } from './channels/feishu/reply-dispatcher.js'
import type { IMInboundMessage } from './types.js'

type IMGatewayLike = Pick<IMGatewayManager, 'register' | 'startAll' | 'stopAll'>

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
  createFeishuChannelPlugin?: (options: { dispatch: (message: IMInboundMessage) => Promise<void> }) => {
    id: string
    start: (ctx: any) => Promise<void>
    stop: () => Promise<void>
  }
  sendFeishuText?: typeof sendTextMessage
  fetchTenantToken?: typeof getTenantAccessToken
  ensureTopic?: (topicId: string, agentId: string) => void
  /** Factory for creating streaming card sessions (injectable for testing) */
  createStreamingSession?: (creds: StreamingCardCredentials) => FeishuStreamingSessionLike
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

function getFeishuChannelConfig(config: Info): Record<string, unknown> | null {
  const channelConfig = config.im?.channels?.feishu
  if (!channelConfig || typeof channelConfig !== 'object') {
    return null
  }
  return channelConfig as Record<string, unknown>
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
  private readonly createFeishuChannelPlugin: NonNullable<IMRuntimeBridgeOptions['createFeishuChannelPlugin']>
  private readonly sendFeishuText: typeof sendTextMessage
  private readonly fetchTenantToken: typeof getTenantAccessToken
  private readonly ensureTopic: (topicId: string, agentId: string) => void
  private readonly createStreamingSession: (creds: StreamingCardCredentials) => FeishuStreamingSessionLike

  private unsubscribeGui: (() => void) | null = null
  private started = false
  private currentConfig: Info | null = null
  private readonly sessionRouteContext = new Map<string, SessionRouteContext>()

  /** Active reply dispatchers per session (manages streaming card lifecycle) */
  private readonly replyDispatchers = new Map<string, ReturnType<typeof createFeishuReplyDispatcher>>()
  /** Normalized stream text per session for text_delta events */
  private readonly accumulatedText = new Map<string, string>()
  /** Accumulated reasoning text per session for reasoning_delta events */
  private readonly accumulatedReasoning = new Map<string, string>()

  constructor(options: IMRuntimeBridgeOptions) {
    this.hostManager = options.hostManager
    this.getConfig = options.getConfig ?? (() => Config.get())
    this.gatewayManager = options.createGatewayManager ? options.createGatewayManager() : new IMGatewayManager()
    this.createFeishuChannelPlugin = options.createFeishuChannelPlugin ?? ((pluginOptions) => new FeishuChannelPlugin(pluginOptions))
    this.sendFeishuText = options.sendFeishuText ?? sendTextMessage
    this.fetchTenantToken = options.fetchTenantToken ?? getTenantAccessToken
    this.ensureTopic = options.ensureTopic ?? defaultEnsureTopic
    this.createStreamingSession = options.createStreamingSession ?? ((creds) => new FeishuStreamingSession(creds))
  }

  async start(): Promise<void> {
    if (this.started) {
      return
    }

    console.log('[IM] IMRuntimeBridge starting...')
    this.currentConfig = await this.getConfig()

    const feishuPlugin = this.createFeishuChannelPlugin({
      dispatch: async (message) => {
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
      },
    })

    this.gatewayManager.register(feishuPlugin as any)
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
    for (const [key, dispatcher] of this.replyDispatchers) {
      try {
        await dispatcher.cleanup()
      } catch (e) {
        console.error(`[IM] failed to cleanup streaming for ${key}:`, e)
      }
    }
    this.replyDispatchers.clear()
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
    if (!context || context.channel !== 'feishu') {
      return
    }

    const config = this.currentConfig ?? (await this.getConfig())
    const channelConfig = getFeishuChannelConfig(config)
    if (!channelConfig) {
      console.warn('[IM] no feishu channel config found for outbound reply')
      return
    }

    let account
    try {
      account = resolveFeishuAccount(channelConfig as any, context.accountId)
    } catch {
      return
    }

    const receiveIdType = context.chatType === 'group' ? 'chat_id' : 'open_id'
    const receiveId = context.chatType === 'group' ? context.chatId : context.senderId
    const apiBaseUrl = buildFeishuApiBase(account.domain as 'feishu' | 'lark', account.apiBaseUrl)
    // ── reasoning_delta: accumulate & stream to reasoning card element ────────
    if (event.type === 'reasoning_delta' && event.delta) {
      const prev = this.accumulatedReasoning.get(event.topicId) ?? ''
      const accumulated = normalizeStreamText(prev, event.delta)
      this.accumulatedReasoning.set(event.topicId, accumulated)

      let dispatcher = this.replyDispatchers.get(event.topicId)
      if (!dispatcher) {
        dispatcher = this.createDispatcherForSession(
          event.topicId,
          account,
          receiveIdType,
          receiveId,
          apiBaseUrl,
        )
        this.replyDispatchers.set(event.topicId, dispatcher)
      }

      try {
        await dispatcher.onReasoningDelta(accumulated)
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

      // Get or create reply dispatcher for this session
      let dispatcher = this.replyDispatchers.get(event.topicId)
      if (!dispatcher) {
        dispatcher = this.createDispatcherForSession(
          event.topicId,
          account,
          receiveIdType,
          receiveId,
          apiBaseUrl,
        )
        this.replyDispatchers.set(event.topicId, dispatcher)
      }

      try {
        await dispatcher.onPartialReply(accumulated)
      } catch (err) {
        console.error(`[IM] streaming update failed for ${event.topicId}:`, err)
      }
      return
    }

    // ── assistant: finalize reply ──────────────────────────────────
    if (event.type === 'assistant') {
      const text = extractTextContent(event.message)
      if (!text.trim()) return

      console.log(`[IM] outbound reply for session=${event.topicId}, channel=feishu, chatType=${context.chatType}`)

      const dispatcher = this.replyDispatchers.get(event.topicId)
      if (dispatcher) {
        // Streaming was active — close with final text
        try {
          await dispatcher.onFinalReply(text)
          console.log(`[IM] feishu streaming reply finalized for ${event.topicId}`)
        } catch (err) {
          console.error(`[IM] failed to finalize streaming reply for ${event.topicId}:`, err)
        }
        this.replyDispatchers.delete(event.topicId)
        this.accumulatedText.delete(event.topicId)
        this.accumulatedReasoning.delete(event.topicId)
      } else {
        // No streaming was started (very fast response) — fallback to plain text
        await this.sendPlainTextFallback(account, receiveIdType, receiveId, apiBaseUrl, text)
      }
    }
  }

  /**
   * Create a reply dispatcher for a session, wired to streaming card.
   */
  private createDispatcherForSession(
    sessionKey: string,
    account: { appId?: string; appSecret?: string; domain?: string; apiBaseUrl?: string },
    receiveIdType: 'chat_id' | 'open_id' | 'user_id' | 'email' | 'union_id',
    receiveId: string,
    apiBaseUrl: string,
  ) {
    const creds: StreamingCardCredentials = {
      appId: account.appId ?? '',
      appSecret: account.appSecret ?? '',
      domain: (account.domain as 'feishu' | 'lark' | undefined) ?? 'feishu',
      apiBaseUrl: account.apiBaseUrl,
    }
    const self = this

    return createFeishuReplyDispatcher({
      createStreamingSession: () => self.createStreamingSession(creds),
      sendMarkdownCard: async (payload) => {
        // Fallback: send as plain text when streaming wasn't used
        await self.sendPlainTextFallback(
          account,
          payload.receiveIdType,
          payload.receiveId,
          apiBaseUrl,
          payload.text,
        )
      },
      receiveId,
      receiveIdType,
      replyToMessageId: undefined,
    })
  }

  /**
   * Fallback: send a plain text message (used when streaming card isn't active).
   */
  private async sendPlainTextFallback(
    account: { appId?: string; appSecret?: string; domain?: string; apiBaseUrl?: string; botToken?: string },
    receiveIdType: 'chat_id' | 'open_id' | 'user_id' | 'email' | 'union_id',
    receiveId: string,
    apiBaseUrl: string,
    text: string,
  ): Promise<void> {
    let botToken = account.botToken
    if (!botToken) {
      if (!account.appId || !account.appSecret) {
        console.warn('[IM] cannot send reply: no botToken and no appId/appSecret configured')
        return
      }
      try {
        botToken = await this.fetchTenantToken({
          appId: account.appId,
          appSecret: account.appSecret,
          domain: account.domain as 'feishu' | 'lark' | undefined,
          apiBaseUrl: account.apiBaseUrl,
        })
      } catch (err) {
        console.error('[IM] failed to obtain tenant_access_token for feishu reply:', err)
        return
      }
    }

    try {
      await this.sendFeishuText({
        apiBaseUrl,
        botToken,
        receiveIdType,
        receiveId,
        text,
      })
      console.log(`[IM] feishu plain text reply sent to ${receiveIdType}=${receiveId}`)
    } catch (err) {
      console.error('[IM] failed to send feishu reply:', err)
    }
  }
}
