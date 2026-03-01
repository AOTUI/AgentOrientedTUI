/**
 * Feishu Streaming Card — Card Kit streaming API for real-time text output.
 *
 * Ported from OpenClaw reference implementation per RFC-IM-INTEGRATION.md:
 *   "streaming-card.ts → 直接复制 — 纯飞书 API 调用，无框架依赖，仅需将 fetchWithSsrFGuard 替换为 fetch"
 *
 * Card Kit streaming protocol:
 *   1. POST /cardkit/v1/cards              → create card entity (streaming_mode: true)
 *   2. POST /im/v1/messages                → send card as interactive message
 *   3. PUT  /cardkit/v1/cards/:id/elements → stream content updates (throttled ≥100ms)
 *   4. PATCH /cardkit/v1/cards/:id/settings → close streaming mode
 */

import { buildFeishuApiBase } from './client.js'
import { getTenantAccessToken, type TenantTokenManagerOptions } from './token-manager.js'
import type { FeishuDomain } from './targets.js'

// ─── Types ──────────────────────────────────────────────────────────

export interface StreamingCardCredentials {
  appId: string
  appSecret: string
  domain?: FeishuDomain
  apiBaseUrl?: string
}

export interface StreamingCardHeader {
  title: string
  /** Color template: blue, green, red, orange, purple, indigo, wathet, turquoise, yellow, grey, carmine, violet, lime */
  template?: string
}

export interface StreamingCardStartOptions {
  replyToMessageId?: string
  replyInThread?: boolean
  rootId?: string
  header?: StreamingCardHeader
}

type CardState = {
  cardId: string
  messageId: string
  sequence: number
  currentText: string
}

export interface StreamingCardDeps {
  /** Override fetch for testing */
  fetchImpl?: typeof fetch
  /** Override token fetcher for testing */
  fetchToken?: (creds: StreamingCardCredentials) => Promise<string>
  /** Log function */
  log?: (msg: string) => void
}

// ─── Helpers ────────────────────────────────────────────────────────

function truncateSummary(text: string, max = 50): string {
  if (!text) return ''
  const clean = text.replace(/\n/g, ' ').trim()
  return clean.length <= max ? clean : clean.slice(0, max - 3) + '...'
}

// ─── FeishuStreamingSession ─────────────────────────────────────────

/**
 * Manages the lifecycle of a single streaming card:
 *   start() → update() × N → close()
 *
 * Implements the FeishuStreamingSessionLike interface expected by
 * reply-dispatcher.ts.
 */
export class FeishuStreamingSession {
  private readonly creds: StreamingCardCredentials
  private readonly apiBase: string
  private readonly fetchFn: typeof fetch
  private readonly fetchToken: (creds: StreamingCardCredentials) => Promise<string>
  private readonly log?: (msg: string) => void

  private state: CardState | null = null
  private startPromise: Promise<void> | null = null
  private queue: Promise<void> = Promise.resolve()
  private closed = false
  private lastUpdateTime = 0
  private pendingText: string | null = null
  private readonly updateThrottleMs = 100 // max 10 updates/sec

  constructor(creds: StreamingCardCredentials, deps?: StreamingCardDeps) {
    this.creds = creds
    this.apiBase = buildFeishuApiBase(
      (creds.domain ?? 'feishu') as FeishuDomain,
      creds.apiBaseUrl,
    )
    this.fetchFn = deps?.fetchImpl ?? fetch
    this.fetchToken = deps?.fetchToken ?? defaultFetchToken
    this.log = deps?.log
  }

  // ── start: create card + send interactive message ─────────────────

  async start(
    receiveId: string,
    receiveIdType: 'open_id' | 'user_id' | 'union_id' | 'email' | 'chat_id' = 'chat_id',
    options?: StreamingCardStartOptions,
  ): Promise<void> {
    if (this.state) return
    if (this.startPromise) {
      await this.startPromise
      return
    }

    this.startPromise = (async () => {
      const token = await this.fetchToken(this.creds)

      // 1. Build card JSON with streaming mode
      const cardJson: Record<string, unknown> = {
        schema: '2.0',
        config: {
          streaming_mode: true,
          summary: { content: '[Generating...]' },
          streaming_config: {
            print_frequency_ms: { default: 50 },
            print_step: { default: 2 },
          },
        },
        body: {
          elements: [
            { tag: 'markdown', content: '⏳ Thinking...', element_id: 'content' },
          ],
        },
      }
      if (options?.header) {
        cardJson.header = {
          title: { tag: 'plain_text', content: options.header.title },
          template: options.header.template ?? 'blue',
        }
      }

      // 2. Create card entity via Card Kit API
      const createRes = await this.fetchFn(
        `${this.apiBase}/open-apis/cardkit/v1/cards`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'card_json',
            data: JSON.stringify(cardJson),
          }),
        },
      )
      const createData = (await createRes.json()) as {
        code: number
        msg: string
        data?: { card_id: string }
      }
      if (createData.code !== 0 || !createData.data?.card_id) {
        throw new Error(`Create card failed: ${createData.msg}`)
      }
      const cardId = createData.data.card_id
      const cardContent = JSON.stringify({ type: 'card', data: { card_id: cardId } })

