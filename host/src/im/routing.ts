import type { ChatType, ResolveIMRouteParams, ResolveIMRouteResult } from './types.js'

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function buildSessionKey(agentId: string, channel: string, chatType: ChatType, peerId: string, botIdentity?: string): string {
  const normalizedAgentId = toNonEmptyString(agentId)
  if (!normalizedAgentId) {
    throw new Error('agentId is required to build sessionKey')
  }

  const normalizedChannel = toNonEmptyString(channel)
  if (!normalizedChannel) {
    throw new Error('channel is required to build sessionKey')
  }

  const normalizedPeerId = toNonEmptyString(peerId)
  if (!normalizedPeerId) {
    throw new Error('peerId is required to build sessionKey')
  }

  const normalizedBotIdentity = toNonEmptyString(botIdentity)
  if (normalizedBotIdentity) {
    return `agent:${normalizedAgentId}:${normalizedChannel}:bot:${normalizedBotIdentity}:${chatType}:${normalizedPeerId}`
  }

  return `agent:${normalizedAgentId}:${normalizedChannel}:${chatType}:${normalizedPeerId}`
}

export function isIMSessionKey(value: string): boolean {
  const normalized = toNonEmptyString(value)
  if (!normalized) {
    return false
  }

  const parts = normalized.split(':')
  if (parts.length >= 7 && parts[0] === 'agent' && parts[3] === 'bot') {
    return parts[1].trim().length > 0
      && parts[2].trim().length > 0
      && parts[4].trim().length > 0
      && (parts[5] === 'direct' || parts[5] === 'group')
      && parts.slice(6).join(':').trim().length > 0
  }

  return parts.length >= 5
    && parts[0] === 'agent'
    && parts[1].trim().length > 0
    && parts[2].trim().length > 0
    && (parts[3] === 'direct' || parts[3] === 'group')
    && parts.slice(4).join(':').trim().length > 0
}

function getChannelConfig(params: ResolveIMRouteParams): { botAgentId?: string; accounts?: Record<string, { botAgentId?: string }> } {
  const channels = params.config.im?.channels
  const channelConfig = channels?.[params.channel]
  return channelConfig ?? {}
}

export function resolveIMRoute(params: ResolveIMRouteParams): ResolveIMRouteResult {
  const channelConfig = getChannelConfig(params)

  const accountAgentId = params.accountId
    ? toNonEmptyString(channelConfig.accounts?.[params.accountId]?.botAgentId)
    : null

  const channelAgentId = toNonEmptyString(channelConfig.botAgentId)
  const activeAgentId = toNonEmptyString(params.config.agents?.activeAgentId)

  const agentId = accountAgentId ?? channelAgentId ?? activeAgentId
  if (!agentId) {
    throw new Error(`Cannot resolve agent for channel "${params.channel}"`)
  }

  return {
    agentId,
    sessionKey: buildSessionKey(agentId, params.channel, params.chatType, params.peerId, params.botIdentity),
  }
}
