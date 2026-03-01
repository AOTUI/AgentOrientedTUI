import { checkBotMentioned, stripBotMention } from './mention.js'
import { checkDmPolicy, checkGroupPolicy } from './policy.js'
import type { IMInboundMessage, IMRoutingConfig } from '../../types.js'

export interface FeishuInboundEvent {
  accountId?: string
  messageId: string
  chatId: string
  chatType: 'direct' | 'group'
  senderId: string
  senderName?: string
  text: string
  timestamp: number
}

export interface FeishuRouteInput {
  accountId?: string
  channel: string
  chatType: 'direct' | 'group'
  peerId: string
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

export function createFeishuBotHandler(deps: FeishuBotHandlerDependencies) {
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
          wasMentioned = checkBotMentioned(body, { appId: config.appId })
          if (!wasMentioned) {
            return { accepted: false, reason: 'mention required in group' }
          }
          body = stripBotMention(body, { appId: config.appId })
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

      const peerId = event.chatType === 'direct' ? event.senderId : event.chatId
      const routingConfig = deps.getRoutingConfig ? await deps.getRoutingConfig() : undefined
      const route = deps.resolveRoute({
        config: routingConfig,
        accountId: event.accountId,
        channel: 'feishu',
        chatType: event.chatType,
        peerId,
      })

      await deps.dispatch({
        body,
        channel: 'feishu',
        chatType: event.chatType,
        senderId: event.senderId,
        senderName: event.senderName,
        chatId: event.chatId,
        accountId: event.accountId,
        agentId: route.agentId,
        sessionKey: route.sessionKey,
        messageId: event.messageId,
        timestamp: event.timestamp,
        wasMentioned,
        peerId,
      })

      return { accepted: true }
    },
  }
}
