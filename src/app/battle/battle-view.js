import * as THREE from 'three';
import { Card3D } from '../cards/card-mesh.js';
import { Apparition } from '../cards/apparition.js';
import { slotPos, standPos } from './board-layout.js';
import { createHandView } from './hand-view.js';
import { tween } from '../core/tween.js';

export function createBattleView(ctx) {
  const { scene, props } = ctx;
  const root = new THREE.Group();
  scene.add(root);
  const units = new Map(), vanishing = new Map();
  const hand = createHandView(ctx);
  let active = false, holdCount = 0, dirty = false;
  const v = new THREE.Vector3();

  function place(ent, lane, instant = true, dur = 360) {
    ent.lane = lane;
    const p = slotPos(ent.side, lane, v);
    if (instant) { ent.card.group.position.copy(p); ent.app.group.position.copy(standPos(ent.side, lane)); return Promise.resolve(); }
    const s = standPos(ent.side, lane, new THREE.Vector3());
    tween(ent.app.group.position, { x: s.x, y: s.y, z: s.z }, { dur, ease: 'inOutCubic' });
    return tween(ent.card.group.position, { x: p.x, y: p.y, z: p.z }, { dur, ease: 'inOutCubic' });
  }
  function create(unit, side, lane, { appear = false } = {}) {
    const card = new Card3D();
    card.setUnit(unit);
    card.group.rotation.set(-Math.PI / 2, 0, (Math.random() - .5) * .05);
    root.add(card.group);
    const app = new Apparition({ id: unit.id, name: unit.name || '鬼', type: unit.type, side, boss: !!unit.bossSkills?.length });
    root.add(app.group);
    const ent = { uid: unit.uid, side, lane, card, app, unit, locked: 0, removed: false, lastHp: unit.hp, lastShield: unit.shield || 0 };
    units.set(unit.uid, ent);
    place(ent, lane);
    if (appear) app.appear(); else app.material.uniforms.uOpacity.value = app.baseOpacity;
    ctx.emit('unitCreated', ent);
    return ent;
  }
  function dispose(ent) {
    ctx.emit('unitRemoved', ent);
    ent.card.dispose(); ent.app.dispose();
  }
  function vanish(ent, kind = 'death') {
    if (ent.vanishing) return ent.vanishing;
    units.delete(ent.uid);
    ent.card.setHighlight(null);
    ctx.emit('vanish', ent, kind);
    const dur = kind === 'quiet' ? 260 : 700;
    ent.vanishing = Promise.all([ent.card.dissolve(dur, ent.side === 'ally' ? '#9fb0ff' : '#ff5a40'), ent.app.disperse(dur * .9)]).then(() => { vanishing.delete(ent.uid); dispose(ent); });
    vanishing.set(ent.uid, ent.vanishing);
    return ent.vanishing;
  }
  function remove(ent) { units.delete(ent.uid); dispose(ent); }
  function ensure(unit, side, lane, removed = false) {
    let ent = units.get(unit.uid);
    if (!ent) { ent = create(unit, side, lane, { appear: active }); if (active) ctx.emit('unitArrived', ent); }
    ent.unit = unit;
    if (ent.locked) return ent;
    if (ent.lastHp !== unit.hp) { ctx.emit('hpChange', ent, unit.hp - ent.lastHp); ent.lastHp = unit.hp; }
    ent.card.setUnit(unit);
    if (ent.lane !== lane) place(ent, lane, false);
    if (ent.removed !== removed) {
      ent.removed = removed;
      ent.card.setDim(removed); ent.app.setOpacity(removed ? .14 : ent.app.baseOpacity);
    }
    ctx.emit('unitSynced', ent);
    return ent;
  }
  function syncProps(b = globalThis.GC.battle) {
    if (!b) return;
    props.setLife('ally', b.will, b.maxWill);
    props.setLife('enemy', b.enemyWill, b.maxEnemyWill);
    props.setQi(b.qi, b.maxQi);
    props.deck.setCount(b.draw.length);
    props.urn.setCount(b.grave.length);
    props.artifacts.forEach((a, i) => { if (a.used !== !!b.playerSkillsUsed?.[i]) a.setUsed(!!b.playerSkillsUsed?.[i]); });
  }
  function syncNow(soft = false) {
    const b = globalThis.GC.battle;
    if (!soft) dirty = false;
    if (!b) { if (!soft) clear(true); return; }
    const first = !active;
    active = true;
    const seen = new Set();
    for (const e of b.enemies) if (!e.dead) { ensure(e, 'enemy', e.lane); seen.add(e.uid); }
    b.units.forEach((u, lane) => { if (u && !u.dead) { ensure(u, 'ally', lane); seen.add(u.uid); } });
    for (const item of b.removedEnemies || []) { ensure(item.unit, 'enemy', item.originalLane, true); seen.add(item.unit.uid); }
    if (!soft) for (const ent of [...units.values()]) if (!seen.has(ent.uid) && !ent.locked) { ctx.emit('hpChange', ent, -ent.lastHp, true); vanish(ent, first ? 'quiet' : 'death'); }
    hand.sync(b);
    syncProps(b);
    ctx.emit('battleSynced', b, soft);
  }
  function requestSync() { dirty = true; }
  function hold() { holdCount++; }
  function release() { holdCount = Math.max(0, holdCount - 1); if (!holdCount) dirty = true; }
  function clear(animated = false) {
    active = false;
    for (const ent of [...units.values()]) animated ? vanish(ent, 'quiet') : remove(ent);
    hand.clear();
    ctx.emit('battleCleared');
  }
  function get(uid) { return units.get(uid) || null; }
  function byRef(ref) { return ref && ref.uid != null ? units.get(ref.uid) || null : null; }
  function update(dt, t) {
    if (dirty && !holdCount) syncNow(false);
    hand.update(dt, t);
  }
  return {
    root, units, vanishing, hand, sync: requestSync, requestSync, syncNow, syncProps, hold, release, clear, get, byRef, place, create, vanish, remove, update,
    get active() { return active; }, set active(vl) { active = vl; }, get held() { return holdCount > 0; }
  };
}
