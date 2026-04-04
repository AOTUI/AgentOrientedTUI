import { EventEmitter } from 'events'
import type { MessageWithTimestamp, ToolResult } from '@aotui/agent-driver-v2'
import type { ModelMessage } from 'ai'
import { dynamicTool, jsonSchema } from 'ai'

export interface IMDrivenSourceOptions {
  sessionKey: string
  now?: () => number
  loadHistory?: (sessionKey: string) => Promise<MessageWithTimestamp[]>
  persistMessage?: (sessionKey: string, message: MessageWithTimestamp) => void | Promise<void>
  replaceHistory?: (sessionKey: string, messages: MessageWithTimestamp[]) => void | Promise<void>
}

interface CompactionPolicyInput {
  enabled?: boolean
  maxContextTokens?: number
  minMessages?: number
  keepRecentMessages?: number
  modelHint?: string
}

const COMPACTION_TOOL_NAME = 'context_compact'
const COMPACTED_TOOL_RESULT_PLACEHOLDER = '[Older tool result summarized by IM context compaction]'
const COMPACTION_TOOL_DESCRIPTION = [
  'Compact IM session context for long-running chat sessions while preserving execution continuity.',
  '',
  'When to trigger compaction:',
  '- The IM thread has become long, repetitive, or noisy.',
  '- Before switching to a new subtask after a milestone in the same IM session.',
  '- When tool activity has accumulated and older details can be summarized safely.',
  '- Keep message protocol continuity intact (tool-call/tool-result sequence).',
  '',
  'How to compact (summary requirements):',
  '- You MUST provide the summary field when calling this tool.',
  '- Write a continuation-ready summary, not a generic recap.',
  '- Preserve concrete user constraints, current execution state, and unresolved decisions.',
  '',
  'Required summary template:',
  '---',
  '## Goal',
  '[What is the user trying to accomplish in this IM session?]',
  '',
  '## Instructions',
  '- [Still-active constraints, policies, or user preferences]',
  '- [Important execution constraints that must carry forward]',
  '',
  '## Discoveries',
  '[Key findings, diagnoses, or context needed for the next step]',
  '',
  '## Accomplished',
  '[What is done, what is in progress, and what remains]',
  '',
  '## Relevant files / systems',
  '[Concrete files, services, channels, or tools involved]',
  '---',
].join('\n')

type MessagePart = Record<string, any>

function getMessageParts(message: MessageWithTimestamp): MessagePart[] {
  return Array.isArray(message.content) ? message.content.filter((part) => part && typeof part === 'object') as MessagePart[] : []
}

function isCompactionToolPart(part: MessagePart): boolean {
  return (part.type === 'tool-call' || part.type === 'tool-result') && part.toolName === COMPACTION_TOOL_NAME
}

function isCompactionAnchor(message: MessageWithTimestamp): boolean {
  return getMessageParts(message).some((part) => {
    if (part.type !== 'tool-result' || part.toolName !== COMPACTION_TOOL_NAME) {
      return false
    }

    const result = part.result ?? part.output
    return !result || typeof result !== 'object' || result.success !== false
  })
}

function getActiveWindow(messages: MessageWithTimestamp[]): MessageWithTimestamp[] {
  let anchorIndex = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (isCompactionAnchor(messages[i])) {
      anchorIndex = i
      break
    }
  }

  if (anchorIndex < 0) {
    return messages
  }

  let start = anchorIndex
  if (messages[anchorIndex]?.role === 'tool' && anchorIndex > 0) {
    start = anchorIndex - 1
  }

  return messages.slice(start)
}

function collectToolCallIds(message: MessageWithTimestamp): Set<string> {
  const ids = new Set<string>()
  for (const part of getMessageParts(message)) {
    if (part.type === 'tool-call' && typeof part.toolCallId === 'string' && part.toolCallId.trim()) {
      ids.add(part.toolCallId)
    }
  }
  return ids
}

function collectToolResultIds(message: MessageWithTimestamp): Set<string> {
  const ids = new Set<string>()
  for (const part of getMessageParts(message)) {
    if (part.type === 'tool-result' && typeof part.toolCallId === 'string' && part.toolCallId.trim()) {
      ids.add(part.toolCallId)
    }
  }
  return ids
}

