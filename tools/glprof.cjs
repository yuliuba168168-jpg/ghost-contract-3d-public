// Finds which WebGL calls block the main thread. Usage: node tools\glprof.cjs [url-query] [--vsync]
const path = require('path'), puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..'), BASE = 'http://127.0.0.1:8790/';
const EDGE = process.env.GC_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const vsync = process.argv.includes('--vsync'), query = process.argv.find(a => a.startsWith('?')) || '?dev=battle';
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', ...(vsync ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit']), '--no-first-run', '--hide-scrollbars', '--mute-audio', '--window-size=1680,1120', '--user-data-dir=' + path.join(ROOT, 'node_modules', '.cache', 'gc-perf-profile')] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1120, deviceScaleFactor: 1.5 });
  await page.evaluateOnNewDocument(() => {
    const P = WebGL2RenderingContext.prototype, log = globalThis.__gl = { on: false, slow: {}, count: {}, frames: [] };
    for (const k of Object.getOwnPropertyNames(P)) {
      const d = Object.getOwnPropertyDescriptor(P, k);
      if (!d || typeof d.value !== 'function') continue;
      const f = d.value;
      P[k] = function (...a) { if (!log.on) return f.apply(this, a); const t = performance.now(), r = f.apply(this, a), dt = performance.now() - t; log.count[k] = (log.count[k] || 0) + 1; if (dt > 2) { const s = log.slow[k] ||= { n: 0, ms: 0, max: 0 }; s.n++; s.ms += dt; s.max = Math.max(s.max, dt); } return r; };
    }
  });
  await page.goto(BASE + 'index.html' + query, { waitUntil: 'load' });
  await page.waitForFunction('globalThis.__ready===true', { timeout: 60000 });
  await sleep(3000);
  const r = await page.evaluate(() => new Promise(res => {
    __gl.on = true; const prof = __gcLoopStats.profile = []; const t0 = performance.now(); let frames = 0;
    const longtasks = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) longtasks.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch { }
    const loop = () => { frames++; if (performance.now() - t0 < 5000) requestAnimationFrame(loop); else { __gl.on = false; __gcLoopStats.profile = null; const top = Object.entries(__gl.count).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ':' + Math.round(v / frames)); res({ frames, slow: __gl.slow, perFrame: top, longtasks, worstRender: prof.map(x => Math.round(x[2])).sort((a, b) => b - a).slice(0, 8), worstGap: prof.map(x => Math.round(x[0])).sort((a, b) => b - a).slice(0, 8), mem: performance.memory && Math.round(performance.memory.usedJSHeapSize / 1e6) }); } };
    requestAnimationFrame(loop);
  }));
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
