# AOTUI Repository Guide

> Experimental project. This repository is for research, prototyping, and internal exploration. It is not production-ready and should not be used as-is in production environments.

`GUIDE.md` is the functional companion to [README.md](./README.md).

- `README.md` explains the idea and the interface model.
- `GUIDE.md` explains the repository layout, architecture, stack, and local development flow.

If you want a deeper source-level walkthrough after this file, read [docs/runtime-sdk-driven-source-analysis.md](./docs/runtime-sdk-driven-source-analysis.md).

## Repository At A Glance

The main stack is:

```txt
Host -> Runtime -> SDK -> Apps
        ^
        |
   Agent Driver
```

- `host/` is the desktop product shell and GUI.
- `runtime/` is the execution core that manages apps, views, workers, and the CLI.
- `sdk/` is the app authoring layer used to build AOTUI apps.
- `agent-driver-v2/` is the model execution and tool orchestration layer used by the runtime and host.
- `demo-apps/` contains apps that exercise the SDK/runtime stack inside the host.

Dependency direction in the codebase is:

- `runtime` depends on `agent-driver-v2`
- `sdk` depends on `runtime`
- `host` depends on `agent-driver-v2`, `runtime`, and `sdk`
- most `demo-apps/*` depend on `sdk`; some also rely on `runtime` at local-dev link time

Manual build order:

```txt
agent-driver-v2 -> runtime -> sdk -> host -> demo-apps
```

## Top-Level Folders

| Folder | What it is for |
| --- | --- |
| `agent-driver-v2/` | LLM execution layer: provider setup, streaming, message aggregation, and tool-call orchestration. |
| `runtime/` | Core execution substrate: app registry, app lifecycle, worker runtime, kernel, view exposure, and the `agentina` CLI. |
| `sdk/` | Developer-facing app API: `createTUIApp`, `View`, hooks, refs, and operation types used by app authors. |
| `host/` | Electron desktop shell plus web UI, local services, and product integration points. |
| `demo-apps/` | Reference apps that run on the stack. The setup scripts auto-install `aotui-ide`, `terminal-app`, and `lite-browser-app` by default. |
| `scripts/` | Repo-level helper scripts such as `generate-aoapp.mjs`, which writes app manifests during app builds. |
| `resource/` | Static assets used by the project. |

Notes:

- the root `package.json` does not define shared `scripts`, so you usually run commands with `pnpm -C <folder> ...` or use the root shell scripts
- `pnpm-workspace.yaml` currently covers `packages/*`; the main app/runtime folders are managed as sibling packages rather than through root workspace scripts

## Architecture

### Layered View

Think in five layers:

1. **Host**
   The Electron application and GUI that users interact with locally. It packages the product, renders the main interface, and wires together local services and runtime integration.
2. **Runtime**
   The work layer. It owns app loading, app registry, view/state exposure, worker isolation, kernels, adapters, and the `agentina` CLI.
3. **SDK**
   The app authoring model. It provides `createTUIApp()`, component primitives, hooks, refs, and typed operations for building agent-facing apps.
4. **Apps**
   Concrete system or demo apps built with the SDK and executed through the runtime/host stack.
5. **Agent Driver**
   A shared execution subsystem that handles provider selection, prompt/message preparation, streaming, and tool orchestration for model-driven behavior.

### Responsibility Boundaries

- `agent-driver-v2/`: model loop, provider wiring, streaming, tool dispatch
- `runtime/`: app lifecycle, workers, view exposure, CLI, adapters
- `sdk/`: app-authoring APIs and ergonomics
- `host/`: Electron shell, GUI, IPC, install flow, local services
- `demo-apps/`: app behavior built on the shared stack

### Key Entry Points

- Agent driver: `agent-driver-v2/src/core/agent-driver-v2.ts`, `agent-driver-v2/src/core/llm-client.ts`
- Runtime: `runtime/src/factory/createKernel.ts`, `runtime/src/kernel/index.ts`, `runtime/src/cli.ts`
- SDK: `sdk/src/app-factory/createTUIApp.ts`, `sdk/src/components/View.tsx`
- Host: `host/src/`
- App manifests: `scripts/generate-aoapp.mjs`

## Tech Stack

Core stack:

- **Language**: TypeScript across the core packages and apps
- **Package management**: `pnpm`
- **Runtime / platform**: Node.js, Electron, Worker Threads
- **UI**:
  - `host/` uses React 19, Vite, Tailwind CSS 4, and related UI libraries
  - `sdk/` and app-side authoring center on Preact
- **Agent / model integration**: Vercel AI SDK (`ai`) and provider packages such as `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/xai`
- **Validation / schemas**: `zod`, `zod-to-json-schema`
- **Testing**: `vitest` across most packages; `demo-apps/aotui-ide` currently uses `jest`
- **Build tooling**: `tsc`, Vite, `electron-builder`
- **DOM simulation / rendering helpers**: `linkedom`, `happy-dom`, `preact-render-to-string`
- **CLI / app distribution helpers**: `agentina`, `npm link`, and generated `aoapp.json` manifests

### Stack By Layer

