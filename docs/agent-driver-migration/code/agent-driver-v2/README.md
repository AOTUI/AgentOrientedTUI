# @aotui/agent-driver-v2

多源消息聚合器，用于整合 AOTUI Runtime 和 Host 的消息和工具，发送给 LLM。

## 特性

- **多源聚合**: 支持多个 DrivenSource（AOTUI、Host 等）
- **时间戳排序**: 自动按时间戳排序来自不同源的消息
- **ToolCall 路由**: 根据 Tool 来源自动路由执行
- **类型安全**: 基于 Vercel AI SDK v6，全程 TypeScript
- **Provider 支持**: 支持 OpenAI、Anthropic、Google、xAI 等主流 LLM Provider

## 架构

```
┌─────────────────────────────────────┐
│      AgentDriver V2                 │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Messages (sorted)            │ │
│  │  - AOTUI Snapshots            │ │
│  │  - Host Messages              │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Tools                        │ │
│  │  - AOTUI Operations           │ │
│  │  - (Future: Other Tools)      │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  ToolCall Router              │ │
│  │  → Find DrivenSource          │ │
│  │  → Execute Tool               │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
           ↓
      LLM (Vercel AI SDK)
```

## API

### IDrivenSource 接口

每个 DrivenSource 需要实现以下接口：

```typescript
interface IDrivenSource {
  readonly name: string;
  getMessages(): Promise<MessageWithTimestamp[]>;
  getTools(): Promise<Record<string, CoreTool>>;
  executeTool(toolName: string, args: unknown, toolCallId: string): Promise<ToolResult | undefined>;
  onUpdate(callback: () => void): () => void;
}
```

### 实现位置

- `IDrivenSource` 接口: `agent-driver-v2/src/core/interfaces.ts`
- `AOTUIDrivenSource`: `runtime/src/adapters/aotui-driven-source.ts`
- `HostDrivenSource`: `host/src/adapters/host-driven-source.ts`

## 使用示例

### 基本用法

```typescript
import { AgentDriverV2 } from '@aotui/agent-driver-v2';
import { AOTUIDrivenSource } from '@aotui/runtime';
import { HostDrivenSource } from './host';

const driver = new AgentDriverV2({
  sources: [
    new AOTUIDrivenSource(desktop, kernel),
    new HostDrivenSource(messageRepo)
  ],
  llm: {
    model: 'openai:gpt-4',  // 格式: "providerId:modelId"
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    maxSteps: 10
  },
  workLoop: {
    debounceMs: 300,
    toolCallTimeoutMs: 30000
  },
  onAssistantMessage: (message) => {
    console.log('LLM response:', message);
  },
  onToolResult: (message) => {
    console.log('Tool executed:', message);
  }
});

// 运行工作循环（自动触发，当有更新信号时）
// 或手动触发
await driver.trigger();
```

### LLM 配置格式

AgentDriverV2 支持灵活的 LLM 配置格式：

```typescript
// 格式 1: 简单格式（自动推断 Provider）
const config: LLMConfig = {
  model: 'gpt-4',  // 自动推断为 openai
};

// 格式 2: 显式指定 Provider
const config: LLMConfig = {
  model: 'openai:gpt-4',  // 使用冒号分隔
};

// 格式 3: 自定义 Provider 配置
const config: LLMConfig = {
  model: 'anthropic:claude-3-5-sonnet-20241022',
  provider: {
    id: 'anthropic',
    baseURL: 'https://api.anthropic.com',  // 可选
  },
  apiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
  maxSteps: 10,
};

// 格式 4: 使用 OpenRouter
const config: LLMConfig = {
  model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  provider: {
    id: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
  },
  apiKey: process.env.OPENROUTER_API_KEY,
};
```

### 支持的 Provider

- **OpenAI**: `openai:gpt-4`, `openai:gpt-4-turbo`
- **Anthropic**: `anthropic:claude-3-5-sonnet-20241022`
- **Google**: `google:gemini-2.5-flash`
- **xAI**: `xai:grok-beta`
- **自定义**: 任何 OpenAI 兼容的 API（通过 `provider.baseURL` 配置）

## 迁移指南

### 从旧版本迁移

如果你之前使用 ModelRegistry，现在需要改为直接传递完整的 LLMConfig：

**之前（使用 ModelRegistry）：**

```typescript
import { AgentDriverV2, ModelRegistry } from '@aotui/agent-driver-v2';

const registry = new ModelRegistry();
const driver = new AgentDriverV2({
  sources: [...],
  llm: {
    model: 'gpt-4',
  },
  // ModelRegistry 会自动注入
});
```

**现在（直接配置）：**

```typescript
import { AgentDriverV2 } from '@aotui/agent-driver-v2';

const driver = new AgentDriverV2({
  sources: [...],
  llm: {
    model: 'openai:gpt-4',  // 需要包含 provider 前缀
    apiKey: process.env.OPENAI_API_KEY,  // 需要显式提供 API Key
    temperature: 0.7,
    maxSteps: 10,
  },
});
```

**关键变化：**

1. **ModelRegistry 已移除**: 不再从 `@aotui/agent-driver-v2` 导出
2. **完整配置**: LLMConfig 需要包含所有必要字段（model, apiKey, provider 等）
3. **Model 格式**: 推荐使用 `providerId:modelId` 格式（如 `openai:gpt-4`）
4. **API Key**: 需要显式提供或通过环境变量设置

### 在 Host 应用中使用

如果你在 Host 应用中使用 AgentDriverV2，应该通过 LLMConfigService 获取配置：

```typescript
import { HostManagerV2 } from '@aotui/host';

const hostManager = new HostManagerV2(topicId, modelRegistry);

// LLMConfigService 会自动从 ModelRegistry 获取配置
// 并转换为完整的 LLMConfig
hostManager.initAgentDriver(desktop, kernel);
```

## 环境变量

AgentDriverV2 支持从环境变量自动读取 API Key：

- `OPENAI_API_KEY`: OpenAI API Key
- `ANTHROPIC_API_KEY`: Anthropic API Key
- `GOOGLE_API_KEY`: Google AI API Key
- `XAI_API_KEY`: xAI API Key

如果在 LLMConfig 中没有提供 `apiKey`，会自动从对应的环境变量读取。

## 下一步

- [x] 实现完整的 LLM ReAct 循环 (streamText)
- [x] 添加 ToolCall 超时机制
- [x] 添加单元测试
- [x] 实现 AOTUIDrivenSource (在 runtime 中)
- [x] 实现 HostDrivenSource (在 host 中)
- [x] 移除 ModelRegistry 依赖（迁移到 Host 主进程）