function expandBoundaryForProtocolContinuity(
  activeWindow: MessageWithTimestamp[],
  keepRecentMessages: number,
): MessageWithTimestamp[] {
  if (activeWindow.length <= keepRecentMessages) {
    return [...activeWindow]
  }

  let startIndex = Math.max(0, activeWindow.length - keepRecentMessages)

  while (startIndex > 0) {
    const current = activeWindow[startIndex]
    const previous = activeWindow[startIndex - 1]
    const currentToolResults = collectToolResultIds(current)
    const previousToolCalls = collectToolCallIds(previous)

    const needsPreviousToolCall = Array.from(currentToolResults).some((id) => previousToolCalls.has(id))
    if (!needsPreviousToolCall) {
      break
    }

    startIndex -= 1
  }

  return activeWindow.slice(startIndex)
}

function countCompactedToolResults(messages: MessageWithTimestamp[]): number {
  let count = 0

  for (const message of messages) {
    for (const part of getMessageParts(message)) {
      if (part.type !== 'tool-result' || isCompactionToolPart(part)) {
        continue
      }
      count += 1
    }
  }

  return count
}

function createCompactionMessages(
  summary: string,
  reason: string | undefined,
  compactedMessageCount: number,
  cleanedToolResultCount: number,
  timestampBase: number,
  trigger: 'agent' | 'host_fallback',
): MessageWithTimestamp[] {
  const toolCallId = `im_compact_${timestampBase}_${Math.random().toString(36).slice(2, 8)}`

  return [
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId,
          toolName: COMPACTION_TOOL_NAME,
          input: {
            trigger,
            ...(reason ? { reason } : {}),
          },
        },
      ] as any,
      timestamp: timestampBase,
      region: 'session',
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId,
          toolName: COMPACTION_TOOL_NAME,
          result: {
            success: true,
            trigger,
            summary,
            compactedMessageCount,
            cleanedToolResultCount,
          },
          metadata: {
            aotuiCompactionAnchor: true,
            placeholder: COMPACTED_TOOL_RESULT_PLACEHOLDER,
          },
        },
      ] as any,
      timestamp: timestampBase + 1,
      region: 'session',
    },
  ]
}

function messageKey(message: MessageWithTimestamp): string {
  return JSON.stringify({
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  })
}

function mergeMessages(existing: MessageWithTimestamp[], incoming: MessageWithTimestamp[]): MessageWithTimestamp[] {
  const merged = new Map<string, MessageWithTimestamp>()

  for (const message of [...existing, ...incoming]) {
    merged.set(messageKey(message), message)
  }

  return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp)
}

function extractDisplayText(message: MessageWithTimestamp): string {
  if (typeof message.content === 'string') {
    return message.content
  }

  const parts = getMessageParts(message)
  if (parts.length === 0) {
    return ''
  }

  const textParts: string[] = []
  for (const part of parts) {
    if (part.type === 'text' || part.type === 'reasoning') {
      textParts.push(String(part.text || ''))
      continue
    }

    if (part.type === 'tool-call') {
      textParts.push(`Tool call: ${part.toolName || 'unknown'}`)
      continue
    }

    if (part.type === 'tool-result') {
      const output = part.output ?? part.result
      if (typeof output === 'string') {
        textParts.push(output)
      } else if (output !== undefined) {
        textParts.push(JSON.stringify(output))
      }
    }
  }

  return textParts.join('\n').trim()
}

function estimateTokensFromText(text: string, modelHint?: string): number {
  if (!text) return 0

  const cjkMatches = text.match(/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g)
  const cjkRatio = cjkMatches ? cjkMatches.length / text.length : 0

  let charsPerToken = 4
  const model = (modelHint || '').toLowerCase()
  if (model.includes('gpt-4o') || model.includes('gpt-4.1') || model.includes('claude-3')) {
    charsPerToken = 3.6
  } else if (model.includes('gemini') || model.includes('qwen') || model.includes('deepseek')) {
    charsPerToken = 3.4
  }

  if (cjkRatio > 0.3) {
    charsPerToken = Math.min(charsPerToken, 1.9)
  }

  return Math.ceil(text.length / charsPerToken)
}

