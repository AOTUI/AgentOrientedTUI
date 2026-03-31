# AI Calendar 对 `@aotui/mobile-ai-native` 的诉求与预期

## 1. 先说结论

这套框架的方向是对的。

它已经证明了最重要的几件事：

- GUI 和 TUI 可以共享一套状态
- LLM 可以通过 snapshot + ref + tool 的方式操作应用
- tool 可以绑定到 LLM 看到的那个 `snapshotId`

但它现在更像一个 **Agent Native 核心内核 alpha**，还不是一个可以直接接进 AI Calendar 的完整移动端框架。

所以我们的诉求不是：

- 推翻现在的设计

而是：

- 保留现在的核心方向
- 把缺的基础层补齐
- 让它可以稳定承载一个真实 React Native / Expo 应用

另外有一条边界先说清楚：

- **DrivenSource 这一层由 AI Calendar 自己实现**
- 框架团队不需要替我们实现业务侧的 `DrivenSource`
- 但框架需要把底层的 state / action / snapshot / tool bridge / host adapter 打磨到足够稳定

---

## 2. 我们到底在做什么

我们不是在做：

- 一个 AI 去“假装点按钮”的系统

我们在做的是：

- 一个 App
- 人类通过 GUI 操作它
- LLM 通过 TUI tools 操作它
- 两边操作的是同一份状态
- 两边最终调用的是同一组 action

最核心的模型是：

`Runtime State -> GUI`
`Runtime State -> TUI Snapshot`
`GUI Event -> Action -> State`
`LLM Tool -> Action -> State`

这条线如果不稳，后面一切都会变脆。

---

## 3. 我们对框架的总预期

我们希望 `@aotui/mobile-ai-native` 最终成为一个 **移动端 Agent Native Runtime Core**。

它应该负责：

- 共享状态容器
- 统一 action 入口
- GUI/TUI 的状态投影
- snapshot 原子生成
- snapshot scoped tool execution
- React Native / Expo 宿主接入能力

它不需要负责：

- AI Calendar 的具体业务状态设计
- Calendar / Reminders 的业务工具
- 我们自己的 `DrivenSource`
- LLM orchestration 的完整实现

换句话说：

- 框架负责“跑道”
- 我们负责“飞机”

---

## 4. 现在这套框架最有价值的部分

这些方向我们认可，希望保留：

### 4.1 共享状态 + 共享 action

这是对的，而且是必须保留的。

人类和 LLM 不能走两套逻辑。

### 4.2 `SnapshotBundle`

这个抽象是对的。

尤其是这三个东西必须来自同一次渲染：

- `tui`
- `refIndex`
- `visibleTools`

这很关键，因为 LLM 读到的世界必须是一个原子快照。

### 4.3 `snapshotId` + `refIndex`

这个设计非常重要。

LLM 不能靠猜当前最新界面来执行动作，必须绑定到它看到的那一帧。

### 4.4 工具执行走 action，而不是走“点击”

这点也是对的。

我们要的是：

- `openItem`
- `switchTab`
- `selectDate`
- `createDraft`

而不是：

- `tapButton42`

---

## 5. 我们现在明确需要补齐的东西

下面这些不是“锦上添花”。

这些是要让框架能承载真实 AI Calendar 的 **必须项**。

### 5.1 一个真正可用的 React Native / Expo Host Adapter

## What

现在框架是 `preact` 核心。

它还不是一个真正能接进 React Native / Expo 应用的宿主适配层。

我们需要框架提供一层正式的 host adapter，至少能解决：

- 如何把 store 接进 React / React Native
- 如何在 state 更新后触发 GUI 重新渲染
- 如何在 state 更新后重新生成 TUI snapshot
- 如何把 tool bridge 接进实际 app session

## Why

现在的 demo 更像“概念跑通”。

但真实 App 里，GUI 不是 `renderToString` 一次就结束的。

真实 GUI 必须对状态变化有响应。

如果没有正式 host adapter，框架只能证明概念，不能承载产品。

## How

建议新增一个 React 侧适配层，比如：

- `createReactAppRuntime()`
- `AppRuntimeProvider`
- `useRuntimeState(selector?)`
- `useRuntimeActions()`

