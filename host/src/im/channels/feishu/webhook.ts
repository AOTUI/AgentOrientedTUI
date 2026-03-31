import type { FeishuInboundEvent } from './bot.js'

interface FeishuWebhookSender {
  sender_id?: {
    open_id?: string
    user_id?: string
    union_id?: string
  }
}

interface FeishuWebhookMessage {
  message_id?: string
  root_id?: string
  chat_id?: string
  chat_type?: 'p2p' | 'group'
  message_type?: string
  content?: string
  mentions?: Array<{
    key?: string
    name?: string
    id?: {
      open_id?: string
      user_id?: string
      union_id?: string
    }
  }>
}

interface FeishuWebhookPayload {
  type?: string
  token?: string
  challenge?: string
  header?: {
    event_type?: string
  }
  event?: {
    sender?: FeishuWebhookSender
    message?: FeishuWebhookMessage
  }
}

export type ParsedFeishuWebhook =
  | { kind: 'challenge'; token?: string; challenge: string }
  | { kind: 'event'; token?: string; event: FeishuInboundEvent }

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return value as Record<string, unknown>
}

function extractText(content: string, messageType: string): string {
  try {
    const parsed = JSON.parse(content)
    if (messageType === 'text') {
      return typeof parsed.text === 'string' ? parsed.text : ''
    }
    return typeof parsed.text === 'string' ? parsed.text : content
  } catch {
    return content
  }
}

function readSenderId(sender: FeishuWebhookSender | undefined): string {
  return sender?.sender_id?.open_id
    ?? sender?.sender_id?.user_id
    ?? sender?.sender_id?.union_id
    ?? 'unknown'
}

export function parseFeishuWebhookPayload(payload: unknown, accountId?: string): ParsedFeishuWebhook {
  const body = toRecord(payload) as FeishuWebhookPayload

  if (body.type === 'url_verification') {
    if (typeof body.challenge !== 'string' || !body.challenge.trim()) {
      throw new Error('Feishu webhook challenge is missing')
    }
    return {
      kind: 'challenge',
      token: typeof body.token === 'string' ? body.token : undefined,
      challenge: body.challenge,
    }
  }

  const eventType = body.header?.event_type
  if (eventType !== 'im.message.receive_v1') {
    throw new Error(`unsupported Feishu webhook event type: ${eventType ?? 'unknown'}`)
  }

  const message = body.event?.message
  if (!message?.message_id || !message.chat_id || !message.chat_type) {
    throw new Error('Feishu webhook message payload is incomplete')
  }

  const rawContent = typeof message.content === 'string' ? message.content : ''
  const messageType = typeof message.message_type === 'string' ? message.message_type : 'text'

  return {
    kind: 'event',
    token: typeof body.token === 'string' ? body.token : undefined,
    event: {
      accountId,
      messageId: message.message_id,
      chatId: message.chat_id,
      chatType: message.chat_type === 'p2p' ? 'direct' : 'group',
      senderId: readSenderId(body.event?.sender),
      mentions: Array.isArray(message.mentions)
        ? message.mentions.map((mention) => ({
          key: mention.key,
          openId: mention.id?.open_id,
          userId: mention.id?.user_id,
          unionId: mention.id?.union_id,
          name: mention.name,
        }))
        : undefined,
      rootId: typeof message.root_id === 'string' ? message.root_id : undefined,
      text: extractText(rawContent, messageType),
      timestamp: Date.now(),
    },
  }
}
