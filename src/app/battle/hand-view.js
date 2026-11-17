import * as THREE from 'three';
import { Card3D, CARD_H } from '../cards/card-mesh.js';
import { register, unregister } from '../core/input.js';
import { damp } from '../core/tween.js';

const D = 2.3;

export function createHandView(ctx) {
  const { rig, scene } = ctx, camera = rig.camera;
  const group = new THREE.Group();
  camera.add(group);
  let items = [], hovered = null, visible = true, lowered = 0, handlers = {}, nextSpawn = null;
  const tmp = new THREE.Vector3();

  function entryKey(entry) {
    const sp = globalThis.GC.query.handSpirit(entry);
    return sp ? 'g:' + sp.id : 'c:' + entry;
  }
  function metrics() {
    const halfH = D * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), halfW = halfH * camera.aspect;
    const cardH = halfH * .5, s = cardH / CARD_H;
    return { halfH, halfW, cardH, s };
  }
  function spawnPoint() {
    const p = ctx.props.deck.topPosition(tmp);
    return camera.worldToLocal(p.clone());
  }
  function make(entry, key) {
    const card = new Card3D({ emissive: .2 });
    const item = { key, entry, card, hover: 0, raise: 0, index: 0, free: false };
    const custom = nextSpawn?.shift(), sp = custom ? camera.worldToLocal(custom.clone()) : spawnPoint();
    card.group.position.copy(sp); card.group.scale.setScalar(custom ? .42 : .2); card.group.rotation.set(-1.2, 0, custom ? 0 : .4);
    group.add(card.group);
    register(card.group, {
      enabled: () => visible && !item.free,
      onHover: () => { hovered = item; handlers.onHover?.(item); },
      onOut: () => { if (hovered === item) hovered = null; handlers.onOut?.(item); },
      onClick: () => handlers.onClick?.(item),
      onLongPress: () => handlers.onDetail?.(item),
      onContext: () => handlers.onDetail?.(item)
    });
    return item;
  }
  function refresh(item, b) {
    const Q = globalThis.GC.query, sp = Q.handSpirit(item.entry);
    if (sp) {
      item.card.setUnit(sp);
      const cost = Q.spiritCost();
      item.cost = cost; item.kind = 'ghost'; item.unit = sp;
    } else {
      item.card.setSkill(item.entry);
      item.cost = globalThis.GC.SKILLS[item.entry]?.cost ?? 0; item.kind = 'card';
    }
    item.affordable = b.qi >= item.cost;
    item.card.setCost(item.cost, item.affordable);
  }
  function sync(b) {
    const pool = items.slice(), next = [];
    b.hand.forEach((entry, index) => {
      const key = entryKey(entry);
      let i = pool.findIndex(it => it.entry === entry && typeof entry === 'object');
      if (i < 0) i = pool.findIndex(it => it.key === key && (typeof entry !== 'object' || typeof it.entry !== 'object'));
      const item = i >= 0 ? pool.splice(i, 1)[0] : make(entry, key);
      item.entry = entry; item.index = index;
      refresh(item, b);
      next.push(item);
    });
    for (const old of pool) drop(old);
    nextSpawn = null;
    items = next;
  }
  function drop(item) {
    if (hovered === item) hovered = null;
    unregister(item.card.group);
    item.card.dispose();
  }
  function detach(index) {
    const i = items.findIndex(it => it.index === index);
    if (i < 0) return null;
    const item = items.splice(i, 1)[0];
    item.free = true;
    if (hovered === item) hovered = null;
    unregister(item.card.group);
    scene.attach(item.card.group);
    return item;
  }
  function clear() { for (const it of items) drop(it); items = []; }
  function setVisible(v) { visible = v; }
  function setLowered(v) { lowered = v; }
  function setHandlers(h) { handlers = h; }
  function spawnFrom(world) { (nextSpawn ||= []).push(world.clone()); }
  function itemAt(index) { return items.find(it => it.index === index) || null; }

  function update(dt, t) {
    group.visible = visible || items.some(it => it.card.group.position.y > -3);
    const m = metrics(), n = items.length, mid = (n - 1) / 2;
    const spacing = n > 1 ? Math.min(m.s * .82, (m.halfW * .92) / (n - 1)) : 0;
    const hi = hovered ? items.indexOf(hovered) : -1;
    items.forEach((it, i) => {
      const sel = it.selected ? 1 : 0;
      it.hover = damp(it.hover, hovered === it ? 1 : 0, 14, dt);
      const grow = it.hover * (lowered ? .25 : 1), lift = Math.max(grow, sel * .5);
      let x = (i - mid) * spacing;
      if (hi >= 0 && i !== hi && !lowered) x += Math.sign(i - hi) * m.s * .3 * Math.exp(-Math.abs(i - hi) * .5 + .5) * .6;
      const baseY = -m.halfH + m.cardH * .43 - Math.pow(i - mid, 2) * .006 * m.s - lowered * m.cardH * .5 - (visible ? 0 : m.cardH * 1.4);
      const y = baseY + lift * m.cardH * .33;
      const z = -D + i * .006 + grow * .22 + sel * .03;
      const scale = m.s * (1 + grow * .42 + sel * .06);
      const rz = -(i - mid) * .05 * (1 - grow), rx = -.14 * (1 - grow);
      const g = it.card.group, k = 12;
      g.position.set(damp(g.position.x, x, k, dt), damp(g.position.y, y, k, dt), damp(g.position.z, z, k, dt));
      g.rotation.set(damp(g.rotation.x, rx, k, dt), damp(g.rotation.y, 0, k, dt), damp(g.rotation.z, rz, k, dt));
      g.scale.setScalar(damp(g.scale.x, scale, k, dt));
      g.renderOrder = 10 + i;
    });
  }
  return { group, sync, update, clear, detach, itemAt, setVisible, setLowered, setHandlers, spawnFrom, get items() { return items; }, get hovered() { return hovered; } };
}
