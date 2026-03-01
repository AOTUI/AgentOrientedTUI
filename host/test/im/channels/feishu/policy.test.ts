import { describe, expect, it } from 'vitest'
import { checkDmPolicy, checkGroupPolicy } from '../../../../src/im/channels/feishu/policy'

describe('Feishu DM policy', () => {
  it('allows all users when dmPolicy=open', () => {
    const result = checkDmPolicy({ dmPolicy: 'open' }, 'ou_any')
    expect(result.allowed).toBe(true)
  })

  it('blocks non-whitelisted users when dmPolicy=allowlist', () => {
    const result = checkDmPolicy({ dmPolicy: 'allowlist', allowFrom: ['ou_a'] }, 'ou_b')
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/allowlist/i)
  })

  it('allows whitelisted users when dmPolicy=allowlist', () => {
    const result = checkDmPolicy({ dmPolicy: 'allowlist', allowFrom: ['ou_a'] }, 'ou_a')
    expect(result.allowed).toBe(true)
  })
})

describe('Feishu group policy', () => {
  it('blocks all groups when groupPolicy=disabled', () => {
    const result = checkGroupPolicy({ groupPolicy: 'disabled' }, 'oc_1')
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/disabled/i)
  })

  it('blocks non-whitelisted groups when groupPolicy=allowlist', () => {
    const result = checkGroupPolicy({ groupPolicy: 'allowlist', groupAllowFrom: ['oc_1'] }, 'oc_2')
    expect(result.allowed).toBe(false)
  })

  it('allows whitelisted groups when groupPolicy=allowlist', () => {
    const result = checkGroupPolicy({ groupPolicy: 'allowlist', groupAllowFrom: ['oc_1'] }, 'oc_1')
    expect(result.allowed).toBe(true)
  })

  it('allows all groups when groupPolicy=open', () => {
    const result = checkGroupPolicy({ groupPolicy: 'open' }, 'oc_any')
    expect(result.allowed).toBe(true)
  })
})
