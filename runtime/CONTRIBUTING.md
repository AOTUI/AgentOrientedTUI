# AOTUI Runtime 贡献者指南

> **核心理念**: 我们坚信长期主义。短期的便捷不应以牺牲长期的可维护性为代价。

## 目录

- [架构哲学](#架构哲学)
- [目录结构](#目录结构)
- [分层架构原则](#分层架构原则)
- [开发者工作流程](#开发者工作流程)
- [代码贡献规范](#代码贡献规范)
- [什么是符合预期的工作](#什么是符合预期的工作)
- [反模式：我们拒绝什么](#反模式我们拒绝什么)

---

## 架构哲学

### 微内核架构

AOTUI Runtime 采用**标准微内核架构**，核心思想是：

```
┌─────────────────────────────────────────────────────────────┐
│                    SDK Layer (L4)                           │
│  开发者友好的门面，隐藏内部复杂性                              │
├─────────────────────────────────────────────────────────────┤
│                  Adapters Layer (L3)                        │
│  可替换的适配器，支持不同后端                                 │
├─────────────────────────────────────────────────────────────┤
│                   Engine Layer (L2)                         │
│  核心引擎实现，框架的"重量级"模块                             │
├─────────────────────────────────────────────────────────────┤
│                   Kernel Layer (L1)                         │
│  编排器，协调各模块                                          │
├─────────────────────────────────────────────────────────────┤
│                    SPI Layer (L0)                           │
│  纯接口定义，零实现代码，最稳定                               │
└─────────────────────────────────────────────────────────────┘
```

### 三大设计原则

#### 1. 稳定依赖原则 (Stable Dependencies Principle)

依赖方向必须是：**不稳定 → 稳定**

```
Adapters → SDK → Engine → Kernel → SPI
   ↓         ↓       ↓        ↓      ↓
  L3        L4      L2       L1     L0 (最稳定)
```

**禁止**: SPI 依赖 Engine、Kernel 依赖 Adapters 等逆向依赖。

#### 2. 接口隔离原则 (Interface Segregation)

SPI 层只包含接口定义，**绝对没有实现代码**。

```typescript
// ✅ 正确：spi/app.interface.ts
export interface IAOTUIApp {
    onOpen(context: AppContext): Promise<void>;
    onClose(): Promise<void>;
}

// ❌ 错误：在 SPI 中放实现
export class DefaultApp implements IAOTUIApp { ... } // 不应出现在 SPI
```

#### 3. 控制反转原则 (Hollywood Principle)

框架调用用户代码，而非用户代码调用框架内部。

```typescript
// ✅ 正确：框架调用 App 的生命周期方法
class Desktop {
    async installDynamicApp(app: IAOTUIApp) {
        await app.onOpen(context, container);  // 框架调用用户代码
    }
}

// ❌ 错误：用户代码直接操作框架内部
class MyApp {
    init() {
        this.kernel.registry.create(...);  // 直接访问内部模块
    }
}
```

---

## 目录结构

```
runtime/src/
├── spi/              # L0 - Service Provider Interface
│   ├── types.ts          # 基础类型 (SnapshotID, DesktopID, AppID...)
│   ├── commands.ts       # 命令相关类型
│   ├── signals.ts        # 信号类型
│   ├── snapshot.ts       # 快照类型
│   ├── store.interface.ts    # 存储接口
│   ├── app.interface.ts      # App 接口
│   ├── kernel.interface.ts   # Kernel/Desktop/Registry 接口
│   └── index.ts          # 统一导出
│
├── kernel/           # L1 - 编排器核心
│   └── index.ts          # Kernel 类
│
├── engine/           # L2 - 核心引擎
│   ├── desktop/          # Desktop 实现
│   ├── transformer/      # DOM → TUI 转换器
│   ├── dispatcher/       # 命令分发器
│   ├── registry/         # Snapshot 注册表
│   ├── snapshot/         # Snapshot 构建器
│   └── view/             # View 树管理
│
├── adapters/         # L3 - 可替换适配器
│   ├── bridge/           # Agent-Runtime 桥接
│   ├── llm/              # LLM 工具适配
│   ├── session/          # Agent 会话管理
│   └── store-fs.ts       # 文件系统存储实现
│
├── sdk/              # L4 - 开发者门面
│   ├── facades.ts        # createRuntime() 工厂
│   ├── app-base.ts       # AOTUIApp 抽象基类
│   └── index.ts          # 统一导出
│
├── internal/         # 内部模块（不导出）
│   ├── integration/      # 集成测试
│   └── browser.ts        # 浏览器入口
│
└── index.ts          # 主入口（按层级组织导出）
```

---

## 分层架构原则

### 每一层的职责

| 层级 | 目录 | 职责 | 稳定性 |
|------|------|------|--------|
| **L0** | `spi/` | 定义契约，零实现 | ★★★★★ |
| **L1** | `kernel/` | 协调各模块，管理生命周期 | ★★★★☆ |
| **L2** | `engine/` | 核心功能实现 | ★★★☆☆ |
| **L3** | `adapters/` | 可替换的外部集成 | ★★☆☆☆ |
| **L4** | `sdk/` | 开发者友好的 API | ★★☆☆☆ |

### 导入规则

```typescript
// ✅ 正确的导入方向

// Engine 导入 SPI
import type { IAOTUIApp } from '../../spi/index.js';

// Kernel 导入 Engine 和 SPI
import { Desktop } from '../engine/desktop/index.js';
import type { IKernel } from '../spi/index.js';

// SDK 导入所有内层
import { Kernel } from '../kernel/index.js';
import type { IAOTUIApp } from '../spi/index.js';

// ❌ 禁止的导入方向

// SPI 导入 Engine（违反稳定依赖原则）
import { Desktop } from '../engine/desktop/index.js'; // ❌

// Engine 导入 Adapters（违反层级关系）
import { BridgeSession } from '../adapters/bridge/index.js'; // ❌
```

---

## 开发者工作流程

### 1. 开始新功能前

```bash
# 1. 从 master 创建分支
git checkout master
git pull origin master
git checkout -b feature/your-feature-name

# 2. 确保测试通过
npm run test

# 3. 检查循环依赖
npx madge --circular src/
```

### 2. 开发过程中

#### 批判性思考清单

开发时问自己：

1. **作为 SDK 使用者**：我想要什么样的 API？当前 SDK 是否提供了？
2. **作为 Runtime 维护者**：这个功能应该放在哪一层？是否破坏了分层原则？
3. **作为长期主义者**：这个改动在 1 年后还能轻松理解吗？

#### 代码放置决策树

```
新增功能/类型？
│
├─ 是纯接口/类型吗？ ──是──▶ 放入 spi/
│
├─ 是核心引擎功能吗？ ──是──▶ 放入 engine/
│
├─ 是可替换的外部集成？ ──是──▶ 放入 adapters/
│
├─ 是开发者直接使用的 API？ ──是──▶ 放入 sdk/
│
└─ 是编排/协调逻辑？ ──是──▶ 放入 kernel/
```

### 3. 提交前

```bash
# 必须通过的检查
npm run test          # 所有测试通过
npx tsc --noEmit      # 类型检查通过
npx madge --circular src/  # 无循环依赖
```

### 4. 提交规范

使用 Conventional Commits：

```bash
# 格式
<type>(<scope>): <description>

# 示例
feat(spi): add IViewTree interface
fix(engine): resolve snapshot memory leak
refactor(adapters): extract common LLM logic
docs(sdk): update createRuntime examples
test(kernel): add lifecycle edge cases
```

---

## 代码贡献规范

### 测试覆盖率要求

- **新功能**: 必须有对应的单元测试
- **Bug 修复**: 必须有复现 bug 的测试用例
- **重构**: 不能降低现有覆盖率

### 类型安全

```typescript
// ✅ 使用显式类型
function createStore(desktopId: DesktopID, appId: AppID): IAppStore {
    return new FileSystemAppStore(desktopId, appId);
}

// ❌ 避免 any
function createStore(desktopId: any, appId: any): any { ... }
```

### 接口优于实现

```typescript
// ✅ 依赖接口
class Kernel {
    constructor(private registry: IRegistry) {}
}

// ❌ 依赖具体实现
class Kernel {
    constructor(private registry: SnapshotRegistry) {}
}
```

### 文档注释

```typescript
/**
 * 创建 AOTUI Runtime 实例
 * 
 * 这是最简单的入口点，封装了所有内部依赖的创建。
 * 
 * @param config - 运行时配置
 * @returns Kernel 实例
 * 
 * @example
 * ```typescript
 * const runtime = createRuntime({
 *     storeFactory: new FileSystemStoreFactory('./data')
 * });
 * ```
 */
export function createRuntime(config: RuntimeConfig = {}): Kernel {
    // ...
}
```

---

## 什么是符合预期的工作

### ✅ 符合预期

1. **遵循分层原则**: 新代码放在正确的层级
2. **依赖接口而非实现**: 使用 SPI 中定义的接口
3. **完整的测试**: 新功能有测试，重构不破坏现有测试
4. **清晰的提交历史**: 每个提交专注于一件事
5. **无循环依赖**: `madge --circular` 保持干净
6. **向后兼容**: 除非有充分理由并在 CHANGELOG 说明

### 符合预期的代码示例

```typescript
// 1. 在 SPI 定义接口
// spi/cache.interface.ts
export interface ICache {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

// 2. 在 Adapters 实现
// adapters/cache-memory.ts
import type { ICache } from '../spi/index.js';

export class MemoryCache implements ICache {
    private store = new Map();
    
    async get<T>(key: string): Promise<T | undefined> {
        return this.store.get(key);
    }
    
    async set<T>(key: string, value: T): Promise<void> {
        this.store.set(key, value);
    }
}

// 3. 在 SDK 暴露
// sdk/index.ts
export type { ICache } from '../spi/index.js';
export { MemoryCache } from '../adapters/cache-memory.js';
```

---

## 反模式：我们拒绝什么

### ❌ 1. 跨层直接依赖

```typescript
// ❌ 错误：SPI 导入 Engine
// spi/types.ts
import { Desktop } from '../engine/desktop/index.js';  // 禁止！
```

### ❌ 2. 万能类

```typescript
// ❌ 错误：一个类做太多事
class RuntimeManager {
    createDesktop() { ... }
    transformDOM() { ... }
    dispatchCommand() { ... }
    manageSnapshots() { ... }
    handleLLMCalls() { ... }
}
```

### ❌ 3. 硬编码依赖

```typescript
// ❌ 错误：硬编码具体实现
class Kernel {
    private store = new FileSystemAppStore();  // 硬编码
}

// ✅ 正确：依赖注入
class Kernel {
    constructor(private storeFactory: IAppStoreFactory) {}
}
```

### ❌ 4. 全局状态

```typescript
// ❌ 错误：全局单例
let globalKernel: Kernel;

export function getKernel() {
    if (!globalKernel) {
        globalKernel = new Kernel(...);
    }
    return globalKernel;
}
```

### ❌ 5. 测试捷径

```typescript
// ❌ 错误：跳过测试
it.skip('should handle edge case', ...);

// ❌ 错误：没有断言的测试
it('should work', async () => {
    await doSomething();
    // 没有 expect()
});
```

---

## 常见问题

### Q: 我想添加一个新的存储后端（如 Redis）

A:

1. 在 `adapters/` 创建 `store-redis.ts`
2. 实现 `IAppStore` 和 `IAppStoreFactory` 接口
3. 添加测试到 `adapters/store-redis.test.ts`
4. 在 `index.ts` 导出（可选）

### Q: 我需要修改接口

A:

1. 考虑是否可以扩展而非修改（添加可选属性）
2. 如果必须修改，更新 CHANGELOG
3. 确保所有实现都更新
4. 运行全部测试

### Q: 我发现了一个 Bug

A:

1. 先写一个复现 Bug 的失败测试
2. 修复代码使测试通过
3. 确保没有引入回归

---

## 总结

作为长期主义者，我们的目标是构建一个**可以持续演进 5-10 年**的架构。每一次提交都是向这个目标的投资。

> "好的架构不是一步到位的，而是在约束下持续演进的结果。"

欢迎加入 AOTUI 的开发！
