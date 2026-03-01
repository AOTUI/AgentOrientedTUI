export interface FeishuPolicyConfig {
  dmPolicy?: 'open' | 'allowlist' | 'pairing'
  allowFrom?: Array<string | number>
  groupPolicy?: 'open' | 'allowlist' | 'disabled'
  groupAllowFrom?: Array<string | number>
}

export interface PolicyDecision {
  allowed: boolean
  reason?: string
}

function inAllowList(list: Array<string | number> | undefined, id: string): boolean {
  if (!Array.isArray(list) || list.length === 0) {
    return false
  }

  const target = id.trim()
  return list.some((item) => String(item).trim() === target)
}

export function checkDmPolicy(config: FeishuPolicyConfig, senderId: string): PolicyDecision {
  const dmPolicy = config.dmPolicy ?? 'open'

  if (dmPolicy === 'open') {
    return { allowed: true }
  }

  if (dmPolicy === 'allowlist') {
    if (inAllowList(config.allowFrom, senderId)) {
      return { allowed: true }
    }
    return { allowed: false, reason: 'blocked by dm allowlist policy' }
  }

  return { allowed: false, reason: 'dm pairing policy is not enabled in MVP' }
}

export function checkGroupPolicy(config: FeishuPolicyConfig, chatId: string): PolicyDecision {
  const groupPolicy = config.groupPolicy ?? 'open'

  if (groupPolicy === 'disabled') {
    return { allowed: false, reason: 'group policy is disabled' }
  }

  if (groupPolicy === 'allowlist') {
    if (inAllowList(config.groupAllowFrom, chatId)) {
      return { allowed: true }
    }
    return { allowed: false, reason: 'blocked by group allowlist policy' }
  }

  return { allowed: true }
}
