// Browser checks for flows that were previously untested: difficulty choice, defeat rollback, hardcore death,
// export/import round trip, full-deck replacement, difficulty change, and the final act (46) battle.
const { open, sleep } = require('./play.cjs');
const assert = require('node:assert/strict');
(async () => {
  const g = await open('');
  const sheetKicker = () => g.ev(() => document.querySelector('.sheet .kicker')?.textContent || '');
  await sleep(1500);
  await g.clickText('建立新旅途'); await g.clickText('噩梦', '.cell'); await sleep(200); await g.shot('f_slot_difficulty');
  await g.clickText('确认开始'); await sleep(1800);
  assert.equal(await g.ev(() => GC.state.difficulty), 'nightmare');
  await g.clickText('难度'); await sleep(300); await g.clickText('困难', '.cell'); await sleep(400);
  assert.equal(await g.ev(() => GC.state.difficulty), 'hard');
  // defeat rollback (normal mode)
  await g.ev(() => GC.actions.enterNode(GC.state.available[0])); await sleep(300); await g.clickText('继续'); await sleep(700);
  await g.ev(() => GC.actions.enterNode(GC.state.available[0])); await sleep(300); (await g.has('查看敌情')) && await g.clickText('查看敌情'); await g.clickText('选择出战鬼灵'); await g.clickText('进入战斗'); await g.idle(); await sleep(600);
  assert.ok(await g.ev(() => !!GC.battle));
  await g.ev(() => { GC.battle.will = 0; loseBattle(); }); await sleep(2600);
  assert.match(await sheetKicker(), /命灯尽灭/); await g.shot('f_defeat');
  await g.clickText('从篝火继续'); await sleep(900);
  assert.equal(await g.ev(() => __gc.screens.base), 'map'); assert.equal(await g.ev(() => GC.battle), null);
  // full deck replacement
  await g.ev(() => { GC.state.deck = Array(25).fill('coin'); GC.state.pendingSettlement = { node: 'a01-battle', title: '替换测试', xp: 0, cards: 1, remaining: 1, candidates: null }; GC.actions.renderSettlement(); }); await sleep(400);
  await g.ev(() => document.querySelector('.sheet [data-act=pick]').click()); await sleep(400);
  assert.match(await sheetKicker(), /牌组已满/); await g.shot('f_replace');
  await g.ev(() => document.querySelector('.sheet [data-act=rep]').click()); await sleep(400);
  assert.deepEqual(await g.ev(() => [GC.state.deck.length, GC.state.pendingSettlement.remaining, GC.state.deck.filter(c => c !== 'coin').length <= 1]), [25, 0, true]);
  await g.clickText('继续'); await sleep(500);
  // export / import round trip
  const before = await g.ev(() => GC.actions.exportSlotsData());
  await g.ev(() => { GC.state.xp += 777; save(); });
  const r = await g.ev(json => GC.actions.importSlotsData(json), before); await sleep(600);
  assert.equal(r.ok, true); assert.equal(await g.ev(() => GC.actions.exportSlotsData()), before); assert.equal(await g.ev(() => __gc.screens.base), 'home');
  assert.equal((await g.ev(() => GC.actions.importSlotsData('{"version":2,"slots":[1]}'))).ok, false);
  // hardcore death
  await g.ev(() => [...document.querySelectorAll('.slot')][1].querySelector('button').click()); await sleep(300);
  await g.clickText('极限', '.cell'); await g.clickText('确认开始'); await sleep(1600);
  await g.ev(() => GC.actions.enterNode(GC.state.available[0])); await sleep(300); await g.clickText('继续'); await sleep(700);
  await g.ev(() => GC.actions.enterNode(GC.state.available[0])); await sleep(300); (await g.has('查看敌情')) && await g.clickText('查看敌情'); await g.clickText('选择出战鬼灵'); await g.clickText('进入战斗'); await g.idle(); await sleep(500);
  await g.ev(() => { GC.battle.will = 0; loseBattle(); }); await sleep(2600);
  assert.match(await sheetKicker(), /终局/); await g.clickText('回到标题'); await sleep(900);
  assert.deepEqual(await g.ev(() => [GC.slots[1].fallen, GC.actions.loadSlot(1)]), [true, false]);
  // final act on easy
  assert.equal(await g.ev(() => GC.actions.loadSlot(3)), true); await sleep(900);
  await g.ev(() => { const T = __MAINLINE_TEST__; GC.actions.setDifficulty('easy'); for (const a of T.ML.arcs) for (const c of a.contracts) T.grantContract(c); GC.state.xp = 1e13; T.trainTeam(45); T.fullHeal(); GC.state.xp = 0; GC.state.squad = null; GC.state.available = ['a46-battle']; save(); GC.actions.renderMap(); }); await sleep(1500);
  assert.equal(await g.ev(() => GC.state.spirits.length), 22);
  await g.shot('f_map46');
  await g.ev(() => GC.actions.enterNode('a46-battle')); await sleep(500); await g.shot('f_intel46');
  (await g.has('查看敌情')) && await g.clickText('查看敌情'); await g.clickText('选择出战鬼灵'); await sleep(300); await g.clickText('进入战斗'); await g.idle(); await sleep(700);
  const life = await g.ev(() => [GC.battle.maxWill, GC.battle.maxEnemyWill, Math.max(...GC.state.spirits.filter(s => GC.state.squad.includes(s.id)).map(s => s.maxHp))]);
  assert.equal(life[0], life[2]); assert.ok(life[0] > 10);
  for (let k = 0; k < 3; k++) { const ok = await g.ev(() => { const b = GC.battle; if (!b) return false; const i = b.hand.findIndex(e => GC.query.handSpirit(e)), l = [0, 1, 2, 3].find(x => !b.units[x]); if (i < 0 || l == null || b.qi < GC.query.spiritCost()) return false; GC.actions.selectHand(i); GC.actions.allyLane(l); return true; }); if (!ok) break; await g.idle(); }
  await g.shot('f_battle46');
  await g.ev(() => __gc.input.endTurn()); await sleep(2600); await g.shot('f_battle46_enemy'); await g.idle(60000);
  console.log('PASS flows', JSON.stringify(life));
  await g.done();
})().catch(e => { console.error(e); process.exit(1); });
