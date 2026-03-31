import {
  checkBotMentionedWithEntities,
  stripBotMentionWithEntities,
  type FeishuMentionEntity,
} from './mention.js'
import { checkDmPolicy, checkGroupPolicy } from './policy.js'
import type { IMInboundMessage, IMRoutingConfig } from '../../types.js'
import type { FeishuSessionScope } from './config-schema.js'

export interface FeishuInboundEvent {
  accountId?: string
  messageId: string
  chatId: string
  chatType: 'direct' | 'group'
  senderId: string
  senderName?: string
  mentions?: FeishuMentionEntity[]
  rootId?: string
  text: string
  timestamp: number
}

export interface FeishuRouteInput {
  accountId?: string
  channel: string
  chatType: 'direct' | 'group'
  peerId: string
  botIdentity?: string
}

export interface FeishuRouteResult {
  agentId: string
  sessionKey: string
}

export interface FeishuBotHandlerResult {
  accepted: boolean
  reason?: string
}

export interface FeishuBotConfig {
  appId?: string
  appSecret?: string
  sessionScope?: FeishuSessionScope
  dmPolicy?: 'open' | 'allowlist' | 'pairing'
  allowFrom?: Array<string | number>
  groupPolicy?: 'open' | 'allowlist' | 'disabled'
  groupAllowFrom?: Array<string | number>
  requireMention?: boolean
}

export interface FeishuBotHandlerDependencies {
  dedup: {
    isDuplicate: (messageId: string, timestamp?: number) => boolean
  }
  getConfig: (accountId?: string) => Promise<FeishuBotConfig>
  resolveRoute: (input: FeishuRouteInput & { config?: IMRoutingConfig }) => FeishuRouteResult
  dispatch: (message: IMInboundMessage) => Promise<void>
  getRoutingConfig?: () => Promise<IMRoutingConfig>
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function resolveFeishuPeerId(event: FeishuInboundEvent, config: FeishuBotConfig): {
  peerId: string
  sessionScope: FeishuSessionScope
} {
  if (event.chatType === 'direct') {
    return {
      peerId: event.senderId,
      sessionScope: 'peer',
    }
  }

  const sessionScope = config.sessionScope ?? 'peer'
  const rootId = typeof event.rootId === 'string' && event.rootId.trim()
    ? event.rootId.trim()
    : undefined

  if (sessionScope === 'peer_sender') {
    return {
      peerId: `${event.chatId}:sender:${event.senderId}`,
      sessionScope,
    }
  }

  if (sessionScope === 'peer_thread' && rootId) {
    return {
      peerId: `${event.chatId}:thread:${rootId}`,
      sessionScope,
    }
  }

  if (sessionScope === 'peer_thread') {
    return {
      peerId: event.chatId,
      sessionScope: 'peer',
    }
  }

  if (sessionScope === 'peer_thread_sender') {
    if (rootId) {
      return {
        peerId: `${event.chatId}:thread:${rootId}:sender:${event.senderId}`,
        sessionScope,
      }
    }

    return {
      peerId: `${event.chatId}:sender:${event.senderId}`,
      sessionScope: 'peer_sender',
    }
  }

  return {
    peerId: event.chatId,
    sessionScope: 'peer',
  }
}

export function createFeishuBotHandler(deps: FeishuBotHandlerDependencies) {
  const knownBotMentions = new Map<string, FeishuMentionEntity>()

  return {
    async handle(event: FeishuInboundEvent): Promise<FeishuBotHandlerResult> {
      if (deps.dedup.isDuplicate(event.messageId, event.timestamp)) {
        return { accepted: false, reason: 'duplicate message' }
      }

      const config = await deps.getConfig(event.accountId)

      let body = normalizeText(event.text)
      let wasMentioned = false

      if (event.chatType === 'group') {
        const groupDecision = checkGroupPolicy(config, event.chatId)
        if (!groupDecision.allowed) {
          return { accepted: false, reason: groupDecision.reason ?? 'group policy blocked' }
        }

        const requireMention = config.requireMention ?? true
        if (requireMention) {
          const mentionCacheKey = `${event.accountId ?? 'default'}:${config.appId ?? 'unknown'}`
          const knownMention = knownBotMentions.get(mentionCacheKey)
          const mentionIdentity = {
            appId: config.appId,
            openId: knownMention?.openId,
            userId: knownMention?.userId,
            unionId: knownMention?.unionId,
          }
          wasMentioned = checkBotMentionedWithEntities(body, mentionIdentity, event.mentions)
          if (wasMentioned) {
            const matchedMention = (event.mentions ?? []).find((mention) => checkBotMentionedWithEntities(body, mentionIdentity, [mention]))
            if (matchedMention) {
              knownBotMentions.set(mentionCacheKey, matchedMention)
            }
            body = stripBotMentionWithEntities(body, mentionIdentity, event.mentions)
          }
        }
      } else {
        const dmDecision = checkDmPolicy(config, event.senderId)
        if (!dmDecision.allowed) {
          return { accepted: false, reason: dmDecision.reason ?? 'dm policy blocked' }
        }
      }

      body = normalizeText(body)
      if (!body) {
        return { accepted: false, reason: 'empty text after preprocessing' }
      }

      const { peerId, sessionScope } = resolveFeishuPeerId(event, config)
      const routingConfig = deps.getRoutingConfig ? await deps.getRoutingConfig() : undefined
      const route = deps.resolveRoute({
        config: routingConfig,
        accountId: event.accountId,
        channel: 'feishu',
        chatType: event.chatType,
        peerId,
        botIdentity: config.appId,
      })

      const triggerAgent = event.chatType === 'direct' ? true : wasMentioned || (config.requireMention ?? true) === false

      console.log('[IM][FeishuBot] inbound decision', {
        messageId: event.messageId,
        accountId: event.accountId ?? 'default',
        chatType: event.chatType,
        requireMention: config.requireMention ?? true,
        wasMentioned,
        triggerAgent,
        mentions: event.mentions?.map((mention) => ({
          openId: mention.openId,
          userId: mention.userId,
          unionId: mention.unionId,
          name: mention.name,
        })) ?? [],
        textPreview: body.slice(0, 120),
      })

      await deps.dispatch({
        body,
        channel: 'feishu',
        chatType: event.chatType,
        senderId: event.senderId,
        senderName: event.senderName,
        chatId: event.chatId,
        accountId: event.accountId,
        botIdentity: config.appId,
        agentId: route.agentId,
        sessionKey: route.sessionKey,
        messageId: event.messageId,
        timestamp: event.timestamp,
        rootId: event.rootId,
        sessionScope,
        triggerAgent,
        wasMentioned,
        peerId,
      })

      return { accepted: true }
    },
  }
}
