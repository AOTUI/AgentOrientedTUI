import type { ModelMessage } from 'ai';
import type { ContextRegion, MessageWithTimestamp } from './interfaces.js';

type TimedModelMessage = ModelMessage & {
  timestamp: number;
  region?: ContextRegion;
};

function normalizeRegion(region?: ContextRegion): ContextRegion {
  return region ?? 'session';
}

function stripTiming(message: TimedModelMessage): ModelMessage {
  const { timestamp: _timestamp, region: _region, ...modelMessage } = message;
  return modelMessage as ModelMessage;
}

function getToolCallIds(message: ModelMessage): string[] {
  if (message.role !== 'assistant' || !Array.isArray(message.content)) {
    return [];
  }

  return message.content
    .filter((part: any) => part?.type === 'tool-call' && typeof part.toolCallId === 'string')
    .map((part: any) => part.toolCallId as string);
}

function getToolResultIds(message: ModelMessage): string[] {
  if (message.role !== 'tool' || !Array.isArray(message.content)) {
    return [];
  }

  return message.content
    .filter((part: any) => part?.type === 'tool-result' && typeof part.toolCallId === 'string')
    .map((part: any) => part.toolCallId as string);
}

function findMatchingAssistantIndex(messages: ModelMessage[], toolIndex: number): number | null {
  const toolResultIds = new Set(getToolResultIds(messages[toolIndex]));
  if (toolResultIds.size === 0) {
    return null;
  }

  for (let index = toolIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant') {
      const toolCallIds = getToolCallIds(message);
      if (toolCallIds.some((id) => toolResultIds.has(id))) {
        return index;
      }
    }

    if (message.role === 'user') {
      break;
    }
  }

  return null;
}

function maybeExpandAssistantTail(messages: ModelMessage[], assistantIndex: number): number {
  const assistantMessage = messages[assistantIndex];
  if (assistantMessage.role !== 'assistant' || getToolCallIds(assistantMessage).length > 0) {
    return assistantIndex;
  }

  let cursor = assistantIndex - 1;
  while (cursor >= 0 && messages[cursor]?.role === 'tool') {
    cursor -= 1;
  }

  const candidateAssistantIndex = cursor;
  if (candidateAssistantIndex < 0) {
    return assistantIndex;
  }

  const candidateAssistant = messages[candidateAssistantIndex];
  if (candidateAssistant.role !== 'assistant') {
    return assistantIndex;
  }

  const candidateToolCallIds = new Set(getToolCallIds(candidateAssistant));
  if (candidateToolCallIds.size === 0) {
    return assistantIndex;
  }

  const toolMessages = messages.slice(candidateAssistantIndex + 1, assistantIndex);
  const matched = toolMessages.some((message) =>
    getToolResultIds(message).some((toolCallId) => candidateToolCallIds.has(toolCallId)),
  );

  return matched ? candidateAssistantIndex : assistantIndex;
}

export function splitActiveTail(messages: ModelMessage[]): {
  sessionMessages: ModelMessage[];
  activeTailMessages: ModelMessage[];
} {
  if (messages.length === 0) {
    return {
      sessionMessages: [],
      activeTailMessages: [],
    };
  }

  const lastIndex = messages.length - 1;
  const lastMessage = messages[lastIndex];

  let tailStart = lastIndex;

  if (lastMessage.role === 'tool') {
    const assistantIndex = findMatchingAssistantIndex(messages, lastIndex);
    if (assistantIndex === null) {
      return {
        sessionMessages: [...messages],
        activeTailMessages: [],
      };
    }
    tailStart = assistantIndex;
  } else if (lastMessage.role === 'assistant') {
    tailStart = maybeExpandAssistantTail(messages, lastIndex);
  }

  return {
    sessionMessages: messages.slice(0, tailStart),
    activeTailMessages: messages.slice(tailStart),
  };
}

export function assembleContextRegions(messages: MessageWithTimestamp[]): ModelMessage[] {
  const staticMessages = messages
    .filter((message) => normalizeRegion(message.region) === 'static')
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((message) => stripTiming(message as TimedModelMessage));

  const sessionMessages = messages
    .filter((message) => normalizeRegion(message.region) === 'session')
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((message) => stripTiming(message as TimedModelMessage));

  const dynamicMessages = messages
    .filter((message) => normalizeRegion(message.region) === 'dynamic')
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((message) => stripTiming(message as TimedModelMessage));

  const { sessionMessages: compactedSessionMessages, activeTailMessages } = splitActiveTail(sessionMessages);

  return [
    ...staticMessages,
    ...compactedSessionMessages,
    ...dynamicMessages,
    ...activeTailMessages,
  ];
}
