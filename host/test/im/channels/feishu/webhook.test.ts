import { describe, expect, it } from 'vitest'
import { parseFeishuWebhookPayload } from '../../../../src/im/channels/feishu/webhook.js'

describe('Feishu webhook payload parser', () => {
  it('parses url verification payload', () => {
    const parsed = parseFeishuWebhookPayload({
      type: 'url_verification',
      token: 'verify_123',
      challenge: 'challenge_abc',
    })

    expect(parsed).toEqual({
      kind: 'challenge',
      token: 'verify_123',
      challenge: 'challenge_abc',
    })
  })

  it('parses im.message.receive_v1 callback into Feishu inbound event', () => {
    const parsed = parseFeishuWebhookPayload({
      token: 'verify_123',
      header: {
        event_type: 'im.message.receive_v1',
      },
      event: {
        sender: {
          sender_id: {
            open_id: 'ou_sender_1',
          },
        },
        message: {
          message_id: 'om_webhook_1',
          chat_id: 'oc_group_1',
          chat_type: 'group',
          message_type: 'text',
          root_id: 'om_root_1',
          content: JSON.stringify({ text: 'hello from webhook' }),
        },
      },
    }, 'corpA')

    expect(parsed.kind).toBe('event')
    if (parsed.kind !== 'event') {
      throw new Error('expected event payload')
    }

    expect(parsed.token).toBe('verify_123')
    expect(parsed.event).toEqual(expect.objectContaining({
      accountId: 'corpA',
      messageId: 'om_webhook_1',
      chatId: 'oc_group_1',
      chatType: 'group',
      senderId: 'ou_sender_1',
      rootId: 'om_root_1',
      text: 'hello from webhook',
    }))
    expect(typeof parsed.event.timestamp).toBe('number')
  })
})
