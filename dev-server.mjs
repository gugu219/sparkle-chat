import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://127.0.0.1:4173');const filename=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(u.pathname.startsWith('/api/')){let file=filename.endsWith('.js')?filename:filename+'.js';const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const handler=(await import('file:///'+file.replaceAll('\\','/'))).default;if(typeof handler!=='function'){res.writeHead(404).end();return;}const response=await handler(new Request(u,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}: {})}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
 if(u.pathname.includes('/lib/')||u.pathname.endsWith('.env')||u.pathname.endsWith('.mjs')&&!u.pathname.startsWith('/vendor/')){res.writeHead(403).end();return;}
 const data=await readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404,{'Content-Type':'application/json'}).end(JSON.stringify({error:'APIまたはファイルが見つかりません'}));}}).listen(4173,'127.0.0.1',()=>console.log('Sparkle Chat: http://127.0.0.1:4173'));
