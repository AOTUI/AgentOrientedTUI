# Feature Overview

## Purpose

`agent-driver-v2` is the execution kernel that turns multiple message/tool producers into one LLM work loop. It aggregates state from multiple `IDrivenSource`s, sorts and normalizes messages, collects tools, calls the model, routes tool-calls back to the owning source, and emits assistant/tool results to the host application.

## In Scope

- `IDrivenSource`, `MessageWithTimestamp`, `ToolResult`, `AgentDriverV2Config`, `LLMConfig`
- the `AgentDriverV2` run loop and state machine
- the provider/bootstrap layer (`LLMClient`, `provider-factory`)
- callback surfaces: `onAssistantMessage`, `onToolResult`, streaming deltas, usage, run errors
- canonical source patterns from this repo:
  - `SystemPromptDrivenSource`
  - `AOTUIDrivenSource`
  - `HostDrivenSourceV2`
  - `IMDrivenSource`
- host-side session composition that shows how the driver is embedded in a real app

## Out of Scope

- DesktopManager internals and app installation lifecycle
- GUI rendering logic
- database schema design outside the message/session layer
- Model registry UI and provider settings screens
- MCP and skill source implementations themselves
- AOTUI app business logic executed behind runtime operations

## Entry Points

- Package entry: `agent-driver-v2/src/index.ts`
- Core class: `agent-driver-v2/src/core/agent-driver-v2.ts`
- Core protocol: `agent-driver-v2/src/core/interfaces.ts`
- Runtime adapter example: `runtime/src/adapters/aotui-driven-source.ts`
- Host composition example: `host/src/core/session-manager-v3.ts`

## Source Project Assumptions

- TypeScript ESM project running on Node
- Vercel AI SDK v6 message/tool model
- Provider packages resolved at build time (`@ai-sdk/openai`, `@ai-sdk/anthropic`, and peers)
- Event-driven host that can persist messages and react to source updates
- Tool owners can implement `executeTool` and publish follow-up updates after side effects land

## Target Project Assumptions

- Best fit target: TypeScript/Node host using AI SDK v6 or an equivalent abstraction
- If the target does not use AI SDK v6 message/tool shapes, rewrite the provider bridge and message protocol layer first
- The target must provide at least one persistent history source and one system/state source
- The target must own final persistence and user-visible rendering; `agent-driver-v2` emits messages but does not store them itself

## Non-Goals For Migration

- Do not migrate every host service from this repo.
- Do not copy AOTUI-specific source code if the target has no desktop/kernel concept.
- Do not treat `SessionManagerV3` as portable infrastructure; it is a reference composition, not a drop-in dependency.
