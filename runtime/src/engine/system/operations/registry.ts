/**
 * System Operation Registry
 * 
 * 管理所有系统级操作的注册和执行。
 * 系统操作在编译时固定注册，不支持运行时动态注册。
 * 
 * @module @aotui/runtime/engine/operations
 */

import type {
    ISystemOperation,
    ISystemOperationRegistry,
    SystemOperationContext,
    OperationResult,
    IDesktopForOperation
} from '../../../spi/index.js';
import type { Tool } from '../../../spi/core/tool-call.js';
import { AOTUIError, failedResult } from '../../../spi/core/errors.js';

/**
 * SystemOperationRegistry
 * 
 * 实现系统操作的注册和分发，替代 Kernel 中的 switch 语句。
 * 
 * @example
 * ```typescript
 * const registry = new SystemOperationRegistry();
 * registry.register(new OpenAppOperation());
 * registry.register(new MountViewOperation());
 * 
 * // 执行操作
 * const result = await registry.execute('open', ctx, desktop);
 * ```
 */
export class SystemOperationRegistry implements ISystemOperationRegistry {
    private operations = new Map<string, ISystemOperation>();

    /**
     * 注册系统操作
     * 
     * @param operation - 要注册的操作
     * @throws 如果操作名称已存在则抛出错误
     */
    register(operation: ISystemOperation): void {
        // 注册主名称
        if (this.operations.has(operation.name)) {
            throw new AOTUIError('OPERATION_DUPLICATE', { operationName: operation.name });
        }
        this.operations.set(operation.name, operation);

        // 注册别名
        if (operation.aliases) {
            for (const alias of operation.aliases) {
                if (this.operations.has(alias)) {
                    throw new AOTUIError('OPERATION_DUPLICATE', { operationName: alias, reason: 'alias conflict' });
                }
                this.operations.set(alias, operation);
            }
        }
    }

    /**
     * 检查操作是否存在
     */
    has(name: string): boolean {
        return this.operations.has(name);
    }

    /**
     * 获取操作
     */
    get(name: string): ISystemOperation | undefined {
        return this.operations.get(name);
    }

    /**
     * 执行系统操作
     * 
     * @param name - 操作名称或别名
     * @param ctx - 系统操作上下文
     * @param desktop - 目标 Desktop
     * @returns 操作结果
     */
    async execute(
        name: string,
        ctx: SystemOperationContext,
        desktop: IDesktopForOperation
    ): Promise<OperationResult> {
        const operation = this.operations.get(name);

        if (!operation) {
            return failedResult('OPERATION_NOT_FOUND', { operationName: name });
        }

        try {
            return await operation.execute(ctx, desktop);
        } catch (error: unknown) {
            const aotuiError = AOTUIError.is(error) ? error : AOTUIError.fromError(error, 'EXECUTION_FAILED');
            return {
                success: false,
                error: aotuiError.toOperationError()
            };
        }
    }

    /**
     * 获取所有已注册的操作名称（用于调试）
     */
    getRegisteredNames(): string[] {
        return Array.from(this.operations.keys());
    }

    /**
     * 获取所有系统操作的 Tool Definitions (RFC-009)
     * 
     * 返回去重后的 Tool 列表（不包含别名重复）
     */
    getToolDefinitions(): Tool[] {
        const uniqueOps = new Set<ISystemOperation>(this.operations.values());
        return Array.from(uniqueOps).map(op => op.toolDefinition);
    }
}
