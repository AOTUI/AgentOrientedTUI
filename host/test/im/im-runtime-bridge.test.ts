import { describe, expect, it, vi } from 'vitest'
import type { GuiUpdateEvent } from '../../src/core/host-manager-v2.js'
import { IMRuntimeBridge } from '../../src/im/im-runtime-bridge.js'
import type { IReplyHandler } from '../../src/im/channel-plugin.js'

function createConfig() {
  return {
    im: {
      channels: {
        feishu: {
          enabled: true,
          appId: 'cli_x',
          appSecret: 'sec_x',
          verificationToken: 'verify_default',
          botToken: 'bot_token_x',
          domain: 'feishu',
          accounts: {
            corpA: {
              enabled: true,
              appId: 'cli_a',
              appSecret: 'sec_a',
              verificationToken: 'verify_a',
            },
          },
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
    const sendIMMessage = vi.fn(async () => undefined)
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
      getChannel: vi.fn(() => undefined),
    }

    const pluginFactory = vi.fn((dispatch: (message: any) => Promise<void>) => {
      refs.inboundDispatch = dispatch
      return [{
        id: 'feishu',
        meta: { label: 'Feishu' },
        capabilities: { chatTypes: ['direct', 'group'], streaming: true, threads: true },
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
      }]
    })

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendIMMessage,
        onGuiUpdate,
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => gateway as any,
      createChannelPlugins: pluginFactory as any,
    })

    await bridge.start()

    expect(gateway.register).toHaveBeenCalledTimes(1)
    expect(gateway.startAll).toHaveBeenCalledTimes(1)
    expect(pluginFactory).toHaveBeenCalledTimes(1)
    expect(refs.guiHandler).toBeTypeOf('function')

    if (!refs.inboundDispatch) {
      throw new Error('inbound dispatch handler is not ready')
    }

    const inboundMessage = {
      sessionKey: 'agent:agent-main:feishu:direct:ou_1',
      messageId: 'om_1',
      body: 'hello',
      channel: 'feishu',
      chatType: 'direct',
      senderId: 'ou_1',
      chatId: 'oc_1',
      agentId: 'agent-main',
      timestamp: 1_700_000_000_001,
    }

    await refs.inboundDispatch(inboundMessage)

    expect(sendIMMessage).toHaveBeenCalledWith(inboundMessage)
  })

  it('forwards assistant message back via channel plugin reply handler', async () => {
    const sendIMMessage = vi.fn(async () => undefined)

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

    const mockReplyHandler: IReplyHandler = {
      onPartialReply: vi.fn(async () => undefined),
      onFinalReply: vi.fn(async () => undefined),
      onReasoningDelta: vi.fn(async () => undefined),
      cleanup: vi.fn(async () => undefined),
    }

    const mockPlugin = {
      id: 'feishu',
      meta: { label: 'Feishu' },
      capabilities: { chatTypes: ['direct', 'group'], streaming: true, threads: true },
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      createReplyHandler: vi.fn(() => mockReplyHandler),
    }

    const gateway = {
      register: vi.fn(),
      startAll: vi.fn(async () => undefined),
      stopAll: vi.fn(async () => undefined),
      getChannel: vi.fn((id: string) => id === 'feishu' ? mockPlugin : undefined),
    }

    const pluginFactory = vi.fn((dispatch: (message: any) => Promise<void>) => {
      refs.inboundDispatch = dispatch
      return [mockPlugin]
    })

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendIMMessage,
        onGuiUpdate,
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => gateway as any,
      createChannelPlugins: pluginFactory as any,
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
      timestamp: 1_700_000_000_002,
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

    // Plugin should have created a one-shot reply handler
    expect(mockPlugin.createReplyHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        chatType: 'direct',
        chatId: 'oc_2',
        senderId: 'ou_2',
      }),
    )

    // onFinalReply should have been called with the reply text
    expect(mockReplyHandler.onFinalReply).toHaveBeenCalledWith('reply from host')
  })

  it('passes rootId through reply-handler context for thread-scoped IM sessions', async () => {
    const sendIMMessage = vi.fn(async () => undefined)

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

    const mockReplyHandler: IReplyHandler = {
      onPartialReply: vi.fn(async () => undefined),
      onFinalReply: vi.fn(async () => undefined),
      onReasoningDelta: vi.fn(async () => undefined),
      cleanup: vi.fn(async () => undefined),
    }

    const mockPlugin = {
      id: 'feishu',
      meta: { label: 'Feishu' },
      capabilities: { chatTypes: ['direct', 'group'], streaming: true, threads: true },
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      createReplyHandler: vi.fn(() => mockReplyHandler),
    }

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendIMMessage,
        onGuiUpdate,
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => ({
        register: vi.fn(),
        startAll: vi.fn(async () => undefined),
        stopAll: vi.fn(async () => undefined),
        getChannel: vi.fn((id: string) => id === 'feishu' ? mockPlugin : undefined),
      }),
      createChannelPlugins: vi.fn((dispatch: any) => {
        refs.inboundDispatch = dispatch
        return [mockPlugin]
      }) as any,
    })

    await bridge.start()

    await refs.inboundDispatch!({
      sessionKey: 'agent:agent-main:feishu:group:oc_group_1:thread:om_root_1',
      messageId: 'om_thread_1',
      body: 'reply in thread',
      channel: 'feishu',
      chatType: 'group',
      senderId: 'ou_2',
      chatId: 'oc_group_1',
      rootId: 'om_root_1',
      agentId: 'agent-main',
      timestamp: 1_700_000_000_003,
    })

    refs.guiHandler!({
      type: 'assistant',
      topicId: 'agent:agent-main:feishu:group:oc_group_1:thread:om_root_1',
      message: { role: 'assistant', content: 'thread answer' } as any,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mockPlugin.createReplyHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        chatType: 'group',
        chatId: 'oc_group_1',
        senderId: 'ou_2',
        rootId: 'om_root_1',
      }),
    )
  })

  it('preserves full IM routing payload when forwarding inbound message', async () => {
    const sendIMMessage = vi.fn(async () => undefined)
    const refs: { inboundDispatch?: (message: any) => Promise<void> } = {}

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendIMMessage,
        onGuiUpdate: vi.fn(() => () => {}),
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => ({
        register: vi.fn(),
        startAll: vi.fn(async () => undefined),
        stopAll: vi.fn(async () => undefined),
        getChannel: vi.fn(() => undefined),
        listChannels: vi.fn(() => []),
      }),
      createChannelPlugins: vi.fn((dispatch: any) => {
        refs.inboundDispatch = dispatch
        return [{
          id: 'feishu',
          meta: { label: 'Feishu' },
          capabilities: { chatTypes: ['direct', 'group'], streaming: true, threads: true },
          start: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined),
        }]
      }) as any,
    })

    await bridge.start()

    const inboundMessage = {
      sessionKey: 'agent:my-bot:feishu:direct:ou_x',
      messageId: 'om_x',
      body: 'test',
      channel: 'feishu',
      chatType: 'direct',
      senderId: 'ou_x',
      chatId: 'oc_x',
      agentId: 'my-bot',
      accountId: 'tenant-a',
      timestamp: 1_700_000_000_000,
    }

    await refs.inboundDispatch!(inboundMessage)

    expect(sendIMMessage).toHaveBeenCalledWith(inboundMessage)
  })

  it('stops gateway and unsubscribes on stop', async () => {
    const sendIMMessage = vi.fn(async () => undefined)

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
      getChannel: vi.fn(() => undefined),
      listChannels: vi.fn(() => []),
    }

    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendIMMessage,
        onGuiUpdate,
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => gateway as any,
      createChannelPlugins: vi.fn(() => [{
        id: 'feishu',
        meta: { label: 'Feishu' },
        capabilities: { chatTypes: ['direct', 'group'], streaming: true, threads: true },
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
      }]) as any,
    })

    await bridge.start()
    await bridge.stop()

    expect(gateway.stopAll).toHaveBeenCalledTimes(1)
    expect(unsubCalled).toBe(true)
  })

  describe('streaming card flow', () => {
    function createStreamingBridge() {
      const sendIMMessage = vi.fn(async () => undefined)

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

      // Mock reply handler that tracks all calls
      const mockReplyHandler: IReplyHandler = {
        onPartialReply: vi.fn(async () => undefined),
        onFinalReply: vi.fn(async () => undefined),
        onReasoningDelta: vi.fn(async () => undefined),
        cleanup: vi.fn(async () => undefined),
      }

      const mockPlugin = {
        id: 'feishu',
        meta: { label: 'Feishu' },
        capabilities: { chatTypes: ['direct', 'group'], streaming: true, threads: true },
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        createReplyHandler: vi.fn(() => mockReplyHandler),
      }

      const gateway = {
        register: vi.fn(),
        startAll: vi.fn(async () => undefined),
        stopAll: vi.fn(async () => undefined),
        getChannel: vi.fn((id: string) => id === 'feishu' ? mockPlugin : undefined),
        listChannels: vi.fn(() => [{
          id: 'feishu',
          meta: { label: 'Feishu' },
          capabilities: { chatTypes: ['direct', 'group'], streaming: true, threads: true },
          active: true,
          runtime: { started: true, connectionMode: 'websocket' },
        }]),
      }

      const pluginFactory = vi.fn((dispatch: (message: any) => Promise<void>) => {
        refs.inboundDispatch = dispatch
        return [mockPlugin]
      })

      const bridge = new IMRuntimeBridge({
        hostManager: {
          sendIMMessage,
          onGuiUpdate,
        } as any,
        getConfig: async () => createConfig(),
        createGatewayManager: () => gateway as any,
        createChannelPlugins: pluginFactory as any,
      })

      return { bridge, refs, mockPlugin, mockReplyHandler }
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
        timestamp: 1_700_000_000_003,
      })
    }

    it('creates reply handler on first text_delta and delegates onPartialReply', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

      b.refs.guiHandler!({
        type: 'text_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: 'Hello',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(b.mockPlugin.createReplyHandler).toHaveBeenCalledTimes(1)
      expect(b.mockPlugin.createReplyHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: 'direct',
          chatId: 'oc_s1',
          senderId: 'ou_s1',
        }),
      )
      expect(b.mockReplyHandler.onPartialReply).toHaveBeenCalledWith('Hello')
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

      // Handler created only once
      expect(b.mockPlugin.createReplyHandler).toHaveBeenCalledTimes(1)
      // Second update has accumulated text
      expect(b.mockReplyHandler.onPartialReply).toHaveBeenLastCalledWith('Hello world')
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

      expect(b.mockReplyHandler.onPartialReply).toHaveBeenLastCalledWith('好，现在看到了项目结构')
    })

    it('calls onFinalReply on assistant event after streaming', async () => {
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
      b.refs.guiHandler!({
        type: 'assistant',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        message: { role: 'assistant', content: 'Hello world, full reply.' } as any,
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(b.mockReplyHandler.onFinalReply).toHaveBeenCalledWith('Hello world, full reply.')
    })

    it('creates one-shot reply handler when no streaming was active', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

      // Send assistant event directly (no text_delta before it)
      b.refs.guiHandler!({
        type: 'assistant',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        message: { role: 'assistant', content: 'quick reply' } as any,
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Should have created a one-shot reply handler
      expect(b.mockPlugin.createReplyHandler).toHaveBeenCalledTimes(1)
      // onFinalReply called with the full text
      expect(b.mockReplyHandler.onFinalReply).toHaveBeenCalledWith('quick reply')
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

      expect(b.mockPlugin.createReplyHandler).not.toHaveBeenCalled()
    })

    it('uses channel capabilities to ignore streaming deltas when streaming is unsupported', async () => {
      const sendIMMessage = vi.fn(async () => undefined)
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
      const mockReplyHandler: IReplyHandler = {
        onPartialReply: vi.fn(async () => undefined),
        onFinalReply: vi.fn(async () => undefined),
        onReasoningDelta: vi.fn(async () => undefined),
        cleanup: vi.fn(async () => undefined),
      }
      const mockPlugin = {
        id: 'plain-im',
        meta: { label: 'Plain IM' },
        capabilities: { chatTypes: ['direct'], streaming: false, threads: false },
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        createReplyHandler: vi.fn(() => mockReplyHandler),
      }

      const bridge = new IMRuntimeBridge({
        hostManager: { sendIMMessage, onGuiUpdate } as any,
        getConfig: async () => createConfig(),
        createGatewayManager: () => ({
          register: vi.fn(),
          startAll: vi.fn(async () => undefined),
          stopAll: vi.fn(async () => undefined),
          getChannel: vi.fn(() => mockPlugin),
          listChannels: vi.fn(() => []),
        }),
        createChannelPlugins: vi.fn((dispatch: any) => {
          refs.inboundDispatch = dispatch
          return [mockPlugin]
        }) as any,
      })

      await bridge.start()
      await refs.inboundDispatch!({
        sessionKey: 'agent:bot:plain-im:direct:ou_plain',
        messageId: 'om_plain',
        body: 'hello',
        channel: 'plain-im',
        chatType: 'direct',
        senderId: 'ou_plain',
        chatId: 'oc_plain',
        agentId: 'bot',
        timestamp: 1_700_000_000_004,
      })

      refs.guiHandler!({
        type: 'text_delta',
        topicId: 'agent:bot:plain-im:direct:ou_plain',
        delta: 'streaming text',
      })
      refs.guiHandler!({
        type: 'reasoning_delta',
        topicId: 'agent:bot:plain-im:direct:ou_plain',
        delta: 'thinking',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockPlugin.createReplyHandler).not.toHaveBeenCalled()

      refs.guiHandler!({
        type: 'assistant',
        topicId: 'agent:bot:plain-im:direct:ou_plain',
        message: { role: 'assistant', content: 'final only' } as any,
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockPlugin.createReplyHandler).toHaveBeenCalledTimes(1)
      expect(mockReplyHandler.onFinalReply).toHaveBeenCalledWith('final only')
      expect(mockReplyHandler.onPartialReply).not.toHaveBeenCalled()
      expect(mockReplyHandler.onReasoningDelta).not.toHaveBeenCalled()
    })

    it('drops thread context when channel capabilities do not support threads', async () => {
      const sendIMMessage = vi.fn(async () => undefined)
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
      const mockReplyHandler: IReplyHandler = {
        onPartialReply: vi.fn(async () => undefined),
        onFinalReply: vi.fn(async () => undefined),
        onReasoningDelta: vi.fn(async () => undefined),
        cleanup: vi.fn(async () => undefined),
      }
      const mockPlugin = {
        id: 'plain-im',
        meta: { label: 'Plain IM' },
        capabilities: { chatTypes: ['group'], streaming: true, threads: false },
        start: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        createReplyHandler: vi.fn(() => mockReplyHandler),
      }

      const bridge = new IMRuntimeBridge({
        hostManager: { sendIMMessage, onGuiUpdate } as any,
        getConfig: async () => createConfig(),
        createGatewayManager: () => ({
          register: vi.fn(),
          startAll: vi.fn(async () => undefined),
          stopAll: vi.fn(async () => undefined),
          getChannel: vi.fn(() => mockPlugin),
          listChannels: vi.fn(() => []),
        }),
        createChannelPlugins: vi.fn((dispatch: any) => {
          refs.inboundDispatch = dispatch
          return [mockPlugin]
        }) as any,
      })

      await bridge.start()
      await refs.inboundDispatch!({
        sessionKey: 'agent:bot:plain-im:group:oc_group',
        messageId: 'om_group',
        body: 'group hello',
        channel: 'plain-im',
        chatType: 'group',
        senderId: 'ou_plain',
        chatId: 'oc_group',
        rootId: 'om_root_1',
        agentId: 'bot',
        timestamp: 1_700_000_000_005,
      })

      refs.guiHandler!({
        type: 'assistant',
        topicId: 'agent:bot:plain-im:group:oc_group',
        message: { role: 'assistant', content: 'group final' } as any,
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockPlugin.createReplyHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: 'group',
          chatId: 'oc_group',
          rootId: undefined,
        }),
      )
    })

    it('cleans up reply handlers on stop', async () => {
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

      // cleanup should have been called on the reply handler
      expect(b.mockReplyHandler.cleanup).toHaveBeenCalled()
    })

    it('forwards reasoning_delta events to reply handler', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

      b.refs.guiHandler!({
        type: 'reasoning_delta',
        topicId: 'agent:bot:feishu:direct:ou_s1',
        delta: 'I am thinking',
      })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(b.mockPlugin.createReplyHandler).toHaveBeenCalledTimes(1)
      expect(b.mockReplyHandler.onReasoningDelta).toHaveBeenCalledWith('I am thinking')
    })

    it('accumulates multiple reasoning_delta events before forwarding', async () => {
      const b = createStreamingBridge()
      await setupSession(b)

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

      expect(b.mockReplyHandler.onReasoningDelta).toHaveBeenLastCalledWith('thinking more')
    })
  })

  it('exposes runtime channel inventory through getRuntime', async () => {
    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendIMMessage: vi.fn(async () => undefined),
        onGuiUpdate: vi.fn(() => () => {}),
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => ({
        register: vi.fn(),
        startAll: vi.fn(async () => undefined),
        stopAll: vi.fn(async () => undefined),
        getChannel: vi.fn(() => undefined),
        listChannels: vi.fn(() => [{
          id: 'feishu',
          meta: { label: 'Feishu' },
          capabilities: { chatTypes: ['direct', 'group'], streaming: true, threads: true },
          active: true,
          runtime: { started: true, connectionMode: 'websocket', accountIds: ['default'] },
        }]),
      }),
      createChannelPlugins: vi.fn(() => []) as any,
    })

    await bridge.start()

    expect(bridge.getRuntime()).toEqual({
      started: true,
      channels: [
        {
          id: 'feishu',
          meta: { label: 'Feishu' },
          capabilities: { chatTypes: ['direct', 'group'], streaming: true, threads: true },
          active: true,
          runtime: { started: true, connectionMode: 'websocket', accountIds: ['default'] },
        },
      ],
    })
  })

  it('handles Feishu webhook challenge and account-specific token validation', async () => {
    const processWebhook = vi.fn(async () => ({ accepted: true }))
    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendIMMessage: vi.fn(async () => undefined),
        onGuiUpdate: vi.fn(() => () => {}),
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => ({
        register: vi.fn(),
        startAll: vi.fn(async () => undefined),
        stopAll: vi.fn(async () => undefined),
        listChannels: vi.fn(() => []),
        getChannel: vi.fn(() => ({
          id: 'feishu',
          meta: { label: 'Feishu' },
          capabilities: { chatTypes: ['direct', 'group'], webhookInbound: true },
          start: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined),
          processWebhook,
        })),
      }),
      createChannelPlugins: vi.fn(() => []) as any,
    })

    await bridge.start()

    const challenge = await bridge.processFeishuWebhook({
      type: 'url_verification',
      token: 'verify_a',
      challenge: 'challenge_1',
    }, 'corpA')

    expect(challenge).toEqual({
      status: 200,
      body: { challenge: 'challenge_1' },
    })

    const rejected = await bridge.processFeishuWebhook({
      type: 'url_verification',
      token: 'wrong_token',
      challenge: 'challenge_2',
    }, 'corpA')

    expect(rejected).toEqual({
      status: 401,
      body: { code: 1, msg: 'invalid verification token' },
    })
    expect(processWebhook).not.toHaveBeenCalled()
  })

  it('forwards parsed Feishu webhook events to channel plugin', async () => {
    const processWebhook = vi.fn(async () => ({ accepted: true }))
    const bridge = new IMRuntimeBridge({
      hostManager: {
        sendIMMessage: vi.fn(async () => undefined),
        onGuiUpdate: vi.fn(() => () => {}),
      } as any,
      getConfig: async () => createConfig(),
      createGatewayManager: () => ({
        register: vi.fn(),
        startAll: vi.fn(async () => undefined),
        stopAll: vi.fn(async () => undefined),
        listChannels: vi.fn(() => []),
        getChannel: vi.fn(() => ({
          id: 'feishu',
          meta: { label: 'Feishu' },
          capabilities: { chatTypes: ['direct', 'group'], webhookInbound: true },
          start: vi.fn(async () => undefined),
          stop: vi.fn(async () => undefined),
          processWebhook,
        })),
      }),
      createChannelPlugins: vi.fn(() => []) as any,
    })

    await bridge.start()

    const result = await bridge.processFeishuWebhook({
      token: 'verify_a',
      header: { event_type: 'im.message.receive_v1' },
      event: {
        sender: {
          sender_id: { open_id: 'ou_1' },
        },
        message: {
          message_id: 'om_webhook_1',
          chat_id: 'oc_group_1',
          chat_type: 'group',
          message_type: 'text',
          content: JSON.stringify({ text: 'hello webhook' }),
        },
      },
    }, 'corpA')

    expect(result).toEqual({
      status: 200,
      body: { code: 0 },
    })
    expect(processWebhook).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'corpA',
      messageId: 'om_webhook_1',
      chatId: 'oc_group_1',
      chatType: 'group',
      senderId: 'ou_1',
      text: 'hello webhook',
    }))
  })
})
