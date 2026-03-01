import { describe, expect, it, vi } from 'vitest'
import { IMSessionManager } from '../../src/im/im-session-manager'

function createManager() {
  const createDesktop = vi.fn(async ({ sessionKey }: { sessionKey: string }) => ({
    id: `desktop-${sessionKey}`,
    destroy: vi.fn(),
  }))

  const createAgentDriver = vi.fn(() => ({
    stop: vi.fn(),
  }))

  const manager = new IMSessionManager({
    createDesktop,
    createAgentDriver,
    now: (() => {
      let t = 1_000
      return () => ++t
    })(),
    maxSessions: 2,
  })

  return { manager, createDesktop, createAgentDriver }
}

describe('IMSessionManager', () => {
  it('creates session on first ensure', async () => {
    const { manager } = createManager()
    const session = await manager.ensureSession('agent:a:feishu:direct:u1', 'agent-a')

    expect(session.sessionKey).toBe('agent:a:feishu:direct:u1')
    expect(session.agentId).toBe('agent-a')
    expect(session.source.name).toBe('IM')
  })

  it('reuses existing session for same key', async () => {
    const { manager, createDesktop, createAgentDriver } = createManager()

    const s1 = await manager.ensureSession('agent:a:feishu:direct:u1', 'agent-a')
    const s2 = await manager.ensureSession('agent:a:feishu:direct:u1', 'agent-a')

    expect(s1).toBe(s2)
    expect(createDesktop).toHaveBeenCalledTimes(1)
    expect(createAgentDriver).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent ensureSession calls', async () => {
    const { manager, createDesktop, createAgentDriver } = createManager()

    const [s1, s2] = await Promise.all([
      manager.ensureSession('agent:a:feishu:group:g1', 'agent-a'),
      manager.ensureSession('agent:a:feishu:group:g1', 'agent-a'),
    ])

    expect(s1).toBe(s2)
    expect(createDesktop).toHaveBeenCalledTimes(1)
    expect(createAgentDriver).toHaveBeenCalledTimes(1)
  })

  it('dispatch writes user message and notifies source', async () => {
    const { manager } = createManager()

    const session = await manager.dispatch({
      sessionKey: 'agent:a:feishu:direct:u2',
      agentId: 'agent-a',
      channel: 'feishu',
      chatType: 'direct',
      peerId: 'u2',
      body: 'hello from im',
      messageId: 'msg-1',
      senderId: 'ou_x',
      chatId: 'ou_x',
      timestamp: 1_234,
    })

    await expect(session.source.getMessages()).resolves.toEqual([
      { role: 'user', content: 'hello from im', timestamp: 1_234 },
    ])
  })

  it('updates lastAccessTime on reuse', async () => {
    const { manager } = createManager()
    const first = await manager.ensureSession('agent:a:feishu:direct:u3', 'agent-a')
    const before = first.lastAccessTime

    const reused = await manager.ensureSession('agent:a:feishu:direct:u3', 'agent-a')
    expect(reused.lastAccessTime).toBeGreaterThan(before)
  })

  it('destroys session and calls stop/destroy hooks', async () => {
    const { manager } = createManager()
    const session = await manager.ensureSession('agent:a:feishu:direct:u4', 'agent-a')

    const stopSpy = vi.spyOn(session.agentDriver, 'stop')
    const destroySpy = vi.spyOn(session.desktop, 'destroy')

    await manager.destroySession('agent:a:feishu:direct:u4')

    expect(stopSpy).toHaveBeenCalledTimes(1)
    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(manager.getSession('agent:a:feishu:direct:u4')).toBeUndefined()
  })

  it('noops when destroying unknown session', async () => {
    const { manager } = createManager()
    await expect(manager.destroySession('not-exist')).resolves.toBeUndefined()
  })

  it('evicts oldest session when maxSessions exceeded', async () => {
    const { manager } = createManager()

    await manager.ensureSession('agent:a:feishu:direct:u1', 'agent-a')
    await manager.ensureSession('agent:a:feishu:direct:u2', 'agent-a')
    await manager.ensureSession('agent:a:feishu:direct:u3', 'agent-a')

    expect(manager.getSession('agent:a:feishu:direct:u1')).toBeUndefined()
    expect(manager.getSession('agent:a:feishu:direct:u2')).toBeDefined()
    expect(manager.getSession('agent:a:feishu:direct:u3')).toBeDefined()
  })

  it('throws when sessionKey or agentId is missing in ensureSession', async () => {
    const { manager } = createManager()

    await expect(manager.ensureSession('', 'agent-a')).rejects.toThrow(/sessionKey/i)
    await expect(manager.ensureSession('agent:a:feishu:direct:u1', '')).rejects.toThrow(/agentId/i)
  })

  it('throws when inbound payload is missing required fields', async () => {
    const { manager } = createManager()

    await expect(
      manager.dispatch({
        sessionKey: '',
        agentId: 'agent-a',
        channel: 'feishu',
        chatType: 'direct',
        peerId: 'u2',
        body: 'x',
        messageId: 'msg-1',
        senderId: 'ou_x',
        chatId: 'ou_x',
        timestamp: 1_234,
      }),
    ).rejects.toThrow(/sessionKey/i)
  })
})
