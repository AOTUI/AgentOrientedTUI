import type { ChannelStartContext, IChannelPlugin, IReplyHandler, ReplyHandlerContext } from '../../channel-plugin.js'
import { MessageDeduplicator } from '../../dedup.js'
import { resolveIMRoute } from '../../routing.js'
import type { IMInboundMessage, IMRoutingConfig } from '../../types.js'
import { resolveFeishuAccount } from './accounts.js'
import { createFeishuBotHandler, type FeishuInboundEvent } from './bot.js'
import { buildFeishuApiBase } from './client.js'
import { parseFeishuConfig, type FeishuChannelConfigInput, type FeishuChannelConfig } from './config-schema.js'
import { createFeishuGateway, type FeishuGatewayEvent, type FeishuWsClient } from './gateway.js'
import { createFeishuReplyDispatcher, type FeishuStreamingSessionLike } from './reply-dispatcher.js'
import { sendTextMessage } from './send.js'
import { FeishuStreamingSession, type StreamingCardCredentials } from './streaming-card.js'
import { getTenantAccessToken } from './token-manager.js'
import { createRealFeishuWsClient } from './ws-client.js'

export type FeishuChannelInboundEvent = FeishuGatewayEvent

export interface FeishuGatewayRuntime {
  start: () => Promise<void>
  stop: () => Promise<void>
  processWebhook: (event: FeishuChannelInboundEvent) => Promise<{ accepted: boolean; reason?: string }>
}

export interface FeishuBotRuntime {
  handle: (event: FeishuChannelInboundEvent) => Promise<{ accepted: boolean; reason?: string }>
}

export interface FeishuChannelPluginOptions {
  dispatch: (message: IMInboundMessage) => Promise<void>
  routingConfig?: IMRoutingConfig
  createGateway?: (deps: {
    connectionMode: 'websocket' | 'webhook'
    onEvent: (event: FeishuChannelInboundEvent) => Promise<void>
    createWsClient?: () => FeishuWsClient
  }) => FeishuGatewayRuntime
  createBotHandler?: (baseHandler: FeishuBotRuntime) => FeishuBotRuntime
  createWsClient?: () => FeishuWsClient
  /** Factory for streaming card sessions (injectable for testing) */
  createStreamingSession?: (creds: StreamingCardCredentials) => FeishuStreamingSessionLike
  /** Send plain text fallback (injectable for testing) */
  sendText?: typeof sendTextMessage
  /** Fetch tenant token (injectable for testing) */
  fetchTenantToken?: typeof getTenantAccessToken
}

function toChannelInput(value: Record<string, unknown>): FeishuChannelConfigInput {
  return value as unknown as FeishuChannelConfigInput
}

function getRoutingConfig(
  contextConfig: Record<string, unknown>,
  fallback?: IMRoutingConfig,
): IMRoutingConfig {
  if (fallback) {
    return fallback
  }
  return contextConfig as unknown as IMRoutingConfig
}

export class FeishuChannelPlugin implements IChannelPlugin {
  readonly id = 'feishu'

  private readonly dispatch: (message: IMInboundMessage) => Promise<void>
  private readonly createGatewayImpl: NonNullable<FeishuChannelPluginOptions['createGateway']>
  private readonly createBotHandlerImpl?: FeishuChannelPluginOptions['createBotHandler']
  private readonly createWsClient?: () => FeishuWsClient
  private readonly routingConfig?: IMRoutingConfig
  private readonly createStreamingSessionImpl: (creds: StreamingCardCredentials) => FeishuStreamingSessionLike
  private readonly sendTextImpl: typeof sendTextMessage
  private readonly fetchTenantTokenImpl: typeof getTenantAccessToken

  private started = false
  private gateway: FeishuGatewayRuntime | null = null
  private botHandler: FeishuBotRuntime | null = null
  private parsedConfig: FeishuChannelConfig | null = null

