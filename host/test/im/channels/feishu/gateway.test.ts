import { describe, expect, it, vi } from 'vitest'
import { createFeishuGateway, type FeishuGatewayEvent } from '../../../../src/im/channels/feishu/gateway.js'

function createEvent(overrides: Partial<FeishuGatewayEvent> = {}): FeishuGatewayEvent {
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

describe('Feishu gateway', () => {
  it('starts websocket client in websocket mode', async () => {
    const wsClient = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onMessage: vi.fn(),
    }

    const gateway = createFeishuGateway({
      connectionMode: 'websocket',
      createWsClient: vi.fn(() => wsClient as any),
      onEvent: vi.fn(async () => undefined),
    })

    await gateway.start()

    expect(wsClient.start).toHaveBeenCalledTimes(1)
    expect(wsClient.onMessage).toHaveBeenCalledTimes(1)
  })

  it('does not recreate websocket client when start is called twice', async () => {
    const wsClient = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onMessage: vi.fn(),
    }

    const createWsClient = vi.fn(() => wsClient as any)
    const gateway = createFeishuGateway({
      connectionMode: 'websocket',
      createWsClient,
      onEvent: vi.fn(async () => undefined),
    })

    await gateway.start()
    await gateway.start()

    expect(createWsClient).toHaveBeenCalledTimes(1)
    expect(wsClient.start).toHaveBeenCalledTimes(1)
  })

  it('forwards websocket inbound event to handler', async () => {
    let inboundHandler: ((event: FeishuGatewayEvent) => Promise<void>) | undefined
    const wsClient = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onMessage: vi.fn((handler: (event: FeishuGatewayEvent) => Promise<void>) => {
        inboundHandler = handler
      }),
    }

    const onEvent = vi.fn(async () => undefined)
    const gateway = createFeishuGateway({
      connectionMode: 'websocket',
      createWsClient: vi.fn(() => wsClient as any),
      onEvent,
    })

    await gateway.start()
    await inboundHandler?.(createEvent())

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'om_1' }))
  })

  it('stops websocket client when started', async () => {
    const wsClient = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onMessage: vi.fn(),
    }

    const gateway = createFeishuGateway({
      connectionMode: 'websocket',
      createWsClient: vi.fn(() => wsClient as any),
      onEvent: vi.fn(async () => undefined),
    })

    await gateway.start()
    await gateway.stop()

    expect(wsClient.stop).toHaveBeenCalledTimes(1)
  })

  it('does not initialize websocket client in webhook mode', async () => {
    const createWsClient = vi.fn()
    const gateway = createFeishuGateway({
      connectionMode: 'webhook',
      createWsClient,
      onEvent: vi.fn(async () => undefined),
    })

    await gateway.start()

    expect(createWsClient).not.toHaveBeenCalled()
  })

  it('processes webhook events in webhook mode', async () => {
    const onEvent = vi.fn(async () => undefined)
    const gateway = createFeishuGateway({
      connectionMode: 'webhook',
      onEvent,
    })

    const result = await gateway.processWebhook(createEvent({ text: 'from-webhook' }))

    expect(result.accepted).toBe(true)
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ text: 'from-webhook' }))
  })

  it('rejects direct webhook processing in websocket mode', async () => {
    const gateway = createFeishuGateway({
      connectionMode: 'websocket',
      createWsClient: vi.fn(() => ({
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        onMessage: vi.fn(),
      } as any)),
      onEvent: vi.fn(async () => undefined),
    })

    const result = await gateway.processWebhook(createEvent())
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/websocket mode/i)
  })

  it('propagates event handler errors', async () => {
    const gateway = createFeishuGateway({
      connectionMode: 'webhook',
      onEvent: vi.fn(async () => {
        throw new Error('handler failed')
      }),
    })

    await expect(gateway.processWebhook(createEvent())).rejects.toThrow(/handler failed/i)
  })
})
