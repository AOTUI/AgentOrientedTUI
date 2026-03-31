import { describe, expect, it } from 'vitest'
import { listResolvedFeishuAccounts, resolveFeishuAccount } from '../../../../src/im/channels/feishu/accounts.ts'

describe('Feishu account resolver', () => {
  const base = {
    appId: 'cli_root',
    appSecret: 'sec_root',
    connectionMode: 'websocket' as const,
    dmPolicy: 'open' as const,
  }

  it('resolves root account when accountId is default', () => {
    const account = resolveFeishuAccount(base, 'default')
    expect(account.appId).toBe('cli_root')
    expect(account.accountId).toBe('default')
  })

  it('merges account override on top of root config', () => {
    const account = resolveFeishuAccount(
      {
        ...base,
        accounts: {
          corpA: {
            appId: 'cli_a',
            appSecret: 'sec_a',
            dmPolicy: 'allowlist',
            allowFrom: ['ou_1'],
          },
        },
      },
      'corpA',
    )

    expect(account.appId).toBe('cli_a')
    expect(account.appSecret).toBe('sec_a')
    expect(account.dmPolicy).toBe('allowlist')
    expect(account.allowFrom).toEqual(['ou_1'])
  })

  it('falls back to root values for omitted account fields', () => {
    const account = resolveFeishuAccount(
      {
        ...base,
        groupPolicy: 'allowlist',
        groupAllowFrom: ['oc_1'],
        accounts: {
          corpA: {
            appId: 'cli_a',
            appSecret: 'sec_a',
          },
        },
      },
      'corpA',
    )

    expect(account.groupPolicy).toBe('allowlist')
    expect(account.groupAllowFrom).toEqual(['oc_1'])
  })

  it('throws when account id does not exist', () => {
    expect(() => resolveFeishuAccount(base, 'missing')).toThrow(/account/i)
  })

  it('throws when merged account misses app credentials', () => {
    expect(() =>
      resolveFeishuAccount(
        {
          ...base,
          appId: undefined,
          accounts: {
            corpA: { appSecret: 'sec_a' },
          },
        } as any,
        'corpA',
      ),
    ).toThrow(/appId/i)
  })

  it('lists all enabled resolved accounts including default root', () => {
    const accounts = listResolvedFeishuAccounts({
      ...base,
      accounts: {
        corpA: {
          enabled: true,
          appId: 'cli_a',
          appSecret: 'sec_a',
        },
        corpB: {
          enabled: false,
          appId: 'cli_b',
          appSecret: 'sec_b',
        },
      },
    })

    expect(accounts.map((account) => account.accountId)).toEqual(['default', 'corpA'])
    expect(accounts.map((account) => account.appId)).toEqual(['cli_root', 'cli_a'])
  })

  it('lists nested accounts even when default account is omitted', () => {
    const accounts = listResolvedFeishuAccounts({
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
        },
      },
    })

    expect(accounts.map((account) => account.accountId)).toEqual(['corpA', 'corpB'])
  })

  it('throws when resolving default account without credentials', () => {
    expect(() =>
      resolveFeishuAccount(
        {
          accounts: {
            corpA: {
              enabled: true,
              appId: 'cli_a',
              appSecret: 'sec_a',
            },
          },
        },
        'default',
      ),
    ).toThrow(/default account is not configured/i)
  })
})
