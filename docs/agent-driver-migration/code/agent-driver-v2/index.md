# Bundle Guide

## Why This Bundle Exists

This bundle is the portable heart of the feature. It defines the driver contract, the run loop, the provider/bootstrap layer, and the regression tests that protect message ordering and tool routing semantics.

## Included Files

- `README.md`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `src/index.ts`
- `src/core/interfaces.ts`
- `src/core/agent-driver-v2.ts`
- `src/core/llm-client.ts`
- `src/core/provider-factory.ts`
- `src/utils/debounce.ts`
- `src/utils/logger.ts`
- `tests/core/agent-driver-v2.test.ts`
- `tests/core/state-machine.test.ts`

## Source Origins

- `/agent-driver-v2/*`

## Contracts

- Inputs:
  - `IDrivenSource[]`
  - `LLMConfig`
  - host callbacks for assistant/tool/usage/error events
- Outputs:
  - assistant `ModelMessage`
  - tool `ModelMessage`
  - streaming delta callbacks
  - usage and state notifications
- Config:
  - model/provider/apiKey
  - debounce and tool timeout
- Storage:
  - none inside the package
- Events:
  - `onUpdate` from sources
  - `onAssistantMessage`, `onToolResult`, `onStateChange`, `onRunError`

## Dependencies

- Upstream:
  - `ai` SDK v6 message/tool types and `streamText`
  - provider SDK packages
  - source implementations owned by the host/runtime
- Downstream:
  - host persistence and rendering layer
  - source-specific tool execution
- External systems:
  - provider API endpoints and API keys

## Migration Guidance

- Can stay unchanged:
  - `interfaces.ts`
  - most of `agent-driver-v2.ts`
  - `debounce.ts`, `logger.ts`
- Must be adapted:
  - `llm-client.ts` and `provider-factory.ts` if the target does not use AI SDK v6
  - package metadata if target build tooling differs
- Can be rewritten cleanly:
  - state-machine tests that currently depend on live provider bootstrap

## Verification

- Run the core tests after replacing or configuring the provider layer.
- Confirm one end-to-end cycle: source update -> assistant message -> tool result -> new source update.
