const path = require('path'), fs = require('fs'), http = require('http'), { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'shots'), BASE = 'http://127.0.0.1:8790/';
const EDGE = process.env.GC_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function ping() { return new Promise(r => { const q = http.get(BASE + 'index.html', res => { res.resume(); r(res.statusCode === 200); }); q.on('error', () => r(false)); q.setTimeout(1500, () => { q.destroy(); r(false); }); }); }
async function ensureServer() {
  if (await ping()) return;
  spawn(process.execPath, [path.join(ROOT, 'serve.cjs')], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  for (let i = 0; i < 40; i++) { await sleep(150); if (await ping()) return; }
  throw new Error('server did not start');
}
async function open(url, { size = [1920, 1080], fresh = true } = {}) {
  await ensureServer();
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--no-first-run', '--hide-scrollbars', '--mute-audio', '--window-size=1920,1080', '--user-data-dir=' + path.join(ROOT, 'node_modules', '.cache', 'gc-play-profile')] });
  const page = await browser.newPage(), errors = [];
  await page.setViewport({ width: size[0], height: size[1], deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  if (fresh) { await page.goto(BASE + 'index.html?dev=none', { waitUntil: 'domcontentloaded' }); await page.evaluate(() => localStorage.clear()); }
  await page.goto(BASE + 'index.html' + url, { waitUntil: 'load' });
  await page.waitForFunction('globalThis.__ready===true', { timeout: 60000 });
  const api = {
    page, browser, errors,
    shot: async name => { const f = path.join(OUT, name + '.png'); await page.screenshot({ path: f }); console.log('shot', name); return f; },
    ev: (fn, ...a) => page.evaluate(fn, ...a),
    idle: async (max = 30000) => { const t = Date.now(); await sleep(120); while (Date.now() - t < max) { const busy = await page.evaluate(() => GC.busy || __gc.inputLock || (__gc.director?.running > 0)); if (!busy) { await sleep(180); return true; } await sleep(100); } return false; },
    storyActive: () => page.evaluate(() => { const c = document.querySelector('.story-click'); return !!c && c.style.display !== 'none'; }),
    storyAdvance: async (target) => {
      for (let i = 0; i < 30; i++) {
        const s = await page.evaluate(t => { const c = document.querySelector('.story-click'); if (!c || c.style.display === 'none') return { on: false }; const bar = document.querySelector('.story-bar'), btns = bar && bar.style.display !== 'none' ? [...bar.querySelectorAll('button')].map(b => b.textContent) : []; return { on: true, btns, hit: !!t && btns.some(x => x.includes(t)) }; }, target);
        if (!s.on || s.hit) return;
        if (s.btns.includes('下一页')) await page.evaluate(() => [...document.querySelectorAll('.story-bar button')].find(b => b.textContent === '下一页').click());
        else if (!s.btns.length) await page.mouse.click(960, 540);
        else return;
        await sleep(380);
      }
    },
    clickText: async (text, sel = 'button') => { await api.storyAdvance(text); const ok = await page.evaluate((text, sel) => { const el = [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null && !e.disabled && e.textContent.includes(text)).pop(); if (!el) return false; el.click(); return true; }, text, sel); if (!ok) throw new Error('no button: ' + text); await sleep(350); },
    has: async text => { await api.storyAdvance(text); return page.evaluate(text => [...document.querySelectorAll('button')].some(e => e.offsetParent !== null && !e.disabled && e.textContent.includes(text)), text); },
    project: (x, y, z) => page.evaluate((x, y, z) => { const v = new (__gc.rig.camera.position.constructor)(x, y, z).project(__gc.rig.camera); return [(v.x * .5 + .5) * innerWidth, (-v.y * .5 + .5) * innerHeight]; }, x, y, z),
    clickWorld: async (x, y, z) => { const [px, py] = await api.project(x, y, z); await page.mouse.move(px, py); await sleep(60); await page.mouse.click(px, py); await sleep(120); },
    sleep,
    done: async () => { await browser.close(); if (errors.length) { console.log('CONSOLE ISSUES:\n' + [...new Set(errors)].join('\n')); process.exitCode = 2; } else console.log('console clean'); }
  };
  return api;
}
module.exports = { open, sleep };

if (require.main === module) (async () => {
  const scenario = process.argv[2] || 'battle';
  if (scenario === 'battle') {
    const g = await open('?dev=battle');
    await g.idle(); await sleep(600); await g.shot('m2_battle_start');
    const LX = [-1.95, -.65, .65, 1.95];
    await g.clickWorld(LX[1], .02, .7); await sleep(700); await g.shot('m2_unit_selected');
    await g.ev(() => GC.actions.cancelSelection());
    await g.ev(() => { __gc.input.endTurn(); });
    await sleep(900); await g.shot('m2_turn_a');
    await sleep(700); await g.shot('m2_turn_b');
    await sleep(900); await g.shot('m2_turn_c');
    await sleep(1200); await g.shot('m2_turn_d');
    await g.idle(); await g.shot('m2_turn_end');
    console.log(JSON.stringify(await g.ev(() => ({ turn: GC.battle?.turn, will: GC.battle?.will, enemyWill: GC.battle?.enemyWill, units: GC.battle?.units.map(u => u && [u.name, Math.round(u.hp)]), enemies: GC.battle?.enemies.map(u => [u.name, Math.round(u.hp), u.dead]), stats: __gcStats(), log: GC.battle?.log.slice(0, 8) }))));
    await g.done();
  } else if (scenario === 'home') {
    const g = await open('');
    await sleep(2500); await g.shot('m4_home');
    await g.clickText('建立新旅途'); await sleep(500); await g.shot('m4_slot');
    await g.clickText('确认开始'); await sleep(2200); await g.shot('m4_map');
    await g.done();
  }
})().catch(e => { console.error(e); process.exit(1); });
