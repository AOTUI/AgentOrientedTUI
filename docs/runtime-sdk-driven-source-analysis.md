# 从 Runtime、SDK 到 Driven Source：AOTUI 系统是如何工作的

## 1. 先回答三个根问题

### 1.1 这个系统到底在做什么

这个仓库不是在做一个“给人类直接操作”的 IDE 或终端，而是在做一套 **Agent 可操作的应用操作系统**：

1. `host` 提供产品壳层，负责桌面应用、会话、模型配置、消息存储、Agent 生命周期管理。
2. `runtime` 提供运行时内核，负责把一个个 TUI App 隔离运行起来，并把它们变成 LLM 可理解、可调用的状态与工具。
3. `sdk` 提供开发者编程模型，让业务开发者用接近 Preact 的方式声明 TUI App、View、Tool 和状态。
4. `aotui-ide`、`terminal-app`、`planning-app` 等则是跑在这套底座上的 Agent Apps。
5. `agent-driver-v2` 负责把多个来源的消息与工具聚合给大模型，并把 Tool Call 路由回正确的 source。

一句话总结：**这是一个把“应用”转译成“Agent 可感知、可执行的环境”的框架体系。**

### 1.2 它解决了什么问题

它解决的不是终端 UI 本身，而是下面这几个更基础的 Agent 工程问题：

1. 如何给 Agent 一个受控、可观察、可操作的应用环境，而不是直接给它裸系统权限。
2. 如何把应用状态稳定地转换成大模型能消费的上下文，而不是把原始 DOM 或随意文本扔给模型。
3. 如何把应用能力暴露成工具调用，并且让工具和上下文始终对齐。
4. 如何同时接入多类上下文来源，例如系统提示词、聊天历史、桌面状态、MCP 工具、技能、IM 消息，而不把职责揉成一团。

### 1.3 为什么这套设计值得注意

它的亮点不在单个功能，而在于分层比较克制：

1. `runtime` 只解决“运行、隔离、快照、调度”。
2. `sdk` 只解决“开发者如何声明 app/view/tool/state”。
3. `agent-driver-v2` 只解决“多 source 聚合与工具路由”。
4. `host` 只做产品层装配，而不是侵入每个 app 的实现细节。

这就是比较典型的框架思路：**先把控制面、运行面、开发面拆干净，再谈功能。**

---

## 2. 系统总分层：谁负责什么

### 2.1 Host：产品层与控制面

`host` 是最终产品入口，职责包括：

1. 创建 desktop / topic / session。
2. 读取模型配置、系统提示词、MCP 配置、技能配置。
3. 创建 `AgentDriverV2`，并把不同 `DrivenSource` 装进去。
4. 保存消息历史、做上下文压缩、同步 GUI。

它不负责：

1. 不直接实现 TUI App 的视图树。
2. 不直接管理 Worker 内组件生命周期。
3. 不直接定义 app 内部的工具。

也就是说，`host` 是装配者，不是运行时内核。

### 2.2 Runtime：运行时内核

`runtime` 的核心职责是：

1. 为每个 App 提供独立 Worker 隔离。
2. 在 Worker 内初始化 DOM 环境并运行 app。
3. 监听 DOM 变化，生成 snapshot fragment 和 `indexMap`。
4. 把 LLM 的工具调用转换成 runtime operation，再调度回目标 app。
5. 管理 desktop、snapshot、lock、system operation。

它不负责：

1. 不做业务文件搜索、代码编辑、LSP 分析。
2. 不做聊天历史存储。
3. 不做模型调用。
4. 不做产品层配置中心。

### 2.3 SDK：开发者编程模型

`sdk` 提供的是构建 TUI App 的声明式接口：

1. `createTUIApp` 把 Preact 组件包装成 runtime 可加载的 factory。
2. `View` 声明一个可被 runtime 识别和快照化的视图节点。
3. `useViewTypeTool` 把工具注册到某个 `viewType` 上。
4. `usePersistentState`、`useAppEnv`、`useViewContext` 等 hook 提供 app 级状态与上下文能力。

它不负责：

1. 不负责 Worker 启动。
2. 不负责快照聚合。
3. 不负责多 source 聚合。
4. 不负责模型调用与 Tool Call 路由。

### 2.4 Agent Driver：多 source 聚合器

