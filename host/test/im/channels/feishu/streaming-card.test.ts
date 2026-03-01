import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FeishuStreamingSession, type StreamingCardCredentials } from '../../../../src/im/channels/feishu/streaming-card.js'

const CREDS: StreamingCardCredentials = {
  appId: 'cli_test',
  appSecret: 'secret_test',
  domain: 'feishu',
}

function jsonResponse(data: Record<string, unknown>, ok = true) {
  return { ok, json: async () => data } as unknown as Response
}

function mockFetch(responses: Array<Record<string, unknown> | [Record<string, unknown>, boolean]>) {
  let callIndex = 0
  return vi.fn(async () => {
    const r = responses[callIndex++]
    if (Array.isArray(r)) {
      return jsonResponse(r[0], r[1])
    }
    return jsonResponse(r ?? { code: 0 })
  })
}

describe('FeishuStreamingSession', () => {
  const fetchToken = vi.fn(async () => 't-mock-token')

  beforeEach(() => {
    fetchToken.mockClear()
  })

  it('start() creates card and sends interactive message', async () => {
    const fetchImpl = mockFetch([
      // 1. Create card → success
      { code: 0, data: { card_id: 'card_001' } },
      // 2. Send message → success
      { code: 0, data: { message_id: 'msg_001' } },
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await session.start('oc_chat1', 'chat_id')

    expect(session.isActive()).toBe(true)
    expect(session.getCardId()).toBe('card_001')

    // First call: create card
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [createUrl, createOpts] = fetchImpl.mock.calls[0]
    expect(createUrl).toBe('https://open.feishu.cn/open-apis/cardkit/v1/cards')
    expect(createOpts.method).toBe('POST')
    const createBody = JSON.parse(createOpts.body)
    expect(createBody.type).toBe('card_json')
    const cardJson = JSON.parse(createBody.data)
    expect(cardJson.config.streaming_mode).toBe(true)

    // Second call: send interactive message
    const [sendUrl, sendOpts] = fetchImpl.mock.calls[1]
    expect(sendUrl).toContain('/open-apis/im/v1/messages')
    expect(sendUrl).toContain('receive_id_type=chat_id')
    const sendBody = JSON.parse(sendOpts.body)
    expect(sendBody.msg_type).toBe('interactive')
    expect(sendBody.receive_id).toBe('oc_chat1')
    expect(JSON.parse(sendBody.content).data.card_id).toBe('card_001')
  })

  it('start() sends reply when replyToMessageId is provided', async () => {
    const fetchImpl = mockFetch([
      { code: 0, data: { card_id: 'card_002' } },
      { code: 0, data: { message_id: 'msg_002' } },
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await session.start('oc_chat1', 'chat_id', { replyToMessageId: 'om_original' })

    const [sendUrl] = fetchImpl.mock.calls[1]
    expect(sendUrl).toContain('/im/v1/messages/om_original/reply')
  })

  it('start() includes card header when provided', async () => {
    const fetchImpl = mockFetch([
      { code: 0, data: { card_id: 'card_003' } },
      { code: 0, data: { message_id: 'msg_003' } },
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await session.start('oc_chat1', 'chat_id', {
      header: { title: 'AI Response', template: 'green' },
    })

    const createBody = JSON.parse(fetchImpl.mock.calls[0][1].body)
    const cardJson = JSON.parse(createBody.data)
    expect(cardJson.header.title.content).toBe('AI Response')
    expect(cardJson.header.template).toBe('green')
  })

  it('update() sends content update via PUT', async () => {
    const fetchImpl = mockFetch([
      { code: 0, data: { card_id: 'card_004' } },
      { code: 0, data: { message_id: 'msg_004' } },
      { code: 0 }, // update
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await session.start('oc_chat1', 'chat_id')
    await session.update('Hello world')

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    const [updateUrl, updateOpts] = fetchImpl.mock.calls[2]
    expect(updateUrl).toBe('https://open.feishu.cn/open-apis/cardkit/v1/cards/card_004/elements/content/content')
    expect(updateOpts.method).toBe('PUT')
    const updateBody = JSON.parse(updateOpts.body)
    expect(updateBody.content).toBe('Hello world')
    expect(updateBody.sequence).toBe(2)
    expect(updateBody.uuid).toBe('s_card_004_2')
  })

  it('update() is throttled at 100ms intervals', async () => {
    const fetchImpl = mockFetch([
      { code: 0, data: { card_id: 'card_005' } },
      { code: 0, data: { message_id: 'msg_005' } },
      { code: 0 }, // first update
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await session.start('oc_chat1', 'chat_id')

    await session.update('First')
    // Rapid second update should be throttled (buffered)
    await session.update('Second')

    // Only 3 fetches: create card + send message + first update
    // The second update was throttled / buffered
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('close() sends final update and disables streaming mode', async () => {
    const fetchImpl = mockFetch([
      { code: 0, data: { card_id: 'card_006' } },
      { code: 0, data: { message_id: 'msg_006' } },
      { code: 0 }, // update
      { code: 0 }, // final content update
      { code: 0 }, // close settings
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await session.start('oc_chat1', 'chat_id')
    await session.update('Partial')
    await session.close('Final answer here')

    expect(session.isActive()).toBe(false)

    // Last call should be PATCH to close streaming
    const lastCall = fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1]
    const [closeUrl, closeOpts] = lastCall
    expect(closeUrl).toContain('/cardkit/v1/cards/card_006/settings')
    expect(closeOpts.method).toBe('PATCH')
    const closeBody = JSON.parse(closeOpts.body)
    const settings = JSON.parse(closeBody.settings)
    expect(settings.config.streaming_mode).toBe(false)
    expect(settings.config.summary.content).toBeTruthy()
  })

  it('close() without prior update uses finalText directly', async () => {
    const fetchImpl = mockFetch([
      { code: 0, data: { card_id: 'card_007' } },
      { code: 0, data: { message_id: 'msg_007' } },
      { code: 0 }, // final content update (currentText is empty, so it updates)
      { code: 0 }, // close settings
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await session.start('oc_chat1', 'chat_id')
    await session.close('Direct final')

    expect(session.isActive()).toBe(false)
    // Should have updated with 'Direct final' + closed
    const contentUpdateCall = fetchImpl.mock.calls[2]
    const [url] = contentUpdateCall
    expect(url).toContain('/elements/content/content')
  })

  it('isActive() returns false before start', () => {
    const session = new FeishuStreamingSession(CREDS, { fetchImpl: vi.fn() as any, fetchToken })
    expect(session.isActive()).toBe(false)
  })

  it('handles multiple updates and close without errors', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ code: 0, data: { card_id: 'card_008', message_id: 'msg_008' } }))

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await session.start('oc_chat1', 'chat_id')
    // Updates after close should be no-ops
    await session.close('done')
    await session.update('after close')
    await session.close('double close')
    // Should not throw
    expect(session.isActive()).toBe(false)
  })

  it('uses Lark domain for API base', async () => {
    const larkCreds: StreamingCardCredentials = {
      ...CREDS,
      domain: 'lark',
    }
    const fetchImpl = mockFetch([
      { code: 0, data: { card_id: 'card_009' } },
      { code: 0, data: { message_id: 'msg_009' } },
    ])

    const session = new FeishuStreamingSession(larkCreds, { fetchImpl: fetchImpl as any, fetchToken })
    await session.start('oc_chat1', 'chat_id')

    const [createUrl] = fetchImpl.mock.calls[0]
    expect(createUrl).toContain('open.larksuite.com')
  })

  it('throws when card creation fails', async () => {
    const fetchImpl = mockFetch([
      { code: 99999, msg: 'invalid app' },
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await expect(session.start('oc_chat1', 'chat_id')).rejects.toThrow('Create card failed')
  })

  it('throws when send message fails', async () => {
    const fetchImpl = mockFetch([
      { code: 0, data: { card_id: 'card_010' } },
      { code: 99999, msg: 'permission denied' },
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken })
    await expect(session.start('oc_chat1', 'chat_id')).rejects.toThrow('Send card message failed')
  })

  it('logs on start, update error, and close', async () => {
    const log = vi.fn()
    const fetchImpl = mockFetch([
      { code: 0, data: { card_id: 'card_011' } },
      { code: 0, data: { message_id: 'msg_011' } },
      { code: 0 }, // update
      { code: 0 }, // close update
      { code: 0 }, // close settings
    ])

    const session = new FeishuStreamingSession(CREDS, { fetchImpl: fetchImpl as any, fetchToken, log })
    await session.start('oc_chat1', 'chat_id')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Started streaming'))

    await session.update('text')
    await session.close('final')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Closed streaming'))
  })
})
