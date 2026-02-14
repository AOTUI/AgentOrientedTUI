/**
 * AOTUI SDK - useDataRef Hook
 *
 * 创建一个指向单个数据对象的引用。
 *
 * @module @aotui/sdk/hooks/useRef
 *
 * @example
 * ```tsx
 * function TopicDetailView({ topic }) {
 *   const topicRef = useDataRef('current_topic', topic);
 *
 *   return (
 *     <View name="TopicDetail">
 *       <p>{topicRef(`话题: ${topic.name}`)}</p>
 *       {/* Agent 看到: [话题: General](current_topic) *\/}
 *     </View>
 *   );
 * }
 * ```
 */
import { useEffect, useRef as usePreactRef } from "./preact-hooks.js";
// [P1 ISP] Use specialized hook instead of useInternalViewContext
import { useRefRegistry } from "./useViewContext.js";

/**
 * RefHandle - 单资源引用句柄
 *
 * 作为渲染函数使用: `ref(content)` 返回格式化后的 TUI 标记字符串。
 */
export interface RefHandle<T> {
  /** 格式化为 TUI 标记: [content](refId) */
  (content: string): string;
  /** 当前绑定的数据 */
  data: T;
  /** 引用 ID */
  id: string;
}

/**
 * 创建一个指向单个数据对象的引用。
 *
 * @param refId - 引用 ID (在当前 View 内唯一)
 * @param data - 绑定的数据对象
 * @returns RefHandle - 可作为渲染函数调用的引用句柄
 */
export function useDataRef<T extends object>(refId: string, data: T): RefHandle<T> {
  // [P1 ISP] Use specialized hook
  const { registerRef, unregisterRef } = useRefRegistry();

  // 使用 Preact ref 存储 registry 引用，避免每次渲染重新注册
  const registeredRef = usePreactRef(false);

  // 注册到 RefRegistry
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[useDataRef] Mounting ref: ${refId}`, data);
    }
    registerRef(refId, data);
    registeredRef.current = true;

    return () => {
      if (registeredRef.current) {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[useDataRef] Unmounting ref: ${refId}`);
        }
        unregisterRef(refId);
        registeredRef.current = false;
      }
    };
  }, [refId, data, registerRef, unregisterRef]);

  // 创建渲染函数
  const format = (content: string): string => {
    return `[${content}](${refId})`;
  };

  // 附加属性
  (format as RefHandle<T>).data = data;
  (format as RefHandle<T>).id = refId;

  return format as RefHandle<T>;
}

/**
 * @deprecated Use `useDataRef` instead.
 */
export const useRef = useDataRef;
