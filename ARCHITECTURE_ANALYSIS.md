# AOTUI System Architecture Analysis

## Executive Summary

This document provides a deep-dive analysis of the AOTUI (Agent-Oriented Text User Interface) system architecture, focusing on:
1. **Runtime capabilities and boundaries** - How the runtime supports TUI app execution
2. **SDK capabilities and usage patterns** - How developers build TUI apps using the SDK
3. **System architecture relationships** - How Runtime, SDK, and TUI Apps interact

---

## Part 1: Runtime System Analysis

### 1.1 Runtime Core Responsibility

**The Runtime is a deterministic state machine** that bridges LLM agents and HTML5 applications. It converts traditional GUIs into semantic text interfaces that LLMs can understand and manipulate.

### 1.2 Five-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SDK Layer (L4)                           │
│  Developer-friendly facade hiding internal complexity        │
├─────────────────────────────────────────────────────────────┤
│                  Adapters Layer (L3)                        │
│  Replaceable adapters (Bridge, LLM Adapter)                 │
├─────────────────────────────────────────────────────────────┤
│                   Engine Layer (L2)                         │
│  Core engine (Desktop, Transformer, Dispatcher, Registry)   │
├─────────────────────────────────────────────────────────────┤
│                   Kernel Layer (L1)                         │
│  Orchestrator coordinating modules                          │
├─────────────────────────────────────────────────────────────┤
│                    SPI Layer (L0)                           │
│  Pure interface definitions, zero implementation code       │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Core Components

| Component | Responsibility | Key Interfaces |
|-----------|---------------|----------------|
| **Kernel** | Desktop lifecycle management, Snapshot/Operation coordination | `IKernel` |
| **Desktop** | Isolated sandbox hosting multiple Apps in Worker Threads | `IDesktop` |
| **Registry** | Snapshot storage with reference counting and TTL safety | `IRegistry` |
| **Transformer** | DOM → TUI Markdown conversion | - |
| **Dispatcher** | Operation → DOM Event dispatch | - |

### 1.4 Runtime Capabilities

#### Desktop Management
- **Worker Isolation**: Each App runs in an independent Node.js Worker Thread
- **DOM Isolation**: Each Worker has its own LinkedOM instance (One App = One DOM)
- **Security Sandbox**: Apps cannot access main thread or other App memory spaces
- **IPC Communication**: Full async message communication via `AppWorkerHost`

#### Snapshot System
- **Time-Safe Snapshots**: Frozen state projections with unique IDs
- **Reference Counting**: Automatic memory management with TTL safety
- **IndexMap**: Path-based data resolution (`messages[0]` → actual data object)
- **Structured Snapshots**: Support for fragmented snapshots from Worker Apps

#### Operation Execution
- **Lock Management**: Prevents concurrent modification conflicts
- **Operation Dispatch**: Routes operations to correct App/View handlers
- **Result Validation**: Returns structured `OperationResult` with error context
- **System Tools**: Built-in operations (`system-open_app`, `system-mount_view`, etc.)

### 1.5 Runtime Boundaries

**What Runtime Does:**
- ✅ Manages Desktop lifecycle (create, suspend, resume, destroy)
- ✅ Hosts Apps in isolated Worker Threads
- ✅ Converts DOM to TUI Markdown via Transformer
- ✅ Dispatches Operations to App handlers
- ✅ Manages Snapshot lifecycle and memory
- ✅ Provides IPC communication infrastructure

**What Runtime Does NOT Do:**
- ❌ Render UI components (SDK responsibility)
- ❌ Define business logic (App responsibility)
- ❌ Manage application state (App responsibility)
- ❌ Handle LLM integration directly (Bridge/AgentDriver responsibility)

### 1.6 Key SPI Interfaces

#### IKernel - Core Orchestrator
```typescript
interface IKernel {
    // Desktop lifecycle
    createDesktop(desktopId?: DesktopID): Promise<DesktopID>;
    destroyDesktop(desktopId: DesktopID): Promise<void>;
    getDesktop(desktopId: DesktopID): IDesktop;
    
    // App management (Worker-Only)
    installDynamicWorkerApp(
        desktopId: DesktopID,
        appModulePath: string,
        options?: {...}
    ): Promise<string>;
    
    // Lock management
    acquireLock(desktopId: DesktopID, ownerId: string): void;
    releaseLock(desktopId: DesktopID, ownerId: string): void;
    
    // Snapshot management
    acquireSnapshot(desktopId: DesktopID, ttl?: number): Promise<CachedSnapshot>;
    releaseSnapshot(snapshotId: SnapshotID): void;
    
    // Operation execution
    execute(desktopId: DesktopID, operation: Operation, ownerId: string): Promise<OperationResult>;
}
```

