export interface MessageDeduplicatorOptions {
  maxSize?: number
  ttlMs?: number
}

export class MessageDeduplicator {
  private readonly maxSize: number
  private readonly ttlMs: number
  private readonly seenAt = new Map<string, number>()

  constructor(options: MessageDeduplicatorOptions = {}) {
    this.maxSize = options.maxSize ?? 1000
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000

    if (this.maxSize <= 0) {
      throw new Error('maxSize must be > 0')
    }

    if (this.ttlMs <= 0) {
      throw new Error('ttlMs must be > 0')
    }
  }

  isDuplicate(messageId: string, now = Date.now()): boolean {
    const normalizedMessageId = messageId.trim()
    if (!normalizedMessageId) {
      throw new Error('messageId is required')
    }

    this.purgeExpired(now)

    const existing = this.seenAt.get(normalizedMessageId)
    if (typeof existing === 'number') {
      if (now - existing <= this.ttlMs) {
        return true
      }
      this.seenAt.delete(normalizedMessageId)
    }

    this.seenAt.set(normalizedMessageId, now)
    this.evictOverflow()
    return false
  }

  private purgeExpired(now: number): void {
    for (const [messageId, timestamp] of this.seenAt.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.seenAt.delete(messageId)
      }
    }
  }

  private evictOverflow(): void {
    while (this.seenAt.size > this.maxSize) {
      const oldestKey = this.seenAt.keys().next().value
      if (!oldestKey) {
        return
      }
      this.seenAt.delete(oldestKey)
    }
  }
}
