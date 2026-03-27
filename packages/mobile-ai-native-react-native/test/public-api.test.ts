import { expect, it } from "vitest";
import * as publicApi from "../src/index";

it("exports the React Native adapter public API", () => {
  expect(publicApi.createReactNativeAppRuntime).toBeTypeOf("function");
  expect(publicApi.AppRuntimeProvider).toBeTypeOf("function");
  expect(publicApi.useRuntimeState).toBeTypeOf("function");
  expect(publicApi.useRuntimeActions).toBeTypeOf("function");
  expect(publicApi.useRuntimeTrace).toBeTypeOf("function");
  expect(publicApi.useRuntimeSnapshot).toBeTypeOf("function");
});

it("fails loudly when a placeholder runtime API is invoked", () => {
  expect(() => publicApi.createReactNativeAppRuntime()).toThrowError(
    /not implemented yet/i,
  );
  expect(() => publicApi.AppRuntimeProvider()).toThrowError(
    /not implemented yet/i,
  );
  expect(() => publicApi.useRuntimeState()).toThrowError(
    /not implemented yet/i,
  );
  expect(() => publicApi.useRuntimeActions()).toThrowError(
    /not implemented yet/i,
  );
  expect(() => publicApi.useRuntimeTrace()).toThrowError(/not implemented yet/i);
  expect(() => publicApi.useRuntimeSnapshot()).toThrowError(
    /not implemented yet/i,
  );
});
