import { request } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CliError, ensure, readJson, atomicJson } from './core.mjs';

export const sessionPaths = config => ({ state: join(config.stateDir, 'task-session.json'), lock: join(config.stateDir, 'task-session.lock') });
export function publicSession(record) {
  if (!record) return { state: 'absent' };
  const { token, port, config, spec, ...safe } = record;
  return safe;
}
function isAlive(pid) { if (!Number.isInteger(pid) || pid < 1) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; } }
export async function readSession(config) {
  try { return await readJson(sessionPaths(config).state); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
export function sessionRequest(record, operation, params = {}, timeout = 60000) {
  ensure(record?.token && Number.isInteger(record.port), 'SESSION_UNAVAILABLE', '会话已结束或尚未就绪，请先运行 session status。');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ instance: record.instance, operation, params, timeout });
    const req = request({ host: '127.0.0.1', port: record.port, path: '/', method: 'POST', headers: {
      authorization: `Bearer ${record.token}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body)
    } }, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('error', reject);
      res.on('end', () => {
        try { const data = JSON.parse(raw); if (!data.ok) reject(new CliError(data.error?.code || 'SESSION_ERROR', data.error?.message || '会话请求失败', data.error?.details)); else resolve(data.result); }
        catch (e) { reject(e); }
      });
    });
    const timer = setTimeout(() => req.destroy(new CliError('SESSION_TIMEOUT', '会话请求超时；操作可能仍在执行，请查看 session status，不要自动重试。')), timeout + 3000);
    req.on('error', reject);
    req.on('close', () => clearTimeout(timer));
    req.end(body);
  });
}
export async function sessionStatus(config, task) {
  const record = await readSession(config);
  if (!record) return { state: 'absent' };
  if (task) ensure(record.task === task, 'SESSION_MISMATCH', `当前记录属于任务 ${record.task}。`);
  if (['ready', 'starting'].includes(record.state)) {
    if (!isAlive(record.pid)) return { ...publicSession(record), state: 'stale', message: '会话进程已退出；显式 session start 可重新建立连接，不会重放操作。' };
    try { return await sessionRequest(record, 'status', {}, 3000); }
    catch { return { ...publicSession(record), state: 'unreachable', message: '会话进程仍存在但不可访问，请检查日志；不会自动重启。' }; }
  }
  return publicSession(record);
}
export async function requireSession(config, task) {
  const record = await readSession(config);
  ensure(record?.task === task && record.state === 'ready', 'SESSION_UNAVAILABLE', `任务 ${task} 没有可用会话，运行 session status / session start。`);
  return record;
}
export async function withSession(config, task, options, action) {
  const record = await requireSession(config, task);
  const proxy = {
    listTools: (params, opts) => sessionRequest(record, 'listTools', params, opts?.timeout || 60000),
    callTool: (params, _, opts) => sessionRequest(record, 'callTool', params, opts?.timeout || 60000),
    listResources: (params, opts) => sessionRequest(record, 'listResources', params, opts?.timeout || 60000),
    readResource: (params, opts) => sessionRequest(record, 'readResource', params, opts?.timeout || 60000)
  };
  return action(proxy, { timeout: options.timeout || 60000 });
}
export async function assertNoSession(config) {
  const record = await readSession(config);
  ensure(!record || !['ready', 'starting', 'ending'].includes(record.state) || !isAlive(record.pid), 'SESSION_REQUIRED', `任务 ${record?.task} 正在使用此应用，请添加 --session ${record?.task}；避免另开 MCP 抢占桥接。`);
  try { const lock = await readJson(sessionPaths(config).lock); ensure(!isAlive(lock.pid), 'SESSION_REQUIRED', '任务会话正在启动或结束，请先查看 session status。'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}
export async function releaseLock(config, instance) {
  try { const lock = await readJson(sessionPaths(config).lock); if (lock.instance === instance) await unlink(sessionPaths(config).lock); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}
export async function startSession(config, metadata, task, options = {}, adapters = {}) {
  ensure(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(task), 'INVALID_TASK', '任务名使用 1..80 个英文字母、数字、点、下划线或连字符。');
  const timeout = options.timeout || 60000;
  const idleSeconds = options.idleTimeout || 1800;
  ensure(Number.isInteger(idleSeconds) && idleSeconds > 0 && idleSeconds <= 86400, 'INVALID_ARGUMENT', '空闲超时秒数为 1..86400。');
  const existing = await sessionStatus(config);
  if (existing.state === 'ready') {
    ensure(existing.task === task, 'SESSION_IN_USE', `此应用已被任务 ${existing.task} 使用；先结束它或继续使用原任务名。`);
    return { ...existing, reused: true };
  }
  ensure(existing.state !== 'unreachable', 'SESSION_UNREACHABLE', '会话进程尚在运行，请查看日志后再处理，避免重复启动。');
  await mkdir(config.stateDir, { recursive: true });
  const paths = sessionPaths(config);
  const instance = randomUUID();
  try { await writeFile(paths.lock, JSON.stringify({ instance, pid: process.pid }), { flag: 'wx', mode: 0o600 }); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const lock = await readJson(paths.lock);
    ensure(!isAlive(lock.pid), 'SESSION_STARTING', '另一个进程正在建立或结束会话，请稍后查看 session status。');
    await unlink(paths.lock);
    await writeFile(paths.lock, JSON.stringify({ instance, pid: process.pid }), { flag: 'wx', mode: 0o600 });
  }
  let child;
  const bootstrap = join(config.stateDir, `session-${instance}.json`);
  try {
    const spec = await adapters.server(config);
    const application = options.launchApp
      ? await adapters.ensureApplication(config, metadata, options, adapters)
      : { ownership: 'reused', reason: '任务使用已有应用，未由本会话启动。' };
    ensure(!application.diagnostic || application.pid, application.diagnostic?.code || 'APP_UNAVAILABLE', application.diagnostic?.message || '应用不可用。');
    const logPath = join(config.stateDir, `session-${instance}.log`);
    const initial = { instance, task, project: process.cwd(), state: 'starting', pid: process.pid, token: randomBytes(32).toString('hex'), startedAt: new Date().toISOString(), idleSeconds, application, logPath };
    await atomicJson(paths.state, initial);
    await atomicJson(bootstrap, { initial, config, metadata, spec, timeout });
    const log = await open(logPath, 'a');
    try {
      child = spawn(process.execPath, [fileURLToPath(new URL('./session-daemon.mjs', import.meta.url)), bootstrap], {
        cwd: config.stateDir, env: process.env, detached: true, windowsHide: true, shell: false, stdio: ['ignore', log.fd, log.fd]
      });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
    } finally { await log.close(); }
    const deadline = Date.now() + timeout + 5000;
    while (Date.now() < deadline) {
      const state = await readSession(config);
      if (state?.instance === instance && state.state === 'ready') return publicSession(state);
      if (state?.instance === instance && state.state === 'failed') throw new CliError('SESSION_START_FAILED', state.error?.message || 'MCP 会话启动失败', publicSession(state));
      ensure(isAlive(child.pid), 'SESSION_START_FAILED', `会话进程已退出，日志：${logPath}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new CliError('SESSION_START_TIMEOUT', `会话尚未就绪，请检查 session status 和 ${logPath}；应用保留。`);
  } catch (e) {
    if (!child || !isAlive(child.pid)) { await releaseLock(config, instance); await unlink(bootstrap).catch(() => {}); }
    throw e;
  }
}
export async function endSession(config, task, options = {}, closeOwnedApplication) {
  const record = await readSession(config);
  if (!record) return { state: 'absent', mcpClosed: true };
  if (task) ensure(record.task === task, 'SESSION_MISMATCH', `当前记录属于任务 ${record.task}。`);
  if (record.state === 'ready' && isAlive(record.pid)) return sessionRequest(record, 'end', { closeApp: !!options.closeApp }, options.timeout || 15000);
  ensure(!['ready', 'starting'].includes(record.state) || !isAlive(record.pid), 'SESSION_UNREACHABLE', '会话进程尚未就绪或不可访问；保留应用，请查看日志。');
  const application = options.closeApp ? await closeOwnedApplication(record.application, options) : { state: 'retained', reason: '默认保留应用。' };
  return { ...publicSession(record), mcpClosed: true, applicationResult: application };
}
