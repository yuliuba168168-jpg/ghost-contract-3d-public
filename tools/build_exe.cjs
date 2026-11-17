// 把方块版打成单个 exe（Node SEA）：node tools/build_exe.cjs → dist/鬼灵契约方块版.exe
// exe 内嵌方块版需要的全部文件，启动后在 127.0.0.1:8791 起服务并打开浏览器。需要 npx postject（联网一次）。
const fs = require('fs'), path = require('path'), { execFileSync, execSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
const INCLUDE = ['simple.html', 'src/rules', 'src/simple', 'src/app', 'vendor/three', 'assets/gen/manifest.json'];
const SKIP = /\.(map|md|ts)$|[\/]dev\.js$/;
const files = {};
function walk(rel) {
  const abs = path.join(ROOT, rel); if (!fs.existsSync(abs)) return;
  if (fs.statSync(abs).isDirectory()) { for (const n of fs.readdirSync(abs)) walk(rel + '/' + n); return; }
  if (!SKIP.test(rel)) files['/' + rel] = fs.readFileSync(abs).toString('base64');
}
INCLUDE.forEach(walk);
fs.mkdirSync(DIST, { recursive: true });
const launcher = fs.readFileSync(path.join(__dirname, 'exe_launcher.cjs'), 'utf8').replace('/*FILES*/{}', JSON.stringify(files));
fs.writeFileSync(path.join(DIST, 'launcher.cjs'), launcher);
fs.writeFileSync(path.join(DIST, 'sea-config.json'), JSON.stringify({ main: path.join(DIST, 'launcher.cjs'), output: path.join(DIST, 'sea-prep.blob'), disableExperimentalSEAWarning: true }));
execFileSync(process.execPath, ['--experimental-sea-config', path.join(DIST, 'sea-config.json')], { stdio: 'inherit' });
const exe = path.join(DIST, '鬼灵契约方块版.exe');
fs.copyFileSync(process.execPath, exe);
execSync(`npx.cmd --yes postject "${exe}" NODE_SEA_BLOB "${path.join(DIST, 'sea-prep.blob')}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, { stdio: 'inherit' });
console.log('files:', Object.keys(files).length, 'exe MB:', (fs.statSync(exe).size / 1048576).toFixed(1));
