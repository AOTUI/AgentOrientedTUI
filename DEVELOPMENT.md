# AOTUI Development Guide

This guide is for contributors who want to work inside the AOTUI monorepo.

It has two jobs:

- explain how the system is split across packages
- show where to start for common development tasks

If you are looking for the product overview, start with [README.md](./README.md). If you want a deeper architecture walkthrough, also read [docs/runtime-sdk-driven-source-analysis.md](./docs/runtime-sdk-driven-source-analysis.md).

## Development Overview

### System Map

AOTUI is easiest to understand as a layered system:

```txt
Host -> Agent Driver -> Runtime -> SDK -> Apps
```

- `host/` is the product shell: Electron desktop app, GUI, local services, app installation, and integration surfaces.
- `agent-driver-v2/` is the agent execution layer: LLM calls, streaming, multi-source message aggregation, and tool orchestration.
- `runtime/` is the work layer: app lifecycle, worker isolation, view exposure, operation dispatch, and runtime-to-agent adapters.
- `sdk/` is the developer-facing app model: `createTUIApp`, views, tools, hooks, refs, and the component surface app authors use.
- `demo-apps/` contains reference and system apps built on top of the SDK and runtime.

### Package Relationships

The dependency direction matters:

- `sdk` depends on `runtime`
- `runtime` depends on `agent-driver-v2`
- `host` depends on all three
- `demo-apps/*` depend on `sdk` and run inside `host`

That means:

- if you are changing app authoring APIs, start in `sdk`
- if you are changing execution, isolation, or runtime exposure, start in `runtime`
- if you are changing LLM orchestration or tool dispatch behavior, start in `agent-driver-v2`
- if you are changing product UX, installation flow, or desktop integration, start in `host`

## Core Packages

### Agent Driver (`@aotui/agent-driver-v2`)

**Role**

The Agent Driver is the execution layer between model providers and the rest of the system. It owns multi-source message aggregation, LLM streaming, provider selection, and tool call orchestration.

**When to touch it**

- change the main agent loop
- add or adjust model provider integrations
- change tool dispatch or tool-result handling
- change message aggregation behavior before prompts hit the model

**Key dependencies**

- `ai` / Vercel AI SDK for provider abstraction and streaming
- provider packages such as `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`
- `zod-to-json-schema` for tool schema generation

**Key entry points**

- [`agent-driver-v2/src/index.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/agent-driver-v2/src/index.ts)
- [`agent-driver-v2/src/core/agent-driver-v2.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/agent-driver-v2/src/core/agent-driver-v2.ts)
- [`agent-driver-v2/src/core/llm-client.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/agent-driver-v2/src/core/llm-client.ts)
- [`agent-driver-v2/src/core/provider-factory.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/agent-driver-v2/src/core/provider-factory.ts)
- [`agent-driver-v2/src/core/interfaces.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/agent-driver-v2/src/core/interfaces.ts)

**Common commands**

```bash
pnpm --filter ./agent-driver-v2 build
pnpm --filter ./agent-driver-v2 test
pnpm --filter ./agent-driver-v2 dev
```

### Runtime (`@aotui/runtime`)

**Role**

The Runtime is the AOTUI execution core. It owns worker isolation, kernel creation, runtime facades, app lifecycle, CLI surfaces, and the adapter layer that exposes the runtime as an agent-usable work surface.

**When to touch it**

- change worker lifecycle or app sandboxing
- change kernel behavior or operation dispatch
- change how runtime state is exposed to agents
- change CLI installation / app catalog behavior
- change runtime SPI contracts or adapters

**Key dependencies**

- Node.js Worker Threads for app isolation
- `linkedom` and `preact` for worker-side rendering and DOM-like execution
- `happy-dom` for test-time DOM simulation
- `zod` for runtime configuration validation

**Key entry points**

- [`runtime/src/index.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/index.ts)
- [`runtime/src/factory/createKernel.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/factory/createKernel.ts)
- [`runtime/src/kernel/index.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/kernel/index.ts)
- [`runtime/src/worker-runtime/index.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/worker-runtime/index.ts)
- [`runtime/src/adapters/aotui-driven-source.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/adapters/aotui-driven-source.ts)
- [`runtime/src/cli.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/cli.ts)

**Common commands**

```bash
pnpm --filter ./runtime build
pnpm --filter ./runtime test
pnpm --filter ./runtime dev
```

### SDK (`@aotui/sdk`)

**Role**

The SDK is the developer-facing programming model for AOTUI apps. It gives app authors the primitives for declaring views, tools, refs, hooks, and state with a component-driven API.

**When to touch it**

- change `createTUIApp()` behavior
- add or refine developer-facing hooks
- change view / operation declaration ergonomics
- change ref resolution or argument validation at the app API layer
- improve app authoring experience without changing runtime internals

**Key dependencies**

- `preact` for the component model
- `@preact/signals` for fine-grained reactive state
- `linkedom` for DOM support inside worker-rendered apps
- `@aotui/runtime` as the execution substrate

**Key entry points**

- [`sdk/src/index.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/index.ts)
- [`sdk/src/app-factory/createTUIApp.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/app-factory/createTUIApp.ts)
- [`sdk/src/components/View.tsx`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/components/View.tsx)
- [`sdk/src/hooks/index.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/hooks/index.ts)
- [`sdk/src/operation/types.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/operation/types.ts)
- [`sdk/src/ref-registry.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/ref-registry.ts)

