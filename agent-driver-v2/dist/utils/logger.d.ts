/**
 * @aotui/agent-driver-v2 - Logger Utility
 *
 * 简单的日志工具
 */
export declare class Logger {
    private prefix;
    constructor(prefix: string);
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
}
