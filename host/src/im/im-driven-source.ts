import { EventEmitter } from 'events'
import type { MessageWithTimestamp, ToolResult } from '@aotui/agent-driver-v2'
import type { ModelMessage } from 'ai'

export interface IMDrivenSourceOptions {
  sessionKey: string
  now?: () => number
  loadHistory?: (sessionKey: string) => Promise<MessageWithTimestamp[]>
  persistMessage?: (sessionKey: string, message: MessageWithTimestamp) => void | Promise<void>
}

export class IMDrivenSource {
  readonly name = 'IM'

  private readonly sessionKey: string
  private readonly now: () => number
  private readonly loadHistory?: (sessionKey: string) => Promise<MessageWithTimestamp[]>
  private readonly persistMessage?: (sessionKey: string, message: MessageWithTimestamp) => void | Promise<void>
  private readonly eventEmitter = new EventEmitter()

  private historyLoaded = false
  private messages: MessageWithTimestamp[] = []

  constructor(options: IMDrivenSourceOptions) {
    this.sessionKey = options.sessionKey
    this.now = options.now ?? (() => Date.now())
    this.loadHistory = options.loadHistory
    this.persistMessage = options.persistMessage
  }

  async getMessages(): Promise<MessageWithTimestamp[]> {
    if (!this.historyLoaded) {
      this.historyLoaded = true
      if (this.loadHistory) {
        const history = await this.loadHistory(this.sessionKey)
        if (Array.isArray(history) && history.length > 0) {
          this.messages.push(...history)
          this.messages.sort((a, b) => a.timestamp - b.timestamp)
        }
      }
    }

    return [...this.messages]
  }

  async getTools(): Promise<Record<string, any>> {
    return {}
  }

  async executeTool(_toolName: string, _args: unknown, _toolCallId: string): Promise<ToolResult | undefined> {
    return undefined
  }

  onUpdate(callback: () => void): () => void {
    this.eventEmitter.on('update', callback)
    return () => {
      this.eventEmitter.off('update', callback)
    }
  }

  addMessage(message: ModelMessage, timestamp?: number): MessageWithTimestamp {
    const record: MessageWithTimestamp = {
      role: message.role,
      content: message.content,
      timestamp: typeof timestamp === 'number' ? timestamp : this.now(),
    }

    this.messages.push(record)

    if (this.persistMessage) {
      void Promise.resolve(this.persistMessage(this.sessionKey, record))
    }

    return record
  }

  notifyUpdate(): void {
    this.eventEmitter.emit('update')
  }
}
