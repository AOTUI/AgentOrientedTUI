/**
 * Config - 项目配置管理模块
 *
 * - MCP 服务器配置持久化（存储于 ~/.tui/mcp.json）
 * - 供 mcp/index.ts 和 trpc/router.ts 使用
 */

import fs from "fs/promises"
import path from "path"
import os from "os"
import { z } from "zod"

// ─── MCP Zod 类型定义 ─────────────────────────────────────────────────────────

export const McpLocal = z
  .object({
    type: z.literal("local").describe("Type of MCP server connection"),
    command: z.string().array().describe("Command and arguments to run the MCP server"),
    environment: z
      .record(z.string(), z.string())
      .optional()
      .describe("Environment variables to set when running the MCP server"),
    enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
    timeout: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Timeout in ms for MCP server requests. Defaults to 5000 (5 seconds) if not specified."),
  })
  .strict()

export const McpOAuth = z
  .object({
    clientId: z
      .string()
      .optional()
      .describe("OAuth client ID. If not provided, dynamic client registration (RFC 7591) will be attempted."),
    clientSecret: z.string().optional().describe("OAuth client secret (if required by the authorization server)"),
    scope: z.string().optional().describe("OAuth scopes to request during authorization"),
  })
  .strict()
export type McpOAuth = z.infer<typeof McpOAuth>

export const McpRemote = z
  .object({
    type: z.literal("remote").describe("Type of MCP server connection"),
    url: z.string().describe("URL of the remote MCP server"),
    enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
    headers: z.record(z.string(), z.string()).optional().describe("Headers to send with the request"),
    oauth: z
      .union([McpOAuth, z.literal(false)])
      .optional()
      .describe(
        "OAuth authentication configuration for the MCP server. Set to false to disable OAuth auto-detection.",
      ),
    timeout: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Timeout in ms for MCP server requests. Defaults to 5000 (5 seconds) if not specified."),
  })
  .strict()

export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote])
export type Mcp = z.infer<typeof Mcp>

// ─── 全局配置 Info 类型 ───────────────────────────────────────────────────────

export interface Info {
  $schema?: string
  mcp?: Record<string, Mcp | { enabled: boolean }>
  skills?: {
    enabled?: boolean
    disabledSkills?: string[]
    paths?: string[]
    urls?: string[]
  }
  prompts?: {
    templates?: Array<{
      id: string
      name: string
      content: string
      updatedAt?: number
      createdAt?: number
    }>
  }
  experimental?: {
    contextCompaction?: {
      enabled?: boolean
      minMessages?: number
      keepRecentMessages?: number
      hardFallbackThresholdTokens?: number
    }
    [key: string]: unknown
  }
  agents?: {
    list: Array<{
      id: string
      name: string
      prompt: string
      modelId: string
      enabledApps: string[]
      enabledSkills: Record<string, string[]>
      enabledMCPs: string[]
      disabledMcpTools?: string[]
      skin: {
        working?: string
        idle?: string
        sleeping?: string
        pause?: string
      }
    }>
    activeAgentId?: string | null
  }
  [key: string]: unknown
}

export interface TuiAppConfigEntry {
  source: string
  enabled: boolean
  installedAt?: string
  [key: string]: unknown
}

export interface TuiInfo {
  version?: number
  runtime?: Record<string, unknown>
  apps?: Record<string, TuiAppConfigEntry>
  [key: string]: unknown
}

// ─── 配置文件路径 ─────────────────────────────────────────────────────────────

/** 全局 MCP 配置文件路径 (~/.tui/mcp.json) */
function getGlobalConfigPath(): string {
  return path.join(os.homedir(), ".tui", "mcp.json")
}

function getProjectConfigPath(projectPath: string): string {
  return path.join(projectPath, ".tui", "mcp.json")
}

/** 全局 TUI 配置文件路径 (~/.tui/config.json) */
function getTuiConfigPath(): string {
  return path.join(os.homedir(), ".tui", "config.json")
}

// ─── JSONC 预处理器（单遍字符级状态机）────────────────────────────────────────

/**
 * 单遍字符级状态机，同时完成：
 *   1. JSONC 注释剥离（单行注释和块注释），正确跳过字符串内容
 *   2. JSON 字符串值中裸控制字符转义（0x00-0x1F）
 *
 * 核心原则：只有在字符串外部才识别注释，避免将 URL 中的双斜杠误删。
 */
function preprocessJsonc(text: string): string {
  const out: string[] = []
  let i = 0
  let inString = false
  let escaped = false

  while (i < text.length) {
    const ch = text[i]
    const code = text.charCodeAt(i)

    if (inString) {
      // 上一字符是反斜杠 → 当前字符是转义序列的第二个字符，原样输出
      if (escaped) {
        out.push(ch)
        escaped = false
        i++
        continue
      }
      // 反斜杠 → 开启转义
      if (ch === "\\") {
        out.push(ch)
        escaped = true
        i++
        continue
      }
      // 关闭字符串
      if (ch === '"') {
        inString = false
        out.push(ch)
        i++
        continue
      }
      // 裸控制字符（换行、回车、制表符等）→ 转义为 JSON 合法序列
      if (code < 0x20) {
        if (code === 0x0a) out.push("\\n")
        else if (code === 0x0d) out.push("\\r")
        else if (code === 0x09) out.push("\\t")
        else {
          const hex = code.toString(16).padStart(4, "0")
          out.push("\\u" + hex)
        }
        i++
        continue
      }
      out.push(ch)
      i++
      continue
    }

    // ── 字符串外 ──────────────────────────────────────────────────────
    // 进入字符串
    if (ch === '"') {
      inString = true
      out.push(ch)
      i++
      continue
    }

    // 单行注释 //
    if (ch === "/" && i + 1 < text.length && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++
      continue
    }

    // 块注释 /* ... */
    if (ch === "/" && i + 1 < text.length && text[i + 1] === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && i + 1 < text.length && text[i + 1] === "/")) {
        i++
      }
      i += 2 // 跳过 */
      continue
    }

    out.push(ch)
    i++
  }

  return out.join("")
}