function toCompactionSummary(messages: MessageWithTimestamp[]): string {
  const recent = messages.slice(-12)
  const userNotes: string[] = []
  const assistantNotes: string[] = []

  for (const message of recent) {
    const text = extractDisplayText(message).trim()
    if (!text) continue
    const clipped = text.length > 220 ? `${text.slice(0, 220)}...` : text
    if (message.role === 'user') {
      userNotes.push(clipped)
    } else if (message.role === 'assistant') {
      assistantNotes.push(clipped)
    }
  }

  return [
    '## Goal',
    'Continue the current IM task with compacted context.',
    '',
    '## Instructions',
    '- Preserve the active user constraints and execution state.',
    '- Continue from the latest tool and file state before asking for missing details.',
    '',
    '## Discoveries',
    userNotes.length > 0 ? `Recent user intents: ${userNotes.slice(-4).join(' | ')}` : 'Recent user intents: none captured.',
    assistantNotes.length > 0 ? `Recent assistant progress: ${assistantNotes.slice(-4).join(' | ')}` : 'Recent assistant progress: none captured.',
    '',
    '## Accomplished',
    'Compacted older IM context while keeping the latest execution window.',
    '',
    '## Relevant files / systems',
    'Preserve any active tools, channels, and referenced files from the latest window.',
  ].join('\n')
}

export class IMDrivenSource {
  readonly name = 'IM'

  private readonly sessionKey: string
  private readonly now: () => number
  private readonly loadHistory?: (sessionKey: string) => Promise<MessageWithTimestamp[]>
  private readonly persistMessage?: (sessionKey: string, message: MessageWithTimestamp) => void | Promise<void>
  private readonly replaceHistory?: (sessionKey: string, messages: MessageWithTimestamp[]) => void | Promise<void>
  private readonly eventEmitter = new EventEmitter()

  private historyLoaded = false
  private messages: MessageWithTimestamp[] = []

  constructor(options: IMDrivenSourceOptions) {
    this.sessionKey = options.sessionKey
    this.now = options.now ?? (() => Date.now())
    this.loadHistory = options.loadHistory
    this.persistMessage = options.persistMessage
    this.replaceHistory = options.replaceHistory
  }

  async getMessages(): Promise<MessageWithTimestamp[]> {
    await this.ensureHistoryLoaded()

    return getActiveWindow(this.messages).map((message) => ({
      ...message,
      region: message.region ?? 'session',
    }))
  }

  async getTools(): Promise<Record<string, any>> {
    const compactTool = dynamicTool({
      description: COMPACTION_TOOL_DESCRIPTION,
      inputSchema: jsonSchema({
        type: 'object',
        additionalProperties: false,
        properties: {
          reason: {
            type: 'string',
            description: 'Optional reason for traceability.',
          },
          summary: {
            type: 'string',
            minLength: 1,
            description: 'Required continuation-ready summary of older IM context.',
          },
          force: {
            type: 'boolean',
            description: 'Force compaction even when the message count is small.',
          },
          minMessages: {
            type: 'number',
            minimum: 1,
            description: 'Optional minimum message threshold before compaction runs.',
          },
          keepRecentMessages: {
            type: 'number',
            minimum: 1,
            description: 'Optional number of most recent messages to preserve in detail.',
          },
        },
        required: ['summary'],
      }),
      execute: async () => {
        return 'Use AgentDriver executeTool routing for IM context compaction.'
      },
    })

    return {
      [COMPACTION_TOOL_NAME]: compactTool,
    }
  }

