import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { doctor, metadata, server, setup } from '../src/app.mjs';

test('exports stable Blender adapter metadata', () => {
  assert.deepEqual(metadata, {
    id: 'blender-cli',
    bin: 'blender-cli',
    label: 'Blender',
    defaultPort: 9876,
    mcpNames: ['blender'],
  });
});

test('server requires setup instead of downloading implicitly during a tool call', async () => {
  const stateDir = path.join(os.tmpdir(), 'blender-cli-server-test');
  await assert.rejects(
    server({ stateDir, uvPath: process.platform === 'win32' ? 'uv.exe' : 'uv' }),
    (error) => error.code === 'MCP_NOT_FOUND' && /blender-cli setup/.test(error.message),
  );
});

test('rejects a non-loopback Blender bridge host', async () => {
  await assert.rejects(
    server({ stateDir: path.join(os.tmpdir(), 'blender-cli-host-test'), host: '0.0.0.0' }),
    (error) => error.code === 'NON_LOOPBACK_HOST',
  );
});

test('setup dry-run performs no writes and returns an actionable plan', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'blender-cli-dry-run-'));
  const stateDir = path.join(parent, 'state-that-does-not-exist');
  try {
    const result = await setup(
      { stateDir },
      {
        dryRun: true,
        appPath: path.join(parent, 'Blender'),
        uvPath: path.join(parent, 'uv'),
      },
    );
    assert.equal(result.dryRun, true);
    assert.equal(result.changed, false);
    assert.equal(result.config.host, 'localhost');
    assert.equal(result.config.port, 9876);
    assert.equal(result.plan.length, 4);
    await assert.rejects(statPath(stateDir));
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('doctor is read-only and reports missing setup pieces', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'blender-cli-doctor-'));
  const stateDir = path.join(parent, 'state-that-does-not-exist');
  try {
    const result = await doctor({
      stateDir,
      appPath: path.join(parent, 'missing-blender'),
      uvPath: path.join(parent, 'missing-uv'),
      pluginPath: path.join(parent, 'missing-plugin'),
    });
    assert.equal(result.ok, false);
    assert.equal(typeof result.running, 'boolean');
    assert.equal(result.checks.find((check) => check.name === 'Blender executable').ok, false);
    assert.equal(result.checks.find((check) => check.name === 'Pinned MCP server').ok, false);
    await assert.rejects(statPath(stateDir));
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

async function statPath(target) {
  const { stat } = await import('node:fs/promises');
  return stat(target);
}
