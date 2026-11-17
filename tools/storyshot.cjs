// 剧情实景截图：story_{blood,ash,shadow}_{0,1,2} + story_seal + story_ending + story_setting，并估算正文字号
const { open, sleep } = require('./play.cjs');
(async () => {
  const g = await open('');
  await sleep(1800);
  await g.clickText('建立新旅途'); await sleep(400); await g.clickText('确认开始'); await sleep(2800);
  const px = (worldW, worldX, worldY, worldZ, canvasW, fs) => g.ev((a) => {
    const cam = __gc.rig.camera, V = cam.position.constructor, f = (x) => { const v = new V(x, a[2], a[3]).project(cam); return (v.x * .5 + .5) * innerWidth; };
    return Math.abs(f(a[1] + a[0] / 2) - f(a[1] - a[0] / 2)) / a[4] * a[5];
  }, [worldW, worldX, worldY, worldZ, canvasW, fs]);
  await g.ev(() => { const T = __MAINLINE_TEST__; for (const a of T.ML.arcs) for (const c of a.contracts) T.grantContract(c); });
  const ids = await g.ev(() => {
    const N = GC.NODES, M = GC.MAIN_KEYS, ks = Object.keys(N).filter(k => M.has(k));
    return { intro: ks.find(k => N[k].chapterIntro), contract: ks.find(k => N[k].contract && !N[k].chapterIntro), fork: ks.find(k => k.endsWith('-fork')), battle: ks.find(k => N[k].type === 'battle' && GC.STORY[N[k].story]) };
  });
  console.log(JSON.stringify(ids));
  const shotStyle = async (name, show, y, sz) => {
    await g.ev(show); await sleep(2300);
    await g.page.screenshot({ path: `shots/story_${name}_0.png` }); console.log('story_' + name + '_0');
    await g.page.mouse.click(960, 540); await sleep(1800);
    await g.page.screenshot({ path: `shots/story_${name}_1.png` }); console.log('story_' + name + '_1');
    const fs = await px(...sz);
    console.log(name, 'body font px ≈', Math.round(fs));
    const bar = await g.ev(() => document.querySelectorAll('.story-bar button').length + '|' + [...document.querySelectorAll('.story-bar button')].map(b => b.textContent).join(','));
    console.log(name, 'bar', bar);
    return fs;
  };
  await shotStyle('shadow', ids => 0, 0, [3.8, 0, 0, -2.4, 1024, 54]).catch(() => { });
  await g.ev((id) => { __gc.storyStage.hide(); }, ids.intro); await sleep(1500);
  // shadow
  await g.ev((id) => __gc.screens.show('event', { id }), ids.intro); await sleep(2800);
  await g.page.screenshot({ path: 'shots/story_shadow_0.png' }); console.log('story_shadow_0');
  await g.page.mouse.click(960, 540); await sleep(1800);
  await g.page.screenshot({ path: 'shots/story_shadow_1.png' }); console.log('story_shadow_1');
  console.log('shadow font px ≈', Math.round(await px(3.8, 0, 0, -2.4, 1024, 54)), await g.ev(() => [...document.querySelectorAll('.story-bar button')].map(b => b.textContent).join(',')));
  await g.ev(() => __gc.storyStage.hide()); await sleep(450);
  await g.page.screenshot({ path: 'shots/story_shadow_2.png' }); console.log('story_shadow_2'); await sleep(1500);
  // blood
  await g.ev((id) => __gc.screens.show('event', { id }), ids.contract); await sleep(2800);
  await g.page.screenshot({ path: 'shots/story_blood_0.png' }); console.log('story_blood_0');
  await g.page.mouse.click(960, 540); await sleep(1800);
  await g.page.screenshot({ path: 'shots/story_blood_1.png' }); console.log('story_blood_1');
  console.log('blood font px ≈', Math.round(await px(3.3, .1, .04, .25, 1024, 50)), await g.ev(() => [...document.querySelectorAll('.story-bar button')].map(b => b.textContent).join(',')));
  await g.ev(() => __gc.storyStage.hide()); await sleep(700);
  await g.page.screenshot({ path: 'shots/story_blood_2.png' }); console.log('story_blood_2'); await sleep(2000);
  // seal: 再来一次契约纸，点“缔结契约”
  await g.ev((id) => __gc.screens.show('event', { id }), ids.contract); await sleep(2500); await g.page.mouse.click(960, 540); await sleep(1500);
  await g.ev(() => { [...document.querySelectorAll('.story-bar button')].find(b => b.textContent.includes('缔结契约'))?.click(); }); await sleep(520);
  await g.page.screenshot({ path: 'shots/story_seal.png' }); console.log('story_seal'); await sleep(2500);
  // ash
  await g.ev((id) => __gc.screens.show('event', { id }), ids.fork); await sleep(3000);
  await g.page.screenshot({ path: 'shots/story_ash_0.png' }); console.log('story_ash_0');
  await g.page.mouse.click(960, 540); await sleep(1800);
  await g.page.screenshot({ path: 'shots/story_ash_1.png' }); console.log('story_ash_1');
  console.log('ash font px ≈', Math.round(await px(3.9, 0, .03, 0, 1024, 50)), await g.ev(() => [...document.querySelectorAll('.story-bar button')].map(b => b.textContent).join(',')));
  await g.ev(() => __gc.storyStage.hide()); await sleep(600);
  await g.page.screenshot({ path: 'shots/story_ash_2.png' }); console.log('story_ash_2'); await sleep(1800);
  // ending
  await g.ev(() => __gc.screens.show('ending', {})); await sleep(2800); await g.page.mouse.click(960, 540); await sleep(1800);
  await g.page.screenshot({ path: 'shots/story_ending.png' }); console.log('story_ending');
  await g.ev(() => __gc.storyStage.hide()); await sleep(1500);
  // settings
  await g.ev(() => __gc.screens.show('settings', {})); await sleep(600);
  await g.page.screenshot({ path: 'shots/story_setting.png' }); console.log('story_setting');
  await g.done();
})().catch(e => { console.error(e); process.exit(1); });
