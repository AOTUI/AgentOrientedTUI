# Agentina

一站式 Agent 搭建和管理平台。核心理念是通过 **[Agent Apps](https://agentina-agent-apps.vercel.app/en)** 构建智能体——用应用来释放 AI Agent 的生产力，同时将其安全地关在笼子里。


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
└── demo-apps/         # 系统 / demo App 目录，和核心包分开
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

## 架构一览

这个 monorepo 主要分成几层：

- `host/` — Electron 产品壳、GUI、本地持久化、IPC、HTTP 能力、应用安装
- `agent-driver-v2/` — LLM 调用、Provider 路由、多消息源聚合、Tool 编排
- `runtime/` — 应用生命周期、Worker 隔离、运行时暴露、View / Operation 调度
- `sdk/` — 面向开发者的 app 编程模型，负责 View、Tool、Ref、Hook 和状态
- `demo-apps/` — 基于 SDK 和 Runtime 构建的系统应用与参考应用

如果你想看包职责、代码入口、构建顺序和贡献者工作流，请直接看 [DEVELOPMENT.md](./DEVELOPMENT.md)。
