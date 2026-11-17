// Frame-time profiler at the user's real display: 1680x1120 CSS px at devicePixelRatio 1.5 (2520x1680 physical).
// VSync and the frame-rate limit are disabled so numbers above 60 fps are visible.
// Usage: node tools\perf.cjs [scene...]   scenes: battle title map   options: --q=high|medium|low  --toggles  --dsf=1.5
const path = require('path'), http = require('http'), { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..'), BASE = 'http://127.0.0.1:8790/';
const EDGE = process.env.GC_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2), opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const scenes = args.filter(a => !a.startsWith('--')), DSF = +opt('dsf', 1.5), Q = opt('q', ''), W = +opt('w', 1680), H = +opt('h', 1120);
function ping() { return new Promise(r => { const q = http.get(BASE + 'index.html', res => { res.resume(); r(res.statusCode === 200); }); q.on('error', () => r(false)); q.setTimeout(1500, () => { q.destroy(); r(false); }); }); }
async function measure(page, ms = 4000) {
  return page.evaluate(ms => new Promise(res => {
    const t = []; let last = performance.now(); const end = last + ms; const prof = __gcLoopStats.profile = [];
    const loop = now => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(loop); else { t.shift(); t.sort((a, b) => a - b); const avg = t.reduce((a, b) => a + b, 0) / t.length; __gcLoopStats.profile = null; const P = k => { const a = prof.map(x => x[k]).sort((x, y) => x - y); return [+(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), +a[Math.floor(a.length * .95)].toFixed(1), +a[a.length - 1].toFixed(1)]; }; const slow = prof.filter(x => x[0] > 60).slice(0, 6).map(x => x.map(v => Math.round(v)).join('/')); res({ update: P(1), render: P(2), slow, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(2), p95: +t[Math.floor(t.length * .95)].toFixed(1), worst: +t[t.length - 1].toFixed(1), n: t.length, q: __gcStats().quality, px: __gc.R.renderer.getDrawingBufferSize(new (__gc.rig.camera.position.constructor)()).toArray().slice(0, 2).join('x') }); } };
    requestAnimationFrame(loop);
  }), ms);
}
(async () => {
  if (!(await ping())) { spawn(process.execPath, [path.join(ROOT, 'serve.cjs')], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true }).unref(); for (let i = 0; i < 40 && !(await ping()); i++) await sleep(150); }
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', ...(args.includes('--vsync') ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit']), '--no-first-run', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`, '--user-data-dir=' + path.join(ROOT, 'node_modules', '.cache', 'gc-perf-profile')] });
  const page = await browser.newPage(), errors = [];
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DSF });
  await page.evaluateOnNewDocument(() => { const f = WebGL2RenderingContext.prototype.linkProgram; globalThis.__links = 0; WebGL2RenderingContext.prototype.linkProgram = function (p) { globalThis.__links++; return f.call(this, p); }; });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const go = async url => { await page.goto(BASE + 'index.html?dev=none', { waitUntil: 'domcontentloaded' }); await page.evaluate(() => localStorage.clear()); await page.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await page.waitForFunction('globalThis.__ready===true', { timeout: 60000 }); await sleep(2500); };
  const qs = Q ? '&q=' + Q : '';
  for (const s of scenes.length ? scenes : ['battle']) {
    if (s === 'battle') { await go('?dev=battle' + qs); console.log('battle idle  ', JSON.stringify(await measure(page))); }
    if (s === 'title') { await go('?x=1' + qs); console.log('title        ', JSON.stringify(await measure(page))); }
    if (s === 'map') { await go('?x=1' + qs); await page.evaluate(() => { GC.actions.confirmNewSlot(0, 'normal', 'p', 'easy'); }); await sleep(2500); console.log('map          ', JSON.stringify(await measure(page))); }
    if (s === 'turn') { await go('?dev=battle' + qs); await page.evaluate(() => { __gc.input.endTurn(); }); console.log('battle turn  ', JSON.stringify(await measure(page, 5000))); }
    if (s === 'programs') {
      await go('?dev=battle' + qs);
      const progs = () => page.evaluate(() => __gc.R.renderer.info.programs.map(p => (p.name || '?') + '|' + String(p.cacheKey).replace(/\s+/g, ' ').slice(0, 90) + '#' + p.id));
      const idle = async (max = 40000) => { const t = Date.now(); await sleep(300); while (Date.now() - t < max) { if (!(await page.evaluate(() => GC.busy || __gc.inputLock || (__gc.director?.running > 0)))) break; await sleep(150); } await sleep(300); };
      const seen = new Set(await progs()); let links = await page.evaluate(() => __links); console.log('programs at idle', seen.size, 'linked so far', links);
      const step = async (label, fn) => { await page.evaluate(fn); await idle(); const now = await progs(), fresh = now.filter(p => !seen.has(p)); fresh.forEach(p => seen.add(p)); const l = await page.evaluate(() => __links); console.log(label.padEnd(18), 'shader links during step:', l - links, ' programs alive:', now.length); for (const f of fresh) console.log('     + ' + f); links = l; };
      await step('hover+select', () => { GC.actions.allyTarget(1); });
      await step('skill', () => { const b = GC.battle; b.qi = 30; const u = b.units[1], n = GC.query.unlockedSkills(u.id, u.rankName).find(x => !GC.GD.skillDefs[x].passive); GC.actions.exactSpiritSkill(n); if ((GC.selection.targetMode || '').startsWith('exactEnemy:')) GC.actions.enemyTarget(b.enemies[0].uid); });
      await step('card', () => { const b = GC.battle; b.qi = 30; GC.actions.cancelSelection(); const i = b.hand.indexOf('blade'); GC.actions.selectHand(i); GC.actions.allyTarget(1); });
      await step('end turn', () => { GC.actions.cancelSelection(); __gc.input.endTurn(); });
      await step('player skill', () => { const b = GC.battle; if (!b) return; GC.actions.selectPlayerSkill(0); GC.actions.allyTarget(2); });
      await step('map', () => { GC.actions.exitTestToHome?.(); GC.actions.confirmNewSlot(0, 'normal', 'p', 'easy'); });
    }
    if (s === 'skill') { await go('?dev=battle' + qs); await page.evaluate(() => { GC.preferences.speed = 1; const b = GC.battle; b.qi = 30; GC.actions.allyTarget(2); const u = b.units[2]; const n = GC.query.unlockedSkills(u.id, u.rankName).find(x => !GC.GD.skillDefs[x].passive); GC.actions.exactSpiritSkill(n); if ((GC.selection.targetMode || '').startsWith('exactEnemy:')) GC.actions.enemyTarget(b.enemies[0].uid); }); console.log('battle skill ', JSON.stringify(await measure(page, 3000))); }
  }
  if (args.includes('--toggles')) {
    await go('?dev=battle' + qs);
    const T = async (label, fn) => { await page.evaluate(fn); await sleep(500); console.log(label.padEnd(26), JSON.stringify(await measure(page, 2500))); };
    await T('baseline', () => { });
    await T('ui layer hidden', () => { document.getElementById('ui').style.display = 'none'; });
    await T('ui restored', () => { document.getElementById('ui').style.display = ''; });
    await T('no shadows', () => { __gc.R.renderer.shadowMap.enabled = false; __gc.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); });
    await T('+ atmosphere hidden', () => { for (const k of Object.keys(__gc.atmosphere)) { const o = __gc.atmosphere[k]; if (o && o.isObject3D) o.visible = false; } });
    await T('+ room hidden', () => { __gc.room.group && (__gc.room.group.visible = false); });
    await T('+ opponent hidden', () => { __gc.opponent.group.visible = false; });
    await T('+ lights: keep 3', () => { let n = 0; __gc.scene.traverse(o => { if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight && ++n > 3) o.visible = false; }); __gc.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); });
    await T('+ dpr 1', () => { __gc.R.renderer.setPixelRatio(1); __gc.R.resize(); });
    console.log('light census', JSON.stringify(await page.evaluate(() => { const c = {}; let meshes = 0, sprites = 0, transparent = 0; __gc.scene.traverse(o => { if (o.isLight) c[o.type + (o.castShadow ? '+shadow' : '')] = (c[o.type + (o.castShadow ? '+shadow' : '')] || 0) + 1; if (o.isMesh) meshes++; if (o.isSprite) sprites++; if (o.material && [].concat(o.material).some(m => m.transparent)) transparent++; }); return { ...c, meshes, sprites, transparent, programs: __gc.R.renderer.info.programs.length, textures: __gc.R.renderer.info.memory.textures, geometries: __gc.R.renderer.info.memory.geometries }; })));
  }
  await browser.close();
  if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
