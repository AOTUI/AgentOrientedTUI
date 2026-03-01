/**
 * Feishu tenant_access_token manager.
 *
 * Automatically fetches and caches the tenant_access_token from the
 * Feishu Open Platform API using appId/appSecret credentials.
 * Token is refreshed automatically when near expiry.
 *
 * API: POST /open-apis/auth/v3/tenant_access_token/internal
 * Body: { app_id, app_secret }
 * Response: { code, msg, tenant_access_token, expire }
 */

import { buildFeishuApiBase } from './client.js'
import type { FeishuDomain } from './targets.js'

export interface TokenCacheEntry {
  token: string
  expiresAt: number
}

export interface TenantTokenManagerOptions {
  /** Override fetch for testing */
  fetchImpl?: typeof fetch
}

// Safety margin: refresh 60s before actual expiry
const SAFETY_MARGIN_MS = 60_000

// Module-level cache, keyed by "domain|appId"
const tokenCache = new Map<string, TokenCacheEntry>()

function cacheKey(domain: string, appId: string): string {
  return `${domain}|${appId}`
}

/**
 * Get a valid tenant_access_token, fetching/refreshing as needed.
 *
 * @returns The tenant_access_token string
 * @throws If the token cannot be obtained
 */
export async function getTenantAccessToken(
  params: {
    appId: string
    appSecret: string
    domain?: FeishuDomain
    apiBaseUrl?: string
  },
  options?: TenantTokenManagerOptions,
): Promise<string> {
  const { appId, appSecret, domain, apiBaseUrl } = params
  const key = cacheKey(domain ?? 'feishu', appId)

  // Check cache
  const cached = tokenCache.get(key)
  if (cached && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) {
    return cached.token
  }

  // Fetch new token
  const base = buildFeishuApiBase((domain ?? 'feishu') as FeishuDomain, apiBaseUrl)
  const url = `${base}/open-apis/auth/v3/tenant_access_token/internal`

  const fetchFn = options?.fetchImpl ?? fetch
  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`Feishu token API HTTP error: ${response.status} ${rawText}`)
  }

  const payload = JSON.parse(rawText) as {
    code?: number
    msg?: string
    tenant_access_token?: string
    expire?: number
  }

  if (payload.code !== 0) {
    throw new Error(`Feishu token API error: code=${payload.code ?? 'unknown'} msg=${payload.msg ?? ''}`.trim())
  }

  const token = payload.tenant_access_token
  if (!token) {
    throw new Error('Feishu token API response missing tenant_access_token')
  }

  const expireSeconds = payload.expire ?? 7200
  tokenCache.set(key, {
    token,
    expiresAt: Date.now() + expireSeconds * 1000,
  })

  console.log(`[IM] feishu: obtained tenant_access_token for appId=${appId.slice(0, 6)}... (expires in ${expireSeconds}s)`)

  return token
}

/**
 * Clear cached tokens. Useful for testing or credential rotation.
 */
export function clearTenantTokenCache(domain?: string, appId?: string): void {
  if (domain && appId) {
    tokenCache.delete(cacheKey(domain, appId))
  } else {
    tokenCache.clear()
  }
}

/**
 * Get the current cache size (for testing).
 */
export function getTenantTokenCacheSize(): number {
  return tokenCache.size
}
