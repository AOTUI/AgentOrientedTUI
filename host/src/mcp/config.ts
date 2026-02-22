import { z } from "zod";
import { Config as GlobalConfig } from "../config/config.js";

export const McpLocal = z
  .object({
    type: z.literal("local").describe("Type of MCP server connection"),
    command: z.string().array().describe("Command and arguments to run the MCP server"),
    environment: z
      .record(z.string(), z.string())
      .optional()
      .describe("Environment variables to set when running the MCP server"),
    enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
    disabledTools: z
      .string()
      .array()
      .optional()
      .describe("List of tool names that are disabled for this MCP server"),
    timeout: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Timeout in ms for MCP server requests. Defaults to 5000 (5 seconds) if not specified."),
  })
  .passthrough();

export const McpOAuth = z
  .object({
    clientId: z
      .string()
      .optional()
      .describe("OAuth client ID. If not provided, dynamic client registration (RFC 7591) will be attempted."),
    clientSecret: z.string().optional().describe("OAuth client secret (if required by the authorization server)"),
    scope: z.string().optional().describe("OAuth scopes to request during authorization"),
  })
  .strict();

export type McpOAuth = z.infer<typeof McpOAuth>;

export const McpRemote = z
  .object({
    type: z.literal("remote").describe("Type of MCP server connection"),
    url: z.string().describe("URL of the remote MCP server"),
    enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
    disabledTools: z
      .string()
      .array()
      .optional()
      .describe("List of tool names that are disabled for this MCP server"),
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
  .passthrough();

export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote]);
export type Mcp = z.infer<typeof Mcp>;

function toObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function normalizeServerEntry(entry: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...entry };

  if (normalized.enabled === undefined && typeof normalized.disabled === "boolean") {
    normalized.enabled = !normalized.disabled;
  }

  if (typeof normalized.command === "string") {
    const args = Array.isArray(normalized.args)
      ? normalized.args.filter((arg: unknown): arg is string => typeof arg === "string")
      : [];
    normalized.command = [normalized.command, ...args];
  }

  if (!normalized.type) {
    if (typeof normalized.url === "string") normalized.type = "remote";
    else if (Array.isArray(normalized.command)) normalized.type = "local";
  }

  if (!normalized.environment && normalized.env && typeof normalized.env === "object") {
    normalized.environment = normalized.env;
  }

  return normalized;
}

function normalizeMcpConfig(input: unknown): Record<string, Mcp> {
  const obj = toObject(input);
  const rawServers = toObject(obj.mcpServers ?? obj);

  const entries: Array<[string, Record<string, any>]> = Object.entries(rawServers)
    .filter(([, value]) => value && typeof value === "object")
    .map(([name, value]) => [name, normalizeServerEntry(value as Record<string, any>)]);

  const result: Record<string, Mcp> = {};
  for (const [name, value] of entries) {
    const parsed = Mcp.safeParse(value);
    if (parsed.success) {
      result[name] = parsed.data;
    }
  }
  return result;
}

export namespace Config {
  export type Mcp = z.infer<typeof Mcp>;
  export type Info = { mcp?: Record<string, Mcp> };

  let overrideConfig: Info | null = null;

  export async function get(): Promise<Info & { experimental?: any }> {
    if (overrideConfig) {
      return overrideConfig;
    }

    const globalConfig = await GlobalConfig.getGlobal();
    const source = (globalConfig as Record<string, unknown>).mcp ?? (globalConfig as Record<string, unknown>).mcpServers ?? {};
    const mcp = normalizeMcpConfig(source);

    return {
      ...(globalConfig as Record<string, unknown>),
      mcp,
    };
  }

  export function setConfig(cfg: Info) {
    overrideConfig = cfg;
  }
}
