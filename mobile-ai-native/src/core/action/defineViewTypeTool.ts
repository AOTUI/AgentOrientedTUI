import type { ActionDefinition } from "./defineAction";

export type ViewTypeToolActionDefinition<State, Event, Input> =
  ActionDefinition<State, Event, Input> & {
    readonly viewType: string;
  };

export function defineViewTypeTool<State, Event, Input>(
  tool: ViewTypeToolActionDefinition<State, Event, Input>,
) {
  return tool;
}
