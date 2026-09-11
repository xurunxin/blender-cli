import { createServer } from 'node:http';
import { readFile, unlink } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { atomicJson, ensure } from './core.mjs';
import { publicSession, sessionPaths, releaseLock } from './session.mjs';
import { closeOwnedApplication } from './app-lifecycle.mjs';

const payload = JSON.parse(await readFile(process.argv[2], 'utf8'));
const { config, metadata, spec, timeout } = payload;
let record = { ...payload.initial, pid: process.pid };
const client = new Client({ name: metadata.id, version: '0.2.0' });
const transport = new StdioClientTransport({ ...spec, env: { ...process.env, ...spec.env }, stderr: 'pipe' });
transport.stderr?.on('data', chunk => process.stderr.write(chunk));
let busy = false, closing = false, timer, httpServer;
let lastUsed = Date.now();
const save = () => atomicJson(sessionPaths(config).state, record);
const status = () => ({ ...publicSession(record), busy, lastUsedAt: new Date(lastUsed).toISOString(), idleRemainingSeconds: Math.max(0, Math.ceil(record.idleSeconds - (Date.now() - lastUsed) / 1000)) });
async function finish(reason, closeApp = false) {
  if (closing) return status();
  closing = true;
  clearInterval(timer);
  record.state = 'ending';
  await save();
  await client.close().catch(() => {});
  await transport.close().catch(() => {});
  let applicationResult = { state: 'retained', reason: '默认保留应用；只有显式 --close-app 才请求关闭本任务启动的应用。' };
  if (closeApp) {
    try { applicationResult = await closeOwnedApplication(record.application, { timeout: 5000 }); }
    catch (e) { applicationResult = { state: 'retained', reason: e.message }; }
  }
  record = { ...record, state: reason === 'failed' ? 'failed' : 'ended', endedAt: new Date().toISOString(), endReason: reason, mcpClosed: true, applicationResult };
  delete record.token;
  delete record.port;
  await save();
  await releaseLock(config, record.instance);
  await unlink(process.argv[2]).catch(() => {});
  return publicSession(record);
}
function json(res, value, code = 200) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }
async function handle(req, res) {
  if (req.method !== 'POST' || req.url !== '/' || req.headers.authorization !== `Bearer ${record.token}`) return json(res, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Session authentication required' } }, 401);
  try {
    let raw = '';
    req.setEncoding('utf8');
    for await (const chunk of req) { raw += chunk; ensure(raw.length <= 16 * 1024 * 1024, 'INVALID_REQUEST', '请求过大。'); }
    const { instance, operation, params, timeout: requestTimeout } = JSON.parse(raw);
    ensure(instance === record.instance, 'SESSION_MISMATCH', '会话实例已改变。');
    if (operation === 'status') return json(res, { ok: true, result: status() });
    ensure(!closing && !busy, 'SESSION_BUSY', '会话有正在执行的请求或正在关闭；请稍后检查状态。');
    if (operation === 'end') {
      const result = await finish('explicit', params?.closeApp === true);
      json(res, { ok: true, result });
      httpServer.close();
      return;
    }
    ensure(['listTools', 'callTool', 'listResources', 'readResource'].includes(operation), 'INVALID_OPERATION', 'Unsupported session operation');
    ensure(Number.isInteger(requestTimeout) && requestTimeout > 0 && requestTimeout <= 2147483647, 'INVALID_ARGUMENT', '无效超时。');
    busy = true;
    lastUsed = Date.now();
    try {
      const opts = { timeout: requestTimeout };
      const result = operation === 'callTool' ? await client.callTool(params, undefined, opts) : await client[operation](params, opts);
      json(res, { ok: true, result });
    } finally { busy = false; lastUsed = Date.now(); }
  } catch (e) { json(res, { ok: false, error: { code: e.code || 'SESSION_ERROR', message: e.message, details: e.details } }); }
}
try {
  await atomicJson(sessionPaths(config).lock, { instance: record.instance, pid: process.pid });
  await save();
  await client.connect(transport, { timeout });
  httpServer = createServer((req, res) => { handle(req, res).catch(e => { process.stderr.write(`${e.message}\n`); res.destroy(); }); });
  httpServer.requestTimeout = 30000;
  await new Promise((resolve, reject) => { httpServer.once('error', reject); httpServer.listen(0, '127.0.0.1', resolve); });
  record = { ...record, state: 'ready', mcpPid: transport.pid, port: httpServer.address().port };
  await save();
  timer = setInterval(() => {
    if (!busy && !closing && Date.now() - lastUsed >= record.idleSeconds * 1000) finish('idle-timeout').then(() => httpServer.close()).catch(e => process.stderr.write(`${e.message}\n`));
  }, Math.min(1000, record.idleSeconds * 1000));
  client.onclose = () => { if (!closing) finish('connection-lost').then(() => httpServer.close()).catch(e => process.stderr.write(`${e.message}\n`)); };
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => finish(signal).then(() => httpServer.close()).catch(() => process.exit(1)));
} catch (e) {
  record.error = { code: e.code || 'MCP_ERROR', message: e.message };
  await finish('failed');
  httpServer?.close();
  process.exitCode = 1;
}
