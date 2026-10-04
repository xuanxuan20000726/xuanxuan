#!/usr/bin/env node
import http from 'node:http';
import crypto from 'node:crypto';
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
const redirectUri = process.env.IG_REDIRECT_URI || `${siteBase}/oauth/instagram/callback`;
const facebookRedirectUri = process.env.FB_REDIRECT_URI || `${siteBase}/oauth/facebook/callback`;
const oauthStates = new Set();
const facebookOauthStates = new Set();

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
  appId: process.env.IG_APP_ID || '',
  appSecret: process.env.IG_APP_SECRET || '',
  igUserId: process.env.IG_USER_ID || '',
  accessToken: process.env.IG_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '',
  facebookAppId: process.env.FB_APP_ID || '',
  facebookAppSecret: process.env.FB_APP_SECRET || '',
  facebookPageId: process.env.FB_PAGE_ID || '',
  facebookPageName: process.env.FB_PAGE_NAME || '',
  facebookPageToken: process.env.FB_PAGE_ACCESS_TOKEN || ''
});

function facebookOauthUrl() {
  const cfg = config();
  if (!cfg.facebookAppId) return null;
  const state = crypto.randomUUID();
  facebookOauthStates.add(state);
  setTimeout(() => facebookOauthStates.delete(state), 10 * 60_000).unref();
  const query = new URLSearchParams({
    client_id: cfg.facebookAppId,
    redirect_uri: facebookRedirectUri,
    response_type: 'code',
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts',
    state
  });
  return `https://www.facebook.com/${graphVersion}/dialog/oauth?${query}`;
}

function oauthUrl() {
  const cfg = config();
  if (!cfg.appId) return null;
  const state = crypto.randomUUID();
  oauthStates.add(state);
  setTimeout(() => oauthStates.delete(state), 10 * 60_000).unref();
  const query = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'instagram_business_basic,instagram_business_content_publish',
    state
  });
  return `https://www.instagram.com/oauth/authorize?${query}`;
}

async function exchangeCode(code) {
  const cfg = config();
  if (!cfg.appId || !cfg.appSecret) throw new Error('尚未設定 IG_APP_ID 或 IG_APP_SECRET');
  const shortResponse = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.appId, client_secret: cfg.appSecret, grant_type: 'authorization_code', redirect_uri: redirectUri, code })
  });
  const shortToken = await shortResponse.json();
  if (!shortResponse.ok || shortToken.error_type || shortToken.error_message) throw new Error(shortToken.error_message || `Instagram 授權交換失敗（${shortResponse.status}）`);
  const longResponse = await fetch(`https://graph.instagram.com/${graphVersion}/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: cfg.appSecret, access_token: shortToken.access_token })}`);
  const longToken = await longResponse.json();
  if (!longResponse.ok || longToken.error) throw new Error(longToken.error?.message || `長效權杖交換失敗（${longResponse.status}）`);
  process.env.IG_ACCESS_TOKEN = longToken.access_token;
  process.env.IG_USER_ID = String(shortToken.user_id);
  await fs.appendFile(envFile, `\nIG_USER_ID=${process.env.IG_USER_ID}\nIG_ACCESS_TOKEN=${process.env.IG_ACCESS_TOKEN}\n`);
  return { userId: process.env.IG_USER_ID, expiresIn: longToken.expires_in };
}