// ─── 内部读取函数 ─────────────────────────────────────────────────────────────

async function readConfigFile(filepath: string): Promise<Info> {
  try {
    const text = await fs.readFile(filepath, "utf8")
    return JSON.parse(preprocessJsonc(text)) as Info
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw err
  }
}

async function readTuiConfigFile(filepath: string): Promise<TuiInfo> {
  try {
    const text = await fs.readFile(filepath, "utf8")
    return JSON.parse(preprocessJsonc(text)) as TuiInfo
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {}
    throw err
  }
}

// ─── Config namespace ─────────────────────────────────────────────────────────

export namespace Config {
  export type McpType = Mcp
  export type McpOAuthType = McpOAuth
  export type InfoType = Info
  export type TuiInfoType = TuiInfo
  export type TuiAppConfigEntryType = TuiAppConfigEntry

  /** 获取全局配置（从 ~/.tui/mcp.json 读取） */
  export async function getGlobal(): Promise<Info> {
    return readConfigFile(getGlobalConfigPath())
  }

  /** 获取项目配置（从 <projectPath>/.tui/mcp.json 读取） */
  export async function getProject(projectPath: string): Promise<Info> {
    return readConfigFile(getProjectConfigPath(projectPath))
  }

  /** 获取当前运行时配置（与 getGlobal 等价，无内存缓存） */
  export async function get(): Promise<Info & { experimental?: Record<string, unknown> }> {
    return getGlobal()
  }

  /** 合并 patch 并写回全局配置文件 */
  export async function updateGlobal(patch: Partial<Info>): Promise<Info> {
    const filepath = getGlobalConfigPath()
    await fs.mkdir(path.dirname(filepath), { recursive: true })

    const existing = await readConfigFile(filepath)

    // 深 merge：mcp 字段对象合并，其他字段直接覆盖
    const merged: Info = { ...existing }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue
      if (key === "mcp" && existing.mcp != null && typeof value === "object" && value !== null) {
        merged.mcp = {
          ...existing.mcp,
          ...(value as Record<string, Mcp | { enabled: boolean }>),
        }
      } else {
        merged[key] = value
      }
    }

    if (!merged.$schema) {
      merged.$schema = "https://opencode.ai/config.json"
    }

    await fs.writeFile(filepath, JSON.stringify(merged, null, 2), "utf8")
    return merged
  }

  /**
   * 以“替换”语义更新 MCP 配置。
   *
   * 注意：MCP 管理场景（可删除 server）不能使用 merge 语义，
   * 否则旧 key 会残留，导致 Delete/Save 看起来不生效。
   */
  export async function replaceGlobalMcp(mcp: Info["mcp"]): Promise<Info> {
    const filepath = getGlobalConfigPath()
    await fs.mkdir(path.dirname(filepath), { recursive: true })

    const existing = await readConfigFile(filepath)
    const merged: Info = {
      ...existing,
      mcp: mcp ?? {},
    }

    // 清理历史字段，避免双源配置不一致（mcp 优先 / mcpServers 残留）
    if ("mcpServers" in merged) {
      delete (merged as Record<string, unknown>).mcpServers
    }

    if (!merged.$schema) {
      merged.$schema = "https://opencode.ai/config.json"
    }

    await fs.writeFile(filepath, JSON.stringify(merged, null, 2), "utf8")
    return merged
  }

  export async function getAppsConfig(): Promise<Record<string, TuiAppConfigEntry>> {
    const config = await readTuiConfigFile(getTuiConfigPath())
    const apps = config.apps
    if (!apps || typeof apps !== "object") {
      return {}
    }
    return apps
  }

  export async function getTuiConfig(): Promise<TuiInfo> {
    return readTuiConfigFile(getTuiConfigPath())
  }

  export async function replaceGlobalApps(apps: Record<string, TuiAppConfigEntry>): Promise<TuiInfo> {
    const filepath = getTuiConfigPath()
    await fs.mkdir(path.dirname(filepath), { recursive: true })

    const existing = await readTuiConfigFile(filepath)
    const merged: TuiInfo = {
      ...existing,
      version: typeof existing.version === "number" ? existing.version : 2,
      runtime: existing.runtime ?? { workerScript: "" },
      apps,
    }

    await fs.writeFile(filepath, JSON.stringify(merged, null, 2), "utf8")
    return merged
  }

  export async function setGlobalAppEnabled(name: string, enabled: boolean): Promise<TuiInfo> {
    const existing = await getTuiConfig()
    const currentApps = existing.apps ?? {}
    const current = currentApps[name]

    if (!current) {
      throw new Error(`App \"${name}\" not found in ~/.tui/config.json`)
    }

    return replaceGlobalApps({
      ...currentApps,
      [name]: {
        ...current,
        enabled,
      },
    })
  }
}
