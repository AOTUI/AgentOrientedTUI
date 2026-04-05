import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('setup.sh does not rely on root workspace install or include mobile-ai-native-react-native', async () => {
  const content = await readFile(new URL('../setup.sh', import.meta.url), 'utf-8');

  assert.equal(content.includes('mobile-ai-native-react-native'), false);
  assert.equal(content.includes('pnpm install --ignore-workspace'), true);
  assert.equal(content.includes('pnpm install\n'), false);
  assert.equal(content.includes('pnpm --filter ./runtime build'), false);
});

test('run.sh builds explicit app/package directories and skips mobile-ai-native-react-native', async () => {
  const content = await readFile(new URL('../run.sh', import.meta.url), 'utf-8');

  assert.equal(content.includes('mobile-ai-native-react-native'), false);
  assert.equal(content.includes('pnpm --filter ./runtime build'), false);
  assert.equal(content.includes('pnpm --filter "./$app" build'), false);
});

test('setup.sh links local agent-driver/runtime/sdk before building dependent packages', async () => {
  const content = await readFile(new URL('../setup.sh', import.meta.url), 'utf-8');

  assert.equal(content.includes('pnpm link "../agent-driver-v2"'), false);
  assert.equal(content.includes('pnpm link "../runtime"'), false);
  assert.equal(content.includes('pnpm link "../sdk"'), false);
  assert.equal(content.includes('REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"'), true);
  assert.equal(content.includes('ln -sfn "$source_path" "$scope_dir/$package_name"'), true);
});

test('run.sh preserves local core build order for linked dependencies', async () => {
  const content = await readFile(new URL('../run.sh', import.meta.url), 'utf-8');
  const agentDriverIndex = content.indexOf('pnpm -C agent-driver-v2 build');
  const runtimeIndex = content.indexOf('pnpm -C runtime build');
  const sdkIndex = content.indexOf('pnpm -C sdk build');

  assert.notEqual(agentDriverIndex, -1);
  assert.notEqual(runtimeIndex, -1);
  assert.notEqual(sdkIndex, -1);
  assert.equal(agentDriverIndex < runtimeIndex, true);
  assert.equal(runtimeIndex < sdkIndex, true);
});

test('setup.sh and run.sh default to ide, terminal, and lite-browser apps', async () => {
  const setupContent = await readFile(new URL('../setup.sh', import.meta.url), 'utf-8');
  const runContent = await readFile(new URL('../run.sh', import.meta.url), 'utf-8');

  for (const content of [setupContent, runContent]) {
    assert.equal(content.includes('"demo-apps/aotui-ide"'), true);
    assert.equal(content.includes('"demo-apps/terminal-app"'), true);
    assert.equal(content.includes('"demo-apps/lite-browser-app"'), true);
    assert.equal(content.includes('"demo-apps/planning-app"'), false);
    assert.equal(content.includes('"demo-apps/token-monitor-app"'), false);
  }
});
