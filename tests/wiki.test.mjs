import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { KINDS, SECTIONS, tokenize, parseGuide, validateCorpus, loadWiki, searchWiki, dispatchWiki, serializeWiki } from '../src/wiki.mjs';

const wiki = await loadWiki();
const guide = await readFile(new URL('../docs/wiki/guide.md', import.meta.url), 'utf8');
const cli = fileURLToPath(new URL('../src/wiki-cli.mjs', import.meta.url));
const run = (args, options = {}) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000, ...options });

test('corpus has topic, recipe and workflow coverage and all sources resolve', () => {
  assert.ok(wiki.documents.length >= 40);
  for (const kind of KINDS) assert.ok(wiki.documents.some(d => d.kind === kind));
  assert.ok([...wiki.sources.values()].some(s => s.type === 'official'));
  assert.ok([...wiki.sources.values()].some(s => s.type === 'community'));
  for (const doc of wiki.documents) {
    assert.equal(doc.runtime_tested, false);
    assert.ok(doc.steps.length >= 3);
    assert.ok(doc.acceptance.length >= 2);
    for (const source of doc.sources) assert.ok(wiki.sources.has(source));
  }
});
test('CRLF and LF guides parse identically', () => assert.deepEqual(parseGuide(guide.replaceAll('\n', '\r\n')), parseGuide(guide)));
test('tokenizer normalizes fullwidth English and supports Chinese bigrams', () => {
  assert.deepEqual([...tokenize('ＧＬＴＦ 布料穿透')], ['gltf', '布料', '料穿', '穿透']);
});
for (const [query, expected] of [
  ['布料穿透', 'recipe-cloth-penetration'], ['operator poll failed', 'recipe-context'],
  ['No active image', 'recipe-bake-target'], ['贴图丢失', 'recipe-missing-texture'],
  ['烘焙全黑', 'recipe-bake-black'], ['gltf missing material', 'recipe-gltf-material'],
  ['UV拉伸', 'recipe-uv-stretch'], ['关键帧不动', 'recipe-animation-still'],
  ['导出比例', 'recipe-export-scale'], ['序列缺帧', 'recipe-frame-range'],
  ['工具超时', 'recipe-timeout'], ['EXR太暗', 'recipe-color-mismatch'],
  ['field domain', 'recipe-field-domain'], ['散布方向', 'recipe-scatter-direction'],
  ['实例内存', 'recipe-realize-memory'], ['模拟跳帧', 'recipe-simulation-cache'],
]) test(`retrieval: ${query}`, () => assert.equal(searchWiki(query, wiki.documents, 'recipe')[0]?.doc.id, expected));
test('workflow aliases reach the intended workflow', () => {
  assert.equal(searchWiki('游戏模型', wiki.documents, 'workflow')[0].doc.id, 'workflow-game-asset');
});
test('unknown terms return no fabricated answer', async () => {
  const result = await dispatchWiki('search', 'zzzxxyy998877', {}, wiki);
  assert.equal(result.total, 0); assert.deepEqual(result.results, []);
});
test('ranking is independent of source array order for score ties', () => {
  const project = docs => searchWiki('render', docs).map(x => [x.doc.id, x.score]);
  assert.deepEqual(project(wiki.documents), project([...wiki.documents].reverse()));
});
test('search output carries provenance, next action and acceptance', async () => {
  const result = await dispatchWiki('search', '布料穿透', { limit: '1' }, wiki);
  const hit = result.results[0];
  assert.ok(hit.next_step); assert.ok(hit.acceptance.length); assert.ok(hit.sources[0].url.startsWith('https://'));
  assert.equal(hit.runtime_tested, false);
});
test('show sections are selectively retrieved and related IDs resolve', async () => {
  const payload = await dispatchWiki('show', 'workflow-game-asset', { section: 'steps' }, wiki);
  assert.ok(payload.entry.steps.length >= 3); assert.equal(payload.entry.goal, undefined);
  for (const id of payload.entry.related) assert.ok(wiki.documents.some(d => d.id === id));
});
test('show returns every required section by default', async () => {
  const { entry } = await dispatchWiki('show', 'topic-agent', {}, wiki);
  for (const section of Object.keys(SECTIONS)) assert.ok(entry[section]);
});
test('pagination covers the catalog without duplicates', async () => {
  let offset = 0; const ids = [];
  do {
    const page = await dispatchWiki('list', undefined, { offset, limit: 7 }, wiki);
    ids.push(...page.results.map(d => d.id)); offset = page.next_offset;
  } while (offset !== null);
  assert.equal(ids.length, wiki.documents.length); assert.equal(new Set(ids).size, ids.length);
});
test('sources can be read individually and paginated', async () => {
  const item = await dispatchWiki('sources', 'S-GLTF', {}, wiki);
  assert.equal(item.source.review_depth, 'search-excerpt');
  const page = await dispatchWiki('sources', undefined, { limit: 2 }, wiki);
  assert.equal(page.results.length, 2); assert.equal(page.next_offset, 2);
});
test('JSON budget includes the newline and is measured in Unicode code points', async () => {
  const payload = await dispatchWiki('search', '材质', { limit: 100 }, wiki);
  const original = structuredClone(payload);
  const encoded = serializeWiki(payload, 1600);
  assert.ok(Array.from(encoded).length <= 1600);
  const result = JSON.parse(encoded);
  assert.equal(result.truncated, true); assert.ok(result.returned > 0);
  assert.equal(result.next_offset, result.offset + result.returned);
  assert.deepEqual(payload, original);
  assert.ok(Array.from(serializeWiki({ ok: true, note: '😀'.repeat(800) }, 1024)).length <= 1024);
});
test('show budget does not silently drop instructions', async () => {
  const payload = await dispatchWiki('show', 'workflow-product-shot', {}, wiki);
  assert.throws(() => serializeWiki(payload, 1024), { code: 'INVALID_WIKI_BUDGET' });
});
test('budget too small for one result gives explicit error, not a stuck cursor', () => {
  const payload = { ok: true, offset: 0, total: 1, results: [{ text: 'x'.repeat(3000) }], truncated: false };
  assert.throws(() => serializeWiki(payload, 1024), { code: 'INVALID_WIKI_BUDGET' });
});
for (const options of [{ limit: 0 }, { limit: '3foo' }, { limit: 101 }, { offset: -1 }, { offset: 1.2 }, { kind: 'magic' }, { section: 'constructor' }])
  test(`invalid options: ${JSON.stringify(options)}`, async () => assert.rejects(dispatchWiki('search', '材质', options, wiki), { code: 'INVALID_WIKI_ARGUMENT' }));
