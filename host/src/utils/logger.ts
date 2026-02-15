/**
 * 简单的 Logger 工具
 */

export class Logger {
    constructor(private context: string) { }

    info(message: string, meta?: any): void {
        console.log(`[${this.context}] ${message}`, meta || '');
    }

    warn(message: string, meta?: any): void {
        console.warn(`[${this.context}] ${message}`, meta || '');
    }

    error(message: string, meta?: any): void {
        console.error(`[${this.context}] ${message}`, meta || '');
    }

    debug(message: string, meta?: any): void {
        // Simple debug, could check env var later
        // console.debug(`[${this.context}] ${message}`, meta || '');
    }
}
