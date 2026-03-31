import type { MessageWithTimestamp } from '@aotui/agent-driver-v2'
import { createMessageId } from '../types-v2.js'
import { getDb, persistDatabase } from '../db/index.js'

type IMMessageRow = {
  id: string
  session_key: string
  role: MessageWithTimestamp['role']
  content: string
  timestamp: number
}

function rowToMessage(row: IMMessageRow): MessageWithTimestamp {
  return {
    role: row.role,
    content: JSON.parse(row.content),
    timestamp: row.timestamp,
  }
}

export function listIMMessages(sessionKey: string): MessageWithTimestamp[] {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT id, session_key, role, content, timestamp
    FROM im_messages
    WHERE session_key = ?
    ORDER BY timestamp ASC, id ASC
  `)
  stmt.bind([sessionKey])

  const messages: MessageWithTimestamp[] = []
  while (stmt.step()) {
    messages.push(rowToMessage(stmt.getAsObject() as IMMessageRow))
  }
  stmt.free()

  return messages
}

export function appendIMMessage(sessionKey: string, message: MessageWithTimestamp): void {
  const db = getDb()
  db.run(
    `
      INSERT INTO im_messages (id, session_key, role, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      createMessageId(),
      sessionKey,
      message.role,
      JSON.stringify(message.content),
      message.timestamp,
    ],
  )
  persistDatabase()
}

export function replaceIMMessages(sessionKey: string, messages: MessageWithTimestamp[]): void {
  const db = getDb()
  db.run('DELETE FROM im_messages WHERE session_key = ?', [sessionKey])

  for (const message of messages) {
    db.run(
      `
        INSERT INTO im_messages (id, session_key, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        createMessageId(),
        sessionKey,
        message.role,
        JSON.stringify(message.content),
        message.timestamp,
      ],
    )
  }

  persistDatabase()
}
