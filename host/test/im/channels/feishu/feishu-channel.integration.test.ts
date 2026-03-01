import { describe, expect, it, vi } from 'vitest'
import { FeishuChannelPlugin, type FeishuChannelInboundEvent } from '../../../../src/im/channels/feishu/channel.js'

function createEvent(overrides: Partial<FeishuChannelInboundEvent> = {}): FeishuChannelInboundEvent {
  return {
    accountId: 'default',
    messageId: 'om_dm_1',
    chatId: 'oc_dm_1',
    chatType: 'direct',
    senderId: 'ou_1',
    senderName: 'Alice',
    text: 'hello',
    timestamp: 1_000,
    ...overrides,
  }
}

function createGatewayHarness() {
  let handler: ((event: FeishuChannelInboundEvent) => Promise<void>) | null = null

  return {
    factory: vi.fn((deps: { onEvent: (event: FeishuChannelInboundEvent) => Promise<void> }) => {
      handler = deps.onEvent
      return {
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        processWebhook: vi.fn(async (event: FeishuChannelInboundEvent) => {
          await deps.onEvent(event)
          return { accepted: true as const }
        }),
      }
    }),
    async emit(event: FeishuChannelInboundEvent): Promise<void> {
      if (!handler) {
        throw new Error('gateway handler is not ready')
      }
      await handler(event)
    },
  }
}

describe('Feishu channel integration', () => {
  it('dispatches DM messages end-to-end via gateway event', async () => {
    const dispatch = vi.fn(async () => undefined)
    const gateway = createGatewayHarness()

    const plugin = new FeishuChannelPlugin({
      dispatch,
      createGateway: gateway.factory as any,
      routingConfig: {
        agents: { activeAgentId: 'agent-main' },
      },
    })

    await plugin.start({
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
      },
    })

    await gateway.emit(createEvent())

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'hello',
        channel: 'feishu',
        chatType: 'direct',
        agentId: 'agent-main',
        sessionKey: 'agent:agent-main:feishu:direct:ou_1',
      }),
    )
  })

  it('drops duplicate messages by messageId', async () => {
    const dispatch = vi.fn(async () => undefined)
    const gateway = createGatewayHarness()

    const plugin = new FeishuChannelPlugin({
      dispatch,
      createGateway: gateway.factory as any,
      routingConfig: {
        agents: { activeAgentId: 'agent-main' },
      },
    })

    await plugin.start({
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
      },
    })

    const event = createEvent({ messageId: 'om_dup_1' })
    await gateway.emit(event)
    await gateway.emit(event)

    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('blocks group messages without mention when requireMention=true', async () => {
    const dispatch = vi.fn(async () => undefined)
    const gateway = createGatewayHarness()

    const plugin = new FeishuChannelPlugin({
      dispatch,
      createGateway: gateway.factory as any,
      routingConfig: {
        agents: { activeAgentId: 'agent-main' },
      },
    })

    await plugin.start({
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
        groupPolicy: 'open',
        requireMention: true,
      },
    })

    await gateway.emit(
      createEvent({
        messageId: 'om_group_1',
        chatType: 'group',
        chatId: 'oc_group_1',
        text: 'hello everyone',
      }),
    )

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('accepts group messages with mention and strips mention text', async () => {
    const dispatch = vi.fn(async () => undefined)
    const gateway = createGatewayHarness()

    const plugin = new FeishuChannelPlugin({
      dispatch,
      createGateway: gateway.factory as any,
      routingConfig: {
        agents: { activeAgentId: 'agent-main' },
      },
    })

    await plugin.start({
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
        groupPolicy: 'open',
        requireMention: true,
      },
    })

    await gateway.emit(
      createEvent({
        messageId: 'om_group_2',
        chatType: 'group',
        chatId: 'oc_group_1',
        text: '<at user_id="cli_x">bot</at> summarize this',
      }),
    )

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'summarize this',
        chatType: 'group',
        sessionKey: 'agent:agent-main:feishu:group:oc_group_1',
      }),
    )
  })

  it('processes webhook event after start in webhook mode', async () => {
    const dispatch = vi.fn(async () => undefined)

    const plugin = new FeishuChannelPlugin({
      dispatch,
      routingConfig: {
        agents: { activeAgentId: 'agent-main' },
      },
    })

    await plugin.start({
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
        connectionMode: 'webhook',
      },
    })

    const result = await plugin.processWebhook(createEvent({ messageId: 'om_webhook_1', text: 'via webhook' }))

    expect(result.accepted).toBe(true)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'via webhook',
      }),
    )
  })
})
