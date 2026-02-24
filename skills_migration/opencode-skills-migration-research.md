# OpenCode Skills 迁移调研报告（What / Why / How）

## 1. 调研目标

本报告面向“将 OpenCode 的 Skills 能力迁移到其他项目”的工程团队，目标是：

1. 讲清楚 OpenCode Skills 的能力边界（What）
2. 讲清楚其关键设计决策与长期主义价值（Why）
3. 讲清楚可直接复制的实现路径与迁移步骤（How）

---

## 2. 一句话结论（Executive Summary）

OpenCode 的 Skills 不是“固定 prompt 模板”，而是一个 **多来源发现 + 统一注册 + 按需注入 + 权限门控 + 会话留存友好** 的运行时能力系统。

其核心价值在于：

- **可组合**：技能可来自本地、全局、外部兼容目录、远程 URL
- **可治理**：通过统一权限模型对“可见性 + 执行”双层控制
- **可演进**：技能与工具系统解耦，能逐步扩展而不破坏主流程
- **可迁移**：抽象边界清晰，适合在其他 Agent/IDE/CLI 项目中平移

---

## 3. What：OpenCode Skills 到底是什么

## 3.1 能力定义

在 OpenCode 中，Skill 是一份带 frontmatter 的 `SKILL.md`，至少包含：

- `name`
- `description`
- markdown 正文内容（作为注入上下文）

运行时统一映射为结构：

- `name`
- `description`
- `location`
- `content`

实现参考：

- [packages/opencode/src/skill/skill.ts](../packages/opencode/src/skill/skill.ts)

## 3.2 运行时生命周期

Skill 生命周期可以抽象为 5 个阶段：

1. **发现（Discover）**：从多个来源扫描 `SKILL.md`
2. **解析（Parse）**：解析 frontmatter + markdown
3. **注册（Register）**：写入统一内存态（同名覆盖，后写优先）
4. **暴露（Expose）**：通过 `skill` 工具描述对模型暴露 `available_skills`
5. **执行（Load）**：按 `name` 加载并注入 `<skill_content>` 到会话上下文

---

## 4. Why：为什么这样设计

## 4.1 多来源发现：兼容生态 + 降低迁移阻力

OpenCode 同时扫描：

- `.opencode/skill` 与 `.opencode/skills`
- `.claude/skills`
- `.agents/skills`
- `config.skills.paths`
- `config.skills.urls`（远程索引）

这使 Skills 能力天然具备生态兼容性，迁移时不要求用户“重写全部目录结构”。

关键实现：

- [packages/opencode/src/skill/skill.ts](../packages/opencode/src/skill/skill.ts)
- [packages/opencode/src/skill/discovery.ts](../packages/opencode/src/skill/discovery.ts)

## 4.2 双层权限控制：最小授权原则

Skill 权限不是单点判断，而是两层：

1. **列表层过滤**：不可访问技能不会出现在 `available_skills`
2. **执行层审批**：调用时再次 `allow/ask/deny` 判定

这比“只在执行时拦截”更安全，也降低模型误选概率。

关键实现：

- [packages/opencode/src/tool/skill.ts](../packages/opencode/src/tool/skill.ts)
- [packages/opencode/src/permission/next.ts](../packages/opencode/src/permission/next.ts)

## 4.3 技能目录白名单：保证工具链可访问技能资源

Skill 常附带 scripts/reference 文件。OpenCode 将技能目录加入 `external_directory` allow 规则，避免技能被加载后却无法访问配套资源。

关键实现：

- [packages/opencode/src/agent/agent.ts](../packages/opencode/src/agent/agent.ts)

## 4.4 会话压缩保护：保留关键上下文

会话压缩（prune）时对 `skill` 工具输出做保护，减少“技能刚加载就被剪掉”的失真风险。

关键实现：

- [packages/opencode/src/session/compaction.ts](../packages/opencode/src/session/compaction.ts)

---

## 5. How：OpenCode Skills 管理的实现细节

## 5.1 发现与聚合层（Skill State）

入口是 `Skill.state = Instance.state(async () => ...)`，在一次实例上下文内缓存发现结果。

### 来源与优先级（实际行为）

按代码执行顺序，后写会覆盖同名技能：

