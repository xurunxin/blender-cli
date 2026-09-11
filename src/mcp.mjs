import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CliError, ensure } from './core.mjs';

// Each invocation owns exactly one MCP subprocess; the GUI/application bridge is separate.
export async function withMcp(spec, metadata, options, action) {
  const timeout = options.timeout || 60000;
  const client = new Client({ name: metadata.id, version: '0.1.0' });
  const transport = new StdioClientTransport({ ...spec, env: { ...process.env, ...spec.env }, stderr: 'pipe' });
  transport.stderr?.on('data', bytes => { if (options.verbose) process.stderr.write(bytes); });
  let timer;
  let interrupted;
  const cancelled = new Promise((_, reject) => {
    interrupted = () => reject(new CliError('INTERRUPTED', '调用已中断；已提交的应用操作可能仍在执行，请先检查应用状态。'));
    process.once('SIGINT', interrupted);
    process.once('SIGTERM', interrupted);
    timer = setTimeout(() => reject(new CliError('MCP_TIMEOUT', 'MCP 调用超时；操作结果可能未知，请检查应用状态后再决定是否重试。')), timeout);
  });
  const request = { timeout };
  try {
    return await Promise.race([(async () => {
      await client.connect(transport, request);
      return await action(client, request);
    })(), cancelled]);
  } finally {
    clearTimeout(timer);
    process.removeListener('SIGINT', interrupted);
    process.removeListener('SIGTERM', interrupted);
    // SDK closes stdin then escalates SIGTERM/SIGKILL for only its owned subprocess.
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}
export async function listAll(client, method, field, options) {
  const result = [];
  const seen = new Set();
  let cursor;
  do {
    const page = await client[method](cursor ? { cursor } : {}, options);
    result.push(...(page[field] || []));
    cursor = page.nextCursor;
    if (cursor) {
      ensure(!seen.has(cursor), 'INVALID_PAGINATION', 'MCP 服务返回了重复分页游标。');
      seen.add(cursor);
    }
  } while (cursor);
  return result;
}
export async function callTool(client, name, args, options) {
  const result = await client.callTool({ name, arguments: args }, undefined, options);
  if (result.isError) throw new CliError('TOOL_ERROR', `工具 ${name} 返回错误。`, result);
  return result;
}
