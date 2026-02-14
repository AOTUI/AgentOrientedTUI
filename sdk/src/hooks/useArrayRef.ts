/**
 * AOTUI SDK - useArrayRef Hook
 *
 * 创建一个指向数据数组的引用。
 *
 * @module @aotui/sdk/hooks/useArrayRef
 *
 * @example
 * ```tsx
 * function ChatView({ messages }) {
 *   const [listRef, itemRef] = useArrayRef('messages', messages, { itemType: 'Message' });
 *
 *   return (
 *     <View name="Chat">
 *       <h2>{listRef('消息历史')}</h2>
 *       {/* Agent 看到: ## [消息历史](Message[]:messages) *\/\}
 *
 *       <ul>
 *         {messages.map((msg, idx) => (
 *           <li key={msg.id}>
 *             {itemRef(idx, `${msg.role}: ${msg.content}`)}
 *             {/* Agent 看到: 1. [[human]: Hello](Message:messages[0]) *\/\}
 *           </li>
 *         ))}
 *       </ul>
 *     </View>
 *   );
 * }
 * ```
 */
import { useEffect, useMemo, useLayoutEffect, useRef as usePreactRef } from 'preact/hooks';
// [P1 ISP] Use specialized hook instead of useInternalViewContext
import { useRefRegistry } from "./useViewContext.js";

/**
 * ListRefFormatter - 列表标题格式化函数
 */
export type ListRefFormatter = (content: string) => string;

/**
 * ItemRefFormatter - 列表项格式化函数
 *
 * @param index - 列表项索引
 * @param content - 显示内容
 * @returns 格式化后的 TUI 标记字符串
 */
export type ItemRefFormatter = (index: number, content: string) => string;

/**
 * ArrayRefHandle - 列表引用句柄元组
 *
 * [0]: listRef - 格式化列表标题
 * [1]: itemRef - 格式化列表项
 */
export type ArrayRefHandle<T> = [ListRefFormatter, ItemRefFormatter];

export interface UseArrayRefOptions {
  /**
   * 列表项类型名称 (如 "Message")
   *
   * 如果提供，生成的 Ref 链接和 Registry Key 将包含类型信息：
   * - List: `(Type[]:id)`
   * - Item: `(Type:id[index])`
   */
  itemType?: string;
}

/**
 * 创建一个指向数据数组的引用。
 *
 * @param refId - 列表引用 ID (在当前 View 内唯一)
 * @param data - 数据数组
 * @param options - 配置选项
 * @returns [listRef, itemRef] - 列表标题和列表项的格式化函数
 */
export function useArrayRef<T extends object>(
  refId: string,
  data: T[],
  options?: UseArrayRefOptions,
): ArrayRefHandle<T> {
  // [P1 ISP] Use specialized hook
  const { registerRef, unregisterRef } = useRefRegistry();
  const itemType = options?.itemType;

  // 使用 Preact ref 跟踪已注册的项
  const registeredItemsRef = usePreactRef<Set<string>>(new Set());

  // 注册所有列表项到 RefRegistry
  // Use useLayoutEffect to ensure refs are registered synchronously after DOM updates
  // but BEFORE the browser paint and BEFORE the next Snapshot is taken by the Worker.
  // This prevents "Ghost References" where Markup exists but IndexMap entries are missing.
  useLayoutEffect(() => {
    const newIds = new Set<string>();

    // 注册每个元素
    data.forEach((item, idx) => {
      // 只用 refId 注册，不带类型前缀
      // Runtime 会用 appId:viewId 作为 namespace
      const itemRefId = `${refId}[${idx}]`;

      if (process.env.NODE_ENV !== "production") {
        console.log(`[useArrayRef] Registering item: ${itemRefId}`);
      }
      registerRef(itemRefId, item);
      newIds.add(itemRefId);
    });

    // 清理旧的、不再存在的项
    for (const oldId of registeredItemsRef.current) {
      if (!newIds.has(oldId)) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[useArrayRef] Unregistering stale item: ${oldId}`);
        }
        unregisterRef(oldId);
      }
    }

    registeredItemsRef.current = newIds;

    return () => {
      // Cleanup all on unmount
      if (process.env.NODE_ENV !== "production") {

        console.log(
          `[useArrayRef] Unmounting list: ${refId}, cleaning up ${registeredItemsRef.current.size} items`,
        );
      }
      for (const id of registeredItemsRef.current) {
        unregisterRef(id);
      }
      registeredItemsRef.current = new Set();
    };
  }, [refId, data, registerRef, unregisterRef]);

  // 列表标题格式化函数
  const listRef: ListRefFormatter = (content: string): string => {
    const prefix = itemType ? `${itemType}[]:` : "";
    return `[${content}](${prefix}${refId})`;
  };

  // 列表项格式化函数
  const itemRef: ItemRefFormatter = (
    index: number,
    content: string,
  ): string => {
    const prefix = itemType ? `${itemType}:` : "";
    return `[${content}](${prefix}${refId}[${index}])`;
  };

  return [listRef, itemRef];
}
