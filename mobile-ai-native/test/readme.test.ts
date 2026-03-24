import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("documents snapshot-scoped tool execution", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  expect(readme).toContain("snapshotId");
  expect(readme).toContain("useDataRef");
  expect(readme).toContain("useArrayRef");
});