  async executeTool(toolName: string, args: unknown, toolCallId: string): Promise<ToolResult | undefined> {
    if (toolName !== COMPACTION_TOOL_NAME) {
      return undefined
    }

    await this.ensureHistoryLoaded()

    const input = (args || {}) as {
      reason?: unknown
      summary?: unknown
      force?: unknown
      minMessages?: unknown
      keepRecentMessages?: unknown
    }
    const summary = typeof input.summary === 'string' ? input.summary.trim() : ''
    if (!summary) {
      return {
        toolCallId,
        toolName,
        result: {
          success: false,
          trigger: 'agent',
          summary: '',
          compactedMessageCount: 0,
          cleanedToolResultCount: 0,
          note: 'context_compact requires a non-empty summary. Provide a continuation summary using the required template.',
        },
      }
    }

    const reason = typeof input.reason === 'string' ? input.reason : undefined
    const force = input.force === true
    const minMessages = Number.isInteger(input.minMessages) && (input.minMessages as number) > 0
      ? (input.minMessages as number)
      : 14
    const keepRecentMessages = Number.isInteger(input.keepRecentMessages) && (input.keepRecentMessages as number) > 0
      ? (input.keepRecentMessages as number)
      : 8

    const activeWindow = getActiveWindow(this.messages)

    if (!force && activeWindow.length < minMessages) {
      return {
        toolCallId,
        toolName,
        result: {
          success: false,
          trigger: 'agent',
          summary: '',
          compactedMessageCount: 0,
          cleanedToolResultCount: 0,
          note: 'Compaction skipped: active IM message window did not meet minMessages threshold. Set force=true to override.',
        },
      }
    }

    const originalMessageCount = activeWindow.length
    const preservedMessages = expandBoundaryForProtocolContinuity(activeWindow, keepRecentMessages)
    const compactedAwayMessages = activeWindow.slice(0, Math.max(0, activeWindow.length - preservedMessages.length))
    const cleanedToolResultCount = countCompactedToolResults(compactedAwayMessages)
    const firstPreservedTimestamp = preservedMessages[0]?.timestamp
    const timestampBase = typeof firstPreservedTimestamp === 'number'
      ? firstPreservedTimestamp - 2
      : this.now()
    const compactionMessages = createCompactionMessages(
      summary,
      reason,
      originalMessageCount,
      cleanedToolResultCount,
      timestampBase,
      'agent',
    )

    this.messages = mergeMessages(compactionMessages, preservedMessages)

    if (this.replaceHistory) {
      await Promise.resolve(this.replaceHistory(this.sessionKey, this.messages))
    }

    this.notifyUpdate()

    return {
      toolCallId,
      toolName,
      result: {
        success: true,
        trigger: 'agent',
        summary,
        compactedMessageCount: Math.max(0, originalMessageCount - preservedMessages.length),
        cleanedToolResultCount,
        reason,
      },
    }
  }

  public getCompactionToolName(): string {
    return COMPACTION_TOOL_NAME
  }

  public async runHardFallbackCompaction(reason?: string): Promise<{
    compacted: boolean
    syntheticMessages: MessageWithTimestamp[]
    summary: string
    compactedMessageCount: number
    cleanedToolResultCount: number
  }>
  public async runHardFallbackCompaction(
    reason: string | undefined,
    options: Pick<CompactionPolicyInput, 'minMessages' | 'keepRecentMessages'>,
  ): Promise<{
    compacted: boolean
    syntheticMessages: MessageWithTimestamp[]
    summary: string
    compactedMessageCount: number
    cleanedToolResultCount: number
  }>
  public async runHardFallbackCompaction(
    reason?: string,
    options?: Pick<CompactionPolicyInput, 'minMessages' | 'keepRecentMessages'>,
  ): Promise<{
    compacted: boolean
    syntheticMessages: MessageWithTimestamp[]
    summary: string
    compactedMessageCount: number
    cleanedToolResultCount: number
  }> {
    await this.ensureHistoryLoaded()

    const activeWindow = getActiveWindow(this.messages)
    const minMessages = options?.minMessages ?? 14
    const keepRecentMessages = options?.keepRecentMessages ?? 8

    if (activeWindow.length < minMessages) {
      return {
        compacted: false,
        syntheticMessages: [],
        summary: '',
        compactedMessageCount: 0,
        cleanedToolResultCount: 0,
      }
    }

    const preservedMessages = expandBoundaryForProtocolContinuity(activeWindow, keepRecentMessages)
    const compactedAwayMessages = activeWindow.slice(0, Math.max(0, activeWindow.length - preservedMessages.length))
    const cleanedToolResultCount = countCompactedToolResults(compactedAwayMessages)
    const summary = toCompactionSummary(activeWindow)
    const firstPreservedTimestamp = preservedMessages[0]?.timestamp
    const timestampBase = typeof firstPreservedTimestamp === 'number'
      ? firstPreservedTimestamp - 2
      : this.now()
    const syntheticMessages = createCompactionMessages(
      summary,
      reason,
      activeWindow.length,
      cleanedToolResultCount,
      timestampBase,
      'host_fallback',
    )

    this.messages = mergeMessages(syntheticMessages, preservedMessages)

    if (this.replaceHistory) {
      await Promise.resolve(this.replaceHistory(this.sessionKey, this.messages))
    }

    this.notifyUpdate()

    return {
      compacted: true,
      syntheticMessages,
      summary,
      compactedMessageCount: Math.max(0, activeWindow.length - preservedMessages.length),
      cleanedToolResultCount,
    }
  }

