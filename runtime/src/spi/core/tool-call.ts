/**
 * LLM Tool Call Types
 * 
 * OpenAI 兼容的 Tool Call 格式定义
 * 
 * 注意：这些类型从 adapters/llm/types.ts 移动到 SPI 层，
 * 因为 IAgentSession 需要使用它们。
 */

/** LLM Tool 定义 (OpenAI Function Calling 格式) */
export interface Tool {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, {
                type: string;
                description?: string;
                enum?: string[];
            }>;
            required: string[];
        };
    };
}

/** LLM Tool Call 请求 (OpenAI 兼容格式) */
export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;  // JSON 字符串
    };
}

/** Tool Call 执行结果 */
export interface ToolCallResult {
    tool_call_id: string;
    success: boolean;
    data?: unknown;
    error?: {
        code: string;
        message: string;
    };
}

/** Operation 参数定义 (从 IndexMap 提取) */
export interface OperationParamDef {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    refType?: string;
}

/** Operation 定义 (从 IndexMap 提取) */
export interface OperationDef {
    id: string;
    appId: string;
    viewId: string;
    description?: string;
    params: OperationParamDef[];
}