#### IDesktop - Runtime Sandbox
```typescript
interface IDesktop {
    id: DesktopID;
    
    // App lifecycle
    installDynamicWorkerApp(appModulePath: string, options?: {...}): Promise<string>;
    openApp(appId: AppID): Promise<void>;
    closeApp(appId: AppID): Promise<void>;
    
    // View management
    mountViewByLink(appId: AppID, parentViewId: ViewID, linkId: string): Promise<void>;
    dismountView(appId: AppID, viewId: ViewID): Promise<void>;
    
    // Operation dispatch
    dispatchOperation(appId: AppID, payload: OperationPayload): Promise<OperationResult>;
    
    // Snapshot fragments (Worker-Side Transformation)
    getSnapshotFragments(): { appId, markup, indexMap, viewTree }[];
}
```

#### IAOTUIApp - App Contract
```typescript
interface IAOTUIApp {
    id?: AppID;
    readonly name: string;
    
    onOpen(context: AppContext, container: HTMLElement): Promise<void>;
    onClose(): Promise<void>;
    onDelete?(): Promise<void>;
    onPause?(): Promise<void>;
    onResume?(): Promise<void>;
    
    onOperation(
        context: OperationContext,
        operation: OperationID,
        args: Record<string, unknown>
    ): Promise<OperationResult>;
}
```

---

## Part 2: SDK Analysis

### 2.1 SDK Core Responsibility

**The SDK is a developer-friendly facade** that provides Preact-based components and Hooks for building TUI applications using familiar JSX patterns.

### 2.2 SDK Design Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                        Developer (using SDK)                     │
│   Build Views using Preact JSX + SDK Components/Hooks           │
└──────────────────────────────┬──────────────────────────────────┘
                               │ createTUIApp() factory
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     @aotui/sdk Adapter Layer                     │
│   Wraps Preact components as Factory Objects for Runtime        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ IView interface (IPC-ready)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      @aotui/runtime                              │
│   Desktop Orchestrator ──────▶ App Worker (Thread)              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Core SDK Components

#### View Component
```typescript
<View name="Conversation">
    <h1>Conversation Details</h1>
    {/* Content */}
</View>
```
- Marks View boundary
- Renders as `<div view="Conversation">` in HTML
- Transforms to `<view id="view_0" name="Conversation">` in Markdown

#### Operation Component (v0.2.0+)
```typescript
<Operation
    name="send_message"
    description="Send a message"
    params={sendMessageParams}
    onExecute={async (args) => {
        // Handler logic
        return { success: true };
    }}
>
    <Operation.Param name="content" type="string" required desc="Message content" />
    Send
</Operation>
```
- Declares Agent-executable operations
- Type-safe parameter definitions via `defineParams()`
- Handler has direct access to component state via closure

#### Data Binding Hooks

**useArrayRef** - For array data:
```typescript
const [listRef, itemRef] = useArrayRef('messages', messages, { itemType: 'message' });

// Usage:
<h2>{listRef('Message History')}</h2>  // → [Message History](message[]:messages)
{messages.map((msg, idx) => (
    <li>{itemRef(idx, msg.content)}</li>  // → [Hello](message:messages[0])
))}
```

**useRef** - For single objects:
```typescript
const userRef = useRef('current_user', user);
<h3>{userRef('User Profile')}</h3>  // → [User Profile](current_user)
```

### 2.4 SDK Hooks API

#### Preact Hooks (Re-exported)
⚠️ **Critical**: Always import Hooks from `@aotui/sdk`, not `preact/hooks`!

```typescript
import { useState, useEffect, useCallback, useMemo, useReducer } from '@aotui/sdk';
```

**Why?** Node.js module resolution can cause multiple Preact instances. SDK re-exports ensure all code uses the same Preact instance.

