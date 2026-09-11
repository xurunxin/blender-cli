#!/usr/bin/env node
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { metadata, doctor, setup, launch, server } from './app.mjs';
import { CliError, ensure, positiveInt, readJson, loadConfig, saveConfig, output } from './core.mjs';
import { withMcp, listAll, callTool } from './mcp.mjs';
import { installSkills } from './skills.mjs';
import { disableCodex } from './integration.mjs';
import { startSession, sessionStatus, endSession, withSession, assertNoSession } from './session.mjs';
import { ensureApplication, closeOwnedApplication, inspectApplication } from './app-lifecycle.mjs';

const program = new Command();
program.name(metadata.bin).version('0.2.0').description(`${metadata.label} 任务级 CLI：复用应用与 MCP 会话，动态调用工具。`)
  .option('--home <directory>', 'CLI 状态目录（默认用户本地数据目录）')
  .option('--timeout <ms>', '超时毫秒：MCP 默认 60000，setup 默认 180000；不自动重试', positiveInt)
  .option('--verbose', '将 MCP 服务日志输出到 stderr')
  .option('--session <task>', '复用指定目标任务的 MCP 会话')
  .showHelpAfterError();
program.exitOverride();
program.configureOutput({ writeErr: s => process.stderr.write(s) });

function wrap(fn) { return async (...args) => { const result = await fn(...args); if (result !== undefined) output({ ok: true, ...result }); }; }
function common(command) {
  return command.option('--app-path <path>', '应用可执行文件路径').option('--server-path <path>', 'MCP 可执行文件或脚本路径')
    .option('--source <directory>', '现有 MCP 源码目录（离线复用）').option('--uv-path <path>', 'uv 可执行文件路径')
    .option('--host <host>', '本机桥接地址（仅 loopback）').option('--port <number>', '应用桥接端口', positiveInt);
}
async function context(command) { const options = command.optsWithGlobals(); return { config: await loadConfig(metadata, options), options }; }
async function mcp(command, action) {
  const { config, options } = await context(command);
  if (options.session) return withSession(config, options.session, options, action);
  await assertNoSession(config);
  return withMcp(await server(config), metadata, options, action);
}
async function argumentsJson(options) {
  ensure([options.args !== undefined, !!options.argsFile, !!options.stdin].filter(Boolean).length <= 1, 'INVALID_ARGUMENT', '--args、--args-file、--stdin 只能选一个。');
  let value;
  try {
    if (options.stdin) { let data = ''; for await (const chunk of process.stdin) data += chunk; value = JSON.parse(data); }
    else value = options.argsFile ? await readJson(options.argsFile) : JSON.parse(options.args || '{}');
  } catch (e) { throw new CliError('INVALID_JSON', `参数 JSON 无法读取：${e.message}`); }
  ensure(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_JSON', '工具参数必须是 JSON 对象。');
  return value;
}

common(program.command('doctor').description('只读检查应用、依赖和配置；--connect 额外进行 MCP 握手与工具发现'))
  .option('--connect', '短暂启动 MCP 并验证工具发现')
  .action(wrap(async (_, command) => {
    const { config, options } = await context(command);
    const result = await doctor(config, options);
    if (options.connect) {
      try { result.connection = await mcp(command, async (client, request) => ({ ok: true, tools: (await listAll(client, 'listTools', 'tools', request)).length })); }
      catch (e) { result.connection = { ok: false, code: e.code, message: e.message }; result.ok = false; }
    }
    if (!result.ok) process.exitCode = 1;
    return result;
  }));
common(program.command('setup').alias('init').description('安装/复用 MCP 运行环境并保存 CLI 配置'))
  .option('--dry-run', '仅显示计划，不下载、不安装、不写配置').option('--force', '允许替换 CLI 管理的冲突文件')
  .action(wrap(async (_, command) => {
    const { config, options } = await context(command);
    options.timeout ??= 180000;
    const result = await setup(config, options);
    if (!options.dryRun) await saveConfig(result.config || config);
    return result;
  }));
const app = program.command('app').description('应用进程管理');
app.command('status').description('只读查看已运行的应用进程')
  .action(wrap(async (_, command) => { const { config, options } = await context(command); return { application: await inspectApplication(config, metadata, options) }; }));
common(app.command('launch').alias('start').description('启动对应应用及本次会话的桥接服务'))
  .option('--headless', '后台运行（仅支持该模式的应用）').option('--dry-run', '只显示启动计划')
  .action(wrap(async (_, command) => {
    const { config, options } = await context(command); options.timeout ??= 60000;
    if (options.dryRun) return launch(config, options);
    const application = await ensureApplication(config, metadata, options, { launch, doctor });
    ensure(!application.diagnostic || application.pid, application.diagnostic?.code || 'APP_UNAVAILABLE', application.diagnostic?.message || '应用不可用。');
    return { application };
  }));
const sessions = program.command('session').description('以目标任务为单位复用 MCP；任务结束后按需释放资源');
common(sessions.command('start <task>').description('建立或复用任务 MCP 会话，不逐条重启服务'))
  .option('--launch-app', '优先复用已有应用，缺少时启动并记录本任务归属')
  .option('--headless', '需要新启动应用时使用后台模式')
  .option('--idle-timeout <seconds>', '无进行中请求时的 MCP 空闲回收秒数，默认 1800', positiveInt)
  .action(wrap(async (task, _, command) => { const { config, options } = await context(command); return { session: await startSession(config, metadata, task, options, { launch, doctor, server, ensureApplication }) }; }));
sessions.command('status [task]').description('查看任务、应用归属、MCP PID 与忙闲状态')
  .action(wrap(async (task, _, command) => { const { config } = await context(command); return { session: await sessionStatus(config, task) }; }));
sessions.command('end [task]').description('关闭任务 MCP，默认保留应用；不会重放操作')
  .option('--close-app', '请求正常关闭本任务启动的 GUI；保留原生保存提示，绝不强杀')
  .action(wrap(async (task, _, command) => { const { config, options } = await context(command); return { session: await endSession(config, task, options, closeOwnedApplication) }; }));
const tools = program.command('tools').description('实时发现 MCP 工具及其输入 schema');
tools.command('list').description('列出全部工具；默认精简输出').option('--full', '包含完整说明和 JSON Schema')
  .action(wrap(async (opts, command) => mcp(command, async (client, request) => {
    const list = await listAll(client, 'listTools', 'tools', request);
    return { tools: opts.full ? list : list.map(t => ({ name: t.name, description: t.description?.trim().split('\n')[0] })) };
  })));
tools.command('inspect <name>').description('读取一个工具的实时输入 schema')
  .action(wrap(async (name, _, command) => mcp(command, async (client, request) => {
    const tool = (await listAll(client, 'listTools', 'tools', request)).find(t => t.name === name);
    ensure(tool, 'UNKNOWN_TOOL', `工具不存在：${name}`); return { tool };
  })));
function addCall(parent, name) {
  parent.command(`${name} <name>`).description('按实时 schema 调用工具，输出原始 MCP 内容块')
    .option('--args <json>', 'JSON 对象参数').option('--args-file <path>', '从 UTF-8 JSON 文件读参数（推荐）').option('--stdin', '从 stdin 读 JSON 对象')
    .action(wrap(async (name, opts, command) => { const args = await argumentsJson(opts); return mcp(command, async (client, request) => ({ tool: name, result: await callTool(client, name, args, request) })); }));
}
addCall(tools, 'call'); addCall(program, 'call');
program.command('batch <file>').description('在一个短暂 MCP 会话顺序运行 [{tool,args}]；首个错误即停止')
  .action(wrap(async (file, _, command) => {
    const calls = await readJson(file);
    ensure(Array.isArray(calls) && calls.length > 0 && calls.every(c => typeof c.tool === 'string' && c.args && typeof c.args === 'object' && !Array.isArray(c.args)), 'INVALID_BATCH', 'batch 文件必须是非空 [{"tool":"名称","args":{}}]。');
    return mcp(command, async (client, request) => {
      const results = [];
      for (const call of calls) {
        try { results.push({ tool: call.tool, result: await callTool(client, call.tool, call.args, request) }); }
        catch (e) { throw new CliError(e.code || 'BATCH_FAILED', e.message, { completed: results, failed: call.tool, error: e.details, remaining: calls.length - results.length - 1 }); }
      }
      return { results };
    });
  }));
const resources = program.command('resources').description('按需访问 MCP 资源（上游支持时）');
resources.command('list').action(wrap(async (_, command) => mcp(command, async (client, request) => ({ resources: await listAll(client, 'listResources', 'resources', request) }))));
resources.command('read <uri>').action(wrap(async (uri, _, command) => mcp(command, async (client, request) => ({ result: await client.readResource({ uri }, request) }))));
const skills = program.command('skills').description('将内置 skill 安装到调用者的项目');
skills.command('list').action(wrap(async () => ({ skills: [{ name: metadata.id, description: `${metadata.label} CLI 操作与环境初始化` }] })));
skills.command('install').description('默认写入当前项目 .agents/skills；保留定制文件')
  .option('--target <directory>', '已有目标项目目录，默认 cwd').option('--agent <agent>', 'codex、claude 或 all', 'codex')
  .option('--dry-run', '只显示安装计划').option('--force', '覆盖同名定制 SKILL.md')
  .action(wrap(async opts => installSkills(metadata, opts)));
const integration = program.command('integration').description('迁移原来的固定 MCP 配置');
integration.command('disable-codex').description('仅禁用此应用的固定 Codex MCP 条目，备份后修改；重启 Codex 生效')
  .option('--codex-config <path>', 'Codex config.toml 路径').option('--dry-run', '只显示将禁用的服务')
  .action(wrap(async opts => disableCodex(metadata, opts)));
program.command('config').description('显示当前 CLI 配置（独立于 Codex MCP 配置）')
  .action(wrap(async (_, command) => ({ config: (await context(command)).config })));
program.addHelpText('after', `\n目标任务示例：\n  ${metadata.bin} session start shot-01 --launch-app\n  ${metadata.bin} --session shot-01 tools list\n  ${metadata.bin} --session shot-01 tools inspect <工具名>\n  ${metadata.bin} --session shot-01 tools call <工具名> --args-file args.json\n  ${metadata.bin} session end shot-01\n\n任务内复用同一 MCP 进程。end 默认保留应用；确认任务完成后可加 --close-app 请求正常关闭本任务启动的 GUI。\n没有任务会话时仍支持单次 tools/call/batch。空闲回收只关闭 MCP，不关闭应用。\n业务结果为 JSON stdout；日志为 stderr。退出码：0 成功，1 运行/工具/环境错误，2 参数错误。调用不自动重试。\n状态目录可通过 --home 或 ${metadata.id.toUpperCase().replaceAll('-', '_')}_HOME 指定。`);
try { await program.parseAsync(); }
catch (e) {
  if (e.code === 'commander.helpDisplayed' || e.code === 'commander.version') process.exitCode = 0;
  else {
    output({ ok: false, error: { code: e.code || 'RUNTIME_ERROR', message: e.message, ...(e.details === undefined ? {} : { details: e.details }) } });
    process.exitCode = String(e.code).startsWith('commander.') || String(e.code).startsWith('INVALID_') ? 2 : 1;
  }
}
