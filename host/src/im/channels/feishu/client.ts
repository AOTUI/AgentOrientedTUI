import type { FeishuDomain } from './targets.js'
import type { FeishuConnectionMode } from './config-schema.js'

export interface FeishuClientInput {
  appId: string
  appSecret: string
  domain: FeishuDomain
  requestTimeoutMs?: number
  apiBaseUrl?: string
}

export interface FeishuClientOptions {
  appId: string
  appSecret: string
  domain: FeishuDomain
  requestTimeoutMs: number
  apiBaseUrl: string
}

export interface FeishuWsOptions {
  enabled: boolean
  connectionMode: FeishuConnectionMode
  appId: string
  appSecret: string
  domain: FeishuDomain
}

export function buildFeishuApiBase(domain: FeishuDomain, apiBaseUrl?: string): string {
  if (apiBaseUrl && apiBaseUrl.trim()) {
    return apiBaseUrl.trim()
  }

  return domain === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn'
}

export function buildFeishuClientOptions(input: FeishuClientInput): FeishuClientOptions {
  return {
    appId: input.appId,
    appSecret: input.appSecret,
    domain: input.domain,
    requestTimeoutMs: input.requestTimeoutMs ?? 15_000,
    apiBaseUrl: buildFeishuApiBase(input.domain, input.apiBaseUrl),
  }
}

export function buildFeishuWsOptions(input: {
  appId: string
  appSecret: string
  domain: FeishuDomain
  connectionMode: FeishuConnectionMode
}): FeishuWsOptions {
  return {
    enabled: input.connectionMode === 'websocket',
    connectionMode: input.connectionMode,
    appId: input.appId,
    appSecret: input.appSecret,
    domain: input.domain,
  }
}
