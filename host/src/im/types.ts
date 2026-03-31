import type { ModelMessage } from 'ai'
import type { SourceControlsSnapshot } from '../core/source-controls.js'

export type ChatType = 'direct' | 'group'
export type IMSessionScope = 'peer' | 'peer_sender' | 'peer_thread' | 'peer_thread_sender'

export interface IMRoutingConfig {
  agents?: {
    activeAgentId?: string | null
  }
  im?: {
    channels?: Record<string, {
      botAgentId?: string
      accounts?: Record<string, {
        botAgentId?: string
      }>
    }>
  }
}

export interface ResolveIMRouteParams {
  config: IMRoutingConfig
  channel: string
  chatType: ChatType
  peerId: string
  accountId?: string
  botIdentity?: string
}

export interface ResolveIMRouteResult {
  agentId: string
  sessionKey: string
}

export interface IMInboundMessage {
  sessionKey: string
  agentId: string
  channel: string
  chatType: ChatType
  peerId: string
  botIdentity?: string
  sessionScope?: IMSessionScope
  body: string
  messageId: string
  senderId: string
  chatId: string
  rootId?: string
  timestamp: number
  wasMentioned?: boolean
  triggerAgent?: boolean
  senderName?: string
  accountId?: string
}

export interface IMDesktopLike {
  id: string
  destroy?: () => void | Promise<void>
}

export interface IMAgentDriverLike {
  stop?: () => void | Promise<void>
}

export interface IMDrivenSourceLike {
  name: string
  getMessages: () => Promise<Array<{ role: string; content: unknown; timestamp: number }>>
  addMessage: (message: ModelMessage, timestamp?: number) => unknown
  notifyUpdate: () => void
  getCompactionToolName?: () => string
  maybeCompactByThreshold?: (policyInput?: {
    enabled?: boolean
    maxContextTokens?: number
    minMessages?: number
    keepRecentMessages?: number
    modelHint?: string
  }) => Promise<{
    compacted: boolean
    syntheticMessages: Array<{ role: string; content: unknown; timestamp: number }>
    summary: string
    compactedMessageCount: number
    cleanedToolResultCount: number
    currentTokens: number
    thresholdTokens: number
  }>
}

export interface IMSession {
  sessionKey: string
  agentId: string
  channel: string
  chatType: ChatType
  peerId: string
  botIdentity?: string
  accountId?: string
  sourceControls?: SourceControlsSnapshot
  desktop: IMDesktopLike
  agentDriver: IMAgentDriverLike
  source: IMDrivenSourceLike
  createdAt: number
  lastAccessTime: number
}
