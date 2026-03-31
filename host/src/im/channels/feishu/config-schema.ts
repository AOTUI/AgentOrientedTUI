export type FeishuConnectionMode = 'websocket' | 'webhook'
export type FeishuDmPolicy = 'open' | 'allowlist' | 'pairing'
export type FeishuGroupPolicy = 'open' | 'allowlist' | 'disabled'
export type FeishuSessionScope = 'peer' | 'peer_sender' | 'peer_thread' | 'peer_thread_sender'

export interface FeishuAccountConfigInput {
  enabled?: boolean
  sessionScope?: FeishuSessionScope
  appId?: string
  appSecret?: string
  verificationToken?: string
  domain?: string
  connectionMode?: FeishuConnectionMode
  dmPolicy?: FeishuDmPolicy
  allowFrom?: Array<string | number>
  groupPolicy?: FeishuGroupPolicy
  groupAllowFrom?: Array<string | number>
  requireMention?: boolean
  botToken?: string
  apiBaseUrl?: string
}

export interface FeishuChannelConfigInput extends FeishuAccountConfigInput {
  accounts?: Record<string, FeishuAccountConfigInput>
}

export interface FeishuAccountConfig extends Required<Pick<FeishuAccountConfigInput, 'enabled' | 'appId' | 'appSecret' | 'domain' | 'connectionMode' | 'dmPolicy' | 'groupPolicy' | 'requireMention'>> {
  sessionScope: FeishuSessionScope
  verificationToken?: string
  allowFrom?: Array<string | number>
  groupAllowFrom?: Array<string | number>
  botToken?: string
  apiBaseUrl?: string
}

export interface FeishuChannelConfig extends Omit<FeishuAccountConfig, 'appId' | 'appSecret'> {
  appId?: string
  appSecret?: string
  accounts?: Record<string, FeishuAccountConfig>
}

function requireNonEmpty(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`)
  }
  return value.trim()
}

function normalizeMode(mode: unknown): FeishuConnectionMode {
  if (mode === undefined) {
    return 'websocket'
  }
  if (mode === 'websocket' || mode === 'webhook') {
    return mode
  }
  throw new Error('connectionMode must be websocket or webhook')
}

function normalizeDmPolicy(value: unknown): FeishuDmPolicy {
  if (value === undefined) {
    return 'open'
  }
  if (value === 'open' || value === 'allowlist' || value === 'pairing') {
    return value
  }
  throw new Error('dmPolicy is invalid')
}

function normalizeGroupPolicy(value: unknown): FeishuGroupPolicy {
  if (value === undefined) {
    return 'open'
  }
  if (value === 'open' || value === 'allowlist' || value === 'disabled') {
    return value
  }
  throw new Error('groupPolicy is invalid')
}

function normalizeSessionScope(value: unknown): FeishuSessionScope {
  if (value === undefined) {
    return 'peer'
  }
  if (
    value === 'peer'
    || value === 'peer_sender'
    || value === 'peer_thread'
    || value === 'peer_thread_sender'
  ) {
    return value
  }
  throw new Error('sessionScope is invalid')
}

function hasCredentials(input: { appId?: unknown; appSecret?: unknown }): boolean {
  return typeof input.appId === 'string'
    && input.appId.trim().length > 0
    && typeof input.appSecret === 'string'
    && input.appSecret.trim().length > 0
}

function normalizeAccount(
  input: FeishuAccountConfigInput,
  defaults?: FeishuAccountConfig | FeishuChannelConfig,
  options: { requireCredentials?: boolean } = {},
): FeishuAccountConfig | FeishuChannelConfig {
  const appId = input.appId ?? defaults?.appId
  const appSecret = input.appSecret ?? defaults?.appSecret
  const requireCredentials = options.requireCredentials !== false

  return {
    enabled: input.enabled ?? defaults?.enabled ?? true,
    sessionScope: normalizeSessionScope(input.sessionScope ?? defaults?.sessionScope),
    appId: requireCredentials ? requireNonEmpty(appId, 'appId') : typeof appId === 'string' ? appId.trim() || undefined : undefined,
    appSecret: requireCredentials ? requireNonEmpty(appSecret, 'appSecret') : typeof appSecret === 'string' ? appSecret.trim() || undefined : undefined,
    verificationToken: input.verificationToken ?? defaults?.verificationToken,
    domain: input.domain ?? defaults?.domain ?? 'feishu',
    connectionMode: normalizeMode(input.connectionMode ?? defaults?.connectionMode),
    dmPolicy: normalizeDmPolicy(input.dmPolicy ?? defaults?.dmPolicy),
    allowFrom: input.allowFrom ?? defaults?.allowFrom,
    groupPolicy: normalizeGroupPolicy(input.groupPolicy ?? defaults?.groupPolicy),
    groupAllowFrom: input.groupAllowFrom ?? defaults?.groupAllowFrom,
    requireMention: input.requireMention ?? defaults?.requireMention ?? true,
    botToken: input.botToken ?? defaults?.botToken,
    apiBaseUrl: input.apiBaseUrl ?? defaults?.apiBaseUrl,
  }
}

export function parseFeishuConfig(input: FeishuChannelConfigInput): FeishuChannelConfig {
  const hasNestedAccounts = Object.keys(input.accounts ?? {}).length > 0
  const rootHasCredentials = hasCredentials(input)

  if (!hasNestedAccounts && !rootHasCredentials) {
    if (typeof input.appId !== 'string' || input.appId.trim().length === 0) {
      throw new Error('appId is required')
    }
    throw new Error('appSecret is required')
  }

  const root = normalizeAccount(
    input,
    undefined,
    { requireCredentials: rootHasCredentials },
  ) as FeishuChannelConfig

  if (!input.accounts) {
    return root
  }

  const accounts: Record<string, FeishuAccountConfig> = {}
  for (const [accountId, accountConfig] of Object.entries(input.accounts)) {
    accounts[accountId] = normalizeAccount(accountConfig ?? {}, root, { requireCredentials: true }) as FeishuAccountConfig
  }

  return {
    ...root,
    accounts,
  }
}
