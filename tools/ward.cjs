// 鬼障截图：禁忌 a20-battle 破层序列 + 普通薄帘 + 简单无障。
const { open, sleep } = require('./play.cjs');

async function enterBattle(g, diffCell, diffKey) {
  await g.clickText('建立新旅途'); await sleep(500);
  await g.clickText(diffCell, '.cell'); await sleep(300);
  if (await g.has('确认开始')) await g.clickText('确认开始');
  await sleep(600);
  await g.ev(d => {
    const T = __MAINLINE_TEST__;
    GC.actions.setDifficulty(d);
    for (const a of T.ML.arcs) for (const c of a.contracts) T.grantContract(c);
    GC.state.xp = 1e13; T.trainTeam(45); T.fullHeal(); GC.state.xp = 0; GC.state.squad = null;
    GC.state.available = ['a20-battle']; GC.actions.enterNode('a20-battle');
  }, diffKey);
  await sleep(600);
  (await g.has('查看敌情')) && await g.clickText('查看敌情'); await g.clickText('选择出战鬼灵'); await sleep(400);
  await g.clickText('进入战斗'); await g.idle(20000); await sleep(1000);
  // 部署一名鬼灵，之后用其主动技能破鬼障
  for (const lane of [1, 2]) {
    await g.ev(lane => {
      const b = GC.battle; b.qi = 30;
      const i = b.hand.findIndex(h => typeof h === 'object' || GC.GD.spirits.some(s => s.id === h));
      if (i >= 0) { GC.actions.selectHand(i); GC.actions.allyLane(lane); }
    }, lane);
    await g.idle(20000); await sleep(400);
  }
}
const playCard = async g => {
  // 主动施放一个鬼灵技能 → noteCast 破一层鬼障
  const ok = await g.ev(() => {
    const b = GC.battle; if (!b) return 'nobattle';
    window.__wardUsed ||= new Set();
    let name = null, u = null;
    for (const x of b.units.filter(v => v && !v.dead)) {
      const n = GC.query.unlockedSkills(x.id, x.rankName).find(s => !(GC.GD.skillDefs[s] || {}).toggle && !window.__wardUsed.has(s));
      if (n) { name = n; u = x; break; }
    }
    if (!name) return 'noskill';
    window.__wardUsed.add(name);
    GC.actions.cancelSelection(); GC.actions.allyTarget(u.lane); GC.actions.exactSpiritSkill(name);
    return name;
  });
  console.log('cast:', ok);
  await g.idle(20000); await sleep(700);
};
const playSkillCard = async g => {
  const ok = await g.ev(() => {
    const b = GC.battle; b.qi = 30;
    const ids = ['valhalla', 'bloodmoon', 'taboo', 'revive', 'horse', 'spear', 'whip'];
    let i = b.hand.findIndex(h => ids.includes(h));
    if (i < 0) { b.hand.push('valhalla'); i = b.hand.length - 1; }
    const id = b.hand[i];
    GC.actions.cancelSelection(); GC.actions.selectHand(i);
    if (GC.selection?.targetMode === 'ally') GC.actions.allyTarget(1);
    else GC.actions.enemyTarget(0);
    return id;
  });
  console.log('card:', ok);
  await g.idle(20000); await sleep(700);
};

(async () => {
  const allErr = [];
  let g = await open('');
  await sleep(1500);
  await enterBattle(g, '禁忌', 'taboo');
  console.log('wardInfo:', await g.ev(() => JSON.stringify(GC.query.wardInfo())));
  await g.shot('ward_closed');
  await playCard(g);
  console.log('after 1 cast:', await g.ev(() => JSON.stringify(GC.query.wardInfo())));
  await g.shot('ward_half');
  await playSkillCard(g);
  console.log('after 2 casts:', await g.ev(() => JSON.stringify(GC.query.wardInfo())));
  await g.shot('ward_open');
  await g.ev(() => __gc.input.endTurn()); await g.idle(25000); await sleep(1000);
  console.log('next turn:', await g.ev(() => JSON.stringify(GC.query.wardInfo())));
  await g.shot('ward_reclosed');
  allErr.push(...g.errors); await g.browser.close();

  g = await open('');
  await sleep(1500);
  await enterBattle(g, '普通', 'normal');
  console.log('normal wardInfo:', await g.ev(() => JSON.stringify(GC.query.wardInfo())));
  await g.shot('ward_soft');
  allErr.push(...g.errors); await g.browser.close();

  g = await open('');
  await sleep(1500);
  await enterBattle(g, '简单', 'easy');
  console.log('easy wardInfo:', await g.ev(() => JSON.stringify(GC.query.wardInfo())));
  await g.shot('ward_none');
  allErr.push(...g.errors); await g.browser.close();
  console.log(allErr.length ? 'CONSOLE ISSUES:\n' + [...new Set(allErr)].join('\n') : 'console clean');
})().catch(e => { console.error(e); process.exit(1); });