for (const query of ['', '   ', 'a'.repeat(2001)]) test(`invalid query length ${query.length}`, async () => assert.rejects(dispatchWiki('search', query, {}, wiki), { code: 'INVALID_WIKI_ARGUMENT' }));
for (const id of ['../../package.json', '/etc/passwd', 'https://example.com', 'constructor'])
  test(`show treats ${id} as an ID, not a path`, async () => assert.rejects(dispatchWiki('show', id, {}, wiki), { code: 'WIKI_NOT_FOUND' }));
test('validator rejects duplicate IDs, unknown sources, unknown related IDs and unsupported runtime claims', () => {
  for (const mutation of [
    docs => docs.push(structuredClone(docs[0])),
    docs => docs[0].sources.push('S-UNKNOWN'),
    docs => docs[0].related.push('topic-unknown'),
    docs => docs[0].runtime_tested = true,
  ]) {
    const docs = structuredClone(wiki.documents); mutation(docs);
    assert.throws(() => validateCorpus(docs, wiki.registry), { code: 'WIKI_DATA_INVALID' });
  }
});
test('parser rejects missing sections, missing anchors and invalid JSON', () => {
  for (const bad of [guide.replace('### 验收', '### 改坏'), guide.replace('<a id="topic-agent"></a>', ''), guide.replace('"id":"topic-agent"', 'INVALID')])
    assert.throws(() => parseGuide(bad), { code: 'WIKI_DATA_INVALID' });
});
test('registry rejects insecure source URLs and invalid review depths', () => {
  for (const mutation of [r => r.sources[0].url = 'file:///tmp/x', r => r.sources[0].url = 'https://user:pass@example.com', r => r.sources[0].review_depth = 'assumed']) {
    const registry = structuredClone(wiki.registry); mutation(registry);
    assert.throws(() => validateCorpus(wiki.documents, registry), { code: 'WIKI_DATA_INVALID' });
  }
});
test('standalone command works from another CWD and writes no home/config files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'blender-wiki-'));
  try {
    const result = run(['search', '布料穿透', '--limit', '1'], { cwd: dir, env: { ...process.env, BLENDER_CLI_HOME: join(dir, 'forbidden-home'), HOME: dir, USERPROFILE: dir } });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, '');
    assert.equal(JSON.parse(result.stdout).results[0].id, 'recipe-cloth-penetration');
    assert.deepEqual(await readdir(dir), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
for (const args of [['search'], ['list', 'extra'], ['list', '--section', 'steps'], ['search', 'x', '--limit', '0'], ['search', 'x', '--unknown'], ['show', 'topic-agent', '--max-chars', '1']])
  test(`CLI rejects invalid arguments: ${args.join(' ')}`, () => { const result = run(args); assert.equal(result.status, 2); assert.equal(JSON.parse(result.stdout).ok, false); });
test('unknown IDs use exit code 1 with JSON stdout', () => {
  const result = run(['show', 'not-real']); assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).error.code, 'WIKI_NOT_FOUND');
});
test('standalone help works without runtime dependencies', () => { const result = run(['--help']); assert.equal(result.status, 0); assert.match(result.stdout, /max-chars/); });
test('native CLI registration remains additive and import graph is dependency-free', async () => {
  const native = await readFile(new URL('../src/cli.mjs', import.meta.url), 'utf8');
  assert.match(native, /registerWikiCommands\(program\)/);
  for (const path of ['../src/wiki.mjs', '../src/wiki-cli.mjs']) {
    const code = await readFile(new URL(path, import.meta.url), 'utf8');
    const imports = [...code.matchAll(/from ['"]([^'"]+)['"]/g)].map(m => m[1]);
    assert.ok(imports.every(p => p.startsWith('node:') || p === './wiki.mjs'));
  }
});

test('malformed metadata marker cannot silently remove a record', () => {
  assert.throws(() => parseGuide(guide.replace('<!-- wiki ', '<!--wiki ')), { code: 'WIKI_DATA_INVALID' });
});
test('duplicate required sections are rejected', () => {
  assert.throws(() => parseGuide(guide.replace('### 目标', '### 目标\n旧目标\n### 目标')), { code: 'WIKI_DATA_INVALID' });
});
test('registry rejects impossible review dates', () => {
  const registry = structuredClone(wiki.registry); registry.sources[0].reviewed_on = '2026-02-31';
  assert.throws(() => validateCorpus(wiki.documents, registry), { code: 'WIKI_DATA_INVALID' });
});
test('prototype-named commands are invalid arguments', () => {
  const result = run(['constructor', '--limit', '2']); assert.equal(result.status, 2);
});
