import type { ActionDefinition, ActionContext } from "./defineAction";
import type { ActionResult, Store, ToolDefinition } from "../types";

export function createActionRuntime<State, Event>(config: {
  store: Store<State, Event>;
  actions: Array<ActionDefinition<State, Event, any>>;
  effects?: Record<
    string,
    (ctx: { getState(): State; emit(event: Event): void }, input: any) => Promise<void> | void
  >;
}) {
  const actionsByName = new Map(
    config.actions.map((action) => [action.name, action]),
  );

  const trace = {
    start(_summary: string) {},
    update(_summary: string) {},
    success(_summary?: string) {},
    fail(_summary: string) {},
  };

  async function executeAction(
    name: string,
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const action = actionsByName.get(name);
    if (!action) {
      return {
        success: false,
        error: {
          code: "ACTION_NOT_FOUND",
          message: `Action ${name} was not found`,
        },
      };
    }

    if (!action.visibility(config.store.getState())) {
      return {
        success: false,
        error: {
          code: "ACTION_NOT_VISIBLE",
          message: `Action ${name} is not currently visible`,
        },
      };
    }

    const parsed = action.schema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "ACTION_INVALID_INPUT",
          message: parsed.error.message,
        },
      };
    }

    const ctx: ActionContext<State, Event> = {
      getState: () => config.store.getState(),
      emit: (event) => config.store.emit(event),
      runEffect: async (name, input) => {
        const effect = config.effects?.[name];
        if (!effect) {
          return;
        }

        await effect(
          {
            getState: () => config.store.getState(),
            emit: (event) => config.store.emit(event),
          },
          input,
        );
      },
      trace,
    };

    return await action.handler(ctx, parsed.data);
  }

  function listVisibleTools(): ToolDefinition[] {
    const state = config.store.getState();

    return config.actions
      .filter((action) => action.visibility(state))
      .map((action) => ({
        name: action.name,
        description: action.description,
        inputSchema: action.schema,
        meta: action.meta ?? {},
      }));
  }

  return {
    executeAction,
    listVisibleTools,
  };
}
