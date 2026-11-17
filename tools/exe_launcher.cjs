// 方块版 exe 的入口（由 tools/build_exe.cjs 把文件表填进 FILES 后打包）。
const http = require('http'), fs = require('fs'), path = require('path'), { exec } = require('child_process');
const FILES = /*FILES*/{};
const PORT = 8791, HOST = '127.0.0.1', URL0 = `http://${HOST}:${PORT}/simple.html`, HERE = path.dirname(process.execPath);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
function open() {
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  exec(edge ? `"${edge}" --app=${URL0} --window-size=1280,860` : `start "" "${URL0}"`, () => { });
}
const server = http.createServer((req, res) => {
  let u; try { u = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  let p = decodeURIComponent(u.pathname); if (p === '/') p = '/simple.html';
  if (p === '/__list') {   // 只列 exe 旁边 assets 文件夹里的素材（音乐、卡面可外放）
    const d = path.normalize(path.join(HERE, u.searchParams.get('dir') || ''));
    let names = []; if (d.startsWith(path.join(HERE, 'assets'))) { try { names = fs.readdirSync(d); } catch { } }
    res.writeHead(200, { 'Content-Type': MIME['.json'] }); return res.end(JSON.stringify(names));
  }
  const type = MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';
  const disk = path.normalize(path.join(HERE, p));
  if (p.startsWith('/assets/') && disk.startsWith(path.join(HERE, 'assets')) && fs.existsSync(disk)) { res.writeHead(200, { 'Content-Type': type }); return fs.createReadStream(disk).pipe(res); }
  const data = FILES[p];
  if (data == null) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(Buffer.from(data, 'base64'));
});
server.on('error', e => { if (e.code === 'EADDRINUSE') { open(); setTimeout(() => process.exit(0), 1500); } else { console.error(e); setTimeout(() => process.exit(1), 8000); } });
server.listen(PORT, HOST, () => { console.log('鬼灵契约 · 方块版 正在运行。'); console.log('游戏窗口已打开；如果没有，请在浏览器里打开 ' + URL0); console.log('玩的时候不要关闭这个黑色窗口，关闭它即退出游戏。'); open(); });
