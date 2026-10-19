#!/usr/bin/env node
// Moves only collector-owned directories after validating they remain beneath
// this workspace. It also updates durable state and generated descriptions.
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const repoRoot = resolve(root, 'repositories');
const statePath = join(root, 'state.json');
const descriptionRoot = join(root, 'descriptions');
const catalogPath = join(root, 'REPOSITORY_DESCRIPTIONS.md');
const hostPlatforms = new Map([
  ['ethglobal.com', 'ethglobal'],
  ['blitz.devnads.com', 'blitz'],
  ['devfolio.co', 'devfolio'],
  ['www.hackquest.io', 'hackquest'],
  ['hackquest.io', 'hackquest'],
  ['dorahacks.io', 'dorahacks'],
  ['www.dorahacks.io', 'dorahacks'],
  ['hackathonprojects.dev', 'hackathonprojects'],
  ['www.hackathonprojects.dev', 'hackathonprojects']
]);
const allPlatforms = [...new Set([...hostPlatforms.values(), 'github-discovery'])];
const insideRepoRoot = path => {
  const rel = relative(repoRoot, resolve(path));
  return rel && !rel.startsWith('..' + sep) && rel !== '..' && !rel.startsWith('..' + '/') && !resolve(path).includes(sep + '..' + sep);
};
const platformFor = source => {
  try { return hostPlatforms.get(new URL(source).hostname) ?? 'github-discovery'; }
  catch { return 'github-discovery'; }
};
const save = async (path, content) => {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, path);
};

const state = JSON.parse(await readFile(statePath, 'utf8'));
for (const platform of allPlatforms) await mkdir(join(repoRoot, platform), { recursive: true });
let moved = 0, alreadyPlaced = 0, missing = 0;
for (const entry of Object.values(state.repositories)) {
  if (!entry.target) continue;
  const platform = platformFor(entry.discoveredFrom);
  const name = basename(entry.target);
  const current = resolve(entry.target);
  const destination = resolve(repoRoot, platform, name);
  if (!insideRepoRoot(current) || basename(current) !== name || name === '.' || name === '..' || name.includes('/') || name.includes('\\\\')) {
    throw new Error(`Unsafe collector target refused: ${entry.target}`);
  }
  if (current === destination) { alreadyPlaced += 1; entry.platform = platform; continue; }
  if (existsSync(destination)) {
    if (existsSync(current)) throw new Error(`Destination collision: ${destination}`);
    alreadyPlaced += 1;
  } else if (existsSync(current)) {
    await rename(current, destination);
    moved += 1;
  } else {
    missing += 1;
  }
  entry.platform = platform;
  entry.target = destination;
  const descriptionPath = join(descriptionRoot, `${name}.md`);
  if (existsSync(descriptionPath)) {
    const oldRelative = `repositories/${name}`;
    const newRelative = `repositories/${platform}/${name}`;
    const content = await readFile(descriptionPath, 'utf8');
    await save(descriptionPath, content.replaceAll(oldRelative, newRelative));
  }
}
if (existsSync(catalogPath)) {
  let catalog = await readFile(catalogPath, 'utf8');
  for (const entry of Object.values(state.repositories)) {
    if (!entry.target || !entry.platform) continue;
    const name = basename(entry.target);
    catalog = catalog.replaceAll(`\`${name}\``, `\`${entry.platform}/${name}\``);
  }
  await save(catalogPath, catalog);
}
await save(statePath, JSON.stringify(state, null, 2));
console.log(JSON.stringify({ moved, alreadyPlaced, missing, platforms: Object.fromEntries(await Promise.all(allPlatforms.map(async platform => [platform, (await readdir(join(repoRoot, platform))).length]))) }, null, 2));
