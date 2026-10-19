#!/usr/bin/env node
/**
 * Resumable crawler for public hackathon project galleries.
 *
 * Usage:
 *   node crawl-and-clone.mjs --max-pages 100
 *   node crawl-and-clone.mjs --max-pages 1000 --delay-ms 900
 *
 * State is intentionally local and durable.  Re-running never re-clones a
 * repository whose canonical repository URL is already in state.json.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile, open } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const statePath = join(root, optionsFromArgs(process.argv)['state-file'] ?? 'state.json');
const repoRoot = join(root, 'repositories');
const descriptionRoot = join(root, 'descriptions');
const lockPath = `${statePath}.lock`;
function optionsFromArgs(args) { return Object.fromEntries(args.slice(2).filter(x => x.startsWith('--')).map(x => {
  const [key, value = 'true'] = x.slice(2).split('=');
  return [key, value];
})); }
const options = optionsFromArgs(process.argv);
const reservationPath = join(root, 'clone-reservations.json');
const reservationLockPath = join(root, '.clone-reservations.lock');
const maxPages = Number(options['max-pages'] ?? 100);
const delayMs = Number(options['delay-ms'] ?? 800);
const targetRepos = Number(options['target-repos'] ?? Number.POSITIVE_INFINITY);
const requestedPlatform = options.platform;
const targetPlatforms = new Set(['ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects']);
if (requestedPlatform && !targetPlatforms.has(requestedPlatform)) throw new Error(`Unknown platform: ${requestedPlatform}`);

// Only public directory pages are seeded. No credentials, forms, or APIs are used.
const genericSeeds = [
  'https://ethglobal.com/showcase',
  'https://blitz.devnads.com/showcase',
  'https://devfolio.co/search?primary_filter=hackathons',
  'https://www.hackquest.io/projects',
  'https://dorahacks.io/hackathon',
  'https://hackathonprojects.dev/',
  // GitHub's public repository search complements gallery links with a broad,
  // explicitly hackathon-related set across ecosystems and application areas.
  ...[
    'ETHGlobal in:readme', 'DoraHacks in:readme', 'Devfolio in:readme', 'HackQuest in:readme',
    '"web3 hackathon" in:readme', 'ethereum hackathon in:readme', 'solidity hackathon in:readme',
    '"zero knowledge" hackathon in:readme', 'decentralized hackathon in:readme', 'DeFi hackathon in:readme',
    'NFT hackathon in:readme', 'DAO hackathon in:readme', 'privacy hackathon in:readme',
    'AI web3 hackathon in:readme', 'ETHDenver in:readme', 'Encode Club hackathon in:readme',
    'Chainlink hackathon in:readme', 'Solana hackathon in:readme', 'Polygon hackathon in:readme',
    // ETHGlobal's individual events and ecosystem-specific Hackathons improve
    // coverage beyond the largest generic keywords.
    'ETHGlobal Tokyo in:readme', 'ETHGlobal Bangkok in:readme', 'ETHGlobal Brussels in:readme',
    'ETHGlobal New York in:readme', 'ETHGlobal Paris in:readme', 'ETHGlobal London in:readme',
    'ETHGlobal Prague in:readme', 'ETHGlobal Singapore in:readme', 'Starknet hackathon in:readme',
    'Aptos hackathon in:readme', 'Sui hackathon in:readme', 'NEAR hackathon in:readme',
    'Filecoin hackathon in:readme', 'Arweave hackathon in:readme', 'Polkadot hackathon in:readme',
    'Cosmos hackathon in:readme', 'Avalanche hackathon in:readme', 'Base hackathon in:readme',
    'Optimism hackathon in:readme', 'Ethereum India hackathon in:readme',
    'Africa blockchain hackathon in:readme', 'LATAM web3 hackathon in:readme'
  ].map(query => `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=100&sort=updated`)
];
const platformQueries = {
  ethglobal: ['ETHGlobal in:readme', 'ETHGlobal Tokyo in:readme', 'ETHGlobal Bangkok in:readme', 'ETHGlobal Brussels in:readme', 'ETHGlobal New York in:readme', 'ETHGlobal Paris in:readme', 'ETHGlobal London in:readme', 'ETHGlobal Prague in:readme'],
  blitz: ['"blitz.devnads" in:readme', 'Monad hackathon in:readme', 'Monad Madness in:readme', 'Monad ecosystem hackathon in:readme', 'evm accathon Monad in:readme'],
  devfolio: ['Devfolio in:readme', '"devfolio.co" in:readme', 'India web3 hackathon in:readme', 'India blockchain hackathon in:readme', 'ETHIndia in:readme'],
  hackquest: ['HackQuest in:readme', '"hackquest.io" in:readme', 'HackQuest hackathon in:readme', 'Web3 hackathon course in:readme'],
  dorahacks: ['DoraHacks in:readme', '"dorahacks.io" in:readme', 'BUIDL hackathon in:readme', 'Dora Factory hackathon in:readme', 'Dorahacks grant hackathon in:readme'],
  hackathonprojects: ['"web3 hackathon" in:readme', 'ETHOnline in:readme', 'Scaffold-ETH hackathon in:readme', 'ethereum hackathon in:readme', 'solidity hackathon in:readme', 'DeFi hackathon in:readme', 'NFT hackathon in:readme', 'DAO hackathon in:readme', 'privacy hackathon in:readme', 'AI web3 hackathon in:readme']
};
const gallerySeed = {
  ethglobal: 'https://ethglobal.com/showcase', blitz: 'https://blitz.devnads.com/api/showcase?limit=100&offset=0', devfolio: 'https://devfolio.co/search?primary_filter=hackathons',
  hackquest: 'https://www.hackquest.io/projects', dorahacks: 'https://dorahacks.io/hackathon', hackathonprojects: 'https://hackathonprojects.dev/'
};
const seeds = requestedPlatform
  ? [gallerySeed[requestedPlatform], ...platformQueries[requestedPlatform].flatMap(query => Array.from({ length: 10 }, (_, index) => `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=100&page=${index + 1}&sort=updated`))]
  : genericSeeds;
const allowedHosts = new Set(seeds.map(url => new URL(url).hostname));
const codeHosts = new Set(['github.com', 'www.github.com', 'gitlab.com', 'www.gitlab.com', 'bitbucket.org', 'www.bitbucket.org', 'codeberg.org', 'www.codeberg.org']);
const skipPath = /\/(login|signin|signup|register|privacy|terms|blog|docs|about|careers|jobs|settings|api|assets|_next|static)(\/|$)/i;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function freshState() {
  return { version: 1, createdAt: new Date().toISOString(), queue: seeds.map(url => ({ url, source: requestedPlatform ?? new URL(url).hostname, platform: requestedPlatform })), seenPages: {}, repositories: {}, events: [] };
}
async function loadState() {
  if (!existsSync(statePath)) return freshState();
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  // A platform run must not consume a mixed/older queue and mislabel those
  // candidates. They remain in the durable repository index; fresh seeds for
  // the selected platform are appended below.
  if (requestedPlatform) state.queue = state.queue.filter(item => item.platform === requestedPlatform || item.source === requestedPlatform);
  // New source families added in later versions join existing collections
  // without re-queuing pages that were already seen.
  for (const url of seeds) {
    const isPlatformEntry = requestedPlatform && url === gallerySeed[requestedPlatform];
    if ((isPlatformEntry || !state.seenPages[url]) && !state.queue.some(item => item.url === url)) state.queue.push({ url, source: requestedPlatform ?? new URL(url).hostname, platform: requestedPlatform });
  }
  // A machine may stop while git is finishing.  Do not mistake a partly-created
  // .git directory for a usable checkout; flag it clearly for manual review.
  for (const entry of Object.values(state.repositories)) {
    if (entry.status !== 'pending') continue;
    entry.status = 'interrupted'; entry.finishedAt = new Date().toISOString(); entry.error = 'clone process did not finish';
  }
  return state;
}
function clonedCount(state) {
  return Object.values(state.repositories).filter(entry => entry.status === 'cloned').length;
}
function cloneCountForPlatform(state, platform) {
  return Object.values(state.repositories).filter(entry => entry.status === 'cloned' && entry.platform === platform).length;
}
async function saveState(state) {
  const temporary = `${statePath}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2));
  await rename(temporary, statePath);
}
async function reserveRepository(repo, metadata) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    let handle;
    try { handle = await open(reservationLockPath, 'wx'); }
    catch { await sleep(200); continue; }
    try {
      const reservations = existsSync(reservationPath) ? JSON.parse(await readFile(reservationPath, 'utf8')) : {};
      if (reservations[repo]) return false;
      reservations[repo] = { ...metadata, reservedAt: new Date().toISOString(), status: 'pending' };
      const temporary = `${reservationPath}.tmp`;
      await writeFile(temporary, JSON.stringify(reservations, null, 2));
      await rename(temporary, reservationPath);
      return true;
    } finally {
      await handle.close();
      await rm(reservationLockPath, { force: true });
    }
  }
  throw new Error(`Timed out waiting to reserve ${repo}`);
}
async function finaliseReservation(repo, status, error) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    let handle;
    try { handle = await open(reservationLockPath, 'wx'); }
    catch { await sleep(200); continue; }
    try {
      const reservations = JSON.parse(await readFile(reservationPath, 'utf8'));
      if (reservations[repo]) reservations[repo] = { ...reservations[repo], status, finishedAt: new Date().toISOString(), error: error || undefined };
      const temporary = `${reservationPath}.tmp`;
      await writeFile(temporary, JSON.stringify(reservations, null, 2));
      await rename(temporary, reservationPath);
      return;
    } finally {
      await handle.close();
      await rm(reservationLockPath, { force: true });
    }
  }
}
function note(state, kind, detail) {
  state.events.push({ at: new Date().toISOString(), kind, ...detail });
  if (state.events.length > 5000) state.events.splice(0, state.events.length - 5000);
}
function canonicalRepo(raw) {
  let value = raw.trim().replace(/^git\+/, '');
  value = value.replace(/^git@([^:]+):/, 'https://$1/');
  let url;
  try { url = new URL(value); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!codeHosts.has(url.hostname.toLowerCase()) && !codeHosts.has(host)) return null;
  const pieces = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/');
  if (pieces.length < 2) return null;
  // GitHub/GitLab project URLs may include a subpage; their first two path parts identify the repo.
  return `https://${host}/${pieces[0]}/${pieces[1]}`.toLowerCase();
}
function pageLinks(html, base) {
  const links = new Set();
  for (const match of html.matchAll(/(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(match[1], base);
      if (url.protocol === 'http:' || url.protocol === 'https:') links.add(url.href.split('#')[0]);
    } catch { /* malformed link */ }
  }
  // Some galleries serialize URLs in JSON rather than anchor elements.
  for (const match of html.matchAll(/https?:\\?\/\\?\/[^"'<>\\\s]+/gi)) {
    try { links.add(new URL(match[0].replace(/\\\//g, '/')).href.split('#')[0]); } catch { /* ignored */ }
  }
  return links;
}
function isProjectPage(url) {
  const path = new URL(url).pathname;
  return /\/(project|projects|showcase|submission|submissions|build|buidl|hackathon)/i.test(path);
}
function enqueue(state, url, source) {
  const parsed = new URL(url);
  parsed.hash = '';
  const normalized = parsed.href;
  const isBlitzShowcaseApi = parsed.hostname === 'blitz.devnads.com' && parsed.pathname === '/api/showcase';
  if (!allowedHosts.has(parsed.hostname) || (!isBlitzShowcaseApi && skipPath.test(parsed.pathname)) || state.seenPages[normalized] || state.queue.some(item => item.url === normalized)) return;
  // Follow actual project/detail pages and finite pagination, avoiding a broad site crawl.
  if (isBlitzShowcaseApi || isProjectPage(normalized) || /[?&](page|p|offset|cursor)=/i.test(parsed.search)) state.queue.push({ url: normalized, source });
}
function clone(repo, destination, timeoutMs = 120000) {
  return new Promise(resolve => {
    // Keep every collected project as a lightweight source snapshot.  Full
    // history and tags multiply both disk usage and migration time, while the
    // canonical remote URL remains in state for an on-demand full re-clone.
    const child = spawn('git', ['clone', '--depth', '1', '--single-branch', '--no-tags', repo, destination], { stdio: 'pipe', windowsHide: true });
    let stderr = '';
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      // Git can create helper processes on Windows. Kill its full process tree
      // and resolve immediately instead of waiting for a close event forever.
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
      finish({ code: -1, stderr: `clone timed out after ${timeoutMs / 1000}s` });
    }, timeoutMs);
    child.stderr.on('data', data => { stderr += data; });
    child.on('close', code => finish({ code, stderr: stderr.trim().slice(-1000) }));
    child.on('error', error => finish({ code: -1, stderr: error.message }));
  });
}

function cleanSummary(text) {
  return text
    .replace(/<[^>]+>/g, ' ').replace(/!?(?:\[[^\]]*\]\([^)]*\))/g, ' ')
    .replace(/[`*_>#|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
}
async function writeDescription(repo, target, discoveredFrom) {
  // Keep collector metadata outside third-party source trees.
  const name = basename(target);
  const platformPath = relative(repoRoot, target).split(sep).join('/');
  const platform = platformPath.split('/')[0];
  const entries = await readdir(target, { withFileTypes: true });
  const topLevel = entries.map(entry => entry.name).filter(name => name !== '.git').sort();
  const readme = entries.find(entry => /^readme(?:\.(md|txt))?$/i.test(entry.name));
  const packageFile = entries.find(entry => entry.name === 'package.json');
  let summary = '';
  if (packageFile) {
    try { summary = JSON.parse(await readFile(join(target, packageFile.name), 'utf8')).description ?? ''; } catch { /* ignored */ }
  }
  if (!summary && readme) {
    const raw = await readFile(join(target, readme.name), 'utf8');
    summary = raw.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#') && !line.trim().startsWith('![')).slice(0, 4).join(' ');
  }
  summary = cleanSummary(summary) || '未在顶层 README 或 package.json 中找到可提取的项目摘要。';
  await mkdir(descriptionRoot, { recursive: true });
  const description = [
    `# ${repo}`, '',
    `- **本地目录：** \`repositories/${platformPath}\``,
    `- **发现页面：** ${discoveredFrom}`,
    `- **项目摘要（源仓库自述）：** ${summary}`,
    `- **顶层内容：** ${topLevel.map(item => `\`${item}\``).join('、') || '无'}`,
    '',
    '> 本文件由采集器在克隆成功后生成；保留中文字段名称，项目摘要来自公开源码自身的元数据或 README，未作安全审计。', ''
  ].join('\n');
  await mkdir(join(descriptionRoot, platform), { recursive: true });
  await writeFile(join(descriptionRoot, platform, `${name}.md`), description, 'utf8');
}

let lock;
try { lock = await open(lockPath, 'wx'); }
catch { console.error(`Another crawl appears to be running (${lockPath}).`); process.exitCode = 2; }
if (!lock) process.exit();

try {
  await mkdir(repoRoot, { recursive: true });
  await mkdir(descriptionRoot, { recursive: true });
  const state = await loadState();
  let processed = 0;
  while (state.queue.length && processed < maxPages && (!requestedPlatform ? clonedCount(state) : cloneCountForPlatform(state, requestedPlatform)) < targetRepos) {
    const item = state.queue.shift();
    if (state.seenPages[item.url]) continue;
    processed += 1;
    process.stdout.write(`[${processed}/${maxPages}] ${item.url}\n`);
    let response, html;
    try {
      response = await fetch(item.url, { headers: { 'user-agent': 'Web3HackathonResearchBot/1.0 (public-source collection; contact: local-run)', accept: 'application/vnd.github+json, text/html, application/xhtml+xml' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      html = await response.text();
      state.seenPages[item.url] = { at: new Date().toISOString(), status: response.status, finalUrl: response.url, bytes: html.length };
      if (!response.ok) { note(state, 'page_failed', { url: item.url, status: response.status }); await saveState(state); await sleep(delayMs); continue; }
    } catch (error) {
      state.seenPages[item.url] = { at: new Date().toISOString(), error: String(error) };
      note(state, 'page_error', { url: item.url, error: String(error) }); await saveState(state); continue;
    }
    // Blitz provides a first-party public JSON API. Follow its cursor-style
    // pagination rather than guessing links from the visual showcase page.
    if (new URL(response.url).hostname === 'blitz.devnads.com' && new URL(response.url).pathname === '/api/showcase') {
      try {
        const payload = JSON.parse(html);
        const current = new URL(response.url);
        const limit = Number(current.searchParams.get('limit') ?? 100);
        const offset = Number(current.searchParams.get('offset') ?? 0);
        if (Number.isFinite(payload.total) && offset + limit < payload.total) {
          const next = new URL(current);
          next.searchParams.set('offset', String(offset + limit));
          enqueue(state, next.href, item.source);
        }
      } catch { /* malformed API response is handled by normal link parsing */ }
    }
    for (const url of pageLinks(html, response.url)) {
      const repo = canonicalRepo(url);
      if (repo) {
        if (state.repositories[repo]) continue;
        if ((!requestedPlatform ? clonedCount(state) : cloneCountForPlatform(state, requestedPlatform)) >= targetRepos) break;
        const digest = createHash('sha256').update(repo).digest('hex').slice(0, 10);
        const platform = requestedPlatform ?? item.platform ?? 'github-discovery';
        const target = join(repoRoot, platform, `${basename(repo)}--${digest}`);
        await mkdir(join(repoRoot, platform), { recursive: true });
        if (!await reserveRepository(repo, { platform, target, discoveredFrom: item.url })) {
          state.repositories[repo] = { firstSeenAt: new Date().toISOString(), discoveredFrom: item.url, platform, target, status: 'duplicate' };
          await saveState(state);
          continue;
        }
        state.repositories[repo] = { firstSeenAt: new Date().toISOString(), discoveredFrom: item.url, platform, target, status: 'pending' };
        await saveState(state); // reserve it before cloning: this is the de-duplication boundary.
        const result = await clone(repo, target);
        state.repositories[repo] = { ...state.repositories[repo], status: result.code === 0 ? 'cloned' : 'failed', finishedAt: new Date().toISOString(), error: result.code === 0 ? undefined : result.stderr };
        await finaliseReservation(repo, result.code === 0 ? 'cloned' : 'failed', result.code === 0 ? undefined : result.stderr);
        if (result.code === 0) await writeDescription(repo, target, item.url);
        note(state, result.code === 0 ? 'cloned' : 'clone_failed', { repo, from: item.url, error: result.code === 0 ? undefined : result.stderr });
        await saveState(state);
        continue;
      }
      enqueue(state, url, item.source);
    }
    await saveState(state);
    // GitHub's unauthenticated search endpoint allows roughly ten requests per
    // minute. Slow only that endpoint; normal public project pages retain the
    // caller-provided polite delay.
    await sleep(new URL(item.url).hostname === 'api.github.com' ? Math.max(delayMs, 7000) : delayMs);
  }
  const values = Object.values(state.repositories);
  console.log(JSON.stringify({ platform: requestedPlatform ?? 'mixed', processedPages: processed, queuedPages: state.queue.length, targetRepositories: Number.isFinite(targetRepos) ? targetRepos : null, repositories: values.length, cloned: values.filter(x => x.status === 'cloned').length, platformCloned: requestedPlatform ? cloneCountForPlatform(state, requestedPlatform) : undefined, failed: values.filter(x => x.status === 'failed').length }, null, 2));
} finally {
  await lock.close();
  await rm(lockPath, { force: true });
}
