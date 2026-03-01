import { describe, expect, it } from 'vitest'
import { normalizeReceiveIdType, normalizeDomain, buildMessageApiBase } from '../../../../src/im/channels/feishu/targets.ts'

describe('feishu targets utils', () => {
  it('normalizes receive id type with default', () => {
    expect(normalizeReceiveIdType(undefined)).toBe('chat_id')
    expect(normalizeReceiveIdType('open_id')).toBe('open_id')
  })

  it('throws on unsupported receive id type', () => {
    expect(() => normalizeReceiveIdType('xxx' as any)).toThrow(/receive_id_type/i)
  })

  it('normalizes domain values', () => {
    expect(normalizeDomain(undefined)).toBe('feishu')
    expect(normalizeDomain('lark')).toBe('lark')
    expect(normalizeDomain('feishu')).toBe('feishu')
  })

  it('throws on unsupported domain', () => {
    expect(() => normalizeDomain('example' as any)).toThrow(/domain/i)
  })

  it('builds message api base by domain', () => {
    expect(buildMessageApiBase('feishu')).toBe('https://open.feishu.cn')
    expect(buildMessageApiBase('lark')).toBe('https://open.larksuite.com')
  })

  it('prefers explicit apiBaseUrl override', () => {
    expect(buildMessageApiBase('feishu', 'https://proxy.example.com')).toBe('https://proxy.example.com')
  })
})
