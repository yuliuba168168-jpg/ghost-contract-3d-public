// 平衡模拟：一个「合格玩家」机器人走真实路线（剧情→战斗→岔路→篝火…）打完整 46 幕，统计各难度的首次胜率、卡关幕、回合数。
// 用法：node tools/balance_sim.cjs [种子数=2] [难度,逗号分隔] ；环境变量 SIM_FORK=mix|explore|trial|shop|omen  SIM_PACT=plain|blood|bone|lamp  SIM_SET='{"hard":{"bite":0.3}}'  SIM_VERBOSE=1
const fs = require('fs'), vm = require('vm'), path = require('path');
const RULES = path.join(__dirname, '..', 'src', 'rules');
let seed = 1;
const ctx = { console, setTimeout, clearTimeout, queueMicrotask, __HEADLESS__: true, localStorage: { getItem: () => null, setItem: () => { } } };
vm.createContext(ctx);
for (const n of ['bridge', 'codex', 'vfx', 'app', 'polish', 'mainline-data', 'mainline-data-2', 'mainline', 'playability', 'expansion', 'facade']) vm.runInContext(fs.readFileSync(path.join(RULES, n + '.js'), 'utf8'), ctx, { filename: n + '.js' });
ctx.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; vm.runInContext('Math.random=random', ctx);
ctx.GC_BRIDGE = { fx: () => Promise.resolve(), sync() { }, ui() { }, notify() { } };
const A = ctx.__MAINLINE_TEST__, GC = ctx.GC, Q = GC.query, X = GC.actions, GX = ctx.GC_X, ORDER = ['easy', 'normal', 'hard', 'nightmare', 'taboo'];
const FORK = process.env.SIM_FORK || 'mix', PACT = process.env.SIM_PACT || 'plain', VERBOSE = !!process.env.SIM_VERBOSE, RETRY = 3;
if (process.env.SIM_SET) for (const [d, o] of Object.entries(JSON.parse(process.env.SIM_SET))) Object.assign(A.DIFFICULTIES[d], o);
const tick = () => new Promise(r => setTimeout(r, 0)), settle = async () => { for (let i = 0; i < 60 && GC.busy; i++) await tick(); await tick(); };
const NOCARD = new Set(['rope', 'taboo', 'bloodmoon', 'valhalla', 'relic']), NOSKILL = new Set(['迷惑', '绝望', '55开', '55开+']);
const allies = b => b.units.filter(Boolean), foes = b => b.enemies.filter(e => !e.dead);

// 把一次选择（技能或手牌）走完：按目标模式挑目标
async function resolveTarget(b, prefer) {
  for (let i = 0; i < 3; i++) {
    const m = GC.selection.targetMode || ''; if (!m) break;
    if (m === 'ally' || m.startsWith('exactAlly:') || m.startsWith('player:')) { const t = prefer || allies(b).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0]; if (!t) break; X.allyTarget(t.lane); }
    else if (m.includes('nemy') || m.startsWith('confuseSecond:')) { const t = foes(b).sort((a, c) => c.hp - a.hp)[0]; if (!t) break; X.enemyTarget(t.uid); }
    else if (m === 'deploy') { const l = [0, 1, 2, 3].find(l => !b.units[l]); if (l == null) break; X.allyLane(l); }
    else break;
    await settle();
  }
  X.cancelSelection();
}
async function playTurn(b, live) {
  // 1 显形：优先站到有敌人的路
  for (let k = 0; k < 4 && live(); k++) {
    const hi = b.hand.findIndex(e => Q.handSpirit(e)); if (hi < 0 || b.qi < Q.spiritCost()) break;
    const lanes = [0, 1, 2, 3].filter(l => !b.units[l]); if (!lanes.length) break;
    X.selectHand(hi); await X.deployGhost(hi, lanes.find(l => b.enemies.some(e => !e.dead && e.lane === l)) ?? lanes[0]);
  }
  // 2 御鬼者技能
  for (const i of [1, 2, 0]) {
    if (!live() || b.playerSkillsUsed?.[i]) continue;
    const t = allies(b).sort((a, c) => Q.effectiveAttack(c) - Q.effectiveAttack(a))[0];
    if (!t || Q.playerSkillRestriction(i, t) || (i === 0 && b.will < b.maxWill * .85)) continue;
    X.cancelSelection(); X.selectPlayerSkill(i); X.allyTarget(t.lane); await settle();
  }
  // 3 技能与卡牌：先用便宜的破鬼障，其余有气就放
  for (let guard = 0; guard < 16 && live(); guard++) {
    if (!foes(b).length) return;
    const w = Q.wardInfo(b), need = w ? w.layers - w.casts : 0, opts = [];
    for (const u of allies(b)) for (const name of Q.unlockedSkills(u.id, u.rankName)) {
      const d = GC.GD.skillDefs[name] || {};
      if (d.passive || d.toggle || NOSKILL.has(name) || Q.cooldown(u, name) || b.qi < (d.cost || 0) || ((d.once || d.oncePerBattle) && u.onceUsed?.[name])) continue;
      if (name === '画卷绝杀' && !foes(b).some(e => e.hp / e.maxHp < .15)) continue;
      if (name === '鬼主权杖' && !foes(b).some(e => (e.rankIndex ?? 0) < 20)) continue;
      opts.push({ kind: 'skill', lane: u.lane, name, cost: d.cost || 0, cd: d.cooldown || 0 });
    }
    b.hand.forEach((id, i) => {
      const c = typeof id === 'string' && GC.SKILLS[id]; if (!c || NOCARD.has(id) || b.qi < c.cost) return;
      const heal = /^coin/.test(id), hurt = allies(b).some(u => u.hp / u.maxHp < .7);
      if (c.target === 'ally' && !allies(b).length) return;
      opts.push({ kind: 'card', i, id, cost: c.cost, cd: 0, filler: heal && !hurt });
    });
    const pick = need > 0 ? opts.sort((a, c) => a.cost - c.cost || a.cd - c.cd)[0] : opts.filter(o => !o.filler).sort((a, c) => c.cost - a.cost)[0];
    if (!pick) break;
    const qi0 = b.qi, hand0 = b.hand.length; X.cancelSelection();
    if (pick.kind === 'card') { X.selectHand(pick.i); await settle(); await resolveTarget(b, /^coin/.test(pick.id) ? null : allies(b).sort((a, c) => Q.effectiveAttack(c) - Q.effectiveAttack(a))[0]); }
    else { X.allyTarget(pick.lane); X.exactSpiritSkill(pick.name); await settle(); await resolveTarget(b); }
    await settle();
    if (live() && b.qi === qi0 && b.hand.length === hand0) break;
  }
  X.cancelSelection();
}
module.exports = { A, GC, Q, X, GX, ORDER, FORK, PACT, VERBOSE, RETRY, settle, playTurn, setSeed: v => { seed = v; } };
if (require.main === module) require('./balance_run.cjs');