1. 外部全局目录（`~/.claude`, `~/.agents`）
2. 外部项目目录（从当前目录向上到 worktree）
3. `.opencode/skill(s)`
4. `config.skills.paths`
5. `config.skills.urls`（远程下载后本地扫描）

同名冲突策略：

- 输出 warning
- 最后写入者覆盖前者

### 远程技能分发协议

远程端要求提供 `index.json`，格式包含 `skills[]`，每个 skill 声明 `name` 与 `files[]`。

客户端逻辑：

- 下载 `index.json`
- 下载 `skills/<name>/...` 文件到缓存目录
- 若存在 `SKILL.md` 则判定该技能可用

实现参考：

- [packages/opencode/src/skill/discovery.ts](../packages/opencode/src/skill/discovery.ts)

## 5.2 工具集成层（Tool Registry + Skill Tool）

`SkillTool` 在工具注册表中作为内置工具参与模型工具集。

工具描述动态拼装：

- 将可访问技能渲染为 `<available_skills>` 列表
- 给模型明确使用时机和输出结构

工具执行时：

1. `Skill.get(name)` 获取技能
2. 执行权限审批 `ctx.ask({ permission: "skill", ... })`
3. 输出 `<skill_content name="...">` + 正文 + base dir + 采样文件列表

实现参考：

- [packages/opencode/src/tool/registry.ts](../packages/opencode/src/tool/registry.ts)
- [packages/opencode/src/tool/skill.ts](../packages/opencode/src/tool/skill.ts)

## 5.3 命令与 UI 集成层

OpenCode 将 Skill 以两条路径集成：

1. **Tool 路径**：模型主动调用 `skill` 工具
2. **Command 路径**：Skill 也映射为 command（source=skill）

UI 端通过 API 拉技能列表用于技能选择对话框。

实现参考：

- [packages/opencode/src/command/index.ts](../packages/opencode/src/command/index.ts)
- [packages/opencode/src/server/server.ts](../packages/opencode/src/server/server.ts)
- [packages/opencode/src/cli/cmd/tui/component/dialog-skill.tsx](../packages/opencode/src/cli/cmd/tui/component/dialog-skill.tsx)

## 5.4 配置与治理面

配置项：

- `skills.paths[]`
- `skills.urls[]`

相关开关：

- `OPENCODE_DISABLE_EXTERNAL_SKILLS`
- `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS`（间接影响）

实现参考：

- [packages/opencode/src/config/config.ts](../packages/opencode/src/config/config.ts)
- [packages/opencode/src/flag/flag.ts](../packages/opencode/src/flag/flag.ts)

---

## 6. 面向迁移的“可复制架构”

建议在目标项目中保留以下 6 层抽象，不要直接复制文件实现：

1. **Skill Source Layer**：本地/远程/兼容目录适配器
2. **Skill Parser Layer**：frontmatter + markdown 解析与校验
3. **Skill Registry Layer**：同名冲突策略、状态缓存、索引能力
4. **Skill Runtime Layer**：工具执行、上下文注入格式、资源清单
5. **Permission Layer**：列表过滤 + 执行审批
6. **Exposure Layer**：API/CLI/UI 出口

推荐数据模型（最小集）：

```ts
type SkillInfo = {
  name: string
  description: string
  location: string
  content: string
}
```

---

## 7. 迁移实施蓝图（可直接执行）

## Phase 0：协议冻结（1-2 天）

目标：先冻结跨项目共识，避免后续返工。

- 冻结 Skill frontmatter 最小字段
- 冻结 remote index.json 协议
- 冻结冲突优先级策略（建议显式声明）
- 冻结权限语义：`allow/ask/deny`

交付物：

- `SKILL.md` 规范文档
- `index.json` JSON Schema
- 权限矩阵说明

## Phase 1：最小可用能力（3-5 天）

目标：让目标项目“能发现、能加载、能执行”。

- 实现本地目录扫描（先做单来源）
- 实现 `skill` runtime/tool
- 输出统一 `<skill_content>`（或等价结构）
- 增加 API：`GET /skill`

验收：

- 至少一个技能可被模型加载并被执行上下文消费

## Phase 2：治理与安全补齐（3-5 天）

目标：从“能用”进化到“可上线”。

- 加入权限双层门控
- 加入外部目录访问白名单
- 加入冲突告警与可观测日志
- 加入压缩/上下文策略保护（至少对技能输出设置较高保留优先级）

