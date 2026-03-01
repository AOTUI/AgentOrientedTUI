# RFC: Host 多 IM 对接集成方案

> **状态**: Draft  
> **作者**: AOTUI Team  
> **日期**: 2026-03-01  
> **准出条件**: 飞书 WebSocket 模式成功接入，Bot 可正常收发消息（含群聊流式卡片）

---

## 目录

- [零、开发原则：测试先行](#零开发原则测试先行)
- [一、背景与动机](#一背景与动机)
- [二、产品形态定义](#二产品形态定义)
- [三、架构设计](#三架构设计)
- [四、核心模块详设](#四核心模块详设)
- [五、飞书接入详设](#五飞书接入详设)
- [六、数据模型](#六数据模型)
- [七、迁移步骤](#七迁移步骤)
- [八、文件清单与命名规范](#八文件清单与命名规范)
- [九、风险与缓解](#九风险与缓解)
- [十、验收标准](#十验收标准)

---

## 零、开发原则：测试先行

> **硬性要求：写代码之前先写测试，代码完成后跑测试，全部通过才能准出。**

### 工作流

```
每个模块的开发节奏（Red → Green → Refactor）:

  1. 先写测试文件 (.test.ts)
     ├── 定义接口/行为契约 (基于本 RFC 的类型定义)
     ├── 列出所有边界用例 (正常路径 + 错误路径 + 边界)
     └── 此时测试应全部 FAIL (Red)

  2. 再写实现代码
     └── 以让测试通过为目标，不多写与测试无关的逻辑

  3. 跑测试，全部通过 (Green)
     └── vitest run host/test/im/

  4. 重构 (Refactor)
     └── 重构后必须再次确认测试仍然全部通过
```

### 测试分层

| 层级 | 位置 | 工具 | 描述 |
|------|------|------|------|
| **单元测试** | `host/test/im/*.test.ts` | vitest | 每个模块独立测试，依赖全部 mock |
| **单元测试 (Channel)** | `host/test/im/channels/feishu/*.test.ts` | vitest | 飞书解析/策略/路由逻辑，mock Lark SDK |
| **集成测试** | `host/test/im/*.integration.test.ts` | vitest | 多模块协作，mock 外部 IO (Lark API / LLM) |
| **E2E 验收** | 手动 / 飞书沙盒环境 | 手工 | 真实飞书 Bot + 真实 LLM，最终准出门控 |

### 每个 Phase 的测试要求

- **Phase 开始前**：对应测试文件必须存在且全部处于 `FAIL` 状态  
- **Phase 完成时**：对应测试文件必须全部 `PASS`，方可进入下一 Phase  
- **严禁**：先写实现、回头补测试（事后补写的测试对设计无约束力）

---

## 一、背景与动机

AOTUI Host 当前以 **Electron GUI** 为唯一用户入口。对话空间基于 **ProjectPath → Topic → Desktop → AgentDriver** 的链路工作。

业务需求：支持从飞书等外部 IM 发送消息给 Bot，由 Host 中的 Agent 处理并回复到 IM。

核心矛盾：
- AOTUI 当前的 Agent 和对话空间是 **基于 ProjectPath** 的
- 飞书消息来源于**外部 IM 用户**，没有天然的 ProjectPath 和 Topic 归属

### 参考来源

本方案深度参考 OpenClaw 的多 IM 对接架构（见 `multi-im-migration-report/`），但做了 **AOTUI 化精简**：
- 不引入完整插件系统（AOTUI 不需要 37+ IM 的可扩展性，但预留扩展接口）
- 不引入 JSONL 文件存储（复用 AOTUI 现有 SQLite）
- 不引入 `PluginRuntime` DI 容器（复用 AOTUI 现有 SessionManagerV3）

---

## 二、产品形态定义

### 2.1 实体关系

```
┌─────────────┐     1:1      ┌──────────┐
│  飞书 Bot    │─────────────│  Agent   │
│ (appId)     │              │ (agentId)│
└─────────────┘              └──────────┘
      │                            │
      │ 1:N (per DM user / group)  │ 1:N (per IM session)
      ▼                            ▼
┌──────────────────────────────────────┐
│          IM Session                  │
│  key = agent:<agentId>:feishu:<type>:<peerId>  │
│  workspace = ~ (home dir)            │
│  topicId = im_feishu_<peerId>_<ts>   │
└──────────────────────────────────────┘
```

### 2.2 核心决策

| 决策项 | 结论 | 理由 |
|--------|------|------|
| Bot : Agent | **1:1** | 一个飞书 App 绑定一个 AOTUI Agent |
| 默认工作空间 | **`~` (HOME)** | IM 用户无 project 概念 |
| Session 隔离 | **独立于 GUI** | IM Session 不在 Electron GUI 中可见，避免数据混杂 |
| 群聊支持 | **是** | 支持 @bot 触发 + requireMention |
| 回复形式 | **流式卡片** (Card Kit Streaming) | 最佳交互体验 |
| 连接模式 | **WebSocket** (默认) | 无需公网 IP，自动重连 |

### 2.3 用户视角 —— 飞书 DM 场景

```
User A 发消息给飞书 Bot
  → Host IM Gateway 收到事件
  → 路由解析: agentId=X, sessionKey=agent:X:feishu:direct:ou_userA
  → 查找/创建 IM Session (独立于 GUI Topic 体系)
  → HostDrivenSource 注入消息 → AgentDriver 触发 LLM
  → 流式输出 → FeishuStreamingSession → 流式卡片更新
  → LLM 完成 → 关闭流式卡片
```

### 2.4 用户视角 —— 飞书群聊场景

```
User B 在群中 @Bot 发消息
  → 检测 @bot mention → 剥离 mention 文本
  → 群组策略检查 (groupPolicy: open/allowlist/disabled)
  → 路由解析: sessionKey=agent:X:feishu:group:oc_chatId
  → 消息带上 senderName/senderId 注入 (多人上下文)
  → AgentDriver 处理 → 流式卡片回复到群
```

---

## 三、架构设计

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                   Electron GUI (React + tRPC)                    │
│              ↕ electron-trpc IPC (现有链路不变)                    │
├─────────────────────────────────────────────────────────────────┤
│                   HostManagerV2 (现有,不修改)                     │
│                   SessionManagerV3 (GUI Sessions)                │
├───────────────────────────┬─────────────────────────────────────┤
│   GUI Session 管理        │       IM Session 管理  [新增]        │
│   (SessionManagerV3)      │       (IMSessionManager)            │
│   Topic-Desktop-Agent     │       SessionKey-Desktop-Agent      │
│   SQLite messages_v2      │       SQLite im_messages (独立表)    │
├───────────────────────────┴─────────────────────────────────────┤
│                   共享基础设施                                    │
│   DesktopManager · LLMConfigService · AgentDriverV2              │
│   Runtime (IKernel/IDesktop) · DrivenSources                    │
├─────────────────────────────────────────────────────────────────┤
│                   IM Gateway Layer  [新增]                       │
│   IMGatewayManager → ChannelPlugin[] → FeishuChannel            │
│   路由解析 · 入站消息归一化 · 出站回复分发                          │
├─────────────────────────────────────────────────────────────────┤
│   ┌────────────┐                                                │
│   │ 飞书 Channel│  (可扩展: Telegram, Slack, ...)               │
│   │  Plugin    │                                                │
│   └────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 关键设计原则

| 原则 | 具体表现 |
|------|---------|
| **GUI 不感知 IM** | IM Session 独立管理，GUI Topic 列表不受影响 |
| **IM 不侵入核心** | IM 层通过组合 DesktopManager + AgentDriverV2，不修改 SessionManagerV3 |
| **共享 Agent 定义** | IM Bot 绑定的 Agent 与 GUI 使用的 Agent 是同一份配置 (Config.agents) |
| **共享 LLM 配置** | IM 和 GUI 共享同一个 LLMConfigService (同一个 API Key / 模型配置) |
| **独立消息存储** | IM 消息存独立 SQLite 表 `im_messages`，避免与 GUI 的 `messages_v2` 混杂 |
| **接口预留扩展** | `IChannelPlugin` 接口参考 OpenClaw ChannelPlugin 精简而来，后续可扩展其他 IM |

### 3.3 数据流全链路

```
飞书开放平台 (WebSocket Event)
  │
  ▼
FeishuGateway (monitor.ts)
  │ im.message.receive_v1
  ▼
FeishuInboundHandler (bot.ts)
  │ 解析 → 去重 → @bot检测 → 策略检查 → 发送者名称解析
  ▼
IMInboundMessage (统一入站信封)
  │ { body, channel, chatType, senderId, senderName, sessionKey, ... }
  ▼
IMSessionManager.dispatch(msg)
  │ 1. 路由解析 → agentId + sessionKey
  │ 2. ensureSession(sessionKey) → 创建 Desktop + AgentDriver (workspace=~)
  │ 3. 消息持久化到 im_messages 表
  │ 4. IMDrivenSource.addMessage() + notifyUpdate()
  ▼
AgentDriverV2 (共享组件,不修改)
  │ 聚合 Sources → LLM 调用
  ▼
AgentDriver 回调                        飞书 Card Kit API
  ├── onTextDelta ──────────────────→ FeishuStreamingSession.update()
  ├── onAssistantMessage ───────────→ 持久化 + streaming.close()
  └── onToolResult ─────────────────→ Desktop.dispatchOperation()
```

---

## 四、核心模块详设

### 4.1 IChannelPlugin — 通道抽象接口

精简自 OpenClaw `ChannelPlugin`，只保留 AOTUI 需要的槽位：

```typescript
// host/src/im/channel-plugin.ts

export type ChatType = 'direct' | 'group';

export interface ChannelCapabilities {
  chatTypes: ChatType[];
  media?: boolean;
  threads?: boolean;
  reactions?: boolean;
  streaming?: boolean;
}

export interface ChannelMeta {
  id: string;
  label: string;
  description?: string;
}

export interface IChannelPlugin<TAccount = unknown> {
  readonly id: string;
  readonly meta: ChannelMeta;
  readonly capabilities: ChannelCapabilities;

  // ── 必选: 配置管理 ──
  resolveAccount(config: IMChannelConfig): TAccount;
  isConfigured(account: TAccount): boolean;

  // ── 核心: 连接管理 ──
  start(ctx: GatewayContext): Promise<void>;
  stop(): Promise<void>;

  // ── 核心: 消息发送 ──
  sendText(ctx: OutboundContext): Promise<void>;
  sendStreamingStart?(ctx: StreamingStartContext): Promise<StreamingSession>;
}
```

### 4.2 IMSessionManager — IM 会话管理器

独立于 `SessionManagerV3`，但复用 `DesktopManager` 和 `LLMConfigService`：

```typescript
// host/src/im/im-session-manager.ts

export interface IMSession {
  sessionKey: string;       // agent:<agentId>:<channel>:<chatType>:<peerId>
  agentId: string;
  channel: string;          // "feishu"
  chatType: ChatType;       // "direct" | "group"
  peerId: string;           // open_id (DM) 或 chat_id (群)
  desktop: IDesktop;
  agentDriver: AgentDriverV2;
  sources: { ... };
  createdAt: number;
  lastAccessTime: number;
}

export class IMSessionManager extends EventEmitter {
  private sessions: Map<string, IMSession>;
  private kernel: IKernel;
  private desktopManager: DesktopManager;
  private llmConfigService: LLMConfigService;

  // 与 SessionManagerV3 平行的生命周期管理
  async ensureSession(sessionKey: string, agentId: string): Promise<IMSession>;
  async destroySession(sessionKey: string): Promise<void>;

  // IM 入站消息处理
  async dispatch(msg: IMInboundMessage): Promise<void>;
}
```

### 4.3 IMInboundMessage — 统一入站信封

精简自 OpenClaw `MsgContext`，只保留 AOTUI 需要的字段：

```typescript
// host/src/im/types.ts

export interface IMInboundMessage {
  // ── 消息内容 ──
  body: string;                     // 文本内容
  mediaUrls?: string[];             // 媒体 URL (图片/文件)

  // ── 来源标识 ──
  channel: string;                  // "feishu"
  chatType: ChatType;               // "direct" | "group"
  senderId: string;                 // 发送者 ID (open_id)
  senderName?: string;              // 发送者显示名
  chatId: string;                   // 会话 ID (chat_id / open_id)

  // ── 路由 ──
  agentId: string;                  // 绑定的 Agent ID
  sessionKey: string;               // 路由键 agent:<agentId>:feishu:<type>:<peerId>
  accountId?: string;               // 多账号标识

  // ── 上下文 ──
  messageId: string;                // IM 原始消息 ID (去重用)
  replyToId?: string;               // 引用消息 ID
  replyToBody?: string;             // 引用消息内容
  threadId?: string;                // 线程 ID
  wasMentioned?: boolean;           // 是否被 @bot
  timestamp: number;                // Unix ms

  // ── 群聊上下文 ──
  groupName?: string;               // 群名称
}
```

### 4.4 IMDrivenSource — IM 消息驱动源

平行于 `HostDrivenSourceV2`，但读写 `im_messages` 表：

```typescript
// host/src/im/im-driven-source.ts

export class IMDrivenSource implements IDrivenSource {
  readonly name = 'IM';

  // 从 im_messages 表加载历史
  async getMessages(): Promise<MessageWithTimestamp[]>;

  // 支持 context_compact 工具 (复用 HostDrivenSourceV2 的逻辑)
  async getTools(): Promise<Record<string, Tool>>;

  // 添加消息 (入站 user 消息 / 出站 assistant 消息)
  addMessage(msg: ModelMessage): void;

  // 通知 AgentDriver 有新消息
  notifyUpdate(): void;
}
```

### 4.5 IMGatewayManager — 网关管理器

负责启动/停止所有已配置的 IM Channel：

```typescript
// host/src/im/im-gateway-manager.ts

export class IMGatewayManager {
  private channels: Map<string, IChannelPlugin>;
  private sessionManager: IMSessionManager;
  private abortControllers: Map<string, AbortController>;

  // 注册 Channel Plugin
  register(plugin: IChannelPlugin): void;

  // 根据 im.json 配置启动所有已启用的 Channel
  async startAll(config: Info): Promise<void>;

  // 优雅关闭所有连接
  async stopAll(): Promise<void>;
}
```

### 4.6 路由解析

精简自 OpenClaw `resolveAgentRoute()`，AOTUI 只需要两级路由：

```typescript
// host/src/im/routing.ts

// 路由优先级 (AOTUI 精简版):
// 1. im.json 中 channel.feishu.botAgentId 显式绑定
// 2. Config.agents.activeAgentId 默认 Agent
//
// Session Key 格式:
// agent:<agentId>:feishu:direct:<peerId>    (DM)
// agent:<agentId>:feishu:group:<chatId>     (群)

export function resolveIMRoute(params: {
  config: Info;
  channel: string;
  chatType: ChatType;
  peerId: string;
  accountId?: string;
}): { agentId: string; sessionKey: string };

export function buildSessionKey(
  agentId: string, channel: string, chatType: ChatType, peerId: string
): string;
```

---

## 五、飞书接入详设

### 5.1 飞书 Channel Plugin 结构

```
host/src/im/
├── index.ts                    # IM 子系统导出
├── types.ts                    # IMInboundMessage, IMSession, 配置类型
├── channel-plugin.ts           # IChannelPlugin 接口定义
├── im-session-manager.ts       # IM 会话管理器
├── im-driven-source.ts         # IMDrivenSource (IDrivenSource 实现)
├── im-gateway-manager.ts       # 网关管理器
├── routing.ts                  # 路由解析 + Session Key 构建
├── dedup.ts                    # 消息去重 (内存 LRU)
└── channels/
    └── feishu/
        ├── index.ts            # FeishuChannelPlugin 导出
        ├── channel.ts          # IChannelPlugin 实现
        ├── gateway.ts          # WebSocket/Webhook 连接管理 (← monitor.ts)
        ├── bot.ts              # 入站消息处理 (← bot.ts 精简)
        ├── send.ts             # 消息发送封装 (← send.ts)
        ├── streaming-card.ts   # Card Kit 流式会话 (← streaming-card.ts 直接复制)
        ├── reply-dispatcher.ts # 回复分发: 流式卡片/普通卡片/文本 (← reply-dispatcher.ts)
        ├── client.ts           # Lark SDK Client 工厂 (← client.ts)
        ├── accounts.ts         # 多账号配置解析 (← accounts.ts 精简)
        ├── policy.ts           # DM/群组访问策略 (← policy.ts)
        ├── mention.ts          # @提及检测 (← mention.ts 精简)
        ├── post.ts             # 飞书富文本 → Markdown (← post.ts 直接复制)
        ├── typing.ts           # 打字指示器: emoji reaction (← typing.ts)
        ├── targets.ts          # ID 归一化 (← targets.ts 直接复制)
        ├── config-schema.ts    # Zod 配置校验 (← config-schema.ts 精简)
        └── types.ts            # 飞书专用类型
```

### 5.2 OpenClaw 代码复用策略

| 文件 | 策略 | 说明 |
|------|------|------|
| `streaming-card.ts` | **直接复制** | 纯飞书 API 调用，无框架依赖，仅需将 `fetchWithSsrFGuard` 替换为 `fetch` |
| `post.ts` | **直接复制** | 纯文本转换，无外部依赖 |
| `targets.ts` | **直接复制** | ID 归一化函数，无依赖 |
| `client.ts` | **微调复制** | 移除 proxy 支持，保留 WSClient/Client 工厂 |
| `typing.ts` | **微调复制** | 移除 `openclaw/plugin-sdk` 依赖，直接用 Lark SDK |
| `mention.ts` | **精简复制** | 只保留 `checkBotMentioned` + `stripBotMention` |
| `policy.ts` | **精简复制** | 移除 `openclaw/plugin-sdk` 依赖，保留核心策略逻辑 |
| `bot.ts` | **重写** | 保留解析逻辑，但用 AOTUI IMSessionManager 替代 OpenClaw dispatcher |
| `reply-dispatcher.ts` | **重写** | 保留流式卡片逻辑，但对接 AOTUI AgentDriver 回调而非 OpenClaw ReplyDispatcher |
| `monitor.ts` | **精简重写** | 保留 WS/Webhook 双模式，简化事件注册 |
| `send.ts` | **精简复制** | 保留 sendMessage/sendCard/editMessage，移除 media 上传 (MVP 不需要) |

### 5.3 飞书连接启动流程

```typescript
// 由 Host 启动时触发 (host-v2.ts 或 electron/main.ts)

async function bootIMGateway() {
  const config = await Config.get();
  const imConfig = config.im;
  if (!imConfig?.channels?.feishu?.enabled) return;

  const imSessionManager = new IMSessionManager(
    kernel, desktopManager, llmConfigService
  );
  const gatewayManager = new IMGatewayManager(imSessionManager);

  // 注册飞书 Channel
  gatewayManager.register(new FeishuChannelPlugin());

  // 启动所有已启用的 Channel
  await gatewayManager.startAll(config);
}
```

### 5.4 飞书入站消息处理链路

```
im.message.receive_v1 事件
  │
  ▼
1. 去重 (dedup.ts) — 内存 LRU (1000条)
  │
  ▼
2. 消息解析 (bot.ts)
   ├── text → 直接提取
   ├── post (富文本) → post.ts 转 Markdown
   ├── image/file → 提取 key (MVP 暂不下载)
   └── merge_forward → 展开子消息
  │
  ▼
3. 群聊: @bot 检测 (mention.ts)
   ├── 未 @bot 且 requireMention=true → 忽略
   └── 已 @bot → 剥离 @bot 文本
  │
  ▼
4. 群聊: 策略检查 (policy.ts)
   ├── groupPolicy=disabled → 拒绝
   ├── groupPolicy=allowlist → 检查 groupAllowFrom
   └── groupPolicy=open → 放行
  │
  ▼
5. DM: 策略检查 (policy.ts)
   ├── dmPolicy=open → 放行
   └── dmPolicy=allowlist → 检查 allowFrom
  │
  ▼
6. 路由解析 (routing.ts)
   → { agentId, sessionKey }
  │
  ▼
7. 构建 IMInboundMessage → imSessionManager.dispatch(msg)
  │
  ▼
8. IMSessionManager:
   a. ensureSession(sessionKey, agentId)
      → 创建 Desktop(workspace=~) + AgentDriver + Sources
   b. imDrivenSource.addMessage({ role: 'user', content: body })
      → AgentDriver debounce → handleUpdate() → LLM
  │
  ▼
9. AgentDriver 回调:
   ├── onTextDelta → feishuReplyDispatcher.onPartialReply() → streaming.update()
   ├── onAssistantMessage → 持久化 + streaming.close() + 发送最终消息
   └── onToolResult → 持久化 tool result
```

### 5.5 飞书出站回复处理

```typescript
// 回复分发决策逻辑 (reply-dispatcher.ts)

function createFeishuReplyHandler(params: {
  chatId: string;
  replyToMessageId?: string;
  accountId?: string;
  agentId: string;
}) {
  let streaming: FeishuStreamingSession | null = null;

  return {
    // AgentDriver onTextDelta 回调
    onPartialReply(text: string) {
      if (!streaming) {
        // 首次 delta → 创建流式卡片
        streaming = new FeishuStreamingSession(client, creds);
        streaming.start(chatId, 'chat_id', { replyToMessageId });
      }
      streaming.update(text);
    },

    // AgentDriver onAssistantMessage 回调
    async onFinalReply(text: string) {
      if (streaming?.isActive()) {
        await streaming.close(text);
      } else {
        // 无 streaming (短回复) → 直接发卡片
        await sendMarkdownCard({ chatId, text, replyToMessageId });
      }
    },

    // 清理
    async cleanup() {
      if (streaming?.isActive()) {
        await streaming.close();
      }
    }
  };
}
```

---

## 六、数据模型

### 6.1 SQLite 新增表: `im_sessions`

```sql
CREATE TABLE IF NOT EXISTS im_sessions (
  session_key  TEXT PRIMARY KEY,        -- agent:X:feishu:direct:ou_xxx
  agent_id     TEXT NOT NULL,
  channel      TEXT NOT NULL,           -- "feishu"
  chat_type    TEXT NOT NULL,           -- "direct" | "group"
  peer_id      TEXT NOT NULL,           -- open_id 或 chat_id
  account_id   TEXT DEFAULT 'default',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  metadata     TEXT                     -- JSON (peer_name, group_name, 等)
);
```

### 6.2 SQLite 新增表: `im_messages`

```sql
CREATE TABLE IF NOT EXISTS im_messages (
  id           TEXT PRIMARY KEY,
  session_key  TEXT NOT NULL,
  role         TEXT NOT NULL,           -- "user" | "assistant" | "tool" | "system"
  content      TEXT NOT NULL,           -- JSON (ModelMessage.content)
  timestamp    INTEGER NOT NULL,
  provider_options TEXT,                -- JSON (optional)
  FOREIGN KEY (session_key) REFERENCES im_sessions(session_key)
);

CREATE INDEX IF NOT EXISTS idx_im_messages_session
  ON im_messages(session_key, timestamp ASC);
```

### 6.3 配置结构 (im.json)

```jsonc
// ~/.tui/im.json
{
  "im": {
    "channels": {
      "feishu": {
        "enabled": true,
        "appId": "cli_xxxx",
        "appSecret": "xxxx",
        "domain": "feishu",           // "feishu" | "lark"
        "connectionMode": "websocket", // "websocket" | "webhook"

        // Bot → Agent 绑定
        "botAgentId": "agent_xxx",     // 绑定到哪个 Agent，null 则用 activeAgentId

        // DM 策略
        "dmPolicy": "open",            // "open" | "allowlist"
        "allowFrom": [],               // open_id 白名单

        // 群组策略
        "groupPolicy": "open",         // "open" | "allowlist" | "disabled"
        "groupAllowFrom": [],          // chat_id 白名单
        "requireMention": true,        // 群聊是否需要 @bot

        // 回复配置
        "renderMode": "auto",          // "auto" | "card" | "raw"
        "streaming": true,

        // 多账号 (可选)
        "accounts": {}
      }
    }
  }
}
```

---

## 七、迁移步骤

### Phase 0: 基础设施 (Day 1)

> **先写测试，后写实现。** Phase 0 产出物 `routing.test.ts` + `dedup.test.ts` 必须先处于 FAIL 状态，实现完成后全部 PASS 才算 Done。

```
步骤   顺序   任务                                    产出文件
─────────────────────────────────────────────────────────────
0.1    先写   创建 host/src/im/ 目录结构               目录结构
0.2    先写   定义 IChannelPlugin 接口 + IM 核心类型    im/channel-plugin.ts, im/types.ts
0.3    先写   编写 routing.test.ts (全 FAIL)           test/im/routing.test.ts
0.4    先写   编写 dedup.test.ts (全 FAIL)             test/im/dedup.test.ts
0.5    再写   实现消息去重 (LRU)                       im/dedup.ts
0.6    再写   实现路由解析                             im/routing.ts
0.7    验证   vitest run host/test/im/routing.test.ts dedup.test.ts → 全 PASS
0.8    再写   创建 im_sessions + im_messages 表        db/index.ts (新增 migration)
```

### Phase 1: IM 会话管理 (Day 2-3)

> 先写 `im-session-manager.test.ts` + `im-driven-source.test.ts`，全部 FAIL 后再动实现代码。

```
步骤   顺序   任务                                    产出文件
─────────────────────────────────────────────────────────────
1.1    先写   编写 im-driven-source.test.ts (全 FAIL)  test/im/im-driven-source.test.ts
1.2    先写   编写 im-session-manager.test.ts (全 FAIL) test/im/im-session-manager.test.ts
1.3    再写   实现 IMDrivenSource                      im/im-driven-source.ts
1.4    验证   vitest run .../im-driven-source.test.ts → 全 PASS
1.5    再写   实现 IMSessionManager                    im/im-session-manager.ts
1.6    验证   vitest run .../im-session-manager.test.ts → 全 PASS
1.7    再写   实现 IMGatewayManager                    im/im-gateway-manager.ts
1.8    再写   集成到 Host 启动链路                      server/host-v2.ts (修改)
```

### Phase 2: 飞书 Channel (Day 4-6)

> 先写 `bot.test.ts` + `policy.test.ts` + `mention.test.ts`。复制自 OpenClaw 的代码也必须有对应测试覆盖改动部分。

```
步骤   顺序   任务                                    产出文件
─────────────────────────────────────────────────────────────
2.1    先写   编写 bot.test.ts (全 FAIL)               test/im/channels/feishu/bot.test.ts
2.2    先写   编写 policy.test.ts (全 FAIL)            test/im/channels/feishu/policy.test.ts
2.3    先写   编写 mention.test.ts (全 FAIL)           test/im/channels/feishu/mention.test.ts
2.4    先写   编写 config-schema.test.ts (全 FAIL)     test/im/channels/feishu/config-schema.test.ts
2.5    再写   复制 streaming-card.ts / post.ts / targets.ts   (直接复制, 测试随之覆盖)
2.6    再写   复制+改造 client.ts / typing.ts
2.7    再写   实现 mention.ts + policy.ts + config-schema.ts
2.8    验证   vitest run .../feishu/mention policy policy config-schema → 全 PASS
2.9    再写   实现 accounts.ts + send.ts
```

### Phase 3: 飞书收发链路 (Day 7-9)

> 先写 `reply-dispatcher.test.ts`，再写实现。DM 收发集成测试 (mock Lark API) 通过后才进入 Phase 4。

```
步骤   顺序   任务                                    产出文件
─────────────────────────────────────────────────────────────
3.1    先写   编写 reply-dispatcher.test.ts (全 FAIL)  test/im/channels/feishu/reply-dispatcher.test.ts
3.2    先写   编写 feishu-channel.integration.test.ts  test/im/channels/feishu/feishu-channel.integration.test.ts
              (DM 收发 e2e, mock Lark SDK, 全 FAIL)
3.3    再写   实现 bot.ts (入站消息处理)                im/channels/feishu/bot.ts
3.4    验证   vitest run .../feishu/bot.test.ts → 全 PASS
3.5    再写   实现 reply-dispatcher.ts                 im/channels/feishu/reply-dispatcher.ts
3.6    验证   vitest run .../feishu/reply-dispatcher.test.ts → 全 PASS
3.7    再写   实现 gateway.ts (WS 连接管理)              im/channels/feishu/gateway.ts
3.8    再写   实现 FeishuChannelPlugin (组装)            im/channels/feishu/channel.ts
3.9    验证   vitest run .../feishu-channel.integration.test.ts → 全 PASS
```

### Phase 4: 群聊 + 联调 (Day 10-12)

> 群聊新增用例直接补充到既有测试文件中（先补 FAIL 用例，再改实现）。所有测试全 PASS 后方可进行飞书真机验收。

```
步骤   顺序   任务                                    产出文件
─────────────────────────────────────────────────────────────
4.1    先写   bot.test.ts 补充群聊 @bot 用例 (FAIL)    test/im/channels/feishu/bot.test.ts
4.2    先写   im-session-manager.test.ts 补充会话隔离用例  (FAIL)
4.3    再写   群聊 @bot 检测 + 策略                    bot.ts, policy.ts
4.4    再写   群聊 sender 上下文注入                   im-driven-source.ts
4.5    验证   vitest run host/test/im/ → 全部 PASS
4.6    再写   优雅关闭 + 错误恢复                      gateway.ts, im-gateway-manager.ts
4.7    验证   vitest run host/test/im/ → 全部仍然 PASS
4.8    完成   编写 im/README.md 开发者文档
4.9    准出   飞书真机 E2E 验收 (见第十节验收标准)
```

---

## 八、文件清单与命名规范

### 8.1 命名规范

| 维度 | 规范 | 示例 |
|------|------|------|
| 目录 | `host/src/im/channels/<channel-id>/` | `host/src/im/channels/feishu/` |
| 接口文件 | 动词/名词 kebab-case | `channel-plugin.ts` |
| 实现文件 | 功能描述 kebab-case | `im-session-manager.ts` |
| 类型文件 | `types.ts` | `im/types.ts` |
| 测试文件 | `<module>.test.ts` | `im-session-manager.test.ts` |

### 8.2 完整文件清单 (24 个新文件)

```
host/src/im/
├── index.ts                           # 公开 API
├── types.ts                           # IMInboundMessage, IMSession, 配置类型
├── channel-plugin.ts                  # IChannelPlugin 接口
├── im-session-manager.ts              # IM 会话管理器
├── im-driven-source.ts                # IDrivenSource 实现
├── im-gateway-manager.ts              # 网关管理器
├── routing.ts                         # 路由解析
├── dedup.ts                           # 消息去重
└── channels/
    └── feishu/
        ├── index.ts                   # 飞书 Channel 导出
        ├── channel.ts                 # IChannelPlugin 实现
        ├── gateway.ts                 # WebSocket/Webhook 连接管理
        ├── bot.ts                     # 入站消息处理
        ├── send.ts                    # 消息发送
        ├── streaming-card.ts          # Card Kit 流式
        ├── reply-dispatcher.ts        # 回复分发
        ├── client.ts                  # Lark SDK Client
        ├── accounts.ts                # 多账号解析
        ├── policy.ts                  # 访问策略
        ├── mention.ts                 # @提及处理
        ├── post.ts                    # 富文本转换
        ├── typing.ts                  # 打字指示器
        ├── targets.ts                 # ID 归一化
        ├── config-schema.ts           # 配置校验
        └── types.ts                   # 飞书专用类型

host/test/im/
├── im-session-manager.test.ts
├── im-driven-source.test.ts
├── routing.test.ts
├── dedup.test.ts
└── channels/
    └── feishu/
        ├── bot.test.ts
        ├── policy.test.ts
        └── reply-dispatcher.test.ts
```

### 8.3 需修改的现有文件

| 文件 | 修改内容 |
|------|---------|
| `host/src/db/index.ts` | 新增 `im_sessions` + `im_messages` 表 DDL 和 CRUD |
| `host/src/server/host-v2.ts` | 启动链路中调用 `bootIMGateway()` |
| `host/src/electron/main.ts` | Electron 入口中初始化 IM Gateway |
| `host/src/config/config.ts` | `Info.im` 类型已存在，无需修改 (仅确认 im.json 读取逻辑) |
| `host/package.json` | 新增 `@larksuiteoapi/node-sdk` 依赖 (已存在) |

---

## 九、风险与缓解

### 9.1 技术风险

| 风险 | 严重度 | 概率 | 缓解措施 |
|------|--------|------|---------|
| **WebSocket 断连** | 高 | 中 | Lark SDK 内置自动重连；加 heartbeat 探测 + 手动重连 |
| **流式卡片 API 限流** | 中 | 中 | 100ms 节流控制 (streaming-card.ts 已有)；降级为普通卡片 |
| **LLM 响应时间过长** | 中 | 低 | 添加 typing 指示器；设置 maxSteps 限制 |
| **消息去重失败** | 低 | 低 | 内存 LRU (1000条) 兜底；飞书 message_id 全局唯一 |
| **IM Session 内存泄漏** | 中 | 中 | 空闲 30min 自动清理 + maxSessions 限制 (与 GUI 一致) |
| **Agent 配置变更** | 低 | 中 | IM Session 创建时 snapshot Agent 配置；重建 Session 时刷新 |

### 9.2 产品风险

| 风险 | 缓解 |
|------|------|
| Bot 被大量群拉入导致资源耗尽 | `groupPolicy: allowlist` 默认只响应白名单群 |
| DM 被垃圾消息攻击 | `dmPolicy: allowlist` 可限制；LRU 去重防重放 |
| 工作区为 `~` 导致 Agent 操作文件不安全 | MVP 阶段 TUI App 默认不挂载文件操作工具；后续可配置 sandbox |

### 9.3 架构风险

| 风险 | 缓解 |
|------|------|
| IMSessionManager 复制了 SessionManagerV3 大量逻辑 | 抽取共享的 `createDesktopAndDriver()` 工厂方法到 `host/src/core/` |
| IM 和 GUI 的 LLM 配置竞争 | 两者共享同一个 LLMConfigService，无竞争风险 |
| im.json 和 mcp.json 配置分散 | `Config.get()` 已合并两者，IM 配置读取链路已打通 |

---

## 十、验收标准

### 10.0 硬门控：测试全通过

> ⛔ **以下测试门控是进入 E2E 验收的前提，任何一项未通过不得进行真机验收。**

```bash
# 运行所有 IM 相关测试，必须全部通过
pnpm vitest run host/test/im/
```

| 测试文件 | 最少用例数 | 要求 |
|---------|-----------|------|
| `routing.test.ts` | 6 | 100% PASS |
| `dedup.test.ts` | 5 | 100% PASS |
| `im-driven-source.test.ts` | 8 | 100% PASS |
| `im-session-manager.test.ts` | 10 | 100% PASS |
| `feishu/bot.test.ts` | 15 | 100% PASS |
| `feishu/policy.test.ts` | 10 | 100% PASS |
| `feishu/mention.test.ts` | 6 | 100% PASS |
| `feishu/reply-dispatcher.test.ts` | 8 | 100% PASS |
| `feishu/config-schema.test.ts` | 6 | 100% PASS |
| `feishu/feishu-channel.integration.test.ts` | 5 | 100% PASS |

### 10.1 准出条件 (MVP E2E)

- [ ] **测试门控已通过**（见 10.0，必填）
- [ ] 飞书 Bot WebSocket 模式成功连接
- [ ] DM 场景: 用户发消息 → Agent 回复（流式卡片）
- [ ] 群聊场景: @Bot 发消息 → Agent 回复（流式卡片）
- [ ] 群聊场景: 未 @Bot → 不响应 (requireMention=true)
- [ ] 消息去重: 同一消息不重复处理
- [ ] 会话隔离: 不同 DM 用户独立会话
- [ ] IM Session 不出现在 GUI Topic 列表
- [ ] Host 关闭时 WebSocket 优雅断开

### 10.2 后续迭代 (P2)

- [ ] 媒体消息支持 (图片/文件下载 + 上传)
- [ ] DM pairing 审批模式
- [ ] 飞书 Agent 工具 (feishu_doc, feishu_bitable)
- [ ] Webhook 模式支持
- [ ] 多账号支持
- [ ] tRPC Router 暴露 IM Channel 状态 (GUI 可查看)
- [ ] 其他 IM 接入 (Telegram, Slack)
- [ ] IM Session 在 GUI 中可查看 (只读)

---

> **总结**: 本方案以"最小侵入"原则将飞书 IM 能力接入 AOTUI Host——IM 会话管理与 GUI 会话管理平行运行，共享 DesktopManager、AgentDriverV2、LLMConfigService 等核心基础设施，不修改现有 SessionManagerV3。飞书 Channel 实现深度复用 OpenClaw 的 `streaming-card.ts`、`post.ts`、`typing.ts` 等经验证的代码，降低实现风险。  
> **开发节奏遵循测试先行原则**：每个模块先写测试（Red），再写实现（Green），重构后再次确认测试通过。所有单元测试 + 集成测试全部 PASS 是进入 E2E 真机验收的硬性前提，不可绕过。
