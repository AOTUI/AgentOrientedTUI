# AOTUI 应用分发体系技术设计与实施计划（Phase 1-3）

## 1. 背景与问题

当前 AOTUI 应用安装主要依赖 `agentina link <path>`，更偏向本地开发联调流程，不适合面向最终用户的发布与分发。主要痛点：

1. 开发者发布路径不统一，缺少标准化包分发入口。
2. 用户安装路径不可发现，缺少搜索和一键安装体验。
3. 运行时配置里定义了 `npm:`/`git:` source，但 Worker 安装链路未完整支持线上分发。

## 2. 目标与非目标

### 2.1 目标

1. 建立“开发者可发布、用户可搜索安装”的标准分发链路。
2. 保持对现有 `local:`/`link` 开发模式的兼容。
3. 分阶段上线，优先交付可运行、可验证的 Phase 1。

### 2.2 非目标（本轮不做）

1. 不在 Phase 1 自建完整中心化应用商店后端。
2. 不在 Phase 1 实现复杂的审核、评分、推荐系统。
3. 不在 Phase 1 引入强制代码签名校验（先完成元数据与安装链路，签名在后续阶段增强）。

## 3. 当前系统现状

1. CLI 以 `link/remove/list/enable/disable/autostart/run` 为主，缺少 `install/search/update`。
2. AppRegistry 配置层支持 `source` 抽象，但 `npm:` 与 `git:` 在 Worker 模式仍标记为不支持。
3. GUI AppsTab 主要用于启停已安装应用，缺少“发现-安装-升级”入口。

## 4. 总体架构设计

采用“三层解耦”架构：

1. 发布层（Publish）
   - 开发者通过 NPM 发布 AOTUI App（包内包含 build 产物 + 由 build 生成的 `aoapp.json`）。
2. 目录层（Catalog）
   - 提供可检索应用索引（Phase 1 使用内置/静态 Catalog；后续扩展到远程 Catalog 服务）。
3. 安装层（Install Runtime）
   - `agentina install` 将 npm 包安装到本地缓存目录，再以 `local:` source 注册到现有 Runtime。

该方案优势：不破坏现有 Runtime 加载路径，改造风险低，可快速上线。

## 5. 配置与数据模型设计

基于 `~/.agentina/config.json` 的 `apps.<app_name>` 扩展字段：

1. `source`: 实际运行 source（Phase 1 为 `local:<cachePath>`）。
2. `originalSource`: 原始来源（如 `npm:@scope/pkg@1.2.3`）。
3. `distribution`: 分发元数据对象，建议结构：
   - `type`: `npm` | `local`
   - `packageName`: npm 包名（npm 来源）
   - `requested`: 请求安装的 spec（如 `@scope/pkg@latest`）
   - `resolvedVersion`: 实际安装版本
   - `installedPath`: 本地缓存路径
   - `installedAt`: 安装时间戳
4. `autoStart`: 保持现有语义。

说明：Phase 1 先保证向后兼容，旧配置无上述字段也可正常运行。

## 6. CLI 设计（Phase 1）

### 6.1 新增命令

1. `agentina install <sourceOrPackage> [--force] [--no-autostart]`
   - 输入可为：
     - 本地路径（等价 link）
     - `local:<path>`
     - `npm:<pkg[@version]>`
     - `<pkg[@version]>`（默认按 npm 包处理）
2. `agentina search [keyword]`
   - 从 Catalog 检索可安装应用并输出安装指令。

### 6.2 兼容命令

1. `agentina link <path>` 继续保留，内部作为 `install local` 的别名路径。

## 7. 安装链路设计（Phase 1）

### 7.1 npm 安装策略

1. 本地缓存目录：`~/.agentina/apps/npm/<sanitized-package>/<sanitized-version>/`
2. 使用 `npm install --no-save --omit=dev --ignore-scripts` 安装到缓存目录（降低供应链风险面）。
3. 从 `node_modules/<package>` 作为运行加载根目录，交由现有 `AppRegistry` entry 解析逻辑查找入口。

### 7.2 运行加载策略

1. 配置中记录 `source=local:<installedPath>`。
2. Runtime 仍走现有 `local:` 模块加载链路，无需强依赖直接 `npm:` Worker 解析。

## 8. Catalog 设计（Phase 1-2）

### 8.1 Phase 1

1. 内置 default app catalog（runtime 内置数据）。
2. 支持按名称、包名、描述关键词搜索。

### 8.2 Phase 2

1. 支持远程 Catalog 拉取（静态 JSON CDN / API）。
2. 引入签名与来源可信标识字段。

## 9. 安全与治理

Phase 1 基线：

