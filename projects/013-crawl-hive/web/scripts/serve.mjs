import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createExplorerApi } from '../explore/server.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const repository = path.resolve(root, '../../..');
const port = Number(process.env.PORT || 4183);
const site = '/1014_codex_project/';
const prefix = site + '013-crawl-hive';
const api = createExplorerApi({ webRoot: root });
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.woff2':'font/woff2','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const allowedOrigins = new Set([4175,4183,port].flatMap(p=>[`http://127.0.0.1:${p}`,`http://localhost:${p}`]));
const inFolder = (file,folder) => file.startsWith(folder + path.sep);

const server = http.createServer(async (req,res) => {
  try {
    const host = new URL('http://' + (req.headers.host || '')).hostname;
    if (!['localhost','127.0.0.1','[::1]'].includes(host)) {res.writeHead(403);res.end();return;}
    const origin=req.headers.origin;
    if(origin && !allowedOrigins.has(origin)){res.writeHead(403);res.end('不允许的请求来源');return;}
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return;}
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.split('/').some(part=>part.startsWith('.')||part.includes('\\')))throw new Error('invalid path');
    if(pathname===prefix || pathname===site.slice(0,-1)){res.writeHead(302,{Location:pathname+'/'});res.end();return;}
    const ownPath=pathname.startsWith(prefix+'/')?pathname.slice(prefix.length):pathname;
    if(await api(req,res,ownPath))return;
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    let file;
    if(pathname===site || pathname===site+'index.html')file=path.join(repository,'web/index.html');
    else if(pathname===site+'projects.json')file=path.join(repository,'projects.json');
    else if(pathname===site+'entries.json')file=path.join(repository,'web/entries.json');
    else if(pathname.startsWith(site) && !pathname.startsWith(prefix+'/')){
      const relative=pathname.slice(site.length), parts=relative.split('/');
      const catalog=JSON.parse(await readFile(path.join(repository,'projects.json'),'utf8'));
      if(parts[0]==='projects'){
        const project=catalog.projects.find(p=>p.id+'-'+p.slug===parts[1]), record=parts.slice(2).join('/');
        if(!project||!['README.md','RESEARCH.md',project.preview].filter(Boolean).includes(record))throw new Error('unknown resource');
        file=path.resolve(repository,relative);
      }else{
        const project=catalog.projects.find(p=>p.id+'-'+p.slug===parts[0]);
        if(!project)throw new Error('unknown project');
        const folder=path.resolve(repository,'projects',parts[0],'web/dist');
        file=path.resolve(folder,parts.slice(1).join('/')||'index.html');
        if(!inFolder(file,folder))throw new Error('invalid path');
      }
    }else if(ownPath==='/README.md'||ownPath==='/RESEARCH.md')file=path.join(root,'..',ownPath.slice(1));
    else if(ownPath==='/licenses/UPSTREAM-MIT.txt')file=path.join(root,'..','licenses/UPSTREAM-MIT.txt');
    else{
      file=path.resolve(root,'.'+(ownPath==='/'?'/index.html':ownPath));
      if(!inFolder(file,root))throw new Error('invalid path');
    }
    if(!inFolder(file,repository)||file.endsWith('.mjs'))throw new Error('invalid file');
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    if(!mime[path.extname(file)]||!(await stat(file)).isFile())throw new Error('not file');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('页面不存在');
  }
});
server.listen(port,'127.0.0.1',()=>console.log(`主入口: http://127.0.0.1:${port}${site}\n工作台: http://127.0.0.1:${port}${prefix}/explore/index.html`));
