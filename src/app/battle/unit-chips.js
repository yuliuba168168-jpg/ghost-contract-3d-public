import * as THREE from 'three';
import { quality } from '../core/quality.js';
import { unitDescriptor, compact } from '../cards/card-face.js';
import { CARD_H } from '../cards/card-mesh.js';

// 极简画质下牌在帧缓冲里只有几十像素宽，牌面数字读不出：每个单位在牌下沿挂一枚 DOM 数值签
export function createUnitChips(ctx) {
  const chips = new Map(), v = new THREE.Vector3();
  const layer = document.createElement('div'); layer.className = 'unit-chips'; document.body.append(layer);
  function drop(uid) { const c = chips.get(uid); if (c) { c.el.remove(); chips.delete(uid); } }
  function clear() { for (const uid of [...chips.keys()]) drop(uid); }
  function update() {
    const on = (quality().plain || innerHeight <= 520) && ctx.battle.active && ctx.R.hud !== false && !ctx.screens?.modalOpen;
    if (!on) { if (chips.size) clear(); return; }
    const cam = ctx.rig.camera, units = ctx.battle.units;
    for (const uid of chips.keys()) { const e = units.get(uid); if (!e || e.removed) drop(uid); }
    for (const [uid, ent] of units) {
      if (ent.removed || !ent.unit) continue;
      let c = chips.get(uid);
      if (!c) { const el = document.createElement('div'); el.className = 'unit-chip ' + ent.side; layer.append(el); c = { el, key: '', x: -1, y: -1 }; chips.set(uid, c); }
      const d = unitDescriptor(ent.unit), key = [d.baseAtk, d.hp, d.maxHp, d.shield > 0 ? 1 : 0].join('|');
      if (key !== c.key) {
        c.key = key;
        const low = d.hp / Math.max(1, d.maxHp) < .34;
        c.el.innerHTML = `<u>攻</u>${compact(d.baseAtk)}<u>命</u><span class="${low ? 'low' : ''}">${compact(d.hp)}</span>${d.hp < d.maxHp ? `<u>/${compact(d.maxHp)}</u>` : ''}${d.shield > 0 ? '<u>盾</u>' : ''}`;
      }
      v.set(0, -CARD_H / 2, 0); ent.card.group.localToWorld(v).project(cam);
      const x = Math.round((v.x * .5 + .5) * innerWidth), y = Math.round((-v.y * .5 + .5) * innerHeight) + 12;
      if (x !== c.x || y !== c.y) { c.x = x; c.y = y; c.el.style.left = x + 'px'; c.el.style.top = y + 'px'; }
    }
  }
  return { update, clear };
}
