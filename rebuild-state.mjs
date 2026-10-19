#!/usr/bin/env node
/**
 * Reconstructs collection state from local Git worktrees after interruption.
 * It never deletes repositories; incomplete directories are recorded separately.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const repoRoot = join(root, 'repositories');
const platforms = ['ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects', 'github-discovery'];

const runGit = (directory, args) => new Promise(resolve => {
  const child = spawn('git', ['-C', directory, ...args], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.on('close', code => resolve(code === 0 ? output.trim() : null));
  child.on('error', () => resolve(null));
});
const canonical = raw => {
  if (!raw) return null;
  let value = raw.trim().replace(/^git\+/, '').replace(/^git@([^:]+):/, 'https://$1/');
  try {
    const url = new URL(value);
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/');
    return parts.length >= 2 ? `https://${url.hostname.toLowerCase().replace(/^www\./, '')}/${parts[0]}/${parts[1]}`.toLowerCase() : null;
  } catch { return null; }
};
const save = async (path, value) => {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, path);
};

const all = {};
const results = [];
for (const platform of platforms) {
  const parent = join(repoRoot, platform);
  const repositories = {};
  let usable = 0, incomplete = 0;
  if (existsSync(parent)) {
    for (const item of await readdir(parent, { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      const directory = join(parent, item.name);
      const remote = await runGit(directory, ['remote', 'get-url', 'origin']);
      const head = await runGit(directory, ['rev-parse', '--verify', 'HEAD']);
      const repo = canonical(remote);
      if (!repo) { incomplete += 1; continue; }
      const status = head ? 'cloned' : 'interrupted';
      repositories[repo] = {
        firstSeenAt: new Date().toISOString(),
        discoveredFrom: 'rebuild:local-worktree',
        platform,
        target: directory,
        status,
        commit: head ?? undefined,
        rebuiltAt: new Date().toISOString()
      };
      all[repo] = repositories[repo];
      if (head) usable += 1; else incomplete += 1;
    }
  }
  if (platform !== 'github-discovery') {
    await save(join(root, `state-${platform}.json`), { version: 3, rebuiltAt: new Date().toISOString(), queue: [], seenPages: {}, repositories, events: [{ at: new Date().toISOString(), kind: 'state_rebuilt', usable, incomplete }] });
  }
  results.push({ platform, usable, incomplete, entries: Object.keys(repositories).length });
}
await save(join(root, 'clone-reservations.json'), Object.fromEntries(Object.entries(all).map(([repo, entry]) => [repo, { platform: entry.platform, target: entry.target, status: entry.status, rebuiltAt: entry.rebuiltAt }])));
await save(join(root, 'state.json'), { version: 3, rebuiltAt: new Date().toISOString(), queue: [], seenPages: {}, repositories: all, events: [{ at: new Date().toISOString(), kind: 'global_state_rebuilt' }] });
console.log(JSON.stringify({ results, uniqueRepositories: Object.keys(all).length }, null, 2));
