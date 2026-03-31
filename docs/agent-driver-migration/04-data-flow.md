# Data Flow

## End-to-End Flow

1. A source changes state and emits `onUpdate`.
2. `AgentDriverV2` debounces repeated signals and requests one merged run.
3. The driver collects `MessageWithTimestamp[]` from every active source.
4. The driver sorts by timestamp, strips timestamps, repairs historical assistant/tool message structure, and drops protocol-invalid orphan tool results.
5. The driver collects `Record<string, Tool>` from every active source and rebuilds the tool-to-source map.
6. The driver builds an input signature; unchanged inputs skip the expensive LLM call.
7. `LLMClient` resolves provider/model, applies attachment capability guards, invokes `streamText`, and returns assistant text, reasoning, tool calls, finish reason, and usage.
8. The driver emits the assistant message to the host via `onAssistantMessage`.
9. If the assistant contains tool-calls, the driver routes each tool to its owning source, builds tool-result messages, emits `onToolResult`, and waits for source updates before the next run.

## Message Path

- `SystemPromptDrivenSource` produces the fixed `role: "system"` prefix.
- `HostDrivenSourceV2` and `IMDrivenSource` contribute persisted conversation history.
- `AOTUIDrivenSource` contributes live desktop/view state plus tool inventory.
- The driver produces protocol-safe `ModelMessage[]` for AI SDK consumption.
- The host persists assistant/tool messages outside the package.

## Tool Path

- Sources expose tools through `getTools()`.
- The driver merges them into a flat tool map.
- `updateToolMapping()` records `toolName -> source`.
- `executeToolCalls()` dispatches directly to the mapped source instead of scanning every source on every invocation.
- Tool execution results are wrapped into `role: "tool"` messages with `tool-result` parts.

## State Path

- Internal driver states: `idle -> thinking -> executing -> idle`
- `pending` coalesces repeated update requests.
- `paused` prevents draining while still remembering pending work.
- `lastInputSignature` skips duplicate LLM calls when sources emit no effective change.

## Contract Inventory

| Contract | Kind | Produced By | Consumed By | Notes |
| --- | --- | --- | --- | --- |
| `IDrivenSource` | interface | `agent-driver-v2/src/core/interfaces.ts` | every source implementation | mandatory abstraction boundary |
| `MessageWithTimestamp` | DTO | every source | `AgentDriverV2.collectMessages()` | timestamp exists only before protocol normalization |
| `ToolResult` | DTO | source `executeTool()` | `AgentDriverV2.createToolMessage()` | converted to AI SDK-style `tool-result` parts |
| `AgentDriverV2Config` | interface | host integrator | `AgentDriverV2` constructor | where host wires callbacks and work-loop knobs |
| `LLMConfig` | interface | host config layer | `LLMClient` and provider factory | includes model, provider, apiKey, temperature, maxSteps |
| assistant callback message | `ModelMessage` | `LLMClient` -> `AgentDriverV2` | host/session layer | final persistence happens outside package |
| compaction anchor | synthetic tool-result protocol | host/IM source | later message-window logic | optional extension, not core driver requirement |

## Important Invariants

- Tool results must not appear without a preceding assistant tool-call in the active protocol window.
- Sources own their tool execution; the driver never executes business logic itself.
- The host owns persistence; the driver only emits messages/events.
- State refresh after tool execution depends on sources emitting a fresh update after their side effect lands.
