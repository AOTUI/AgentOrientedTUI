/** @jsxImportSource preact */
import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { RefIndexEntry } from "../core/types";

type RefRegistry = {
  register(refId: string, entry: RefIndexEntry): void;
};

const RefContext = createContext<RefRegistry | null>(null);

export function RefProvider(props: {
  registry: RefRegistry;
  children: ComponentChildren;
}) {
  return (
    <RefContext.Provider value={props.registry}>
      {props.children}
    </RefContext.Provider>
  );
}

export function useRefRegistry(): RefRegistry {
  const registry = useContext(RefContext);

  if (!registry) {
    throw new Error("useRefRegistry must be used within RefProvider");
  }

  return registry;
}
