/**
 * @aotui/agent-driver-v2 - Logger Utility
 * 
 * 简单的日志工具
 */

export class Logger {
    constructor(private prefix: string) { }

    info(message: string, ...args: unknown[]): void {
        console.log(`[${this.prefix}] ${message}`, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        console.warn(`[${this.prefix}] ${message}`, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        console.error(`[${this.prefix}] ${message}`, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        if (process.env.DEBUG) {
            console.debug(`[${this.prefix}] ${message}`, ...args);
        }
    }
}
