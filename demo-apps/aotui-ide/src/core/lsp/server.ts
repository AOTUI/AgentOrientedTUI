import { spawn, type ChildProcessWithoutNullStreams } from "child_process"
import path from "path"
import { Log, Instance } from "./adapters.js"
import fs from "fs/promises"

export namespace LSPServer {
  const log = Log.create({ service: "lsp.server" })

  export interface Handle {
    process: ChildProcessWithoutNullStreams
    initialization?: Record<string, any>
  }

  type RootFunction = (file: string) => Promise<string | undefined>

  // Helper to find nearest root containing specific files
  const NearestRoot = (includePatterns: string[]): RootFunction => {
    return async (file) => {
      let current = path.dirname(file)
      const stop = Instance.directory

      while (true) {
        for (const pattern of includePatterns) {
          try {
            await fs.access(path.join(current, pattern))
            return current
          } catch { }
        }

        if (current === stop || current === path.dirname(current)) {
          return Instance.directory
        }
        current = path.dirname(current)
      }
    }
  }

  export interface Info {
    id: string
    extensions: string[]
    global?: boolean
    root: RootFunction
    spawn(root: string): Promise<Handle | undefined>
    initialization?: Record<string, any>
  }

  // =========================================================
  // Generic Spawn Helper
  // =========================================================

  async function spawnServer(root: string, command: string, args: string[]): Promise<Handle | undefined> {
    try {
      // 增强: 将当前进程工作目录下的 node_modules/.bin 添加到 PATH
      // 这样即使用户没有全局安装 server，只要项目中安装了，也能找到
      const npmBin = path.join(process.cwd(), 'node_modules', '.bin');
      const env = {
        ...process.env,
        PATH: `${npmBin}${path.delimiter}${process.env.PATH || ''}`
      };

      const proc = spawn(command, args, {
        cwd: root,
        env: env,
      });

      // 静默失败策略：LSP启动失败不应阻塞IDE功能
      proc.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          log.warn(`LSP server not found: ${command}. Please install it globally or add to project dependencies.`);
          log.warn(`Installation guide: see demo-apps/aotui-ide/LSP_SETUP.md`);
        } else {
          log.error(`Failed to start ${command}`, err);
        }
      });

      return { process: proc };
    } catch (e) {
      log.error(`Failed to spawn ${command}`, e);
      return undefined;
    }
  }

  // =========================================================
  // Language Server Definitions
  // =========================================================

  // TypeScript / JavaScript
  export const Typescript: Info = {
    id: "typescript",
    root: NearestRoot(
      ["package.json", "tsconfig.json", "jsconfig.json"]
    ),
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    async spawn(root) {
      return spawnServer(root, "typescript-language-server", ["--stdio"])
        .then(handle => {
          if (handle) {
            handle.initialization = {
              preferences: {
                includeInlayParameterNameHints: 'all',
                includeInlayFunctionParameterTypeHints: true,
                includeInlayVariableTypeHints: true
              }
            };
          }
          return handle;
        });
    },
  }

  // Python (Pyright)
  export const Pyright: Info = {
    id: "pyright",
    root: NearestRoot(
      ["pyrightconfig.json", "pyproject.toml", "setup.py", "requirements.txt"]
    ),
    extensions: [".py", ".pyi"],
    async spawn(root) {
      return spawnServer(root, "pyright-langserver", ["--stdio"]);
    }
  }

  // Go (gopls)
  export const Go: Info = {
    id: "gopls",
    root: NearestRoot(["go.mod", "go.work"]),
    extensions: [".go"],
    async spawn(root) {
      return spawnServer(root, "gopls", ["serve"]);
    }
  }

  // Rust (rust-analyzer)
  export const Rust: Info = {
    id: "rust-analyzer",
    root: NearestRoot(["Cargo.toml"]),
    extensions: [".rs"],
    async spawn(root) {
      return spawnServer(root, "rust-analyzer", []);
    }
  }

  // C/C++ (clangd)
  export const Clangd: Info = {
    id: "clangd",
    root: NearestRoot(["compile_commands.json", "compile_flags.txt", ".clang-format"]),
    extensions: [".c", ".cpp", ".objc", ".objcpp", ".cc", ".h", ".hpp"],
    async spawn(root) {
      return spawnServer(root, "clangd", []);
    }
  }

  // JSON and HTML servers are not included to align with opencode
  // These provide limited value for LLM-assisted development
  // If needed, users can configure custom LSP servers via config file
}