  public async maybeCompactByThreshold(policyInput?: CompactionPolicyInput): Promise<{
    compacted: boolean
    syntheticMessages: MessageWithTimestamp[]
    summary: string
    compactedMessageCount: number
    cleanedToolResultCount: number
    currentTokens: number
    thresholdTokens: number
  }> {
    const options: Required<CompactionPolicyInput> = {
      enabled: true,
      maxContextTokens: 4_500,
      minMessages: 14,
      keepRecentMessages: 8,
      modelHint: '',
      ...(policyInput || {}),
    }

    if (!options.enabled) {
      return {
        compacted: false,
        syntheticMessages: [],
        summary: '',
        compactedMessageCount: 0,
        cleanedToolResultCount: 0,
        currentTokens: 0,
        thresholdTokens: options.maxContextTokens,
      }
    }

    await this.ensureHistoryLoaded()
    const activeWindow = getActiveWindow(this.messages)
    const tokens = activeWindow.reduce((total, message) => {
      const display = extractDisplayText(message)
      const roleOverhead = 6
      const partOverhead = Array.isArray(message.content) ? message.content.length * 2 : 2
      return total + estimateTokensFromText(display, options.modelHint || undefined) + roleOverhead + partOverhead
    }, 0)

    if (tokens < options.maxContextTokens) {
      return {
        compacted: false,
        syntheticMessages: [],
        summary: '',
        compactedMessageCount: 0,
        cleanedToolResultCount: 0,
        currentTokens: tokens,
        thresholdTokens: options.maxContextTokens,
      }
    }

    const compacted = await this.runHardFallbackCompaction(
      `context tokens ${tokens} exceeded threshold ${options.maxContextTokens}`,
      {
        minMessages: options.minMessages,
        keepRecentMessages: options.keepRecentMessages,
      },
    )

    return {
      ...compacted,
      currentTokens: tokens,
      thresholdTokens: options.maxContextTokens,
    }
  }

  onUpdate(callback: () => void): () => void {
    this.eventEmitter.on('update', callback)
    return () => {
      this.eventEmitter.off('update', callback)
    }
  }

  addMessage(message: ModelMessage, timestamp?: number): MessageWithTimestamp {
    const record: MessageWithTimestamp = {
      role: message.role,
      content: message.content,
      timestamp: typeof timestamp === 'number' ? timestamp : this.now(),
      region: 'session',
    }

    this.messages = mergeMessages(this.messages, [record])

    if (this.persistMessage) {
      void Promise.resolve(this.persistMessage(this.sessionKey, record))
    }

    return record
  }

  notifyUpdate(): void {
    console.log('[IM][DrivenSource] notifyUpdate', {
      sessionKey: this.sessionKey,
      messageCount: this.messages.length,
    })
    this.eventEmitter.emit('update')
  }

  private async ensureHistoryLoaded(): Promise<void> {
    if (this.historyLoaded) {
      return
    }

    this.historyLoaded = true
    if (!this.loadHistory) {
      return
    }

    const history = await this.loadHistory(this.sessionKey)
    if (Array.isArray(history) && history.length > 0) {
      this.messages = mergeMessages(this.messages, history)
    }
  }
}
