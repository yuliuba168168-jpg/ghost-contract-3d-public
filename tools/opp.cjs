// 黑影审查截图：每个动画 1100×700 三帧裁切 + 双机位全屏 + 4x 亮度边界检查 + 雾体单位。
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), os = require('os');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SHOTS = path.join(__dirname, '..', 'shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'shell',
    userDataDir: path.join(os.tmpdir(), 'opp-' + Date.now()),
    args: ['--headless=new', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--force-device-scale-factor=1', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  });
  const page = await browser.newPage();
  const msgs = [];
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') msgs.push(t + ': ' + m.text()); });
  page.on('pageerror', e => msgs.push('pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:8790/?dev=battle', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('globalThis.__ready===true', { timeout: 90000 });
  await sleep(3500);

  const opp = async () => page.evaluate(() => {
    const o = window.__gc.opponent, V = window.__gc.rig.camera.position.constructor, v = o.headWorld(new V()).project(window.__gc.rig.camera);
    return { x: Math.round((v.x * .5 + .5) * 1920), y: Math.round((-v.y * .5 + .5) * 1080) };
  });
  const p = await opp();
  const clip = { x: Math.max(0, Math.min(820, p.x - 550)), y: Math.max(0, Math.min(380, p.y - 250)), width: 1100, height: 700 };
  const crop = async name => { await page.screenshot({ path: path.join(SHOTS, name + '.png'), clip }); console.log(name); };

  await page.screenshot({ path: path.join(SHOTS, 'opp_idle_battle.png') });
  await page.evaluate(() => window.__gc.rig.goTo('title', { dur: 600 }));
  await sleep(1300);
  await page.screenshot({ path: path.join(SHOTS, 'opp_title.png') });
  for (const pose of ['title', 'battle', 'enemy', 'map', 'read', 'screen']) {
    await page.evaluate(p => window.__gc.rig.goTo(p, { dur: 50 }), pose);
    await sleep(900);
    const pct = await page.evaluate(() => { const o = window.__gc.opponent, V = window.__gc.rig.camera.position.constructor, v = o.headWorld(new V()).project(window.__gc.rig.camera); return { y: +((1 - (v.y * .5 + .5)) * 100).toFixed(1), x: +((v.x * .5 + .5) * 100).toFixed(1) }; });
    console.log('eye pose', pose, 'eye center from top %', pct.y, 'x %', pct.x);
    await page.screenshot({ path: path.join(SHOTS, `opp_pose_${pose}.png`) });
  }  await page.evaluate(() => window.__gc.rig.goTo('battle', { dur: 600 }));
  await sleep(900);
  await page.evaluate(() => window.__gc.rig.goTo('enemy', { dur: 900 }));
  await sleep(1100);
  await page.screenshot({ path: path.join(SHOTS, 'opp_idle_enemy.png') });
  await page.evaluate(() => window.__gc.rig.goTo('battle', { dur: 900 }));
  await sleep(1100);

  {
    const ec = { x: Math.max(0, p.x - 300), y: Math.max(0, p.y - 150), width: 600, height: 300 };
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    await sleep(900);
    for (let i = 0; i < 4; i++) {
      await page.screenshot({ path: path.join(SHOTS, `opp_eyes_${i}.png`), clip: ec });
      console.log('opp_eyes_' + i);
      await sleep(110);
    }
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await sleep(900);
  }

  const ANIMS = {
    enter: 1800, hit: 900, unitDeath: 1200, allyDeath: 1100, cast: 1200,
    win: 3400, lose: 3000, wardBreak: 900, wardBlock: 800,
    wary: 500, turn: 1400,
  };
  for (const [name, dur] of Object.entries(ANIMS)) {
    await page.evaluate(n => {
      const o = window.__gc.opponent; o.reset(); o.update(.016, 0);
      o.play(n, { lane: 1, amount: 12, tier: 'strong' });
    }, name);
    const t1 = Math.max(60, dur * .18), t2 = dur * .45, t3 = dur * .72;
    await sleep(t1); await crop(`opp_${name}_0`);
    await sleep(t2 - t1); await crop(`opp_${name}_1`);
    await sleep(t3 - t2); await crop(`opp_${name}_2`);
    await page.evaluate(() => { const o = window.__gc.opponent; o.reset(); o.update(.016, 0); });
    await sleep(250);
  }

  // 亮度×4 边界检查
  await page.evaluate(() => { document.querySelector('canvas').style.filter = 'brightness(4)'; });
  await sleep(120);
  await page.screenshot({ path: path.join(SHOTS, 'opp_edges.png') });
  await page.evaluate(() => { document.querySelector('canvas').style.filter = ''; });

  // 雾体单位近景 + 敌方卡面
  await page.evaluate(() => {
    const GC = window.GC;
    GC.battle.enemies = [0, 1, 2].map(i => ({
      uid: 'mz' + i, id: 'nomist' + i, name: '雾中怨灵 · ' + '壹贰叁'[i], type: '恶灵',
      hp: 30 + i * 5, baseHp: 40, atk: 8, lane: i === 2 ? 3 : i, dead: false, bossSkills: i === 1 ? ['x'] : []
    }));
    window.__gc.battle.syncNow();
  });
  await sleep(700);
  await page.evaluate(() => { window.__gc.rig.camera.position.set(0, 2.6, .6); window.__gc.rig.camera.lookAt(0, .9, -1.1); });
  await sleep(200);
  await page.screenshot({ path: path.join(SHOTS, 'opp_units.png') });

  console.log(msgs.length ? 'CONSOLE:\n' + msgs.join('\n') : 'console clean');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
