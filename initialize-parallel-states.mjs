#!/usr/bin/env node
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const source = JSON.parse(await readFile(join(root, 'state.json'), 'utf8'));
const platforms = ['ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects'];
const reservations = Object.fromEntries(Object.entries(source.repositories).map(([repo, entry]) => [repo, { platform: entry.platform, target: entry.target, discoveredFrom: entry.discoveredFrom, status: entry.status, reservedAt: entry.firstSeenAt, finishedAt: entry.finishedAt }]));
async function save(path, data) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2));
  await rename(temporary, path);
}
await save(join(root, 'clone-reservations.json'), reservations);
for (const platform of platforms) {
  const repositories = Object.fromEntries(Object.entries(source.repositories).filter(([, entry]) => entry.platform === platform));
  await save(join(root, `state-${platform}.json`), { version: 2, createdAt: new Date().toISOString(), queue: [], seenPages: {}, repositories, events: [] });
}
console.log(JSON.stringify({ reservations: Object.keys(reservations).length, platforms }, null, 2));
