const { open, sleep } = require('./play.cjs');
const LX = [-1.95, -.65, .65, 1.95];
const storyArg = (process.argv.find(a => a.startsWith('--story=')) || '').slice(8), acts = +(process.argv[2] || 2), shots = !process.argv.includes('--noshots'), mode = (process.argv.find(a => a.startsWith('--mode=')) || '--mode=普通').slice(7);

async function clickHand(g, index) {
  const p = await g.ev(i => { const it = __gc.battle.hand.itemAt(i); if (!it) return null; const v = it.card.group.localToWorld(new (__gc.rig.camera.position.constructor)(-.3, .45, 0)); v.project(__gc.rig.camera); return [(v.x * .5 + .5) * innerWidth, Math.min(innerHeight - 6, (-v.y * .5 + .5) * innerHeight)]; }, index);
  if (!p) throw new Error('no hand item ' + index);
  await g.page.mouse.move(p[0], p[1]); await sleep(260);
  const q = await g.ev(i => { const it = __gc.battle.hand.itemAt(i); const v = it.card.group.localToWorld(new (__gc.rig.camera.position.constructor)(-.3, .45, 0)); v.project(__gc.rig.camera); return [(v.x * .5 + .5) * innerWidth, Math.min(innerHeight - 6, (-v.y * .5 + .5) * innerHeight)]; }, index);
  await g.page.mouse.click(q[0], q[1]); await sleep(200);
}
async function fight(g, tag) {
  await g.idle(); await sleep(400);
  if (shots) await g.shot(`e2e_${tag}_start`);
  for (let turn = 0; turn < 40; turn++) {
    if (!(await g.ev(() => !!GC.battle))) break;
    for (let k = 0; k < 6; k++) {
      const plan = await g.ev(() => {
        const b = GC.battle; if (!b) return null;
        const cost = GC.query.spiritCost(); if (b.qi < cost) return null;
        const hi = b.hand.findIndex(e => GC.query.handSpirit(e)); if (hi < 0) return null;
        const lanes = [0, 1, 2, 3].filter(l => !b.units[l]); if (!lanes.length) return null;
        const lane = lanes.find(l => b.enemies.some(e => !e.dead && e.lane === l)) ?? lanes[0];
        return { hi, lane };
      });
      if (!plan) break;
      await clickHand(g, plan.hi);
      const sel = await g.ev(() => GC.selection.targetMode);
      if (sel !== 'deploy') throw new Error('hand click did not select: ' + JSON.stringify(await g.ev(() => GC.selection)));
      if (shots && turn === 0 && k === 0) await g.shot(`e2e_${tag}_deploymode`);
      await g.clickWorld(LX[plan.lane], .02, .7);
      await sleep(250);
      if (shots && turn === 0 && k === 0) await g.shot(`e2e_${tag}_deploying`);
      await g.idle();
    }
    if (shots && turn === 0) await g.shot(`e2e_${tag}_deployed`);
    const [bx, by] = await g.project(3.62, .45, 1.62);
    await g.page.mouse.move(bx, by); await sleep(80); await g.page.mouse.click(bx, by);
    if (shots && turn < 1) for (let i = 0; i < 4; i++) { await sleep(520); await g.shot(`e2e_${tag}_t${turn}_${i}`); }
    if (!(await g.idle(60000))) throw new Error('turn did not settle');
    await sleep(300);
  }
  await sleep(1200);
}
(async () => {
  const g = await open('');
  await sleep(1800);
  if (storyArg) await g.ev(m => localStorage.setItem('gc3d-story-mode', m), storyArg === 'plain' ? 'plain' : 'stage');
  await g.clickText('建立新旅途'); await sleep(300);
  if (mode !== '普通') await g.clickText(mode, '.cell');
  await g.clickText('确认开始'); await sleep(2000);
  let guard = 0, defeats = 0; const trained = new Set();
  while (guard++ < 400) {
    const st = await g.ev(() => ({ base: __gc.screens.base, sheet: document.querySelector('.sheet .kicker')?.textContent || (document.querySelector('.story-click') && document.querySelector('.story-click').style.display !== 'none' ? document.querySelector('.story-bar')?.dataset.kicker || '剧情' : ''), title: document.querySelector('.sheet h2')?.textContent || (document.querySelector('.story-click') && document.querySelector('.story-click').style.display !== 'none' ? document.querySelector('.story-bar')?.dataset.title || '' : ''), battle: !!GC.battle, act: GC.NODES[GC.state.available?.[0]]?.act, avail: GC.state.available, wave: GC.state.wave, busy: GC.busy || __gc.director.running > 0 }));
    if (st.busy) { await sleep(200); continue; }
    if (st.sheet) {
      const b = async (...names) => { for (const n of names) if (await g.has(n)) { await g.clickText(n); return true; } return false; };
      if (st.sheet.includes('战后结算') || st.sheet.includes('调查所得') || st.sheet.includes('无尽 ·')) {
        if (shots && guard < 30) await g.shot('e2e_settlement');
        if (await g.ev(() => !!document.querySelector('.sheet [data-act=pick]'))) { await g.ev(() => document.querySelector('.sheet [data-act=pick]').click()); await sleep(350); }
        else if (await g.ev(() => !!document.querySelector('.sheet [data-act=rep]'))) { await g.ev(() => document.querySelector('.sheet [data-act=rep]').click()); await sleep(350); }
        else await b('继续');
      } else if (st.sheet.includes('牌组已满')) { await g.ev(() => document.querySelector('.sheet [data-act=rep]').click()); await sleep(350); }
      else if (st.sheet.includes('战前情报')) { if (shots && guard < 30) await g.shot('e2e_intel'); if (!trained.has(st.title)) { trained.add(st.title); await b('升级与备战'); await sleep(200); await b('按推荐培养'); await b('全队恢复'); if (shots) await g.shot('e2e_training'); await b('返回'); await sleep(250); } await b('选择出战鬼灵'); }
      else if (st.sheet.includes('出战')) { if (shots && guard < 30) await g.shot('e2e_prepare'); await b('进入战斗'); await sleep(600); }
      else if (st.sheet.includes('篝火')) { if (shots && guard < 60) await g.shot('e2e_camp'); await b('修行与恢复'); await sleep(200); await b('按推荐培养'); await b('全队恢复'); await b('返回'); await sleep(200); await b('离开篝火'); await sleep(900); if ((st.act || 0) >= acts) break; }
      else if (st.sheet.includes('调查')) await b('完成调查');
      else if (st.sheet.includes('修行')) await b('返回');
      else if (st.sheet.includes('命灯尽灭')) { console.log('DEFEAT at', st.title); if (shots) await g.shot('e2e_defeat'); if (++defeats > 3) break; trained.clear(); await b('从篝火继续'); }
      else if (st.sheet.includes('终局')) { console.log('FALLEN'); break; }
      else if (st.sheet.includes('终幕')) { await g.shot('e2e_ending'); await b('完成并回到标题'); break; }
      else if (st.sheet.includes('契约')) { if (shots) await g.shot('e2e_contract_' + guard); await b('缔结契约', '继续'); }
      else { if (shots && guard < 6) await g.shot('e2e_event'); if (!(await b('查看敌情', '继续', '缔结契约', '知道了', '合上', '返回'))) throw new Error('stuck on sheet ' + st.sheet + ' / ' + st.title); }
      await sleep(250);
      continue;
    }
    if (st.battle) { await fight(g, 'a' + (st.act || 0) + '_' + guard); continue; }
    if (st.base === 'endless') { if (st.wave > acts) break; await g.clickText('查看敌情并出战'); continue; }
    if (st.base === 'map') {
      const pick = await g.ev(() => { const a = GC.state.available, suffix = Math.random() < .5 ? '-explore' : '-trial'; return a.find(id => id.endsWith('-camp')) && a.length > 1 ? a.find(id => id.endsWith(suffix)) : a[0]; });
      if (!pick) throw new Error('no available node');
      const pos = await g.ev(id => { const m = [...__gc.scene.children].length; return null; }, pick);
      void pos;
      await sleep(700);
      if (shots && guard < 12) await g.shot('e2e_map_' + guard);
      const ok = await g.ev(id => { const before = GC.state.current; GC.actions.enterNode(id); return GC.state.current === id || before === id; }, pick);
      if (!ok) throw new Error('enterNode failed ' + pick);
      await sleep(500);
      continue;
    }
    await sleep(300);
  }
  console.log(JSON.stringify(await g.ev(() => ({ act: GC.NODES[GC.state.available?.[0]]?.act, xp: GC.state.xp, spirits: GC.state.spirits.map(s => `${s.name}:${s.rankName}:${Math.round(s.hp)}/${s.maxHp}${s.dead ? ':dead' : ''}`), deck: GC.state.deck.length, completed: GC.state.completed.length, wave: GC.state.wave, stats: __gcStats() }))));
  await g.done();
})().catch(e => { console.error(e); process.exit(1); });
