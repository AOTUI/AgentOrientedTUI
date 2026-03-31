# User Journeys

## Journey: End user sends a message and receives an assistant reply

- Actor: end user using GUI or IM host
- Trigger: host persists a new user message and a source emits `onUpdate`
- Preconditions:
  - a session has an active `AgentDriverV2`
  - at least one history/state source is enabled
  - a valid `LLMConfig` is available
- Modules touched:
  - `host/src/core/message-service-v2.ts`
  - `host/src/adapters/host-driven-source.ts`
  - `host/src/adapters/system-prompt-source.ts`
  - `runtime/src/adapters/aotui-driven-source.ts` when desktop state is part of context
  - `agent-driver-v2/src/core/agent-driver-v2.ts`
  - `agent-driver-v2/src/core/llm-client.ts`
  - `host/src/core/session-manager-v3.ts`
- Data consumed:
  - persisted message history
  - system prompt
  - runtime desktop snapshot
  - tool definitions gathered from active sources
  - model/provider config
- Data produced:
  - one assistant `ModelMessage`
  - optional text/reasoning deltas
  - token usage payload
- User-visible result: assistant text is persisted and emitted back to GUI/IM
- Failure behavior:
  - missing provider API key triggers `onRunError`
  - driver returns to `idle`
  - host decides how to surface the failure

## Journey: LLM asks to call a tool and the owning source executes it

- Actor: LLM plus the source that owns the requested tool
- Trigger: `LLMClient.call()` returns assistant content containing `tool-call` parts
- Preconditions:
  - `AgentDriverV2` already built the tool-to-source map for active sources
  - the tool name exists in one source’s `getTools()` result
- Modules touched:
  - `agent-driver-v2/src/core/agent-driver-v2.ts`
  - `agent-driver-v2/src/core/interfaces.ts`
  - source-specific implementation such as `runtime/src/adapters/aotui-driven-source.ts` or `host/src/adapters/host-driven-source.ts`
- Data consumed:
  - tool name
  - tool args/input
  - toolCallId
- Data produced:
  - `ToolResult[]`
  - a tool `ModelMessage` emitted through `onToolResult`
  - optional source-side state change that emits another `onUpdate`
- User-visible result:
  - tool side effect lands
  - follow-up agent run sees refreshed state instead of stale pre-tool state
- Failure behavior:
  - unknown tool -> `E_TOOL_NOT_FOUND`
  - source execution exception -> `E_EXECUTION_ERROR`
  - repeated failures increment `toolFailureStreak`

## Journey: Runtime state changes without a new user message

- Actor: runtime/desktop/app layer
- Trigger: a view snapshot or available operation set changes
- Preconditions:
  - `AOTUIDrivenSource` is enabled
  - its listeners are attached to driver lifecycle
- Modules touched:
  - `runtime/src/adapters/aotui-driven-source.ts`
  - `agent-driver-v2/src/utils/debounce.ts`
  - `agent-driver-v2/src/core/agent-driver-v2.ts`
- Data consumed:
  - updated app/view snapshot
  - updated operation catalog
- Data produced:
  - refreshed `MessageWithTimestamp[]`
  - refreshed `Record<string, Tool>`
- User-visible result:
  - next run includes current desktop state and current operation list
- Failure behavior:
  - source-level collection failure is logged and isolated
  - other active sources still participate in the run

## Journey: Long-running host/IM session compacts context

- Actor: host or IM driven source
- Trigger: compaction tool call or token threshold breach
- Preconditions:
  - session keeps message history outside `agent-driver-v2`
  - compaction tool is exposed by the source
- Modules touched:
  - `host/src/adapters/host-driven-source.ts`
  - `host/src/im/im-driven-source.ts`
  - `host/src/core/message-service-v2.ts`
  - `agent-driver-v2/src/core/agent-driver-v2.ts`
- Data consumed:
  - active message window
  - summary text
  - policy thresholds
- Data produced:
  - synthetic compaction anchor messages or rewritten history
  - placeholder tool-result content for older tool outputs
- User-visible result:
  - session remains executable with smaller prompt context
- Failure behavior:
  - missing summary causes compaction tool to return a structured failure result

## What These Journeys Prove

- The feature is event-driven, not request/response only.
- The core package depends on host-owned persistence and source-owned tool execution.
- The portable heart is the driver contract plus run loop; the runtime/host sources are adaptation examples around it.
