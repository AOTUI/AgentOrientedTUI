export type FeishuConnectionMode = 'websocket' | 'webhook'
export type FeishuDmPolicy = 'open' | 'allowlist' | 'pairing'
export type FeishuGroupPolicy = 'open' | 'allowlist' | 'disabled'

export interface FeishuAccountConfigInput {
  enabled?: boolean
  appId?: string
  appSecret?: string
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
  allowFrom?: Array<string | number>
  groupAllowFrom?: Array<string | number>
  botToken?: string
  apiBaseUrl?: string
}

export interface FeishuChannelConfig extends FeishuAccountConfig {
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

function normalizeAccount(input: FeishuAccountConfigInput, defaults?: FeishuAccountConfig): FeishuAccountConfig {
  const appId = input.appId ?? defaults?.appId
  const appSecret = input.appSecret ?? defaults?.appSecret

  return {
    enabled: input.enabled ?? defaults?.enabled ?? true,
    appId: requireNonEmpty(appId, 'appId'),
    appSecret: requireNonEmpty(appSecret, 'appSecret'),
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
  const root = normalizeAccount(input)

  if (!input.accounts) {
    return root
  }

  const accounts: Record<string, FeishuAccountConfig> = {}
  for (const [accountId, accountConfig] of Object.entries(input.accounts)) {
    accounts[accountId] = normalizeAccount(accountConfig ?? {}, root)
  }

  return {
    ...root,
    accounts,
  }
}
