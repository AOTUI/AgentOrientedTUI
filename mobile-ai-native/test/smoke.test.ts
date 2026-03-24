import { describe, expect, it } from "vitest";
import { VERSION } from "../src/index";

describe("mobile-ai-native package", () => {
  it("exports a public entry point", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
