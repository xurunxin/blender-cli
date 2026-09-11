import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export class CliError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}
export function ensure(condition, code, message) { if (!condition) throw new CliError(code, message); }
export function positiveInt(value) {
  const n = Number(value);
  ensure(Number.isSafeInteger(n) && n > 0 && n <= 2147483647, 'INVALID_ARGUMENT', '请输入 1..2147483647 的整数。');
  return n;
}
export async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
export async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await rename(temp, path);
}
export async function loadConfig(metadata, options = {}) {
  const prefix = metadata.id.toUpperCase().replaceAll('-', '_');
  const stateDir = resolve(options.home || process.env[`${prefix}_HOME`] || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), metadata.id));
  let saved = {};
  try { saved = await readJson(join(stateDir, 'config.json')); }
  catch (e) { if (e.code !== 'ENOENT') throw new CliError('CONFIG_ERROR', `无法读取 ${join(stateDir, 'config.json')}: ${e.message}`); }
  ensure(saved && typeof saved === 'object' && !Array.isArray(saved), 'CONFIG_ERROR', '配置必须是 JSON 对象。');
  const result = { host: '127.0.0.1', port: metadata.defaultPort, ...saved, stateDir };
  for (const key of ['appPath', 'serverPath', 'source', 'uvPath', 'host', 'port']) if (options[key] !== undefined) result[key] = options[key];
  ensure(['localhost', '127.0.0.1', '::1'].includes(result.host), 'INVALID_HOST', '应用桥接仅支持本机 loopback 地址。');
  if (result.port !== undefined) ensure(Number.isInteger(result.port) && result.port > 0 && result.port < 65536, 'INVALID_PORT', '端口必须在 1..65535。');
  return result;
}
export async function saveConfig(config) {
  const { stateDir, ...saved } = config;
  await atomicJson(join(stateDir, 'config.json'), saved);
}
export function output(data) { process.stdout.write(`${JSON.stringify(data, null, 2)}\n`); }
