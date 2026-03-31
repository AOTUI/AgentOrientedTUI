# Migration Plan

## Strategy

Use a hybrid strategy:

- transplant the portable core package almost unchanged
- adapt source implementations that match the target’s runtime model
- rewrite session orchestration around the target host’s own persistence, config, and lifecycle model

## Prerequisites

- TypeScript/Node runtime
- Vercel AI SDK v6 or a deliberate replacement layer
- provider API key management
- a host-owned message persistence layer
- at least one system/history/state source that can implement `IDrivenSource`

## Ordered Steps

1. **Port the core contracts and driver package**
   - Copy `agent-driver-v2` core files, entrypoint, utils, and package metadata.
   - Keep `IDrivenSource`, `AgentDriverV2`, `LLMClient`, and provider factory together.

2. **Decide the provider abstraction boundary**
   - If the target already uses AI SDK v6, keep `LLMClient` and `provider-factory` mostly intact.
   - Otherwise replace this layer first, but keep the driver’s callback and tool-call semantics unchanged.

3. **Implement the minimum source set**
   - Add one system prompt source.
   - Add one history/state source.
   - Add one tool-owning source if the target needs tool execution.
   - Do not migrate AOTUI-specific code unless the target actually has a desktop/view/tool state model.

4. **Wire host callbacks and persistence**
   - Persist `onAssistantMessage` outputs.
   - Persist `onToolResult` outputs.
   - Surface `onTextDelta`, `onReasoningDelta`, `onLLMUsage`, and `onRunError` through the target host’s event model.

5. **Add optional context compaction only after the basic loop works**
   - Reuse `HostDrivenSourceV2` / `IMDrivenSource` as references, not mandatory dependencies.
   - Preserve compaction anchor semantics if long-running conversations matter.

6. **Rebuild orchestration around the target host**
   - Use `SessionManagerV3` as an architecture example for how to compose sources, not as a transplant candidate.
   - Replace topic/desktop/session management with the target’s own lifecycle model.

7. **Lock in regression tests**
   - Carry over core tests.
   - Add target-specific tests for source updates, tool routing, and callback persistence.

## Per-Step Verification

| Step | Verification | Exit Criteria |
| --- | --- | --- |
| Port core package | package builds in target repo | `AgentDriverV2` and interfaces compile |
| Provider layer | one model can be called with a fake or real provider in target environment | assistant callback fires with expected message shape |
| Minimum sources | driver can collect messages/tools from at least two sources | sorted messages and merged tools are observable |
| Tool routing | one tool call returns to the correct source | `onToolResult` emits a matching `toolCallId` |
| Host persistence wiring | assistant/tool messages are stored and replayable | next run can read back persisted history |
| Optional compaction | compaction summary preserves continuity | later runs can continue from compacted window |
| Full integration | end-to-end journey passes | user message -> assistant -> tool -> state refresh works |

## Recommended Cut Line For MVP Migration

For a first successful migration, stop at:

- core package
- system prompt source
- one history source
- one tool-owning source
- host callback persistence

Only add compaction and session-management sophistication after that loop is stable.
