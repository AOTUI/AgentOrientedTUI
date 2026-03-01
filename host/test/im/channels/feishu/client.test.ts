import { describe, expect, it } from 'vitest'
import {
  buildFeishuApiBase,
  buildFeishuClientOptions,
  buildFeishuWsOptions,
} from '../../../../src/im/channels/feishu/client.js'

describe('feishu client helpers', () => {
  it('builds default api base by domain', () => {
    expect(buildFeishuApiBase('feishu')).toBe('https://open.feishu.cn')
    expect(buildFeishuApiBase('lark')).toBe('https://open.larksuite.com')
  })

  it('prefers explicit api base url override', () => {
    expect(buildFeishuApiBase('feishu', 'https://proxy.internal')).toBe('https://proxy.internal')
  })

  it('builds rest client options with timeout fallback', () => {
    const options = buildFeishuClientOptions({
      appId: 'cli_x',
      appSecret: 'sec_x',
      domain: 'feishu',
    })

    expect(options.appId).toBe('cli_x')
    expect(options.appSecret).toBe('sec_x')
    expect(options.domain).toBe('feishu')
    expect(options.requestTimeoutMs).toBe(15_000)
    expect(options.apiBaseUrl).toBe('https://open.feishu.cn')
  })

  it('keeps provided timeout and api base', () => {
    const options = buildFeishuClientOptions({
      appId: 'cli_x',
      appSecret: 'sec_x',
      domain: 'lark',
      requestTimeoutMs: 9_000,
      apiBaseUrl: 'https://proxy.custom',
    })

    expect(options.requestTimeoutMs).toBe(9_000)
    expect(options.apiBaseUrl).toBe('https://proxy.custom')
  })

  it('builds ws options for websocket mode', () => {
    const ws = buildFeishuWsOptions({
      appId: 'cli_x',
      appSecret: 'sec_x',
      domain: 'feishu',
      connectionMode: 'websocket',
    })

    expect(ws.enabled).toBe(true)
    expect(ws.connectionMode).toBe('websocket')
  })

  it('disables ws options for webhook mode', () => {
    const ws = buildFeishuWsOptions({
      appId: 'cli_x',
      appSecret: 'sec_x',
      domain: 'feishu',
      connectionMode: 'webhook',
    })

    expect(ws.enabled).toBe(false)
  })
})
