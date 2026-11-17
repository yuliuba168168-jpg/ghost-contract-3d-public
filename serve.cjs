// Static file server for DST. No dependencies.
// Usage: node serve.cjs  ->  http://127.0.0.1:8790/
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname,HOST='127.0.0.1',OPEN=process.argv[2]||'';let PORT=8790;
// 启动后用默认浏览器打开 OPEN（由各 .cmd 传入，如 /diag.html）
function openPage(){if(!OPEN)return;const url=`http://${HOST}:${PORT}${OPEN}`;console.log('opening '+url);require('child_process').exec(process.platform==='win32'?`start "" "${url}"`:`xdg-open "${url}"`,()=>{})}
const MIME={'.webm':'video/webm','.mp4':'video/mp4','.m4a':'audio/mp4','.ogg':'audio/ogg','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.txt':'text/plain; charset=utf-8','.map':'application/json; charset=utf-8','.ico':'image/x-icon','.mp3':'audio/mpeg','.wav':'audio/wav','.glb':'model/gltf-binary','.gltf':'model/gltf+json'};
const server=http.createServer((req,res)=>{
 let p;try{p=decodeURIComponent(new URL(req.url,'http://x').pathname)}catch{res.writeHead(400);return res.end()}
 if(p==='/__root'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});return res.end(ROOT)}
 // 素材目录清单：/__list?dir=assets/music → ["title.mp3",...]（只允许 assets 下的目录）
 if(p==='/__list'){const d=path.normalize(path.join(ROOT,new URL(req.url,'http://x').searchParams.get('dir')||''));if(!d.startsWith(path.join(ROOT,'assets'))){res.writeHead(403);return res.end()}
  return fs.readdir(d,(err,names)=>{res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(err?[]:names))})}
 if(p.endsWith('/'))p+='index.html';
 const file=path.normalize(path.join(ROOT,p));
 if(!file.startsWith(ROOT)){res.writeHead(403);return res.end()}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404);return res.end('not found')}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 });
});
// 端口被占时：占用者是本文件夹的服务 → 直接打开页面；是别的文件夹（比如旧版本没关）→ 换下一个端口，避免打开到旧版本
server.on('error',async e=>{
 if(e.code!=='EADDRINUSE')throw e;
 const other=await fetch(`http://${HOST}:${PORT}/__root`).then(r=>r.ok?r.text():'').catch(()=>'');
 if(other===ROOT){console.log(`http://${HOST}:${PORT}/ is already being served from this folder.`);openPage();return setTimeout(()=>process.exit(0),1500)}
 console.log(`port ${PORT} is used by another copy of the game (an older version window is probably still open).`);
 if(PORT>=8799){console.log('no free port between 8790 and 8799; close the other game windows and try again.');return setTimeout(()=>process.exit(1),8000)}
 PORT++;console.log(`using port ${PORT} instead. NOTE: saves are stored per port; close the old window and restart to get back to port 8790.`);server.listen(PORT,HOST);
});
server.on('listening',()=>{console.log(`serving ${ROOT} at http://${HOST}:${PORT}/`);openPage()});
server.listen(PORT,HOST);
