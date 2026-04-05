import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import { buildAoappManifest, writeAoappManifest } from './generate-aoapp.mjs';

test('buildAoappManifest derives aoapp.json from the built app metadata', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'aotui-generate-aoapp-'));

  try {
    await mkdir(path.join(tempDir, 'dist'), { recursive: true });

    await writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(
        {
          name: '@agentina/system-ide',
          version: '1.2.3',
          description: 'IDE app',
          main: './dist/index.js',
          types: './dist/index.d.ts',
        },
        null,
        2
      )
    );

    await writeFile(
      path.join(tempDir, 'dist/index.js'),
      `
      export default {
        kernelConfig: {
          appName: 'system_ide',
          description: 'IDE app',
          whatItIs: 'IDE',
          whenToUse: 'Use for code work'
        }
      };
      `
    );

    const manifest = await buildAoappManifest(tempDir);

    assert.equal(manifest.app_name, 'system_ide');
    assert.equal(manifest.version, '1.2.3');
    assert.equal(manifest.description, 'IDE app');
    assert.deepEqual(manifest.entry, {
      main: './dist/index.js',
      types: './dist/index.d.ts',
    });
    assert.equal('name' in manifest, false);
    assert.equal('displayName' in manifest, false);

    await writeAoappManifest(tempDir, manifest);
    const written = JSON.parse(await readFile(path.join(tempDir, 'aoapp.json'), 'utf-8'));
    assert.equal(written.app_name, 'system_ide');
    assert.equal(written.version, '1.2.3');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
