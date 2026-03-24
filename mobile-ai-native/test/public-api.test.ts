import { expect, it } from "vitest";
import type {
  EffectContext,
  EffectHandler,
  EffectMap,
  EffectResult,
} from "../src/index";

type TestState = {
  count: number;
};

type TestEvent = {
  type: "Incremented";
};

it("re-exports effect contract types from the public root entry", () => {
  const effect: EffectHandler<TestState, TestEvent, { amount: number }> = (
    ctx,
    input,
  ) => {
    ctx.trace.update(`count+${input.amount}`);
    ctx.emit({ type: "Incremented" });
    return undefined;
  };

  const effects: EffectMap<TestState, TestEvent> = {
    increment: effect,
  };

  const ctx: EffectContext<TestState, TestEvent> = {
    getState() {
      return { count: 1 };
    },
    emit() {},
    trace: {
      update() {},
    },
  };

  const result: EffectResult = undefined;

  expect(effects.increment).toBeTypeOf("function");
  expect(ctx.getState().count).toBe(1);
  expect(result).toBeUndefined();
});
