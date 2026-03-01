import { parseFeishuConfig, type FeishuAccountConfig, type FeishuChannelConfigInput } from './config-schema.js'

export interface ResolvedFeishuAccount extends FeishuAccountConfig {
  accountId: string
}

export function resolveFeishuAccount(config: FeishuChannelConfigInput, accountId = 'default'): ResolvedFeishuAccount {
  const parsed = parseFeishuConfig(config)

  if (accountId === 'default') {
    return {
      accountId,
      ...parsed,
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
