import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * We can't easily import the real SDK in unit tests without network access,
 * so we mock `@larksuiteoapi/node-sdk` entirely and verify the adapter
 * calls the SDK correctly and transforms events.
 */

// --- Mock SDK classes ---
const mockStart = vi.fn()
const mockClose = vi.fn()
const mockRegister = vi.fn()

vi.mock('@larksuiteoapi/node-sdk', () => {
  class MockWSClient {
    config: any
    constructor(config: any) {
      this.config = config
    }
    start = mockStart
    close = mockClose
  }

  class MockEventDispatcher {
    registrations: Record<string, Function> = {}
    constructor(_opts?: any) {}
    register(handlers: Record<string, Function>) {
      Object.assign(this.registrations, handlers)
      mockRegister(handlers)
      return this
    }
  }

  return {
    WSClient: MockWSClient,
    EventDispatcher: MockEventDispatcher,
    Domain: { Feishu: 0, Lark: 1 },
    LoggerLevel: { info: 1, debug: 0, warn: 2, error: 3 },
  }
})

// Import AFTER mock setup
import { createRealFeishuWsClient } from '../../../../src/im/channels/feishu/ws-client.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createRealFeishuWsClient', () => {
  it('creates a client with onMessage/start/stop', () => {
    const client = createRealFeishuWsClient({
      appId: 'cli_test123',
      appSecret: 'secret456',
      domain: 'feishu',
    })

    expect(client).toBeDefined()
    expect(typeof client.start).toBe('function')
    expect(typeof client.stop).toBe('function')
    expect(typeof client.onMessage).toBe('function')
  })

  it('start() creates WSClient and EventDispatcher and calls wsClient.start()', async () => {
    const client = createRealFeishuWsClient({
      appId: 'cli_test123',
      appSecret: 'secret456',
      domain: 'feishu',
    })

    const handler = vi.fn()
    client.onMessage(handler)

    await client.start()

    // EventDispatcher.register should have been called with im.message.receive_v1
    expect(mockRegister).toHaveBeenCalledTimes(1)
    const registeredHandlers = mockRegister.mock.calls[0][0]
    expect(registeredHandlers).toHaveProperty('im.message.receive_v1')

    // WSClient.start should have been called with eventDispatcher
    expect(mockStart).toHaveBeenCalledTimes(1)
    const startArg = mockStart.mock.calls[0][0]
    expect(startArg).toHaveProperty('eventDispatcher')
  })

  it('start() is idempotent', async () => {
    const client = createRealFeishuWsClient({
      appId: 'cli_test123',
      appSecret: 'secret456',
    })

    await client.start()
    await client.start()

    expect(mockStart).toHaveBeenCalledTimes(1)
  })

  it('transforms SDK event data into FeishuGatewayEvent', async () => {
    const handler = vi.fn()

    const client = createRealFeishuWsClient({
      appId: 'cli_test123',
      appSecret: 'secret456',
      accountId: 'acc1',
    })
    client.onMessage(handler)
    await client.start()

    // Simulate the SDK calling the registered handler
    const registeredHandlers = mockRegister.mock.calls[0][0]
    const sdkHandler = registeredHandlers['im.message.receive_v1']

    await sdkHandler({
      sender: {
        sender_id: { open_id: 'ou_user123', user_id: 'u123' },
        sender_type: 'user',
      },
      message: {
        message_id: 'msg_001',
        chat_id: 'oc_chat001',
        chat_type: 'p2p',
        message_type: 'text',
        content: '{"text":"Hello from Feishu"}',
      },
    })

    expect(handler).toHaveBeenCalledTimes(1)
    const event = handler.mock.calls[0][0]
    expect(event).toMatchObject({
      accountId: 'acc1',
      messageId: 'msg_001',
      chatId: 'oc_chat001',
      chatType: 'direct',
      senderId: 'ou_user123',
      text: 'Hello from Feishu',
    })
    expect(typeof event.timestamp).toBe('number')
  })

  it('maps group chat_type correctly', async () => {
    const handler = vi.fn()

    const client = createRealFeishuWsClient({
      appId: 'cli_test123',
      appSecret: 'secret456',
    })
    client.onMessage(handler)
    await client.start()

    const registeredHandlers = mockRegister.mock.calls[0][0]
    const sdkHandler = registeredHandlers['im.message.receive_v1']

    await sdkHandler({
      sender: { sender_id: { open_id: 'ou_user456' } },
      message: {
        message_id: 'msg_002',
        chat_id: 'oc_group001',
        chat_type: 'group',
        message_type: 'text',
        content: '{"text":"Group msg"}',
      },
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].chatType).toBe('group')
  })

  it('falls back to user_id when open_id is missing', async () => {
    const handler = vi.fn()

    const client = createRealFeishuWsClient({
      appId: 'cli_test123',
      appSecret: 'secret456',
    })
    client.onMessage(handler)
    await client.start()

    const sdkHandler = mockRegister.mock.calls[0][0]['im.message.receive_v1']

    await sdkHandler({
      sender: { sender_id: { user_id: 'u_fallback' } },
      message: {
        message_id: 'msg_003',
        chat_id: 'oc_chat003',
        chat_type: 'p2p',
        message_type: 'text',
        content: '{"text":"hi"}',
      },
    })

    expect(handler.mock.calls[0][0].senderId).toBe('u_fallback')
  })

  it('stop() prevents further event processing', async () => {
    const handler = vi.fn()

    const client = createRealFeishuWsClient({
      appId: 'cli_test123',
      appSecret: 'secret456',
    })
    client.onMessage(handler)
    await client.start()

    await client.stop()

    const sdkHandler = mockRegister.mock.calls[0][0]['im.message.receive_v1']
    await sdkHandler({
      sender: { sender_id: { open_id: 'ou_after_stop' } },
      message: {
        message_id: 'msg_004',
        chat_id: 'oc_chat004',
        chat_type: 'p2p',
        message_type: 'text',
        content: '{"text":"should be ignored"}',
      },
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('handles malformed content gracefully', async () => {
    const handler = vi.fn()

    const client = createRealFeishuWsClient({
      appId: 'cli_test123',
      appSecret: 'secret456',
    })
    client.onMessage(handler)
    await client.start()

    const sdkHandler = mockRegister.mock.calls[0][0]['im.message.receive_v1']

    await sdkHandler({
      sender: { sender_id: { open_id: 'ou_user' } },
      message: {
        message_id: 'msg_005',
        chat_id: 'oc_chat005',
        chat_type: 'p2p',
        message_type: 'text',
        content: 'not valid json',
      },
    })

    expect(handler).toHaveBeenCalledTimes(1)
    // Falls back to raw content string
    expect(handler.mock.calls[0][0].text).toBe('not valid json')
  })
})
