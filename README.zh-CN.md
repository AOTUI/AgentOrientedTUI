# 为 AI Agent 构建 TUI 应用

## 引言：在 AI Agent 时代重新思考 UI

几十年来，用户界面始终是为人类设计的——图形化、可交互，并围绕“眼睛 + 双手”的使用方式优化。但随着大语言模型（LLM）成为一类新的“用户”，我们必须面对一个根本问题：**当用户不是人类时，用户界面应该是什么样子？**

本文将系统讨论**面向 Agent 的文本用户界面（Agent-Oriented Text-based User Interface, TUI）**的设计原则、模式与核心动机——在这个范式中，**LLM Agent 是一等公民**。我们会梳理为什么会走向 TUI、传统 GUI 为什么不适配 AI Agent，以及如何构建让 LLM 能“看到”、理解并操作的应用，就像人类操作图形界面一样自然。

---

## 第一部分：根本差异——人类 vs. LLM

### 人类如何与 GUI 交互

先看图形用户界面（GUI）为何对人类有效：

**生理能力：**
- **眼睛**：人类通过视觉感知颜色、布局、空间关系、动画
- **双手**：人类通过鼠标、触控板、键盘来操控界面
- **连续感知**：人类对外界变化的体验是连续的

**GUI 设计含义：**
1. **视觉层级**：CSS、配色、字体、布局很重要，因为人类通过“扫视”理解界面
2. **交互控件**：按钮、输入框、滑块等，都是为指针交互设计
3. **实时反馈**：动画、hover、loading 等状态，对连续感知有意义
4. **屏幕约束**：受物理显示器分辨率限制（如 1920x1080）

### LLM 如何处理信息

再看大语言模型的本质：

**认知特征：**
- **没有眼睛**：LLM 消费的是文本 token，不是像素；看不到 CSS、颜色和空间布局
- **没有双手**：LLM 不能以传统方式点击、拖拽、输入
- **离散快照**：LLM 以离散时刻处理信息，不经历连续变化
- **上下文窗口约束**：受 token 上限限制（如 128K），而不是屏幕大小

**根本含义：**
1. **CSS 对 LLM 无意义**：LLM 无法感知“红色按钮在右上角”
2. **不存在光标**：没有 hover、没有 focus
3. **没有动画体验**：LLM 只能看到前后状态，不经历过渡过程
4. **快照驱动**：每次交互都基于应用状态的静态快照

> **核心洞察**：人类与 LLM 体验现实的“感知模态”根本不同，因此需要根本不同的界面范式。

---

## 第二部分：拆解交互——“点击”和“输入”到底是什么

在为 LLM 设计界面之前，我们先理解人类交互在语义层面的本质。

### “点击”的语义结构

当人类点击一个 UI 元素时，实际上发生了两件事：

1. **选择（上下文绑定）**
   - 选择要操作的**数据对象**
   - 隐式提供函数参数
   - 为后续动作建立上下文

2. **触发（动作调用）**
   - 执行命令
   - 推动状态迁移

### “输入”的语义结构

当人类在输入框打字时：

- **参数填充**：为函数提供显式参数
- **文本输入**：提供待处理的原始数据

### 真实例子：发消息

观察 Johnny 在微信里给 Wills 发消息：

**人类动作：**
1. **看到**联系人列表里 Wills 的头像和名字
2. **点击**Wills 的会话（选择）
3. **输入**“Hey, how are you?”（参数填充）
4. **点击**发送按钮（触发）

**底层实际发生了什么：**
1. 应用渲染联系人数据：`{id: "user_123", name: "Wills Guo", avatar: "..."}`
2. Johnny 的点击选中了这个数据对象——他并不知道 Wills 的 user ID 或 IP
3. UI 自动完成绑定：`sendMessage(recipient: User("user_123"))`
4. Johnny 填写 `message` 参数：`sendMessage(recipient: ..., message: "Hey, how are you?")`
5. 发送按钮触发：`executeAction(sendMessage)`

