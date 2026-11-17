// 平衡模拟的路线循环与统计（由 balance_sim.cjs 载入）。
const { A, GC, Q, X, GX, ORDER, FORK, PACT, VERBOSE: VERB0, RETRY, playTurn, setSeed } = require('./balance_sim.cjs');
const VERBOSE = +process.env.SIM_VERBOSE || 0, N = +(process.argv[2] || 2), DIFFS = process.argv[3] ? process.argv[3].split(',') : ORDER;
const OVER = +(process.env.SIM_OVER || 0);   // 允许用富余经验越过本幕等级多少级
const FORK_ORDER = ['explore', 'trial', 'shop', 'omen'];

function pickSquad(st) { st.squad = st.spirits.filter(s => s.id !== 'nannan' && !s.dead).sort((a, b) => b.rankIndex - a.rankIndex || b.atk - a.atk).slice(0, 6).map(s => s.id); }
// 只练出战的前 4 只：一级一级轮流升，直到到达本幕等级或经验不够
function train(st, arcIndex) {
  const target = Math.min(GC.GD.ranks.length - 1, Math.max(0, A.ML.arcs[arcIndex].rank) + OVER), top = st.squad.map(i => st.spirits.find(s => s.id === i)).slice(0, 4);
  for (let g = 0; g < 200; g++) { const s = top.filter(x => x.rankIndex < target).sort((a, b) => a.rankIndex - b.rankIndex)[0]; if (!s || !Q.upgradeGhostRecord(s)) break; }
}
function takeRewards(st) {
  const r = st.pendingSettlement; if (!r) return;
  for (let k = 0; k < 6 && r.remaining > 0; k++) {
    if (st.deck.length >= 25) { A.discardSettlementRewards(); break; }
    const c = r.candidates || A.rewardCandidates(), rank = { '传说': 4, '珍藏': 3, '稀有': 2, '普通': 1 };
    const best = c.map((id, i) => [rank[GC.SKILLS[id]?.rarity] || 0, i]).sort((a, b) => b[0] - a[0])[0][1];
    if (!A.chooseSettlementCard(best)) { A.discardSettlementRewards(); break; }
  }
  const rel = GX.pendingRelic(); if (rel) GX.chooseRelic(rel[0].key);
  if (st.pendingSettlement) { st.pendingSettlement.remaining = 0; A.finishSettlement(); }
}
function shop(st, id, stat) {
  const hurt = st.spirits.some(s => s.hp / s.maxHp < .6);
  for (let guard = 0; guard < 8; guard++) {
    const items = GX.shop(id).items.filter(i => !i.sold && i.price <= (st.coins || 0)); if (!items.length) break;
    const want = items.find(i => i.kind === 'relic') || (st.deck.length < 25 && items.filter(i => i.kind === 'card').sort((a, b) => b.price - a.price)[0]);
    if (!want || !GX.buy(id, want.index)) break; stat.bought[want.kind] = (stat.bought[want.kind] || 0) + 1;
  }
  GX.leaveNode(id);
}
async function fight(st0, id, stat, forced) {
  let st = st0; pickSquad(st); const n = GC.NODES[id]; if (n.arc != null) { train(st, n.arc); pickSquad(st); }
  if (process.env.SIM_RANKS && n.arc != null && /-battle$/.test(id)) { const arc = A.ML.arcs[n.arc], sq = st.squad.map(i => st.spirits.find(s => s.id === i)), top = sq.slice(0, 4), low = Math.min(...top.map(s => s.rankIndex)); if (low < arc.rank) console.log(`   GAP act ${n.act}: 幕 rank ${arc.rank}，前四只 ${top.map(s => s.rankIndex).join('/')}，余经验 ${Math.round(st.xp)}，升下一级需 ${GC.GD.ranks[low].upgradeXp}，出战 ${sq.length} 只`); }
  A.startBattle(id); const b = st.battle; if (!b) return { won: false, st };
  if (forced) { A.winBattle(); st = A.getState(); takeRewards(st); return { won: true, st, forced: true }; }
  const live = () => A.getState().battle === b; let turn = 0;
  while (live() && turn++ < 45) { await playTurn(b, live); if (live()) await X.endTurn(); }
  const snap = VERBOSE > 1 ? { rank: A.ML.arcs[n.arc]?.rank, squad: st.squad.map(i => st.spirits.find(s => s.id === i)).map(s => s.rankIndex).join('/'), xp: Math.round(st.xp), foes: b.enemies.map(e => `${Math.round(e.maxHp)}hp/${e.baseAtk ?? e.atk}atk${e.bossSkills?.length ? '*' + e.bossSkills.length : ''}`).join(' '), mine: st.squad.slice(0, 4).map(i => st.spirits.find(s => s.id === i)).map(s => `${Math.round(s.maxHp)}hp/${s.atk}atk`).join(' '), foeWill: Math.round(b.enemyWill) + '/' + Math.round(b.maxEnemyWill), will: Math.round(b.will) + '/' + Math.round(b.maxWill) } : null;
  if (live()) { b.will = 0; A.loseBattle(); }
  st = A.getState(); const won = !!st.pendingSettlement && !st.battle;
  if (snap && !won) console.log('   LOST', id, 'turn', turn, JSON.stringify(snap));
  if (won) { stat.turns += turn; stat.lamp += b.will / b.maxWill; takeRewards(st); }
  return { won, st, turn };
}
async function campaign(diff, it) {
  setSeed(it * 977 + ORDER.indexOf(diff) + 1); A.newSlot(0, 'normal', 'sim', diff);
  const stat = { fights: 0, first: 0, wins: 0, tries: 0, stuck: [], lost: [], turns: 0, lamp: 0, bought: {}, forks: {}, steps: 0 }, tried = {};
  for (let guard = 0; guard < 4000; guard++) {
    let st = A.getState(); if (!st.available.length) break;
    const ids = [...st.available], forks = ids.filter(i => FORK_ORDER.some(k => i.endsWith('-' + k)));
    let id = ids[0];
    if (forks.length > 1) { const act = GC.NODES[forks[0]].act || 1, want = FORK === 'mix' ? FORK_ORDER[(act + it) % 4] : FORK; id = forks.find(i => i.endsWith('-' + want)) || forks[0]; stat.forks[id.split('-').pop()] = (stat.forks[id.split('-').pop()] || 0) + 1; }
    const n = GC.NODES[id]; stat.steps++; st.current = id;
    if (n.type === 'battle' || n.type === 'boss') {
      const t = tried[id] = (tried[id] || 0) + 1, forced = t > RETRY;
      const r = await fight(st, id, stat, forced);
      if (!forced) { stat.tries++; if (t === 1) { stat.fights++; if (r.won) stat.first++; else stat.lost.push(n.act + (n.elite ? 'e' : n.type === 'boss' ? 'b' : '')); } if (r.won) stat.wins++; }
      else stat.stuck.push(n.act + (n.elite ? 'e' : ''));
      if (!r.won && A.getState().available.includes(id) && t > RETRY + 2) break;   // 回滚失效的保险
    } else if (n.type === 'camp') { X.campHeal(id); X.campLeave(id); }
    else if (n.type === 'reward') { A.claimInvestigation(id); takeRewards(A.getState()); }
    else if (n.type === 'shop') shop(st, id, stat);
    else if (n.type === 'omen') { const o = GX.omen(id), all = o.options.filter(x => !x.disabled), costly = x => GX.OMENS[n.omen][2][x.index][2].some(op => op[0] === 'wound' || op[0] === 'dim' || op[0] === 'curse'), safe = all.filter(x => !costly(x)), ok = ['nightmare', 'taboo'].includes(st.difficulty) && safe.length ? safe : all; if (!GX.chooseOmen(id, ok[(n.act || 0) % ok.length].index)) GX.leaveNode(id); }
    else if (n.type === 'ending') { A.finishEnding(); break; }
    else { A.continueMainlineEvent(id); while (GX.pendingPact()) GX.choosePact(PACT); }
  }
  const st = A.getState(); stat.endAct = Math.max(0, ...st.completed.map(i => GC.NODES[i]?.act || 0)); stat.coins = st.coins || 0; stat.relics = (st.relics || []).length; stat.deck = st.deck.length;
  return stat;
}
(async () => {
  console.log(`seeds ${N} · fork ${FORK} · pact ${PACT} · over ${OVER}`);
  for (const d of DIFFS) {
    const all = []; for (let i = 1; i <= N; i++) { const s = await campaign(d, i); all.push(s); if (VERBOSE) console.log(' ', d, i, 'lost', s.lost.join(','), '| stuck', s.stuck.join(','), '| act', s.endAct, 'coins', s.coins, 'relics', s.relics, 'deck', s.deck, JSON.stringify(s.forks), JSON.stringify(s.bought)); }
    const sum = k => all.reduce((a, s) => a + s[k], 0), pct = v => (v * 100).toFixed(0) + '%';
    console.log(`${A.DIFFICULTIES[d].name}: 首次胜率 ${pct(sum('first') / sum('fights'))} (${sum('first')}/${sum('fights')}) · 重试后仍卡关 ${all.map(s => s.stuck.length).join('+')} 场 [${[...new Set(all.flatMap(s => s.stuck))].join(',')}] · 平均回合 ${(sum('turns') / Math.max(1, sum('wins'))).toFixed(1)} · 胜后命灯 ${pct(sum('lamp') / Math.max(1, sum('wins')))} · 到达幕 ${all.map(s => s.endAct).join('/')}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
