import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getTenantAccessToken,
  clearTenantTokenCache,
  getTenantTokenCacheSize,
} from '../../../../src/im/channels/feishu/token-manager.js'

beforeEach(() => {
  clearTenantTokenCache()
})

describe('getTenantAccessToken', () => {
  it('fetches token from Feishu API', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          code: 0,
          msg: 'ok',
          tenant_access_token: 't-abc123',
          expire: 7200,
        }),
    })) as any

    const token = await getTenantAccessToken(
      { appId: 'cli_test', appSecret: 'secret_test', domain: 'feishu' },
      { fetchImpl },
    )

    expect(token).toBe('t-abc123')
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const [url, opts] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal')
    expect(opts.method).toBe('POST')

    const body = JSON.parse(opts.body)
    expect(body.app_id).toBe('cli_test')
    expect(body.app_secret).toBe('secret_test')
  })

  it('uses Lark domain when configured', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          code: 0,
          tenant_access_token: 't-lark',
          expire: 7200,
        }),
    })) as any

    await getTenantAccessToken(
      { appId: 'cli_lark', appSecret: 's', domain: 'lark' },
      { fetchImpl },
    )

    const [url] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal')
  })

  it('caches token and reuses on second call', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          code: 0,
          tenant_access_token: 't-cached',
          expire: 7200,
        }),
    })) as any

    const params = { appId: 'cli_cache', appSecret: 's' }

    const t1 = await getTenantAccessToken(params, { fetchImpl })
    const t2 = await getTenantAccessToken(params, { fetchImpl })

    expect(t1).toBe('t-cached')
    expect(t2).toBe('t-cached')
    expect(fetchImpl).toHaveBeenCalledTimes(1) // Only one API call
    expect(getTenantTokenCacheSize()).toBe(1)
  })

  it('throws on HTTP error', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })) as any

    await expect(
      getTenantAccessToken({ appId: 'cli_err', appSecret: 's' }, { fetchImpl }),
    ).rejects.toThrow('HTTP error')
  })

  it('throws on API error code', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          code: 10003,
          msg: 'invalid app_secret',
        }),
    })) as any

    await expect(
      getTenantAccessToken({ appId: 'cli_bad', appSecret: 'wrong' }, { fetchImpl }),
    ).rejects.toThrow('10003')
  })

  it('throws when response is missing token', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          code: 0,
          msg: 'ok',
          // no tenant_access_token
        }),
    })) as any

    await expect(
      getTenantAccessToken({ appId: 'cli_no_token', appSecret: 's' }, { fetchImpl }),
    ).rejects.toThrow('missing tenant_access_token')
  })

  it('clearTenantTokenCache clears all cached tokens', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({ code: 0, tenant_access_token: 't-x', expire: 7200 }),
    })) as any

    await getTenantAccessToken({ appId: 'a1', appSecret: 's' }, { fetchImpl })
    await getTenantAccessToken({ appId: 'a2', appSecret: 's' }, { fetchImpl })

    expect(getTenantTokenCacheSize()).toBe(2)

    clearTenantTokenCache()
    expect(getTenantTokenCacheSize()).toBe(0)
  })
})