**洞察：**
\> 可视 UI（头像、名称、布局）本质上是一个**语义桥梁**，让 Johnny 无需知道内部数据表示，也能识别并引用目标数据。

Johnny 操作的不是用户 ID，而是**人类可读标识**；应用再把它映射回真实数据。这正是我们要为 LLM 复刻的能力。

---

## 第三部分：为 LLM 搭建语义桥梁

### 挑战

LLM 已经很擅长：
- ✅ **填参数**（`message: "Hey, how are you?"`）
- ✅ **触发函数调用**（`sendMessage(...)`）

LLM 缺的是：
- ❌ **基于视觉线索做数据选择**（头像、布局、颜色）

**问题：**LLM 看不见，怎么“选择”数据？

**答案：**把视觉标识替换为**文本标识**。

### 方案：文本化数据引用

Johnny 在 GUI 里识别 Wills：
- 视觉层：看到头像 + 名字 → 识别 “Wills Guo” → 点击
- 语义层：选择 `contacts[0]` 对应的联系人对象

在 TUI 中，我们把同样语义显式写成文本：

```markdown
## Contacts

- [Wills Guo](Contact:contacts[0])
- [Emma Chen](Contact:contacts[1])
- [Alex Johnson](Contact:contacts[2])
```

**工作机制：**
1. **人类可读标签**：`Wills Guo`（LLM“看到”的文本）
2. **语义引用**：`Contact:contacts[0]`（LLM 用于引用的数据路径）
3. **Markdown 链接语法**：LLM 熟悉这种“可点击”结构

当 LLM 要给 Wills 发消息时，它引用：

```
sendMessage(recipient: "contacts[0]", message: "Hey, how are you?")
```

应用再把 `contacts[0]` 解析为真实 `User("user_123")` 对象——与 Johnny 在 GUI 点击时的映射逻辑一致。

---

## 第四部分：TUI 的核心设计原则

### 原则 1：View 是数据容器

在 GUI 中，页面用于给人眼组织视觉信息；在 TUI 中，**View** 用于给 LLM 组织文本上下文。

**View 特征：**
- **清晰边界**：用 XML/HTML 风格结构做明确分隔
- **语义身份**：每个 View 都有 ID 与职责
- **上下文自包含**：每个 View 代表一个完整逻辑单元

**示例结构：**
```xml
\<application id="wechat" name="WeChat"\>
  \<view id="contacts" name="Contact List"\>
    \<!-- Contact data here --\>
  \</view\>
  
  \<view id="chat_wills" name="Chat with Wills"\>
    \<!-- Conversation data here --\>
  \</view\>
\</application\>
```

### 原则 2：Markdown 是渲染语言

**为什么是 Markdown？**
- ✅ **LLM 原生友好**：模型在大量 Markdown 语料上训练
- ✅ **结构化且可读**：既有层级也易阅读
- ✅ **语义链接**：`[text](reference)` 天然可做数据绑定
- ✅ **工具调用友好**：与 function calling 机制天然契合

**我们不需要：**
- ❌ CSS 样式
- ❌ 面向用户可见的 JS 事件逻辑
- ❌ 像素级布局
- ❌ 动画与过渡

### 原则 3：值驱动引用（Value-Driven References）

不要暴露内部 ID（如 `user_5f3a8b2c`），改用语义路径：

```markdown
- [Current User: Wills](User:currentUser)
- [Latest Message](Message:messages[0])
- [Active Project](Project:workspace.activeProject)
```

**好处：**
1. **自解释**：类型前缀（`Message`、`User`）表达语义
2. **路径化**：数组 / 对象路径形式易理解
3. **运行时解析**：执行操作时再解析成真实数据对象

### 原则 4：操作即函数调用

LLM 通过**工具调用（tool calls）**交互。TUI 中每个可交互元素都应映射到可调用函数。

**示例：**
```markdown
## Available Actions

- **Send Message**: `send_message(recipient: Contact, message: string)`
- **Open Chat**: `open_chat(contact: Contact)`
- **Search Contacts**: `search_contacts(query: string)`
```

