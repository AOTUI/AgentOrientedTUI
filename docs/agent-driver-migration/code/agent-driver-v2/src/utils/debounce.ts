/**
 * @aotui/agent-driver-v2 - Debounce Utility
 * 
 * 信号防抖工具，避免短时间内多次触发 LLM 调用
 */

/**
 * 创建防抖函数
 * 
 * @param fn - 要防抖的函数
 * @param delayMs - 延迟时间 (ms)
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => void>(
    fn: T,
    delayMs: number
): T {
    let timeoutId: NodeJS.Timeout | null = null;

    return ((...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delayMs);
    }) as T;
}
