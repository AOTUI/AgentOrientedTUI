import type { ChannelStartContext, IChannelPlugin, IReplyHandler, ReplyHandlerContext } from '../../channel-plugin.js'
import { MessageDeduplicator } from '../../dedup.js'
import { resolveIMRoute } from '../../routing.js'
import type { IMInboundMessage, IMRoutingConfig } from '../../types.js'
import { listResolvedFeishuAccounts, resolveFeishuAccount } from './accounts.js'
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
  readonly meta = {
    label: 'Feishu',
    description: 'Feishu/Lark enterprise chat channel with direct, group, and threaded reply support.',
  }
  readonly capabilities = {
    chatTypes: ['direct', 'group'] as Array<'direct' | 'group'>,
    media: false,
    threads: true,
    streaming: true,
    multiAccount: true,
    webhookInbound: true,
    websocketInbound: true,
  }

  private readonly dispatch: (message: IMInboundMessage) => Promise<void>
  private readonly createGatewayImpl: NonNullable<FeishuChannelPluginOptions['createGateway']>
  private readonly createBotHandlerImpl?: FeishuChannelPluginOptions['createBotHandler']
  private readonly createWsClient?: () => FeishuWsClient
  private readonly routingConfig?: IMRoutingConfig
  private readonly createStreamingSessionImpl: (creds: StreamingCardCredentials) => FeishuStreamingSessionLike
  private readonly sendTextImpl: typeof sendTextMessage
  private readonly fetchTenantTokenImpl: typeof getTenantAccessToken

  private started = false
  private gateways = new Map<string, FeishuGatewayRuntime>()
  private botHandlers = new Map<string, FeishuBotRuntime>()
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
    const routingConfig = getRoutingConfig(ctx.config, this.routingConfig)
    this.started = true

    try {
      const accounts = listResolvedFeishuAccounts(parsedConfig)
      let startedAccounts = 0

      for (const account of accounts) {
        const accountId = account.accountId
        const dedup = new MessageDeduplicator()
        const baseHandler = createFeishuBotHandler({
          dedup,
          getConfig: async () => account,
          resolveRoute: (params) => {
            return resolveIMRoute({
              ...params,
              config: routingConfig,
            })
          },
          dispatch: this.dispatch,
        })
        const botHandler = this.createBotHandlerImpl ? this.createBotHandlerImpl(baseHandler) : baseHandler
        this.botHandlers.set(accountId, botHandler)

        const gateway = this.createGatewayImpl({
          connectionMode: account.connectionMode,
          createWsClient: this.createWsClient ?? (() => createRealFeishuWsClient({
            appId: account.appId,
            appSecret: account.appSecret,
            domain: account.domain,
            accountId,
          })),
          onEvent: async (event) => {
            const handler = this.botHandlers.get(event.accountId ?? accountId)
            await handler?.handle(event)
          },
        })

        try {
          await gateway.start()
          this.gateways.set(accountId, gateway)
          startedAccounts += 1
        } catch (error) {
          console.error(`[IM] feishu account "${accountId}" failed to start:`, error)
          this.botHandlers.delete(accountId)
        }
      }

      if (startedAccounts === 0) {
        throw new Error('no feishu accounts were started successfully')
      }
    } catch (error) {
      this.started = false
      this.gateways.clear()
      this.botHandlers.clear()
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return
    }

    this.started = false

    const gateways = Array.from(this.gateways.values())
    for (const gateway of gateways) {
      await gateway.stop()
    }

    this.gateways.clear()
    this.botHandlers.clear()
    this.parsedConfig = null
  }

  getRuntimeState() {
    const parsedConfig = this.parsedConfig
    const resolvedAccounts = parsedConfig
      ? listResolvedFeishuAccounts(parsedConfig)
      : []
    const accountIds = resolvedAccounts.length > 0
      ? resolvedAccounts.map((account) => account.accountId)
      : ['default']
    const sessionScopes = new Set<string>()
    if (parsedConfig) {
      sessionScopes.add(parsedConfig.sessionScope)
      for (const account of Object.values(parsedConfig.accounts ?? {})) {
        if (account?.sessionScope) {
          sessionScopes.add(account.sessionScope)
        }
      }
    }

    return {
      started: this.started && this.gateways.size > 0,
      connectionMode: parsedConfig?.connectionMode,
      accountIds,
      sessionScopes: Array.from(sessionScopes.values()).sort(),
      accounts: resolvedAccounts.map((account) => ({
        accountId: account.accountId,
        active: this.gateways.has(account.accountId),
        appId: account.appId,
        connectionMode: account.connectionMode,
        sessionScope: account.sessionScope,
      })),
    }
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
          rootId: ctx.rootId,
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
      rootId: ctx.rootId,
    })
  }

  async processWebhook(event: FeishuInboundEvent): Promise<{ accepted: boolean; reason?: string }> {
    if (!this.started || this.gateways.size === 0) {
      throw new Error('Feishu channel plugin is not started')
    }

    const accountId = event.accountId ?? 'default'
    const gateway = this.gateways.get(accountId) ?? this.gateways.get('default') ?? this.gateways.values().next().value
    if (!gateway) {
      throw new Error(`Feishu channel gateway not found for account: ${accountId}`)
    }

    return gateway.processWebhook(event)
  }
}
