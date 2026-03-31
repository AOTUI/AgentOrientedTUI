# Bundle Guide

## Why This Bundle Exists

This bundle shows how the driver is embedded in a real host application: persisted history sources, compaction tools, system prompt injection, IM-specific session handling, and host-side orchestration.

## Included Files

- `src/adapters/host-driven-source.ts`
- `src/adapters/system-prompt-source.ts`
- `src/core/message-service-v2.ts`
- `src/core/session-manager-v3.ts`
- `src/core/host-manager-v2.ts`
- `src/im/im-driven-source.ts`

## Source Origins

- `/host/src/adapters/*`
- `/host/src/core/*`
- `/host/src/im/*`

## Contracts

- Inputs:
  - persisted host/IM messages
  - system prompt text
  - desktop manager + kernel + config services
- Outputs:
  - `MessageWithTimestamp[]`
  - host compaction tool results
  - composed sessions that wire callbacks to persistence and GUI events
- Config:
  - topic/session-specific LLM config
  - compaction policy
  - source enable/disable controls
- Storage:
  - host DB-backed message/session stores
- Events:
  - GUI updates
  - IM dispatch events
  - source control toggles

## Dependencies

- Upstream:
  - core `agent-driver-v2` package
  - host DB/config/project services
  - AOTUI runtime and desktop manager
- Downstream:
  - GUI session views
  - IM session dispatch
- External systems:
  - provider config and any session persistence backend

## Migration Guidance

- Can stay unchanged:
  - `SystemPromptDrivenSource`
  - the idea of exposing history/compaction as a source
- Must be adapted:
  - `HostDrivenSourceV2` if your persistence model differs
  - `IMDrivenSource` if your thread/session semantics differ
- Can be rewritten cleanly:
  - `SessionManagerV3` and `HostManagerV2`, which are tightly coupled to this repo’s desktop/config/database stack

## Verification

- Confirm assistant/tool callbacks persist messages in the target host.
- Confirm compaction preserves continuation semantics if you port it.
- Confirm session lifecycle can create, pause, resume, and dispose driver instances safely.
