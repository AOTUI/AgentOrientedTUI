# Bundle Guide

## Why This Bundle Exists

This bundle shows how to adapt a rich runtime environment into `IDrivenSource`. It is the best reference if the target project has a notion of live application state plus executable operations.

## Included Files

- `src/adapters/index.ts`
- `src/adapters/aotui-driven-source.ts`
- `src/adapters/aotui-driven-source.test.ts`
- `src/adapters/system-instruction.ts`

## Source Origins

- `/runtime/src/adapters/*`

## Contracts

- Inputs:
  - desktop snapshots
  - kernel operations
  - optional instruction override/path/env
- Outputs:
  - timestamped runtime messages
  - tool definitions converted from runtime operations
  - tool execution results
- Config:
  - `AOTUIDrivenSourceOptions`
- Storage:
  - none, reads live runtime state
- Events:
  - emits update listeners when app/runtime state changes

## Dependencies

- Upstream:
  - `IDesktop`, `IKernel`, operation schemas
  - `IDrivenSource` from the core package
- Downstream:
  - `AgentDriverV2`
- External systems:
  - none directly, but tightly coupled to AOTUI runtime concepts

## Migration Guidance

- Can stay unchanged:
  - high-level adapter shape
  - the idea of injecting a fixed system instruction plus dynamic state
- Must be adapted:
  - snapshot extraction, operation catalog traversal, and executeTool implementation
  - instruction text if the target runtime is not AOTUI
- Can be rewritten cleanly:
  - any AOTUI-specific markup conventions if the target runtime uses a different state representation

## Verification

- Confirm `getMessages()` produces deterministic state messages.
- Confirm `getTools()` exposes only currently allowed operations.
- Confirm `executeTool()` mutates runtime state and later emits an update.
