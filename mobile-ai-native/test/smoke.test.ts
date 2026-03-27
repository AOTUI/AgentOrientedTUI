import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { VERSION } from "../src/index";
import { VERSION as SOURCE_VERSION } from "../src/version";

describe("mobile-ai-native package", () => {
  it("exports a public entry point", () => {
    expect(SOURCE_VERSION).toBe(packageJson.version);
    expect(VERSION).toBe(packageJson.version);
  });
});
