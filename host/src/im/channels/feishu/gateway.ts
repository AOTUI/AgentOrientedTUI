export interface FeishuGatewayEvent {
  accountId?: string
  messageId: string
  chatId: string
  chatType: 'direct' | 'group'
  senderId: string
  senderName?: string
  mentions?: Array<{
    key?: string
    openId?: string
    userId?: string
    unionId?: string
    name?: string
  }>
  rootId?: string
  text: string
  timestamp: number
}

export interface FeishuWsClient {
  start: () => Promise<void>
  stop: () => Promise<void>
  onMessage: (handler: (event: FeishuGatewayEvent) => Promise<void>) => void
}

export interface FeishuGatewayDeps {
  connectionMode: 'websocket' | 'webhook'
  createWsClient?: () => FeishuWsClient
  onEvent: (event: FeishuGatewayEvent) => Promise<void>
}

export function createFeishuGateway(deps: FeishuGatewayDeps) {
  let started = false
  let wsClient: FeishuWsClient | null = null

  return {
    async start(): Promise<void> {
      if (started) {
        return
      }

      started = true

      if (deps.connectionMode !== 'websocket') {
        return
      }

      const createClient = deps.createWsClient
      if (!createClient) {
        throw new Error('createWsClient is required in websocket mode')
      }

      wsClient = createClient()
      wsClient.onMessage(async (event: FeishuGatewayEvent) => {
        await deps.onEvent(event)
      })

      await wsClient.start()
    },

    async stop(): Promise<void> {
      if (!started) {
        return
      }

      started = false

      if (wsClient) {
        await wsClient.stop()
        wsClient = null
      }
    },

    async processWebhook(event: FeishuGatewayEvent): Promise<{ accepted: boolean; reason?: string }> {
      if (deps.connectionMode === 'websocket') {
        return {
          accepted: false,
          reason: 'webhook processing is disabled in websocket mode',
        }
      }

      await deps.onEvent(event)
      return { accepted: true }
    },
  }
}
