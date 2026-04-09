export type HostAppState = "active" | "background";
export type HostScreenState = "focused" | "blurred";

export type HostLifecycleState = {
  readonly appState: HostAppState;
  readonly screenState: HostScreenState;
};

export type HostLifecycleListener = () => void;

export type HostLifecycleBridge = {
  getState(): HostLifecycleState;
  subscribe(listener: HostLifecycleListener): () => void;
  setAppActive(): void;
  setAppBackground(): void;
  focusScreen(): void;
  blurScreen(): void;
};

const DEFAULT_STATE: HostLifecycleState = {
  appState: "active",
  screenState: "focused",
};

export function createHostLifecycleBridge(
  initialState: Partial<HostLifecycleState> = {},
): HostLifecycleBridge {
  let currentState: HostLifecycleState = {
    appState: initialState.appState ?? DEFAULT_STATE.appState,
    screenState: initialState.screenState ?? DEFAULT_STATE.screenState,
  };
  const listeners = new Set<HostLifecycleListener>();

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const updateState = (nextState: HostLifecycleState) => {
    if (
      nextState.appState === currentState.appState &&
      nextState.screenState === currentState.screenState
    ) {
      return;
    }

    currentState = nextState;
    emit();
  };

  return {
    getState() {
      return currentState;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setAppActive() {
      updateState({
        ...currentState,
        appState: "active",
      });
    },
    setAppBackground() {
      updateState({
        ...currentState,
        appState: "background",
      });
    },
    focusScreen() {
      updateState({
        ...currentState,
        screenState: "focused",
      });
    },
    blurScreen() {
      updateState({
        ...currentState,
        screenState: "blurred",
      });
    },
  };
}
