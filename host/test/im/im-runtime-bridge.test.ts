import { describe, expect, it, vi } from 'vitest'
import type { GuiUpdateEvent } from '../../src/core/host-manager-v2.js'
import { IMRuntimeBridge } from '../../src/im/im-runtime-bridge.js'

// Mock the db module so defaultEnsureTopic works without a real SQLite DB
vi.mock('../../src/db/index.js', () => ({
  getTopic: vi.fn(() => null),
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
}))

function createConfig() {
  return {
    im: {
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_x',
          appSecret: 'sec_x',
          botToken: 'bot_token_x',
          domain: 'feishu',
        },
      },
    },
    agents: {
      activeAgentId: 'agent-main',
    },
  } as any
}

describe('IMRuntimeBridge', () => {
  it('starts gateway and dispatches inbound IM message to HostManager', async () => {
    const sendUserMessage = vi.fn(async () => undefined)
    const refs: {
      guiHandler?: (event: GuiUpdateEvent) => void
      inboundDispatch?: (message: any) => Promise<void>
    } = {}

    const onGuiUpdate = vi.fn((handler: (event: GuiUpdateEvent) => void) => {
      refs.guiHandler = handler
      return () => {
        refs.guiHandler = undefined
      }
    })

    const gateway = {
      register: vi.fn(),
      startAll: vi.fn(async () => undefined),
      stopAll: vi.fn(async () => undefined),
    }

    const pluginFactory = vi.fn(({ dispatch }: { dispatch: (message: any) => Promise<void> }) => {
      refs.inboundDispatch = dispatch
      return {
        id: 'feishu',
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
      }
    })

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendUserMessage,
        onGuiUpdate,
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => gateway as any,
      createFeishuChannelPlugin: pluginFactory as any,
      sendFeishuText: vi.fn(async () => ({ messageId: 'om_sent' })),
    })

    await bridge.start()

    expect(gateway.register).toHaveBeenCalledTimes(1)
    expect(gateway.startAll).toHaveBeenCalledTimes(1)
    expect(pluginFactory).toHaveBeenCalledTimes(1)
    expect(refs.guiHandler).toBeTypeOf('function')

    if (!refs.inboundDispatch) {
      throw new Error('inbound dispatch handler is not ready')
    }

    await refs.inboundDispatch({
      sessionKey: 'agent:agent-main:feishu:direct:ou_1',
      messageId: 'om_1',
      body: 'hello',
      channel: 'feishu',
      chatType: 'direct',
      senderId: 'ou_1',
      chatId: 'oc_1',
      agentId: 'agent-main',
    })

    expect(sendUserMessage).toHaveBeenCalledWith(
      'hello',
      'agent:agent-main:feishu:direct:ou_1',
      'om_1',
    )
  })

  it('forwards assistant message back to Feishu after inbound context is recorded', async () => {
    const sendUserMessage = vi.fn(async () => undefined)

    const refs: {
      guiHandler?: (event: GuiUpdateEvent) => void
      inboundDispatch?: (message: any) => Promise<void>
    } = {}

    const onGuiUpdate = vi.fn((handler: (event: GuiUpdateEvent) => void) => {
      refs.guiHandler = handler
      return () => {
        refs.guiHandler = undefined
      }
    })

    const gateway = {
      register: vi.fn(),
      startAll: vi.fn(async () => undefined),
      stopAll: vi.fn(async () => undefined),
    }

    const pluginFactory = vi.fn(({ dispatch }: { dispatch: (message: any) => Promise<void> }) => {
      refs.inboundDispatch = dispatch
      return {
        id: 'feishu',
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
      }
    })

    const sendFeishuText = vi.fn(async () => ({ messageId: 'om_sent' }))

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendUserMessage,
        onGuiUpdate,
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => gateway as any,
      createFeishuChannelPlugin: pluginFactory as any,
      sendFeishuText,
    })

    await bridge.start()

    if (!refs.inboundDispatch) {
      throw new Error('inbound dispatch handler is not ready')
    }

    await refs.inboundDispatch({
      sessionKey: 'agent:agent-main:feishu:direct:ou_2',
      messageId: 'om_2',
      body: 'hey',
      channel: 'feishu',
      chatType: 'direct',
      senderId: 'ou_2',
      chatId: 'oc_2',
      agentId: 'agent-main',
    })

    if (!refs.guiHandler) {
      throw new Error('gui handler is not ready')
    }

    refs.guiHandler({
      type: 'assistant',
      topicId: 'agent:agent-main:feishu:direct:ou_2',
      message: { role: 'assistant', content: 'reply from host' } as any,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(sendFeishuText).toHaveBeenCalledWith(
      expect.objectContaining({
        receiveIdType: 'open_id',
        receiveId: 'ou_2',
        text: 'reply from host',
      }),
    )
  })

  it('auto-fetches tenant token and sends reply when botToken is missing', async () => {
    const sendUserMessage = vi.fn(async () => undefined)

    const refs: {
      guiHandler?: (event: GuiUpdateEvent) => void
      inboundDispatch?: (message: any) => Promise<void>
    } = {}

    const onGuiUpdate = vi.fn((handler: (event: GuiUpdateEvent) => void) => {
      refs.guiHandler = handler
      return () => {
        refs.guiHandler = undefined
      }
    })

    const gateway = {
      register: vi.fn(),
      startAll: vi.fn(async () => undefined),
      stopAll: vi.fn(async () => undefined),
    }

    const pluginFactory = vi.fn(({ dispatch }: { dispatch: (message: any) => Promise<void> }) => {
      refs.inboundDispatch = dispatch
      return {
        id: 'feishu',
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
      }
    })

    const configWithoutBotToken = createConfig()
    delete configWithoutBotToken.im.channels.feishu.botToken

    const sendFeishuText = vi.fn(async () => ({ messageId: 'om_sent' }))
    const fetchTenantToken = vi.fn(async () => 'auto_fetched_token')

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendUserMessage,
        onGuiUpdate,
      } as any,
      getConfig: async () => configWithoutBotToken,
      createGatewayManager: () => gateway as any,
      createFeishuChannelPlugin: pluginFactory as any,
      sendFeishuText,
      fetchTenantToken,
    })

    await bridge.start()

    if (!refs.inboundDispatch) {
      throw new Error('inbound dispatch handler is not ready')
    }

    await refs.inboundDispatch({
      sessionKey: 'agent:agent-main:feishu:direct:ou_3',
      messageId: 'om_3',
      body: 'hey',
      channel: 'feishu',
      chatType: 'direct',
      senderId: 'ou_3',
      chatId: 'oc_3',
      agentId: 'agent-main',
    })

    if (!refs.guiHandler) {
      throw new Error('gui handler is not ready')
    }

    refs.guiHandler({
      type: 'assistant',
      topicId: 'agent:agent-main:feishu:direct:ou_3',
      message: { role: 'assistant', content: 'reply from host' } as any,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    // Should have auto-fetched token
    expect(fetchTenantToken).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'cli_x',
        appSecret: 'sec_x',
      }),
    )

    // Should have sent the reply with the auto-fetched token
    expect(sendFeishuText).toHaveBeenCalledWith(
      expect.objectContaining({
        botToken: 'auto_fetched_token',
        receiveIdType: 'open_id',
        receiveId: 'ou_3',
        text: 'reply from host',
      }),
    )
  })

  it('calls ensureTopic with agentId before sending user message', async () => {
    const sendUserMessage = vi.fn(async () => undefined)
    const refs: { inboundDispatch?: (message: any) => Promise<void> } = {}

    const ensureTopic = vi.fn()

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendUserMessage,
        onGuiUpdate: vi.fn(() => () => {}),
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => ({
        register: vi.fn(),
        startAll: vi.fn(async () => undefined),
        stopAll: vi.fn(async () => undefined),
      }),
      createFeishuChannelPlugin: vi.fn(({ dispatch }: any) => {
        refs.inboundDispatch = dispatch
        return { id: 'feishu', start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) }
      }) as any,
      sendFeishuText: vi.fn(async () => ({ messageId: 'om_sent' })),
      ensureTopic,
    })

    await bridge.start()

    await refs.inboundDispatch!({
      sessionKey: 'agent:my-bot:feishu:direct:ou_x',
      messageId: 'om_x',
      body: 'test',
      channel: 'feishu',
      chatType: 'direct',
      senderId: 'ou_x',
      chatId: 'oc_x',
      agentId: 'my-bot',
    })

    expect(ensureTopic).toHaveBeenCalledWith('agent:my-bot:feishu:direct:ou_x', 'my-bot')
    expect(sendUserMessage).toHaveBeenCalledWith('test', 'agent:my-bot:feishu:direct:ou_x', 'om_x')
  })

  it('stops gateway and unsubscribes on stop', async () => {
    const sendUserMessage = vi.fn(async () => undefined)

    let unsubCalled = false
    const onGuiUpdate = vi.fn((_handler: (event: GuiUpdateEvent) => void) => {
      return () => {
        unsubCalled = true
      }
    })

    const gateway = {
      register: vi.fn(),
      startAll: vi.fn(async () => undefined),
      stopAll: vi.fn(async () => undefined),
    }

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendUserMessage,
        onGuiUpdate,
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => gateway as any,
      createFeishuChannelPlugin: vi.fn(() => ({
        id: 'feishu',
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
      })) as any,
      sendFeishuText: vi.fn(async () => ({ messageId: 'om_sent' })),
    })

    await bridge.start()
    await bridge.stop()

    expect(gateway.stopAll).toHaveBeenCalledTimes(1)
    expect(unsubCalled).toBe(true)
  })

  describe('streaming card flow', () => {
    function createStreamingBridge() {
      const sendUserMessage = vi.fn(async () => undefined)

      const refs: {
        guiHandler?: (event: GuiUpdateEvent) => void
        inboundDispatch?: (message: any) => Promise<void>
      } = {}

      const onGuiUpdate = vi.fn((handler: (event: GuiUpdateEvent) => void) => {
        refs.guiHandler = handler
        return () => {
          refs.guiHandler = undefined
        }
      })

      const gateway = {
        register: vi.fn(),
        startAll: vi.fn(async () => undefined),
        stopAll: vi.fn(async () => undefined),
      }

      const pluginFactory = vi.fn(({ dispatch }: { dispatch: (message: any) => Promise<void> }) => {
        refs.inboundDispatch = dispatch
        return {
          id: 'feishu',
          start: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined),
        }
      })

      const sendFeishuText = vi.fn(async () => ({ messageId: 'om_sent' }))
      const fetchTenantToken = vi.fn(async () => 'auto_stream_token')

      const streamingSession = {
        isActive: vi.fn(() => true),
        start: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      }
      const createStreamingSession = vi.fn(() => streamingSession)

      const configWithoutBotToken = createConfig()
      delete configWithoutBotToken.im.channels.feishu.botToken

      const bridge = new IMRuntimeBridge({
        hostManager: {
          sendUserMessage,
          onGuiUpdate,
        } as any,
        getConfig: async () => configWithoutBotToken,
        createGatewayManager: () => gateway as any,
        createFeishuChannelPlugin: pluginFactory as any,
        sendFeishuText,
        fetchTenantToken,
        createStreamingSession,
      })

      return { bridge, refs, sendFeishuText, streamingSession, createStreamingSession }
    }

    async function setupSession(b: ReturnType<typeof createStreamingBridge>) {
      await b.bridge.start()

      await b.refs.inboundDispatch!({
        sessionKey: 'agent:bot:feishu:direct:ou_s1',
        messageId: 'om_s1',
        body: 'hello',
        channel: 'feishu',
        chatType: 'direct',
        senderId: 'ou_s1',
        chatId: 'oc_s1',
        agentId: 'bot',
      })
    }

    it('creates streaming session on first text_delta and calls update with accumulated text', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

      b.refs.guiHandler!({
        type: 'text_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: 'Hello',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(b.createStreamingSession).toHaveBeenCalledTimes(1)
      expect(b.streamingSession.start).toHaveBeenCalledWith('ou_s1', 'open_id', expect.anything())
      expect(b.streamingSession.update).toHaveBeenCalledWith('Hello')
    })

    it('accumulates text across multiple text_delta events', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

      b.refs.guiHandler!({
        type: 'text_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: 'Hello',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      b.refs.guiHandler!({
        type: 'text_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: ' world',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Session created only once
      expect(b.createStreamingSession).toHaveBeenCalledTimes(1)
      // Second update has accumulated text
      expect(b.streamingSession.update).toHaveBeenLastCalledWith('Hello world')
    })

    it('normalizes cumulative text_delta payloads without duplicate concatenation', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

      b.refs.guiHandler!({
        type: 'text_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: '好，现在看到了',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Simulate upstream sending cumulative snapshot rather than pure delta
      b.refs.guiHandler!({
        type: 'text_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: '好，现在看到了项目结构',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(b.streamingSession.update).toHaveBeenLastCalledWith('好，现在看到了项目结构')
    })

    it('closes streaming session on assistant event after streaming', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

      // Start streaming
      b.refs.guiHandler!({
        type: 'text_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: 'Hello',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Finalize with assistant event
      b.streamingSession.isActive.mockReturnValue(true)
      b.refs.guiHandler!({
        type: 'assistant',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        message: { role: 'assistant', content: 'Hello world, full reply.' } as any,
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(b.streamingSession.close).toHaveBeenCalledWith('Hello world, full reply.')
      // Should NOT fall back to sendFeishuText
      expect(b.sendFeishuText).not.toHaveBeenCalled()
    })

    it('falls back to plain text when no streaming was active', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

      // Send assistant event directly (no text_delta before it)
      b.refs.guiHandler!({
        type: 'assistant',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        message: { role: 'assistant', content: 'quick reply' } as any,
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      // No streaming session created
      expect(b.createStreamingSession).not.toHaveBeenCalled()
      // Falls back to plain text
      expect(b.sendFeishuText).toHaveBeenCalledWith(
        expect.objectContaining({
          receiveId: 'ou_s1',
          text: 'quick reply',
        }),
      )
    })

    it('ignores events for unknown sessions', async () => {
      const b = createStreamingBridge()
      await b.bridge.start()

      b.refs.guiHandler!({
        type: 'text_delta',
        topicId: 'unknown-session',
        delta: 'Hello',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(b.createStreamingSession).not.toHaveBeenCalled()
    })

    it('cleans up streaming sessions on stop', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

      // Start streaming
      b.refs.guiHandler!({
        type: 'text_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: 'Hello',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      await b.bridge.stop()

      // The streaming session's close should have been called via cleanup
      expect(b.streamingSession.close).toHaveBeenCalled()
    })

    it('forwards reasoning_delta events to streaming.updateReasoning', async () => {
      const b = createStreamingBridge()
      await setupSession(b)
      ;(b.streamingSession as any).updateReasoning = vi.fn(async () => undefined)

      b.refs.guiHandler!({
        type: 'reasoning_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: 'I am thinking',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(b.createStreamingSession).toHaveBeenCalledTimes(1)
      expect((b.streamingSession as any).updateReasoning).toHaveBeenCalledWith('I am thinking')
    })

    it('accumulates multiple reasoning_delta events before forwarding', async () => {
      const b = createStreamingBridge()
      await setupSession(b)
      ;(b.streamingSession as any).updateReasoning = vi.fn(async () => undefined)

      b.refs.guiHandler!({
        type: 'reasoning_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: 'thinking',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      b.refs.guiHandler!({
        type: 'reasoning_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: ' more',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect((b.streamingSession as any).updateReasoning).toHaveBeenLastCalledWith('thinking more')
    })
  })
})
