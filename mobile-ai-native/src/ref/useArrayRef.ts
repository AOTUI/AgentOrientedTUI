import { useRefRegistry } from "./RefContext";

export function useArrayRef(type: string, data: object[], refId: string) {
  const registry = useRefRegistry();

  const listRef = (content: string): string => {
    registry.register(refId, {
      type: `${type}[]`,
      value: data,
    });

    return `(${content})[${type}[]:${refId}]`;
  };

  const itemRef = (index: number, content: string): string => {
    registry.register(`${refId}[${index}]`, {
      type,
      value: data[index],
    });

    return `(${content})[${type}:${refId}[${index}]]`;
  };

  return [listRef, itemRef] as const;
}
