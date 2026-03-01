/**
 * Real Feishu WebSocket client adapter.
 *
 * Bridges the `@larksuiteoapi/node-sdk` WSClient + EventDispatcher to the
 * internal `FeishuWsClient` interface consumed by `gateway.ts`.
 */
import * as Lark from '@larksuiteoapi/node-sdk'
import type { FeishuWsClient, FeishuGatewayEvent } from './gateway.js'

// ---------- SDK event shape ----------
// The Feishu Open Platform pushes `im.message.receive_v1` with this structure.
export interface LarkMessageEventData {
  sender: {
    sender_id: {
      open_id?: string
      user_id?: string
      union_id?: string
    }
    sender_type?: string
    tenant_key?: string
  }
  message: {
    message_id: string
    root_id?: string
    parent_id?: string
    chat_id: string
    chat_type: 'p2p' | 'group'
    message_type: string
    content: string
    mentions?: Array<{
      key: string
      id: { open_id?: string; user_id?: string; union_id?: string }
      name: string
      tenant_key?: string
    }>
  }
}

// ---------- Domain mapping ----------
function resolveLarkDomain(domain?: string): Lark.Domain | string {
  if (domain === 'lark') return Lark.Domain.Lark
  if (domain === 'feishu' || !domain) return Lark.Domain.Feishu
  // Custom URL for private deployment
  return domain.replace(/\/+$/, '')
}

// ---------- Text extraction ----------
function extractText(content: string, messageType: string): string {
  try {
    const parsed = JSON.parse(content)
    if (messageType === 'text') {
      return typeof parsed.text === 'string' ? parsed.text : ''
    }
    // For other message types, return raw content as-is
    return typeof parsed.text === 'string' ? parsed.text : content
  } catch {
    return content
  }
}

// ---------- Public factory ----------
export interface CreateRealFeishuWsClientOptions {
  appId: string
  appSecret: string
  domain?: string
  accountId?: string
}

/**
 * Creates a `FeishuWsClient` backed by the real Feishu Open Platform SDK.
 *
 * Usage:
 * ```ts
 * const client = createRealFeishuWsClient({ appId, appSecret, domain: 'feishu' })
 * client.onMessage(async (event) => { ... })
 * await client.start()
 * ```
 */
export function createRealFeishuWsClient(options: CreateRealFeishuWsClientOptions): FeishuWsClient {
  const { appId, appSecret, domain, accountId } = options
  const label = accountId ? `feishu[${accountId}]` : 'feishu'

  let messageHandler: ((event: FeishuGatewayEvent) => Promise<void>) | null = null
  let wsClient: Lark.WSClient | null = null
  let stopped = false

  return {
    onMessage(handler: (event: FeishuGatewayEvent) => Promise<void>): void {
      messageHandler = handler
    },

    async start(): Promise<void> {
      if (wsClient) return

      console.log(`[IM] ${label}: creating WebSocket connection (appId=${appId.slice(0, 6)}...)`)

      const eventDispatcher = new Lark.EventDispatcher({})

      eventDispatcher.register({
        'im.message.receive_v1': async (data: unknown) => {
          if (stopped) return

          try {
            const event = data as LarkMessageEventData
            const senderId =
              event.sender?.sender_id?.open_id ??
              event.sender?.sender_id?.user_id ??
              event.sender?.sender_id?.union_id ??
              'unknown'

            const msg = event.message
            if (!msg) {
              console.warn(`[IM] ${label}: received event without message payload, skipping`)
              return
            }

            const text = extractText(msg.content, msg.message_type)

            const gatewayEvent: FeishuGatewayEvent = {
              accountId,
              messageId: msg.message_id,
              chatId: msg.chat_id,
              chatType: msg.chat_type === 'p2p' ? 'direct' : 'group',
              senderId,
              text,
              timestamp: Date.now(),
            }

            console.log(
              `[IM] ${label}: received message ${msg.message_id} from ${senderId} in ${msg.chat_type} chat ${msg.chat_id}`,
            )

            if (messageHandler) {
              await messageHandler(gatewayEvent)
            }
          } catch (err) {
            console.error(`[IM] ${label}: error processing message event:`, err)
          }
        },
      })

      wsClient = new Lark.WSClient({
        appId,
        appSecret,
        domain: resolveLarkDomain(domain),
        loggerLevel: Lark.LoggerLevel.info,
      })

      console.log(`[IM] ${label}: starting WebSocket client...`)
      wsClient.start({ eventDispatcher })
      console.log(`[IM] ${label}: WebSocket client started`)
    },

    async stop(): Promise<void> {
      stopped = true
      if (wsClient) {
        console.log(`[IM] ${label}: stopping WebSocket client`)
        // The SDK WSClient doesn't expose a public close() in all versions,
        // but we mark ourselves stopped so no more events are processed.
        try {
          ;(wsClient as any).close?.()
        } catch {
          // Some SDK versions may not have close()
        }
        wsClient = null
      }
    },
  }
}
