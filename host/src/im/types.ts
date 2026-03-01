import type { ModelMessage } from 'ai'

export type ChatType = 'direct' | 'group'

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
  body: string
  messageId: string
  senderId: string
  chatId: string
  timestamp: number
  wasMentioned?: boolean
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
}

export interface IMSession {
  sessionKey: string
  agentId: string
  channel: string
  chatType: ChatType
  peerId: string
  accountId?: string
  desktop: IMDesktopLike
  agentDriver: IMAgentDriverLike
  source: IMDrivenSourceLike
  createdAt: number
  lastAccessTime: number
}
