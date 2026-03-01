import type { ChannelStartContext, IChannelPlugin } from '../../channel-plugin.js'
import { MessageDeduplicator } from '../../dedup.js'
import { resolveIMRoute } from '../../routing.js'
import type { IMInboundMessage, IMRoutingConfig } from '../../types.js'
import { resolveFeishuAccount } from './accounts.js'
import { createFeishuBotHandler, type FeishuInboundEvent } from './bot.js'
import { parseFeishuConfig, type FeishuChannelConfigInput } from './config-schema.js'
import { createFeishuGateway, type FeishuGatewayEvent, type FeishuWsClient } from './gateway.js'
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

  private started = false
  private gateway: FeishuGatewayRuntime | null = null
  private botHandler: FeishuBotRuntime | null = null

  constructor(options: FeishuChannelPluginOptions) {
    this.dispatch = options.dispatch
    this.createGatewayImpl = options.createGateway ?? createFeishuGateway
    this.createBotHandlerImpl = options.createBotHandler
    this.createWsClient = options.createWsClient
    this.routingConfig = options.routingConfig
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
  }

  async processWebhook(event: FeishuInboundEvent): Promise<{ accepted: boolean; reason?: string }> {
    if (!this.gateway || !this.started) {
      throw new Error('Feishu channel plugin is not started')
    }

    return this.gateway.processWebhook(event)
  }
}
