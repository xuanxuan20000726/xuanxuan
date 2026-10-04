import { publishedArticles, publishTime, selectArticles } from './publishing.js';
document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
const browser = document.querySelector('[data-article-browser]');
const reader = document.querySelector('[data-article-reader]');
const host = browser || reader;
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<span aria-hidden="true">↗</span>';
function pageButtons(current,total) {
 const numbers=[...new Set([1,current-1,current,current+1,total].filter(n=>n>=1&&n<=total))].sort((a,b)=>a-b);
 return numbers.map((n,i)=>`${i&&n>numbers[i-1]+1?'<span class="page-ellipsis" aria-hidden="true">…</span>':''}<button type="button" data-page="${n}" ${current===n?'aria-current="page"':''}>${n}</button>`).join('');
}
const formatTime = a => a.publishAt ? new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(publishTime(a)) : '';
if (host) {
 const base = host.dataset.base;
 const url = p => `${base}/${p}`;
 const fetchJSON = async p => {const response=await fetch(url(p));if(!response.ok)throw Error('讀取失敗');return response.json();};
 try {
  const articles=await fetchJSON('data/articles.json');
  articles.forEach(publishTime);
  let signature='', bodyCache=null, bodyPending=false, timer;
  const state={query:'',category:'',date:'',page:1,size:12};
  let controls,list,result,pagination;
  if(browser) {
   const archive=browser.dataset.mode==='archive';
   browser.innerHTML=`${archive?`<form class="article-filters" role="search"><label class="search-field">搜尋文章<input name="query" type="search" placeholder="標題、摘要或主題" autocomplete="off"></label><label>主題<select name="category"><option value="">所有主題</option></select></label><label>刊登日期<select name="date"><option value="">所有日期</option></select></label><button class="filter-reset" type="reset">清除篩選</button></form>`:''}<p class="result-note" role="status" aria-live="polite"></p><div class="article-list"></div><nav class="pagination" aria-label="文章分頁"></nav>`;
   controls=browser.querySelector('form'); list=browser.querySelector('.article-list');result=browser.querySelector('.result-note');pagination=browser.querySelector('.pagination');
   controls?.addEventListener('submit',e=>e.preventDefault());
   controls?.addEventListener('input',e=>{if(e.target.name){state[e.target.name]=e.target.value;state.page=1;render(true);}});
   controls?.addEventListener('reset',()=>{Object.assign(state,{query:'',category:'',date:'',page:1});queueMicrotask(()=>render(true));});
   pagination.addEventListener('click',e=>{const button=e.target.closest('[data-page]');if(!button)return;state.page=Number(button.dataset.page);render(true);browser.scrollIntoView({behavior:'smooth',block:'start'});pagination.querySelector('[aria-current="page"]')?.focus({preventScroll:true});});
  }
  function updateOptions(select,values,label,selected) {
   const html=`<option value="">${label}</option>`+values.map(v=>`<option value="${esc(v)}"${v===selected?' selected':''}>${esc(v)}</option>`).join('');
   if(select.innerHTML!==html)select.innerHTML=html;
   select.value=selected;
  }
  function render(force=false) {
   const now=Date.now(),due=publishedArticles(articles,now),nextSignature=due.map(a=>a.slug).join('|');
   clearTimeout(timer);
   const next=articles.map(publishTime).filter(t=>t>now).sort((a,b)=>a-b)[0];
   timer=setTimeout(()=>render(),Math.min(30000,next?Math.max(20,next-now):30000));
   if(!force && signature===nextSignature)return;
   signature=nextSignature;
   if(browser) {
    if(controls) {
     const categories=[...new Set(due.map(a=>a.category))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
     const dates=[...new Set(due.map(a=>a.date))].sort().reverse();
     if(state.category&&!categories.includes(state.category))state.category='';
     if(state.date&&!dates.includes(state.date))state.date='';
     updateOptions(controls.elements.category,categories,'所有主題',state.category);
     updateOptions(controls.elements.date,dates,'所有日期',state.date);
    }
    const selection=selectArticles(due,controls?state:{size:6});state.page=selection.page;
    result.textContent=controls?`${selection.total} 篇筆記${selection.total?` · 第 ${selection.page} / ${selection.pages} 頁`:''}`:`最近刊登的 ${Math.min(6,due.length)} 篇筆記`;
    list.innerHTML=selection.items.length?selection.items.map(a=>`<article class="article-row"><a class="article-cover" href="${url(`articles/${a.slug}/`)}" tabindex="-1" aria-hidden="true"><img src="${url('images/'+a.image)}" alt="" width="${a.imageWidth||1122}" height="${a.imageHeight||1402}" loading="lazy"></a><div class="article-summary"><div class="meta"><span>${esc(a.category)}</span><span class="meta-divider">/</span><time datetime="${esc(a.publishAt)}">${a.date.replaceAll('-','.')} ${formatTime(a)}</time><span class="reading-time">${a.minutes} 分鐘閱讀</span></div><h2><a href="${url(`articles/${a.slug}/`)}">${esc(a.title)}</a></h2><p>${esc(a.description)}</p></div><a class="row-arrow" href="${url(`articles/${a.slug}/`)}" aria-label="閱讀：${esc(a.title)}">${arrow}</a></article>`).join(''):'<p class="empty-state">沒有符合條件的文章，試試其他關鍵字或清除篩選。</p>';
    pagination.innerHTML=controls&&selection.pages>1?`<button type="button" data-page="${selection.page-1}" ${selection.page===1?'disabled':''}>上一頁</button>${pageButtons(selection.page,selection.pages)}<button type="button" data-page="${selection.page+1}" ${selection.page===selection.pages?'disabled':''}>下一頁</button>`:'';
   }
   if(reader) {
    const article=due.find(a=>a.slug===reader.dataset.slug);
    if(!article){reader.innerHTML='<div class="scheduled-notice"><h1>文章尚未刊登</h1><p>這篇筆記還在等待刊登時間，先看看其他文章吧。</p><a class="button" href="'+url('articles/')+'">閱讀已刊登文章</a></div>';document.title='文章尚未刊登｜米媗媗';return;}
    if(!bodyCache) {
     if(!bodyPending){bodyPending=true;fetchJSON(`data/${article.slug}.json`).then(data=>{bodyCache=data.body;bodyPending=false;render(true);}).catch(()=>{bodyPending=false;reader.innerHTML='<h1>暫時無法讀取文章</h1><p>請重新整理頁面再試一次。</p>';});}return;
    }
    document.title=`${article.title}｜米媗媗`;
    const other=due.find(a=>a.slug!==article.slug);
    const video=article.video?`<figure class="reading-video"><video controls playsinline preload="metadata" poster="${url('images/'+article.image)}" src="${url('videos/'+article.video)}"></video><figcaption>三頁重點影片 · 女聲口播與繁體字幕</figcaption></figure>`:'';
    reader.innerHTML=`<article><header class="article-heading"><div class="meta"><span>${esc(article.category)}</span><time datetime="${esc(article.publishAt)}">${article.date.replaceAll('-','.')} ${formatTime(article)}</time><span>${article.minutes} 分鐘閱讀</span></div><h1>${esc(article.title)}</h1><p>${esc(article.description)}</p><div class="byline"><img src="${url('images/portrait.jpg')}" width="32" height="32" alt="">米媗媗</div></header><figure class="reading-cover"><a href="${url('images/'+article.image)}" aria-label="檢視完整配圖：${esc(article.title)}"><img src="${url('images/'+article.image)}" alt="${esc(article.imageAlt)}" width="${article.imageWidth||1122}" height="${article.imageHeight||1402}" fetchpriority="high"></a><figcaption>日系動畫配圖 · 點擊可檢視原圖</figcaption></figure>${video}<div class="prose">${bodyCache}</div></article>${other?`<aside class="next-article"><span>繼續閱讀</span><a href="${url(`articles/${other.slug}/`)}">${esc(other.title)} ${arrow}</a></aside>`:''}`;
   }
  }
  render(true);
  document.addEventListener('visibilitychange',()=>render());
  window.addEventListener('focus',()=>render());
 } catch(error) {
  host.innerHTML=reader?'<h1>暫時無法讀取文章</h1><p>請重新整理頁面再試一次。</p>':'<p role="status">暫時無法讀取文章，請重新整理頁面再試一次。</p>';
  console.error(error);
 }
}
