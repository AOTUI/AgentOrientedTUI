import { IDrivenSource, MessageWithTimestamp, ToolResult } from "@aotui/agent-driver-v2";
import { Tool } from "ai";
import { MCP } from "./index.js";
import { Bus, BusEvent } from "./utils.js";
import { Log } from "./utils.js";

const log = Log.create({ service: "mcp-driven-source" });

export class McpDrivenSource {
    public readonly name = "mcp-driven-source";
    private listeners: (() => void)[] = [];
    private toolsCache: Record<string, Tool> = {};

    constructor() {
        // Assume MCP updates will be polled or events emitted
    }

    public triggerUpdate() {
        for (const listener of this.listeners) {
            listener();
        }
    }

    onUpdate(callback: () => void): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter((cb) => cb !== callback);
        };
    }

    async getMessages(): Promise<MessageWithTimestamp[]> {
        return [];
    }

    // @ts-ignore - AI SDK Tool schemas version mismatch
    async getTools(): Promise<Record<string, Tool>> {
        log.info("Fetching tools from MCP manager");
        try {
            this.toolsCache = await MCP.tools() as Record<string, Tool>;
            return this.toolsCache as any;
        } catch (e) {
            log.error("Failed to fetch tools", e);
            return {};
        }
    }

    async executeTool(toolName: string, args: any, toolCallId: string): Promise<ToolResult | undefined> {
        log.info("Executing MCP tool", toolName);
        if (!this.toolsCache[toolName]) {
            return undefined; // Not an MCP tool or not found
        }

        try {
            const result = await this.toolsCache[toolName].execute!(args, {
                toolCallId,
                messages: []
            });
            
            // ✅ 关键修复: 工具执行完成后，主动触发更新信号
            // 这样 AgentDriver 会进入下一个循环，看到工具执行结果
            log.info(`MCP tool ${toolName} executed successfully, triggering update signal`);
            this.triggerUpdate();
            
            return {
                toolCallId,
                toolName,
                result: typeof result === 'string' ? result : JSON.stringify(result)
            };
        } catch (e: any) {
            log.error(`Error executing MCP tool ${toolName}`, e);
            
            // ✅ 即使工具执行失败，也需要触发更新信号
            // 这样 AgentDriver 能看到错误结果并继续处理
            log.info(`MCP tool ${toolName} execution failed, triggering update signal with error`);
            this.triggerUpdate();
            
            return {
                toolCallId,
                toolName,
                result: `Error: ${e.message}`
            };
        }
    }
}
