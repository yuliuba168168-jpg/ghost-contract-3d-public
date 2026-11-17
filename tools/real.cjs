// 写实化对照截图。用法：node tools\real.cjs before|after [close]
const { open, sleep } = require('./play.cjs');
(async () => {
  const mode = process.argv[2] || 'after', pre = 'real_' + mode + '_';
  const errs = [];
  let g = await open('');
  await sleep(2500); await g.shot(pre + 'title');
  await g.clickText('建立新旅途'); await sleep(500); await g.clickText('确认开始'); await sleep(2500); await g.shot(pre + 'map');
  errs.push(...g.errors); await g.browser.close();
  g = await open('?dev=battle');
  await g.idle(); await sleep(2500); await g.shot(pre + 'battle');
  if (mode === 'after') {
    const crop = async (name, x, y) => { await g.page.screenshot({ path: `shots/real_close_${name}.png`, clip: { x, y, width: 800, height: 600 } }); console.log('close', name); };
    await crop('candle', 0, 100); await crop('censer', 140, 380); await crop('table', 640, 420); await crop('wall', 560, 0);
  }
  await g.ev(() => __gc.rig.goTo('enemy', { dur: 600 })); await sleep(1500); await g.shot(pre + 'enemy');
  errs.push(...g.errors); await g.browser.close();
  if (mode === 'after') {
    g = await open('?dev=battle&q=low');
    await g.idle(); await sleep(2500); await g.shot(pre + 'battle_low');
    errs.push(...g.errors); await g.browser.close();
  }
  console.log(errs.length ? 'CONSOLE ISSUES:\n' + [...new Set(errs)].join('\n') : 'console clean');
})().catch(e => { console.error(e); process.exit(1); });