      // 3. Send card as interactive message
      let sendUrl: string
      let sendBody: Record<string, unknown>

      if (options?.replyToMessageId) {
        // Reply to a specific message
        sendUrl = `${this.apiBase}/open-apis/im/v1/messages/${options.replyToMessageId}/reply`
        sendBody = {
          msg_type: 'interactive',
          content: cardContent,
          ...(options.replyInThread ? { reply_in_thread: true } : {}),
        }
      } else {
        // Create new message (supports rootId for topic-group routing)
        sendUrl = `${this.apiBase}/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`
        sendBody = {
          receive_id: receiveId,
          msg_type: 'interactive',
          content: cardContent,
          ...(options?.rootId ? { root_id: options.rootId } : {}),
        }
      }

      const sendRes = await this.fetchFn(sendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendBody),
      })
      const sendData = (await sendRes.json()) as {
        code: number
        msg: string
        data?: { message_id: string }
      }
      if (sendData.code !== 0 || !sendData.data?.message_id) {
        throw new Error(`Send card message failed: ${sendData.msg}`)
      }

      this.state = {
        cardId,
        messageId: sendData.data.message_id,
        sequence: 1,
        currentText: '',
      }
      this.log?.(`Started streaming: cardId=${cardId}, messageId=${sendData.data.message_id}`)
    })()

    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  // ── update: stream content (throttled) ────────────────────────────

  async update(text: string): Promise<void> {
    if (!this.state || this.closed) return

    // Throttle: buffer if updated too recently
    const now = Date.now()
    if (now - this.lastUpdateTime < this.updateThrottleMs) {
      this.pendingText = text
      return
    }
    this.pendingText = null
    this.lastUpdateTime = now

    this.queue = this.queue.then(async () => {
      if (!this.state || this.closed) return
      this.state.currentText = text
      await this.updateCardContent(text)
    })
    await this.queue
  }

  // ── close: finalize & disable streaming mode ──────────────────────

  async close(finalText?: string): Promise<void> {
    if (!this.state || this.closed) return
    this.closed = true
    await this.queue

    // Use finalText, pending throttled text, or current text
    const text = finalText ?? this.pendingText ?? this.state.currentText

    // Final content update if needed
    if (text && text !== this.state.currentText) {
      await this.updateCardContent(text)
      this.state.currentText = text
    }

    // Close streaming mode
    this.state.sequence += 1
    const token = await this.fetchToken(this.creds)

    try {
      await this.fetchFn(
        `${this.apiBase}/open-apis/cardkit/v1/cards/${this.state.cardId}/settings`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            settings: JSON.stringify({
              config: {
                streaming_mode: false,
                summary: { content: truncateSummary(text) },
              },
            }),
            sequence: this.state.sequence,
            uuid: `c_${this.state.cardId}_${this.state.sequence}`,
          }),
        },
      )
    } catch (e) {
      this.log?.(`Close failed: ${String(e)}`)
    }

    this.log?.(`Closed streaming: cardId=${this.state.cardId}`)
  }

  // ── isActive ──────────────────────────────────────────────────────

  isActive(): boolean {
    return this.state !== null && !this.closed
  }

  // ── getCardId (useful for diagnostics / testing) ──────────────────

  getCardId(): string | null {
    return this.state?.cardId ?? null
  }

  // ── private: PUT card element content ─────────────────────────────

  private async updateCardContent(text: string): Promise<void> {
    if (!this.state) return

    this.state.sequence += 1
    const token = await this.fetchToken(this.creds)

    try {
      await this.fetchFn(
        `${this.apiBase}/open-apis/cardkit/v1/cards/${this.state.cardId}/elements/content/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: text,
            sequence: this.state.sequence,
            uuid: `s_${this.state.cardId}_${this.state.sequence}`,
          }),
        },
      )
    } catch (e) {
      this.log?.(`Update failed: ${String(e)}`)
    }
  }
}

// ─── Default token fetcher using token-manager.ts ────────────────────

async function defaultFetchToken(creds: StreamingCardCredentials): Promise<string> {
  return getTenantAccessToken({
    appId: creds.appId,
    appSecret: creds.appSecret,
    domain: creds.domain,
    apiBaseUrl: creds.apiBaseUrl,
  })
}
