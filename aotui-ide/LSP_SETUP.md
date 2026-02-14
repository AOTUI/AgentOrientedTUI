# LSP Setup Guide

AOTUI IDE 通过 Language Server Protocol (LSP) 为 LLM 提供代码智能感知能力。本文档说明如何安装和配置各种 LSP Server。

## 支持的 Language Servers

### TypeScript / JavaScript ⭐️ (推荐)

**适用文件类型**: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`

**安装方式**:

```bash
# 全局安装（推荐）
npm install -g typescript-language-server typescript

# 或在项目中安装
npm install --save-dev typescript-language-server typescript
```

**验证安装**:

```bash
typescript-language-server --version
```

---

### Python (Pyright)

**适用文件类型**: `.py`, `.pyi`

**安装方式**:

```bash
# 全局安装
npm install -g pyright

# 或使用 pip
pip install pyright
```

**验证安装**:

```bash
pyright --version
```

---

### Go (gopls)

**适用文件类型**: `.go`

**前置要求**: 需要安装 Go (<https://go.dev/dl/>)

**安装方式**:

```bash
go install golang.org/x/tools/gopls@latest
```

**验证安装**:

```bash
gopls version
```

> **注意**: 确保 `$GOPATH/bin` 或 `$HOME/go/bin` 在你的 PATH 中

---

### Rust (rust-analyzer)

**适用文件类型**: `.rs`

**前置要求**: 需要安装 Rust (<https://rustup.rs/>)

**安装方式**:

```bash
# 通过 rustup 安装
rustup component add rust-analyzer
```

**验证安装**:

```bash
rust-analyzer --version
```

---

### C/C++ (clangd)

**适用文件类型**: `.c`, `.cpp`, `.h`, `.hpp`, `.cc`, `.objc`, `.objcpp`

**安装方式**:

根据操作系统选择：

**macOS** (通过 Homebrew):

```bash
brew install llvm
# 将 clangd 添加到 PATH
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
```

**Linux** (Ubuntu/Debian):

```bash
sudo apt-get install clangd
```

**Windows**:
下载 LLVM: <https://releases.llvm.org/download.html>

**验证安装**:

```bash
clangd --version
```

---

## 快速安装（常用语言）

如果你主要使用 TypeScript/JavaScript 进行开发，只需运行：

```bash
npm install -g typescript-language-server typescript
```

如果需要 Python + TypeScript 支持：

```bash
npm install -g typescript-language-server typescript pyright
```

---

## 配置 LSP (可选)

### 全局禁用 LSP

如果你不需要 LSP 功能，可以在配置文件中禁用：

```json
// .aotui-ide/config.json
{
  "lsp": false
}
```

### 禁用特定 Language Server

```json
// .aotui-ide/config.json
{
  "lsp": {
    "typescript": {
      "disabled": true
    }
  }
}
```

### 添加自定义 Language Server

```json
// .aotui-ide/config.json
{
  "lsp": {
    "my-custom-server": {
      "command": ["path/to/server", "--stdio"],
      "extensions": [".custom"],
      "env": {
        "CUSTOM_VAR": "value"
      }
    }
  }
}
```

---

## 故障排查

### 问题：LSP Server 启动失败

**错误信息**:

```
[LSP.SERVER] Failed to start typescript-language-server Error: spawn typescript-language-server ENOENT
```

**解决方案**:

1. 检查 LSP Server 是否已安装:

   ```bash
   which typescript-language-server
   ```

2. 如果未安装，按照上述安装指南安装

3. 如果已安装但仍报错，检查 PATH 环境变量

### 问题：LSP 没有任何反应

**可能原因**:

- LSP Server 未找到对应的项目配置文件（如 `tsconfig.json`）
- 文件扩展名不在支持列表中

**解决方案**:

- 确保项目根目录有对应的配置文件
- 查看 aotui-ide 日志确认 LSP 是否成功启动

### 问题：性能问题

如果 LSP 导致性能下降，可以：

1. 禁用不需要的 Language Server
2. 减小项目规模（排除 `node_modules`, `dist` 等）
3. 在项目的 `.gitignore` 或 LSP 配置中排除大型目录

---

## LSP 功能说明

AOTUI IDE 通过 LSP 提供以下功能给 LLM Agent:

- **Hover**: 获取符号的类型信息和文档
- **Go to Definition**: 跳转到定义位置
- **Find References**: 查找所有引用
- **Call Hierarchy**: 查看函数调用关系
- **Diagnostics**: 获取编译错误和警告
- **Document Symbols**: 获取文件符号大纲

这些功能帮助 LLM 更好地理解代码结构和语义，从而提供更准确的代码建议。

---

## 常见问题

**Q: 为什么没有 JSON/HTML Language Server？**

A: 为了对齐 opencode 的设计，aotui-ide 不包含 JSON/HTML LSP。这些语言的 LSP 对 LLM 辅助开发的价值有限。如果确实需要，可以通过自定义 LSP 配置添加。

**Q: 如何更新 Language Server？**

A: 使用相同的安装命令重新安装即可：

```bash
npm install -g typescript-language-server@latest typescript@latest
```

**Q: 可以在项目中而非全局安装吗？**

A: 可以。aotui-ide 会自动检查项目的 `node_modules/.bin` 目录。但全局安装可以跨项目共享，减少重复安装。

---

## 参考资料

- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server)
- [Pyright](https://github.com/microsoft/pyright)
- [gopls](https://github.com/golang/tools/tree/master/gopls)
- [rust-analyzer](https://rust-analyzer.github.io/)
- [clangd](https://clangd.llvm.org/)
- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
