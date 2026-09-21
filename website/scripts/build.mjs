import fs from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist');
const site = (process.env.SITE_URL || 'http://127.0.0.1:4173/ji-yixuan').replace(/\/$/, '');
const base = new URL(site).pathname.replace(/\/$/, '');
const url = (p = '') => `${base}/${p}`;
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md = new MarkdownIt({ html: false, typographer: false });
const articles = JSON.parse(await fs.readFile(path.join(root, 'content/articles.json'), 'utf8'));
if (new Set(articles.map(a => a.slug)).size !== articles.length) throw new Error('Duplicate article slug');
for (const a of articles) {
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
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}｜紀依媗</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#f8f6f1"><link rel="canonical" href="${esc(site + '/' + route)}"><meta property="og:type" content="${route.startsWith('articles/') && route !== 'articles/' ? 'article' : 'website'}"><meta property="og:title" content="${esc(title)}｜紀依媗"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(site + '/' + route)}"><meta property="og:locale" content="zh_TW"><link rel="icon" href="${url('favicon.svg')}" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="${url('style.css')}"><script src="${url('site.js')}" defer></script></head>
<body><a class="skip" href="#main">跳至主要內容</a><header class="site-header"><div class="header-inner"><a class="brand" href="${url()}" aria-label="紀依媗首頁">紀依媗 ${note}</a><nav aria-label="主要導覽">${[['home','關於我',''],['resume','履歷','resume/'],['articles','文章','articles/']].map(([key,label,link]) => `<a href="${url(link)}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></div></header>${body}<footer class="site-footer"><p class="footer-quote">${quote}</p><div class="footer-note">${note}</div><div class="footer-bottom"><span>© 2026 紀依媗</span><a href="${url('resume/')}">關於紀依媗</a></div></footer></body></html>`;
}
function rows(items) {
 return `<div class="article-list">${items.map(a => `<article class="article-row"><a class="article-cover" href="${url(`articles/${a.slug}/`)}" tabindex="-1" aria-hidden="true"><img src="${url('images/' + a.image)}" alt="" width="1122" height="1402" loading="lazy"></a><div class="article-summary"><div class="meta"><span>${esc(a.category)}</span><span class="meta-divider">/</span><time datetime="${a.date}">${a.date.replaceAll('-','.')}</time><span class="reading-time">${a.minutes} 分鐘閱讀</span></div><h2><a href="${url(`articles/${a.slug}/`)}">${esc(a.title)}</a></h2><p>${esc(a.description)}</p></div><a class="row-arrow" href="${url(`articles/${a.slug}/`)}" aria-label="閱讀：${esc(a.title)}">${arrow}</a></article>`).join('')}</div>`;
}
const home = `<main id="main" class="container"><section class="hero"><div class="hero-copy"><h1>我是紀依媗，<span>在音符與日常之間，<br>探索新的可能。</span></h1><p class="hero-description">音樂 × AI × 生活。<br>喜歡把腦中的旋律變成真的聲音，<br>也好奇科技能如何陪伴創作。</p><div class="hero-actions"><a class="button primary" href="${url('articles/')}">閱讀文章 ${arrow}</a><a class="button" href="${url('resume/')}">認識我</a></div></div><figure class="hero-portrait"><img src="${url('images/portrait.jpg')}" alt="紀依媗的日系動畫形象：深棕色及肩髮、淺藍襯衫與花形項鍊，在咖啡館微笑。" width="1254" height="1254" fetchpriority="high"><figcaption>咖啡、鋼琴、耳機，是我的日常標配。</figcaption></figure></section><section class="latest" aria-labelledby="latest-title"><div class="section-heading"><h2 id="latest-title">最近的筆記</h2><a class="text-link" href="${url('articles/')}">所有文章 ${arrow}</a></div>${rows(articles)}</section></main>`;
const resume = `<main id="main" class="container resume"><div class="page-heading"><div><h1>履歷</h1><p>個人背景與探索方向。</p></div><button class="button primary" type="button" data-print><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7zM17 11h.01" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>列印履歷</button></div><div class="resume-layout"><aside class="resume-profile"><img src="${url('images/portrait.jpg')}" width="1254" height="1254" alt="紀依媗的日系動畫肖像"><h2>紀依媗</h2><p>音樂 × AI × 生活</p></aside><div class="resume-details"><section><h2>自我介紹</h2><p>我喜歡把腦中的旋律變成真的聲音，也正在研究 AI 可以怎麼幫助音樂創作。咖啡、鋼琴、耳機，是我的日常標配。</p></section><section class="work-experience"><h2>工作經歷</h2><div class="job"><div class="job-period"><time datetime="2026-03">2026 年 3 月</time> — 現在</div><h3>依媗音樂工作室</h3><p class="job-role">自由音樂創作者<span>台中市</span></p><p>AI × Music 數位行銷</p></div><div class="job"><div class="job-period"><time datetime="2025-07-01">2025 年 7 月 1 日</time> — <time datetime="2026-02-01">2026 年 2 月 1 日</time></div><h3>台灣索尼音樂娛樂股份有限公司</h3><p class="job-role">企劃專案</p><p>接觸串流音樂、數位內容、音樂行銷與新媒體</p></div><div class="job"><div class="job-period"><time datetime="2024-07">2024 年 7 月</time> — <time datetime="2025-06">2025 年 6 月</time></div><h3>華研國際音樂股份有限公司</h3><p class="job-role">音樂企劃</p><p>接觸音樂製作、藝人內容、數位音樂與社群素材</p></div></section><section><h2>學習背景</h2><div class="education"><span class="years">2022 — 2024</span><div><h3>國立臺灣師範大學</h3><p>音樂學系碩士班</p><small>就讀期間</small></div></div></section><section><h2>探索方向</h2><dl class="interests"><div><dt>音樂創作</dt><dd>旋律發想與音樂表達</dd></div><div><dt>AI 輔助創作</dt><dd>探索科技如何成為創作者的另一雙手</dd></div><div><dt>生活書寫</dt><dd>音樂日常、關係觀察與照顧者的付出</dd></div></dl></section><section><h2>核心理念</h2><blockquote>${quote}</blockquote></section></div></div></main>`;
await fs.rm(out, {recursive:true, force:true});
await fs.mkdir(out, {recursive:true});
await fs.cp(path.join(root,'public'), out, {recursive:true});
const write = async (file, html) => { const target=path.join(out,file); await fs.mkdir(path.dirname(target),{recursive:true}); await fs.writeFile(target,html); };
await write('index.html', shell('音樂、AI 與生活', '我是紀依媗，喜歡把腦中的旋律變成真的聲音。這裡記錄我的學習背景、音樂與 AI 探索，以及日常觀察。', home, 'home'));
await write('resume/index.html', shell('履歷', '紀依媗的工作經歷、學習背景與音樂、AI 輔助創作及生活書寫的探索方向。', resume, 'resume', 'resume/'));
await write('articles/index.html', shell('文章', '關於音樂創作、AI 輔助創作與生活觀察的筆記。', `<main id="main" class="container archive"><div class="page-heading"><div><h1>文章</h1><p>音樂、科技，還有值得被聽見的日常。</p></div><span class="article-count">${articles.length} 篇筆記</span></div>${rows(articles)}</main>`, 'articles', 'articles/'));
for (const [i,a] of articles.entries()) {
 const next=articles[(i+1)%articles.length];
 const article = `<main id="main" class="reading"><a class="back-link" href="${url('articles/')}">${arrow} 返回文章列表</a><article><header class="article-heading"><div class="meta"><span>${esc(a.category)}</span><time datetime="${a.date}">${a.date.replaceAll('-','.')}</time><span>${a.minutes} 分鐘閱讀</span></div><h1>${esc(a.title)}</h1><p>${esc(a.description)}</p><div class="byline"><img src="${url('images/portrait.jpg')}" width="32" height="32" alt="">紀依媗</div></header><figure class="reading-cover"><a href="${url('images/'+a.image)}" aria-label="檢視完整配圖：${esc(a.title)}"><img src="${url('images/'+a.image)}" alt="${esc(a.imageAlt)}" width="${a.imageWidth || (a.slug==='shared-responsibility' ? 1024 : 1122)}" height="${a.imageHeight || (a.slug==='shared-responsibility' ? 1536 : 1402)}" fetchpriority="high"></a><figcaption>日系動畫配圖 · 點擊可檢視原圖</figcaption></figure><div class="prose">${a.body}</div></article><aside class="next-article"><span>繼續閱讀</span><a href="${url(`articles/${next.slug}/`)}">${esc(next.title)} ${arrow}</a></aside></main>`;
 await write(`articles/${a.slug}/index.html`, shell(a.title,a.description,article,'articles',`articles/${a.slug}/`));
}
await write('404.html', shell('找不到這一頁', '找不到指定頁面，請返回紀依媗首頁。', `<main id="main" class="container not-found"><p>404</p><h1>這一頁，暫時沒有音符。</h1><a class="button primary" href="${url()}">回到首頁 ${arrow}</a></main>`, '', '404.html'));
await write('.nojekyll','');
const routes=['','resume/','articles/',...articles.map(a=>`articles/${a.slug}/`)];
await write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(r=>`<url><loc>${esc(site+'/'+r)}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${routes.length} pages + 404, ${articles.length} illustrated articles → ${out}`);
