import type { ZodType } from "zod";
import type { EffectResult } from "../effect/types";
import type { ActionResult, ToolMetadata } from "../types";

export type ActionContext<State, Event> = {
  getState(): State;
  emit(event: Event): void;
  runEffect(name: string, input: unknown): Promise<EffectResult>;
  trace: {
    update(summary: string): void;
  };
};

export type ActionDefinition<State, Event, Input> = {
  name: string;
  description: string;
  schema: ZodType<Input>;
  meta?: ToolMetadata;
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
