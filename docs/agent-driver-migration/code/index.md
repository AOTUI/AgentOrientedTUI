# Code Bundle Index

| Bundle | Purpose | Portability | Notes |
| --- | --- | --- | --- |
| [agent-driver-v2](agent-driver-v2/index.md) | Core driver package, public contracts, provider bridge, and tests | `portable` + `adapt` | Highest-priority bundle for migration |
| [runtime](runtime/index.md) | AOTUI-specific driven-source adapter and default system instruction | `adapt` | Use only if target has desktop/view/tool state |
| [host](host/index.md) | Host-side history sources, compaction patterns, and session composition example | `adapt` + `rewrite` | Keep patterns, rewrite orchestration |

## Deliberate Omissions

- build artifacts from `dist/`
- MCP and skill source implementations
- unrelated host GUI code

Those parts are not required to understand or transplant the `agent-driver-v2` feature itself.
