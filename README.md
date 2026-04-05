# Agentina

An all-in-one platform for building and managing AI Agents. The core idea is to empower agents through **[Agent Apps](https://agentina-agent-apps.vercel.app/en)** — unleashing AI productivity through applications, while keeping agents safely contained.

[中文README](./README.zh-CN.md)

## Features

- **Model Provider** — Integrates with major LLM providers (OpenAI, Claude, Gemini, DeepSeek, Grok, OpenRouter)
- **Agent Apps** — Pre-installed system apps; agents perceive and operate them via TUI snapshots
  - `terminal` — Shell terminal, execute commands
  - `lite-browser` — Lightweight browser, extract web page content
  - `aotui-ide` — Code IDE, read and edit files
  - `planning` — Planning and task management
  - `token-monitor` — Token usage monitoring
- **Skills** — Extensible agent skill plugins
- **MCP** — Model Context Protocol integration for external tools
- **IM Integration**
  - Single-agent chat
  - Supported channels: Feishu / Lark

## Upcoming

- Agent Teams (multi-agent collaboration)
- More IM channels: Telegram, Discord
- Multi-agent group chat
- Agent memory management
- Continuous improvements to SDK / Runtime / AgentDriver

## Project Structure

```
AgentOrientedTUI/
├── host/              # Product layer: Electron desktop app + GUI + HTTP server
├── agent-driver-v2/   # Agent driver: LLM calls, tool orchestration, multi-source message aggregation
├── runtime/           # Core runtime: Worker isolation, TUI snapshot engine, Operation dispatch
├── sdk/               # Developer SDK: Preact-based component library for building TUI apps
└── demo-apps/         # System/demo apps kept outside the core packages
    ├── aotui-ide/         # System App: Code IDE
    ├── terminal-app/      # System App: Terminal
    ├── lite-browser-app/  # System App: Lite browser
    ├── planning-app/      # System App: Planning manager
    └── token-monitor-app/ # System App: Token monitor
```

## Preview

### Chat
![chat](resource/image/preview.gif)

### Agent Management
![agent](resource/image/agent-management.png)

### Model Provider Management
![provider](resource/image/model-provider.png)

### Prompt Management
![prompt](resource/image/prompt.png)

### Agent Apps
![agent-apps](resource/image/apps.png)

### Skills
![skills](resource/image/skills.png)

### MCP
![MCP](resource/image/mcp.png)

### IM Integration
![IM](resource/image/IM.png)

## Architecture At A Glance

The monorepo is split into a few core layers:

- `host/` — Electron product shell, GUI, local persistence, IPC, HTTP surfaces, app installation
- `agent-driver-v2/` — LLM calls, provider routing, multi-source aggregation, tool orchestration
- `runtime/` — app lifecycle, worker isolation, runtime exposure, view / operation dispatch
- `sdk/` — developer-facing app model for views, tools, refs, hooks, and state
- `demo-apps/` — reference and system apps built on top of the SDK and runtime

For package responsibilities, entry points, build order, and contributor workflows, see [DEVELOPMENT.md](./DEVELOPMENT.md).
