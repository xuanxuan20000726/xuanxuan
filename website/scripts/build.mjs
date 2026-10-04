import fs from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { publishTime } from '../public/publishing.js';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist');
const site = (process.env.SITE_URL || 'http://127.0.0.1:4173/xuanxuan').replace(/\/$/, '');
const base = new URL(site).pathname.replace(/\/$/, '');
const url = (p = '') => `${base}/${p}`;
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md = new MarkdownIt({ html: false, typographer: false });
const articles = JSON.parse(await fs.readFile(path.join(root, 'content/articles.json'), 'utf8'));
if (new Set(articles.map(a => a.slug)).size !== articles.length) throw new Error('Duplicate article slug');
for (const a of articles) {
  a.publishAt ||= `${a.date}T00:00:00+08:00`;
  publishTime(a);
  if (!/^[a-z0-9-]+$/.test(a.slug)) throw new Error('Invalid slug');
  if (!a.image || !a.imageAlt) throw new Error(`Missing article illustration: ${a.slug}`);
  await fs.access(path.join(root, 'public/images', a.image));
  const source = await fs.readFile(path.join(root, 'content', `${a.slug}.md`), 'utf8');
  // Cover images are rendered once, above the article, with descriptive alt text.
  a.body = md.render(source.replace(/^!\[.*\]\(.*\)\s*$/gm, '').replace(/^#[^\n]+$/gm, '').trim());
  a.minutes = Math.max(1, Math.ceil(source.replace(/\[[^\]]+\]\([^)]*\)/g, '').length / 450));
}
const arrow = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 12h16m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const note = '<svg aria-hidden="true" viewBox="0 0 24 30" fill="none"><path d="M11 22V5c5 1 3 5 9 7M11 5V2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="7" cy="24" rx="4" ry="3" transform="rotate(-24 7 24)" fill="currentColor"/></svg>';
const quote = '科技不一定取代創作者，也可以成為創作者的另一雙手。';
function shell(title, description, body, active, route = '') {
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}｜米媗媗</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#f8f6f1"><link rel="canonical" href="${esc(site + '/' + route)}"><meta property="og:type" content="${route.startsWith('articles/') && route !== 'articles/' ? 'article' : 'website'}"><meta property="og:title" content="${esc(title)}｜米媗媗"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(site + '/' + route)}"><meta property="og:locale" content="zh_TW"><link rel="icon" href="${url('favicon.svg')}" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="${url('style.css')}"><script src="${url('site.js')}" type="module"></script></head>
<body><a class="skip" href="#main">跳至主要內容</a><header class="site-header"><div class="header-inner"><a class="brand" href="${url()}" aria-label="米媗媗首頁">米媗媗 ${note}</a><nav aria-label="主要導覽">${[['home','關於我',''],['resume','履歷','resume/'],['articles','文章','articles/']].map(([key,label,link]) => `<a href="${url(link)}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></div></header>${body}<footer class="site-footer"><p class="footer-quote">${quote}</p><div class="footer-note">${note}</div><div class="footer-bottom"><span>© 2026 米媗媗</span><span><a href="${url('resume/')}">關於米媗媗</a> · <a href="${url('admin/')}">管理狀態</a></span></div></footer></body></html>`;
}
function rows() {
 return `<section data-article-browser data-base="${esc(base)}" data-mode="home"><p class="loading-note" role="status">正在讀取文章…</p><noscript>請開啟 JavaScript，查看已刊登的文章。</noscript></section>`;
}
const home = `<main id="main" class="container"><section class="hero"><div class="hero-copy"><h1>我是米媗媗，<span>在音符與日常之間，<br>探索新的可能。</span></h1><p class="hero-description">音樂 × AI × 生活。<br>喜歡把腦中的旋律變成真的聲音，<br>也好奇科技能如何陪伴創作。</p><div class="hero-actions"><a class="button primary" href="${url('articles/')}">閱讀文章 ${arrow}</a><a class="button" href="${url('resume/')}">認識我</a></div></div><figure class="hero-portrait"><img src="${url('images/portrait.jpg')}" alt="米媗媗的日系動畫形象：深棕色及肩髮、淺藍襯衫與花形項鍊，在咖啡館微笑。" width="1254" height="1254" fetchpriority="high"><figcaption>咖啡、鋼琴、耳機，是我的日常標配。</figcaption></figure></section><section class="latest" aria-labelledby="latest-title"><div class="section-heading"><h2 id="latest-title">最近的筆記</h2><a class="text-link" href="${url('articles/')}">所有文章 ${arrow}</a></div>${rows(articles)}</section></main>`;
const resume = `<main id="main" class="container resume"><div class="page-heading"><div><h1>履歷</h1><p>個人背景與探索方向。</p></div><button class="button primary" type="button" data-print><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7zM17 11h.01" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>列印履歷</button></div><div class="resume-layout"><aside class="resume-profile"><img src="${url('images/portrait.jpg')}" width="1254" height="1254" alt="米媗媗的日系動畫肖像"><h2>米媗媗</h2><p>音樂 × AI × 生活</p></aside><div class="resume-details"><section><h2>自我介紹</h2><p>我喜歡把腦中的旋律變成真的聲音，也正在研究 AI 可以怎麼幫助音樂創作。咖啡、鋼琴、耳機，是我的日常標配。</p></section><section class="work-experience"><h2>工作經歷</h2><div class="job"><div class="job-period"><time datetime="2025-07-01">2025 年 7 月 1 日</time> — <time datetime="2026-02-01">2026 年 2 月 1 日</time></div><h3>台灣索尼音樂娛樂股份有限公司</h3><p class="job-role">企劃專案</p><p>接觸串流音樂、數位內容、音樂行銷與新媒體</p></div><div class="job"><div class="job-period"><time datetime="2024-07">2024 年 7 月</time> — <time datetime="2025-06">2025 年 6 月</time></div><h3>華研國際音樂股份有限公司</h3><p class="job-role">音樂企劃</p><p>接觸音樂製作、藝人內容、數位音樂與社群素材</p></div></section><section><h2>學習背景</h2><div class="education"><span class="years">2022 — 2024</span><div><h3>國立臺灣師範大學</h3><p>音樂學系碩士班</p><small>就讀期間</small></div></div></section><section><h2>探索方向</h2><dl class="interests"><div><dt>音樂創作</dt><dd>旋律發想與音樂表達</dd></div><div><dt>AI 輔助創作</dt><dd>探索科技如何成為創作者的另一雙手</dd></div><div><dt>生活書寫</dt><dd>音樂日常、關係觀察與照顧者的付出</dd></div></dl></section><section><h2>核心理念</h2><blockquote>${quote}</blockquote></section></div></div></main>`;
const admin = `<main id="main" class="admin-shell" data-admin-dashboard data-base="${esc(base)}"><header class="admin-hero"><div><p class="admin-kicker">PUBLISHING DESK</p><h1>米媗媗內容控制台</h1><p>一眼確認帳號、影片排程與網站同步狀態。</p></div><div class="admin-live"><span aria-hidden="true"></span><strong>台灣時間</strong><time data-admin-clock>讀取中</time></div></header><section class="admin-grid" aria-label="發佈摘要"><article class="admin-card account-card"><div class="card-label">INSTAGRAM</div><div class="account-row"><div class="ig-mark" aria-hidden="true">◎</div><div><p>目前登入帳號</p><h2 data-ig-account>讀取中</h2></div></div><p class="card-note" data-account-note></p></article><article class="admin-card metric-card"><div class="card-label">QUEUE</div><strong data-schedule-count>—</strong><p>支影片等待發佈</p><span data-next-post>讀取排程中</span></article><article class="admin-card sync-card"><div class="card-label">WEBSITE</div><div class="sync-heading"><span class="status-dot checking" data-sync-dot></span><h2 data-sync-label>檢查同步狀態</h2></div><p data-sync-detail>正在比對線上履歷與目前品牌名稱…</p><a href="https://xuanxuan20000726.github.io/xuanxuan/resume/" target="_blank" rel="noreferrer">開啟線上履歷 ↗</a></article></section><section class="admin-panel schedule-panel"><div class="panel-heading"><div><p class="admin-kicker">CONTENT CALENDAR</p><h2>影片排程</h2></div><div class="legend"><span><i class="facebook"></i>Facebook</span><span><i class="instagram"></i>Instagram</span></div></div><div class="schedule-list" data-schedule-list><p class="loading-note">正在讀取排程…</p></div></section><section class="admin-panel deployment-panel"><div class="panel-heading"><div><p class="admin-kicker">DEPLOYMENT</p><h2>網站同步檢查</h2></div><button class="admin-refresh" type="button" data-admin-refresh>重新檢查</button></div><div class="deploy-steps" data-deploy-steps></div><p class="last-check" data-last-check></p></section></main><script src="${url('admin.js')}" type="module"></script>`;
await fs.rm(out, {recursive:true, force:true});
await fs.mkdir(out, {recursive:true});
await fs.cp(path.join(root,'public'), out, {recursive:true});
const write = async (file, html) => { const target=path.join(out,file); await fs.mkdir(path.dirname(target),{recursive:true}); await fs.writeFile(target,html); };
await write('index.html', shell('音樂、AI 與生活', '我是米媗媗，喜歡把腦中的旋律變成真的聲音。這裡記錄我的學習背景、音樂與 AI 探索，以及日常觀察。', home, 'home'));
await write('resume/index.html', shell('履歷', '米媗媗的工作經歷、學習背景與音樂、AI 輔助創作及生活書寫的探索方向。', resume, 'resume', 'resume/'));
await write('admin/index.html', shell('內容控制台', '米媗媗的 Instagram 影片排程與網站同步狀態。', admin, '', 'admin/'));
await write('articles/index.html', shell('文章', '關於音樂創作、AI 輔助創作與生活觀察的筆記。', `<main id="main" class="container archive"><div class="page-heading"><div><h1>文章</h1><p>音樂、科技，還有值得被聽見的日常。</p></div></div><section data-article-browser data-base="${esc(base)}" data-mode="archive"><p class="loading-note" role="status">正在讀取文章…</p><noscript>請開啟 JavaScript，查看已刊登的文章。</noscript></section></main>`, 'articles', 'articles/'));
const catalog = articles.map(({body,...a})=>a);
await write('data/articles.json', JSON.stringify(catalog));
for (const a of articles) {
 await write(`data/${a.slug}.json`, JSON.stringify({body:a.body}));
 const published = publishTime(a) <= Date.now();
 const article = `<main id="main" class="reading"><a class="back-link" href="${url('articles/')}">${arrow} 返回文章列表</a><section data-article-reader data-base="${esc(base)}" data-slug="${esc(a.slug)}"><h1>正在讀取文章…</h1><noscript>請開啟 JavaScript，查看已刊登的文章。</noscript></section></main>`;
 await write(`articles/${a.slug}/index.html`, shell(published?a.title:'文章', published?a.description:'音樂、科技與生活的筆記。',article,'articles',`articles/${a.slug}/`));
}
await write('404.html', shell('找不到這一頁', '找不到指定頁面，請返回米媗媗首頁。', `<main id="main" class="container not-found"><p>404</p><h1>這一頁，暫時沒有音符。</h1><a class="button primary" href="${url()}">回到首頁 ${arrow}</a></main>`, '', '404.html'));
await write('.nojekyll','');
const routes=['','resume/','articles/','admin/',...articles.filter(a=>publishTime(a)<=Date.now()).map(a=>`articles/${a.slug}/`)];
await write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(r=>`<url><loc>${esc(site+'/'+r)}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${articles.length+4} pages + 404 (${routes.length} sitemap routes), ${articles.length} illustrated articles → ${out}`);
