# @aotui/sdk 开发者指南

> **版本**: 0.2.0 (Component Mode)  
> **状态**: 活跃维护  
> **依赖**: Preact ^10.0.0, linkedom ^0.18.9

## 目录

1. [概述](#1-概述)
2. [快速开始](#2-快速开始)
3. [核心概念](#3-核心概念)
4. [组件 API](#4-组件-api)
5. [Hooks API](#5-hooks-api)
6. [Operation 系统](#6-operation-系统)
7. [Adapter 层](#7-adapter-层)
8. [工具函数](#8-工具函数)
9. [完整示例](#9-完整示例)
10. [最佳实践](#10-最佳实践)
11. [错误处理](#11-错误处理)
12. [常见问题](#12-常见问题)

---

## 1. 概述

### 1.1 什么是 @aotui/sdk？

`@aotui/sdk` 是 AOTUI（Agent-Oriented Text User Interface）框架的开发者 SDK。它提供了一套基于 **Preact** 的组件和 Hooks，让开发者可以使用熟悉的 JSX 语法构建面向 LLM Agent 的文本用户界面。

### 1.2 设计理念

```
┌─────────────────────────────────────────────────────────────────┐
│                        开发者 (使用 SDK)                         │
│   使用 Preact JSX + SDK 组件/Hooks 构建 View                     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ createTUIApp() 工厂
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     @aotui/sdk Adapter 层 (Runs in Worker)       │
│   将 Preact 组件包装为 Factory Object，供 Runtime 使用             │
└──────────────────────────────┬──────────────────────────────────┘
                               │ IView 接口 (IPC-ready)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      @aotui/runtime                              │
│   Desktop Orchestrator (Main Thread) ──────▶ App Worker (Thread) │
└─────────────────────────────────────────────────────────────────┘
```

**核心原则**：

1. **语义化 HTML**：SDK 组件渲染为带有 AOTUI 语义属性的 HTML，Runtime 的 Transformer 将其转换为 Agent 可读的 Markdown
2. **有状态渲染**：使用 linkedom 持久化 DOM，支持完整的 Preact 生命周期和 Hooks
3. **组件化 Operation**：使用 `<Operation>` 组件声明操作，一处定义 UI 和处理逻辑

### 1.3 SDK 导出总览

```typescript
// 组件
// 组件
import { View, Operation } from '@aotui/sdk';

// Hooks（必须从 SDK 导入，不要从 preact/hooks 导入！）
import { 
    useState, useCallback, useEffect, useMemo, useReducer,  // Preact Hooks
    useViewContext, ViewContext,                            // AOTUI Hooks
    useRef, useArrayRef                                     // Data Binding Hooks
} from '@aotui/sdk';

// App 工厂 (Component Mode)
import { createTUIApp } from '@aotui/sdk';

// 工具函数
import { escapeHtml, escapeJsonForAttr, validateOperationName } from '@aotui/sdk';

// 类型
import type { 
    OperationResult, OperationError, ParamSchema, InferArgs,
    ViewLinkProps, ListProps, ItemProps, AppConfig, ViewConfig
} from '@aotui/sdk';
```

### 1.4 导入规范 ⚠️ 重要

> **核心原则**: App 开发者应**仅从 `@aotui/sdk` 导入**。只有 Product Layer (Server) 需要从 `@aotui/runtime` 导入。

#### App 开发者（构建 TUI 应用）

```typescript
// ✅ 正确: 所有开发需要的内容都从 @aotui/sdk 导入
import { 
    // 组件
    // 组件
    View, Operation,
    // App 工厂 (Component Mode)
    createTUIApp, defineParams,
    // Hooks (必须从 SDK 导入!)
    useState, useEffect, useViewContext, useRef, useArrayRef,
    // 类型
    type AppID, type ViewID, type OperationResult
} from '@aotui/sdk';

// ❌ 错误: App 开发者不应直接导入 Runtime
import { ViewTree } from '@aotui/runtime';  // Runtime 内部实现
```

#### Product Layer（服务器集成）

```typescript
// ✅ 正确: 服务器/Bridge 集成从 Runtime 导入
import { 
    createRuntime,          // 创建 Runtime 实例
    Bridge,                 // Agent-Desktop 桥接
    SYSTEM_TOOLS,           // LLM 系统工具
    generateToolsFromIndexMap  // 从 Snapshot 生成 Tools
} from '@aotui/runtime';
```

#### 类型优先从 SDK 导入

```typescript
// ✅ 推荐: 从 SDK 导入常用类型
import type { AppID, ViewID, OperationResult, IAOTUIApp } from '@aotui/sdk';

// ✅ 也可以: 从 Runtime 导入（两者等价）
import type { AppID, ViewID, OperationResult, IAOTUIApp } from '@aotui/runtime';
```

---

## 2. 快速开始

### 2.1 安装

```bash
npm install @aotui/sdk preact
```

### 2.2 第一个 View

```tsx
import { View, Operation, defineParams, createTUIApp, useState, useArrayRef } from '@aotui/sdk';

// 类型安全的参数定义
const addItemParams = defineParams({
    title: { type: 'string', required: true, desc: '项目标题' }
});

function TodoApp() {
    const [items, setItems] = useState<{ id: number; title: string }[]>([
        { id: 1, title: '学习 AOTUI SDK' },
        { id: 2, title: '构建第一个 App' }
    ]);
    
    // 使用 useArrayRef 创建数据引用
    const [listRef, itemRef] = useArrayRef('items', items, { itemType: 'todo' });

    return (
        <View id="todo_list" name="TodoList">
            <h1>待办事项</h1>
            
            {/* 使用 listRef 生成列表标题链接 */}
            <h2>{listRef('待办列表')}</h2>
            
            {items.length === 0 ? (
                <p>暂无待办项</p>
            ) : (
                <ul>
                    {items.map((item, idx) => (
                        <li key={item.id}>
                            {/* 使用 itemRef 生成带数据的列表项链接 */}
                            {itemRef(idx, item.title)}
                        </li>
                    ))}
                </ul>
            )}
            
            {/* Operation 组件：类型安全的参数 */}
            <Operation
                name="add_item"
                description="添加一个新项目"
                params={addItemParams}
                onExecute={async (args) => {
                    // args.title 自动推断为 string 类型
                    setItems(prev => [...prev, { id: Date.now(), title: args.title }]);
                    return { success: true };
                }}
            >
                添加
            </Operation>
        </View>
    );
}

export default createTUIApp({
    name: 'TodoList',
    component: TodoApp
});
```

### 2.3 生成的 TUI 输出

上述组件在 Runtime Transformer 处理后，Agent 将看到：

```markdown
<view id="view_0" name="TodoList">

# 待办事项

## [待办列表](todo[]:items)
1. [学习 AOTUI SDK](todo:items[0])
2. [构建第一个 App](todo:items[1])

## Operations
- [添加](operation:add_item)
    - Description: 添加一个新项目
    - Parameters:
        - title: string (required)

</view>
```

---

## 3. 核心概念

### 3.1 View

**View** 是 AOTUI 中的基本展示单元，相当于传统 GUI 中的"页面"或"屏幕"。

- 每个 View 是一个独立的 HTML 文档/组件根
- View 可以被 `mount`（挂载显示）或 `dismount`（卸载隐藏）
- View ID 由 Runtime 自动分配（如 `view_0`, `view_1`）

### 3.2 数据绑定 (useRef / useArrayRef)

AOTUI SDK 移除了旧版的 `List` 和 `Item` 组件，转而使用 Hooks 来建立数据与 TUI 标记之间的联系。

- **useArrayRef**: 用于绑定数组数据。返回 `[listRef, itemRef]` 格式化函数。
- **useRef**: 用于绑定单个对象数据。返回 `ref` 格式化函数。
- **机制**: 这些 Hooks 会在组件渲染时自动将数据注册到 View 的 `RefRegistry` 中，Runtime 在生成 Snapshot 时会从 Registry 中提取数据 payload。

### 3.3 Operation

**Operation** 是 View 暴露给 Agent 的可执行操作。

- 类似函数调用：名称 + 参数 + 处理逻辑
- Agent 通过 Function Calling 调用 Operation
- 命名格式：`{app_id}-{view_id}-{operation_id}`

### 3.4 ViewContext

**ViewContext** 是 SDK 提供给组件的运行时上下文，包含：

- `viewId`: 当前 View ID
- `appId`: 父 App ID
- `desktopId`: Desktop ID（用于加载相关数据）
- `store`: 持久化存储接口
- `markDirty()`: 触发 UI 更新
- `registerOperation()`: 注册操作处理器
- `registerExternalEvent()`: 注册外部事件处理器

---

## 4. 组件 API

### 4.1 View

根容器组件，标记一个 View 的边界。

```tsx
import { View } from '@aotui/sdk';

interface ViewProps {
    /** View 显示名称（展示在 TUI 中） */
    name: string;
    /** 子元素 */
    children?: ComponentChildren;
}

// 使用
<View name="Conversation">
    <h1>对话详情</h1>
    {/* 内容 */}
</View>
```

**渲染输出**：

```html
<div view="Conversation">
    <h1>对话详情</h1>
</div>
```

**Transformer 转换后**：

```markdown
<view id="view_0" name="Conversation">
# 对话详情
...
</view>
```

---

### 4.2 数据绑定 (useArrayRef / useRef)

使用 Hooks 将数据与 TUI 标记绑定，替代旧版的 List/Item 组件。

```tsx
import { useArrayRef, useRef } from '@aotui/sdk';

// 1. 数组绑定
function MessageList({ messages }) {
    // 注册 messages 数组，生成格式化函数
    const [listRef, itemRef] = useArrayRef('messages', messages, { itemType: 'message' });

    return (
        <div>
            {/* 生成列表标题链接: [消息历史](message[]:messages) */}
            <h2>{listRef('消息历史')}</h2>
            
            <ul>
                {messages.map((msg, idx) => (
                    <li key={msg.id}>
                        {/* 生成列表项链接: [Hello](message:messages[0]) */}
                        {itemRef(idx, msg.content)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// 2. 单对象绑定
function UserProfile({ user }) {
    // 注册 user 对象
    const userRef = useRef('current_user', user);

    return (
        <div>
            {/* 生成对象链接: [User Profile](current_user) */}
            <h3>{userRef('User Profile')}</h3>
            <p>Name: {user.name}</p>
        </div>
    );
}
```

> **原理**: 这些 Hooks 会在渲染时将数据注册到 View 的 `RefRegistry`。生成的 Markdown 链接（如 `messages[0]`）被 Agent 引用时，Runtime 会从 Registry 中查找到对应的原始数据对象。

---

### 4.4 ViewLink

创建指向可挂载子 View 的链接（同 App 内导航）。

```tsx
import { ViewLink } from '@aotui/sdk';

// 支持泛型类型参数，提供 params 类型检查
interface ViewLinkProps<P extends Record<string, unknown> = Record<string, unknown>> {
    /** 目标 View 名称 */
    target: string;
    /** 传递给目标 View 的动态参数 */
    params?: P;
    /** 描述文字（显示给 Agent） */
    desc?: string;
    /** 链接文本 */
    children: ComponentChildren;
}

// 静态目标（无泛型，兼容现有代码）
<ViewLink target="Conversations" desc="会话列表">
    打开会话
</ViewLink>

// 动态参数（无泛型）
<ViewLink target="Conversation" params={{ id: conv.id }} desc="打开对话">
    对话 #{conv.id}
</ViewLink>

// 类型安全（使用泛型）
interface ConversationParams {
    topicId: string;
}
<ViewLink<ConversationParams>
    target="Conversation"
    params={{ topicId: '123' }}  // ✅ 编译时类型检查
    desc="打开对话"
>
    对话
</ViewLink>
```

**渲染输出**：

```html
<a view-target="Conversations" desc="会话列表">打开会话</a>
```

---

## 5. Hooks API

> **⚠️ 重要**：必须从 `@aotui/sdk` 导入 Hooks，不要从 `preact/hooks` 直接导入！
>
> ```tsx
> // ✅ 正确
> import { useState, useEffect, useCallback } from '@aotui/sdk';
> 
> // ❌ 错误 - 可能导致多 Preact 实例问题
> import { useState, useEffect } from 'preact/hooks';
> ```

### 5.1 Preact Hooks（再导出）

SDK 再导出以下 Preact Hooks，确保使用同一个 Preact 实例：

- `useState`
- `useEffect`
- `useCallback`
- `useRef`
- `useMemo`
- `useReducer`

用法与标准 Preact/React Hooks 完全一致。

---

### 5.2 useViewContext

获取当前 View 的运行时上下文。

```tsx
import { useViewContext } from '@aotui/sdk';

function MyComponent() {
    const ctx = useViewContext();
    
    console.log(ctx.viewId);      // 'view_0'
    console.log(ctx.appId);       // 'app_0'
    console.log(ctx.desktopId);   // 'desktop_123'
    
    // 使用 store 进行持久化
    useEffect(() => {
        ctx.store.get('config').then(config => {
            // ...
        });
    }, []);
    
    // 手动触发更新
    const handleChange = () => {
        // 修改状态后...
        ctx.markDirty();
    };
}
```

**ViewContextValue 接口**：

```typescript
interface ViewContextValue {
    viewId: string;
    appId: string;
    desktopId: string;
    store: IAppStore;
    markDirty: () => void; // 替代 notifyUpdate
    registerOperation: (name: string, handler: OperationHandler) => void;
    unregisterOperation: (name: string) => void;
    registerExternalEvent: <T>(eventType: string, handler: ExternalEventHandler<T>) => void;
    unregisterExternalEvent: (eventType: string) => void;
}
```

---

### 5.3 useExternalEvent

订阅来自 Product Layer 的外部事件（如人类用户操作）。

```tsx
import { useExternalEvent } from '@aotui/sdk';

interface UserMessageEvent {
    message: {
        content: string;
        timestamp: number;
    };
}

function ChatView() {
    const [messages, setMessages] = useState<Message[]>([]);
    
    // 处理人类用户发送的消息
    useExternalEvent<UserMessageEvent>('user_message', (event) => {
        setMessages(prev => [...prev, {
            role: 'human',
            content: event.message.content,
            timestamp: event.message.timestamp
        }]);
    }, []);  // 依赖数组
    
    return <View name="Chat">...</View>;
}
```

**参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `eventType` | `string` | 事件类型标识符 |
| `handler` | `ExternalEventHandler<T>` | 事件处理函数 |
| `deps` | `unknown[]` | 依赖数组（类似 useCallback） |

**工作原理**：

1. Product Layer 调用 `desktop.injectEvent(eventType, data)`
2. Runtime 将事件路由到对应 App
3. App 调用 View 的 `onExternalEvent`
4. SDK 内部调用注册的 handler

---

## 6. Operation 系统

Operation 是 AOTUI SDK 的核心机制，用于定义 Agent 可执行的操作。

> **📢 v0.2.0 更新**：推荐使用新的 **组件化 Operation API**，旧的 `defineOperation` + `useDefinedOperation` 模式已弃用。

### 6.1 Operation 组件（推荐）

使用 `<Operation>` 组件声明 Agent 可执行的操作，无需分离定义和注册：

```tsx
import { Operation, View, useState } from '@aotui/sdk';

function TodoComponent() {
    const [items, setItems] = useState<string[]>([]);

    return (
        <View name="Todo">
            <h1>待办事项</h1>
            
            {/* 简洁的 Operation 声明 */}
            <Operation
                name="add_item"
                description="添加新项目"
                onExecute={async ({ title }) => {
                    setItems(prev => [...prev, title as string]);
                    return { success: true };
                }}
            >
                <Operation.Param name="title" type="string" required desc="项目标题" />
                添加
            </Operation>
        </View>
    );
}
```

**优势**：

- ✅ **一处定义**：UI、参数、处理逻辑都在组件内
- ✅ **直接访问状态**：handler 自然获得闭包内的组件状态
- ✅ **符合 React/Preact 模式**：像使用普通组件一样使用

---

### 6.2 类型安全的参数定义

使用 `defineParams()` 辅助函数定义参数，获得完整的类型推断：

```tsx
import { Operation, defineParams } from '@aotui/sdk';

// 定义参数 schema
const searchParams = defineParams({
    keyword: { type: 'string', required: true, desc: '搜索关键词' },
    limit: { type: 'number', desc: '最大结果数' }
});

// 使用 - args 自动推断类型
<Operation
    name="search"
    description="搜索"
    params={searchParams}
    onExecute={async (args) => {
        args.keyword  // ✅ string
        args.limit    // ✅ number | undefined
        args.typo     // ❌ 编译错误
        return { success: true };
    }}
>
    搜索
</Operation>
```

**参数类型**：

| type | TypeScript 类型 |
|------|---------------|
| `'string'` | `string` |
| `'number'` | `number` |
| `'boolean'` | `boolean` |
| `'object'` | `Record<string, unknown>` |

---

### 7.4 TUIAppConfig (createTUIApp)

`createTUIApp` 用于定义应用配置。

```typescript
interface TUIAppConfig {
    name: string;
    component: ComponentType;
    onOperation?: AppOperationHandler;
    onDelete?: (context: AppContext) => Promise<void>;
    launchConfig?: Record<string, unknown>;
}
```

```tsx
// 示例：Thought Recorder
const app = createTUIApp({
    name: 'thought-recorder',
    component: ThoughtApp,
});
```

### 7.5 OperationResult 与 错误处理

Operation 处理函数返回统一的结果类型：

```typescript
interface OperationResult {
    success: boolean;
    data?: unknown;
    error?: OperationError;
}

interface OperationError {
    /** 错误代码（机器可读） */
    code: string;
    /** 错误描述（人类可读） */
    message: string;
    /** 额外上下文（可选，用于调试） */
    context?: Record<string, unknown>;
}
```

**示例**：

```tsx
onExecute={async (args) => {
    if (!args.content) {
        return {
            success: false,
            error: {
                code: 'E_INVALID_ARGS',
                message: 'Content is required'
            }
        };
    }
    
    try {
        await sendMessage(args.content);
        return { success: true };
    } catch (e) {
        return {
            success: false,
            error: {
                code: 'E_SEND_FAILED',
                message: e.message,
                context: { originalError: e }
            }
        };
    }
}}
```

---

### 6.4 完整 Props 接口

```typescript
import { ParamSchema, InferArgs } from '@aotui/sdk';

interface OperationProps<T extends ParamSchema = ParamSchema> {
    /** Operation ID（snake_case 格式） */
    name: string;
    /** 描述（显示给 Agent） */
    description?: string;
    /** 参数定义（用于类型推断） */
    params?: T;
    /** 处理函数（args 类型自动从 params 推断） */
    onExecute: (args: InferArgs<T>) => Promise<OperationResult> | OperationResult;
    /** 子元素：按钮文本 */
    children?: ComponentChildren;
}
```

```

---

### 6.5 Operation 命名规范

Operation 名称必须符合 **snake_case** 格式：

```tsx
// ✅ 有效名称
'send_message'
'get_user_info'
'delete_item'
'search'

// ❌ 无效名称（会在开发环境抛出错误）
'SendMessage'      // PascalCase
'send-message'     // kebab-case（连字符保留给路径分隔符）
'123_op'           // 以数字开头
```

验证工具：

```typescript
import { validateOperationName, assertValidOperationName } from '@aotui/sdk';

validateOperationName('send_message');  // true
validateOperationName('Send-Message');  // false

assertValidOperationName('invalid-op');  // 抛出 Error
```

---

### 6.6 遗留 API（已弃用）

> ⚠️ **弃用警告**：`defineOperation` 和 `useDefinedOperation` 已弃用，请迁移到组件化 API。

<details>
<summary>点击展开旧 API 文档</summary>

#### defineOperation（已弃用）

```tsx
// ❌ 旧方式 - 需要两步
const SendMessage = defineOperation({
    name: 'send_message',
    description: '发送消息',
    params: [{ name: 'content', type: 'string', required: true }],
    handler: async () => ({ success: true })  // 占位符
});

function Component() {
    // 第二步：覆盖 handler
    useDefinedOperation(SendMessage, async (args) => {
        // 实际逻辑
        return { success: true };
    });
    
    return <SendMessage.Operation>发送</SendMessage.Operation>;
}
```

#### 迁移指南

```tsx
// ❌ 旧方式
const Op = defineOperation({ name: 'op', ... });
useDefinedOperation(Op, handler);
<Op.Operation>按钮</Op.Operation>

// ✅ 新方式
<Operation name="op" onExecute={handler}>
    <Operation.Param ... />
    按钮
</Operation>
```

</details>

---

## 7. Adapter 层

### 7.1 <View> 组件

在 Component Mode 中，用 `<View>` 明确 View 边界，SDK 会在运行时为每个 `<View>` 创建对应的 IView 实例。

**示例**：

```tsx
import { View, createTUIApp } from '@aotui/sdk';

function ConversationApp() {
    return (
        <View id="conversation" name="Conversation">
            ...
        </View>
    );
}

export default createTUIApp({
    name: 'Conversation',
    component: ConversationApp
});
```

---

### 7.2 IView 接口

SDK 会为每个 `<View>` 生成符合此接口的对象：

```typescript
interface IView {
    /** View ID (由 Runtime 分配或传入) */
    id: string;
    /** View 语义名称 */
    name: string;
    /** 允许 Runtime 重新设置 ID */
    setId?(newId: string): void;
    
    /** 挂载时调用 */
    onMount(ctx: RuntimeViewContext): Promise<void>;
    /** 卸载时调用 */
    onDismount(): Promise<void>;
    /** 处理 Agent 命令 */
    onOperation(operation: string, args: Record<string, unknown>): Promise<CommandAck>;
    /** 处理外部事件 */
    onExternalEvent?(eventType: string, data: Record<string, unknown>): Promise<void>;
    /** 渲染 HTML 字符串 */
    render(): string;
}
```

---

### 7.3 RuntimeViewContext

App 在挂载 View 时提供的上下文：

```typescript
interface RuntimeViewContext {
    appId: string;
    desktopId: string;
    store: IAppStore;
    notifyUpdate: () => void;
}
```

---

## 8. 工具函数

### 8.1 HTML 转义

```typescript
import { escapeHtml, escapeJsonForAttr } from '@aotui/sdk';

// 转义 HTML 特殊字符
escapeHtml('<script>alert("xss")</script>');
// → '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'

// 转义 JSON 用于 HTML 属性
escapeJsonForAttr({ key: "value's" });
// → '{"key":"value&#39;s"}'
```

### 8.2 验证函数

```typescript
import { 
    validateOperationName,
    validateAppId,
    validateViewId,
    validateFunctionName,
    assertValidOperationName
} from '@aotui/sdk';

// Operation 名称验证（snake_case）
validateOperationName('send_message');  // true
validateOperationName('SendMessage');   // false

// App ID 验证（app_N 格式）
validateAppId('app_0');   // true
validateAppId('my-app');  // false

// View ID 验证（view_N 格式）
validateViewId('view_1');     // true
validateViewId('view_001');   // false

// Function Name 验证（完整调用路径）
validateFunctionName('app_0-view_1-send_message');  // true
validateFunctionName('system-open_app');            // true

// 断言（无效时抛出 Error）
assertValidOperationName('send_message');      // 通过
assertValidOperationName('invalid-op');        // 抛出 Error
```

---

## 9. 完整示例

### 9.1 Chat App 组件

一个完整的聊天应用 View 实现：

```tsx
// ChatApp.tsx
import {
    useState,
    useEffect,
    View,
    List,
    Item,
    useViewContext,
    useExternalEvent,
    defineOperation,
    useDefinedOperation
} from '@aotui/sdk';

// ================= 类型定义 =================

interface Message {
    id: string;
    role: 'human' | 'agent';
    content: string;
    timestamp: number;
}

interface SendMessageArgs {
    content: string;
}

interface UserMessageEvent {
    message: {
        content: string;
        timestamp?: number;
    };
}

// ================= 组件 =================

function ChatApp() {
    const ctx = useViewContext();
    const [messages, setMessages] = useState<Message[]>([]);

    // 1. 加载历史消息
    useEffect(() => {
        ctx.store.list<Message>('messages').then(history => {
            if (history.length > 0) {
                setMessages(history);
            }
        });
    }, [ctx.desktopId]);

    // 2. 处理人类用户消息
    useExternalEvent<UserMessageEvent>('user_message', (event) => {
        const msg: Message = {
            id: `msg_${Date.now()}`,
            role: 'human',
            content: event.message.content,
            timestamp: event.message.timestamp || Date.now()
        };
        setMessages(prev => [...prev, msg]);
        // 持久化
        ctx.store.push('messages', msg);
    }, []);

    // 3. 处理 Agent 发送消息
    const handleSendMessage = async (args: Record<string, unknown>) => {
        const { content } = args as SendMessageArgs;
        const msg: Message = {
            id: `msg_${Date.now()}`,
            role: 'agent',
            content,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, msg]);
        // 持久化
        await ctx.store.push('messages', msg);
        return { success: true, data: { messageId: msg.id } };
    };

    // 4. 渲染
    return (
        <View id="chat" name="Chat">
            <h2>对话</h2>

            {messages.length === 0 ? (
                <p><em>暂无消息</em></p>
            ) : (
                <>
                    <h3>消息历史</h3>
                    <List name="messages" itemType="message">
                        {messages.map(msg => (
                            <Item key={msg.id} data={msg as Record<string, unknown>}>
                                {msg.role === 'agent' ? 'You' : msg.role}: {msg.content}
                            </Item>
                        ))}
                    </List>
                </>
            )}

            <hr />
            <h4>可用操作</h4>
            <Operation
                name="send_message"
                description="回复用户消息"
                onExecute={handleSendMessage}
            >
                <Operation.Param name="content" type="string" required desc="消息内容" />
                回复
            </Operation>
        </View>
    );
}

export default ChatApp;
```

### 9.2 创建 App

```typescript
// ChatAppEntry.ts
import { createTUIApp } from '@aotui/sdk';
import ChatApp from './ChatApp.js';

export default createTUIApp({
    name: 'System Chat',
    component: ChatApp
});
```

---

## 10. 最佳实践

### 10.1 Hook 导入

**始终从 SDK 导入 Hooks**：

```tsx
// ✅ 正确
import { useState, useEffect, useCallback } from '@aotui/sdk';

// ❌ 错误 - 可能导致 Preact 多实例问题
import { useState } from 'preact/hooks';
```

### 10.2 Operation 命名

**使用语义化的 snake_case 名称**：

```tsx
// ✅ 好的命名
'send_message'
'create_topic'
'delete_conversation'
'mark_as_read'

// ❌ 避免的命名
'op1'           // 无意义
'doSomething'   // camelCase
'SEND_MESSAGE'  // UPPER_CASE
```

### 10.3 数据持久化

**TUI Views 应该是"纯展示层"**：

- 使用 `store` 进行持久化，不要在组件内维护需要跨会话保留的状态
- 外部事件触发状态变化时，同时更新 `store`

```tsx
useExternalEvent('user_message', (event) => {
    const msg = createMessage(event);
    setMessages(prev => [...prev, msg]);
    ctx.store.push('messages', msg);  // 持久化
}, []);
```

### 10.4 List 数据

**Item 的 data 属性应包含完整的实体数据**：

```tsx
// ✅ 完整数据
<Item data={{ id: 'msg_1', role: 'human', content: 'Hello', timestamp: 1234567890 }}>
    Hello
</Item>

// ❌ 不完整 - Agent 无法获取完整上下文
<Item data={{ id: 'msg_1' }}>
    Hello
</Item>
```

### 10.5 Operation Handler 覆盖

**需要访问组件状态时，使用 useDefinedOperation 的第二个参数覆盖 handler**：

```tsx
const MyOp = defineOperation({
    name: 'my_op',
    handler: async () => ({ success: true })  // 默认占位
});

function MyComponent() {
    const [state, setState] = useState(0);
    
    // 覆盖 handler 以访问 state
    useDefinedOperation(MyOp, async (args) => {
        // 这里可以访问 state
        setState(prev => prev + 1);
        return { success: true };
    });
}
```

---

## 11. 错误处理

### 11.1 SDK 错误处理理念

SDK 层注重开发者体验 (DX)，因此大多数错误使用原生 JavaScript `Error` 抛出，以保留完整的调用栈和上下文信息。

### 11.2 捕获 Runtime 错误

尽管 SDK 使用原生 Error，AOTUI Runtime 可能会抛出结构化的 `AOTUIError`。你可以使用 `AOTUIError.is()` 来检测并处理这些错误：

```typescript
import { AOTUIError } from '@aotui/sdk';

try {
    await someOperation();
} catch (e) {
    if (AOTUIError.is(e)) {
        // 处理 Runtime 错误 (如 VIEW_NOT_FOUND)
        console.error(`Runtime Error [${e.code}]:`, e.context);
    } else {
        // 处理普通错误
        console.error('Unknown error:', e);
    }
}
```

### 11.3 常见错误代码

开发者在使用 SDK 时可能遇到的 Runtime 错误：

| 错误码 | 说明 | 可能原因 |
|--------|------|----------|
| `VIEW_NOT_FOUND` | 视图未找到 | 尝试挂载或链接到不存在的 View 名称 |
| `APP_NOT_FOUND` | 应用未找到 | Application 实例未正确注册或已卸载 |
| `OPERATION_NO_HANDLER` | 操作无处理器 | 定义了 Operation 但未提供 `onExecute` 或者是旧版 API 使用不当 |
| `SNAPSHOT_EXPIRED` | 快照过期 | 长时间未操作导致 View 数据失效，SDK 通常会自动处理 |

---

## 12. 常见问题

### Q1: 为什么必须从 SDK 导入 Hooks？

**A**: Node.js 的 `node_modules` 解析可能导致多个 Preact 实例共存。如果你的组件使用一个实例，而 SDK 内部使用另一个实例，Hooks 会失效（如 `useState` 状态不更新）。SDK 再导出 Hooks 确保所有代码使用同一个 Preact 实例。

### Q2: Operation handler 中如何访问最新的组件状态？

**A**: SDK 使用 `useRef` 模式保存最新 handler 引用。每次 render 时 `handlerRef.current` 都会更新，因此你在 `useDefinedOperation` 中传入的 override handler 总是能访问到最新的闭包状态。

### Q3: 为什么 View 的 ID 是 Runtime 分配的？

**A**: 这是 AOTUI 的设计原则——**ID 分配是 Runtime 的职责**。开发者只需定义语义名称（如 "Conversation", "Settings"），Runtime 按照规则分配唯一 ID（如 `view_0`, `view_1`）。这样可以：

- 避免 ID 冲突
- 支持多实例 View
- 简化开发者心智负担

### Q4: 如何处理复杂的嵌套 View？

**A**: 使用 `ViewLink` 组件创建可挂载的子 View 链接。Agent 可以通过 `system-mount_view` 命令动态挂载这些 View。

```tsx
<View name="Navigation">
    <ViewLink target="Conversations" desc="会话列表">会话</ViewLink>
    <ViewLink target="Settings" desc="设置页面">设置</ViewLink>
</View>
```

### Q5: Store 的 KV 和 List 操作有什么区别？

**A**:

- **KV 操作**（`get`, `set`, `delete`, `has`）：用于单值存储，如配置、用户偏好
- **List 操作**（`push`, `list`, `clear`）：用于追加型数据，如消息历史、日志

```tsx
// KV 操作
await store.set('theme', 'dark');
const theme = await store.get<string>('theme');

// List 操作
await store.push('messages', newMessage);
const messages = await store.list<Message>('messages', { limit: 50 });
```

---

## 附录

### A. 类型定义参考

完整类型定义请参考 SDK 源码：

- [components/index.ts](./src/components/index.ts) - 组件导出
- [hooks/context.ts](./src/hooks/context.ts) - Context 类型
- [components/View.tsx](./src/components/View.tsx) - View 组件实现
- [utils/validation.ts](./src/utils/validation.ts) - 验证工具

### B. 相关文档

- [AOTUI Spec.md](../AOTUI%20Spec.md) - AOTUI 规范
- [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) - 系统设计蓝图
- [TUI_DEMO.md](../TUI_DEMO.md) - TUI 概念演示
- [USER_JOURNEY.md](../USER_JOURNEY.md) - 用户旅程文档

---

*文档版本: 0.1.0 | 最后更新: 2025-12-26*
