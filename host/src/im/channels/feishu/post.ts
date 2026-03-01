interface FeishuPostNode {
  tag?: string
  text?: string
  href?: string
  user_name?: string
  image_key?: string
}

interface FeishuPostContent {
  title?: string
  content?: FeishuPostNode[][]
}

function renderNode(node: FeishuPostNode): string {
  switch (node.tag) {
    case 'text':
      return node.text ?? ''
    case 'a':
      return `[${node.text ?? ''}](${node.href ?? ''})`
    case 'at':
      return `@${node.user_name ?? 'unknown'}`
    case 'img':
      return node.image_key ? `![image](feishu://image/${node.image_key})` : '![image](feishu://image/unknown)'
    default:
      return node.text ?? ''
  }
}

export function feishuPostToMarkdown(input: FeishuPostContent | undefined): string {
  if (!input || !Array.isArray(input.content)) {
    return ''
  }

  const lines = input.content
    .map((line) => line.map((node) => renderNode(node)).join(''))
    .map((line) => line.trim())

  const body = lines.join('\n').trim()
  if (!input.title) {
    return body
  }

  if (!body) {
    return `# ${input.title}`
  }

  return `# ${input.title}\n\n${body}`
}
