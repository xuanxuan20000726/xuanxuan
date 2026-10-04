#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(root, '..');
const stateDir = path.join(projectRoot, 'work', 'instagram-scheduler');
const queueFile = path.join(stateDir, 'queue.json');
const logFile = path.join(stateDir, 'scheduler.log');
const envFile = path.join(projectRoot, '.env.ig');
const port = Number(process.env.IG_SCHEDULER_PORT || 43170);
const graphVersion = process.env.META_GRAPH_VERSION || 'v24.0';
const siteBase = (process.env.SITE_URL || 'https://xuanxuan20000726.github.io/xuanxuan').replace(/\/$/, '');

async function loadEnv() {
  try {
    const source = await fs.readFile(envFile, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadEnv();

const config = () => ({
  username: process.env.IG_USERNAME || 'xuan.xuan20000726',
  igUserId: process.env.IG_USER_ID || '',
  accessToken: process.env.IG_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || ''
});

async function ensureState() {
  await fs.mkdir(stateDir, { recursive: true });
  try { await fs.access(queueFile); }
  catch { await fs.writeFile(queueFile, JSON.stringify({ jobs: [] }, null, 2)); }
}

async function readQueue() {
  await ensureState();
  return JSON.parse(await fs.readFile(queueFile, 'utf8'));
}

async function writeQueue(queue) {
  await ensureState();
  await fs.writeFile(queueFile, `${JSON.stringify(queue, null, 2)}\n`);
}

async function log(message) {
  await ensureState();
  await fs.appendFile(logFile, `${new Date().toISOString()} ${message}\n`);
}

function publicJob(job) {
  const { caption, ...safe } = job;
  return { ...safe, captionLength: caption?.length || 0 };
}

function cleanCaption(source) {
  return source
    .replace(/^#\s+(.+)$/m, '$1')
    .replace(/^預定刊登：.*$/gm, '')
    .replace(/^主題：.*$/gm, '')
    .replace(/^消息日期：.*$/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1：$2')
    .replace(/\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function articleFor(slug) {
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'content', 'articles.json'), 'utf8'));
  const article = catalog.find(item => item.slug === slug);
  if (!article) throw new Error(`找不到文章：${slug}`);
  if (!article.video) throw new Error(`文章沒有影片：${slug}`);
  const source = await fs.readFile(path.join(root, 'content', `${slug}.md`), 'utf8');
  return {
    slug,
    title: article.title,
    publishAt: article.publishAt,
    videoUrl: `${siteBase}/videos/${encodeURIComponent(article.video)}`,
    caption: cleanCaption(source)
  };
}

async function graph(pathname, fields = {}) {
  const { accessToken } = config();
  const body = new URLSearchParams({ ...fields, access_token: accessToken });
  const response = await fetch(`https://graph.instagram.com/${graphVersion}/${pathname}`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error?.message || `Meta API ${response.status}`);
  return result;
}

async function containerStatus(id) {
  const { accessToken } = config();
  const response = await fetch(`https://graph.instagram.com/${graphVersion}/${id}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`);
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error?.message || `Meta API ${response.status}`);
  return result;
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function publish(job) {
  const { igUserId, accessToken } = config();
  if (!igUserId || !accessToken) throw new Error('尚未設定 IG_USER_ID 或 IG_ACCESS_TOKEN');
  const created = await graph(`${igUserId}/media`, {
    media_type: 'REELS', video_url: job.videoUrl, caption: job.caption, share_to_feed: 'true'
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = await containerStatus(created.id);
    if (state.status_code === 'FINISHED') {
      const published = await graph(`${igUserId}/media_publish`, { creation_id: created.id });
      return { containerId: created.id, mediaId: published.id };
    }
    if (state.status_code === 'ERROR' || state.status_code === 'EXPIRED') {
      throw new Error(state.status || `影片容器狀態：${state.status_code}`);
    }
    await pause(5000);
  }
  throw new Error('Meta 處理影片逾時');
}

let processing = false;
async function runDueJobs() {
  if (processing) return;
  processing = true;
  try {
    const queue = await readQueue();
    for (const job of queue.jobs) {
      if (job.status !== 'scheduled' || Date.parse(job.publishAt) > Date.now()) continue;
      job.status = 'publishing';
      job.updatedAt = new Date().toISOString();
      await writeQueue(queue);
      try {
        Object.assign(job, await publish(job), { status: 'published', publishedAt: new Date().toISOString(), error: null });
        await log(`published ${job.slug} ${job.mediaId}`);
      } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        await log(`failed ${job.slug}: ${error.message}`);
      }
      job.updatedAt = new Date().toISOString();
      await writeQueue(queue);
    }
  } finally { processing = false; }
}

async function schedule(slug, override = {}) {
  const article = await articleFor(slug);
  const queue = await readQueue();
  const existing = queue.jobs.find(job => job.slug === slug);
  if (existing?.status === 'published') return existing;
  const job = {
    ...article,
    publishAt: override.publishAt || article.publishAt,
    caption: override.caption || article.caption,
    status: 'scheduled', error: null,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (existing) Object.assign(existing, job); else queue.jobs.push(job);
  queue.jobs.sort((a, b) => Date.parse(a.publishAt) - Date.parse(b.publishAt));
  await writeQueue(queue);
  await log(`scheduled ${slug} for ${job.publishAt}`);
  return job;
}

function send(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api/status' && req.method === 'GET') {
      const queue = await readQueue();
      const cfg = config();
      return send(res, 200, {
        online: true, configured: Boolean(cfg.igUserId && cfg.accessToken), username: cfg.username,
        graphVersion, jobs: queue.jobs.map(publicJob), checkedAt: new Date().toISOString()
      });
    }
    if (url.pathname === '/api/schedule' && req.method === 'POST') {
      const body = await readBody(req);
      return send(res, 201, { ok: true, job: publicJob(await schedule(body.slug, body)) });
    }
    if (url.pathname === '/api/run' && req.method === 'POST') {
      await runDueJobs();
      return send(res, 200, { ok: true, jobs: (await readQueue()).jobs.map(publicJob) });
    }
    if (url.pathname.startsWith('/xuanxuan/')) {
      const relative = url.pathname.slice('/xuanxuan/'.length) || 'index.html';
      const requested = relative.endsWith('/') ? `${relative}index.html` : relative;
      const target = path.resolve(root, 'dist', requested);
      if (!target.startsWith(path.resolve(root, 'dist'))) return send(res, 403, { error: 'forbidden' });
      const data = await fs.readFile(target);
      const ext = path.extname(target);
      const type = ({ '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4' })[ext] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': type }); return res.end(data);
    }
    send(res, 404, { error: 'not found' });
  } catch (error) { send(res, 400, { error: error.message }); }
}

await ensureState();
if (process.argv[2] === 'schedule') {
  const job = await schedule(process.argv[3]);
  console.log(JSON.stringify(publicJob(job), null, 2));
} else if (process.argv[2] === 'run') {
  await runDueJobs();
  console.log(JSON.stringify((await readQueue()).jobs.map(publicJob), null, 2));
} else {
  const server = http.createServer((req, res) => void handler(req, res));
  server.listen(port, '127.0.0.1', () => console.log(`Instagram scheduler: http://127.0.0.1:${port}/xuanxuan/admin/`));
  setInterval(() => void runDueJobs(), 30_000).unref();
  void runDueJobs();
}
