import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const distEntry = path.join(packageRoot, "dist/index.js");

function run(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });
}

describe("published ESM smoke", () => {
  it("build output can be imported by Node ESM", () => {
    const build = run("pnpm", ["build"], packageRoot);
    expect(build.status, build.stderr || build.stdout).toBe(0);

    const importCheck = run(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import(${JSON.stringify(pathToFileURL(distEntry).href)}).then((mod) => {
          console.log(
            typeof mod.createActionRuntime,
            typeof mod.createToolBridge,
            typeof mod.createSnapshotAssembler,
          );
        });`,
      ],
      packageRoot,
    );

    expect(importCheck.status, importCheck.stderr || importCheck.stdout).toBe(0);
  });
});
