// 交互式新手引导：第 1 幕首战里分步提示。战斗 HUD 都在 3D 里，所以高亮圈用相机投影定位。
import * as THREE from 'three';
import { slotPos, standPos } from '../battle/board-layout.js';
import { play } from '../core/audio.js';

const KEY = 'gc3d-tutorial-v1';
const P = (x, y, z) => new THREE.Vector3(x, y, z);
const row = (side, y) => [0, 1, 2, 3].map(l => slotPos(side, l).clone().setY(y));
const foes = [...row('enemy', .05), ...[0, 1, 2, 3].map(l => standPos('enemy', l).clone().setY(1.3))];
// 第 1 幕首战的分步引导。此时已契约童童；万一手里没有鬼灵牌，就跳过部署那三步。
const DEPLOY = [
  { title: '选一张鬼灵牌', text: '点下方手牌里的鬼灵牌（写着攻击和生命的那张）。', hand: true, done: s => s.selected != null || s.units > 0 },
  { title: '放到一条路上', text: '再点你这一侧的任意一条空路，她就会显形。', at: row('ally', .1), done: s => s.units > 0 },
  { title: '正前方与空路', text: '结束回合时，鬼灵自动攻击正前方的敌人；前方是空路，就直击对面的命灯。敌人也一样，所以你空着的路会漏伤害到命灯上。', at: [...row('ally', .05), ...row('enemy', .05)], r: 60 }
];
const buildSteps = withSpirit => [
  { title: '命灯', text: '这是你的第一场战斗。左下这排灯是你的命灯，对面那排是黑影的。让对面的灯全灭就赢，你的灯全灭就输。', at: [P(-4.4, .05, 1.2), P(-2.4, .05, 1.2), P(-4.4, .05, 2.1), P(-2.4, .05, 2.1)], r: 40 },
  { title: '鬼气', text: '香炉上的数字是鬼气。出牌要花鬼气，每回合开始会回复，回合越往后上限越高。', at: [P(-3.6, .5, .02)], r: 90 },
  ...(withSpirit ? DEPLOY : []),
  { title: '看敌人的打算', text: '敌人头顶的小牌是它下回合要做的事：「攻」打它正前方的鬼灵，「灯」直击你的命灯，「术」要放技能，「停」不能行动。', at: foes, r: 30 },
  { title: '技能牌', text: '其余手牌是技能牌，左上角的数字是费用。点一张，再按提示点目标（多数牌要点你自己的鬼灵）就能打出。鬼气不够可以留到下回合。', hand: true },
  { title: '结束回合', text: '点右下角的招魂铃（或按空格）结束回合。双方鬼灵会依次自动出手。', at: [P(3.62, .5, 1.62)], r: 90, done: s => s.turn > s.turn0 },
  { title: '鬼灵技能与法器', text: '新回合会回复鬼气并抽一张牌。点已上场的鬼灵可以放她自己的技能；右上角三件法器是你本人的御鬼者技能，各有使用次数。', at: [P(3.6, .4, -1.65)], r: 130 },
  { title: '查看详情', text: '右键（或长按）任何手牌、鬼灵、敌人都能看详情。左上角写着这一场的场地规则。更多说明在路线图底部的「指南」里。剩下的交给你。', last: true }
];

export function createTutorial(ctx) {
  const box = document.createElement('div'); box.className = 'tut'; box.hidden = true;
  const ring = document.createElement('div'); ring.className = 'tut-ring'; ring.hidden = true;
  document.body.append(ring, box);
  const v = new THREE.Vector3();
  let step = -1, raf = 0, turn0 = 1, hand0 = 0, STEPS = buildSteps(true), node = '';
  const seen = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };
  const hasSpirit = b => b.hand.some(e => globalThis.GC.query.handSpirit(e));
  const battle = () => globalThis.GC?.battle;
  const snap = () => { const b = battle(); return { selected: globalThis.GC.selection?.selected ?? null, units: b ? b.units.filter(u => u && !u.token).length : 0, turn: b?.turn || 0, turn0, hand: b?.hand.length || 0, hand0 }; };

  function place() {
    const s = STEPS[step]; if (!s) return;
    let x0, y0, x1, y1;
    if (s.hand) { x0 = innerWidth * .22; x1 = innerWidth * .78; y0 = innerHeight * .74; y1 = innerHeight - 6; }
    else if (s.at) {
      x0 = y0 = 1e9; x1 = y1 = -1e9;
      for (const p of s.at) { v.copy(p).project(ctx.rig.camera); const x = (v.x * .5 + .5) * innerWidth, y = (-v.y * .5 + .5) * innerHeight; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const pad = (s.r || 150) * Math.min(1, innerHeight / 900) / 2; x0 -= pad; x1 += pad; y0 -= pad * (s.at.length > 1 ? .8 : 1); y1 += pad * (s.at.length > 1 ? .8 : 1);
    } else { ring.hidden = true; return; }
    ring.hidden = false;
    ring.style.cssText = `left:${Math.round(x0)}px;top:${Math.round(y0)}px;width:${Math.round(x1 - x0)}px;height:${Math.round(y1 - y0)}px`;
  }
  function render() {
    const s = STEPS[step];
    box.innerHTML = `<small>新手引导 ${step + 1} / ${STEPS.length}</small><b></b><p></p><div class="tut-row"><button data-t="skip">跳过教学</button>${s.done ? '<i>照做后自动继续</i>' : `<button class="primary" data-t="next">${s.last ? '开始战斗' : '下一步'}</button>`}</div>`;
    box.querySelector('b').textContent = s.title; box.querySelector('p').textContent = s.text;
    place();
  }
  function go(i) { if (i >= STEPS.length) return finish(); step = i; if (STEPS[i].done) { turn0 = battle()?.turn || 1; hand0 = battle()?.hand.length || 0; } render(); }
  function finish() {
    try { localStorage.setItem(KEY, '1'); } catch { }
    step = -1; box.hidden = ring.hidden = true; document.body.classList.remove('tut-on'); cancelAnimationFrame(raf); raf = 0;
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    const b = battle();
    if (!b || b.nodeId !== node || !ctx.battleActive) { box.hidden = ring.hidden = true; if (!b) { step = -1; document.body.classList.remove('tut-on'); cancelAnimationFrame(raf); raf = 0; } return; }
    const bar = document.querySelector('.story-bar'), covered = !!document.querySelector('.sheet') || (bar && bar.style.display !== 'none') || ctx.cine?.active;
    box.hidden = !!covered; if (covered) { ring.hidden = true; return; }
    const s = STEPS[step]; if (s?.done && s.done(snap())) { play('click'); go(step + 1); return; }
    place();
  }
  function start() { const b = battle(); if (step >= 0 || !b) return; STEPS = buildSteps(hasSpirit(b) && !b.units.some(Boolean)); node = b.nodeId; document.body.classList.add('tut-on'); box.hidden = false; go(0); if (!raf) raf = requestAnimationFrame(tick); }
  box.addEventListener('click', e => { const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return; e.stopPropagation(); play('click'); if (t === 'skip') finish(); else go(step + 1); });
  box.addEventListener('pointerdown', e => e.stopPropagation());
  ctx.on('battleSynced', () => { const b = battle(); if (step < 0 && b && b.nodeId === 'a01-battle' && !b.testMode && b.turn === 1 && !seen()) start(); });
  return { start, finish, reset() { try { localStorage.removeItem(KEY); } catch { } }, get step() { return step; }, get active() { return step >= 0; }, get steps() { return STEPS; } };
}
