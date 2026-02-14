# AOTUI Runtime Developer Guide

> **Version**: 1.0.0  
> **Status**: Released  
> **Target**: App Developers & Framework Contributors

---

## 目录

- [1. 简介](#1-简介)
- [2. 架构概览](#2-架构概览)
- [3. 快速开始](#3-快速开始)
- [4. 核心概念](#4-核心概念)
- [5. SDK 使用指南](#5-sdk-使用指南)
- [6. SPI 接口参考](#6-spi-接口参考)
- [7. Agent Session API](#7-agent-session-api)
- [8. 系统操作参考](#8-系统操作参考)
- [9. Snapshot 生命周期](#9-snapshot-生命周期)
- [10. 错误处理](#10-错误处理)
- [11. 测试指南](#11-测试指南)

---

## 1. 简介

### 什么是 AOTUI Runtime？

AOTUI (Agent-Oriented Text User Interface) Runtime 是一个**确定性状态机**，用于桥接 LLM (大语言模型) 和 HTML5 应用程序。它将传统的 GUI 转换为 LLM 可理解的语义化文本界面。

### 核心理念

1. **去视觉化 (De-visualized)**: 界面是语义数据，而非像素
2. **值驱动 (Value-Driven)**: 操作是函数调用，而非点击
3. **时间安全 (Time-Safe)**: 状态被快照，操作可基于历史状态执行

### 何时使用此 Runtime？

- 需要让 LLM Agent 与应用程序交互
- 需要将 Web 应用暴露为 Function Calling 接口
- 需要实现 Agent-Human 协作的产品

---

## 2. 架构概览

### 2.1 微内核架构

```
┌─────────────────────────────────────────────────────────────┐
│                    SDK Layer (L4)                           │
│  开发者友好的门面，隐藏内部复杂性                              │
├─────────────────────────────────────────────────────────────┤
│                  Adapters Layer (L3)                        │
│  可替换的适配器 (Bridge, LLM Adapter)                        │
├─────────────────────────────────────────────────────────────┤
│                   Engine Layer (L2)                         │
│  核心引擎 (Desktop, Transformer, Dispatcher, Registry)      │
├─────────────────────────────────────────────────────────────┤
│                   Kernel Layer (L1)                         │
│  编排器，协调各模块                                          │
├─────────────────────────────────────────────────────────────┤
│                    SPI Layer (L0)                           │
│  纯接口定义，零实现代码                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 |
|------|------|
| **Kernel** | 编排器，管理 Desktop 生命周期，协调 Snapshot/Operation |
| **Desktop** | 隔离沙箱，托管多个 App，提供 LinkeDOM 环境 |
| **Registry** | Snapshot 存储，引用计数，TTL 安全机制<br>**ViewRegistry**: 管理所有活跃 View 实例 (SSOT) |
| **Transformer** | DOM → TUI Markdown 转换 |
| **Dispatcher** | Operation → DOM Event 分发 |

### 2.3 数据流

```
Agent ──(Operation)──▶ Kernel ──▶ Dispatcher ──▶ Desktop/App
                                                      │
Agent ◀──(Snapshot)── Kernel ◀── Registry ◀── Transformer
```

---

## 3. 快速开始

### 3.1 安装

```bash
npm install @aotui/runtime
```

### 3.2 创建 Runtime

```typescript
import { createRuntime } from '@aotui/runtime';

// 使用默认配置创建 Runtime
const runtime = createRuntime();

// 或自定义 Snapshot TTL
const runtime = createRuntime({
    snapshotTTL: 5 * 60 * 1000  // 5 分钟
});
```

### 3.3 创建 Desktop 和安装 Worker App

```typescript
// 1. 创建 Desktop
const desktopId = await runtime.createDesktop();

// 2. 安装 Worker App
await runtime.installDynamicWorkerApp(desktopId, 
    require.resolve('./my-app'),
    require.resolve('./worker-script')
);
```

### 3.4 获取 Snapshot

```typescript
// 获取 Desktop 当前状态的 Snapshot
const snapshot = await runtime.acquireSnapshot(desktopId);

console.log(snapshot.markup);  // TUI Markdown
console.log(snapshot.id);      // Snapshot ID (如 "snap_1703922000_abc123")

// 使用完毕后释放
runtime.releaseSnapshot(snapshot.id);
```

### 3.5 执行 Operation

```typescript
// 1. 获取锁
runtime.acquireLock(desktopId, 'agent_001');

// 2. 执行操作
const result = await runtime.execute(desktopId, {
    context: {
        appId: 'app_0',
        viewId: 'view_0',
        snapshotId: snapshot.id
    },
    name: 'send_message',
    args: { content: 'Hello!' }
}, 'agent_001');

// 3. 释放锁
runtime.releaseLock(desktopId, 'agent_001');

console.log(result);  // { success: true } 或 { success: false, error: {...} }
```

---

## 4. 核心概念

### 4.1 Desktop

**Desktop** 是一个隔离的运行时编排器，托管多个运行在独立 Worker Thread 的 App。

- **Worker 隔离**: 每个 App 运行在独立的 Node.js Worker Thread 中
- **DOM 隔离**: 每个 Worker 拥有独立的 LinkedOM 实例 (One App = One DOM)
- **安全沙箱**: App 无法访问主线程或其他 App 的内存空间
- **IPC 通信**: 通过 `AppWorkerHost` 进行全异步消息通信

```typescript
interface IDesktop {
    id: DesktopID;
    
    // App 管理
    // installApp 被移除，请使用 Kernel.installDynamicWorkerApp
    openApp(appId: AppID): Promise<void>;
    closeApp(appId: AppID): Promise<void>;
    
    // View 管理
    mountView(appId: AppID, viewId: ViewID): Promise<void>;
    dismountView(appId: AppID, viewId: ViewID): Promise<void>;
    
    // 信号输出
    output: {
        subscribe(listener: (signal: UpdateSignal) => void): void;
        unsubscribe(listener: (signal: UpdateSignal) => void): void;
    };
}
```

### 4.2 App

**App** 是 Desktop 中的应用程序。支持两种模式：

#### Worker App (推荐)

```typescript
await runtime.installDynamicWorkerApp(desktopId, 
    '/absolute/path/to/app/index.js',
    '/absolute/path/to/worker/script.js'
);
```

#### 动态 App (IAOTUIApp 实例)

```typescript
class MyApp implements IAOTUIApp {
    readonly name = 'My App';
    id?: AppID;  // 由 Runtime 分配

    async onOpen(context: AppContext, container: HTMLElement): Promise<void> {
        // 初始化
    }

    async onClose(): Promise<void> {
        // 清理资源
    }

    async onOperation(
        context: OperationContext,
        operation: OperationID,
        args: Record<string, unknown>
    ): Promise<OperationResult> {
        // 处理操作
        return { success: true };
    }
}
```

### 4.3 View

**View** 是 App 内部的 UI 组件单元。

```typescript
interface IView {
    readonly id: ViewID;          // 由 Runtime 分配
    readonly name?: string;       // 开发者定义的语义名称
    
    onMount(context: IViewContext): Promise<void>;
    onDismount(): Promise<void>;
    onOperation(operation: OperationID, args: Record<string, unknown>): Promise<OperationResult>;
    render(): string;  // 返回 TUI Markdown
}
```

### 4.4 Operation

**Operation** 是 Agent 发送的操作指令。

```typescript
interface Operation {
    context: {
        appId: AppID;
        viewId?: ViewID;
        snapshotId: SnapshotID;
    };
    name: OperationID;                    // 如 'send_message'
    args: Record<string, unknown>;        // 操作参数
}
```

### 4.5 Snapshot

**Snapshot** 是 Desktop 状态的时间安全快照。

```typescript
interface CachedSnapshot {
    id: SnapshotID;                       // 唯一标识
    indexMap: IndexMap;                   // 路径 -> 数据映射
    markup: string;                       // TUI Markdown
    createdAt: number;                    // 创建时间戳
    refCount: number;                     // 引用计数
    ttl: number;                          // 生存时间
    expiresAt: number;                    // 过期时间戳
}

// IndexMap 示例
{
    "messages[0]": { id: "msg_101", content: "Hello" },
    "messages[1]": { id: "msg_102", content: "World" }
}
```

---

## 5. SDK 使用指南

### 5.1 AOTUIApp 基类

适用于简单的单 View 应用。

```typescript
import { AOTUIApp } from '@aotui/runtime';

class SimpleApp extends AOTUIApp {
    readonly name = 'Simple App';

    protected async initialize(): Promise<void> {
        // 初始化逻辑，在 onOpen 时调用
        this.render('<div view="Main"><h1>Hello</h1></div>');
    }

    async onOperation(
        context: OperationContext,
        operation: string,
        args: Record<string, unknown>
    ): Promise<OperationResult> {
        if (operation === 'greet') {
            console.log('Greeting:', args.name);
            return { success: true };
        }
        return { success: false, error: { code: 'E_UNKNOWN', message: 'Unknown operation' } };
    }
}
```

**AOTUIApp 生命周期方法：**

| 方法 | 调用时机 | 用途 |
|------|----------|------|
| `initialize()` | `onOpen()` 时 | 初始化数据、渲染 UI |
| `cleanup()` | `onClose()` 时 | 清理资源 |
| `pause()` | `onPause()` 时 | Desktop 暂停时调用 |
| `resume()` | `onResume()` 时 | Desktop 恢复时调用 |

**辅助方法：**

| 方法 | 用途 |
|------|------|
| `render(html)` | 更新 DOM 内容 |
| `notify()` | 通知 Runtime 有更新，触发 UpdateSignal |

### 5.2 ViewBasedApp 基类

适用于多 View 复杂应用。

```typescript
import { ViewBasedApp, type OperationResult, type ViewID } from '@aotui/runtime';

class MultiViewApp extends ViewBasedApp {
    readonly name = 'Multi View App';
    private homeViewId: ViewID = '' as ViewID;
    private detailViewId: ViewID = '' as ViewID;

    protected async initializeViews(): Promise<void> {
        // 添加 Views 到树
        this.homeViewId = this.addView(new HomeView(), null);      // root
        this.detailViewId = this.addView(new DetailView(), this.homeViewId);

        // Mount 初始 Views
        await this.mountView(this.homeViewId);
    }

    protected async handleAppOperation(
        operation: string,
        args: Record<string, unknown>
    ): Promise<OperationResult> {
        // 处理 App 级操作（非 View 特定）
        return { success: false, error: { code: 'E_UNKNOWN', message: 'Unknown' } };
    }
}
```

**ViewBasedApp 特有方法：**

| 方法 | 用途 |
|------|------|
| `addView(view, parentId)` | 添加 View 到树，返回分配的 ViewID |
| `mountView(viewId)` | 挂载 View |
| `dismountView(viewId)` | 卸载 View |
| `getView(viewId)` | 获取 View 实例 |
| `renderAllViews()` | 重新渲染所有已挂载的 Views |

### 5.3 System-Chat 示例

以下是 system-chat 应用的组件模式实现：

```typescript
// ChatApp.tsx
import { View, List, Item, Operation, defineParams, createTUIApp } from '@aotui/sdk';

const sendMessageParams = defineParams({
    content: { type: 'string', required: true, desc: '消息内容' }
});

function ChatApp() {
    const [messages, setMessages] = useState<Message[]>([]);

    return (
        <View id="chat" name="Chat">
            <List name="messages" itemType="message">
                {messages.map(msg => (
                    <Item key={msg.id} data={msg}>
                        {msg.role}: {msg.content}
                    </Item>
                ))}
            </List>

            <Operation
                name="send_message"
                description="发送消息"
                params={sendMessageParams}
                onExecute={async (args) => {
                    setMessages(prev => [...prev, createMessage('agent', args.content)]);
                    return { success: true };
                }}
            >
                发送
            </Operation>
        </View>
    );
}

export default createTUIApp({
    name: 'System Chat',
    component: ChatApp
});
```

---

## 6. SPI 接口参考

### 6.1 IKernel

```typescript
interface IKernel {
    // Desktop 生命周期
    createDesktop(desktopId?: DesktopID): Promise<DesktopID>;
    destroyDesktop(desktopId: DesktopID): Promise<void>;
    getDesktop(desktopId: DesktopID): IDesktop;

    // App 管理 (Worker-Only)
    installDynamicWorkerApp(
        desktopId: DesktopID,
        appModulePath: string,
        workerScriptPath: string
    ): Promise<string>;

    // 锁管理
    acquireLock(desktopId: DesktopID, ownerId: string): void;
    releaseLock(desktopId: DesktopID, ownerId: string): void;

    // Snapshot
    acquireSnapshot(desktopId: DesktopID, ttl?: number): Promise<CachedSnapshot>;
    releaseSnapshot(snapshotId: SnapshotID): void;

    // 执行
    execute(desktopId: DesktopID, operation: Operation, ownerId: string): Promise<OperationResult>;

    // Agent Session
    createAgentSession(
        desktopId: DesktopID,
        sessionId: string,
        config?: AgentSessionConfig
    ): IAgentSession;

    // 状态管理
    suspend(desktopId: DesktopID): Promise<void>;
    resume(desktopId: DesktopID): Promise<void>;
    serialize(desktopId: DesktopID): DesktopState;
    // restore 被移除 (Worker-Only 模式不支持状态恢复，请重新 installDynamicWorkerApp)
    // restore(state: DesktopState): Promise<DesktopID>;
}
```

### 6.2 IDesktopManager

`IDesktopManager` 采用**组合接口模式 (Interface Composition)**，由以下 5 个原子接口组成。这种设计遵循接口隔离原则 (ISP)，允许未来按需拆分实现。

```typescript
type IDesktopManager = 
    IDesktopRepository & 
    IDesktopLockService & 
    IAppInstaller & 
    IDesktopStateAccessor & 
    IDesktopLifecycleController;
```

#### 6.2.1 IDesktopRepository (实例 CRUD)

```typescript
interface IDesktopRepository {
    create(desktopId?: DesktopID): Promise<DesktopID>;
    destroy(desktopId: DesktopID): Promise<void>;
    has(desktopId: DesktopID): boolean;
    get(desktopId: DesktopID): IDesktop | undefined;
}
```

#### 6.2.2 IDesktopLockService (并发锁)

```typescript
interface IDesktopLockService {
    acquireLock(desktopId: DesktopID, ownerId: string): void;
    releaseLock(desktopId: DesktopID, ownerId: string): void;
    verifyLock(desktopId: DesktopID, ownerId: string): boolean;
    refreshLock(desktopId: DesktopID, ownerId: string): void;
    getLockInfo(desktopId: DesktopID): LockInfo | undefined;
}
```

#### 6.2.3 IAppInstaller (App 安装)

```typescript
interface IAppInstaller {
    installDynamicWorkerApp(
        desktopId: DesktopID,
        appModulePath: string,
        options?: {
            workerScriptPath?: string;
            appId?: string;
            name?: string;
            config?: AppLaunchConfig;
        }
    ): Promise<AppID>;
}
```

#### 6.2.4 IDesktopStateAccessor & Lifecycle

```typescript
interface IDesktopStateAccessor {
    getAppStates(desktopId: DesktopID): AppState[];
    getDesktopInfo(desktopId: DesktopID): { status: DesktopStatus; createdAt: number } | undefined;
}

interface IDesktopLifecycleController {
    suspend(desktopId: DesktopID): Promise<void>;
    resume(desktopId: DesktopID): Promise<void>;
}
```

### 6.3 IRegistry

```typescript
interface IRegistry {
    create(indexMap: IndexMap, markup: string, ttl?: number): CachedSnapshot;
    retain(id: SnapshotID): void;
    release(id: SnapshotID): void;
    resolve(id: SnapshotID, path: string): DataPayload | undefined;
}
```

### 6.4 IAOTUIApp

```typescript
interface IAOTUIApp {
    id?: AppID;
    readonly name: string;

    onOpen(context: AppContext, container: HTMLElement): Promise<void>;
    onClose(): Promise<void>;
    onPause?(): Promise<void>;
    onResume?(): Promise<void>;

    onOperation(
        context: OperationContext,
        operation: OperationID,
        args: Record<string, unknown>
    ): Promise<OperationResult>;
}
```

### 6.5 IView

```typescript
interface IView {
    readonly id: ViewID;
    readonly name?: string;

    setId?(newId: ViewID): void;
    onMount(context: IViewContext): Promise<void>;
    onDismount(): Promise<void>;
    onOperation(operation: OperationID, args: Record<string, unknown>): Promise<OperationResult>;
    render(): string;
}

interface IViewContext {
    readonly appId: AppID;
    readonly desktopId: DesktopID;
    readonly viewId: ViewID;

    notifyUpdate(): void;
    mountChildView(viewId: ViewID): Promise<void>;
    dismountChildView(viewId: ViewID): Promise<void>;
}
```

---

## 8. 系统操作参考

### 8.1 App 操作

| 操作 | Function Calling 名称 | 参数 | 说明 |
|------|----------------------|------|------|
| 打开应用 | `system-open_app` | `{ application: AppID }` | 启动应用 |
| 关闭应用 | `system-close_app` | `{ application: AppID }` | 终止应用 |
| 折叠应用 | `system-collapse_app` | `{ application: AppID }` | 隐藏但保持运行 |
| 展开应用 | `system-show_app` | `{ application: AppID }` | 恢复显示 |

### 8.2 View 操作

| 操作 | Function Calling 名称 | 参数 | 说明 |
|------|----------------------|------|------|
| 挂载视图 | `system-mount_view` | `{ app_id: AppID, view_id: ViewID }` | 渲染视图 |
| 卸载视图 | `system-dismount_view` | `{ app_id: AppID, view_id: ViewID }` | 移除视图 |
| 隐藏视图 | `system-hide_view` | `{ app_id: AppID, view_id: ViewID }` | 临时隐藏 |
| 显示视图 | `system-show_view` | `{ app_id: AppID, view_id: ViewID }` | 取消隐藏 |

---

## 9. Snapshot 生命周期

### 9.1 创建与引用计数

```
acquire()           retain()              release()
    │                  │                      │
    ▼                  ▼                      ▼
[Created] ────▶ [RefCount=1] ────▶ [RefCount=N] ────▶ [RefCount=0] ────▶ [Destroyed]
                                                              │
                                                              ▼
                                                        TTL Expired
```

### 9.2 数据解析

```typescript
// Snapshot 包含 IndexMap
snapshot.indexMap = {
    "messages[0]": { id: "msg_101", content: "Hello" },
    "messages[1]": { id: "msg_102", content: "World" }
};

// Kernel 使用 Registry 解析路径
const data = registry.resolve(snapshotId, "messages[0]");
// → { id: "msg_101", content: "Hello" }
```

### 9.3 TTL 安全机制

- 默认 TTL: 10 分钟
- 超时后自动销毁（防止内存泄漏）
- 可在 `createRuntime()` 或 `acquireSnapshot()` 时自定义

---

## 10. 错误处理

### 10.1 错误系统概览

 AOTUI Runtime 使用统一的 `AOTUIError` 类来处理系统级异常。这确保了跨层级（Kernel -> Engine -> App）的错误传播具有一致的结构和可调试性。

### 10.2 错误代码 (Error Codes)

 错误码按领域分组，格式为 `DOMAIN_ERROR_NAME`：

 | 领域 | 代码前缀 | 示例 | 说明 |
 |------|----------|------|------|
 | **Desktop** | `DESKTOP_*` | `DESKTOP_NOT_FOUND` | 桌面不存在或已销毁 |
 | **App** | `APP_*` | `APP_NOT_FOUND` | 应用未安装或加载失败 |
 | **View** | `VIEW_*` | `VIEW_NOT_FOUND` | 视图未挂载或 ID 错误 |
 | **Operation** | `OPERATION_*` | `OPERATION_NO_HANDLER` | 操作无处理器或参数无效 |
 | **Worker** | `WORKER_*` | `WORKER_TERMINATED` | Worker 线程异常终止 |
 | **Snapshot** | `SNAPSHOT_*` | `SNAPSHOT_EXPIRED` | 快照过期或已被释放 |
 | **Config** | `CONFIG_*` | `CONFIG_INVALID` | 配置参数校验失败 |

### 10.3 OperationResult 结构

 外部调用者（如 Agent）接收到的 `OperationResult` 包含结构化的错误信息：

 ```typescript
 interface OperationResult {
     success: boolean;
     data?: Record<string, unknown>;
     error?: {
         code: string;                  // 机器可读错误码 (如 "VIEW_NOT_FOUND")
         message: string;               // 人类可读描述
         context?: Record<string, unknown>; // 调试上下文 (如 { viewId: "v_123" })
     };
 }
 ```

### 10.4 错误处理最佳实践

#### 内部开发 (Framework Developer)

 使用 `AOTUIError` 抛出已知错误：

 ```typescript
 import { AOTUIError } from '@aotui/runtime/spi';
 
 if (!view) {
     throw new AOTUIError('VIEW_NOT_FOUND', { viewId: 'v_123' });
 }
 ```

#### 外部集成 (Agent/Bridge Developer)

 处理 `OperationResult` 的错误：

 ```typescript
 const result = await runtime.execute(...);
 
 if (!result.success) {
     const { code, context } = result.error!;
     
     switch (code) {
         case 'SNAPSHOT_EXPIRED':
             // 策略：重新获取快照并重试
             await refreshSnapshot();
             return retry();
             
         case 'APP_NOT_FOUND':
             // 策略：通知用户应用可能已卸载
             notifyUser(`App ${context.appId} is missing`);
             break;
             
         default:
             console.error(`Operation failed: [${code}] ${result.error.message}`);
     }
 }
 ```

---

## 11. 测试指南

### 11.1 单元测试

使用 Vitest 进行测试：

```typescript
import { describe, it, expect } from 'vitest';
import { createRuntime } from '@aotui/runtime';

describe('My App', () => {
    it('should handle send_message operation', async () => {
        const runtime = createRuntime();
        const desktopId = await runtime.createDesktop();
        await runtime.installDynamicApp(desktopId, new MyApp());

        runtime.acquireLock(desktopId, 'test');
        const snapshot = await runtime.acquireSnapshot(desktopId);

        const result = await runtime.execute(desktopId, {
            context: { appId: 'app_0', snapshotId: snapshot.id },
            name: 'send_message',
            args: { content: 'Hello' }
        }, 'test');

        expect(result.success).toBe(true);
        runtime.releaseLock(desktopId, 'test');
    });
});
```

### 11.2 运行测试

```bash
cd runtime
npm test                           # 运行全部测试
npm test -- --watch               # 监听模式
npm test src/kernel/kernel.test.ts  # 运行特定文件
```

### 11.3 测试覆盖率

项目要求测试覆盖率 90%。当前核心模块覆盖率：

- Kernel: ~95%
- Desktop: ~90%
- Registry: ~95%
- Transformer: ~85%

---

## 附录

### A. 完整导出列表

```typescript
// SDK Layer
export { createRuntime, AOTUIApp, ViewBasedApp } from '@aotui/runtime';

// SPI Types
export type {
    IKernel, IDesktop, IDesktopManager, IRegistry,
    IAOTUIApp, IView, IViewContext, IAgentSession,
    Operation, OperationResult, OperationError,
    CachedSnapshot, IndexMap, DataPayload,
    DesktopID, AppID, ViewID, SnapshotID, OperationID,
    DesktopState, AppState, AppConfig
} from '@aotui/runtime';

// Engine (Advanced)
export { Kernel, Desktop, SnapshotRegistry, Transformer, Dispatcher } from '@aotui/runtime';

// Adapters
export { BridgeSession, ToolCallAdapter } from '@aotui/runtime';
```

### B. 相关文档

- [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) - 系统架构设计
- [AOTUI Spec.md](../AOTUI%20Spec.md) - 完整规范
- [USER_JOURNEY.md](../USER_JOURNEY.md) - 用户旅程
- [CONTRIBUTING.md](./CONTRIBUTING.md) - 贡献者指南

---

*End of Runtime Developer Guide*
