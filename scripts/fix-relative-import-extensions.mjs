import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const targetDir = process.argv[2];

if (!targetDir) {
  throw new Error("Expected a dist directory path argument.");
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const nextPath = path.join(dir, entry);
    const stats = statSync(nextPath);

    if (stats.isDirectory()) {
      return walk(nextPath);
    }

    return [nextPath];
  });
}

function needsJsExtension(specifier) {
  return (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    path.extname(specifier) === ""
  );
}

function rewriteRelativeImports(source) {
  return source
    .replace(
      /((?:from)\s*["'])(\.{1,2}\/[^"'?#]+)(["'])/g,
      (match, prefix, specifier, suffix) => {
        if (!needsJsExtension(specifier)) {
          return match;
        }

        return `${prefix}${specifier}.js${suffix}`;
      },
    )
    .replace(
      /((?:import)\s*["'])(\.{1,2}\/[^"'?#]+)(["'])/g,
      (match, prefix, specifier, suffix) => {
        if (!needsJsExtension(specifier)) {
          return match;
        }

        return `${prefix}${specifier}.js${suffix}`;
      },
    );
}

for (const filePath of walk(path.resolve(targetDir))) {
  if (!filePath.endsWith(".js") && !filePath.endsWith(".d.ts")) {
    continue;
  }

  const source = readFileSync(filePath, "utf8");
  const rewritten = rewriteRelativeImports(source);

  if (rewritten !== source) {
    writeFileSync(filePath, rewritten, "utf8");
  }
}
