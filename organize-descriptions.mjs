#!/usr/bin/env node
// Classifies generated repository descriptions beside their source platform.
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const root = process.cwd();
const state = JSON.parse(await readFile(join(root, 'state.json'), 'utf8'));
const descriptions = join(root, 'descriptions');
for (const platform of ['ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects', 'github-discovery']) {
  await mkdir(join(descriptions, platform), { recursive: true });
}
let moved = 0, alreadyPlaced = 0, unmatched = 0;
for (const entry of Object.values(state.repositories)) {
  if (!entry.target || !entry.platform) continue;
  const name = basename(entry.target);
  const source = join(descriptions, `${name}.md`);
  const targetDirectory = join(descriptions, entry.platform);
  const target = join(targetDirectory, `${name}.md`);
  if (existsSync(target)) { alreadyPlaced += 1; continue; }
  if (!existsSync(source)) { unmatched += 1; continue; }
  await mkdir(targetDirectory, { recursive: true });
  let content = await readFile(source, 'utf8');
  content = content.replaceAll(`repositories/${name}`, `repositories/${entry.platform}/${name}`);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, target);
  // Remove only the known source file after its verified rename has succeeded.
  await (await import('node:fs/promises')).rm(source);
  moved += 1;
}
const rootFiles = (await readdir(descriptions, { withFileTypes: true })).filter(item => item.isFile() && item.name.endsWith('.md')).length;
console.log(JSON.stringify({ moved, alreadyPlaced, unmatched, rootFiles }, null, 2));