`agent-driver-v2` 只做一件事：把多个 `IDrivenSource` 统一变成一轮 LLM 调用输入。

它负责：

1. 收集各 source 的消息并按时间排序。
2. 收集各 source 的工具并建立 tool -> source 映射。
3. 执行模型返回的 tool call。
4. 把 tool result 再写回会话。

它不负责：

1. 不理解 app 内部业务。
2. 不自己生成桌面状态。
3. 不自己存储会话。

---

## 3. 先看最底层数据模型：系统是如何把“应用”变成“可推理对象”的

要理解这套系统，最重要的不是先看组件，而是看三个底层对象：

### 3.1 View

在 AOTUI 里，`View` 是 Agent 能感知的最小可命名界面单元。

它至少有：

1. `id`：实例级唯一标识，例如 `workspace`、`fd_0`。
2. `type`：同类视图的抽象类型，例如 `Workspace`、`FileDetail`。
3. `name`：给快照展示的人类可读名称。

为什么同时需要 `id` 和 `type`：

1. `id` 解决“这个具体实例是谁”。
2. `type` 解决“这一类视图共享什么工具”。

这就是 `aotui-ide` 能同时开多个 `FileDetail`，却不需要重复注册 N 套 LSP 工具的基础。

### 3.2 Snapshot

Snapshot 是 runtime 暴露给 Agent 的“当前世界状态”。

它不是简单 HTML dump，而是两层输出：

1. `markup`：给 LLM 看的结构化文本。
2. `indexMap`：给 runtime 做参数解析与工具发现的机器索引。

在新版实现里，还额外有 `structured`：

1. `desktopState`
2. `appStates`
3. `viewStates`

这意味着 runtime 正在把“给模型看的文本”和“给系统做语义处理的结构化数据”分离开。

### 3.3 Operation / Tool

LLM 最终不是直接操作 DOM，而是调用 tool。

在 runtime 内部，tool 最终会落成 `Operation`：

1. `context`：包含 `appId`、`viewId`、`snapshotId`
2. `name`
3. `args`

也就是说，**tool 是 LLM-facing API，operation 是 runtime-facing command**。

---

## 4. Runtime 的能力与边界：它如何支撑起 aotui-ide

### 4.1 Runtime 的能力核心

把 `runtime` 拆开看，它有四个关键能力。

#### 能力一：Desktop / App 生命周期管理

`Kernel` 通过 `DesktopManager` 和 `AppManager` 管理 desktop 与 app 生命周期：

1. 创建 desktop。
2. 安装 app。
3. 打开、关闭、重初始化 app。
4. 管理桌面锁，防止并发操作冲突。

`host/src/core/desktop-manager.ts` 创建 desktop 后，会调用 `AppRegistry.installAll()`，把配置中的 app 安装到 desktop 上。

这就是 `aotui-ide` 为什么不是“宿主里硬编码的页面”，而是一个被注册、被安装、被运行的 app。

#### 能力二：Worker 隔离运行

每个 app 通过 `AppWorkerHost` / `WorkerSandbox` 运行在独立 Worker 里。

这样做的价值：

1. app 之间相互隔离。
2. SDK 层逻辑和宿主进程分开。
3. 一个 app 的异常不会直接污染整个 host。
4. runtime 可以统一控制 Worker 初始化、重置、超时和消息协议。

`runtime/src/worker-runtime/index.ts` 明确写了一个重要边界：  
**SDK 负责构建 app，Runtime 负责运行 app。**

这是整个架构里最关键的一条职责线。

#### 能力三：把组件树转成 Agent 可读快照

Worker 内部会：

1. 用 `linkedom` 初始化独立 DOM。
2. 把 app 渲染到 `appContainer`。
3. 用 `transformElement()` 把 DOM 转成 markup + indexMap。
4. 再把 view fragment、ref registry、type tools 合并进最终 fragment。
5. 主线程的 `Kernel.acquireSnapshot()` 再用 `SnapshotFormatter` 把所有 app fragment 聚合成完整 desktop snapshot。

这套链路的意义非常大：

1. app 开发者只写组件。
2. runtime 负责把组件树规范化成模型可消费的上下文。
3. tool 定义和 snapshot 状态来自同一份运行现场，避免上下文与工具脱节。

#### 能力四：Operation 调度

