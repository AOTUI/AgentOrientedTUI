export type FeishuReceiveIdType = 'chat_id' | 'open_id' | 'user_id' | 'email' | 'union_id'
export type FeishuDomain = 'feishu' | 'lark'

export function normalizeReceiveIdType(value: string | undefined): FeishuReceiveIdType {
  if (!value) {
    return 'chat_id'
  }

  const allowed: FeishuReceiveIdType[] = ['chat_id', 'open_id', 'user_id', 'email', 'union_id']
  if ((allowed as string[]).includes(value)) {
    return value as FeishuReceiveIdType
  }

  throw new Error('invalid receive_id_type')
}

export function normalizeDomain(value: string | undefined): FeishuDomain {
  if (!value) {
    return 'feishu'
  }

  if (value === 'feishu' || value === 'lark') {
    return value
  }

  throw new Error('invalid domain')
}

export function buildMessageApiBase(domain: FeishuDomain, apiBaseUrl?: string): string {
  if (apiBaseUrl && apiBaseUrl.trim()) {
    return apiBaseUrl.trim()
  }

  return domain === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn'
}
