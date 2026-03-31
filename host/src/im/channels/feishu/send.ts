export interface FeishuSendBaseInput {
  apiBaseUrl: string
  botToken: string
  receiveIdType: 'chat_id' | 'open_id' | 'user_id' | 'email' | 'union_id'
  receiveId: string
  rootId?: string
}

export interface SendTextMessageInput extends FeishuSendBaseInput {
  text: string
}

export interface SendCardMessageInput extends FeishuSendBaseInput {
  card: Record<string, unknown>
}

export interface FeishuSendResult {
  messageId: string
}

function requireField(value: string, fieldName: string): string {
  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(`${fieldName} is required`)
  }
  return normalized
}

async function sendMessage(
  input: FeishuSendBaseInput,
  messageType: 'text' | 'interactive',
  content: Record<string, unknown>,
): Promise<FeishuSendResult> {
  const apiBaseUrl = requireField(input.apiBaseUrl, 'apiBaseUrl')
  const botToken = requireField(input.botToken, 'botToken')
  const receiveId = requireField(input.receiveId, 'receiveId')

  const url = `${apiBaseUrl}/open-apis/im/v1/messages?receive_id_type=${input.receiveIdType}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: messageType,
      content: JSON.stringify(content),
      ...(input.rootId ? { root_id: input.rootId } : {}),
    }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`Feishu API request failed: ${response.status} ${rawText}`)
  }

  const payload = JSON.parse(rawText) as { code?: number; msg?: string; data?: { message_id?: string } }
  if (payload.code !== 0) {
    throw new Error(`Feishu API error: ${payload.code ?? 'unknown'} ${payload.msg ?? ''}`.trim())
  }

  const messageId = payload.data?.message_id
  if (!messageId) {
    throw new Error('Feishu API response missing message_id')
  }

  return { messageId }
}

export async function sendTextMessage(input: SendTextMessageInput): Promise<FeishuSendResult> {
  return sendMessage(input, 'text', { text: input.text })
}

export async function sendCardMessage(input: SendCardMessageInput): Promise<FeishuSendResult> {
  return sendMessage(input, 'interactive', input.card)
}
