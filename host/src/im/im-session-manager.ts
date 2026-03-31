import { EventEmitter } from 'events'
import { IMDrivenSource } from './im-driven-source.js'
import type { SourceControlsSnapshot } from '../core/source-controls.js'
import type {
  IMInboundMessage,
  IMSession,
  IMDesktopLike,
  IMAgentDriverLike,
} from './types.js'

export interface IMCreatedAgentDriver {
  agentDriver: IMAgentDriverLike
  sourceControls?: SourceControlsSnapshot
}

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
  }) => IMAgentDriverLike | IMCreatedAgentDriver | Promise<IMAgentDriverLike | IMCreatedAgentDriver>
  createSource?: (input: { sessionKey: string }) => IMDrivenSource
  persistSession?: (session: IMSession) => void | Promise<void>
  deletePersistedSession?: (sessionKey: string) => void | Promise<void>
  now?: () => number
  maxSessions?: number
  workspaceDirPath?: string
}

function parseSessionParts(sessionKey: string): { channel: string; chatType: 'direct' | 'group'; peerId: string; botIdentity?: string } {
  const parts = sessionKey.split(':')
  if (parts.length < 5) {
    return { channel: 'unknown', chatType: 'direct', peerId: 'unknown' }
  }

  if (parts.length >= 7 && parts[3] === 'bot') {
    return {
      channel: parts[2] || 'unknown',
      botIdentity: parts[4] || undefined,
      chatType: parts[5] === 'group' ? 'group' : 'direct',
      peerId: parts.slice(6).join(':') || 'unknown',
    }
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
      await this.touchSession(existing)
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
    if (typeof message.accountId === 'string' && message.accountId.trim()) {
      session.accountId = message.accountId
    }
    if (typeof message.botIdentity === 'string' && message.botIdentity.trim()) {
      session.botIdentity = message.botIdentity
    }

    session.source.addMessage(
      {
        role: 'user',
        content: message.body,
      },
      message.timestamp,
    )
    await this.persistSession(session)
    console.log('[IM][SessionManager] dispatch', {
      sessionKey,
      messageId: message.messageId,
      triggerAgent: message.triggerAgent !== false,
      chatType: message.chatType,
      accountId: message.accountId,
      botIdentity: message.botIdentity,
    })
    if (message.triggerAgent !== false) {
      console.log('[IM][SessionManager] notifyUpdate', {
        sessionKey,
        messageId: message.messageId,
      })
      session.source.notifyUpdate()
    }

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

    await this.deletePersistedSession(sessionKey)
    this.emit('destroy', { sessionKey })
  }

  async destroyAllSessions(): Promise<void> {
    const sessionKeys = Array.from(this.sessions.keys())
    for (const sessionKey of sessionKeys) {
      await this.destroySession(sessionKey)
    }
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

    const createdAgentDriver = await this.options.createAgentDriver({
      sessionKey,
      agentId,
      desktop,
      source,
    })
    const resolvedAgentDriver = 'agentDriver' in createdAgentDriver
      ? createdAgentDriver
      : { agentDriver: createdAgentDriver }

    const time = this.now()
    const parts = parseSessionParts(sessionKey)

    const session: IMSession = {
      sessionKey,
      agentId,
      channel: parts.channel,
      chatType: parts.chatType,
      peerId: parts.peerId,
      botIdentity: parts.botIdentity,
      desktop,
      agentDriver: resolvedAgentDriver.agentDriver,
      source,
      sourceControls: resolvedAgentDriver.sourceControls,
      createdAt: time,
      lastAccessTime: time,
    }

    this.sessions.set(sessionKey, session)
    await this.persistSession(session)
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

  private async touchSession(session: IMSession): Promise<void> {
    session.lastAccessTime = this.now()
    await this.persistSession(session)
  }

  private async persistSession(session: IMSession): Promise<void> {
    if (!this.options.persistSession) {
      return
    }

    await Promise.resolve(this.options.persistSession(session))
  }

  private async deletePersistedSession(sessionKey: string): Promise<void> {
    if (!this.options.deletePersistedSession) {
      return
    }

    await Promise.resolve(this.options.deletePersistedSession(sessionKey))
  }
}
