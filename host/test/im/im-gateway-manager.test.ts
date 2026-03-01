import { describe, expect, it, vi } from 'vitest'
import { IMGatewayManager } from '../../src/im/im-gateway-manager.ts'

function createPlugin(id: string) {
  return {
    id,
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
  }
}

describe('IMGatewayManager', () => {
  it('registers plugins and ignores duplicate id', () => {
    const manager = new IMGatewayManager()
    const p1 = createPlugin('feishu')
    const p2 = createPlugin('feishu')

    manager.register(p1)
    manager.register(p2)

    expect(manager.getRegisteredChannelIds()).toEqual(['feishu'])
  })

  it('starts only enabled configured channels', async () => {
    const manager = new IMGatewayManager()
    const feishu = createPlugin('feishu')
    const lark = createPlugin('lark')

    manager.register(feishu)
    manager.register(lark)

    await manager.startAll({
      im: {
        channels: {
          feishu: { enabled: true },
          lark: { enabled: false },
        },
      },
    })

    expect(feishu.start).toHaveBeenCalledTimes(1)
    expect(lark.start).not.toHaveBeenCalled()
  })

  it('is idempotent when startAll is called repeatedly', async () => {
    const manager = new IMGatewayManager()
    const feishu = createPlugin('feishu')

    manager.register(feishu)

    const config = {
      im: {
        channels: {
          feishu: { enabled: true },
        },
      },
    }

    await manager.startAll(config)
    await manager.startAll(config)

    expect(feishu.start).toHaveBeenCalledTimes(1)
  })

  it('stops all active channels', async () => {
    const manager = new IMGatewayManager()
    const feishu = createPlugin('feishu')

    manager.register(feishu)
    await manager.startAll({ im: { channels: { feishu: { enabled: true } } } })

    await manager.stopAll()

    expect(feishu.stop).toHaveBeenCalledTimes(1)
    expect(manager.getActiveChannelIds()).toEqual([])
  })

  it('continues starting other channels when one fails', async () => {
    const manager = new IMGatewayManager()
    const bad = {
      id: 'bad',
      start: vi.fn(async () => {
        throw new Error('boom')
      }),
      stop: vi.fn(async () => undefined),
    }
    const good = createPlugin('good')

    manager.register(bad)
    manager.register(good)

    await manager.startAll({
      im: { channels: { bad: { enabled: true }, good: { enabled: true } } },
    })

    expect(bad.start).toHaveBeenCalledTimes(1)
    expect(good.start).toHaveBeenCalledTimes(1)
    expect(manager.getActiveChannelIds()).toEqual(['good'])
  })

  it('stops channels even when one stop fails', async () => {
    const manager = new IMGatewayManager()
    const bad = {
      id: 'bad',
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => {
        throw new Error('stop failed')
      }),
    }
    const good = createPlugin('good')

    manager.register(bad)
    manager.register(good)

    await manager.startAll({
      im: { channels: { bad: { enabled: true }, good: { enabled: true } } },
    })

    await manager.stopAll()

    expect(bad.stop).toHaveBeenCalledTimes(1)
    expect(good.stop).toHaveBeenCalledTimes(1)
    expect(manager.getActiveChannelIds()).toEqual([])
  })
})
