const { open, sleep } = require('./play.cjs');
(async () => {
  const g = await open('?dev=battle'); await g.idle(); await sleep(2500);
  await g.ev(() => __gc.cine.setMode('full')); await sleep(300);
  const read = () => g.ev(() => ({ mode: __gc.cine.mode, btn: [...document.querySelectorAll('#hudMenu button')].map(b => b.textContent).find(t => t.startsWith('演出')), toast: [...document.querySelectorAll('[class*=toast]')].map(e => e.textContent).filter(Boolean).join('|') }));
  console.log('start', JSON.stringify(await read()));
  for (let i = 0; i < 3; i++) { await g.page.keyboard.press('v'); await sleep(450); console.log('V', i + 1, JSON.stringify(await read())); if (i === 0) await g.page.screenshot({ path: 'shots/vkey_toast.png' }); }
  await g.ev(() => GC.actions.presentationSettings()); await sleep(700);
  await g.page.screenshot({ path: 'shots/settings_cine.png' });
  console.log(await g.ev(() => [...document.querySelectorAll('.sheet .field')].map(f => f.querySelector('span')?.textContent + ':' + [...f.querySelectorAll('button.on')].map(b => b.textContent).join(',')).join(' | ')));
  console.log(g.errors.length ? 'CONSOLE ISSUES:\n' + g.errors.join('\n') : 'console clean');
  await g.done();
})();
