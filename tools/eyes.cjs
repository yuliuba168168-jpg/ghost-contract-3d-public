// 眼睛特写：?dev=battle，相机推到黑影眼前截几个状态。用法：node tools\eyes.cjs [前缀]
const { open, sleep } = require('./play.cjs');
(async () => {
  const pre = process.argv[2] || 'eyes';
  const g = await open('?dev=battle');
  await g.idle(); await sleep(2500);
  await g.ev(() => {
    const c = __gc.rig.camera;
    c.position.set(0, 1.6, -0.2); c.lookAt(0, 1.45, -3.3); c.fov = 30; c.updateProjectionMatrix();
    __gc.rig.update = () => { };
  });
  const clip = { x: 360, y: 280, width: 1200, height: 520 };
  const snap = async n => { await g.page.screenshot({ path: `shots/${pre}_${n}.png`, clip }); console.log(pre + '_' + n); };
  await sleep(500); await snap('idle');
  await g.ev(() => { const o = __gc.opponent; o.reset(); o.play('win'); });
  await sleep(350); await snap('win_a');
  await sleep(500); await snap('win_b');
  await g.ev(() => { const o = __gc.opponent; o.reset(); o.setEyes(1); });
  await sleep(600); await snap('blaze');
  await g.done();
})().catch(e => { console.error(e); process.exit(1); });
