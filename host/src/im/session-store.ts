import { getDb, persistDatabase } from '../db/index.js'
import type { SourceControlsSnapshot } from '../core/source-controls.js'
import { normalizeSourceControlsSnapshot } from '../core/source-controls.js'
import type { ChatType, IMSession } from './types.js'

export interface IMPersistedSession {
  sessionKey: string
  agentId: string
  channel: string
  chatType: ChatType
  peerId: string
  accountId?: string
  sourceControls?: SourceControlsSnapshot
  createdAt: number
  updatedAt: number
  lastAccessTime: number
}

type SessionRow = {
  session_key: string
  agent_id: string
  channel: string
  chat_type: string
  peer_id: string
  account_id: string | null
  source_controls: string | null
  created_at: number
  updated_at: number
  last_access_time: number
}

function rowToSession(row: SessionRow): IMPersistedSession {
  return {
    sessionKey: row.session_key,
    agentId: row.agent_id,
    channel: row.channel,
    chatType: row.chat_type === 'group' ? 'group' : 'direct',
    peerId: row.peer_id,
    accountId: row.account_id ?? undefined,
    sourceControls: row.source_controls ? normalizeSourceControlsSnapshot(JSON.parse(row.source_controls)) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessTime: row.last_access_time,
  }
}

function toPersistedSession(session: IMSession): IMPersistedSession {
  return {
    sessionKey: session.sessionKey,
    agentId: session.agentId,
    channel: session.channel,
    chatType: session.chatType,
    peerId: session.peerId,
    accountId: session.accountId,
    sourceControls: session.sourceControls,
    createdAt: session.createdAt,
    updatedAt: session.lastAccessTime,
    lastAccessTime: session.lastAccessTime,
  }
}

export function upsertIMSession(session: IMSession | IMPersistedSession): IMPersistedSession {
  const record = 'desktop' in session ? toPersistedSession(session) : session
  const db = getDb()

  db.run(
    `
      INSERT INTO im_sessions (
        session_key,
        agent_id,
        channel,
        chat_type,
        peer_id,
        account_id,
        source_controls,
        created_at,
        updated_at,
        last_access_time
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET
        agent_id = excluded.agent_id,
        channel = excluded.channel,
        chat_type = excluded.chat_type,
        peer_id = excluded.peer_id,
        account_id = excluded.account_id,
        source_controls = excluded.source_controls,
        updated_at = excluded.updated_at,
        last_access_time = excluded.last_access_time
    `,
    [
      record.sessionKey,
      record.agentId,
      record.channel,
      record.chatType,
      record.peerId,
      record.accountId ?? null,
      record.sourceControls ? JSON.stringify(record.sourceControls) : null,
      record.createdAt,
      record.updatedAt,
      record.lastAccessTime,
    ],
  )

  persistDatabase()
  return record
}

export function getIMSession(sessionKey: string): IMPersistedSession | null {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT session_key, agent_id, channel, chat_type, peer_id, account_id, source_controls, created_at, updated_at, last_access_time
    FROM im_sessions
    WHERE session_key = ?
  `)
  stmt.bind([sessionKey])

  if (!stmt.step()) {
    stmt.free()
    return null
  }

  const record = rowToSession(stmt.getAsObject() as SessionRow)
  stmt.free()
  return record
}

export function listIMSessions(): IMPersistedSession[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT session_key, agent_id, channel, chat_type, peer_id, account_id, source_controls, created_at, updated_at, last_access_time
    FROM im_sessions
    ORDER BY updated_at DESC, session_key ASC
  `)

  const sessions: IMPersistedSession[] = []
  while (stmt.step()) {
    sessions.push(rowToSession(stmt.getAsObject() as SessionRow))
  }
  stmt.free()

  return sessions
}

export function deleteIMSession(sessionKey: string): void {
  const db = getDb()
  db.run('DELETE FROM im_sessions WHERE session_key = ?', [sessionKey])
  if (db.getRowsModified() > 0) {
    persistDatabase()
  }
}
