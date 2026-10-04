import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist');
const site=(process.env.SITE_URL||'http://127.0.0.1:4173/ji-yixuan').replace(/\/$/,'');
const base=new URL(site).pathname.replace(/\/$/,'');
const entries=await fs.readdir(root,{recursive:true});
let links=0, pages=0;
for(const file of entries.filter(f=>f.endsWith('.html'))){
 const html=await fs.readFile(path.join(root,file),'utf8');
 if((html.match(/<h1[ >]/g)||[]).length!==1) throw Error(`${file}: require one h1`);
 if(!html.includes('lang="zh-Hant"')) throw Error(`${file}: missing language`);
 for(const m of html.matchAll(/<(?:img|script|link|a)\b[^>]*(?:src|href)="([^"]+)"/g)){
  const href=m[1].replaceAll('&amp;','&');
  if(/^(https?:|data:|#)/.test(href)) continue;
  if(!href.startsWith(base+'/')) throw Error(`${file}: wrong Pages base path ${href}`);
  let local=decodeURIComponent(href.slice(base.length+1).split('#')[0]);
  if(local.endsWith('/')||!local) local+='index.html';
  await fs.access(path.join(root,local)).catch(()=>{throw Error(`${file}: broken link ${href}`)});
  links++;
 }
 if(file.startsWith('articles/')&&file!=='articles/index.html'&&!html.includes('data-article-reader')) throw Error('Article needs image');
 pages++;
}
console.log(`Verified ${pages} HTML pages and ${links} internal links/assets, article images, language, headings and Pages subpath.`);
