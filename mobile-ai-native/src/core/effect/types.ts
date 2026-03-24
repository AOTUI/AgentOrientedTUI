export type EffectTrace = {
  update(summary: string): void;
};

export type EffectFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type EffectSuccess = {
  success: true;
};

export type EffectResult = EffectSuccess | EffectFailure | void;

export type EffectContext<State, Event> = {
  getState(): State;
  emit(event: Event): void;
  trace: EffectTrace;
};

export type EffectHandler<State, Event, Input> = (
  ctx: EffectContext<State, Event>,
  input: Input,
) => Promise<EffectResult> | EffectResult;

export type EffectMap<State, Event> = Record<
  string,
  EffectHandler<State, Event, any>
>;
