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
