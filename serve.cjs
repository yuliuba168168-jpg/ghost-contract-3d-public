// Static file server for DST. No dependencies.
// Usage: node serve.cjs  ->  http://127.0.0.1:8790/
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname,PORT=8790,HOST='127.0.0.1';
const MIME={'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.txt':'text/plain; charset=utf-8','.map':'application/json; charset=utf-8','.ico':'image/x-icon','.mp3':'audio/mpeg','.wav':'audio/wav','.glb':'model/gltf-binary','.gltf':'model/gltf+json'};
http.createServer((req,res)=>{
 let p;try{p=decodeURIComponent(new URL(req.url,'http://x').pathname)}catch{res.writeHead(400);return res.end()}
 if(p.endsWith('/'))p+='index.html';
 const file=path.normalize(path.join(ROOT,p));
 if(!file.startsWith(ROOT)){res.writeHead(403);return res.end()}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404);return res.end('not found')}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 });
}).on('error',e=>{if(e.code==='EADDRINUSE'){console.log(`http://${HOST}:${PORT}/ is already being served; nothing to do.`);process.exit(0)}throw e}).listen(PORT,HOST,()=>console.log(`serving ${ROOT} at http://${HOST}:${PORT}/`));
