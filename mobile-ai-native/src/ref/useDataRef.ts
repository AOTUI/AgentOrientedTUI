import { useRefRegistry } from "./RefContext";

export function useDataRef(type: string, data: object, refId: string) {
  const registry = useRefRegistry();

  return (content: string): string => {
    registry.register(refId, { type, value: data });
    return `(${content})[${type}:${refId}]`;
  };
}
