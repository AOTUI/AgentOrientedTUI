import type { Dispatch, StateUpdater } from "preact/hooks";
import { useEffect, useRef, useState } from "./preact-hooks.js";
import { useAppEnv } from "./useAppConfig.js";
import { useAppRuntimeContext } from "../context/AppRuntimeContext.js";
import { persistenceManager } from "./persistence-manager.js";

type PersistOptions<T> = {
  debounceMs?: number;
  storageKey?: string;
  serialize?: (value: T) => unknown;
  deserialize?: (value: unknown) => T;
};

type PersistMeta = {
  ready: boolean;
  clear: () => Promise<void>;
};

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function resolveStoragePath(
  baseDir: string | undefined,
  desktopId: string,
  appKey: string,
  key: string
): Promise<string> {
  const [{ join }, { homedir }] = await Promise.all([import("path"), import("os")]);
  const rootDir = baseDir && baseDir.length > 0
    ? join(baseDir, "app-state")
    : join(homedir(), ".aotui", "app-state");

  return join(
    rootDir,
    sanitizeSegment(desktopId),
    sanitizeSegment(appKey),
    `${sanitizeSegment(key)}.json`
  );
}

async function readJson(filePath: string): Promise<unknown | undefined> {
  try {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as { value?: unknown };
    if (parsed && typeof parsed === "object" && "value" in parsed) {
      return parsed.value;
    }
    return parsed;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return undefined;
    }
    return undefined;
  }
}

function unwrapLegacyValue(value: unknown): unknown {
  let current = value;
  let depth = 0;
  while (
    current &&
    typeof current === "object" &&
    "value" in (current as Record<string, unknown>) &&
    depth < 3
  ) {
    current = (current as Record<string, unknown>).value;
    depth += 1;
  }
  return current;
}

/** 导出writeJson供persistence-manager使用 */
export async function writeJson(filePath: string, value: unknown): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload = {
    version: 1,
    updatedAt: Date.now(),
    value,
  };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

async function removeJson(filePath: string): Promise<void> {
  try {
    const fs = await import("fs/promises");
    await fs.unlink(filePath);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T,
  options: PersistOptions<T> = {}
): [T, Dispatch<StateUpdater<T>>, PersistMeta] {
  const { appId, desktopId } = useAppRuntimeContext();
  const dataDir = useAppEnv<string>("AOTUI_DATA_DIR");
  const appKeyFromEnv = useAppEnv<string>("AOTUI_APP_KEY") || useAppEnv<string>("AOTUI_APP_NAME");
  const appKey = options.storageKey || appKeyFromEnv || String(appId);

  const [state, setState] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const filePathRef = useRef<string | null>(null);
  const stateRef = useRef<T>(state);
  const serializeRef = useRef<PersistOptions<T>["serialize"]>(options.serialize);
  const deserializeRef = useRef<PersistOptions<T>["deserialize"]>(options.deserialize);

  // Keep stateRef updated
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    serializeRef.current = options.serialize;
    deserializeRef.current = options.deserialize;
  }, [options.serialize, options.deserialize]);

  // Load initial state from disk
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const filePath = await resolveStoragePath(dataDir, String(desktopId), appKey, key);
      filePathRef.current = filePath;
      const rawValue = await readJson(filePath);
      if (cancelled) {
        return;
      }
      if (rawValue !== undefined) {
        const normalizedRaw = unwrapLegacyValue(rawValue);
        const value = deserializeRef.current ? deserializeRef.current(normalizedRaw) : (normalizedRaw as T);
        setState(value);
      }
      setReady(true);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [dataDir, desktopId, appKey, key]);

  // Register with PersistenceManager for shutdown-only persistence
  useEffect(() => {
    if (!ready) {
      return;
    }
    const filePath = filePathRef.current;
    if (!filePath) {
      return;
    }

    const registryKey = `${desktopId}:${appKey}:${key}`;

    persistenceManager.register(registryKey, {
      filePath,
      getState: () => {
        const currentState = stateRef.current;
        return serializeRef.current ? serializeRef.current(currentState) : currentState;
      },
    });

    return () => {
      persistenceManager.unregister(registryKey);
    };
  }, [ready, desktopId, appKey, key]);

  const clear = async () => {
    const filePath = filePathRef.current;
    if (!filePath) {
      return;
    }
    await removeJson(filePath);
  };

  return [state, setState, { ready, clear }];
}
