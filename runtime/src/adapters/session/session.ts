/**
 * AgentSession Implementation
 * 
 * Agent 会话状态管理的默认实现
 */
import type { IAgentSession, IAgentSessionManager } from './types.js';

/**
 * AgentSession 默认实现
 * 
 * 状态转换:
 * 
 * ```
 * [Idle, NoUpdate] --UpdateSignal--> tryStartProcessing() --> [Processing, NoUpdate]
 *        ^                                                            |
 *        |                                                            v
 *        +------ finishProcessing() <------ [Processing, NoUpdate]----+
 *                     |
 *                     |  如果有更新
 *                     v
 *        +------ finishProcessing() returns true --> 重新触发处理
 * 
 * [Processing] --UpdateSignal--> markUpdate() --> [Processing, HasUpdate]
 * ```
 */
export class AgentSession implements IAgentSession {
    private _isIdle: boolean = true;
    private _hasUpdate: boolean = false;

    constructor(public readonly id: string) { }

    get isIdle(): boolean {
        return this._isIdle;
    }

    get hasUpdate(): boolean {
        return this._hasUpdate;
    }

    tryStartProcessing(): boolean {
        if (!this._isIdle) {
            // Agent 正在处理中,无法获取处理权
            return false;
        }
        this._isIdle = false;
        this._hasUpdate = false;  // 开始处理时清除更新标记
        return true;
    }

    finishProcessing(): boolean {
        this._isIdle = true;
        const hadUpdate = this._hasUpdate;
        this._hasUpdate = false;  // 消费更新标记
        return hadUpdate;
    }

    markUpdate(): void {
        this._hasUpdate = true;
    }
}

/**
 * AgentSession 管理器
 * 
 * 管理多个 AgentSession 实例 (按 sessionId 区分)
 */
export class AgentSessionManager implements IAgentSessionManager {
    private sessions: Map<string, AgentSession> = new Map();

    getSession(sessionId: string): IAgentSession {
        let session = this.sessions.get(sessionId);
        if (!session) {
            session = new AgentSession(sessionId);
            this.sessions.set(sessionId, session);
            console.log(`[AgentSessionManager] Created session: ${sessionId}`);
        }
        return session;
    }

    destroySession(sessionId: string): void {
        if (this.sessions.delete(sessionId)) {
            console.log(`[AgentSessionManager] Destroyed session: ${sessionId}`);
        }
    }

    getAllSessions(): IAgentSession[] {
        return Array.from(this.sessions.values());
    }
}