#### useViewContext
```typescript
const ctx = useViewContext();
console.log(ctx.viewId);      // 'view_0'
console.log(ctx.appId);       // 'app_0'
console.log(ctx.desktopId);   // 'desktop_123'
console.log(ctx.store);       // IAppStore interface

// Manual update trigger
const handleChange = () => {
    // After state changes...
    ctx.markDirty();
};
```

#### useExternalEvent
```typescript
useExternalEvent<UserMessageEvent>('user_message', (event) => {
    setMessages(prev => [...prev, {
        role: 'human',
        content: event.message.content,
        timestamp: event.message.timestamp
    }]);
}, []);
```
- Subscribes to external events from Product Layer
- Product Layer calls `desktop.injectEvent(eventType, data)`
- Runtime routes event to corresponding App
- SDK invokes registered handler

### 2.5 SDK Capabilities

**What SDK Provides:**
- ✅ Preact component abstraction for Views
- ✅ Declarative Operation definition via components
- ✅ Type-safe parameter definitions with `defineParams()`
- ✅ Data binding Hooks (`useRef`, `useArrayRef`)
- ✅ View context access (`useViewContext`)
- ✅ External event subscription (`useExternalEvent`)
- ✅ HTML → TUI Markdown transformation (via Runtime)

**What SDK Does NOT Do:**
- ❌ Manage Desktop lifecycle (Runtime responsibility)
- ❌ Handle IPC communication (Runtime responsibility)
- ❌ Manage Snapshot storage (Runtime responsibility)
- ❌ Provide business logic (App responsibility)

### 2.6 SDK Usage Patterns

#### Pattern 1: Component Mode (Recommended)
```typescript
import { View, Operation, useState, useArrayRef, createTUIApp } from '@aotui/sdk';

function TodoApp() {
    const [items, setItems] = useState<TodoItem[]>([]);
    const [listRef, itemRef] = useArrayRef('items', items, { itemType: 'todo' });
    
    return (
        <View name="TodoList">
            <h1>Todo List</h1>
            <h2>{listRef('Items')}</h2>
            <ul>
                {items.map((item, idx) => (
                    <li key={item.id}>{itemRef(idx, item.title)}</li>
                ))}
            </ul>
            
            <Operation
                name="add_item"
                description="Add a new item"
                onExecute={async ({ title }) => {
                    setItems(prev => [...prev, { id: Date.now(), title }]);
                    return { success: true };
                }}
            >
                <Operation.Param name="title" type="string" required desc="Item title" />
                Add
            </Operation>
        </View>
    );
}

export default createTUIApp({
    name: 'Todo List',
    component: TodoApp
});
```

#### Pattern 2: Multi-View App
```typescript
function ConversationApp() {
    return (
        <>
            <View id="conversation_list" name="Conversations">
                <h1>Conversations</h1>
                <ViewLink target="Conversation" params={{ id: '123' }}>
                    Open Conversation
                </ViewLink>
            </View>
            
            <View id="conversation_detail" name="Conversation">
                <h1>Conversation Details</h1>
                {/* Chat UI */}
            </View>
        </>
    );
}
```

#### Pattern 3: External Event Handling
```typescript
function ChatView() {
    const [messages, setMessages] = useState<Message[]>([]);
    
    // Handle human user messages
    useExternalEvent<UserMessageEvent>('user_message', (event) => {
        setMessages(prev => [...prev, {
            role: 'human',
            content: event.message.content,
            timestamp: Date.now()
        }]);
    }, []);
    
    return <View name="Chat">...</View>;
}
```

---

## Part 3: System Architecture Relationships