| Layer | Main technologies |
| --- | --- |
| `host/` | Electron, React 19, Vite, Tailwind CSS 4, TRPC, Express, SQLite-related tooling |
| `runtime/` | Node.js, Worker Threads, Preact, `linkedom`, `happy-dom`, `zod` |
| `sdk/` | TypeScript, Preact, `@preact/signals`, `linkedom` |
| `agent-driver-v2/` | Vercel AI SDK (`ai`), OpenAI / Anthropic / Google / xAI / OpenRouter provider packages |
| `demo-apps/` | TypeScript + SDK-based app packages; mostly Preact-powered app definitions |

### Why This Stack Looks Like This

This stack is opinionated. It is optimized for an agent-facing desktop runtime, not for a conventional web SaaS app.

- **Electron in `host/`** keeps the product local-first. The host needs desktop integration, local persistence, app installation, and process-level control that a browser-only shell would make harder.
- **Node.js + Worker Threads in `runtime/`** separate app execution from the host shell. That matters because apps are not just UI fragments here; they are active runtime participants that expose views, refs, and operations to the agent.
- **Preact in `sdk/` and runtime-facing app code** keeps the app model component-based without paying the full weight of a larger client framework inside worker-rendered app execution.
- **React in `host/`** is a separate choice from Preact in the app layer. The host is a conventional GUI product surface, while the SDK is an embedded app-authoring surface. They solve different problems, so the stack intentionally splits here.
- **Vercel AI SDK and provider adapters in `agent-driver-v2/`** give the project one abstraction point for multi-model support, streaming, and tool-call execution. That keeps provider churn out of the rest of the runtime.
- **`zod` and JSON-schema tooling** matter because the system has to expose typed tool surfaces and runtime contracts reliably across host, runtime, apps, and model-facing execution.

### Trade-Offs

This stack also carries real trade-offs:

- **Two UI stacks** means some conceptual overhead. React in the host and Preact in the SDK is deliberate, but it increases mental context for contributors.
- **Worker-based isolation** improves boundaries and safety, but it makes debugging, dependency wiring, and snapshot consistency harder than a single-process app model.
- **Desktop-first architecture** makes local tooling and stateful workflows easier, but it also means the system is not optimized for straightforward web deployment.
- **Provider abstraction** speeds up model experimentation, but it can hide provider-specific behavior until you are deep in debugging or tool-call edge cases.

In practice, the stack is trying to balance four goals at once:

- desktop product ergonomics
- isolated app execution
- declarative app authoring
- model/provider flexibility

That balance is why the repository looks layered rather than minimal.

## Prerequisites

You need:

- **Node.js** installed
- **pnpm** installed
- **Git** installed

Use a recent enough Node.js version to run Electron, Vite, and current TypeScript tooling.

## How To Run

### Recommended Path: Repository Scripts

Fastest path:

```bash
chmod +x setup.sh run.sh
./setup.sh
./run.sh
```

What they do:

- `setup.sh`
  - installs dependencies package by package
  - links local core packages into dependent folders for local development
  - builds the core packages in dependency order
  - globally links the `agentina` CLI from `runtime/`
  - builds and registers the default apps (`aotui-ide`, `terminal-app`, and `lite-browser-app`) with `agentina link .`
- `run.sh`
  - refreshes local links
  - rebuilds the core packages and the default apps
  - starts the host in Electron development mode via `pnpm -C host electron:dev`


## Useful Commands

### `agentina` CLI

Current CLI surface from `runtime/src/cli.ts`:

```bash
agentina install <source>
agentina search [query]
agentina link <path>
agentina remove <name>
agentina uninstall <name>
agentina list
agentina enable <name>
agentina disable <name>
agentina autostart <name> <on|off>
agentina run [name]
agentina --version
```

## Common Development Paths

### I want to change model orchestration

- `agent-driver-v2/src/core/agent-driver-v2.ts`
- `agent-driver-v2/src/core/llm-client.ts`
- `agent-driver-v2/src/core/provider-factory.ts`

### I want to change runtime state, views, or app execution

- `runtime/src/adapters/aotui-driven-source.ts`
- `runtime/src/factory/createKernel.ts`
- `runtime/src/kernel/`
- `runtime/src/worker-runtime/`

### I want to change app authoring APIs

- `sdk/src/app-factory/createTUIApp.ts`
- `sdk/src/components/View.tsx`
- `sdk/src/hooks/`

### I want to change the desktop product

- `host/src/`

Use this layer for GUI work, desktop UX, settings, installation flow, IPC wiring, and local services.

### I want to add a new app

Use an existing `demo-apps/*` package as the template. Apps outside the default install set can still be linked manually. The current app build pattern is:

- export a `createTUIApp(...)` app factory from the app entry
- compile with `tsc`
- generate `aoapp.json` with `node ../../scripts/generate-aoapp.mjs .`
- register the app locally with `agentina link <path>`

## Troubleshooting

### `pnpm` is missing

```bash
npm install -g pnpm
```

### `agentina` is not found after `npm link`

Reload your shell config or open a new terminal:

```bash
source ~/.zshrc
```

### A build fails after changing shared packages

Rebuild from the bottom of the dependency graph upward:

```bash
pnpm -C agent-driver-v2 build
pnpm -C runtime build
pnpm -C sdk build
pnpm -C host build
```

### A demo app does not appear in the host

Check whether it is registered:

```bash
agentina list
```

If needed, re-register it:

```bash
agentina remove <app-name>
agentina link ./demo-apps/<app-folder>
```

## Further Reading

- [README.md](./README.md): project idea and interface model
- [README.zh-CN.md](./README.zh-CN.md): Chinese version of the main README