LLM 调工具后，`AOTUIDrivenSource.executeTool()` 会构造 runtime operation，交给 `Kernel.execute()`。

`Kernel.execute()` 会：

1. 校验 desktop 和 lock。
2. 区分 system operation 和 app operation。
3. app operation 再交给 `Dispatcher`。
4. `Dispatcher` 会根据 `snapshotId + appId + viewId` 去 `indexMap` 做参数解析。
5. 最终由 desktop 把操作路由到对应 Worker 内的 app。

因此 runtime 本质上是一个 **安全的命令总线 + 状态快照总线**。

### 4.2 Runtime 如何具体支撑 aotui-ide

`aotui-ide` 跑起来的链路大致是：

1. `host` 创建 session。
2. `DesktopManager.createDesktop()` 创建 runtime desktop。
3. `AppRegistry.installAll()` 读取 `aoapp.json` / entry，安装 `aotui-ide`。
4. `runtime` 为 `aotui-ide` 启动独立 Worker。
5. Worker 动态 import `aotui-ide/dist/index.js`。
6. `createTUIApp()` 暴露的 factory 把根组件挂到 `AppKernel` 提供的容器里。
7. `View` 注册成 runtime 可识别的视图实例。
8. `useViewTypeTool()` 注册的工具进入 `AppKernel.typeTools`。
9. Worker 生成 snapshot fragment，主线程聚合成 desktop snapshot。
10. `AOTUIDrivenSource` 从 snapshot 中抽取消息和 tools 给 AgentDriver。
11. LLM 调 `write_file`、`lsp_hover` 等工具时，再路由回 `aotui-ide`。

这条链路说明：**aotui-ide 并不是直接“接入模型”，而是先接入 runtime，再由 runtime 接入 agent-driver。**

### 4.3 Runtime 的边界

runtime 的边界非常清楚：

1. 它提供运行时协议，不提供文件系统业务。
2. 它提供工具调度，不提供 IDE 语义。
3. 它提供 snapshot 机制，不决定 app 的业务说明文案。
4. 它提供 ref / type tool / operation 的承载，不负责业务工具设计。

因此你不能把 `runtime` 理解成“IDE 框架业务层”，它更像一个 **Agent App micro-kernel**。

---

## 5. SDK 的能力与边界：aotui-ide 是如何基于 SDK 构建出来的

### 5.1 SDK 的核心价值

SDK 的核心不是“封装几个组件”，而是给 app 开发者一套稳定编程模型：

1. 用组件写界面。
2. 用 `View` 明确声明可快照的视图边界。
3. 用 hook 把状态、配置、持久化、tool 注册串起来。
4. 最终交给 runtime 运行。

这意味着 SDK 在做的是 **声明式 app schema**，不是业务框架胶水。

### 5.2 createTUIApp：把组件 app 变成 runtime factory

`createTUIApp()` 是 SDK 最核心的工厂。

它做了几件事：

1. 校验 `appName`。
2. 生成 `kernelConfig`。
3. 提供 `initializeComponent(container, context)`。
4. 在里面初始化 Preact 渲染。
5. 注入 `AppRuntimeContext` 和 `AppConfigContext`。

这样 runtime 不需要理解业务组件，只需要调用这个 factory。

这是一种很好的框架边界：

1. runtime 不依赖 Preact 细节。
2. app 开发者不依赖 Worker 协议细节。
3. factory 成为二者之间唯一稳定桥梁。

### 5.3 View：把普通组件节点提升为“可被 Agent 理解的界面单元”

`View` 组件的本质价值，是把普通 DOM 节点提升成 runtime 里的语义节点。

它负责：

1. 校验 View ID。
2. 创建 inline view。
3. 向 `AppKernel` 注册 / 注销 view。
4. 把 `viewId`、`viewType`、`appId`、`desktopId`、`markDirty` 放进上下文。

对于 `aotui-ide` 来说：

1. `workspace` 是固定 View。
2. `fd_0`、`fd_1` 是动态 FileDetail View。
3. `search` 是按需出现的 SearchResult View。

这使得 IDE 的可见状态不是一团文本，而是有明确结构的多视图系统。

### 5.4 useViewTypeTool：把工具绑定到“视图类型”而不是“实例”

这是 SDK 里最有框架味道的设计之一。

如果按实例注册工具：

