import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installSkills } from '../src/skills.mjs';
import { loadConfig, saveConfig } from '../src/core.mjs';
import { disableEntries } from '../src/integration.mjs';
import { metadata } from '../src/app.mjs';

test('skills are project local, idempotent, protect conflicts and honor dry-run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cli-skills-'));
  const path = join(root, '.agents', 'skills', metadata.id, 'SKILL.md');
  await installSkills(metadata, { target: root, dryRun: true });
  await assert.rejects(readFile(path), { code: 'ENOENT' });
  await installSkills(metadata, { target: root });
  assert.equal((await installSkills(metadata, { target: root })).skills[0].status, 'unchanged');
  await writeFile(path, 'customized');
  await assert.rejects(installSkills(metadata, { target: root, agent: 'all' }), { code: 'SKILL_CONFLICT' });
  await assert.rejects(readFile(join(root, '.claude', 'skills', metadata.id, 'SKILL.md')), { code: 'ENOENT' });
  await installSkills(metadata, { target: root, force: true });
  assert.match(await readFile(path, 'utf8'), /^---/);
});
test('skills reject junction/symlink escape', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cli-link-'));
  const outside = await mkdtemp(join(tmpdir(), 'cli-outside-'));
  await symlink(outside, join(root, '.agents'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installSkills(metadata, { target: root }), { code: 'UNSAFE_TARGET' });
});
test('configuration saves in explicit home and retains runtime overrides', async () => {
  const home = await mkdtemp(join(tmpdir(), 'cli-config-'));
  const config = await loadConfig(metadata, { home, appPath: 'test' });
  await saveConfig(config);
  assert.equal((await loadConfig(metadata, { home })).appPath, 'test');
  assert.equal((await loadConfig(metadata, { home, appPath: 'override' })).appPath, 'override');
  await assert.rejects(loadConfig(metadata, { home, host: '0.0.0.0' }), { code: 'INVALID_HOST' });
});
test('Codex migration changes only named server table and is idempotent', () => {
  const source = '# test\r\n[mcp_servers."DaVinci Resolve"]\r\ncommand = "ResolveMCP"\r\n\r\n[mcp_servers.blender]\r\nenabled = true\r\ncommand = "uvx"\r\n[mcp_servers.blender.env]\r\nPORT = "9876"\r\n';
  const result = disableEntries(source, ['DaVinci Resolve']);
  assert.match(result.text, /Resolve"\]\r\nenabled = false/);
  assert.ok(result.text.endsWith(source.slice(source.indexOf('[mcp_servers.blender]'))));
  assert.equal(disableEntries(result.text, ['DaVinci Resolve']).text, result.text);
  assert.equal(disableEntries(source, ['absent']).text, source);
});
