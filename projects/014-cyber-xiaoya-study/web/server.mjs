import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'dist');
const base='/1014_codex_project/014-cyber-xiaoya-study/';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const port=Number(process.env.PORT||4186);
createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/'||url.pathname===base.slice(0,-1)){res.writeHead(302,{Location:base});return res.end();}
    if(!url.pathname.startsWith(base)){res.writeHead(404);return res.end('Not found');}
    const relative=decodeURIComponent(url.pathname.slice(base.length));
    const path=resolve(root,relative||'index.html');
    if(!path.startsWith(root+sep)){res.writeHead(403);return res.end('Forbidden');}
    const info=await stat(path);if(!info.isFile())throw new Error('Not a file');
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:await readFile(path));
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`014研究阅读页：http://127.0.0.1:${port}${base}`));
