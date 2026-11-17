const path = require('path'), fs = require('fs'), http = require('http'), { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'shots'), PORT = 8790, BASE = `http://127.0.0.1:${PORT}/`;
const EDGE = process.env.GC_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const GPU = ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'];
const SOFT = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

function ping() { return new Promise(r => { const q = http.get(BASE + 'index.html', res => { res.resume(); r(res.statusCode === 200); }); q.on('error', () => r(false)); q.setTimeout(1500, () => { q.destroy(); r(false); }); }); }
async function ensureServer() {
  if (await ping()) return;
  const child = spawn(process.execPath, [path.join(ROOT, 'serve.cjs')], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 150)); if (await ping()) return; }
  throw new Error('server did not start');
}

const SHOTS = {
  title: { url: '?dev=title', wait: 2500 },
  battle: { url: '?dev=battle', wait: 3500 },
  battle_hover: { url: '?dev=battle', wait: 3200, hover: [.5, .93] },
  cards: { url: '?dev=cards', wait: 2500 },
  apparitions: { url: '?dev=apparitions', wait: 2500 },
  battle_low: { url: '?dev=battle&q=low', wait: 3200 },
  battle_mobile: { url: '?dev=battle', wait: 3200, size: [844, 390] }
};

async function main() {
  const args = process.argv.slice(2), prefix = (args.find(a => a.startsWith('--prefix=')) || '--prefix=m1_').slice(9);
  const soft = args.includes('--soft'), fps = args.includes('--fps'), custom = args.find(a => a.startsWith('--url='));
  const names = args.filter(a => !a.startsWith('--'));
  fs.mkdirSync(OUT, { recursive: true });
  await ensureServer();
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: [...(soft ? SOFT : GPU), '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--disable-features=msEdgeOnRampFRE', '--window-size=1920,1080',
      '--user-data-dir=' + path.join(ROOT, 'node_modules', '.cache', 'gc-shot-profile')]
  });
  const errors = [];
  try {
    const list = custom ? [['custom', { url: custom.slice(6), wait: +(args.find(a => a.startsWith('--wait=')) || '--wait=3000').slice(7) }]] : Object.entries(SHOTS).filter(([n]) => !names.length || names.includes(n));
    for (const [name, cfg] of list) {
      const page = await browser.newPage();
      const [w, h] = cfg.size || [1920, 1080];
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.type()}: ${m.text()}`); });
      page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
      await page.goto(BASE + 'index.html' + cfg.url, { waitUntil: 'load' });
      await page.waitForFunction('globalThis.__ready===true', { timeout: 60000 }).catch(() => errors.push(`[${name}] not ready`));
      if (cfg.hover) await page.mouse.move(w * cfg.hover[0], h * cfg.hover[1]);
      await new Promise(r => setTimeout(r, cfg.wait));
      if (cfg.eval) await page.evaluate(cfg.eval);
      const file = path.join(OUT, `${prefix}${name}.png`);
      await page.screenshot({ path: file });
      const info = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info'); return { gpu: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a', stats: globalThis.__gcStats?.() }; });
      console.log(`${name}: ${file}  ${JSON.stringify(info)}`);
      if (fps && name === 'battle') {
        await page.evaluate(() => { globalThis.__gc && (globalThis.__f = { n: 0, t: performance.now() }); const loop = () => { globalThis.__f.n++; requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
        await new Promise(r => setTimeout(r, 5000));
        const r = await page.evaluate(() => ({ fps: globalThis.__f.n / ((performance.now() - globalThis.__f.t) / 1000), stats: globalThis.__gcStats() }));
        console.log(`fps(5s): ${r.fps.toFixed(1)}  ${JSON.stringify(r.stats)}`);
      }
      await page.close();
    }
  } finally { await browser.close(); }
  if (errors.length) { console.log('CONSOLE ISSUES:\n' + errors.join('\n')); process.exitCode = 2; } else console.log('console clean');
}
main().catch(e => { console.error(e); process.exit(1); });
