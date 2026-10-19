// Minimal local static server for evaluation. Production: serve dist/ over HTTPS.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.wasm':'application/wasm','.gz':'application/gzip'};
createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{const url=new URL(req.url,'http://localhost'),path=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const target=(await stat(path)).isDirectory()?resolve(path,'index.html'):path;
    const body=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Label Lens: http://localhost:${port}`));
