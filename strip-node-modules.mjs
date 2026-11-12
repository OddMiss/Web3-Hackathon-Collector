#!/usr/bin/env node
/**
 * Concurrently removes node_modules directories from local source snapshots.
 * The target is intentionally fixed to <workspace>/repositories so this tool
 * cannot be pointed at an arbitrary directory by a command-line argument.
 */
import { readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(process.cwd(), 'repositories');
const requestedConcurrency = Number(process.argv.find(arg => arg.startsWith('--concurrency='))?.split('=')[1] ?? 16);
const dryRun = process.argv.includes('--dry-run');
const concurrency = Number.isInteger(requestedConcurrency) && requestedConcurrency > 0
  ? Math.min(requestedConcurrency, 64)
  : 16;

if (!existsSync(repositoryRoot)) throw new Error(`Repository directory not found: ${repositoryRoot}`);

const initialEntries = await readdir(repositoryRoot, { withFileTypes: true });
const queue = initialEntries.filter(entry => entry.isDirectory()).map(entry => join(repositoryRoot, entry.name));
let active = 0;
let removed = 0;
let found = 0;
let errors = 0;

const pause = () => new Promise(resolve => setTimeout(resolve, 20));
async function worker() {
  for (;;) {
    const directory = queue.pop();
    if (!directory) {
      if (active === 0 && queue.length === 0) return;
      await pause();
      continue;
    }
    active++;
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = join(directory, entry.name);
        if (entry.name === 'node_modules') {
          found++;
          if (dryRun) continue;
          try {
            await rm(entryPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
            removed++;
          } catch {
            errors++;
          }
          continue;
        }
        if (entry.isDirectory() && entry.name !== '.git') queue.push(entryPath);
      }
    } catch {
      errors++;
    } finally {
      active--;
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
console.log(JSON.stringify({ repositoryRoot, concurrency, dryRun, found, removed, errors }, null, 2));
