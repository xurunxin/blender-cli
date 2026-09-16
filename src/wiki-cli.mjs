/** Native Commander registration plus dependency-free offline entry point. */
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { dispatchWiki, serializeWiki } from './wiki.mjs';

async function run(command, value, options) {
  const result = await dispatchWiki(command, value, options);
  process.stdout.write(serializeWiki(result, options.maxChars));
}

export function registerWikiCommands(program) {
  const wiki = program.command('wiki').description('离线检索 Blender 知识、排错配方与工作流；不启动 Blender/MCP');
  const bounded = command => command.option('--max-chars <number>', '完整 JSON 的 Unicode 字符预算（1024..100000）', '12000');
  const paged = (command, limit = '20') => bounded(command).option('--limit <number>', '最多返回条目数（1..100）', limit).option('--offset <number>', '从零开始的结果偏移', '0');
  paged(wiki.command('search <query>').description('中英关键词与中文二元切分加权检索'), '5')
    .option('--kind <kind>', 'all、topic、recipe、workflow', 'all')
    .action((query, opts) => run('search', query, opts));
  bounded(wiki.command('show <id>').description('读取一个完整条目；预算不足时不截断正文'))
    .option('--section <section>', 'goal、prerequisites、steps、pitfalls、acceptance、version_notes')
    .action((id, opts) => run('show', id, opts));
  paged(wiki.command('list').description('列出知识目录'))
    .option('--kind <kind>', 'all、topic、recipe、workflow', 'all')
    .action(opts => run('list', undefined, opts));
  paged(wiki.command('sources [id]').description('读取来源、版本范围与实际复核深度'))
    .action((id, opts) => run('sources', id, opts));
  for (const command of ['status', 'validate']) bounded(wiki.command(command).description(command === 'status' ? '显示知识库覆盖与验收边界' : '离线验证条目、章节、锚点和来源引用'))
    .action(opts => run(command, undefined, opts));
}

const HELP = 'node src/wiki-cli.mjs <search QUERY|show ID|sources [ID]|list|status|validate> [--kind KIND] [--limit N] [--offset N] [--max-chars N] [--section NAME]\n';
export async function main(argv = process.argv.slice(2)) {
  try {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
      kind: { type: 'string' }, limit: { type: 'string' }, offset: { type: 'string' },
      'max-chars': { type: 'string' }, section: { type: 'string' }, help: { type: 'boolean', short: 'h' },
    } });
    if (values.help) { process.stdout.write(HELP); return 0; }
    const [command, value] = positionals;
    const arities = { search: [2, 2], show: [2, 2], sources: [1, 2], list: [1, 1], status: [1, 1], validate: [1, 1] };
    if (!Object.hasOwn(arities, command) || positionals.length < arities[command][0] || positionals.length > arities[command][1]) {
      const e = new Error(HELP.trim()); e.code = 'INVALID_WIKI_ARGUMENT'; throw e;
    }
    const allowed = { search: ['kind', 'limit', 'offset', 'max-chars'], show: ['section', 'max-chars'], sources: ['limit', 'offset', 'max-chars'], list: ['kind', 'limit', 'offset', 'max-chars'], status: ['max-chars'], validate: ['max-chars'] };
    for (const key of Object.keys(values)) if (!allowed[command].includes(key)) {
      const e = new Error(`${command} 不支持 --${key}`); e.code = 'INVALID_WIKI_ARGUMENT'; throw e;
    }
    await run(command, value, { ...values, maxChars: values['max-chars'] });
    return 0;
  } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, error: { code: e.code ?? 'WIKI_ERROR', message: e.message } }) + '\n');
    return String(e.code).startsWith('INVALID_') || String(e.code).startsWith('ERR_PARSE_ARGS_') ? 2 : 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
