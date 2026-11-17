// 扩展 HUD：敌方意图条、场地徽记、二阶段横幅、黑影台词。数据来自 globalThis.GC_X（rules/expansion.js）。
import * as THREE from 'three';
import { makeCanvas, canvasTexture, FONT } from '../scene/textures.js';
import { CARD_H } from '../cards/card-mesh.js';
import { compact } from '../cards/card-face.js';
import { play } from '../core/audio.js';
import { LINES } from './shadow-lines.js';

const W = 512, H = 108;

export function createXHud(ctx) {
  const X = () => globalThis.GC_X, GC = () => globalThis.GC, ui = document.getElementById('ui') || document.body;
  const strips = new Map();
  let geo = null;

  // ---- 意图条 ----
  function describe(it) {
    const parts = [];
    if (it.cast) parts.push({ text: '术·' + it.cast.name.slice(0, 4), color: '#b8281c', w: 2 });
    if (it.action === 'skip') parts.push({ text: '停', color: '#17131c', w: 1 });
    else if (it.action === 'lamp') parts.push({ text: '灯 ' + compact(Math.round(it.damage * 10) / 10) + (it.times > 1 ? '×' + it.times : ''), color: '#17131c', w: 1.5 });
    else parts.push({ text: '攻 ' + compact(Math.round(it.damage * 10) / 10) + (it.times > 1 ? '×' + it.times : ''), color: '#17131c', w: 1.5 });
    if (!it.cast && it.castIn != null && it.castIn <= 1) parts.push({ text: '蓄', color: '#17131c', w: 1, dot: true });
    return parts;
  }
  function draw(strip, parts) {
    const g = strip.canvas.getContext('2d'); g.clearRect(0, 0, W, H);
    const unit = 118, total = parts.reduce((a, p) => a + p.w * unit + 6, -6); let x = (W - total) / 2;
    for (const p of parts) {
      const w = p.w * unit;
      // 纸签：与技能签同一语言，只用纸色与朱砂两种颜色
      g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
      const pg = g.createLinearGradient(0, 12, 0, H - 14); pg.addColorStop(0, '#cbbf9f'); pg.addColorStop(1, '#a8996f');
      g.fillStyle = pg; g.beginPath(); g.roundRect(x, 12, w, H - 26, 2); g.fill(); g.restore();
      g.fillStyle = '#b8281c'; g.fillRect(x, 12, w, 6);
      if (p.dot) { g.beginPath(); g.arc(x + w - 14, 32, 7, 0, 7); g.fill(); }
      g.fillStyle = p.color; g.font = `bold 38px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.text, x + w / 2, H / 2 + 4, w - 14);
      x += w + 6;
    }
    strip.tex.needsUpdate = true;
  }
  function refreshIntents() {
    const b = GC()?.battle, list = b && X() ? X().intents(b) : [], by = new Map(list.map(i => [i.uid, i]));
    for (const ent of ctx.battle.units.values()) {
      if (ent.side !== 'enemy') continue;
      const it = ent.vanishing ? null : by.get(ent.uid); let strip = strips.get(ent);
      if (!it) { if (strip) strip.mesh.visible = false; continue; }
      if (!strip) {
        const [canvas] = makeCanvas(W, H), tex = canvasTexture(canvas);
        const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
        mesh.layers.set(1); mesh.scale.set(1.5, 1.5 * H / W, 1); mesh.renderOrder = 21; mesh.userData.noPick = true;
        mesh.position.set(0, (ent.app.height || 1.6) + .2, 0);
        ent.app.group.add(mesh); strip = { mesh, canvas, tex, key: null }; strips.set(ent, strip);
      }
      const parts = describe(it), key = parts.map(p => p.text).join('|');
      strip.mesh.visible = true;
      if (strip.key !== key) { strip.key = key; draw(strip, parts); }
    }
  }
  function drop(ent) { const s = strips.get(ent); if (s) { s.mesh.removeFromParent(); s.mesh.material.dispose(); s.tex.dispose(); strips.delete(ent); } }

  // ---- 场地徽记 ----
  const badge = document.createElement('div'); badge.className = 'field-badge'; badge.hidden = true; ui.appendChild(badge);
  let badgeKey = '';
  function refreshBadge() {
    const b = GC()?.battle, f = b && X()?.field(b), w = b && X()?.wardRule(b), key = b && ctx.battleActive ? `${f?.id}|${w?.id}|${w?.met}` : '';
    if (key === badgeKey) return; badgeKey = key;
    if (!key || (!f && !w)) { badge.hidden = true; return; }
    badge.hidden = false;
    badge.innerHTML = (f ? `<b>场地 · ${f.name}</b><span>${f.desc}</span>` : '') + (w ? `<b class="${w.met ? 'met' : ''}">${w.name}${w.met ? ' · 已满足' : ''}</b><span>${w.desc}</span>` : '');
  }

  // ---- 黑影台词 ----
  const bubble = document.createElement('div'); bubble.className = 'shadow-say'; ui.appendChild(bubble);
  let sayAt = 0, sayTimer = 0, last = '';
  function say(event, { force = false, chance = 1 } = {}) {
    const pool = LINES[event]; if (!pool || !ctx.battleActive) return;
    const now = performance.now(); if (!force && (now - sayAt < 5200 || Math.random() > chance)) return;
    let line = pool[Math.floor(Math.random() * pool.length)]; if (line === last) line = pool[(pool.indexOf(line) + 1) % pool.length];
    last = line; sayAt = now; bubble.textContent = line; bubble.classList.remove('on'); void bubble.offsetWidth; bubble.classList.add('on');
    clearTimeout(sayTimer); sayTimer = setTimeout(() => bubble.classList.remove('on'), 3600);
    ctx.opponent?.play?.('wary', { tier: 'normal' });
  }

  // ---- 羁绊合击 ----
  const bondBar = document.createElement('div'); bondBar.className = 'bond-bar'; bondBar.hidden = true; ui.appendChild(bondBar);
  let bondKey = '';
  bondBar.addEventListener('click', e => { const k = e.target.closest('button')?.dataset.key; if (k) { play('click'); X().bondStrike(k); } });
  function refreshBonds() {
    const b = GC()?.battle, list = b && ctx.battleActive && X() ? X().bonds(b) : [], key = list.map(x => `${x.key}:${x.used}:${x.ready}`).join('|');
    if (key === bondKey) return; bondKey = key; bondBar.hidden = !list.length;
    bondBar.innerHTML = list.map(x => `<button data-key="${x.key}" class="${x.used ? 'used' : x.ready ? 'ready' : ''}" title="${x.desc}"><b>合击 · ${x.strike}</b><i>${x.used ? '已用' : x.cost + ' 鬼气'}</i><span>${x.name}：同场攻击 +10%</span></button>`).join('');
  }
  // ---- 桌面道具 ----
  function propSay(r, pos) {
    if (pos) ctx.overlay?.floatText(pos.clone().setY(1.2), r.name, { kind: 'info' });
    bubble.textContent = r.rite ? `仪式【${r.rite}】完成。${r.reward}。` : r.text; bubble.classList.remove('on'); void bubble.offsetWidth; bubble.classList.add('on'); clearTimeout(sayTimer); sayTimer = setTimeout(() => bubble.classList.remove('on'), 4200);
    if (r.rite) { ctx.overlay?.banner(`仪式 · ${r.rite}`, { tone: 'gold', sub: r.reward, dur: 2200 }); ctx.overlay?.flash?.('#ffd98a', .2, 700); play('reward'); ctx.opponent?.play?.('wary', { tier: 'normal' }); }
  }
  ctx.xfx = {
    'field:change'(p) { ctx.overlay?.banner(`场地 · ${p.name}`, { tone: 'info', sub: p.desc, dur: 1500 }); play('dread'); badgeKey = ''; refreshBadge(); },
    'boss:phase'(p) {
      ctx.overlay?.banner(`${p.name} · ${p.phase}`, { tone: 'enemy', sub: p.desc, dur: 1700 }); ctx.overlay?.flash?.('#c2261d', .28, 700); ctx.rig?.shake?.(.08, 500); play('dread');
      ctx.opponent?.play?.('wardBlock');
    },
    async 'bond:strike'(p) {
      const A = ctx.battle.get?.(p.a.uid), B = ctx.battle.get?.(p.b.uid);
      ctx.overlay?.banner(`合击 · ${p.strike}`, { tone: 'gold', sub: p.name, dur: 1300 }); ctx.overlay?.flash?.('#ffd98a', .22, 600); play('skill');
      for (const e of [A, B]) if (e) { e.app.flash?.('#ffd98a', 1.2, 700); ctx.particles?.rise(e.card.group.position.clone(), { count: 16, color: '#ffd98a', radius: .5 }); }
      if (A && B) ctx.particles?.beam?.(A.card.group.position.clone().setY(.5), B.card.group.position.clone().setY(.5), { dur: 600, width: .05, color: '#ffd98a' });
      ctx.rig?.shake?.(.05, 350); await new Promise(r => setTimeout(r, 900));
    },
    keyword(p) { const ent = ctx.battle.get?.(p.uid); if (ent) ctx.overlay?.floatText(ent.card.group.position.clone().setY(ent.card.group.position.y + .6), '亡语', { kind: 'info' }); },
    shadow(p) { say(p.event, { force: p.event !== 'turn', chance: p.event === 'turn' ? .4 : 1 }); }
  };
  ctx.on('fx', (type, p) => {
    if (type === 'card:play') { const S = GC().SKILLS[p.cardId] || {}; if (S.ops?.some(o => o[0] === 'kill')) say('sacrifice'); else if (S.arch === 'summon') say('summon', { chance: .5 }); else if (S.rarity === '传说' || S.rarity === '珍藏') say('rare', { chance: .7 }); }
    else if (type === 'deaths') { const ally = p.units?.some(u => u.side === 'ally'); say(ally ? 'allyDeath' : 'enemyDeath', { chance: ally ? .8 : .35 }); }
    else if (type === 'battle:win') say('win', { force: true });
    else if (type === 'battle:lose') say('lose', { force: true });
    else if (type === 'turn:start') { const b = GC().battle; if (b && b.will / b.maxWill < .3) say('lowLamp', { chance: .6 }); else if (b && b.enemyWill / b.maxEnemyWill < .3) say('enemyLow', { chance: .6 }); }
  });
  ctx.on('unitRemoved', drop);
  ctx.on('battleSynced', () => { refreshIntents(); refreshBadge(); refreshBonds(); });
  ctx.on('battleCleared', () => { badgeKey = 'x'; refreshBadge(); bubble.classList.remove('on'); });
  ctx.on('refresh', () => { badgeKey = 'x'; refreshBadge(); bondKey = 'x'; refreshBonds(); });
  return { refreshIntents, refreshBadge, say, propSay };
}