async function exchangeFacebookCode(code) {
  const cfg = config();
  if (!cfg.facebookAppId || !cfg.facebookAppSecret) throw new Error('尚未設定 FB_APP_ID 或 FB_APP_SECRET');
  const tokenResponse = await fetch(`https://graph.facebook.com/${graphVersion}/oauth/access_token?${new URLSearchParams({ client_id: cfg.facebookAppId, client_secret: cfg.facebookAppSecret, redirect_uri: facebookRedirectUri, code })}`);
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || token.error) throw new Error(token.error?.message || `Facebook 授權交換失敗（${tokenResponse.status}）`);
  const pagesResponse = await fetch(`https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token,tasks&access_token=${encodeURIComponent(token.access_token)}`);
  const pages = await pagesResponse.json();
  if (!pagesResponse.ok || pages.error) throw new Error(pages.error?.message || `無法讀取 Facebook 粉絲專頁（${pagesResponse.status}）`);
  const page = pages.data?.find(item => item.tasks?.includes('CREATE_CONTENT')) || pages.data?.[0];
  if (!page) throw new Error('這個 Facebook 帳號沒有可發佈內容的粉絲專頁');
  process.env.FB_PAGE_ID = String(page.id);
  process.env.FB_PAGE_NAME = page.name;
  process.env.FB_PAGE_ACCESS_TOKEN = page.access_token;
  await fs.appendFile(envFile, `\nFB_PAGE_ID=${process.env.FB_PAGE_ID}\nFB_PAGE_NAME=${process.env.FB_PAGE_NAME}\nFB_PAGE_ACCESS_TOKEN=${process.env.FB_PAGE_ACCESS_TOKEN}\n`);
  return { pageId: process.env.FB_PAGE_ID, pageName: process.env.FB_PAGE_NAME };
}

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
  const facebookReady = Boolean(config().facebookPageId && config().facebookPageToken);
  return {
    ...safe,
    channels: safe.channels || {
      instagramReel: { status: job.status },
      instagramStory: { status: job.status === 'published' ? 'not_requested' : 'scheduled' },
      facebookReel: { status: facebookReady ? 'scheduled' : 'authorization_required' }
    },
    captionLength: caption?.length || 0
  };
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

