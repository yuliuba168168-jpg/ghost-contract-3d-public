const { open, sleep } = require('./play.cjs');
const SHOTS = { '绝望': 900, '鬼主权杖': 700, '鬼门关降临': 800, '鬼瞳': 700, '火凤燎原+': 600, '半完全火焰规律': 600, '英灵领域': 700, '云梦泽+': 700 };
(async () => {
  const g = await open('');
  await sleep(1200);
  await g.ev(() => { GC.preferences.speed = 2.4; });
  if (process.env.GC_CINE) await g.ev(m => __gc.cine.setMode(m), process.env.GC_CINE);
  const spirits = await g.ev(() => GC.GD.spirits.map(s => ({ id: s.id, name: s.name })));
  const only = process.argv[2];
  let casts = 0;
  const start = async id => {
    await g.ev(id => {
      GC.actions.startTestBattle({
        playerHp: 10, enemyHp: 10, qi: 30, xp: 100000000,
        allies: [{ on: true, id, rank: id === 'nannan' ? '禁忌' : '神阶' }, { on: true, id: id === 'tong' ? 'xuan' : 'tong', rank: '圣灵三阶' }],
        enemies: [{ on: true, name: '试炼恶灵壹', pos: '0', atk: 50, hp: 9e7, rank: '圣灵二阶', potential: 3 }, { on: true, id: id === 'yuzao' ? 'xuenv' : 'yuzao', rank: '英灵二阶', pos: '1' }, { on: true, name: '试炼恶灵叁', pos: '3', atk: 30, hp: 9e7, rank: 'A级', potential: 1 }],
        cards: ['coin', 'rope', 'blade', 'relic', 'bloodmoon', 'taboo', 'revive', 'horse', 'valhalla'], draw: ['coin25', 'coin40', 'coin100', 'spear', 'whip']
      });
    }, id);
    await g.idle();
    await g.ev(() => { GC.actions.selectHand(0); GC.actions.allyLane(1); }); await g.idle();
    await g.ev(() => { GC.battle.qi = 30; GC.actions.selectHand(0); GC.actions.allyLane(2); }); await g.idle();
  };
  for (const s of spirits) {
    if (only && s.id !== only) continue;
    await start(s.id);
    const skills = await g.ev(() => { const u = GC.battle.units[1]; return GC.query.unlockedSkills(u.id, u.rankName).filter(n => !GC.GD.skillDefs[n]?.passive); });
    for (const name of skills) {
      const ok = await g.ev(() => !!GC.battle && GC.battle.units[1] && GC.battle.enemies.filter(e => !e.dead).length >= 2);
      if (!ok) { await g.ev(() => { if (GC.battle?.testMode || !GC.battle) __gc.screens.closeSheet(); }); await start(s.id); }
      const r = await g.ev(name => {
        const b = GC.battle, u = b.units[1], A = GC.actions;
        b.qi = 30; u.cooldowns = {}; u.onceUsed = {};
        A.cancelSelection(); A.allyTarget(1); A.exactSpiritSkill(name);
        let m = GC.selection.targetMode || '';
        const alive = b.enemies.filter(e => !e.dead);
        if (m.startsWith('exactEnemy:')) { if (name === '画卷绝杀') alive[2].hp = alive[2].maxHp * .1; A.enemyTarget((name === '画卷绝杀' || name === '鬼主权杖' ? alive[2] : alive[0]).uid); m = GC.selection.targetMode || ''; if (m.startsWith('confuseSecond:')) A.enemyTarget(alive[1].uid); }
        else if (m.startsWith('exactAlly:')) A.allyTarget(2);
        return { busy: GC.busy, mode: GC.selection.targetMode };
      }, name);
      casts++;
      if (SHOTS[name]) { await sleep(SHOTS[name] / 2.4 + 250); await g.shot('m3_' + name.replace(/\+/g, 'p')); }
      if (!(await g.idle(20000))) throw new Error('skill did not settle: ' + s.name + ' ' + name);
      if (name === '绝望') { await sleep(500); await g.shot('m3_绝望_after'); }
    }
    if (s.id === 'tong') {
      for (const [i, lane] of [[0, 1], [1, 2], [2, 1]]) { await g.ev((i, lane) => { const b = GC.battle; if (!b) return; b.playerSkillsUsed = {}; b.will = 10; GC.actions.cancelSelection(); GC.actions.selectPlayerSkill(i); GC.actions.allyTarget(lane); }, i, lane); await sleep(500); if (i !== 1) await g.shot('m3_player' + i); await g.idle(); }
      await sleep(400); await g.shot('m3_auras');
      for (const id of ['coin', 'blade', 'horse', 'bloodmoon', 'revive', 'valhalla', 'rope', 'relic', 'taboo']) {
        await g.ev(id => { const b = GC.battle; if (!b) return; b.qi = 30; const i = b.hand.indexOf(id); if (i < 0) return; GC.actions.cancelSelection(); GC.actions.selectHand(i); if (GC.selection.targetMode === 'ally') GC.actions.allyTarget(b.units[2] ? 2 : 1); }, id);
        await sleep(350); if (id === 'bloodmoon') await g.shot('m3_card_bloodmoon'); await g.idle();
      }
    }
    if (await g.ev(() => !!GC.battle)) { for (let k = 0; k < 2; k++) { await g.ev(() => { if (GC.battle) __gc.input.endTurn(); }); if (k === 0 && s.id === 'xuan') { await sleep(1500); await g.shot('m3_enemy_turn'); } if (!(await g.idle(40000))) throw new Error('turn did not settle: ' + s.name); } }
    await g.ev(() => { __gc.screens.closeSheet(); });
    console.log('ok', s.name, skills.length);
  }
  console.log('casts', casts, JSON.stringify(await g.ev(() => __gcStats())));
  await g.done();
})().catch(e => { console.error(e); process.exit(1); });
