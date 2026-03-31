# Risks And Verification

## Risks

| Risk | Why It Matters | Mitigation |
| --- | --- | --- |
| Provider layer assumes AI SDK v6 | `LLMClient` and `provider-factory` are tightly shaped around AI SDK v6 contracts | keep AI SDK v6, or rewrite provider bridge before moving sources |
| Tool protocol continuity is easy to break | orphan tool results or reordered tool messages can produce invalid model history | preserve `collectMessages()` normalization and keep core tests |
| Source update timing is part of correctness | the driver expects sources to emit a new update after tool side effects land | document this in every source implementation and integration test it |
| Session orchestration is host-specific | `SessionManagerV3` touches desktop manager, DB, config, source controls, and GUI events | treat it as reference architecture, not reusable code |
| AOTUI source is runtime-specific | `AOTUIDrivenSource` depends on desktop snapshots, kernel operations, and system instruction conventions | port only if the target also has a desktop/view/tool runtime |
| Context compaction changes history semantics | host/IM sources insert compaction anchors and summarize old tool outputs | keep compaction optional until the basic loop is proven |
| Duplicate update storms can waste model calls | sources may emit many updates rapidly | preserve debounce + input signature skip logic |

## Verification Evidence From This Repository

Local command run on March 31, 2026:

```bash
pnpm -C agent-driver-v2 test --run
```

Observed result:

- `tests/core/agent-driver-v2.test.ts`: passed
- `tests/core/state-machine.test.ts`: 4 failures
- overall: 12 passed, 4 failed, 1 skipped

What the failures tell us:

- current state-machine tests implicitly drive the real LLM call path
- without `OPENAI_API_KEY` or an injected fake provider, those tests fall into provider bootstrap errors
- some assertions race the async run loop and observe `thinking` before the driver settles back to `idle`

Migration implication:

- treat the passing core tests as contract references
- do not copy the failing state-machine tests without also fixing their test harness or injecting a fake `LLMClient`

## Verification Checklist

- [ ] `IDrivenSource` contract is preserved in the target repo
- [ ] messages are sorted by timestamp before LLM invocation
- [ ] orphan tool results are dropped or normalized safely
- [ ] tool-to-source mapping routes each tool call to exactly one owner
- [ ] `onAssistantMessage` persists final assistant output in the target host
- [ ] `onToolResult` persists tool results in the target host
- [ ] source updates after tool execution trigger a fresh run
- [ ] provider API key resolution is explicit in the target environment
- [ ] streaming callbacks behave correctly when enabled
- [ ] if compaction is adopted, anchor messages preserve continuation semantics

## Recommended Additional Tests In The Target Project

- fake-provider integration test for the full run loop
- tool-call round trip test with at least two sources exposing distinct tools
- duplicate-update coalescing test
- pause/resume behavior test
- compaction continuity test if long-session support matters