async function facebookGraph(pathname, fields = {}) {
  const { facebookPageToken } = config();
  const body = new URLSearchParams({ ...fields, access_token: facebookPageToken });
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pathname}`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error?.message || `Facebook API ${response.status}`);
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

async function waitForInstagramContainer(id) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = await containerStatus(id);
    if (state.status_code === 'FINISHED') return;
    if (state.status_code === 'ERROR' || state.status_code === 'EXPIRED') throw new Error(state.status || `影片容器狀態：${state.status_code}`);
    await pause(5000);
  }
  throw new Error('Meta 處理影片逾時');
}

async function publishInstagram(job, mediaType, fields = {}) {
  const { igUserId, accessToken } = config();
  if (!igUserId || !accessToken) throw new Error('尚未設定 IG_USER_ID 或 IG_ACCESS_TOKEN');
  const created = await graph(`${igUserId}/media`, {
    media_type: mediaType, video_url: job.videoUrl, ...fields
  });
  await waitForInstagramContainer(created.id);
  const published = await graph(`${igUserId}/media_publish`, { creation_id: created.id });
  return { containerId: created.id, mediaId: published.id };
}

async function publishFacebookReel(job) {
  const { facebookPageId, facebookPageToken } = config();
  if (!facebookPageId || !facebookPageToken) throw new Error('尚未連結 Facebook 粉絲專頁');
  const started = await facebookGraph(`${facebookPageId}/video_reels`, { upload_phase: 'start' });
  const upload = await fetch(started.upload_url, {
    method: 'POST',
    headers: { Authorization: `OAuth ${facebookPageToken}`, file_url: job.videoUrl }
  });
  const uploadResult = await upload.json();
  if (!upload.ok || uploadResult.error || uploadResult.success === false) throw new Error(uploadResult.error?.message || `Facebook Reels 上傳失敗（${upload.status}）`);
  const finished = await facebookGraph(`${facebookPageId}/video_reels`, {
    upload_phase: 'finish', video_id: started.video_id, video_state: 'PUBLISHED', description: job.caption
  });
  return { videoId: started.video_id, success: finished.success !== false };
}

async function publishChannel(job, channel, action) {
  job.channels ||= {};
  job.channels[channel] = { status: 'publishing', updatedAt: new Date().toISOString() };
  try {
    const result = await action();
    job.channels[channel] = { ...result, status: 'published', publishedAt: new Date().toISOString(), error: null };
  } catch (error) {
    job.channels[channel] = { status: 'failed', error: error.message, updatedAt: new Date().toISOString() };
  }
}

async function publish(job) {
  if (job.channels?.instagramReel?.status !== 'published') await publishChannel(job, 'instagramReel', () => publishInstagram(job, 'REELS', { caption: job.caption, share_to_feed: 'true' }));
  if (job.channels?.instagramStory?.status !== 'published') await publishChannel(job, 'instagramStory', () => publishInstagram(job, 'STORIES'));
  if (job.channels?.facebookReel?.status !== 'published') await publishChannel(job, 'facebookReel', () => publishFacebookReel(job));
  const states = Object.values(job.channels).map(channel => channel.status);
  if (states.every(status => status === 'failed')) throw new Error('所有發佈管道皆失敗');
  return { channels: job.channels };
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
        Object.assign(job, await publish(job));
        const complete = Object.values(job.channels).every(channel => channel.status === 'published');
        Object.assign(job, { status: complete ? 'published' : 'partial', publishedAt: complete ? new Date().toISOString() : null, error: complete ? null : '部分管道尚未發佈' });
        await log(`published ${job.slug} ${JSON.stringify(Object.fromEntries(Object.entries(job.channels).map(([key, value]) => [key, value.status])))}`);
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
  const previousChannels = existing?.channels || {};
  const job = {
    ...article,
    publishAt: override.publishAt || article.publishAt,
    caption: override.caption || article.caption,
    status: 'scheduled', error: null,
    channels: {
      instagramReel: previousChannels.instagramReel?.status === 'published' ? previousChannels.instagramReel : { status: 'scheduled' },
      instagramStory: previousChannels.instagramStory?.status === 'published' ? previousChannels.instagramStory : { status: 'scheduled' },
      facebookReel: previousChannels.facebookReel?.status === 'published' ? previousChannels.facebookReel : { status: config().facebookPageId && config().facebookPageToken ? 'scheduled' : 'authorization_required' }
    },
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
        graphVersion, redirectUri, authorizationUrl: cfg.appId && cfg.appSecret && !cfg.accessToken ? oauthUrl() : null,
        facebook: {
          configured: Boolean(cfg.facebookPageId && cfg.facebookPageToken),
          pageName: cfg.facebookPageName,
          authorizationUrl: cfg.facebookAppId && cfg.facebookAppSecret && !cfg.facebookPageToken ? facebookOauthUrl() : null,
          redirectUri: facebookRedirectUri
        },
        jobs: queue.jobs.map(publicJob), checkedAt: new Date().toISOString()
      });
    }
    if (url.pathname === '/auth/instagram/start' && req.method === 'GET') {
      const target = oauthUrl();
      if (!target) return send(res, 500, { error: '尚未設定 IG_APP_ID' });
      res.writeHead(302, { location: target }); return res.end();
    }
    if (url.pathname === '/auth/instagram/callback' && req.method === 'GET') {
      const state = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      if (!state || !oauthStates.has(state)) throw new Error('授權狀態已失效，請重新開始登入');
      oauthStates.delete(state);
      if (url.searchParams.get('error')) throw new Error(url.searchParams.get('error_description') || 'Instagram 拒絕授權');
      if (!code) throw new Error('Instagram 未回傳授權碼');
      const result = await exchangeCode(code);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<meta charset="utf-8"><title>Instagram 授權完成</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;max-width:640px;margin:12vh auto;padding:24px;line-height:1.7}a{color:#c13584}</style><h1>Instagram 授權完成</h1><p>帳號已連結，使用者 ID：${result.userId}</p><p>請回到控制台重新整理，確認排程服務已連線。</p><p><a href="http://127.0.0.1:${port}/xuanxuan/admin/">返回控制台</a></p>`);
    }
    if (url.pathname === '/auth/facebook/start' && req.method === 'GET') {
      const target = facebookOauthUrl();
      if (!target) return send(res, 500, { error: '尚未設定 FB_APP_ID' });
      res.writeHead(302, { location: target }); return res.end();
    }
    if (url.pathname === '/auth/facebook/callback' && req.method === 'GET') {
      const state = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      if (!state || !facebookOauthStates.has(state)) throw new Error('Facebook 授權狀態已失效，請重新開始登入');
      facebookOauthStates.delete(state);
      if (url.searchParams.get('error')) throw new Error(url.searchParams.get('error_description') || 'Facebook 拒絕授權');
      if (!code) throw new Error('Facebook 未回傳授權碼');
      const result = await exchangeFacebookCode(code);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<meta charset="utf-8"><title>Facebook 授權完成</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;max-width:640px;margin:12vh auto;padding:24px;line-height:1.7}a{color:#1877f2}</style><h1>Facebook 粉絲專頁已連結</h1><p>${result.pageName}</p><p><a href="http://127.0.0.1:${port}/xuanxuan/admin/">返回控制台</a></p>`);
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
