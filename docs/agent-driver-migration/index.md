# agent-driver-v2 Migration Package

> Purpose: Help another team migrate `agent-driver-v2` and its canonical driven-source integration pattern into a different TypeScript/Node project without relying on source-repo tribal knowledge.

## Package Contents

- [01-feature-overview.md](01-feature-overview.md)
- [02-user-journeys.md](02-user-journeys.md)
- [03-module-map.md](03-module-map.md)
- [04-data-flow.md](04-data-flow.md)
- [05-migration-plan.md](05-migration-plan.md)
- [06-risks-and-verification.md](06-risks-and-verification.md)
- [code/index.md](code/index.md)
- [agent-driver-driven-source-migration-report.md](agent-driver-driven-source-migration-report.md) - older deep-dive notes kept as supplemental context

## Reading Order

1. Read [01-feature-overview.md](01-feature-overview.md) to understand scope, non-goals, and target assumptions.
2. Read [02-user-journeys.md](02-user-journeys.md) and [04-data-flow.md](04-data-flow.md) to understand runtime behavior.
3. Read [03-module-map.md](03-module-map.md) to decide which units are `portable`, `adapt`, or `rewrite`.
4. Read [05-migration-plan.md](05-migration-plan.md) before copying code.
5. Use [code/index.md](code/index.md) as the implementation reference package.

## Fast Path

If the target project already uses TypeScript, Node, and Vercel AI SDK v6, start with:

1. [03-module-map.md](03-module-map.md)
2. [05-migration-plan.md](05-migration-plan.md)
3. [code/agent-driver-v2/index.md](code/agent-driver-v2/index.md)
4. [code/runtime/index.md](code/runtime/index.md) or [code/host/index.md](code/host/index.md), depending on which source pattern you need

## Migration Intent

This package treats `agent-driver-v2` as a feature, not just a library folder. In this repository the feature consists of:

- the core multi-source driver package
- the `IDrivenSource` contract that all producers must satisfy
- at least one system-prompt source, one state/history source, and optional compaction sources
- host/runtime composition patterns that prove how the driver is meant to be embedded

That is why the package includes `agent-driver-v2`, `runtime`, and `host` bundles instead of only the npm package source.
