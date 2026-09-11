import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startSession, endSession, sessionStatus, withSession, readSession, sessionRequest, assertNoSession } from '../src/session.mjs';
import { closeOwnedApplication } from '../src/app-lifecycle.mjs';
import { callTool, listAll } from '../src/mcp.mjs';
const metadata = { id: 'task-session-test' };
const spec = { command: process.execPath, args: [fileURLToPath(new URL('./fixtures/mcp-server.mjs', import.meta.url))] };
const adapters = { server: async () => spec };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function create(t, options = {}) {
  const config = { stateDir: await mkdtemp(join(tmpdir(), 'cli-task-session-')) };
  const started = await startSession(config, metadata, 'shot-01', { timeout: 5000, ...options }, adapters);
  t.after(async () => { await endSession(config, 'shot-01', {}, closeOwnedApplication); });
  return { config, started };
}
test('multiple CLI requests reuse one MCP and release only MCP on task end', async t => {
  const { config, started } = await create(t);
  assert.equal((await startSession(config, metadata, 'shot-01', {}, adapters)).mcpPid, started.mcpPid);
  await assert.rejects(startSession(config, metadata, 'other-goal', {}, adapters), { code: 'SESSION_IN_USE' });
  await assert.rejects(assertNoSession(config), { code: 'SESSION_REQUIRED' });
  for (let i = 0; i < 3; i++) {
    const result = await withSession(config, 'shot-01', {}, (client, opts) => callTool(client, 'pid', {}, opts));
    assert.equal(Number(result.content[0].text), started.mcpPid);
  }
  const list = await withSession(config, 'shot-01', {}, (client, opts) => listAll(client, 'listTools', 'tools', opts));
  assert.deepEqual(list.map(t => t.name), ['echo', 'failure']);
  const ended = await endSession(config, 'shot-01', {}, closeOwnedApplication);
  assert.equal(ended.mcpClosed, true);
  assert.equal(ended.applicationResult.state, 'retained');
  assert.throws(() => process.kill(started.mcpPid, 0), { code: 'ESRCH' });
  await assertNoSession(config);
});
test('session token is required and public status does not expose it', async t => {
  const { config } = await create(t);
  const record = await readSession(config);
  assert.ok(record.token);
  assert.equal((await sessionStatus(config)).token, undefined);
  await assert.rejects(sessionRequest({ ...record, token: 'incorrect' }, 'listTools', {}), { code: 'UNAUTHORIZED' });
  await assert.rejects(withSession(config, 'wrong-task', {}, () => {}), { code: 'SESSION_UNAVAILABLE' });
  const result = await withSession(config, 'shot-01', {}, (client, opts) => callTool(client, 'echo', { message: '中文场景 🎬' }, opts));
  assert.equal(JSON.parse(result.content[0].text).message, '中文场景 🎬');
});
test('an in-flight request blocks end and idle eviction; timeout never restarts MCP', async t => {
  const { config, started } = await create(t, { idleTimeout: 1 });
  const pending = withSession(config, 'shot-01', { timeout: 2200 }, (client, opts) => callTool(client, 'hang', {}, opts)).catch(e => e);
  await delay(1200);
  assert.equal((await sessionStatus(config)).busy, true);
  await assert.rejects(endSession(config, 'shot-01', {}, closeOwnedApplication), { code: 'SESSION_BUSY' });
  const error = await pending;
  assert.ok(error instanceof Error);
  assert.equal((await sessionStatus(config)).mcpPid, started.mcpPid);
});
test('idle eviction closes MCP and retains application without user interaction', async t => {
  const { config, started } = await create(t, { idleTimeout: 1 });
  let status;
  for (let i = 0; i < 40; i++) { await delay(100); status = await sessionStatus(config); if (status.state === 'ended') break; }
  assert.equal(status.state, 'ended');
  assert.equal(status.endReason, 'idle-timeout');
  assert.equal(status.applicationResult.state, 'retained');
  assert.throws(() => process.kill(started.mcpPid, 0), { code: 'ESRCH' });
});
test('failed initialization preserves diagnostic state and releases session lock', async () => {
  const config = { stateDir: await mkdtemp(join(tmpdir(), 'cli-task-fail-')) };
  await assert.rejects(startSession(config, metadata, 'failed-goal', { timeout: 1000 }, { server: async () => ({ command: 'no-such-mcp-test-program', args: [] }) }), { code: 'SESSION_START_FAILED' });
  const status = await sessionStatus(config);
  assert.equal(status.state, 'failed');
  assert.equal(status.mcpClosed, true);
  await assert.rejects(readFile(join(config.stateDir, 'task-session.lock')), { code: 'ENOENT' });
});
