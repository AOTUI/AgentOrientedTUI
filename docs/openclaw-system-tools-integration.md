# OpenClaw 接入 AOTUI System Tools 指南

## 目标

这份文档只解决一个问题：

OpenClaw 如何像 `host` 一样拿到并调用 AOTUI 的 `system-open_app`、`system-close_app`，而不是继续自己从 `snapshot` 做不完整投影。

核心结论先放前面：

- 不要把 `system tools` 的暴露建立在“只扫描 `snapshot.indexMap`”上
- 想和 `host` 保持一致，应该复用 `AOTUI Runtime -> Agent` 这一层现成的暴露逻辑
- 如果暂时不想直接接 `AOTUIDrivenSource`，至少也要复刻它的关键行为：`app tools from snapshot.indexMap + system tools from kernel.getSystemToolDefinitions()`

## 背景

标准 `host` 接入时，会创建 `AOTUIDrivenSource`，见 [session-manager-v3.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/host/src/core/session-manager-v3.ts#L415)。

`AOTUIDrivenSource.getTools()` 的行为不是“只读 snapshot”，而是两步：

1. 先从 `snapshot.indexMap` 提取 app tools
2. 再调用 `kernel.getSystemToolDefinitions()` 把 `system-*` tools 补进去

相关实现见：

- [aotui-driven-source.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/adapters/aotui-driven-source.ts#L366)
- [aotui-driven-source.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/adapters/aotui-driven-source.ts#L409)
- [kernel/index.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/kernel/index.ts#L62)

这就是为什么标准 `host` 能看到 `system-open_app` 等工具。这里的语义边界是明确的：`snapshot.indexMap` 负责 app/view/tool 的快照数据，system tools 走 `kernel.getSystemToolDefinitions()`，不承诺出现在 snapshot 里。

## 推荐方案

### 方案 A：直接复用 `AOTUIDrivenSource`

这是最接近 `host` 的方式，也是工作量最小的长期正确方案。

导入路径应使用 `@aotui/runtime/adapters`，因为运行时单独导出了 `./adapters` 子路径。

```ts
import { AOTUIDrivenSource } from '@aotui/runtime/adapters';

const aotuiSource = new AOTUIDrivenSource(desktop, kernel, {
  includeInstruction: true,
});
```

然后让 OpenClaw 的 agent orchestration 使用它提供的 4 个动作：

- `getMessages()`
- `getTools()`
- `executeTool()`
- `onUpdate()`

这 4 个动作正好对应 `IDrivenSource` 的标准职责，见 [interfaces.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/agent-driver-v2/src/core/interfaces.ts#L80)。

### OpenClaw 应该怎么接

如果 OpenClaw 现在有自己的 source 聚合层，那么最简单的做法不是保留自己的 `projector.ts` 来投影系统工具，而是把 AOTUI 这一侧换成一个标准 source：

```ts
const aotuiSource = new AOTUIDrivenSource(desktop, kernel, {
  includeInstruction: true,
});

const messages = await aotuiSource.getMessages();
const tools = await aotuiSource.getTools();

const result = await aotuiSource.executeTool(toolName, args, toolCallId);

const unsubscribe = aotuiSource.onUpdate(() => {
  // 触发 OpenClaw 自己的 agent refresh / re-plan
});
```

这样做的直接收益：

- `system tools` 暴露逻辑和 `host` 完全一致
- app tools 和 system tools 的汇总逻辑不再分叉
- tool 执行路径和 `host` 一致，不用自己拆 `system-` 前缀
- 后续 runtime 如果扩展新的 system tools，OpenClaw 不需要再补 projector

## 最小兼容方案

### 方案 B：不接 `AOTUIDrivenSource`，但复刻 `host` 的 system-tools 暴露逻辑

如果 OpenClaw 当前架构不方便直接吃 `AOTUIDrivenSource`，那最小正确接法是：

1. 继续读取 `snapshot.indexMap` 里的 app tools
2. 单独读取 `kernel.getSystemToolDefinitions()` 里的 system tools
3. 如果需要消息排序，使用 `snapshot.structured.desktopTimestamp` 作为 Desktop State 的最近更新时间
4. 把两者合并成最终 tool schema

伪代码如下：

```ts
const snapshot = await kernel.acquireSnapshot(desktop.id);

try {
  const tools = {};

  for (const [key, value] of Object.entries(snapshot.indexMap ?? {})) {
    // 保留 OpenClaw 现有的 app tool 投影逻辑
    // ...
  }

  const systemTools = kernel.getSystemToolDefinitions?.() ?? [];
  for (const tool of systemTools) {
    const fn = tool.function;
    if (!fn?.name || tools[fn.name]) continue;

    tools[fn.name] = {
      description: fn.description || fn.name,
      inputSchema: fn.parameters || {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }

  return tools;
} finally {
  kernel.releaseSnapshot(snapshot.id);
}
```

执行时也不要自己写第二套 system dispatcher。直接复刻 `AOTUIDrivenSource.executeTool()` 的策略：

- 如果 tool name 以 `system-` 开头，去掉前缀
- 构造 `Operation`
- 调用 `kernel.execute(desktopId, operation, ownerId)`

相关执行逻辑见：

- [aotui-driven-source.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/adapters/aotui-driven-source.ts#L435)
- [kernel/index.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/kernel/index.ts#L219)

## 不要做什么

OpenClaw 不应该继续依赖下面这些做法：

- 只从 `snapshot.indexMap` 投影 system tools
- 从 system instruction 文本里反推可调用 tools
- 在 OpenClaw 侧手写 `system-open_app`、`system-close_app` 的 schema 常量
- 自己维护一套和 runtime 分叉的 system tool dispatcher

原因很简单：这些做法都把 runtime 已经拥有的真实控制面，复制成了 host 侧猜测。猜测一定会漂移。

## 当前发布版的边界

当前语义就是：不要把希望押在“snapshot 一定带有 system tools”这件事上。OpenClaw 应该把 snapshot 当作 app 数据面，而把 `kernel.getSystemToolDefinitions()` 当作 system tools 的控制面来源。

所以在 OpenClaw 侧，推荐按下面的优先级接入：

1. 最优：直接使用 `AOTUIDrivenSource`
2. 次优：自己聚合 tools，但必须补 `kernel.getSystemToolDefinitions()`
3. 不推荐：只认 `snapshot.indexMap`

## 参数命名注意事项

当前 system instruction 文本里，示例参数仍可能写成：

```json
{ "application": "app_id" }
```

但 system tool definition 主字段是：

```json
{ "app_id": "app_0" }
```

对应定义见 [open-app.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/engine/system/operations/system/open-app.ts#L20)。

执行层目前兼容两者，但 OpenClaw 侧生成 tool schema 时，应以 `toolDefinition.function.parameters` 为准，也就是优先使用 `app_id`。

## 接入检查清单

OpenClaw 接完后，至少应该验证这 5 件事：

1. tool 列表里能看到 `system-open_app`
2. tool 列表里能看到 `system-close_app`
3. 调用 `system-open_app` 时最终走到 `kernel.execute(...)`
4. 不需要从 system instruction 文本中猜工具定义

## 一句话建议

如果目标是“不增加工作量，又和 host 一致”，那就不要继续让 OpenClaw 自己发明 system-tools projector。要么直接接 `AOTUIDrivenSource`，要么最少复刻它那一段 `kernel.getSystemToolDefinitions()` 的补充逻辑。
