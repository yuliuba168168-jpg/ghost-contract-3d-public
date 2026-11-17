import * as THREE from 'three';
import { woodTextures, inkRuneTexture, ashTexture, PALETTE } from './textures.js';
import { damp } from '../core/tween.js';

export const TABLE = { w: 9, d: 5.6, floorY: -7.5 };
export const LANES_X = [-1.95, -.65, .65, 1.95];
export const ROW_Z = { enemy: -1.36, ally: .7 };

export function createTable(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const wood = woodTextures('table', { base: '#2a160f', tone: '#5a2f1c', seed: 11, wear: 1.4, wax: 46 });
  for (const k of ['map', 'bump', 'normal', 'rough']) wood[k].repeat.set(1.6, 1);
  const topMat = new THREE.MeshStandardMaterial({ map: wood.map, normalMap: wood.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughnessMap: wood.rough, roughness: 1, metalness: .02, color: '#bfa898' });
  const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, .36, TABLE.d), topMat);
  top.position.y = -.18; top.receiveShadow = true; top.castShadow = true;
  group.add(top);

  const legWood = woodTextures('leg', { base: '#1c0e0a', tone: '#3a2014', seed: 4, wear: .6 });
  const darkMat = new THREE.MeshStandardMaterial({ map: legWood.map, normalMap: legWood.normal, roughnessMap: legWood.rough, roughness: 1, color: '#8a7468' });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w - .5, .7, TABLE.d - .5), darkMat);
  apron.position.y = -.7; group.add(apron);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.55, -TABLE.floorY, .55), darkMat);
    leg.position.set(x * (TABLE.w / 2 - .45), TABLE.floorY / 2, z * (TABLE.d / 2 - .45));
    group.add(leg);
  }
  const trimMat = new THREE.MeshStandardMaterial({ color: '#4a3226', roughness: .38, metalness: .05, map: legWood.map, normalMap: legWood.normal });
  for (const z of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w + .08, .1, .08), trimMat); t.position.set(0, -.02, z * TABLE.d / 2); group.add(t); }
  for (const x of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, TABLE.d + .08), trimMat); t.position.set(x * TABLE.w / 2, -.02, 0); group.add(t); }

  const slots = { enemy: [], ally: [] };
  const slotGeo = new THREE.PlaneGeometry(1.62, 1.62);
  for (const side of ['enemy', 'ally']) for (let lane = 0; lane < 4; lane++) {
    const mat = new THREE.MeshStandardMaterial({ map: inkRuneTexture(lane + (side === 'enemy' ? 4 : 0)), color: side === 'enemy' ? '#7a1d12' : '#b8b09a', roughness: .9, transparent: true, opacity: .75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, emissive: '#000000' });
    const mesh = new THREE.Mesh(slotGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(LANES_X[lane], .004, ROW_Z[side]);
    mesh.renderOrder = 1;
    mesh.userData = { ink: new THREE.Color(side === 'enemy' ? '#7a1d12' : '#b8b09a'), lit: new THREE.Color(side === 'enemy' ? '#ff5a30' : '#ffe2a8'), level: 0, target: 0, base: .75, seed: lane * 1.7 + (side === 'enemy' ? 3 : 0), side, lane, spin: 0 };
    group.add(mesh); slots[side].push(mesh);
  }

  const ash = new THREE.Mesh(new THREE.PlaneGeometry(6.4, .42), new THREE.MeshBasicMaterial({ map: ashTexture(), transparent: true, opacity: .5, depthWrite: false, color: '#d9d2c4' }));
  ash.rotation.x = -Math.PI / 2; ash.position.set(0, .003, -.23);
  group.add(ash);

  function setSlotGlow(side, lane, level) { const m = slots[side]?.[lane]; if (m) m.userData.target = level; }
  function clearGlow() { for (const side of ['enemy', 'ally']) for (const m of slots[side]) m.userData.target = 0; }
  function pulseSlot(side, lane, amount = 1.4) { const m = slots[side]?.[lane]; if (m) m.userData.level = Math.max(m.userData.level, amount); }
  let plain = 0;
  function setPlain(v) { plain = v; ash.material.opacity = .5 * (1 - v); }
  function update(dt, t) {
    for (const side of ['enemy', 'ally']) for (const m of slots[side]) {
      const u = m.userData;
      u.level = damp(u.level, u.target, 6, dt);
      const breathe = .5 + .5 * Math.sin(t * 1.1 + u.seed);
      m.material.opacity = Math.min(1, u.base + u.level * .3) * (1 - plain); m.visible = plain < .98;
      m.material.emissive.copy(u.lit).multiplyScalar(Math.min(1.2, u.level * .9 * (.8 + .2 * Math.sin(t * 5 + u.seed))));
      if (u.level > .02) m.rotation.z += dt * u.level * .35 * (side === 'enemy' ? -1 : 1);
    }
  }
  return { group, top, slots, slotGeo, setPlain, setSlotGlow, clearGlow, pulseSlot, update, cinnabar: PALETTE.cinnabar };
}
