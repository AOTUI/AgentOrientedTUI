/**
 * @aotui/agent-driver-v2 - Logger Utility
 *
 * 简单的日志工具
 */
export class Logger {
    prefix;
    constructor(prefix) {
        this.prefix = prefix;
    }
    info(message, ...args) {
        console.log(`[${this.prefix}] ${message}`, ...args);
    }
    warn(message, ...args) {
        console.warn(`[${this.prefix}] ${message}`, ...args);
    }
    error(message, ...args) {
        console.error(`[${this.prefix}] ${message}`, ...args);
    }
    debug(message, ...args) {
        if (process.env.DEBUG) {
            console.debug(`[${this.prefix}] ${message}`, ...args);
        }
    }
}
