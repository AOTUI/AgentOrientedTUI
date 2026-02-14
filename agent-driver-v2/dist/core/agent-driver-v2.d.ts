/**
 * @aotui/agent-driver-v2 - AgentDriver V2 Core
 *
 * 多源消息聚合器，负责：
 * 1. 聚合来自多个 DrivenSource 的消息和工具
 * 2. 按时间戳排序消息
 * 3. 路由 ToolCall 到对应的 DrivenSource
 * 4. 管理工作循环
 *
 * 设计原则：
 * - **依赖反转**: 依赖 IDrivenSource 接口，不依赖具体实现
 * - **职责清晰**: AgentDriver 只负责聚合和路由，不负责业务逻辑
 * - **可扩展**: 易于添加新的 DrivenSource
 */
import type { IDrivenSource, AgentDriverV2Config, AgentState } from './interfaces.js';
/**
 * AgentDriverV2 - 核心类
 */
export declare class AgentDriverV2 {
    private static nextId;
    private readonly driverId;
    private sources;
    private unsubscribers;
    private updateDebounced;
    private logger;
    private config;
    private llmClient;
    private state;
    private pending;
    private runInFlight;
    private lastInputSignature;
    private toolFailureStreak;
    private toolToSourceMap;
    private running;
    constructor(config: AgentDriverV2Config);
    /**
     * 获取 Driver 实例 ID (用于排查多实例并发)
     */
    getId(): number;
    /**
     * 获取当前状态 (用于测试)
     */
    getState(): AgentState;
    /**
     * 是否有待处理的更新 (用于测试)
     */
    hasPendingUpdate(): boolean;
    /**
     * 获取 Tool 对应的 Source (用于测试)
     */
    getToolSource(toolName: string): IDrivenSource | undefined;
    /**
     * 设置更新监听器
     *
     * 订阅所有 DrivenSource 的更新事件
     */
    private setupUpdateListeners;
    /**
     * 收集所有消息
     *
     * ✅ 简化: 直接聚合，按时间戳排序
     * - 每个 source 已经保证消息去重
     * - AgentDriver 只需拼接并排序
     */
    private collectMessages;
    /**
     * 收集所有工具
     */
    private collectTools;
    /**
     * 执行工具调用
     *
     * ✅ 优化: 使用 Tool → Source 映射，避免遍历
     */
    private executeToolCalls;
    /**
     * 更新 Tool → Source 映射
     */
    private updateToolMapping;
    /**
     * 设置状态
     */
    private setState;
    /**
     * 处理更新信号
     *
     * ✅ 修复后：非阻塞模式，只负责设置标志位和唤醒
     *
     * 核心改进：
     * - 不再阻塞等待 idle 状态
     * - 只设置 pendingUpdate 标志位
     * - 尝试唤醒主循环（即使丢失信号也无妨，Loop 会检查标志位）
     */
    private handleUpdate;
    /**
     * 请求调度一次 run
     *
     * 语义：多次更新信号合并为一次 run
     */
    private requestRun;
    /**
     * 单飞行 drain：保证 run 非重入，且合并连续更新
     */
    private drainPendingRuns;
    /**
     * 生成输入签名，用于跳过重复输入的 LLM 调用
     */
    private buildInputSignature;
    /**
     * 简单字符串哈希（32-bit），避免完整内容参与签名
     */
    private hashString;
    /**
     * 运行主循环 (一次 run)
     *
     * 完整的 LLM ReAct 循环：
     * 1. 收集 Messages 和 Tools
     * 2. 调用 LLM
     * 3. 如果有 ToolCalls:
     *    - 执行 ToolCalls
     *    - 等待 Source 发送新信号 (Tool 执行完成后)
     * 4. 回到 idle 状态
     */
    private run;
    /**
     * 创建 Tool Message
     *
     * 将 ToolResult[] 转换为 Vercel AI SDK 的 CoreToolMessage
     *
     * @param results - ToolResult 数组
     * @returns Tool Message
     */
    private createToolMessage;
    /**
     * 启动 AgentDriver
     */
    start(): void;
    /**
     * 停止 AgentDriver
     */
    stop(): void;
    /**
     * 手动触发工作循环
     *
     * 用于测试或手动触发
     */
    trigger(): Promise<void>;
    /**
     * 清理资源
     */
    dispose(): void;
}
