/** Pack/unpack in a temporary directory and query the actual shipped files. No install/network. */
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'blender-wiki-pack-'));
function execute(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60000, shell: false });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}
try {
  // npm_execpath is supplied by npm run on all supported platforms; direct node invocation resolves npm via PATH.
  let packed;
  if (process.env.npm_execpath) packed = execute(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts', '--json', '--pack-destination', temp], root);
  else if (process.platform === 'win32') throw new Error('Windows: run npm run test:wiki:package so npm_execpath is available.');
  else packed = execute('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temp], root);
  const pack = JSON.parse(packed)[0];
  for (const path of ['docs/wiki/guide.md', 'docs/wiki/sources.json', 'docs/wiki/README.md', 'docs/wiki/examples/inspect_scene.py', 'skills/blender-cli/SKILL.md', 'src/wiki.mjs', 'src/wiki-cli.mjs'])
    assert.ok(pack.files.some(f => f.path === path), `Missing package file: ${path}`);
  const unpack = join(temp, 'unpacked'); await mkdir(unpack);
  execute('tar', ['-xzf', join(temp, pack.filename), '-C', unpack], temp);
  const entry = join(unpack, 'package', 'src', 'wiki-cli.mjs');
  const result = JSON.parse(execute(process.execPath, [entry, 'search', '布料穿透', '--kind', 'recipe', '--limit', '1'], temp));
  assert.equal(result.results[0].id, 'recipe-cloth-penetration');
  assert.match(await readFile(join(unpack, 'package', 'skills', 'blender-cli', 'SKILL.md'), 'utf8'), /wiki search/);
  console.log(JSON.stringify({ ok: true, packed_wiki_query: true, dependencies_installed: false, native_cli_tested: false }));
} finally { await rm(temp, { recursive: true, force: true }); }
