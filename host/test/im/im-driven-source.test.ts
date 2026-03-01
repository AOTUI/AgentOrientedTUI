import { describe, expect, it, vi } from 'vitest'
import type { ModelMessage } from 'ai'
import { IMDrivenSource } from '../../src/im/im-driven-source'

describe('IMDrivenSource', () => {
  it('exposes stable source name', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })
    expect(source.name).toBe('IM')
    expect(await source.getTools()).toEqual({})
  })

  it('returns empty messages by default', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })
    expect(await source.getMessages()).toEqual([])
  })

  it('loads history once from loader', async () => {
    const loadHistory = vi.fn().mockResolvedValue([
      { role: 'user', content: 'old', timestamp: 1_000 },
    ])

    const source = new IMDrivenSource({ sessionKey: 's1', loadHistory })
    const first = await source.getMessages()
    const second = await source.getMessages()

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(loadHistory).toHaveBeenCalledTimes(1)
  })

  it('adds message with generated timestamp', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1', now: () => 2_000 })

    const input: ModelMessage = { role: 'user', content: 'hello' }
    source.addMessage(input)

    expect(await source.getMessages()).toEqual([
      { role: 'user', content: 'hello', timestamp: 2_000 },
    ])
  })

  it('adds message with explicit timestamp override', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1', now: () => 2_000 })

    source.addMessage({ role: 'assistant', content: 'ok' }, 1_234)

    expect(await source.getMessages()).toEqual([
      { role: 'assistant', content: 'ok', timestamp: 1_234 },
    ])
  })

  it('executeTool returns undefined for unknown tools', async () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })
    await expect(source.executeTool('unknown', {}, 'tc1')).resolves.toBeUndefined()
  })

  it('notifyUpdate triggers subscriptions and unsubscribe works', () => {
    const source = new IMDrivenSource({ sessionKey: 's1' })
    const callback = vi.fn()

    const unsubscribe = source.onUpdate(callback)

    source.notifyUpdate()
    expect(callback).toHaveBeenCalledTimes(1)

    unsubscribe()
    source.notifyUpdate()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('persists appended messages through callback', () => {
    const persistMessage = vi.fn()
    const source = new IMDrivenSource({ sessionKey: 's1', now: () => 9_999, persistMessage })

    source.addMessage({ role: 'user', content: 'persist-me' })

    expect(persistMessage).toHaveBeenCalledWith('s1', {
      role: 'user',
      content: 'persist-me',
      timestamp: 9_999,
    })
  })
})