LLM 发起调用时可表示为：
```json
{
  "tool": "send_message",
  "arguments": {
    "recipient": "contacts[0]",
    "message": "Hey, how are you?"
  }
}
```

---

## 第五部分：完整流程示例

下面通过一个端到端流程串起来看。

### 步骤 1：应用快照

应用向 LLM 发送如下 TUI 快照：

```xml
\<application id="wechat" name="WeChat Messenger"\>
  \<view id="contacts" name="Contact List"\>
    ## Contacts (3 total)
    
    - [Wills Guo](Contact:contacts[0]) — Online
    - [Emma Chen](Contact:contacts[1]) — Away  
    - [Alex Johnson](Contact:contacts[2]) — Offline
    
    ### Available Operations
    - **Open Chat**: Select a contact to start conversation
    - **Search**: `search_contacts(query: string)`
  \</view\>
\</application\>

\<tools\>
  - open_chat(contact: Contact) — Opens 1-on-1 chat view
  - send_message(recipient: Contact, message: string) — Sends a message
  - search_contacts(query: string) — Filters contact list
\</tools\>
```

### 步骤 2：LLM 决策并行动

用户指令：*“Send 'Hello!' to Wills”*

LLM 推理：
1. 识别 Wills：`[Wills Guo](Contact:contacts[0])`
2. 识别 `send_message` 工具
3. 构造调用：

```json
{
  "tool": "send_message",
  "arguments": {
    "recipient": "contacts[0]",
    "message": "Hello!"
  }
}
```

### 步骤 3：应用解析并执行

应用执行：
1. **解析** `contacts[0]` → `{id: "user_123", name: "Wills Guo"}`
2. **校验**操作合法性
3. **执行**发送逻辑
4. **更新状态**（新消息出现）

### 步骤 4：返回新快照

应用发送更新后的快照：

```xml
\<application id="wechat" name="WeChat Messenger"\>
  \<view id="chat_wills" name="Chat with Wills Guo"\>
    ## Conversation with [Wills](Contact:contacts[0])
    
    ### Messages
    - [You](User:currentUser): Hello! — *Just now*
    
    ### Available Operations
    - **Send Message**: `send_message(message: string)` (recipient auto-filled)
    - **Back to Contacts**: `close_view()`
  \</view\>
\</application\>
```

**注意：**
- View 从 `contacts` 切换为 `chat_wills`
- 会话出现新消息
- 收件人参数已由上下文自动填充

---

## 第六部分：关键洞察与实践模式

### 洞察 1：工具调用是命令，不是数据查询

**反例（不推荐）：**
```json
// ❌ 不要在工具调用结果里返回超大数据载荷
{
  "tool": "get_messages",
  "result": {
    "messages": [ /* 500 message objects */ ]
  }
}
```

**推荐做法：**
```json
// ✅ 只返回成功/失败，数据通过 View 反映
{
  "tool": "load_more_messages",
  "result": {"success": true, "loaded": 20}
}

// View 自动更新：
\<view id="chat"\>
  ### Messages (Showing 1-50 of 200)
  - [Message 1](Message:messages[0])
  - [Message 2](Message:messages[1])
  ...
\</view\>
```

**原因：**
- View 是数据呈现的**唯一真相源**
- 工具调用负责触发**状态迁移**
- 数据变化应体现在**View 更新或 View 切换**中

### 洞察 2：View 是短暂的数据投影

View 不必持久化，它只是某一时刻状态的快照。就像人类看网页刷新一样，LLM 接收的是：

```
旧快照 → 执行动作 → 新快照
```

LLM 不需要“追踪”每个变化过程，只需理解最新快照。

### 洞察 3：上下文是一等公民

GUI 中上下文常是隐式的（光标位置、焦点元素）；在 TUI 中，上下文必须**显式表达**：

