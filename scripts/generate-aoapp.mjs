import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf-8'));
}

async function loadBuiltModule(appDir) {
  const entryPath = path.join(appDir, 'dist', 'index.js');
  return import(`${pathToFileURL(entryPath).href}?t=${Date.now()}`);
}

function resolveFactory(moduleNamespace) {
  return moduleNamespace.default ?? moduleNamespace.factory ?? moduleNamespace;
}

function resolveCanonicalAppName(factory) {
  const appName =
    factory?.kernelConfig?.appName ??
    factory?.manifest?.app_name ??
    factory?.manifest?.name;

  if (!isNonEmptyString(appName)) {
    throw new Error('Unable to resolve app_name from built app metadata');
  }

  return appName;
}

export async function buildAoappManifest(appDir) {
  const [pkg, moduleNamespace] = await Promise.all([
    readJson(path.join(appDir, 'package.json')),
    loadBuiltModule(appDir),
  ]);

  const factory = resolveFactory(moduleNamespace);
  const appName = resolveCanonicalAppName(factory);
  const kernelConfig = factory?.kernelConfig ?? {};
  const manifest = factory?.manifest ?? {};

  const result = {
    app_name: appName,
    version: pkg.version ?? manifest.version ?? '0.1.0',
    description: kernelConfig.description ?? manifest.description ?? pkg.description,
    whatItIs: kernelConfig.whatItIs ?? manifest.whatItIs,
    whenToUse: kernelConfig.whenToUse ?? manifest.whenToUse,
    author: pkg.author ?? manifest.author,
    license: pkg.license ?? manifest.license,
    runtime: manifest.runtime,
    entry: {
      main: pkg.main ?? manifest.entry?.main ?? './dist/index.js',
      types: pkg.types ?? manifest.entry?.types,
    },
    promptRole: kernelConfig.promptRole ?? manifest.promptRole,
  };

  return Object.fromEntries(
    Object.entries(result).filter(([, value]) => value !== undefined)
  );
}

export async function writeAoappManifest(appDir, manifest) {
  const manifestPath = path.join(appDir, 'aoapp.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  return manifestPath;
}

async function main() {
  const appDir = process.argv[2];
  if (!isNonEmptyString(appDir)) {
    throw new Error('Usage: node scripts/generate-aoapp.mjs <app-dir>');
  }

  const absoluteAppDir = path.resolve(process.cwd(), appDir);
  const manifest = await buildAoappManifest(absoluteAppDir);
  await writeAoappManifest(absoluteAppDir, manifest);
  console.log(`[generate-aoapp] Wrote ${path.join(absoluteAppDir, 'aoapp.json')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[generate-aoapp] ${error.message}`);
    process.exit(1);
  });
}
