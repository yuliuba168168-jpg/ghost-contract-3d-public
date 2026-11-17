// 全屏技能演出验收：node tools\cine.cjs
const { open, sleep } = require('./play.cjs');
(async () => {
  const g = await open('?dev=battle'); await g.idle(); await sleep(2500);
  const shot = async n => { await g.page.screenshot({ path: `shots/cine_${n}.png` }); console.log('cine_' + n); };
  const ids = await g.ev(() => { const by = n => GC.GD.spirits.find(s => s.name === n)?.id; return { 囡囡: by('囡囡'), 曦仪: by('曦仪'), 太阴: by('太阴星君'), 孟婆: by('孟婆'), 夜霜: by('夜霜'), 月阙: by('月阙女王'), 江薇: by('江薇'), 童童: 'tong', 萱华: 'xuan' }; });
  console.log(JSON.stringify(ids));
  const frames = async (name, req, pts) => {
    await g.ev(r => { __gc.cine.setMode('full'); __gc.cine.play(r); }, req);
    for (let i = 0; i < pts.length; i++) { await g.ev(P => { __gc.cine.freeze(true); __gc.cine.seek(P); }, pts[i]); await sleep(260); await shot(`${name}_${i}`); }
    await g.ev(() => { __gc.cine.freeze(false); __gc.cine.skip(); }); await sleep(300);
  };
  const SK = (name, tier, theme, who, side = 'ally') => ({ kind: 'skill', name, tier, theme, side, portrait: who ? { id: ids[who] || who, name: who } : null, sub: '副题示例' });
  for (const [n, th, w] of [['鬼瞳', 'eye', '萱华'], ['寒冰右手', 'ice', '童童']]) await frames(n, SK(n, n === '鬼瞳' ? 1 : 2, th, w), [.5]);
  for (const [n, th, w] of [['时间回退', 'clock', '江薇'], ['云梦泽', 'cloud', '萱华'], ['空间规律', 'space', '童童'], ['不完全火焰规律', 'inferno', '月阙']]) await frames(n, SK(n, 3, th, w), [.15, .5, .93]);
  const S4 = [['绝望', 'despair', '囡囡'], ['鬼主权杖', 'royal', '曦仪'], ['太阴之力', 'moon', '太阴'], ['轮回', 'reincarnation', '孟婆'], ['鬼门关降临', 'gate', '夜霜'], ['女王领域', 'queen', '月阙'], ['半完全火焰规律', 'inferno', '月阙']];
  for (const [n, th, w] of S4) await frames(n, SK(n, 4, th, w), [.08, .3, .55, .75, .96]);
  for (const [id, r] of [['coin', 1], ['blade', 2], ['rope', 3], ['taboo', 4]]) await frames('card_' + r, { kind: 'card', cardId: id, name: id, tier: r, theme: 'ink', side: 'ally' }, [.5]);
  await frames('player', { kind: 'player', index: 0, name: '血祭增幅', tier: 3, theme: 'bloodsacrifice', side: 'ally' }, [.5]);
  for (const t of [1, 2, 3]) await frames('boss' + t, { kind: 'boss', name: '噬魂', tier: t, theme: 'eye', side: 'enemy' }, [.5]);
  await frames('ink', SK('月阙示例', 3, 'moon', 'no_such_art'), [.5]);
  for (const m of ['full', 'smart', 'table']) { await g.ev(m => { __gc.cine.setMode(m); __gc.cine.resetSeen(); __gc.cine.play({ kind: 'skill', name: '寒冰右手', tier: 2, theme: 'ice', side: 'ally', portrait: { id: 'tong', name: '童童' } }); __gc.cine.freeze(true); __gc.cine.seek(.5); }, m); await sleep(300); await shot('mode_' + m); await g.ev(() => { __gc.cine.freeze(false); __gc.cine.skip(); }); await sleep(200); }
  await g.ev(() => __gc.cine.setMode('full'));
  await g.ev(() => __gc.cine.play({ kind: 'skill', name: '云梦泽', tier: 3, theme: 'cloud', side: 'ally', portrait: { id: 'tong', name: '童童' } }));
  await sleep(800); await shot('skip_before'); await g.page.mouse.click(960, 540); await sleep(300); await shot('skip_after');
  console.log('active after skip:', await g.ev(() => __gc.cine.active));
  // 真实施放
  for (const [who, name, tag] of [['夜霜', '鬼门关降临', 'real_gate'], ['童童', '寒冰右手', 'real_ice'], ['江薇', '画卷绝杀', 'real_scroll']]) {
    await g.ev((id, nm) => {
      GC.actions.startTestBattle({ playerHp: 10, enemyHp: 10, qi: 30, xp: 100000000, allies: [{ on: true, id, rank: '神阶' }], enemies: ['0', '1', '2'].map(pos => ({ on: true, name: '试炼恶灵' + pos, pos, atk: 50, hp: 9e7, rank: '圣灵二阶', potential: 3 })), cards: ['coin'], draw: ['coin'] });
    }, ids[who] || who, name);
    await g.idle(); await sleep(800);
    await g.ev(() => { GC.actions.selectHand(0); GC.actions.allyLane(1); }); await g.idle();
    const sk = await g.ev((nm) => { const u = GC.battle.units[1]; return u ? GC.query.unlockedSkills(u.id, u.rankName).includes(nm) : null; }, name);
    console.log(tag, 'has skill', sk);
    await g.ev(nm => { GC.battle.qi = 30; GC.actions.cancelSelection(); GC.actions.allyTarget(1); GC.actions.exactSpiritSkill(nm); }, name);
    await sleep(250);
    await g.ev(() => { const m = String(GC.selection?.targetMode || ''); window.__tm = m; if (/enemy/i.test(m)) { const b = GC.battle; const alive = b.enemies.filter(e => !e.dead); if (String(m).includes('画卷绝杀')) alive[2].hp = alive[2].maxHp * .1; try { GC.actions.enemyTarget((String(m).includes('画卷绝杀') ? alive[2] : alive[0]).uid); } catch { } } else if (/ally/i.test(m)) GC.actions.allyTarget(1); });
    console.log(tag, 'target mode', await g.ev(() => window.__tm), 'cine active', await g.ev(() => __gc.cine.active));
    for (const [lvl, suf] of [[.55, '_a'], [.8, '_b']]) { for (let i = 0; i < 80; i++) { if (await g.ev(l => __gc.cine.active && __gc.cine.progress >= l, lvl)) break; await sleep(60); } await g.ev(() => __gc.cine.freeze(true)); await shot(tag + suf); await g.ev(() => __gc.cine.freeze(false)); }
    const t0 = Date.now(); await g.idle(30000); console.log(tag, 'busy done +ms', Date.now() - t0 + 2200);
    await g.ev(() => GC.actions.exitTestBattle?.()); await sleep(800);
  }
  console.log(g.errors.length ? 'CONSOLE ISSUES:\n' + [...new Set(g.errors)].join('\n') : 'console clean');
  await g.done();
})().catch(e => { console.error(e); process.exit(1); });
