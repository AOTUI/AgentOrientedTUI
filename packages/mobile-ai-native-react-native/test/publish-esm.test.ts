import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const coreRoot = path.resolve(repoRoot, "mobile-ai-native");
const distEntry = path.join(packageRoot, "dist/index.js");

function run(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });
}

describe("published ESM smoke", () => {
  it("adapter build output can be imported by Node ESM", () => {
    const coreBuild = run("pnpm", ["build"], coreRoot);
    expect(coreBuild.status, coreBuild.stderr || coreBuild.stdout).toBe(0);

    const adapterBuild = run("pnpm", ["build"], packageRoot);
    expect(adapterBuild.status, adapterBuild.stderr || adapterBuild.stdout).toBe(0);

    const importCheck = run(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import(${JSON.stringify(pathToFileURL(distEntry).href)}).then((mod) => {
          console.log(typeof mod.createReactNativeAppRuntime);
        });`,
      ],
      packageRoot,
    );

    expect(importCheck.status, importCheck.stderr || importCheck.stdout).toBe(0);
  });
});
