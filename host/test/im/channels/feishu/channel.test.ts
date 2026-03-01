import { describe, expect, it, vi } from 'vitest'
import { FeishuChannelPlugin, type FeishuChannelInboundEvent } from '../../../../src/im/channels/feishu/channel.js'

function createEvent(overrides: Partial<FeishuChannelInboundEvent> = {}): FeishuChannelInboundEvent {
  return {
    accountId: 'default',
    messageId: 'om_1',
    chatId: 'oc_1',
    chatType: 'direct',
    senderId: 'ou_1',
    text: 'hello',
    timestamp: 1_000,
    ...overrides,
  }
}

describe('FeishuChannelPlugin', () => {
  it('starts gateway with parsed connection mode', async () => {
    const gateway = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      processWebhook: vi.fn(async () => ({ accepted: true })),
    }

    const plugin = new FeishuChannelPlugin({
      dispatch: vi.fn(async () => undefined),
      createGateway: vi.fn(() => gateway as any),
      createBotHandler: vi.fn(() => ({ handle: vi.fn(async () => ({ accepted: true })) } as any)),
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

    expect(gateway.start).toHaveBeenCalledTimes(1)
  })

  it('dispatches inbound event through bot handler', async () => {
    const botHandle = vi.fn(async () => ({ accepted: true }))
    const gatewayFactory: any = vi.fn((deps: any) => ({
      start: vi.fn(async () => {
        await deps.onEvent(createEvent({ text: 'from-gateway' }))
      }),
      stop: vi.fn(async () => undefined),
      processWebhook: vi.fn(async () => ({ accepted: true })),
    }))

    const plugin = new FeishuChannelPlugin({
      dispatch: vi.fn(async () => undefined),
      createGateway: gatewayFactory,
      createBotHandler: vi.fn(() => ({ handle: botHandle } as any)),
    })

    await plugin.start({
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
      },
    })

    expect(botHandle).toHaveBeenCalledWith(expect.objectContaining({ text: 'from-gateway' }))
  })

  it('calls gateway stop on plugin stop', async () => {
    const gateway = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      processWebhook: vi.fn(async () => ({ accepted: true })),
    }

    const plugin = new FeishuChannelPlugin({
      dispatch: vi.fn(async () => undefined),
      createGateway: vi.fn(() => gateway as any),
      createBotHandler: vi.fn(() => ({ handle: vi.fn(async () => ({ accepted: true })) } as any)),
    })

    await plugin.start({
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
      },
    })

    await plugin.stop()

    expect(gateway.stop).toHaveBeenCalledTimes(1)
  })

  it('supports webhook pass-through after start', async () => {
    const gateway = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      processWebhook: vi.fn(async () => ({ accepted: true })),
    }

    const plugin = new FeishuChannelPlugin({
      dispatch: vi.fn(async () => undefined),
      createGateway: vi.fn(() => gateway as any),
      createBotHandler: vi.fn(() => ({ handle: vi.fn(async () => ({ accepted: true })) } as any)),
    })

    await plugin.start({
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
      },
    })

    const result = await plugin.processWebhook(createEvent({ text: 'webhook-message' }))

    expect(result.accepted).toBe(true)
    expect(gateway.processWebhook).toHaveBeenCalledWith(expect.objectContaining({ text: 'webhook-message' }))
  })

  it('is idempotent for repeated start calls', async () => {
    const gateway = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      processWebhook: vi.fn(async () => ({ accepted: true })),
    }

    const createGateway = vi.fn(() => gateway as any)
    const plugin = new FeishuChannelPlugin({
      dispatch: vi.fn(async () => undefined),
      createGateway,
      createBotHandler: vi.fn(() => ({ handle: vi.fn(async () => ({ accepted: true })) } as any)),
    })

    const ctx = {
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
      },
    }

    await plugin.start(ctx)
    await plugin.start(ctx)

    expect(createGateway).toHaveBeenCalledTimes(1)
    expect(gateway.start).toHaveBeenCalledTimes(1)
  })

  it('throws when required credentials are missing', async () => {
    const plugin = new FeishuChannelPlugin({
      dispatch: vi.fn(async () => undefined),
      createGateway: vi.fn(() => ({
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        processWebhook: vi.fn(async () => ({ accepted: true })),
      } as any)),
      createBotHandler: vi.fn(() => ({ handle: vi.fn(async () => ({ accepted: true })) } as any)),
    })

    await expect(
      plugin.start({ config: {}, channelConfig: { enabled: true, appId: 'cli_x' } }),
    ).rejects.toThrow(/appSecret/i)
  })

  it('throws processWebhook when plugin not started', async () => {
    const plugin = new FeishuChannelPlugin({
      dispatch: vi.fn(async () => undefined),
    })

    await expect(plugin.processWebhook(createEvent())).rejects.toThrow(/not started/i)
  })

  it('routes through resolveIMRoute by default', async () => {
    const dispatch = vi.fn(async () => undefined)
    let capturedMessage: any

    const plugin = new FeishuChannelPlugin({
      dispatch,
      createGateway: vi.fn((deps: any) => ({
        start: vi.fn(async () => {
          await deps.onEvent(createEvent({ senderId: 'ou_sender' }))
        }),
        stop: vi.fn(async () => undefined),
        processWebhook: vi.fn(async () => ({ accepted: true })),
      } as any)),
      createBotHandler: vi.fn(
        (deps: any) =>
          ({
            handle: async (evt: any) => {
              capturedMessage = evt
              return deps.handle(evt)
            },
          }) as any,
      ),
      routingConfig: {
        agents: { activeAgentId: 'agent-default' },
        im: { channels: { feishu: {} } },
      } as any,
    })

    await plugin.start({
      config: {},
      channelConfig: {
        enabled: true,
        appId: 'cli_x',
        appSecret: 'sec_x',
      },
    })

    expect(capturedMessage.senderId).toBe('ou_sender')
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: 'agent:agent-default:feishu:direct:ou_sender',
      }),
    )
  })
})