1. npm 安装默认 `--ignore-scripts`，禁用 postinstall 脚本执行。
2. 限定安装目录在 `~/.agentina/apps`。
3. 安装前后日志可追踪（source、resolved version、cache path）。

Phase 2+ 增强：

1. 包签名验证（Sigstore / 公钥签名）。
2. 权限声明（filesystem/network/subprocess）+ 首次安装授权确认。
3. 风险分级与黑名单阻断。

## 10. 开发计划

### Phase 1（当前迭代）

1. 新增设计文档与分发规范落地说明。
2. CLI 增加 `install/search` 与 source 解析模块。
3. npm 缓存安装器（可复用工具函数）。
4. AppRegistry `add` 扩展元数据写入能力。
5. 单元测试与回归测试。

### Phase 2

1. Host GUI 增加 Discover/Install/Update 交互。
2. tRPC 增加 apps discover/install/uninstall/update 接口。
3. 远程 Catalog 接入、缓存策略、故障降级。

### Phase 3

1. 发布门户（开发者提交、审核流、版本管理）。
2. 安全签名体系与合规审计。
3. 自动升级与回滚机制。

### Phase 3 Foundation（本次落地）

1. Runtime 新增远端 Catalog Resolver：
   - 支持从远端 JSON Registry 拉取应用目录。
   - 支持本地缓存文件回退。
   - 支持内置 Catalog 作为最终兜底。
2. 安全基线增强：
   - 支持 Ed25519 目录签名验证。
   - 支持在 `~/.agentina/config.json` 的 `catalog` 段配置 `url`、`requireSignature`、`trustedKeys`、`cachePath`。
   - 当配置了 trusted key 或显式要求签名时，未签名/签名错误的远端目录不会被信任。
3. Product/Host 接入：
   - CLI `agentina search` 统一走 Catalog Resolver。
   - Host AppsTab 展示目录来源（remote/cache/builtin）、签名校验状态和回退告警。

建议的目录响应格式：

```json
{
  "catalog": {
    "version": 2,
    "updatedAt": "2026-03-06T00:00:00.000Z",
    "apps": [
      {
        "id": "weather-app",
        "name": "Weather App",
        "packageName": "@aotui/weather-app",
        "description": "Weather forecasts for agents.",
        "latestVersion": "1.2.3"
      }
    ]
  },
  "signature": {
    "keyId": "catalog-root",
    "algorithm": "ed25519",
    "value": "<base64-signature>"
  }
}
```

## 11. 测试方案

### 11.1 单元测试

1. source 解析：
   - `local:`、相对路径、绝对路径、npm spec、scoped package spec。
2. npm spec 解析：
   - `pkg`、`pkg@1.2.3`、`@scope/pkg`、`@scope/pkg@beta`。
3. catalog 搜索：
   - 空关键词、命中名称、命中描述、无结果。

### 11.2 集成测试

1. CLI install 本地路径 -> config 写入 -> list 可见。
2. CLI install npm（mock npm 安装器）-> config 写入 metadata。
3. Desktop 创建时第三方 app 自动安装链路不回归。
4. 远端 Catalog 拉取成功 -> 搜索结果可见。
5. 远端 Catalog 不可用 -> 回退到缓存。
6. 签名错误或缺失（requireSignature=true）-> 不信任远端目录并回退。

### 11.3 回归测试

1. `link/remove/enable/disable/autostart/run` 旧命令行为不破坏。
2. 旧配置文件（无 distribution 字段）可正常加载与启动。

## 12. 准出条件（Go/No-Go）

满足以下条件才允许合并：

1. 代码层：
   - `agentina install/search` 可用且通过功能验证。
   - 旧命令兼容，且无 breaking change。
   - Host AppsTab 可展示 catalog 来源与校验状态。
2. 测试层：
   - 新增单测通过。
   - runtime 关键测试集通过。
3. 质量层：
   - 关键错误有明确提示（npm 不可用、包不存在、入口无效）。
   - 配置写入具备可回溯元数据。
4. 文档层：
   - 发布-安装流程文档可被开发者与用户直接执行。

## 13. 风险与缓解

1. 风险：npm 供应链风险
   - 缓解：`--ignore-scripts` + 后续签名验证。
2. 风险：缓存目录膨胀
   - 缓解：后续增加 `agentina cache prune`。
3. 风险：包入口不规范
   - 缓解：安装后立即做 `aoapp.json`/factory 校验并给出明确错误。

## 14. 里程碑验收清单（本轮）

1. 文档已落库：技术设计 + 开发计划 + 测试方案 + 准出条件。
2. CLI 支持 npm 分发安装与 Catalog 搜索。
3. 关键测试通过并输出执行结果。
