import { EventEmitter } from 'events'
import type { ChannelCapabilities, ChannelMeta, ChannelRuntimeState, IChannelPlugin } from './channel-plugin.js'

export interface RegisteredChannelRuntime {
  id: string
  meta: ChannelMeta
  capabilities: ChannelCapabilities
  active: boolean
  runtime: ChannelRuntimeState
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return value as Record<string, unknown>
}

function isEnabled(config: unknown): boolean {
  if (!config || typeof config !== 'object') {
    return false
  }
  return (config as { enabled?: boolean }).enabled === true
}

export class IMGatewayManager extends EventEmitter {
  private readonly channels = new Map<string, IChannelPlugin>()
  private readonly activeChannelIds = new Set<string>()

  register(plugin: IChannelPlugin): void {
    if (!plugin?.id) {
      throw new Error('channel plugin id is required')
    }

    if (this.channels.has(plugin.id)) {
      return
    }

    this.channels.set(plugin.id, plugin)
  }

  /**
   * Look up a registered channel plugin by id.
   */
  getChannel(channelId: string): IChannelPlugin | undefined {
    return this.channels.get(channelId)
  }

  getRegisteredChannelIds(): string[] {
    return Array.from(this.channels.keys())
  }

  getActiveChannelIds(): string[] {
    return Array.from(this.activeChannelIds.values()).sort((a, b) => a.localeCompare(b))
  }

  listChannels(): RegisteredChannelRuntime[] {
    return Array.from(this.channels.values())
      .map((channel) => ({
        id: channel.id,
        meta: channel.meta,
        capabilities: channel.capabilities,
        active: this.activeChannelIds.has(channel.id),
        runtime: channel.getRuntimeState?.() ?? {
          started: this.activeChannelIds.has(channel.id),
        },
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }

  async startAll(config: Record<string, unknown>): Promise<void> {
    const im = toRecord(config.im)
    const channelsConfig = toRecord(im.channels)

    for (const [channelId, channel] of this.channels.entries()) {
      const channelConfig = toRecord(channelsConfig[channelId])

      if (!isEnabled(channelConfig)) {
        if (this.activeChannelIds.has(channelId)) {
          await this.stopChannel(channelId)
        }
        continue
      }

      if (this.activeChannelIds.has(channelId)) {
        continue
      }

      try {
        await channel.start({
          config,
          channelConfig,
        })
        this.activeChannelIds.add(channelId)
        this.emit('channel-started', { channelId })
        console.log(`[IM] channel "${channelId}" started successfully`)
      } catch (error) {
        console.error(`[IM] channel "${channelId}" failed to start:`, error)
        this.emit('channel-start-failed', { channelId, error })
      }
    }
  }

  async stopAll(): Promise<void> {
    const activeIds = Array.from(this.activeChannelIds)

    for (const channelId of activeIds) {
      await this.stopChannel(channelId)
    }
  }

  private async stopChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId)
    if (!channel) {
      this.activeChannelIds.delete(channelId)
      return
    }

    try {
      await channel.stop()
    } catch (error) {
      console.error(`[IM] channel "${channelId}" failed to stop:`, error)
      this.emit('channel-stop-failed', { channelId, error })
    } finally {
      this.activeChannelIds.delete(channelId)
      this.emit('channel-stopped', { channelId })
    }
  }
}
