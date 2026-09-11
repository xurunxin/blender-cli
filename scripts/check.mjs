import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const name of await readdir('src')) if (name.endsWith('.mjs')) {
  const result = spawnSync(process.execPath, ['--check', `src/${name}`], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
const skill = await readFile(`skills/${metadata.name.split('/').at(-1)}/SKILL.md`, 'utf8');
if (!/^---\r?\nname: [a-z0-9-]+\r?\ndescription: .+\r?\n---/.test(skill)) throw new Error('Invalid skill frontmatter');
console.log('Syntax and skill checks passed');
