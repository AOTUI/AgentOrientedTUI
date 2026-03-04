# Agentina

一站式 Agent 搭建和管理平台。核心理念是通过 **Agent Apps** 构建智能体——用应用来释放 AI Agent 的生产力，同时将其安全地关在笼子里。


## Feature

- **Model Provider** — 可接入主流大模型提供商（OpenAI、Claude、Gemini、DeepSeek、Grok、OpenRouter）
- **Agent Apps** — 系统预装应用，Agent 通过 TUI 快照感知和操作应用
  - `terminal` — 终端，执行命令
  - `lite-browser` — 精简浏览器，网页内容提取
  - `aotui-ide` — 代码 IDE，文件阅读与编辑
  - `planning` — 规划与任务管理
  - `token-monitor` — Token 用量监控
- **Skills** — 可拓展的 Agent 技能插件
- **MCP** — Model Context Protocol 集成，对接外部工具
- **IM 接入**
  - 单智能体聊天
  - 已接入渠道：飞书/Lark

## Upcoming

- Agent Teams（多智能体协作）
- IM 多渠道接入：Telegram、Discord
- 多智能体群聊
- Agent 记忆管理
- SDK / Runtime / AgentDriver 持续优化

## 项目结构

```
AgentOrientedTUI/
├── host/              # 产品层：Electron 桌面应用 + GUI + HTTP 服务
├── agent-driver-v2/   # Agent 驱动：LLM 调用、工具编排、多消息源聚合
├── runtime/           # 核心运行时：Worker 隔离、TUI 快照引擎、Operation 调度
├── sdk/               # 开发者 SDK：基于 Preact 构建 TUI App 的组件库
├── aotui-ide/         # 系统 App：代码 IDE
├── terminal-app/      # 系统 App：终端
├── lite-browser-app/  # 系统 App：精简浏览器
├── planning-app/      # 系统 App：规划管理
└── token-monitor-app/ # 系统 App：Token 监控
```

## Agentina 预览

### 聊天
![chat](resource/image/preview.gif)

### 智能体管理
![agent](resource/image/agent-management.png)

### 大模型提供商管理
![provider](resource/image/model-provider.png)

### 提示词管理
![prompt](resource/image/prompt.png)

### Agent Apps
![agent-apps](resource/image/apps.png)

### Skills
![skills](resource/image/skills.png)

### MCP
![MCP](resource/image/mcp.png)

### IM 接入
![IM](resource/image/IM.png)

## 技术栈

### 产品层（Host）

| 技术 | 用途 |
|---|---|
| [Electron](https://www.electronjs.org/) v40 | 桌面应用壳，Node.js 主进程 |
| [React](https://react.dev/) 19 + [Vite](https://vitejs.dev/) 6 | GUI 界面 |
| [Tailwind CSS](https://tailwindcss.com/) 4 + [HeroUI](https://www.heroui.com/) | UI 组件库与样式系统 |
| [tRPC](https://trpc.io/) + electron-trpc | 类型安全的主进程/渲染进程 IPC |
| [Framer Motion](https://www.framer.com/motion/) | 动画效果 |
| [Express](https://expressjs.com/) | 本地 HTTP 服务（供 CLI 模式使用）|
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | 本地持久化数据库 |
| [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`) | 流式 Chat UI 组件（`@ai-sdk/react`）|
| [@larksuiteoapi/node-sdk](https://github.com/larksuite/node-oapi-sdk) | 飞书/Lark IM 接入 |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MCP 工具集成 |

### Agent Driver（`@aotui/agent-driver-v2`）

| 技术 | 用途 |
|---|---|
| [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`) | 统一 LLM 调用接口，流式输出，Tool Call 编排 |
| `@ai-sdk/openai` | OpenAI / Azure OpenAI |
| `@ai-sdk/anthropic` | Anthropic Claude |
| `@ai-sdk/google` | Google Gemini |
| `@ai-sdk/deepseek` | DeepSeek |
| `@ai-sdk/xai` | xAI Grok |
| `@openrouter/ai-sdk-provider` | OpenRouter（聚合多模型） |
| [Zod](https://zod.dev/) | Tool 参数 JSON Schema 生成与校验 |

### Runtime（`@aotui/runtime`）

| 技术 | 用途 |
|---|---|
| Node.js [Worker Threads](https://nodejs.org/api/worker_threads.html) | 每个 App 独立 Worker，沙箱隔离 |
| [linkedom](https://github.com/WebReflection/linkedom) | Worker 内虚拟 DOM，模拟浏览器环境 |
| [happy-dom](https://github.com/capricorn86/happy-dom) | 测试环境 DOM 模拟 |
| [Zod](https://zod.dev/) | Runtime 配置校验 |
| TypeScript 5（严格模式）| 类型安全的 SPI 契约层 |

### SDK（`@aotui/sdk`）

| 技术 | 用途 |
|---|---|
| [Preact](https://preactjs.com/) 10 | 轻量 UI 框架，在 Worker 内渲染 TUI 组件树 |
| [linkedom](https://github.com/WebReflection/linkedom) | Worker 内 DOM 操作支持 |

### 工具链

| 技术 | 用途 |
|---|---|
| TypeScript 5 | 全栈类型安全 |
| [pnpm](https://pnpm.io/) + Workspaces | Monorepo 包管理 |
| [Vitest](https://vitest.dev/) | 单元测试 / 集成测试 |
| [esbuild](https://esbuild.github.io/) / `tsc` | 构建编译 |
| [electron-builder](https://www.electron.build/) | 桌面应用打包（macOS / Windows / Linux）|