### 3.1 Complete Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  Developer writes TUI App using @aotui/sdk                       │
│  (Preact JSX + SDK Components/Hooks)                             │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ 1. createTUIApp() factory
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  @aotui/sdk Adapter creates IView instances                       │
│  (Wraps Preact components as Factory Objects)                    │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ 2. installDynamicWorkerApp()
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  @aotui/runtime Kernel creates Desktop                           │
│  Desktop spawns Worker Thread for App                            │
│  App Worker initializes with LinkedOM + SDK Runtime              │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ 3. App renders HTML via LinkedOM
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Runtime Transformer converts HTML → TUI Markdown                │
│  Registry creates Snapshot with IndexMap                         │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ 4. acquireSnapshot() returns TUI state
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Bridge injects TUI into LLM context as User Message             │
│  LLM receives: "<view id=\"...\" type=\"...\" name=\"...\" app_id=\"...\" app_name=\"...\">...</view>\n\nUser request"  │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ 5. LLM responds with tool call
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  Bridge converts tool call → Operation                           │
│  Runtime executes Operation via dispatchOperation()              │
│  App Worker handles onOperation() → returns OperationResult      │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ 6. Operation triggers state change
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│  App calls ctx.markDirty() or ctx.notifyUpdate()                 │
│  Desktop emits UpdateSignal via SignalBus                        │
│  Bridge receives signal → acquires new Snapshot                  │
│  Cycle repeats from step 4                                       │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Interaction Points

#### App Installation
```typescript
// 1. Product Layer creates Desktop
const desktopId = await runtime.createDesktop();

// 2. Install Worker App
await runtime.installDynamicWorkerApp(
    desktopId,
    require.resolve('./aotui-ide'),
    { name: 'AOTUI IDE' }
);

// 3. Runtime spawns Worker Thread
//    Worker initializes App with SDK runtime
//    App renders initial HTML
```

#### Snapshot Acquisition
```typescript
// 1. Bridge acquires Snapshot
const snapshot = await runtime.acquireSnapshot(desktopId);

// 2. Runtime collects Snapshot Fragments from all Workers
const fragments = desktop.getSnapshotFragments();

// 3. Transformer converts HTML → Markdown
//    Registry builds IndexMap from RefRegistry

// 4. Snapshot returned to Bridge
//    Bridge injects into LLM context
```

#### Operation Execution
```typescript
// 1. LLM calls tool: send_message({ content: 'Hello', recipient: 'contacts[0]' })

// 2. Bridge converts to Operation
const operation: Operation = {
    context: { appId: 'app_0', viewId: 'view_0', snapshotId: 'snap_123' },
    name: 'send_message',
    args: { content: 'Hello', recipient: 'contacts[0]' }
};

// 3. Runtime acquires lock
runtime.acquireLock(desktopId, 'agent_001');

// 4. Runtime dispatches Operation
const result = await runtime.execute(desktopId, operation, 'agent_001');

// 5. Desktop routes to Worker via IPC
//    Worker calls App's onOperation handler
//    Handler returns OperationResult

// 6. Runtime releases lock
runtime.releaseLock(desktopId, 'agent_001');
```

### 3.3 TUI App Structure (aotui-ide Example)

```
aotui-ide/
├── aoapp.json              # App manifest
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts            # Export createTUIApp factory
│   ├── tui/               # TUI components
│   │   ├── Workspace.tsx   # Workspace View
│   │   ├── FileDetail.tsx  # FileDetail View
│   │   └── SearchResults.tsx # Search View
│   └── core/              # Business logic
│       ├── file-service.ts
│       ├── search-service.ts
│       └── lsp-service.ts
└── test/
```

**Key Characteristics:**
- Uses `createTUIApp()` factory from SDK
- Defines multiple Views (Workspace, FileDetail, SearchResults)
- Each View uses SDK components (`<View>`, `<Operation>`)
- Business logic separated into `core/` services
- Views use Hooks for state management (`useState`, `useViewContext`)

### 3.4 Capability Boundaries Summary

| Responsibility | Runtime | SDK | App |
|---------------|---------|-----|-----|
| Desktop lifecycle | ✅ | ❌ | ❌ |
| Worker Thread management | ✅ | ❌ | ❌ |
| Snapshot storage | ✅ | ❌ | ❌ |
| HTML → Markdown transform | ✅ | ❌ | ❌ |
| Operation dispatch | ✅ | ❌ | ❌ |
| IPC communication | ✅ | ❌ | ❌ |
| Preact components | ❌ | ✅ | Uses |
| Hooks API | ❌ | ✅ | Uses |
| Data binding | ❌ | ✅ | Uses |
| Business logic | ❌ | ❌ | ✅ |
| Application state | ❌ | ❌ | ✅ |
| View rendering | ❌ | ✅ (declarative) | ✅ (implementation) |

---

## Part 4: Key Insights and Best Practices

