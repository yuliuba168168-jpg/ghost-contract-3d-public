import * as THREE from 'three';
import { makeCanvas, canvasTexture, FONT } from '../scene/textures.js';
import { CARD_H } from '../cards/card-mesh.js';
import { themeColor } from '../fx/skill-fx.js';
import { damp } from '../core/tween.js';

const W = 512, H = 108;
let stripGeo = null;

export function createStatusView(ctx) {
  const strips = new Map();
  let despair = false;
  const g0 = () => ctx.R.grade;

  function states(unit) {
    const all = globalThis.GC.VFX?.cardStates(unit) || [];
    const act = all.filter(s => !s.passive), pas = all.filter(s => s.passive);
    return [...act, ...pas];
  }
  function short(s) {
    if (s.analysis != null && s.key === 'analysis') return `析${Math.round(s.analysis)}%`;
    const t = String(s.label || '').replace(/[+＋]/g, '').replace(/^已解析.*/, '已析').replace(/\s.*$/, '');
    return t.length > 3 ? t.slice(0, 2) : t;
  }
  function draw(strip, list) {
    const g = strip.canvas.getContext('2d');
    g.clearRect(0, 0, W, H);
    const shown = list.slice(0, 4), cw = 124, total = shown.length * cw + (shown.length - 1) * 5, x0 = (W - total) / 2;
    shown.forEach((s, i) => {
      const x = x0 + i * (cw + 5), col = themeColor(s.theme), more = i === 3 && list.length > 4;
      g.fillStyle = s.passive ? 'rgba(18, 16, 14,.72)' : 'rgba(18, 16, 14,.92)'; g.beginPath(); g.roundRect(x, 10, cw, H - 22, 10); g.fill();
      g.strokeStyle = col; g.lineWidth = s.passive ? 2 : 4; g.stroke();
      g.fillStyle = s.passive ? 'rgba(233, 226, 208,.7)' : '#f1ece0'; g.font = `bold 40px ${FONT}`; g.textBaseline = 'middle';
      const text = more ? `+${list.length - 3}` : short(s), turns = !more && s.turns != null ? String(s.turns) : '';
      g.textAlign = turns ? 'left' : 'center';
      g.fillText(text, turns ? x + 9 : x + cw / 2, H / 2 + 2, turns ? cw - 44 : cw - 12);
      if (turns) { g.fillStyle = col; g.beginPath(); g.arc(x + cw - 22, H / 2, 17, 0, 7); g.fill(); g.fillStyle = '#12100e'; g.font = 'bold 28px Georgia, serif'; g.textAlign = 'center'; g.fillText(turns, x + cw - 22, H / 2 + 2); }
    });
    strip.tex.needsUpdate = true;
  }
  function refresh(ent) {
    const u = ent.unit; if (!u || ent.vanishing) return;
    const list = states(u), key = list.map(s => `${s.key || s.label}:${s.turns ?? ''}:${s.analysis ?? ''}`).join('|');
    let strip = strips.get(ent);
    if (!strip) {
      if (!list.length) { aura(ent, list); return; }
      stripGeo ||= new THREE.PlaneGeometry(1.04, 1.04 * H / W);
      const [canvas] = makeCanvas(W, H), tex = canvasTexture(canvas);
      const mesh = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      mesh.position.set(0, (ent.side === 'ally' ? 1 : -1) * (CARD_H / 2 + .13), -.006); mesh.renderOrder = 3; mesh.userData.noPick = true;
      ent.card.group.add(mesh);
      strip = { mesh, canvas, tex, key: null };
      strips.set(ent, strip);
    }
    if (strip.key !== key) { strip.key = key; strip.mesh.visible = list.length > 0; draw(strip, list); }
    aura(ent, list);
  }
  function aura(ent, list) {
    const e = ent.unit.effects || {};
    if (e.bloodSacrifice) ent.card.setAura('#ff2a2a', 1);
    else if (e.divineFire) ent.card.setAura('#ffd98a', 1);
    else if (e.heroFusion) ent.card.setAura('#ffe6a8', .8);
    else { const s = list.find(x => !x.passive); ent.card.setAura(s ? themeColor(s.theme) : null, .5); }
    ent.card.setShade(despair);
  }
  function drop(ent) {
    const s = strips.get(ent);
    if (s) { s.mesh.removeFromParent(); s.mesh.material.dispose(); s.tex.dispose(); strips.delete(ent); }
  }
  function setDespair(v) {
    if (despair === v) return;
    despair = v;
    for (const ent of ctx.battle.units.values()) ent.card.setShade(v);
    document.body.classList.toggle('despair', v);
  }
  ctx.on('unitCreated', refresh);
  ctx.on('unitSynced', refresh);
  ctx.on('unitRemoved', drop);
  ctx.on('battleSynced', b => setDespair(!!b.despairWorld));
  ctx.on('battleCleared', () => setDespair(false));

  function update(dt) {
    const g = g0();
    if (despair) { g.uDesat.value = damp(g.uDesat.value, .88, 3, dt); g.uEdgeDark.value = Math.max(g.uEdgeDark.value, damp(g.uEdgeDark.value, .85, 3, dt)); }
    else if (g.uDesat.value > .001 && !ctx.keepDesat) g.uDesat.value = damp(g.uDesat.value, 0, 2, dt);
  }
  return { refresh, setDespair, update, get despair() { return despair; } };
}
