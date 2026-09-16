/** Offline knowledge lookup. No Blender, MCP, shell, network or writable index. */
import { readFile } from 'node:fs/promises';

export const SECTIONS = Object.freeze({ goal: '目标', prerequisites: '前置检查', steps: '步骤', pitfalls: '排错', acceptance: '验收', version_notes: '版本提示' });
export const KINDS = Object.freeze(['topic', 'recipe', 'workflow']);
const ROOT = new URL('../docs/wiki/', import.meta.url);
const fail = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const requireData = (condition, message) => { if (!condition) fail('WIKI_DATA_INVALID', message); };
const text = value => Array.isArray(value) ? value.join(' ') : String(value ?? '');
const length = value => Array.from(value).length;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function integer(value, fallback, min, max, name) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(n) || n < min || n > max)
    fail('INVALID_WIKI_ARGUMENT', `${name} 必须是 ${min}..${max} 的整数。`);
  return n;
}

export function tokenize(value) {
  const normalized = String(value).normalize('NFKC').toLowerCase();
  const result = new Set(normalized.match(/[a-z0-9_]+/g) ?? []);
  for (const run of normalized.match(/\p{Script=Han}+/gu) ?? []) {
    const chars = Array.from(run);
    if (chars.length === 1) result.add(chars[0]);
    else for (let i = 0; i + 1 < chars.length; i++) result.add(chars[i] + chars[i + 1]);
  }
  return result;
}