1. 每开一个 `FileDetail` 都要再注册一套 `lsp_hover / lsp_find_references / ...`
2. 快照和 tool 列表会爆炸式重复
3. LLM 也很难理解哪些工具是同类操作

现在改成按 `viewType` 注册后：

1. 全部 `FileDetail` 共享一套 LSP tools。
2. 由调用参数中的 `file_path` 或 `view_id` 指向目标实例。
3. root view 可以按条件启用 / 禁用某类工具。

这其实是在做一个很重要的抽象：

**把“工具的定义”从“视图实例数量”中解耦出来。**

### 5.5 usePersistentState：给 app 一个可恢复的本地状态层

`usePersistentState()` 通过 `desktopId + appKey + key` 计算持久化路径，把状态写到 `AOTUI_DATA_DIR/app-state/...` 下。

这使 `aotui-ide` 可以稳定保存：

1. `activeFiles`
2. `workspaceFolders`
3. `expandedDirs`

这样 app 重开或重初始化后，不会完全失忆。

### 5.6 aotui-ide 是怎样用 SDK 搭起来的

`aotui-ide` 的实现很能说明 SDK 的定位：

1. `SystemIDEApp.tsx` 只负责组装视图和状态。
2. `RootView.tsx` 负责声明大量 workspace / file detail / search result 工具。
3. `WorkspaceContent.tsx` 负责目录树展示。
4. `FileDetailContent.tsx` 负责文件内容与 LSP 结果展示。
5. 文件系统、LSP、持久化逻辑放在 `core/`。

也就是说：

1. SDK 负责“如何声明一个 Agent App”。
2. `aotui-ide` 自己负责“IDE 具体做什么”。

### 5.7 SDK 的边界

SDK 的克制同样明显：

1. 不负责 Worker 生命周期。
2. 不负责 snapshot 聚合。
3. 不负责 AgentDriver 集成。
4. 不负责系统权限模型。

所以 SDK 不是“全栈 app 框架”，它是 **AOTUI App DSL + 组件运行适配层**。

---

## 6. Driven Source 为什么要设计出来

### 6.1 不设计 Driven Source 会发生什么

如果没有 `DrivenSource` 抽象，系统很快会变成下面这种糟糕结构：

1. session manager 直接拼系统提示词。
2. host 直接拼聊天历史。
3. runtime 直接暴露桌面状态。
4. MCP 再单独挂一套工具。
5. 技能系统再走另一套入口。
6. IM 接入又要复写一遍消息合并逻辑。

最终结果会是：

1. 消息顺序难以统一。
2. tool 归属难以判断。
3. 更新通知机制四分五裂。
4. 新 source 很难扩展。

### 6.2 Driven Source 的抽象到底是什么

`IDrivenSource` 非常克制，只有四个能力：

1. `getMessages()`
2. `getTools()`
3. `executeTool()`
4. `onUpdate()`

这四个接口刚好对应一个 source 对 LLM 的完整契约：

1. 你提供什么上下文。
2. 你提供什么能力。
3. 模型调用能力后由谁执行。
4. 你的状态变了，如何通知 AgentDriver。

这就是一个非常干净的“最小完备接口”。

### 6.3 它如何把不同 source 聚合在一起

当前 session 里，`SessionManagerV3` 会装配这些 source：

1. `SystemPromptDrivenSource`
2. `AOTUIDrivenSource`
3. `HostDrivenSourceV2`
4. `SkillDrivenSource`
5. `McpDrivenSource`

在 IM 场景里，还会有 `IMDrivenSource`。

然后 `AgentDriverV2` 做三件事：

1. 从所有 source 拉消息，按 `timestamp` 排序。
2. 从所有 source 拉工具，建立 `toolName -> source` 映射。
3. 执行 tool call 时，精确路由回拥有该工具的 source。

因此聚合不是“把字符串拼起来”，而是：

1. 统一消息协议。
2. 统一工具协议。
3. 统一更新协议。

### 6.4 AOTUIDrivenSource 为什么关键

`AOTUIDrivenSource` 是 runtime 到 AgentDriver 的桥。

它做了三件关键事：

1. 把 runtime snapshot 变成消息。
2. 从 snapshot `indexMap` 提取 app tools 和 type tools。
3. 把 tool call 再转成 runtime operation 执行。

没有这一层，runtime 只是一个本地执行环境；  
有了这一层，runtime 才真正变成 Agent 的工作台。

