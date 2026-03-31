import { parseFeishuConfig, type FeishuAccountConfig, type FeishuChannelConfigInput } from './config-schema.js'

export interface ResolvedFeishuAccount extends FeishuAccountConfig {
  accountId: string
}

export function resolveFeishuAccount(config: FeishuChannelConfigInput, accountId = 'default'): ResolvedFeishuAccount {
  const parsed = parseFeishuConfig(config)

  if (accountId === 'default') {
    if (!parsed.appId || !parsed.appSecret) {
      throw new Error('default account is not configured')
    }
    return {
      accountId,
      ...parsed,
      appId: parsed.appId,
      appSecret: parsed.appSecret,
    }
  }

  const account = parsed.accounts?.[accountId]
  if (!account) {
    throw new Error(`account not found: ${accountId}`)
  }

  return {
    accountId,
    ...account,
  }
}

export function listResolvedFeishuAccounts(config: FeishuChannelConfigInput): ResolvedFeishuAccount[] {
  const parsed = parseFeishuConfig(config)
  const accounts: ResolvedFeishuAccount[] = []

  if (parsed.enabled !== false && parsed.appId && parsed.appSecret) {
    accounts.push({
      accountId: 'default',
      ...parsed,
      appId: parsed.appId,
      appSecret: parsed.appSecret,
    })
  }

  for (const [accountId, account] of Object.entries(parsed.accounts ?? {})) {
    if (account.enabled === false) {
      continue
    }
    accounts.push({
      accountId,
      ...account,
    })
  }

  return accounts
}
