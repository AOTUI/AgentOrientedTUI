import type { ActionDefinition, ActionContext } from "./defineAction";
import type { ActionResult, Store, ToolDefinition } from "../types";

export function createActionRuntime<State, Event>(config: {
  store: Store<State, Event>;
  actions: Array<ActionDefinition<State, Event, any>>;
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
      runEffect: async () => {},
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
      }));
  }

  return {
    executeAction,
    listVisibleTools,
  };
}
