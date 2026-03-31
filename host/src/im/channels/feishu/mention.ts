export interface FeishuMentionIdentity {
  openId?: string
  appId?: string
  userId?: string
  unionId?: string
}

export interface FeishuMentionEntity {
  key?: string
  openId?: string
  userId?: string
  unionId?: string
  name?: string
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
  const tokens = [
    normalizeToken(identity.openId),
    normalizeToken(identity.appId),
    normalizeToken(identity.userId),
    normalizeToken(identity.unionId),
  ].filter(Boolean) as string[]

  if (tokens.length === 0) {
    return false
  }

  return tokens.some((token) => buildMentionRegExp(token).test(source))
}

export function checkBotMentionedWithEntities(
  text: string,
  identity: FeishuMentionIdentity,
  mentions?: FeishuMentionEntity[],
): boolean {
  const normalizedMentions = Array.isArray(mentions) ? mentions : []
  const normalizedAppId = normalizeToken(identity.appId)
  const normalizedOpenId = normalizeToken(identity.openId)
  const normalizedUserId = normalizeToken(identity.userId)
  const normalizedUnionId = normalizeToken(identity.unionId)

  if (normalizedMentions.some((mention) => {
    return normalizeToken(mention.userId) === normalizedAppId
      || normalizeToken(mention.openId) === normalizedOpenId
      || normalizeToken(mention.userId) === normalizedUserId
      || normalizeToken(mention.unionId) === normalizedUnionId
      || normalizeToken(mention.unionId) === normalizedAppId
      || normalizeToken(mention.unionId) === normalizedOpenId
  })) {
    return true
  }

  return checkBotMentioned(text, identity)
}

function matchesMentionEntity(identity: FeishuMentionIdentity, mention: FeishuMentionEntity): boolean {
  const normalizedAppId = normalizeToken(identity.appId)
  const normalizedOpenId = normalizeToken(identity.openId)
  const normalizedUserId = normalizeToken(identity.userId)
  const normalizedUnionId = normalizeToken(identity.unionId)

  return normalizeToken(mention.userId) === normalizedAppId
    || normalizeToken(mention.userId) === normalizedUserId
    || normalizeToken(mention.openId) === normalizedOpenId
    || normalizeToken(mention.unionId) === normalizedUnionId
    || normalizeToken(mention.unionId) === normalizedAppId
    || normalizeToken(mention.unionId) === normalizedOpenId
}

export function stripBotMentionWithEntities(
  text: string,
  identity: FeishuMentionIdentity,
  mentions?: FeishuMentionEntity[],
): string {
  let output = stripBotMention(text, identity)

  for (const mention of Array.isArray(mentions) ? mentions : []) {
    if (!matchesMentionEntity(identity, mention)) {
      continue
    }

    const key = normalizeToken(mention.key)
    if (key) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      output = output.replace(new RegExp(`@${escaped}`, 'g'), ' ')
    }
  }

  return output.replace(/\s+/g, ' ').trim()
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
