export interface FeishuMentionIdentity {
  openId?: string
  appId?: string
}

function normalizeToken(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function buildMentionRegExp(token: string): RegExp {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<at\\s+user_id=[\"']${escaped}[\"'][^>]*>.*?<\\/at>`, 'gi')
}

export function checkBotMentioned(text: string, identity: FeishuMentionIdentity): boolean {
  const source = text ?? ''
  const tokens = [normalizeToken(identity.openId), normalizeToken(identity.appId)].filter(Boolean) as string[]

  if (tokens.length === 0) {
    return false
  }

  return tokens.some((token) => buildMentionRegExp(token).test(source))
}

export function stripBotMention(text: string, identity: FeishuMentionIdentity): string {
  const tokens = [normalizeToken(identity.openId), normalizeToken(identity.appId)].filter(Boolean) as string[]
  if (tokens.length === 0) {
    return text
  }

  let output = text
  for (const token of tokens) {
    output = output.replace(buildMentionRegExp(token), ' ')
  }

  return output.replace(/\s+/g, ' ').trim()
}
