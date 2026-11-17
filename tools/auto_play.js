// 页面内自动通关（稳定性验证用）：在浏览器控制台或 CDP 里 `const m = await import('/tools/auto_play.js'); m.run({ acts: 46 })`。
// 非战斗界面一律点真实的 DOM 按钮（优先主按钮），战斗里用 GC.actions 出牌；记录报错、卡死和每幕耗时到 window.__autoLog。
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = window.__autoLog = { errors: [], stuck: [], acts: {}, clicks: 0, battles: 0, wins: 0, done: false, last: '' };
addEventListener('error', e => log.errors.push('error: ' + (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
addEventListener('unhandledrejection', e => log.errors.push(('rejection: ' + (e.reason?.stack || e.reason)).slice(0, 300)));
const oerr = console.error; console.error = (...a) => { log.errors.push('console.error: ' + a.map(String).join(' ').slice(0, 300)); oerr(...a); };
const vis = el => el && el.offsetParent !== null && !el.disabled && getComputedStyle(el).visibility !== 'hidden';
const idle = async () => { for (let i = 0; i < 400 && GC.busy; i++) await sleep(25); };

async function playTurn() {
  const b = GC.battle, Q = GC.query, X = GC.actions; if (!b) return;
  for (let k = 0; k < 4 && GC.battle === b; k++) {
    const hi = b.hand.findIndex(e => Q.handSpirit(e)); if (hi < 0 || b.qi < Q.spiritCost()) break;
    const lanes = [0, 1, 2, 3].filter(l => !b.units[l]); if (!lanes.length) break;
    X.selectHand(hi); await X.deployGhost(hi, lanes.find(l => b.enemies.some(e => !e.dead && e.lane === l)) ?? lanes[0]); await idle();
  }
  // 每回合试着放一个技能和一张牌（覆盖演出与目标选择流程）
  for (const u of b.units.filter(Boolean)) {
    if (GC.battle !== b) return;
    const name = Q.unlockedSkills(u.id, u.rankName).find(n => { const d = GC.GD.skillDefs[n] || {}; return !d.passive && !d.toggle && !Q.cooldown(u, n) && b.qi >= (d.cost || 0) && !((d.once || d.oncePerBattle) && u.onceUsed?.[n]); });
    if (!name) continue;
    X.cancelSelection(); X.allyTarget(u.lane); X.exactSpiritSkill(name); await idle();
    for (let i = 0; i < 3 && GC.selection.targetMode; i++) { const m = GC.selection.targetMode, e = b.enemies.find(e => !e.dead), a = b.units.find(Boolean); if (/nemy|confuse/.test(m) && e) X.enemyTarget(e.uid); else if (a) X.allyTarget(a.lane); await idle(); }
    X.cancelSelection(); break;
  }
  if (GC.battle === b) { const i = b.hand.findIndex(id => typeof id === 'string' && GC.SKILLS[id] && b.qi >= GC.SKILLS[id].cost); if (i >= 0) { X.cancelSelection(); X.selectHand(i); await idle(); for (let k = 0; k < 3 && GC.selection.targetMode; k++) { const m = GC.selection.targetMode, e = b.enemies.find(e => !e.dead), a = b.units.find(Boolean); if (/nemy|confuse/.test(m) && e) X.enemyTarget(e.uid); else if (m === 'deploy') { const l = [0, 1, 2, 3].find(l => !b.units[l]); if (l == null) break; X.allyLane(l); } else if (a) X.allyTarget(a.lane); await idle(); } X.cancelSelection(); } }
  if (GC.battle === b) { await X.endTurn(); await idle(); }
}
function pickButton() {
  const q = s => [...document.querySelectorAll(s)].filter(vis);
  const skip = /返回|取消|离开|跳过|重建|导出|导入|设置|图鉴|演武|档案|指南|成就|成绩|每日|日志|难度|放弃|回标题|回到标题|鬼灵与卡牌|素材|查看/;
  const sheet = q('.sheet .ink-btn, .sheet button.cell, .story-bar button, .sheet button');
  const pri = sheet.filter(b => b.classList.contains('primary') && !skip.test(b.textContent));
  const any = sheet.filter(b => !skip.test(b.textContent));
  const arena = q('.ink-btn.primary').filter(b => /出战|下一波/.test(b.textContent));   // 无尽 / 每日挑战的擂台界面
  let node = q('.sm-node.open');
  // 岔路四选一：按幕轮换 调查/精英/鬼市/异兆，让四类节点都被走到
  if (node.length > 1) { const act = Math.max(0, ...(GC.state?.completed || []).map(i => GC.NODES[i]?.act || 0)); node = [node[(act + forkShift) % node.length], ...node]; }
  const home = q('.slot .ink-btn').filter(b => /继续旅途|建立新旅途/.test(b.textContent));
  if (home.length && homeSlot != null && !sheet.length) { GC.actions.loadSlot(homeSlot); return null; }   // 回到了标题页：读回指定的存档位
  const list = [...pri, ...any, ...arena, ...node, ...home, ...sheet.filter(b => /离开|跳过|返回/.test(b.textContent))];
  // 同一个界面上点过没反应的按钮（如篝火里的「按推荐培养」）往后排，换下一个
  const fresh = list.find(b => !tried.has(sig(b)));
  const btn = fresh || list[0] || null; if (btn) tried.add(sig(btn)); return btn;
}
let forkShift = 0, homeSlot = null;
const tried = new Set(), sig = b => (b.textContent || '').slice(0, 20) + '|' + (GC.state?.current || '') + '|' + (GC.state?.available || []).join() + '|' + (GC.state?.xp || 0) + '|' + (GC.state?.coins || 0);
export async function run({ acts = 46, maxSteps = 9000, fork = 0, slot = null } = {}) {
  forkShift = fork; homeSlot = slot;
  let lastKey = '', same = 0, trained = -1, t0 = performance.now(); const lost = {};
  for (let step = 0; step < maxSteps; step++) {
    const st = GC.state, act = st ? Math.max(0, ...(st.completed || []).map(i => GC.NODES[i]?.act || 0)) : 0;
    if (st && !log.acts[act]) log.acts[act] = Math.round((performance.now() - t0) / 1000);
    if (act >= acts || (st && st.completed?.some(i => GC.NODES[i]?.type === 'ending'))) break;
    await idle();
    if (st && !GC.battle) { const arc = (st.available || []).map(i => GC.NODES[i]?.arc).find(v => v != null); if (arc != null && arc !== trained) { trained = arc; try { GC.actions.trainTeam(arc); } catch (e) { log.errors.push('trainTeam: ' + e.message); } } }
    if (GC.battle) { log.battles++; const b = GC.battle; const id = b.nodeId, force = (lost[id] || 0) >= 3; if (force) { log.stuck.push('forced ' + id); for (const e of b.enemies) { e.hp = 0; e.dead = true; } await GC.actions.endTurn(); await idle(); } for (let t = 0; t < 40 && GC.battle === b; t++) await playTurn(); if (GC.battle === b) { log.stuck.push('battle>40 turns ' + id); for (const e of b.enemies) { e.hp = 0; e.dead = true; } await GC.actions.endTurn(); await idle(); } if (GC.state?.pendingSettlement || GC.state?.completed?.includes(id)) log.wins++; else { lost[id] = (lost[id] || 0) + 1; trained = -1; } continue; }
    const btn = pickButton(), key = (btn?.textContent || 'none').slice(0, 20) + '|' + (st?.current || '') + '|' + (st?.available || []).join();
    same = key === lastKey ? same + 1 : 0; lastKey = key; log.last = key;
    if (same > 25) { log.stuck.push('no progress: ' + key); break; }
    if (btn) { btn.click(); log.clicks++; }
    await sleep(btn ? 60 : 250);
  }
  log.done = true; log.seconds = Math.round((performance.now() - t0) / 1000); log.act = Math.max(0, ...(GC.state?.completed || []).map(i => GC.NODES[i]?.act || 0));
  return log;
}