### 4.1 Design Principles

#### 1. De-visualized Interface
- **TUI uses semantic markdown, not pixels**
- CSS, colors, layouts are meaningless to LLMs
- Focus on data structure and semantic relationships

#### 2. Value-Driven References
- **Tools accept data objects via RefName, not primitive IDs**
- Example: `mark_complete({ todo: "pending[0]" })` passes entire TODO object
- Runtime resolves RefName to actual data from IndexMap

#### 3. Snapshot-Driven State
- **Views are ephemeral data projections**
- Each interaction is based on frozen state snapshot
- LLM doesn't track changes; it processes latest snapshot

#### 4. Context as First-Class Citizen
- **TUI context must be explicit**
- Unlike GUI (implicit cursor position, focused element)
- App tracks context to reduce LLM cognitive load

### 4.2 Common Pitfalls

#### ❌ Anti-Pattern: Tool Calls as Data Queries
```typescript
// Wrong: Returning large data payloads from tool calls
{
    tool: "get_messages",
    result: { messages: [ /* 500 message objects */ ] }
}
```

#### ✅ Best Practice: Tool Calls as State Triggers
```typescript
// Right: Return success/failure, reflect data in Views
{
    tool: "load_more_messages",
    result: { success: true, loaded: 20 }
}
// View updates automatically with new messages
```

#### ❌ Anti-Pattern: Importing Hooks from preact/hooks
```typescript
// Wrong: Can cause multiple Preact instances
import { useState } from 'preact/hooks';
```

#### ✅ Best Practice: Import Hooks from SDK
```typescript
// Right: Ensures single Preact instance
import { useState } from '@aotui/sdk';
```

#### ❌ Anti-Pattern: Hardcoding IDs
```typescript
// Wrong: Guessing or hardcoding values
mark_complete({ todo: "todo_123" });
```

#### ✅ Best Practice: Use RefNames from TUI State
```typescript
// Right: Use semantic references from current snapshot
mark_complete({ todo: "pending[0]" });
```

### 4.3 Testing Strategy

#### Unit Testing Apps
```typescript
import { createRuntime } from '@aotui/runtime';
import myApp from './my-app';

describe('My App', () => {
    it('should handle send_message operation', async () => {
        const runtime = createRuntime();
        const desktopId = await runtime.createDesktop();
        await runtime.installDynamicWorkerApp(desktopId, myApp);
        
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

### 4.4 Performance Considerations

#### Snapshot TTL
- Default TTL: 10 minutes
- Prevents memory leaks from abandoned snapshots
- Customize in `createRuntime()` or `acquireSnapshot()`

#### Worker Isolation Overhead
- Each App runs in separate Worker Thread
- IPC communication is asynchronous
- Design for eventual consistency

#### View Rendering
- Use `ctx.markDirty()` to batch updates
- Avoid excessive re-renders
- LinkedOM provides efficient DOM diffing

---

## Conclusion

The AOTUI system represents a **fundamental paradigm shift** in UI design for AI agents:

1. **Runtime** provides the infrastructure: Worker isolation, Snapshot management, Operation dispatch
2. **SDK** provides the developer experience: Preact components, Hooks, type-safe APIs
3. **TUI Apps** provide the domain logic: Business rules, data models, View implementations

**Key Takeaway**: When building for AI, think in **text, not pixels**. The TUI paradigm replaces:
- Visual pages → Semantic View containers
- HTML rendering → Markdown transformation
- Visual identifiers → Textual value references
- Mouse/keyboard → Function invocation
- Continuous UI → Discrete state snapshots

By embracing these principles, we can build applications that LLMs interact with as naturally and efficiently as humans interact with GUIs.

---

## References

- [README.md](../README.md) - Building TUI Applications for AI Agents
- [DEVELOPMENT.md](../DEVELOPMENT.md) - Development setup guide
- [RUNTIME_DEVELOPER_GUIDE.md](../runtime/RUNTIME_DEVELOPER_GUIDE.md) - Runtime API reference
- [SDK_DEVELOPER_GUIDE.md](../sdk/SDK_DEVELOPER_GUIDE.md) - SDK usage guide
- [CONTRIBUTING.md](../runtime/CONTRIBUTING.md) - Architecture philosophy and contribution guidelines
