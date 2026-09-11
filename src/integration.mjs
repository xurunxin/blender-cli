import { readFile, writeFile, rename, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { ensure } from './core.mjs';

export function disableEntries(text, names) {
  const matches = [...text.matchAll(/^\[mcp_servers\.(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([A-Za-z0-9_-]+))\][ \t]*(?:#[^\r\n]*)?\r?$/gm)];
  const changes = [];
  let result = text;
  for (const match of matches.reverse()) {
    const name = match[1] || match[2] || match[3];
    if (!names.includes(name)) continue;
    const start = match.index + match[0].replace(/\r$/, '').length;
    const rest = text.slice(start);
    const next = /\r?\n[ \t]*\[/.exec(rest);
    const end = next ? start + next.index : text.length;
    const body = text.slice(start, end);
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    const enabled = /^[ \t]*enabled[ \t]*=[ \t]*(true|false)[ \t]*(?:#[^\r\n]*)?\r?$/m;
    const found = enabled.exec(body);
    ensure(!/^[ \t]*enabled[ \t]*=/m.test(body) || found, 'CONFIG_ERROR', `无法安全识别 ${name} 的 enabled 字段。`);
    if (found?.[1] === 'false') { changes.push({ name, status: 'unchanged' }); continue; }
    const replacement = found ? body.replace(enabled, value => `enabled = false${value.endsWith('\r') ? '\r' : ''}`) : `${newline}enabled = false${body}`;
    result = result.slice(0, start) + replacement + result.slice(end);
    changes.push({ name, status: 'disabled' });
  }
  return { text: result, changes: changes.reverse() };
}
export async function disableCodex(metadata, options) {
  const path = options.codexConfig || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'config.toml');
  ensure(!(await lstat(path)).isSymbolicLink(), 'UNSAFE_TARGET', 'Codex 配置是链接，请选择实际文件路径。');
  const before = await readFile(path, 'utf8');
  const result = disableEntries(before, metadata.mcpNames || [metadata.id.replace(/-cli$/, '')]);
  let backup;
  if (!options.dryRun && result.text !== before) {
    ensure(await readFile(path, 'utf8') === before, 'CONFIG_CHANGED', '配置已被其他进程修改，请重新运行。');
    backup = `${path}.${metadata.id}.${randomUUID()}.bak`;
    await writeFile(backup, before, { flag: 'wx', mode: 0o600 });
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, result.text, { flag: 'wx', mode: 0o600 });
    await rename(temp, path);
  }
  return { path, dryRun: !!options.dryRun, changes: result.changes, backup, restartRequired: result.changes.some(c => c.status === 'disabled') };
}