重点不是 API 名字，而是要有正式的 React/RN 使用方式。

### 5.2 让 GUI 变成真正响应式，而不是一次性取值

## What

现在 `useAppState()` 只是读一次 `store.getState()`。

它没有真正订阅状态变化。

## Why

这意味着真实 GUI 不会天然随着 state 变化而刷新。

对于 AI Calendar，这会直接出问题：

- LLM 调了 tool
- state 变了
- GUI 可能不刷新
- 用户就看不到 AI 的动作结果

这和我们要的目标完全相反。

## How

建议基于标准 React 订阅模式做一层正式封装。

例如用类似 `useSyncExternalStore` 的方式，把 store 变成真正可订阅的数据源。

### 5.3 ToolDefinition 不能只有名字和描述，必须有 schema

## What

现在 `visibleTools` 只有：

- `name`
- `description`

这不够。

我们需要 tool definition 至少还能表达：

- 参数 schema
- 哪些字段支持 ref
- 哪些字段是普通输入
- 这个 tool 的语义分类

## Why

LLM 调用 tool 不是靠猜参数。

如果没有 schema：

- 模型工具调用会变脆
- host 很难把 tool 转给模型 SDK
- 我们很难做动态 tool 暴露

## How

建议 `ToolDefinition` 至少扩展到：

```ts
type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: unknown;
  meta?: {
    category?: string;
    requiresConfirmation?: boolean;
    supportsRefs?: boolean;
  };
};
```

字段名可以调整，但能力必须有。

### 5.4 Snapshot 和 Tool 列表要更强地绑定“当前可见语义”

## What

框架现在已经有 `visibleTools`，这是好的。

但我们需要它更明确支持：

- 基于当前 state 动态决定 tool 是否可见
- 基于当前 view / shell / selection 动态决定 tool 输入上下文
- 基于当前 snapshot 决定哪些 ref 合法

## Why

在 AI Calendar 里，不同页面能做的事不一样。

比如：

- 在 month view 能切日期
- 在 detail sheet 能编辑当前 item
- 在没有选中 item 时不能执行 update/delete 当前项

tool visibility 必须和 state 严格同步。

## How

现有 `visibility(state)` 保留，但建议再补：

- 更明确的 tool metadata
- 更明确的 snapshot-scoped visibility contract

### 5.5 Action Runtime 需要更强的 trace / lifecycle 能力

## What

现在的 `trace` 还是空实现。

我们需要框架把 action 执行过程中的状态变化表达出来。

至少要能表达：

- action started
- action updated
- action succeeded
- action failed

## Why

AI Calendar 不是黑盒。

我们要让人类用户看到：

- AI 正在做什么
- 做到哪一步
- 为什么失败

如果没有标准 trace，产品层只能自己乱接，后面会越来越散。

## How

建议把 trace 变成正式能力，而不是空对象。

比如：

- action runtime 可以发出 trace event
- host 层可以订阅 trace
- GUI 可以显示最近一次 action summary / progress / result

### 5.6 Effect 模型要更明确，支持真实异步副作用

## What

现在有 `runEffect()`，方向对。

但要更明确：

- effect 的输入输出约束
- effect 出错时的行为
- effect 是否允许发多个事件
- effect 是否能更新 trace

## Why

AI Calendar 的很多动作都不是纯同步：

- 查询系统日历
- 写入 Calendar / Reminders
- 读权限
- OCR / speech / image import

如果 effect 契约不够清晰，复杂业务一上来就会糊掉。

## How

建议把 effect 也提升成正式的一等概念，至少文档和类型上明确：

- 输入
- 事件输出
- 错误语义
- trace 对接方式

### 5.7 需要明确的 Snapshot 生命周期管理

## What

现在 snapshot 会被 `Map` 缓存，但没有清晰的生命周期策略。

我们的默认预期是：

- **snapshot 更像一次“读屏凭证”**
- LLM 基于某个 `snapshotId` 发起一次 tool call
- 这次 tool call 一旦真正执行并导致应用状态变化
- 这个旧 snapshot 就应该默认失效

也就是说：

