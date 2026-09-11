import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { withMcp, listAll, callTool } from '../src/mcp.mjs';
const spec = { command: process.execPath, args: [fileURLToPath(new URL('./fixtures/mcp-server.mjs', import.meta.url))] };
const metadata = { id: 'cli-test' };
test('real stdio handshake, pagination and calls', async () => {
  const result = await withMcp(spec, metadata, { timeout: 5000 }, async (client, opts) => {
    assert.deepEqual((await listAll(client, 'listTools', 'tools', opts)).map(t => t.name), ['echo', 'failure']);
    return callTool(client, 'echo', { value: 42 }, opts);
  });
  assert.equal(result.content[0].text, '{"value":42}');
});
test('tool isError produces failure and closes transport', async () => {
  await assert.rejects(withMcp(spec, metadata, { timeout: 5000 }, (client, opts) => callTool(client, 'failure', {}, opts)), { code: 'TOOL_ERROR' });
});
test('unresponsive call has a bounded lifetime', async () => {
  await assert.rejects(withMcp(spec, metadata, { timeout: 500 }, (client, opts) => callTool(client, 'hang', {}, opts)), { code: 'MCP_TIMEOUT' });
});
test('startup failure is propagated', async () => {
  await assert.rejects(withMcp({ command: 'nonexistent-mcp-test-command', args: [] }, metadata, { timeout: 1000 }, () => {}));
});
test('owned MCP process is gone after a successful invocation', async () => {
  const result = await withMcp(spec, metadata, { timeout: 5000 }, (client, opts) => callTool(client, 'pid', {}, opts));
  const pid = Number(result.content[0].text);
  assert.ok(pid > 0);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});
