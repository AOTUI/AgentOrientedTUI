import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { sendTextMessage, sendCardMessage } from '../../../../src/im/channels/feishu/send.ts'

describe('Feishu send api', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sends text message and returns message id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 0, data: { message_id: 'om_1' } }),
    })
    global.fetch = fetchMock as any

    const result = await sendTextMessage({
      apiBaseUrl: 'https://open.feishu.cn',
      botToken: 'token_1',
      receiveIdType: 'chat_id',
      receiveId: 'oc_1',
      text: 'hello',
    })

    expect(result.messageId).toBe('om_1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends card message and returns message id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 0, data: { message_id: 'om_2' } }),
    })
    global.fetch = fetchMock as any

    const result = await sendCardMessage({
      apiBaseUrl: 'https://open.feishu.cn',
      botToken: 'token_1',
      receiveIdType: 'chat_id',
      receiveId: 'oc_1',
      card: { schema: '2.0', config: { wide_screen_mode: true } },
    })

    expect(result.messageId).toBe('om_2')
  })

  it('throws when feishu returns non-zero code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 99991663, msg: 'bad request' }),
    })
    global.fetch = fetchMock as any

    await expect(
      sendTextMessage({
        apiBaseUrl: 'https://open.feishu.cn',
        botToken: 'token_1',
        receiveIdType: 'chat_id',
        receiveId: 'oc_1',
        text: 'hello',
      }),
    ).rejects.toThrow(/99991663|bad request/i)
  })

  it('throws when network status is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server error',
    })
    global.fetch = fetchMock as any

    await expect(
      sendTextMessage({
        apiBaseUrl: 'https://open.feishu.cn',
        botToken: 'token_1',
        receiveIdType: 'chat_id',
        receiveId: 'oc_1',
        text: 'hello',
      }),
    ).rejects.toThrow(/500|server error/i)
  })

  it('throws when response has no message id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 0, data: {} }),
    })
    global.fetch = fetchMock as any

    await expect(
      sendTextMessage({
        apiBaseUrl: 'https://open.feishu.cn',
        botToken: 'token_1',
        receiveIdType: 'chat_id',
        receiveId: 'oc_1',
        text: 'hello',
      }),
    ).rejects.toThrow(/message_id/i)
  })
})
