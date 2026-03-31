import { describe, expect, it } from 'vitest'
import { parseFeishuConfig } from '../../../../src/im/channels/feishu/config-schema.ts'

describe('Feishu config schema', () => {
  it('parses minimal valid config', () => {
    const parsed = parseFeishuConfig({
      enabled: true,
      appId: 'cli_xxx',
      appSecret: 'sec_xxx',
    })

    expect(parsed.enabled).toBe(true)
    expect(parsed.connectionMode).toBe('websocket')
    expect(parsed.domain).toBe('feishu')
  })

  it('applies default policies', () => {
    const parsed = parseFeishuConfig({
      appId: 'cli_xxx',
      appSecret: 'sec_xxx',
    })

    expect(parsed.dmPolicy).toBe('open')
    expect(parsed.groupPolicy).toBe('open')
    expect(parsed.requireMention).toBe(true)
  })

  it('throws for missing appId', () => {
    expect(() => parseFeishuConfig({ appSecret: 'sec_xxx' })).toThrow(/appId/i)
  })

  it('throws for missing appSecret', () => {
    expect(() => parseFeishuConfig({ appId: 'cli_xxx' })).toThrow(/appSecret/i)
  })

  it('throws for unsupported connection mode', () => {
    expect(() =>
      parseFeishuConfig({
        appId: 'cli_xxx',
        appSecret: 'sec_xxx',
        connectionMode: 'socket' as any,
      }),
    ).toThrow(/connectionMode/i)
  })

  it('parses nested accounts map', () => {
    const parsed = parseFeishuConfig({
      appId: 'cli_xxx',
      appSecret: 'sec_xxx',
      accounts: {
        corpA: {
          enabled: true,
          appId: 'cli_a',
          appSecret: 'sec_a',
        },
      },
    })

    expect(parsed.accounts?.corpA?.appId).toBe('cli_a')
    expect(parsed.accounts?.corpA?.connectionMode).toBe('websocket')
  })

  it('allows account-only multi-bot config without default credentials', () => {
    const parsed = parseFeishuConfig({
      enabled: true,
      accounts: {
        corpA: {
          enabled: true,
          appId: 'cli_a',
          appSecret: 'sec_a',
        },
        corpB: {
          enabled: true,
          appId: 'cli_b',
          appSecret: 'sec_b',
          connectionMode: 'webhook',
        },
      },
    })

    expect(parsed.enabled).toBe(true)
    expect(parsed.appId).toBeUndefined()
    expect(parsed.accounts?.corpA?.appId).toBe('cli_a')
    expect(parsed.accounts?.corpB?.connectionMode).toBe('webhook')
  })
})
