import { describe, expect, it, vi } from 'vitest'
import { createFeishuBotHandler, type FeishuInboundEvent } from '../../../../src/im/channels/feishu/bot.js'

function createEvent(overrides: Partial<FeishuInboundEvent> = {}): FeishuInboundEvent {
  return {
    accountId: 'default',
    messageId: 'om_001',
    chatId: 'oc_001',
    chatType: 'direct',
    senderId: 'ou_001',
    senderName: 'Alice',
    text: 'hello',
    timestamp: 1_000,
    ...overrides,
  }
}

describe('Feishu bot inbound handler', () => {
  it('dispatches DM message when policies allow', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
        dmPolicy: 'open',
        groupPolicy: 'open',
        requireMention: true,
      }),
      resolveRoute: vi.fn().mockReturnValue({
        agentId: 'agent-A',
        sessionKey: 'agent:agent-A:feishu:direct:ou_001',
      }),
      dispatch,
    })

    const result = await handler.handle(createEvent())

    expect(result.accepted).toBe(true)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'hello',
        agentId: 'agent-A',
        sessionKey: 'agent:agent-A:feishu:direct:ou_001',
      }),
    )
  })

  it('drops duplicated message by messageId', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(true) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
      }),
      resolveRoute: vi.fn(),
      dispatch,
    })

    const result = await handler.handle(createEvent())
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/duplicate/i)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('blocks DM when allowlist does not include sender', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
        dmPolicy: 'allowlist',
        allowFrom: ['ou_777'],
      }),
      resolveRoute: vi.fn(),
      dispatch,
    })

    const result = await handler.handle(createEvent())
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/allowlist/i)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('allows DM when allowlist includes sender', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
        dmPolicy: 'allowlist',
        allowFrom: ['ou_001'],
      }),
      resolveRoute: vi.fn().mockReturnValue({
        agentId: 'agent-A',
        sessionKey: 'agent:agent-A:feishu:direct:ou_001',
      }),
      dispatch,
    })

    const result = await handler.handle(createEvent())
    expect(result.accepted).toBe(true)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('blocks group message when mention is required and absent', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
        groupPolicy: 'open',
        requireMention: true,
      }),
      resolveRoute: vi.fn(),
      dispatch,
    })

    const result = await handler.handle(
      createEvent({
        chatType: 'group',
        text: 'hello everyone',
      }),
    )

    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/mention/i)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('accepts group message when mentioned and strips mention text', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
        groupPolicy: 'open',
        requireMention: true,
      }),
      resolveRoute: vi.fn().mockReturnValue({
        agentId: 'agent-A',
        sessionKey: 'agent:agent-A:feishu:group:oc_001',
      }),
      dispatch,
    })

    const result = await handler.handle(
      createEvent({
        chatType: 'group',
        text: '<at user_id="cli_x">bot</at> summarize this',
      }),
    )

    expect(result.accepted).toBe(true)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'summarize this',
        wasMentioned: true,
      }),
    )
  })

  it('blocks group when group policy is disabled', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
        groupPolicy: 'disabled',
      }),
      resolveRoute: vi.fn(),
      dispatch,
    })

    const result = await handler.handle(createEvent({ chatType: 'group' }))
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/disabled/i)
  })

  it('blocks group when allowlist excludes chat', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
        groupPolicy: 'allowlist',
        groupAllowFrom: ['oc_x'],
        requireMention: false,
      }),
      resolveRoute: vi.fn(),
      dispatch,
    })

    const result = await handler.handle(createEvent({ chatType: 'group', chatId: 'oc_001' }))
    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/allowlist/i)
  })

  it('passes accountId to routing resolver', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const resolveRoute = vi.fn().mockReturnValue({
      agentId: 'agent-A',
      sessionKey: 'agent:agent-A:feishu:direct:ou_001',
    })

    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({ appId: 'cli_x', appSecret: 'sec_x' }),
      resolveRoute,
      dispatch,
    })

    await handler.handle(createEvent({ accountId: 'corpA' }))

    expect(resolveRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'corpA',
        peerId: 'ou_001',
      }),
    )
  })

  it('uses chatId as routing peer for group', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const resolveRoute = vi.fn().mockReturnValue({
      agentId: 'agent-A',
      sessionKey: 'agent:agent-A:feishu:group:oc_001',
    })

    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
        requireMention: false,
      }),
      resolveRoute,
      dispatch,
    })

    await handler.handle(createEvent({ chatType: 'group', chatId: 'oc_group_1' }))

    expect(resolveRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        chatType: 'group',
        peerId: 'oc_group_1',
      }),
    )
  })

  it('returns not_accepted when text becomes empty after stripping mention', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({
        appId: 'cli_x',
        appSecret: 'sec_x',
        requireMention: true,
      }),
      resolveRoute: vi.fn(),
      dispatch,
    })

    const result = await handler.handle(
      createEvent({
        chatType: 'group',
        text: '<at user_id="cli_x">bot</at>',
      }),
    )

    expect(result.accepted).toBe(false)
    expect(result.reason).toMatch(/empty/i)
  })

  it('throws when route resolution fails', async () => {
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({ appId: 'cli_x', appSecret: 'sec_x' }),
      resolveRoute: vi.fn(() => {
        throw new Error('route failed')
      }),
      dispatch: vi.fn(),
    })

    await expect(handler.handle(createEvent())).rejects.toThrow(/route failed/i)
  })

  it('propagates dispatch failure', async () => {
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({ appId: 'cli_x', appSecret: 'sec_x' }),
      resolveRoute: vi.fn().mockReturnValue({
        agentId: 'agent-A',
        sessionKey: 'agent:agent-A:feishu:direct:ou_001',
      }),
      dispatch: vi.fn(async () => {
        throw new Error('dispatch failed')
      }),
    })

    await expect(handler.handle(createEvent())).rejects.toThrow(/dispatch failed/i)
  })

  it('includes sender metadata in dispatch payload', async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined)
    const handler = createFeishuBotHandler({
      dedup: { isDuplicate: vi.fn().mockReturnValue(false) },
      getConfig: vi.fn().mockResolvedValue({ appId: 'cli_x', appSecret: 'sec_x' }),
      resolveRoute: vi.fn().mockReturnValue({
        agentId: 'agent-A',
        sessionKey: 'agent:agent-A:feishu:direct:ou_001',
      }),
      dispatch,
    })

    await handler.handle(createEvent({ senderName: 'Alice Zhang' }))

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: 'ou_001',
        senderName: 'Alice Zhang',
      }),
    )
  })
})