- **一次有效 tool call 之后，旧 snapshot 默认可销毁**
- 因为应用已经变了，应该生成新的 snapshot 给下一轮推理使用

我们需要框架明确：

- snapshot 什么时候失效
- tool call 成功后是否立即失效旧 snapshot
- tool call 失败时是否保留旧 snapshot
- stale snapshot 的错误语义
- 是否允许框架保留极少量最近快照，仅用于调试

## Why

移动端内存更敏感。

而且更重要的是：

- snapshot 代表的是“LLM 当时看到的世界”
- 一旦 action 改变了 state
- 旧 snapshot 对当前世界的描述就已经过时了

如果旧 snapshot 还长期保留并继续可执行：

- LLM 可能基于过期世界继续操作
- ref 可能指向已经无效的对象
- 行为会变得像“对幽灵界面下指令”

如果 snapshot 不做生命周期治理：

- refIndex 会越积越多
- 内存会涨
- tool 行为会变得不可预测

## How

我们推荐的默认策略是：

- `getSnapshotBundle()` 生成一个新的 snapshot
- LLM 使用这个 `snapshotId` 发起 tool call
- 如果该 tool call 被接受并进入执行流程
- 执行完成后，旧 snapshot 默认失效
- 下一轮必须重新获取新的 snapshot

可以接受的补充策略：

- 保留极少量最近 snapshot 仅用于调试
- 但这些旧 snapshot 不应继续作为正常执行依据

建议框架至少定义清楚两类失败：

- `SNAPSHOT_NOT_FOUND`
- `SNAPSHOT_STALE`

如果框架未来要支持“同一快照下连续多步工具调用”，那应该作为显式高级模式，而不是默认行为。

### 5.8 需要更清晰的“框架层”和“业务层”边界

## What

我们希望框架层非常清楚地停在这里：

- store
- action runtime
- snapshot runtime
- tool bridge
- host adapter

业务层则由应用自己实现：

- state shape
- action list
- TUI 内容
- DrivenSource
- agent driver

## Why

边界不清会导致两边都难受：

- 框架会开始长业务逻辑
- 业务会被框架绑死

我们不希望框架直接内置 calendar 语义。

我们要的是通用能力。

---

## 6. 我们明确不希望框架做的事情

这些先不要做，或者至少不是第一优先级：

- 不要替我们实现 `DrivenSource`
- 不要把 GUI 自动转成 TUI
- 不要做像“模拟点击控件”这种脆弱抽象
- 不要把动作层降级成 `tapButton`、`scrollList`
- 不要把业务状态 shape 写死成 inbox demo 那种模板

原因很简单：

- 我们要的是稳定语义层
- 不是脆弱的控件录像层

---

## 7. 对 AI Calendar 来说，框架补到什么程度就算够用

如果能达到下面这些条件，我们就认为这套框架已经可以作为 AI Calendar 的底座：

### 必须满足

- React Native / Expo 中 GUI 能真正响应 state 更新
- TUI snapshot 能从同一份 state 原子生成
- tools 能动态暴露，并附带参数 schema
- tool 执行能绑定 `snapshotId`
- stale snapshot 会稳定失败
- action / effect / trace 有清晰生命周期
- snapshot 有基本缓存治理

### 业务侧自己负责

- Calendar Runtime State 设计
- Calendar actions
- Calendar TUI 编写
- CalendarAppDrivenSource
- ConversationDrivenSource
- SystemPromptDrivenSource
- AgentDriver / run loop

---

## 8. 我们推荐的框架落点

我们建议框架最终定位为：

**Agent Native Mobile Runtime Core**

也就是：

- 它不直接等于完整 App
- 也不直接等于完整 AgentDriver
- 它负责把“共享状态 + action + snapshot + tool execution”这条主链打稳

这正好是 AI Calendar 最需要的那一层。

---

## 9. 一句话总结给框架团队

我们认可你们现在的方向。

请不要改掉“共享 state + 共享 actions + snapshot scoped tool execution”这条主线。

但请把它从“概念正确的 alpha 内核”，补成“能稳定挂到 React Native / Expo 真 App 上的运行时核心”。

`DrivenSource` 和具体业务协议，我们自己来做。