  constructor(options: FeishuChannelPluginOptions) {
    this.dispatch = options.dispatch
    this.createGatewayImpl = options.createGateway ?? createFeishuGateway
    this.createBotHandlerImpl = options.createBotHandler
    this.createWsClient = options.createWsClient
    this.routingConfig = options.routingConfig
    this.createStreamingSessionImpl = options.createStreamingSession ?? ((creds) => new FeishuStreamingSession(creds))
    this.sendTextImpl = options.sendText ?? sendTextMessage
    this.fetchTenantTokenImpl = options.fetchTenantToken ?? getTenantAccessToken
  }

  async start(ctx: ChannelStartContext): Promise<void> {
    if (this.started) {
      return
    }

    const channelInput = toChannelInput(ctx.channelConfig)
    if (channelInput.enabled === false) {
      return
    }

    const parsedConfig = parseFeishuConfig(channelInput)
    this.parsedConfig = parsedConfig
    const dedup = new MessageDeduplicator()
    const routingConfig = getRoutingConfig(ctx.config, this.routingConfig)

    const defaultBotHandler = createFeishuBotHandler({
      dedup,
      getConfig: async (accountId?: string) => {
        return resolveFeishuAccount(parsedConfig, accountId)
      },
      resolveRoute: (params) => {
        return resolveIMRoute({
          ...params,
          config: routingConfig,
        })
      },
      dispatch: this.dispatch,
    })

    this.botHandler = this.createBotHandlerImpl ? this.createBotHandlerImpl(defaultBotHandler) : defaultBotHandler

    const gateway = this.createGatewayImpl({
      connectionMode: parsedConfig.connectionMode,
      createWsClient: this.createWsClient ?? (() => createRealFeishuWsClient({
        appId: parsedConfig.appId,
        appSecret: parsedConfig.appSecret,
        domain: parsedConfig.domain,
      })),
      onEvent: async (event) => {
        await this.botHandler?.handle(event)
      },
    })

    this.gateway = gateway
    this.started = true

    try {
      await gateway.start()
    } catch (error) {
      this.started = false
      this.gateway = null
      this.botHandler = null
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return
    }

    this.started = false

    if (this.gateway) {
      await this.gateway.stop()
    }

    this.gateway = null
    this.botHandler = null
    this.parsedConfig = null
  }

  /**
   * Create a per-session reply handler for outbound Feishu messages.
   *
   * Encapsulates account resolution, streaming card lifecycle, and
   * plain-text fallback — the bridge only sees `IReplyHandler`.
   */
  createReplyHandler(ctx: ReplyHandlerContext): IReplyHandler {
    if (!this.parsedConfig) {
      throw new Error('Feishu channel plugin is not started')
    }

    const account = resolveFeishuAccount(this.parsedConfig as FeishuChannelConfigInput, ctx.accountId)
    const receiveIdType = ctx.chatType === 'group' ? 'chat_id' as const : 'open_id' as const
    const receiveId = ctx.chatType === 'group' ? ctx.chatId : ctx.senderId
    const apiBaseUrl = buildFeishuApiBase(account.domain as 'feishu' | 'lark', account.apiBaseUrl)

    const creds: StreamingCardCredentials = {
      appId: account.appId ?? '',
      appSecret: account.appSecret ?? '',
      domain: (account.domain as 'feishu' | 'lark' | undefined) ?? 'feishu',
      apiBaseUrl: account.apiBaseUrl,
    }

    const sendTextFn = this.sendTextImpl
    const fetchToken = this.fetchTenantTokenImpl
    const createSession = this.createStreamingSessionImpl

    const sendPlainText = async (text: string): Promise<void> => {
      let botToken = account.botToken
      if (!botToken) {
        if (!account.appId || !account.appSecret) {
          console.warn('[IM] cannot send reply: no botToken and no appId/appSecret configured')
          return
        }
        try {
          botToken = await fetchToken({
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
        await sendTextFn({
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

    return createFeishuReplyDispatcher({
      createStreamingSession: () => createSession(creds),
      sendMarkdownCard: async (payload) => {
        await sendPlainText(payload.text)
      },
      receiveId,
      receiveIdType,
      replyToMessageId: undefined,
    })
  }

  async processWebhook(event: FeishuInboundEvent): Promise<{ accepted: boolean; reason?: string }> {
    if (!this.gateway || !this.started) {
      throw new Error('Feishu channel plugin is not started')
    }

    return this.gateway.processWebhook(event)
  }
}
