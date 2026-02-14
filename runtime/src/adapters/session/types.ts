/**
 * AgentSession Types
 * 
 * Agent 会话状态管理接口
 */

/**
 * Agent 会话状态接口
 * 
 * 简化的状态模型:
 * - isIdle: Agent 是否空闲
 * - hasUpdate: TUI Desktop 是否有更新
 */
export interface IAgentSession {
    /** 会话 ID (通常对应 Topic ID / Desktop ID) */
    readonly id: string;

    /** Agent 是否空闲 (未在处理中) */
    readonly isIdle: boolean;

    /** TUI Desktop 是否有待处理的更新 */
    readonly hasUpdate: boolean;

    /**
     * 尝试开始处理
     * @returns 是否成功获取处理权 (如果已在处理中则返回 false)
     */
    tryStartProcessing(): boolean;

    /**
     * 标记处理完成,并返回是否有待处理的更新
     * @returns 如果有待处理更新返回 true,调用者应该重新拉取 snapshot
     */
    finishProcessing(): boolean;

    /**
     * 标记 TUI Desktop 有更新
     * 当收到 UpdateSignal 但 Agent 正在处理时调用
     */
    markUpdate(): void;
}

/**
 * AgentSession 管理器接口
 */
export interface IAgentSessionManager {
    /**
     * 获取或创建指定 ID 的会话
     */
    getSession(sessionId: string): IAgentSession;

    /**
     * 销毁指定会话
     */
    destroySession(sessionId: string): void;

    /**
     * 获取所有会话
     */
    getAllSessions(): IAgentSession[];
}
