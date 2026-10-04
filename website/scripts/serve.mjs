import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist');
const base=new URL(process.env.SITE_URL||'http://127.0.0.1:4173/ji-yixuan').pathname.replace(/\/$/,'');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.xml':'application/xml','.json':'application/json; charset=utf-8'};
http.createServer(async(req,res)=>{
 try{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(base && !name.startsWith(base+'/')){res.writeHead(302,{Location:base+'/'});res.end();return;}
  name=name.slice(base.length);
  const target=path.resolve(root,'.'+name);
  if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);res.end();return;}
  const stat=await fs.stat(target);
  const file=stat.isDirectory()?path.join(target,'index.html'):target;
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(await fs.readFile(path.join(root,'404.html')));}
}).listen(4173,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:4173${base}/`));