```markdown
\<view id="chat_wills"\>
  ## Active Context
  - **Chatting with**: [Wills Guo](Contact:contacts[0])
  - **Current Topic**: Project deadline discussion
  
  ### Quick Actions
  - `send_message(message: string)` — No need to specify recipient
  - `share_file()` — Will share with Wills automatically
\</view\>
```

应用负责维护上下文，以降低 LLM 的认知负担。

---

## 第七部分：实现基础——为什么仍然用 HTML + JavaScript

你可能会问：*“既然面向文本型 LLM，为什么还要用 HTML/JavaScript？”*

### HTML/JS 的优势

1. **生态成熟**：可复用 React、Vue、Preact 等框架
2. **虚拟 DOM 能力**：可借助 LinkedOM 在服务端渲染，无需浏览器开销
3. **组件化模式**：即便是文本界面也能享受组件复用
4. **开发者熟悉**：主流开发者已有 HTML/JS 经验
5. **转换层清晰**：HTML → Markdown 的转换路径明确

### 架构流程

```
┌─────────────────────────────────────────┐
│  Developer Writes: React/Preact JSX    │
│  \<View id="contacts"\>                   │
│    \<Operation name="send_message"\>      │
│  \</View\>                                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Runtime Renders: HTML in Worker       │
│  \<div id="contacts" data-view="..."\>    │
│    \<button data-operation="..."\>        │
│  \</div\>                                 │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Transformer Converts: Markdown TUI     │
│  \<view id="contacts"\>                   │
│    ## Contacts                          │
│    - [Wills](Contact:contacts[0])       │
│  \</view\>                                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  LLM Receives: Text Snapshot            │
│  (Included in chat context)             │
└─────────────────────────────────────────┘
```

**收益：**
- 开发者使用熟悉工具链
- 运行时负责 HTML→TUI 转换复杂度
- LLM 看到的是干净、语义化的文本界面

---

## 第八部分：TUI 如何送入 LLM 上下文

**问：TUI 如何传给 LLM？**

**答：作为一条特殊的 User Message 注入上下文。**

在一次对话中可能是：

```json
[
  {
    "role": "system",
    "content": "You are an AI assistant with access to applications..."
  },
  {
    "role": "user",
    "content": "\<application\>...\</application\>\n\nUser request: Send a message to Wills"
  }
]
```

TUI 快照进入上下文后，相当于给 LLM 一块“可读屏幕”。模型随后输出工具调用，循环往复。

**关键点：**
- 快照是**按需拉取（pull-based）**的
- 快照是**不可变（immutable）**的
- 快照应**自包含（self-contained）**必要上下文

---

## 结论：为新用户建立新范式

为 AI Agent 构建应用，不是把 GUI 简化一点、去掉 CSS 就够了，而是要**从根本上重定义“界面”**——因为这个用户：
- 读的是 token，不是像素
- 调的是函数，不是点按钮
- 处理的是快照，不是连续流

**TUI 范式总结：**
- ✅ **View**：用语义容器替代视觉页面
- ✅ **Markdown**：用 LLM 原生文本替代图形渲染
- ✅ **值引用**：用路径化文本标识替代视觉识别
- ✅ **工具调用**：用函数调用替代鼠标/键盘操作
- ✅ **快照机制**：用离散状态投影替代持续 UI 流

遵循这些原则，我们就能构建出让 LLM 像人类使用 GUI 一样自然、高效的应用，从而开启**面向 Agent 的计算范式**。

---

## 下一步

本文聚焦的是 TUI 的“为什么”和“是什么”。真正落地实现还需要：

- **运行时系统（Runtime）**：管理应用生命周期、View 渲染与操作分发
- **SDK 框架**：提供开发者友好的 TUI 构建 API
- **类型安全（Type Safety）**：为 View、Operation、数据引用提供 TypeScript 类型约束
- **测试工具**：验证 TUI 快照与操作执行链路

这些实现细节在项目技术文档中会进一步展开；但核心原则不变：**为 AI 构建应用时，请以文本而非像素为中心。**
