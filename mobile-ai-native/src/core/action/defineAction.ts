import type { ZodType } from "zod";
import type { ActionResult, Store } from "../types";

export type ActionContext<State, Event> = {
  getState(): State;
  emit(event: Event): void;
  runEffect(name: string, input: unknown): Promise<void>;
  trace: {
    start(summary: string): void;
    update(summary: string): void;
    success(summary?: string): void;
    fail(summary: string): void;
  };
};

export type ActionDefinition<State, Event, Input> = {
  name: string;
  description: string;
  schema: ZodType<Input>;
  visibility(state: State): boolean;
  handler(
    ctx: ActionContext<State, Event>,
    input: Input,
  ): Promise<ActionResult> | ActionResult;
};

export function defineAction<State, Event, Input>(
  config: ActionDefinition<State, Event, Input>,
) {
  return config;
}