### 6.5 HostDrivenSource 为什么也必要

`HostDrivenSourceV2` 代表的是会话本身：

1. 用户消息
2. assistant 历史
3. tool result 历史
4. 上下文压缩工具 `context_compact`

这部分不是 app 状态，也不是系统提示词，所以不能塞给 `AOTUIDrivenSource`。

### 6.6 SystemPromptDrivenSource 为什么要独立

系统提示词单独做一个 source 有两个好处：

1. 顺序稳定，`timestamp=0`，永远在最前。
2. 提示词是可替换策略，而不是 runtime 或 host 的硬编码副作用。

这让 agent persona、topic prompt、agent prompt 的演化空间更大。

### 6.7 Driven Source 设计的真正价值

Driven Source 真正解决的是一个框架级问题：

**如何让“上下文来源的扩展”与“Agent 主循环”解耦。**

以后再增加 source，比如：

1. Browser memory source
2. CI signal source
3. Multi-agent team source
4. External event bus source

理论上都不需要改 AgentDriver 的主抽象。

这就是一个好的框架扩展点。

---

## 7. 为什么说这套系统有亮点

### 7.1 亮点一：Runtime 和 SDK 分层是对的

很多系统会把“如何写 app”和“如何运行 app”混在一起。  
这里做了比较正确的分离：

1. SDK 面向开发者体验。
2. Runtime 面向执行与隔离。

这让二者都更容易演化。

### 7.2 亮点二：View Type Tool 是一个高级抽象

这不是简单减少重复注册，而是在抽象：

1. 哪些工具是实例级的。
2. 哪些工具是类型级的。

这对 IDE、列表、多标签页、多文件分析这类 app 特别重要。

### 7.3 亮点三：Snapshot + IndexMap 是“双通道设计”

1. `markup` 给模型读。
2. `indexMap` 给系统解析。

这比“纯文本上下文”方案强很多，因为它保留了机器可追踪语义。

### 7.4 亮点四：Driven Source 让系统具备持续扩展性

系统提示词、桌面状态、聊天历史、技能、MCP、IM 都能接进来，且边界清楚。

这是后续做：

1. 多 agent
2. 多渠道 IM
3. 外部事件注入
4. 长会话上下文治理

的必要前提。

---

## 8. 目前也存在的边界与局限

从框架视角看，这套系统已经有比较清晰的骨架，但还有几个值得注意的现实边界：

### 8.1 Tool 命名和上下文解析仍然偏约定驱动

例如 type tool 的 key 生成、toolName 解析、`appId/viewType/toolName` 的约定还比较依赖字符串规则。  
这能工作，但长期看最好继续往更强类型化或统一路由元数据推进。

### 8.2 aotui-ide 里部分工具描述仍然偏应用内文案堆叠

这对当前效果有帮助，但如果未来 app 越来越多，可能需要更统一的 tool 信息架构，否则 prompt 体积会膨胀。

### 8.3 Runtime 仍以“快照驱动”作为主要感知模型

这是当前非常务实的设计，但它天然更适合文本结构明确的应用。  
如果以后要承载更复杂、事件更密、交互更细粒度的 UI，snapshot 粒度和刷新策略可能需要继续演进。

---

## 9. 最后的总结

如果把这套系统压缩成一句最核心的话：

**Agentina / AOTUI 在做的，是把传统“人用应用”的运行模型，重构成“Agent 可理解、可调用、可治理的应用运行模型”。**

其中：

1. `runtime` 是内核，负责运行、隔离、快照、调度。
2. `sdk` 是开发者界面，负责声明 app、view、tool、state。
3. `aotui-ide` 是用 SDK 写出来的 Agent IDE 样板，证明这套模型不仅能跑，而且能承载复杂工具型 app。
4. `Driven Source` 是把 system prompt、会话、桌面、MCP、技能、IM 等异构来源统一纳入 Agent 主循环的关键抽象。

它真正的产品价值不是“又一个 TUI”，而是：

1. 给 Agent 一个可控的工作环境。
2. 给框架开发者一个可扩展的能力承载模型。
3. 给应用开发者一个相对低心智负担的 Agent App 开发接口。

从框架设计角度看，这套系统最有价值的地方，不是已经做了多少 app，而是它已经把未来扩展最难的那几条边界先划对了。