/** The Markdown is authoritative; metadata comments contain JSON, never executable code. */
export function parseGuide(markdown) {
  const normalized = markdown.replaceAll('\r\n', '\n');
  const blocks = normalized.split(/^<!-- wiki /m).slice(1);
  requireData((normalized.match(/<!--\s*wiki\b/g) ?? []).length === blocks.length, 'wiki 元数据标记格式错误。');
  requireData(blocks.length > 0, 'guide.md 没有知识条目。');
  return blocks.map(block => {
    const end = block.indexOf(' -->\n');
    requireData(end > 0, '无效的 wiki 元数据标记。');
    let metadata;
    try { metadata = JSON.parse(block.slice(0, end)); }
    catch { fail('WIKI_DATA_INVALID', '无效的 wiki 元数据 JSON。'); }
    requireData(metadata && typeof metadata === 'object' && !Array.isArray(metadata), '条目元数据必须为对象。');
    const body = block.slice(end + 5).trim();
    const title = body.match(/^## (.+)$/m)?.[1];
    requireData(!!title, `条目缺少标题：${metadata.id}`);
    const record = { ...metadata, title };
    for (const [key, heading] of Object.entries(SECTIONS)) {
      requireData((body.match(new RegExp(`^### ${heading}$`, 'gm')) ?? []).length === 1, `${metadata.id} 章节缺失或重复：${heading}`);
      const section = body.match(new RegExp(`^### ${heading}\\n([\\s\\S]*?)(?=^### |$(?![\\s\\S]))`, 'm'))?.[1]?.trim();
      requireData(!!section, `${metadata.id} 缺少章节：${heading}`);
      record[key] = ['goal', 'version_notes'].includes(key) ? section : section.split('\n').filter(Boolean).map(line => line.replace(/^(?:- |\d+\. )/, ''));
    }
    requireData(body.includes(`<a id="${record.id}"></a>`), `${record.id} 缺少稳定锚点。`);
    return record;
  });
}

export function validateCorpus(documents, registry) {
  requireData(registry?.schema_version === 1 && Array.isArray(registry.sources), '不支持的来源注册表格式。');
  requireData(typeof registry.revision === 'string' && registry.revision.trim(), '来源注册表缺少 revision。');
  const sources = new Map();
  for (const source of registry.sources) {
    requireData(/^S-[A-Z0-9-]+$/.test(source.id) && !sources.has(source.id), `来源 ID 非法或重复：${source.id}`);
    requireData(['official', 'community', 'repository'].includes(source.type), `来源类型无效：${source.id}`);
    requireData(['search-excerpt', 'section-reviewed', 'repository-file'].includes(source.review_depth), `阅读深度无效：${source.id}`);
    let url; try { url = new URL(source.url); } catch { /* validated below */ }
    requireData(url?.protocol === 'https:' && !url.username && !url.password, `来源必须为 HTTPS：${source.id}`);
    for (const key of ['title', 'reviewed_on', 'version_scope', 'notes']) requireData(typeof source[key] === 'string' && source[key].trim(), `来源 ${source.id} 缺少 ${key}`);
    requireData(/^\d{4}-\d{2}-\d{2}$/.test(source.reviewed_on) && Number.isFinite(Date.parse(source.reviewed_on)) && new Date(source.reviewed_on).toISOString().slice(0, 10) === source.reviewed_on, `来源日期非法：${source.id}`);
    sources.set(source.id, source);
  }
  const ids = new Set();
  for (const doc of documents) {
    requireData(KINDS.includes(doc.kind) && new RegExp(`^${doc.kind}-[a-z0-9-]+$`).test(doc.id) && !ids.has(doc.id), `条目 ID 非法或重复：${doc.id}`);
    ids.add(doc.id);
    for (const key of ['aliases', 'sources', 'related']) requireData(Array.isArray(doc[key]) && doc[key].every(x => typeof x === 'string' && x.trim()), `${doc.id}.${key} 必须为字符串数组。`);
    requireData(doc.aliases.length > 0 && doc.sources.length > 0, `${doc.id} 必须有别名和来源。`);
    for (const key of Object.keys(SECTIONS)) requireData(text(doc[key]).trim(), `${doc.id} 缺少 ${key}`);
    for (const key of ['prerequisites', 'steps', 'pitfalls', 'acceptance']) requireData(Array.isArray(doc[key]) && doc[key].length > 0, `${doc.id}.${key} 必须为非空数组。`);
    for (const source of doc.sources) requireData(sources.has(source), `${doc.id} 引用了未知来源 ${source}`);
    requireData(doc.runtime_tested === false && doc.coverage === 'curated-not-runtime-tested', `${doc.id} 不得无证据标记运行已验证。`);
  }
  for (const doc of documents) for (const id of doc.related) requireData(ids.has(id), `${doc.id} 引用了未知条目 ${id}`);
  return { documents, sources, registry };
}

export async function loadWiki() {
  try {
    const [guide, sourceText] = await Promise.all([readFile(new URL('guide.md', ROOT), 'utf8'), readFile(new URL('sources.json', ROOT), 'utf8')]);
    requireData(guide.length <= 2_000_000 && sourceText.length <= 1_000_000, '知识库超出允许大小。');
    return validateCorpus(parseGuide(guide), JSON.parse(sourceText));
  } catch (e) {
    if (e.code === 'WIKI_DATA_INVALID') throw e;
    fail('WIKI_DATA_INVALID', `无法读取随包知识库：${e.message}`);
  }
}

const WEIGHTS = { id: 7, title: 8, aliases: 10, goal: 4, prerequisites: 1, steps: 2, pitfalls: 4, acceptance: 1 };
export function searchWiki(query, documents, kind = 'all') {
  const q = query.normalize('NFKC').toLowerCase().trim();
  const terms = tokenize(q);
  const prepared = documents.map(doc => ({ doc, fields: Object.fromEntries(Object.keys(WEIGHTS).map(key => [key, tokenize(text(doc[key]))])) }));
  const frequency = new Map([...terms].map(term => [term, prepared.filter(({ fields }) => Object.values(fields).some(tokens => tokens.has(term))).length]));
  const hits = [];
  for (const { doc, fields } of prepared) {
    if (kind !== 'all' && doc.kind !== kind) continue;
    let score = 0;
    const matched = new Set();
    for (const [key, weight] of Object.entries(WEIGHTS)) for (const term of terms) if (fields[key].has(term)) {
      score += weight * (1 + Math.log((1 + documents.length) / (1 + frequency.get(term)))); matched.add(term);
    }
    for (const alias of [doc.id, doc.title, ...doc.aliases]) {
      const a = alias.normalize('NFKC').toLowerCase();
      if (a.length > 1 && q.includes(a)) score += 25 + 2 * Math.min(length(a), 16);
    }
    if (score > 0) hits.push({ doc, score: Math.round(score * 1000) / 1000, matched_terms: [...matched].sort(compare) });
  }
  return hits.sort((a, b) => b.score - a.score || compare(a.doc.id, b.doc.id));
}

function compact(doc, wiki) {
  return {
    id: doc.id, kind: doc.kind, title: doc.title, path: `docs/wiki/guide.md#${doc.id}`,
    next_step: doc.steps[0], acceptance: doc.acceptance.slice(0, 2),
    sources: doc.sources.map(id => ({ id, url: wiki.sources.get(id).url })),
    coverage: doc.coverage, runtime_tested: false,
  };
}

export async function dispatchWiki(command, value, options = {}, wiki) {
  if (!['search', 'show', 'sources', 'list', 'status', 'validate'].includes(command)) fail('INVALID_WIKI_ARGUMENT', `未知 wiki 命令：${command}`);
  const kind = options.kind ?? 'all';
  if (!['all', ...KINDS].includes(kind)) fail('INVALID_WIKI_ARGUMENT', 'kind 必须为 all、topic、recipe 或 workflow。');
  const limit = integer(options.limit, command === 'search' ? 5 : 20, 1, 100, 'limit');
  const offset = integer(options.offset, 0, 0, 1_000_000, 'offset');
  if (command === 'search' && (typeof value !== 'string' || !value.trim() || length(value) > 2000)) fail('INVALID_WIKI_ARGUMENT', '检索词须为 1..2000 个非空白 Unicode 字符。');
  if (options.section !== undefined && !Object.hasOwn(SECTIONS, options.section)) fail('INVALID_WIKI_ARGUMENT', `section 必须为 ${Object.keys(SECTIONS).join('、')}。`);
  wiki ??= await loadWiki();
  const base = { ok: true, command, budget_unit: 'unicode_code_points', truncated: false };
  const page = rows => ({ ...base, total: rows.length, offset, results: rows.slice(offset, offset + limit), next_offset: offset + limit < rows.length ? offset + limit : null });
  if (command === 'search') {
    const hits = searchWiki(value, wiki.documents, kind);
    return { ...page(hits.map(hit => ({ ...compact(hit.doc, wiki), score: hit.score, matched_terms: hit.matched_terms }))), query: value, hint: '加权关键词检索，不是语义推理；无匹配时换同义词，并查运行版本官方文档及实时工具 schema。' };
  }
  if (command === 'list') return page(wiki.documents.filter(d => kind === 'all' || d.kind === kind).map(d => ({ id: d.id, kind: d.kind, title: d.title })));
  if (command === 'sources') {
    if (value === undefined) return page([...wiki.sources.values()]);
    if (!wiki.sources.has(value)) fail('WIKI_NOT_FOUND', `来源不存在：${value}；使用 wiki sources 查看来源 ID。`);
    return { ...base, source: wiki.sources.get(value) };
  }
  if (command === 'show') {
    const doc = wiki.documents.find(d => d.id === value);
    if (!doc) fail('WIKI_NOT_FOUND', `条目不存在：${value}；使用 wiki search 或 wiki list。`);
    const sections = options.section ? { [options.section]: doc[options.section] } : Object.fromEntries(Object.keys(SECTIONS).map(key => [key, doc[key]]));
    return { ...base, entry: { ...compact(doc, wiki), aliases: doc.aliases, related: doc.related, ...sections } };
  }
  return { ...base, valid: true, entries: wiki.documents.length, kinds: Object.fromEntries(KINDS.map(k => [k, wiki.documents.filter(d => d.kind === k).length])), sources: wiki.sources.size, revision: wiki.registry.revision, runtime_tested: false, source_policy: '来源只记录复核信息，不是网页快照；版本提示不等于兼容性验收。' };
}

/** Bound the complete JSON including newline; never slice a JSON string or hide dropped rows. */
export function serializeWiki(payload, maxChars) {
  const budget = integer(maxChars, 12000, 1024, 100000, 'max-chars');
  const copy = structuredClone(payload);
  const encode = () => JSON.stringify(copy) + '\n';
  while (length(encode()) > budget && copy.results?.length) {
    copy.results.pop(); copy.truncated = true;
    copy.next_offset = copy.offset + copy.results.length;
  }
  if (Array.isArray(copy.results)) copy.returned = copy.results.length;
  // Adding returned can cross the boundary by a few characters.
  while (length(encode()) > budget && copy.results?.length) {
    copy.results.pop(); copy.returned = copy.results.length; copy.truncated = true;
    copy.next_offset = copy.offset + copy.results.length;
  }
  if (copy.truncated && copy.returned === 0) fail('INVALID_WIKI_BUDGET', '预算不足以返回一个完整条目；请增大 --max-chars。');
  if (length(encode()) > budget) fail('INVALID_WIKI_BUDGET', '预算不足；请增大 --max-chars，或用 show --section steps 按章节读取。');
  return encode();
}
