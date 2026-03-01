import { describe, expect, it } from 'vitest'
import { checkBotMentioned, stripBotMention } from '../../../../src/im/channels/feishu/mention'

describe('Feishu mention helpers', () => {
  it('detects mention by open_id token', () => {
    expect(checkBotMentioned('hello <at user_id="ou_bot">bot</at>', { openId: 'ou_bot' })).toBe(true)
  })

  it('detects mention by app id token', () => {
    expect(checkBotMentioned('hello <at user_id="cli_xxx">bot</at>', { appId: 'cli_xxx' })).toBe(true)
  })

  it('returns false when no mention exists', () => {
    expect(checkBotMentioned('hello world', { openId: 'ou_bot' })).toBe(false)
  })

  it('strips mention tag and normalizes spaces', () => {
    const text = stripBotMention('  <at user_id="ou_bot">bot</at>   hi there  ', { openId: 'ou_bot' })
    expect(text).toBe('hi there')
  })

  it('strips both appId and openId mentions', () => {
    const text = stripBotMention('x <at user_id="cli_xxx">bot</at> y <at user_id="ou_bot">bot</at> z', {
      appId: 'cli_xxx',
      openId: 'ou_bot',
    })
    expect(text).toBe('x y z')
  })

  it('keeps original text when token is unknown', () => {
    const text = stripBotMention('hello <at user_id="ou_other">bot</at>', { openId: 'ou_bot' })
    expect(text).toBe('hello <at user_id="ou_other">bot</at>')
  })
})
