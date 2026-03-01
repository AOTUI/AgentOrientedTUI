import { describe, expect, it } from 'vitest'
import { feishuPostToMarkdown } from '../../../../src/im/channels/feishu/post.js'

describe('feishuPostToMarkdown', () => {
  it('converts simple text block', () => {
    const input = {
      title: 'T',
      content: [[{ tag: 'text', text: 'hello world' }]],
    }

    expect(feishuPostToMarkdown(input as any)).toBe('# T\n\nhello world')
  })

  it('converts links to markdown links', () => {
    const input = {
      content: [[
        { tag: 'text', text: 'see ' },
        { tag: 'a', text: 'docs', href: 'https://example.com' },
      ]],
    }

    expect(feishuPostToMarkdown(input as any)).toBe('see [docs](https://example.com)')
  })

  it('converts at mention into plain mention label', () => {
    const input = {
      content: [[
        { tag: 'text', text: 'hi ' },
        { tag: 'at', user_name: 'Alice' },
      ]],
    }

    expect(feishuPostToMarkdown(input as any)).toBe('hi @Alice')
  })

  it('converts image tag to markdown image placeholder', () => {
    const input = {
      content: [[{ tag: 'img', image_key: 'img_001' }]],
    }

    expect(feishuPostToMarkdown(input as any)).toBe('![image](feishu://image/img_001)')
  })

  it('separates lines and paragraphs', () => {
    const input = {
      content: [
        [{ tag: 'text', text: 'line1' }],
        [{ tag: 'text', text: 'line2' }],
      ],
    }

    expect(feishuPostToMarkdown(input as any)).toBe('line1\nline2')
  })

  it('returns empty string for invalid input', () => {
    expect(feishuPostToMarkdown(undefined as any)).toBe('')
    expect(feishuPostToMarkdown({} as any)).toBe('')
  })
})