**Common commands**

```bash
pnpm --filter ./sdk build
pnpm --filter ./sdk test
pnpm --filter ./sdk lint
```

### Toolchain

These tools support the workflow across all packages:

- TypeScript 5 for the monorepo type system
- `pnpm` workspaces for package management
- `vitest` for unit and integration testing
- `tsc` / `esbuild` / Vite for compilation and app builds
- Electron + `electron-builder` for desktop packaging
- `npm link` and the `agentina` CLI for local app installation and host integration

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18 or higher
- **pnpm**: package manager
- **Git**: version control

## Development Workflows

### Quick Start

#### Option 1: Automated setup

```bash
chmod +x setup.sh run.sh
./setup.sh
./run.sh
```

#### Option 2: Manual setup

1. Install dependencies:

```bash
pnpm install
```

2. Build packages in dependency order:

```bash
pnpm --filter ./runtime build
pnpm --filter ./sdk build
pnpm --filter ./agent-driver-v2 build
pnpm --filter ./host build
```

3. Link the host CLI:

```bash
cd host
npm link
cd ..
agentina --version
```

4. Link local apps:

```bash
cd demo-apps/aotui-ide && npm link && cd ../..
cd demo-apps/planning-app && npm link && cd ../..
cd demo-apps/terminal-app && npm link && cd ../..
cd demo-apps/token-monitor-app && npm link && cd ../..

cd host
npm link aotui-ide
npm link planning-app
npm link terminal-app
npm link token-monitor-app
cd ..
```

5. Start the Electron app:

```bash
cd host
pnpm electron:dev
```

### Build Commands

```bash
pnpm --filter ./runtime build
pnpm --filter ./sdk build
pnpm --filter ./agent-driver-v2 build
pnpm --filter ./host build
pnpm -r build
```

### Test Commands

```bash
pnpm --filter ./runtime test
pnpm --filter ./sdk test
pnpm --filter ./agent-driver-v2 test
pnpm --filter ./host test
pnpm -r test
```

### Watch / Iteration Loop

For active development across the core stack:

```bash
# Terminal 1
pnpm --filter ./runtime dev

# Terminal 2
pnpm --filter ./agent-driver-v2 dev

# Terminal 3
cd host && pnpm electron:dev
```

If you are also changing app code, run the app-specific watcher in another terminal.

## Common Tasks

### I want to change agent orchestration

Start in [`agent-driver-v2/src/core/agent-driver-v2.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/agent-driver-v2/src/core/agent-driver-v2.ts) and [`agent-driver-v2/src/core/llm-client.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/agent-driver-v2/src/core/llm-client.ts). This is the right layer for prompt assembly, provider routing, streaming, and tool-call execution behavior.

### I want to change runtime / view exposure behavior

Start in [`runtime/src/adapters/aotui-driven-source.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/adapters/aotui-driven-source.ts), [`runtime/src/factory/createKernel.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/factory/createKernel.ts), and the `runtime/src/kernel/` subtree. This is the right layer for app lifecycle, state exposure, operation routing, and runtime-to-agent integration.

### I want to change SDK developer APIs

Start in [`sdk/src/app-factory/createTUIApp.ts`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/app-factory/createTUIApp.ts), [`sdk/src/components/View.tsx`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/components/View.tsx), and [`sdk/src/hooks/`](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/hooks/index.ts). This is the right layer for app authoring ergonomics and view/tool declaration APIs.

### I want to add a new app

Create a new folder under `demo-apps/`, export a `createTUIApp()` app factory from `src/index.ts`, generate `aoapp.json` during build, then link the package into `host`.

Minimal structure:

```txt
demo-apps/my-app/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── tui/
│   └── core/
└── test/
```

Example app definition:

```ts
export default createTUIApp({
  app_name: "my_app",
  component: MyApp,
  whatItIs: "Describe what the app is",
  whenToUse: "Describe when the agent should use it",
});
```

Build script example:

```json
{
  "scripts": {
    "build": "tsc && node ../../scripts/generate-aoapp.mjs ."
  }
}
```

Link flow:

```bash
cd demo-apps/my-app
pnpm build
npm link

cd ../../host
npm link my-app
```

### I want to debug host integration

Start in `host/src/` and run:

```bash
cd host
pnpm electron:dev
```

Use this layer when you are changing desktop UX, app installation flow, local persistence, IPC, HTTP surfaces, or app lifecycle wiring in the product shell.

## agentina CLI Commands

Once the `agentina` CLI is installed, these are the most useful commands:

```bash
agentina list
agentina link <app-name>
agentina info <app-name>
agentina unlink <app-name>
agentina --version
```

## Troubleshooting

### pnpm not found

```bash
npm install -g pnpm
```

### agentina command not found after installation

Reload your shell:

```bash
source ~/.zshrc
```

Or restart your terminal.

### Build errors

Rebuild in dependency order:

```bash
pnpm --filter ./runtime build
pnpm --filter ./sdk build
pnpm --filter ./agent-driver-v2 build
pnpm --filter ./host build
```

### App not appearing in host

Verify the package is linked into `host`:

```bash
cd host
npm list --depth=0 | grep <app-name>
```

If it is missing, link it again with `npm link <app-name>`.
