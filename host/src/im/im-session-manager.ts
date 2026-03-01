import { EventEmitter } from 'events'
import { IMDrivenSource } from './im-driven-source.js'
import type {
  IMInboundMessage,
  IMSession,
  IMDesktopLike,
  IMAgentDriverLike,
} from './types.js'

export interface IMSessionManagerOptions {
  createDesktop: (input: {
    sessionKey: string
    agentId: string
    workspaceDirPath: string
  }) => Promise<IMDesktopLike>
  createAgentDriver: (input: {
    sessionKey: string
    agentId: string
    desktop: IMDesktopLike
    source: IMDrivenSource
  }) => IMAgentDriverLike
  createSource?: (input: { sessionKey: string }) => IMDrivenSource
  now?: () => number
  maxSessions?: number
  workspaceDirPath?: string
}

function parseSessionParts(sessionKey: string): { channel: string; chatType: 'direct' | 'group'; peerId: string } {
  const parts = sessionKey.split(':')
  if (parts.length < 5) {
    return { channel: 'unknown', chatType: 'direct', peerId: 'unknown' }
  }

  return {
    channel: parts[2] || 'unknown',
    chatType: parts[3] === 'group' ? 'group' : 'direct',
    peerId: parts.slice(4).join(':') || 'unknown',
  }
}

function requireNonEmpty(value: string, fieldName: string): string {
  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(`${fieldName} is required`)
  }
  return normalized
}

export class IMSessionManager extends EventEmitter {
  private readonly sessions = new Map<string, IMSession>()
  private readonly inFlight = new Map<string, Promise<IMSession>>()
  private readonly now: () => number
  private readonly maxSessions: number
  private readonly workspaceDirPath: string
  private readonly options: IMSessionManagerOptions

  constructor(options: IMSessionManagerOptions) {
    super()
    this.options = options
    this.now = options.now ?? (() => Date.now())
    this.maxSessions = options.maxSessions ?? 100
    this.workspaceDirPath = options.workspaceDirPath ?? '~'
  }

  getSession(sessionKey: string): IMSession | undefined {
    return this.sessions.get(sessionKey)
  }

  async ensureSession(sessionKey: string, agentId: string): Promise<IMSession> {
    const normalizedSessionKey = requireNonEmpty(sessionKey, 'sessionKey')
    const normalizedAgentId = requireNonEmpty(agentId, 'agentId')

    const existing = this.sessions.get(normalizedSessionKey)
    if (existing) {
      existing.lastAccessTime = this.now()
      return existing
    }

    const creating = this.inFlight.get(normalizedSessionKey)
    if (creating) {
      return creating
    }

    if (this.sessions.size >= this.maxSessions) {
      await this.evictOldestSession()
    }

    const promise = this.createSession(normalizedSessionKey, normalizedAgentId).finally(() => {
      this.inFlight.delete(normalizedSessionKey)
    })

    this.inFlight.set(normalizedSessionKey, promise)
    return promise
  }

  async dispatch(message: IMInboundMessage): Promise<IMSession> {
    const sessionKey = requireNonEmpty(message.sessionKey, 'sessionKey')
    const agentId = requireNonEmpty(message.agentId, 'agentId')

    const session = await this.ensureSession(sessionKey, agentId)
    session.lastAccessTime = this.now()

    session.source.addMessage(
      {
        role: 'user',
        content: message.body,
      },
      message.timestamp,
    )
    session.source.notifyUpdate()

    this.emit('dispatch', { sessionKey, messageId: message.messageId })
    return session
  }

  async destroySession(sessionKey: string): Promise<void> {
    const session = this.sessions.get(sessionKey)
    if (!session) {
      return
    }

    this.sessions.delete(sessionKey)

    if (session.agentDriver?.stop) {
      await Promise.resolve(session.agentDriver.stop())
    }

    if (session.desktop?.destroy) {
      await Promise.resolve(session.desktop.destroy())
    }

    this.emit('destroy', { sessionKey })
  }

  private async createSession(sessionKey: string, agentId: string): Promise<IMSession> {
    const source = this.options.createSource
      ? this.options.createSource({ sessionKey })
      : new IMDrivenSource({ sessionKey })

    const desktop = await this.options.createDesktop({
      sessionKey,
      agentId,
      workspaceDirPath: this.workspaceDirPath,
    })

    const agentDriver = this.options.createAgentDriver({
      sessionKey,
      agentId,
      desktop,
      source,
    })

    const time = this.now()
    const parts = parseSessionParts(sessionKey)

    const session: IMSession = {
      sessionKey,
      agentId,
      channel: parts.channel,
      chatType: parts.chatType,
      peerId: parts.peerId,
      desktop,
      agentDriver,
      source,
      createdAt: time,
      lastAccessTime: time,
    }

    this.sessions.set(sessionKey, session)
    return session
  }

  private async evictOldestSession(): Promise<void> {
    let oldest: IMSession | undefined

    for (const candidate of this.sessions.values()) {
      if (!oldest || candidate.lastAccessTime < oldest.lastAccessTime) {
        oldest = candidate
      }
    }

    if (!oldest) {
      return
    }

    await this.destroySession(oldest.sessionKey)
  }
}