验收：

- `deny` 技能不可见
- `ask` 有用户确认路径
- 技能目录可访问附属资源

## Phase 3：多源与远程生态（5-7 天）

目标：完成 OpenCode 级别可扩展性。

- 接入兼容目录（`.claude/.agents`）
- 接入 `skills.paths`
- 接入 `skills.urls` + 缓存
- 引入签名/哈希校验（推荐）

验收：

- 同名覆盖策略稳定可解释
- 离线/网络失败下系统降级可用

---

## 8. 开发者迁移清单（Checklist）

## 8.1 必须实现（MUST）

- [ ] Skill 最小数据模型（name/description/location/content）
- [ ] 统一注册表与同名冲突策略
- [ ] 工具化按需加载能力
- [ ] 权限双层控制（可见性 + 执行）
- [ ] 可观测日志（扫描失败、解析失败、冲突）

## 8.2 强烈建议（SHOULD）

- [ ] 远程技能缓存目录与 TTL/版本策略
- [ ] `index.json` schema 校验
- [ ] 技能内容长度与输出裁剪策略
- [ ] 压缩阶段保护技能输出

## 8.3 企业级建议（NICE TO HAVE）

- [ ] 远程来源签名校验
- [ ] 技能发布仓库治理（审核、版本、回滚）
- [ ] 组织级权限模板

---

## 9. 高风险点与规避策略

## 风险 A：文档和实现漂移

现象：文档中要求比代码严格，迁移后容易“看文档能过、跑代码失败”。

建议：

- 以 parser schema 作为单一事实源
- 文档自动从 schema 生成

## 风险 B：同名覆盖不可预期

现象：多来源并存时，开发者不知道最终生效哪一个。

建议：

- 显式输出“最终生效来源”
- 提供 debug 命令打印覆盖链路

## 风险 C：远程来源供应链风险

现象：`skills.urls` 引入第三方内容，可能被污染。

建议：

- 允许域名白名单
- 引入签名或内容哈希校验
- 默认最小权限

## 风险 D：技能可加载但资源不可读

现象：技能正文引用脚本，但工具层读不到目录。

建议：

- 自动将技能目录映射到外部目录白名单
- 若失败，明确提示缺失权限而非静默失败

---

## 10. 参考实现入口（代码导航）

- 技能发现与聚合：
  - [packages/opencode/src/skill/skill.ts](../packages/opencode/src/skill/skill.ts)
- 远程发现与缓存：
  - [packages/opencode/src/skill/discovery.ts](../packages/opencode/src/skill/discovery.ts)
- 技能工具：
  - [packages/opencode/src/tool/skill.ts](../packages/opencode/src/tool/skill.ts)
- 工具注册：
  - [packages/opencode/src/tool/registry.ts](../packages/opencode/src/tool/registry.ts)
- 权限引擎：
  - [packages/opencode/src/permission/next.ts](../packages/opencode/src/permission/next.ts)
- Agent 权限与白名单：
  - [packages/opencode/src/agent/agent.ts](../packages/opencode/src/agent/agent.ts)
- API 暴露：
  - [packages/opencode/src/server/server.ts](../packages/opencode/src/server/server.ts)
- TUI 技能选择：
  - [packages/opencode/src/cli/cmd/tui/component/dialog-skill.tsx](../packages/opencode/src/cli/cmd/tui/component/dialog-skill.tsx)
- 压缩保护：
  - [packages/opencode/src/session/compaction.ts](../packages/opencode/src/session/compaction.ts)

---

## 11. 给迁移团队的最终建议（长期主义版本）

1. **先做抽象，不先做复制。**
   先定义 Source/Registry/Runtime/Permission 4 个稳定接口，再映射到目标项目。

2. **先做可治理，再做功能堆叠。**
   只做“能加载”会很快失控；权限、日志、冲突策略必须在 MVP 就具备。

3. **先保证可观测，再做性能优化。**
   扫描链路和覆盖链路不可观测，后续问题排查成本会指数上升。

4. **先制定兼容策略，再开放生态入口。**
   远程 URL 一旦开放，协议与安全策略必须先冻结。

如果要在其他项目高质量迁移，建议按本文 Phase 0 → 1 → 2 → 3 的顺序推进，不要跳阶段。