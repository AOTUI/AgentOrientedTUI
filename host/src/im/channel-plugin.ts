export interface ChannelStartContext {
  config: Record<string, unknown>
  channelConfig: Record<string, unknown>
}

export interface IChannelPlugin {
  readonly id: string
  start(ctx: ChannelStartContext): Promise<void>
  stop(): Promise<void>
}
