// 绝技小场景：每个是独立的 THREE.Scene（实体几何 + PBR 程序贴图 + 真实灯光 + 粒子），演出时临时替换后期链的主场景。
import * as THREE from 'three';
import { metalTextures, plasterTextures, clayTextures, glowTexture, smokeTexture, makeCanvas, canvasTexture, normalFromHeight, FONT } from '../scene/textures.js';
import { createFlame } from './flame.js';
import { mulberry } from '../core/tween.js';

const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const seg = (P, a, b) => ease((P - a) / (b - a));
const rnd = mulberry(404);

function pbr(t, color = '#ffffff', extra = {}) {
  return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, color, roughness: 1, metalness: .5, ...extra });
}
function points(n, spread, { size = .06, color = '#fff', tex = glowTexture(), opacity = .9 } = {}) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - .5) * spread[0]; pos[i * 3 + 1] = (rnd() - .5) * spread[1]; pos[i * 3 + 2] = (rnd() - .5) * spread[2]; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ size, color, map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  m.frustumCulled = false; return m;
}
function beamTexture() {
  const [c, g] = makeCanvas(64, 256), gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.3, 'rgba(0,0,0,.3)'); v.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  return canvasTexture(c);
}
function craterTexture() {
  const S = 1024, [c, g] = makeCanvas(S, S / 2), [hc, h] = makeCanvas(S, S / 2), r = mulberry(12);
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S / 2);
  g.fillStyle = '#c4c9d4'; g.fillRect(0, 0, S, S / 2);
  for (let i = 0; i < 90; i++) { const x = r() * S, y = r() * S / 2, rad = 6 + r() * r() * 70, dark = r() > .5; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, dark ? 'rgba(70,76,92,.35)' : 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); h.strokeStyle = 'rgba(255,255,255,.55)'; h.lineWidth = 3; h.beginPath(); h.arc(x, y, rad * .85, 0, 7); h.stroke(); const hg = h.createRadialGradient(x, y, 0, x, y, rad * .8); hg.addColorStop(0, 'rgba(0,0,0,.6)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); h.fillStyle = hg; h.beginPath(); h.arc(x, y, rad * .8, 0, 7); h.fill(); }
  for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S / 2, rad = 40 + r() * 160, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(90,96,116,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  return { map: canvasTexture(c), normal: normalFromHeight(hc, 4) };
}
function runeRingTexture(ch) {
  const [c, g] = makeCanvas(1024), r = mulberry(8);
  g.translate(512, 512); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 500, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 440, 0, 7); g.stroke();
  g.font = `bold 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 28; i++) { g.save(); g.rotate(i / 28 * 6.283); g.translate(0, -470); g.fillText(ch[i % ch.length], 0, 0); g.restore(); }
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 80; i++) { g.globalAlpha = r() * .6; g.beginPath(); g.arc((r() - .5) * 1000, (r() - .5) * 1000, 2 + r() * 8, 0, 7); g.fill(); }
  return canvasTexture(c);
}
function soldierTexture() {
  const [c, g] = makeCanvas(128, 256); g.fillStyle = '#000'; g.filter = 'blur(1px)';
  g.beginPath(); g.arc(64, 54, 18, 0, 7); g.fill(); g.fillRect(54, 38, 20, 6);
  g.beginPath(); g.moveTo(34, 256); g.lineTo(42, 84); g.quadraticCurveTo(64, 72, 86, 84); g.lineTo(94, 256); g.closePath(); g.fill();
  g.fillRect(100, 10, 5, 246); g.beginPath(); g.moveTo(102, 0); g.lineTo(112, 22); g.lineTo(94, 22); g.closePath(); g.fill();
  return canvasTexture(c);
}
function addStandee(sc, pos, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ transparent: true, alphaTest: .02, roughness: 1, side: THREE.DoubleSide, emissive: '#fff', emissiveIntensity: .12, opacity: 0 }));
  m.position.copy(pos); m.userData.h = h; m.visible = false; sc.add(m);
  sc.userData.standee = m;
  sc.userData.setPortrait = tex => {
    if (!tex) { m.visible = false; return; }
    m.material.map = tex; m.material.emissiveMap = tex; m.material.needsUpdate = true; m.visible = true;
    m.scale.set(h * (tex.userData.aspect || .6), h, 1);
  };
  return m;
}
function mkScene(bg, fogDensity, fov = 50) {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(bg); sc.fog = new THREE.FogExp2(bg, fogDensity);
  const cam = new THREE.PerspectiveCamera(fov, 1.78, .1, 120);
  sc.add(new THREE.AmbientLight('#8090a0', .35));
  return { sc, cam };
}
const shake = (t, a = .015) => new THREE.Vector3(Math.sin(t * 1.7) * a, Math.sin(t * 2.3 + 1) * a, 0);

// ───────── 鬼门关降临 ─────────
function gateScene(ctx) {
  const { sc, cam } = mkScene('#04090a', .035, 48);
  const bronze = metalTextures('gate_bronze', { base: '#6b4f2c', patina: '#2e7a62', amount: 1.6, seed: 21 });
  const stone = plasterTextures('cine_floor', { base: '#1c1e1d', seed: 31, repeat: [3, 3] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), pbr(stone, '#7f8784', { metalness: 0 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  const cracks = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: '#3ff0c8', map: (() => { const [c, g] = makeCanvas(512), r = mulberry(5); g.strokeStyle = '#fff'; for (let i = 0; i < 16; i++) { g.lineWidth = 1 + r() * 3; g.beginPath(); let x = 256, y = 256, a = r() * 6.28; g.moveTo(x, y); for (let k = 0; k < 14; k++) { a += (r() - .5) * 1.1; x += Math.cos(a) * 20; y += Math.sin(a) * 20; g.lineTo(x, y); } g.stroke(); } return canvasTexture(c); })() }));
  cracks.rotation.x = -Math.PI / 2; cracks.position.y = .02; sc.add(cracks);
  const gate = new THREE.Group(); sc.add(gate);
  const bm = pbr(bronze, '#c9a878', { metalness: .85 });
  for (const x of [-2.5, 2.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.7, 6, .8), bm); p.position.set(x, 3, 0); gate.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, .8, 1), bm); lintel.position.y = 6.2; gate.add(lintel);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.4, .3, 1.5), bm); roof.position.y = 6.75; gate.add(roof);
  const doors = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(s * 2.15, 0, 0); gate.add(hinge);
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.1, 5.7, .35), bm); d.position.set(-s * 1.05, 2.85, 0); hinge.add(d);
    const studs = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 10, 8), bm, 45), m4 = new THREE.Matrix4(); let n = 0;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 9; j++) { m4.setPosition(-s * (.3 + i * .38), .6 + j * .55, .22); studs.setMatrixAt(n++, m4); }
    hinge.add(studs);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.32, .06, 10, 24), bm); ring.position.set(-s * .35, 2.7, .42); hinge.add(ring);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 14, 10), bm); head.scale.set(1, .9, .6); head.position.set(-s * .35, 3.05, .32); hinge.add(head);
    for (const e of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(.07, .32, 8), bm); horn.position.set(-s * .35 + e * .2, 3.35, .32); horn.rotation.z = -e * .4; hinge.add(horn); }
    doors.push({ hinge, s });
  }
  const glow = new THREE.PointLight('#3fe8c0', 0, 30, 1.4); glow.position.set(0, 3, -1.5); sc.add(glow);
  const bt = beamTexture(), shafts = [];
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), new THREE.MeshBasicMaterial({ map: bt, color: '#7fffe0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.set((i - 3) * .55, 3.2, -.8 - i * .05); m.rotation.y = (i - 3) * .12; gate.add(m); shafts.push(m); }
  const key = new THREE.DirectionalLight('#9fb8b0', .6); key.position.set(-4, 6, 8); sc.add(key);
  const st = soldierTexture(), soldiers = [];
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), new THREE.MeshBasicMaterial({ map: st, transparent: true, opacity: 0, fog: false })); m.userData = { x: (rnd() - .5) * 3.2, z0: -10 - rnd() * 8, sp: .8 + rnd() * .6 }; sc.add(m); soldiers.push(m); }
  const dust = points(260, [10, 4, 8], { size: .09, color: '#7fa89a', opacity: .55 }); dust.position.y = 1.5; sc.add(dust);
  const standee = addStandee(sc, new THREE.Vector3(-3.4, 1.9, 4.4), 3.8);
  sc.userData.focus = 9;
  return {
    scene: sc, camera: cam, update(P, t) {
      const rise = seg(P, .06, .42), open = seg(P, .5, .72);
      gate.position.y = -7.4 + 7.4 * rise; gate.visible = P > .04;
      cracks.material.opacity = seg(P, .02, .15) * (1 - seg(P, .6, .8)) * .9; cracks.scale.setScalar(1 + rise * .4);
      for (const d of doors) d.hinge.rotation.y = d.s * -open * 1.35;
      glow.intensity = (open * 140 + rise * 14) * (.9 + .1 * Math.sin(t * 9));
      for (const [i, m] of shafts.entries()) m.material.opacity = open * (.28 + .1 * Math.sin(t * 3 + i));
      for (const m of soldiers) { const u = m.userData, k = seg(P, .58, .92); m.position.set(u.x * (1 + k * .6), 1.1, u.z0 + k * (8 + u.sp * 5)); m.material.opacity = k * (1 - seg(P, .93, 1)); m.lookAt(cam.position.x, 1.1, cam.position.z); }
      dust.rotation.y = t * .05; dust.position.y = 1.5 + Math.sin(t) * .1;
      const pos = dust.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { let y = pos.getY(i) + .004 * (1 + rise * 3); if (y > 3) y = -3; pos.setY(i, y); } pos.needsUpdate = true;
      cam.position.set(0, .7 + P * .5, 7.4 + P * 3.4).add(shake(t, .02)); cam.lookAt(0, 2.6 + rise * .4 + P * .2, 0);
      standee.material.opacity = seg(P, .58, .74) * (1 - seg(P, .94, 1)); standee.position.x = -3.4 + (1 - seg(P, .58, .8)) * -.6;
      standee.lookAt(cam.position.x, standee.position.y, cam.position.z);
    }
  };
}

// ───────── 太阴之力 ─────────
function moonScene() {
  const { sc, cam } = mkScene('#02040c', .012, 46);
  const ct = craterTexture();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 96, 64), new THREE.MeshStandardMaterial({ map: ct.map, normalMap: ct.normal, normalScale: new THREE.Vector2(2.4, 2.4), roughness: .95, metalness: 0, emissive: '#2a3550', emissiveIntensity: .35 }));
  moon.position.set(0, -12, -22); sc.add(moon);
  const sun = new THREE.DirectionalLight('#dfe8ff', 3.2); sun.position.set(-9, 3, 4); sc.add(sun);
  const rim = new THREE.DirectionalLight('#6f8fd8', .8); rim.position.set(6, 2, 5); sc.add(rim);
  const stars = points(1800, [160, 90, 20], { size: .22, color: '#dfe8ff', opacity: .9 }); stars.position.set(0, 10, -60); sc.add(stars);
  const clouds = [];
  for (let i = 0; i < 34; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: new THREE.Color('#7f94c4').lerp(new THREE.Color('#d8e4ff'), rnd() * .6), transparent: true, opacity: .55, depthWrite: false })); s.scale.set(16 + rnd() * 14, 6 + rnd() * 4, 1); s.position.set((rnd() - .5) * 70, -7.5 + rnd() * 1.6, -10 - rnd() * 24); s.userData = { sp: .1 + rnd() * .2, x0: s.position.x }; sc.add(s); clouds.push(s); }
  const streams = points(240, [2, 2, 2], { size: .16, color: '#bcd0ff', opacity: .9 }); sc.add(streams);
  const shoot = []; for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(5, .05), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); l.userData = { t0: .2 + i * .17 }; sc.add(l); shoot.push(l); }
  const standee = addStandee(sc, new THREE.Vector3(-2.6, -.2, -2), 4.2);
  const home = streams.geometry.attributes.position.array.slice();
  sc.userData.focus = 12;
  return {
    scene: sc, camera: cam, update(P, t) {
      const rise = seg(P, .04, .6); moon.position.y = -13 + rise * 13.4; moon.rotation.y = t * .02;
      stars.material.opacity = .2 + .8 * seg(P, .1, .6);
      for (const c of clouds) { c.position.x = c.userData.x0 + Math.sin(t * c.userData.sp) * 3; c.material.opacity = .5 * (1 - seg(P, .85, 1)); }
      for (const l of shoot) { const k = (P - l.userData.t0) / .18; l.material.opacity = k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0; l.position.set(20 - k * 40, 14 - k * 7 + l.userData.t0 * 6, -30); l.rotation.z = -.2; }
      const pos = streams.geometry.attributes.position, k = seg(P, .62, .94);
      for (let i = 0; i < pos.count; i++) { const sx = home[i * 3] * 20, sy = home[i * 3 + 1] * 14 + 4, sz = -25 + home[i * 3 + 2] * 6; const a = i * .37 + t; pos.setXYZ(i, THREE.MathUtils.lerp(sx, -2.6 + Math.cos(a) * .4 * (1 - k), k), THREE.MathUtils.lerp(sy, -.2 + Math.sin(a) * .8, k), THREE.MathUtils.lerp(sz, -2 + Math.sin(a) * .3, k)); }
      pos.needsUpdate = true; streams.material.opacity = seg(P, .55, .65);
      cam.position.set(Math.sin(t * .15) * .4, 1.2 - P * .3, 8 - P * 1.8).add(shake(t, .01)); cam.lookAt(0, 1.4 + rise * .4, -10);
      standee.material.opacity = seg(P, .6, .78) * (1 - seg(P, .95, 1)); standee.lookAt(cam.position.x, standee.position.y, cam.position.z);
    }
  };
}

// ───────── 鬼主权杖 ─────────
function sceptreScene() {
  const { sc, cam } = mkScene('#010604', .03, 44);
  const stone = plasterTextures('cine_floor', { base: '#1c1e1d', seed: 31, repeat: [3, 3] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), pbr(stone, '#6c746f', { metalness: .05, roughness: .6 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  const mt = metalTextures('scepter_gold', { base: '#4a3d1e', patina: '#1c5a3a', amount: 1.2, seed: 41 });
  const dark = pbr(mt, '#b8a070', { metalness: .9 });
  for (let i = 0; i < 10; i++) { const side = i % 2 ? 1 : -1, z = -2 - Math.floor(i / 2) * 5; const c = new THREE.Mesh(new THREE.CylinderGeometry(.7, .85, 12, 16), pbr(stone, '#8a928c', { metalness: 0 })); c.position.set(side * 6, 6, z); sc.add(c); }
  const rod = new THREE.Group(); sc.add(rod);
  const prof = [[0, 0], [.05, 0], [.07, .3], [.06, .5], [.1, .62], [.06, .74], [.06, 1.5], [.11, 1.6], [.06, 1.7], [.06, 2.6], [.12, 2.72], [.07, 2.84], [.07, 3.5], [.2, 3.6], [.26, 3.8], [.18, 4.0], [0, 4.0]].map(p => new THREE.Vector2(p[0] * 1.1, p[1]));
  rod.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 28), dark));
  const orb = new THREE.Mesh(new THREE.SphereGeometry(.3, 28, 20), new THREE.MeshStandardMaterial({ color: '#0a2a18', emissive: '#2cff8a', emissiveIntensity: 0, roughness: .2 })); orb.position.y = 4.35; rod.add(orb);
  for (let i = 0; i < 5; i++) { const cl = new THREE.Mesh(new THREE.ConeGeometry(.07, .62, 8), dark); const a = i / 5 * 6.283; cl.position.set(Math.cos(a) * .27, 4.1, Math.sin(a) * .27); cl.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); rod.add(cl); }
  const orbLight = new THREE.PointLight('#2cff8a', 0, 26, 1.6); orbLight.position.y = 4.35; rod.add(orbLight);
  const rings = [];
  for (const [i, r] of [2.2, 4.2, 6.4].entries()) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: runeRingTexture(['律令', '裁决', '幽冥'][i] + '镇魂敕封'), color: '#47ff9e', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .03; sc.add(m); rings.push(m); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, 1.1, 24, 32, 1, true), new THREE.MeshBasicMaterial({ map: beamTexture(), color: '#8affc0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 12; sc.add(beam);
  const dbr = []; for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.12 + rnd() * .2, .08, .12 + rnd() * .2), pbr(stone, '#7f8782', { metalness: 0 })); m.userData = { a: rnd() * 6.28, r: .8 + rnd() * 4, y: .05, v: .5 + rnd() * 1.4 }; sc.add(m); dbr.push(m); }
  const fill = new THREE.DirectionalLight('#3a5a48', .5); fill.position.set(3, 8, 6); sc.add(fill);
  const standee = addStandee(sc, new THREE.Vector3(-3.6, 1.8, 3.4), 3.8);
  sc.userData.focus = 10;
  return {
    scene: sc, camera: cam, update(P, t) {
      const fall = seg(P, .1, .46), land = seg(P, .46, .55);
      rod.position.y = THREE.MathUtils.lerp(11, -.05, fall * fall); rod.rotation.y = t * .3;
      orb.material.emissiveIntensity = seg(P, .12, .5) * 3.5; orbLight.intensity = seg(P, .12, .5) * 50 + seg(P, .8, .9) * 140;
      rings.forEach((m, i) => { const k = seg(P, .46 + i * .07, .6 + i * .07); m.material.opacity = k * .9 * (.85 + .15 * Math.sin(t * 3 + i)); m.rotation.z = t * (.15 + i * .08) * (i % 2 ? -1 : 1); m.scale.setScalar(.4 + k * .6); });
      beam.material.opacity = seg(P, .8, .88) * (1 - seg(P, .96, 1)) * .95; beam.scale.x = beam.scale.z = 1 + seg(P, .8, 1) * .6;
      for (const m of dbr) { const u = m.userData, k = land * (1 - seg(P, .95, 1)); m.position.set(Math.cos(u.a + t * .4) * u.r, .05 + k * u.v * (1 + seg(P, .8, .9) * 2), Math.sin(u.a + t * .4) * u.r); m.rotation.set(t * u.v, t, 0); m.visible = land > .02; }
      cam.position.set(Math.sin(P * 2) * 1.2, 5.5 - P * 3.4, 11 - P * 3).add(shake(t)); cam.lookAt(0, 3.4 + P * 1.2 - fall * 1.4, 0);
      standee.material.opacity = seg(P, .6, .76) * (1 - seg(P, .95, 1)); standee.lookAt(cam.position.x, standee.position.y, cam.position.z);
    }
  };
}

// ───────── 轮回 ─────────
function samsaraScene() {
  const { sc, cam } = mkScene('#0a0704', .02, 46);
  const bronze = metalTextures('wheel_bronze', { base: '#6a5230', patina: '#3a6a52', amount: 1.1, seed: 51 });
  const bm = pbr(bronze, '#d8c090', { metalness: .85 }), jade = new THREE.MeshPhysicalMaterial({ color: '#9fe0c0', roughness: .25, metalness: 0, transmission: 0, clearcoat: 1, emissive: '#2a6a50', emissiveIntensity: .25 });
  const wheel = new THREE.Group(); wheel.position.set(0, 3.2, -2); sc.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(3.2, .22, 20, 72), bm), new THREE.Mesh(new THREE.TorusGeometry(2.7, .1, 14, 72), jade), new THREE.Mesh(new THREE.TorusGeometry(.7, .14, 14, 40), bm));
  const panels = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * 6.283; const sp = new THREE.Mesh(new THREE.BoxGeometry(.2, 2.6, .18), bm); sp.position.set(Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
    const pn = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24, a + .12, 1.05 - .24), new THREE.MeshBasicMaterial({ color: '#ffe6b0', transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); wheel.add(pn); panels.push(pn);
  }
  const lotus = new THREE.Group(); lotus.position.set(0, 3.2, -1.6); sc.add(lotus);
  const petalM = new THREE.MeshStandardMaterial({ color: '#ffd8e0', emissive: '#ff9ab0', emissiveIntensity: .25, roughness: .5, transparent: true, opacity: .92, side: THREE.DoubleSide });
  const petals = [];
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 10; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), petalM); p.scale.set(.26, .95 - ring * .15, .05); const pv = new THREE.Group(); pv.add(p); p.position.y = (.95 - ring * .15); pv.rotation.y = i / 10 * 6.283 + ring * .3; const pitch = new THREE.Group(); pitch.add(pv); lotus.add(pitch); petals.push({ pitch, ring }); }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 1, 1), (() => { const [c, g] = makeCanvas(512), [hc, h] = makeCanvas(512); h.fillStyle = '#808080'; h.fillRect(0, 0, 512, 512); for (let i = 0; i < 30; i++) { h.strokeStyle = `rgba(255,255,255,${.1 + rnd() * .2})`; h.lineWidth = 2; h.beginPath(); h.arc(rnd() * 512, rnd() * 512, 20 + rnd() * 120, 0, 7); h.stroke(); } const n = normalFromHeight(hc, 3); n.repeat.set(6, 6); return new THREE.MeshStandardMaterial({ color: '#10161a', roughness: .08, metalness: .6, normalMap: n }); })());
  water.rotation.x = -Math.PI / 2; water.position.y = -.2; sc.add(water);
  const ripples = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffe6b0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = -.15; sc.add(m); ripples.push(m); }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.5, .05], [.9, .4], [1, .7], [.95, .72], [.85, .45], [.45, .12], [0, .1]].map(p => new THREE.Vector2(p[0], p[1])), 28), pbr(clayTextures('cine_bowl', { base: '#cfc4aa' }), '#fff', { metalness: 0, side: THREE.DoubleSide })); bowl.position.set(0, -.15, 3); sc.add(bowl);
  const spirit = points(420, [1, 1, 1], { size: .12, color: '#ffe6b0', opacity: .9 }); sc.add(spirit);
  const sh = spirit.geometry.attributes.position.array.slice();
  const key = new THREE.PointLight('#ffd89a', 60, 40, 1.4); key.position.set(0, 7, 3); sc.add(key);
  const standee = addStandee(sc, new THREE.Vector3(-4.2, 1.9, 2.6), 3.9);
  sc.userData.focus = 11;
  return {
    scene: sc, camera: cam, update(P, t) {
      wheel.rotation.z = -(t * .3 + P * P * 9); const bloom = seg(P, .38, .74);
      panels.forEach((p, i) => p.material.opacity = .15 + .15 * Math.sin(t * 2 + i));
      petals.forEach((q, i) => { q.pitch.rotation.x = THREE.MathUtils.lerp(.1, 1.45 - q.ring * .3, bloom); q.pitch.scale.setScalar(.2 + bloom * .95); });
      lotus.rotation.y = t * .4; lotus.position.y = 3.2 - (1 - bloom) * .6;
      ripples.forEach((m, i) => { const k = ((P * 2.4 - i * .2) % 1 + 1) % 1, on = seg(P, .55, .62) * (1 - seg(P, .94, 1)); m.scale.setScalar(.5 + k * 14); m.material.opacity = (1 - k) * .7 * on; m.position.set(0, -.15, 3); });
      const pos = spirit.geometry.attributes.position, k = seg(P, .5, .96);
      for (let i = 0; i < pos.count; i++) { const a = -(t * 1.4 + i * .31) , r = (1 - k) * (3 + sh[i * 3 + 2] * 5 + 2) + .2; pos.setXYZ(i, Math.cos(a) * r, 3.2 + sh[i * 3 + 1] * 5 * (1 - k) + Math.sin(a * .5) * .3, -2 + Math.sin(a) * r * .6); }
      pos.needsUpdate = true; spirit.material.opacity = seg(P, .45, .55);
      cam.position.set(Math.sin(t * .2) * .6, 3 + Math.sin(P * 3) * .4, 11 - P * 2.2).add(shake(t, .012)); cam.lookAt(0, 3, -2);
      standee.material.opacity = seg(P, .62, .78) * (1 - seg(P, .95, 1)); standee.lookAt(cam.position.x, standee.position.y, cam.position.z);
    }
  };
}

// ───────── 女王领域 ─────────
function queenScene() {
  const { sc, cam } = mkScene('#0a0603', .022, 46);
  const gold = metalTextures('queen_gold', { base: '#8a6a22', patina: '#6a5018', amount: .5, seed: 61 });
  const gm = pbr(gold, '#ffe0a0', { metalness: .95, roughness: .45 });
  const stone = plasterTextures('cine_floor', { base: '#2a2118', seed: 71, repeat: [3, 3] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), pbr(stone, '#8a7a66', { metalness: .1, roughness: .55 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  const palace = new THREE.Group(); sc.add(palace);
  const parts = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(9 - i * .9, .3, 3.2 + i * .7 * 0), gm); s.position.set(0, .15 + i * .3, -7 + i * .6); palace.add(s); parts.push(s); }
  for (const x of [-4, -2.4, -.8, .8, 2.4, 4]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, 5.2, 16), gm); c.position.set(x, 3.8, -7.5); palace.add(c); parts.push(c); const cap = new THREE.Mesh(new THREE.BoxGeometry(.7, .25, .7), gm); cap.position.set(x, 6.5, -7.5); palace.add(cap); parts.push(cap); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, .2, 14, 48, Math.PI), gm); arch.position.set(0, 3.2, -7.2); palace.add(arch); parts.push(arch);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10.5, .5, 2.8), gm); roof.position.set(0, 6.9, -7.4); roof.rotation.z = 0; palace.add(roof); parts.push(roof);
  const lamps = [];
  for (const x of [-3.2, -1.6, 0, 1.6, 3.2]) { const l = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffd070', emissive: '#ffb040', emissiveIntensity: 2.2 })); l.position.set(x, 5.4, -6.2); palace.add(l); lamps.push(l); const pl = new THREE.PointLight('#ffc060', 0, 14, 1.6); pl.position.copy(l.position); palace.add(pl); l.userData.pl = pl; }
  const grounds = []; for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 96), new THREE.MeshBasicMaterial({ color: '#ffd070', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(0, .04, -3); sc.add(m); grounds.push(m); }
  const crest = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: runeRingTexture('凤翔九天月阙长明'), color: '#ffd070', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); crest.rotation.x = -Math.PI / 2; crest.position.set(0, .05, -3); sc.add(crest);
  const phoenix = points(360, [1, 1, 1], { size: .22, color: '#ffc860', opacity: .95 }); sc.add(phoenix);
  const ph0 = phoenix.geometry.attributes.position.array.slice();
  const dust = points(180, [14, 6, 10], { size: .07, color: '#ffe8b8', opacity: .6 }); dust.position.set(0, 3, -3); sc.add(dust);
  const key = new THREE.DirectionalLight('#ffd8a0', .6); key.position.set(-5, 8, 6); sc.add(key);
  const standee = addStandee(sc, new THREE.Vector3(-3.3, 1.9, 1.8), 3.8);
  sc.userData.focus = 11;
  return {
    scene: sc, camera: cam, update(P, t) {
      parts.forEach((m, i) => { const k = seg(P, .06 + (i % 9) * .035, .22 + (i % 9) * .035); m.visible = k > .01; m.scale.y = Math.max(.001, k); m.position.y += 0; });
      lamps.forEach((l, i) => { const k = seg(P, .24 + i * .04, .36 + i * .04); l.userData.pl.intensity = k * 30; l.material.emissiveIntensity = k * 2.4 * (.9 + .1 * Math.sin(t * 8 + i)); l.position.y = 5.4 - seg(P, .78, .9) * .6; });
      grounds.forEach((m, i) => { const k = seg(P, .26 + i * .03, .62 + i * .03); m.scale.setScalar(.5 + k * (3 + i * 3.5)); m.material.opacity = k * (1 - i / 9) * .75; });
      crest.material.opacity = seg(P, .3, .5) * .6; crest.rotation.z = t * .08; crest.scale.setScalar(1 + seg(P, .3, .7) * .4);
      const pos = phoenix.geometry.attributes.position, k = seg(P, .42, .8);
      for (let i = 0; i < pos.count; i++) { const u = i / pos.count, x = THREE.MathUtils.lerp(-16, 12, k) - u * 9, y = 3.8 + Math.sin(x * .5 + t * 2) * 1.2 + Math.sin(u * 9 + t * 6) * (.2 + u * .8) * (ph0[i * 3] + .5), z = -4 + ph0[i * 3 + 2] * 3; pos.setXYZ(i, x, y + ph0[i * 3 + 1] * .5, z); }
      pos.needsUpdate = true; phoenix.material.opacity = seg(P, .42, .5) * (1 - seg(P, .82, .9));
      const press = seg(P, .74, .94), dp = dust.geometry.attributes.position; for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) - (.003 + press * .05); if (y < -3) y = 3; dp.setY(i, y); } dp.needsUpdate = true;
      cam.position.set(Math.sin(P * 1.5) * 1.5, 2.8 - P * .6, 10 - P * 2.4).add(shake(t, .012)); cam.lookAt(0, 3.4, -6);
      standee.material.opacity = seg(P, .6, .76) * (1 - seg(P, .95, 1)); standee.lookAt(cam.position.x, standee.position.y, cam.position.z);
    }
  };
}

// ───────── 半完全火焰规律 ─────────
const FIRE_FRAG = `uniform float uTime,uSeed,uWing,uAmt;uniform float uCol;varying vec2 vUv;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<6;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
void main(){
  float t=uTime;vec2 uv=vUv;float x=(uv.x-.5)*2.,y=uv.y;
  float env;
  if(uWing>.5){float ax=uv.x;float yc=.12+.62*pow(ax,1.35);float th=.2*(1.-ax*.55);env=smoothstep(th,th*.25,abs(uv.y-yc))*smoothstep(0.,.12,ax)*smoothstep(1.,.78,ax);y=clamp((uv.y-yc)/th*.5+.5,0.,1.);x=ax*2.-1.;}
  else{float w=.85*(1.-y*.72)+.1;env=smoothstep(w,w*.2,abs(x))*smoothstep(.05,.5,y)*(1.-smoothstep(.82,1.,y));}
  vec2 q=vec2(x*1.5+uSeed,uv.y*2.2-t*1.5);
  float warp=fbm(q*1.4+vec2(0.,t*.3))-.5;
  float n=fbm(q+vec2(warp*1.1,0.))+warp*.5;
  float d=env*1.25+(n-.5)*1.6-(uWing>.5?.0:y*.55);
  float dens=smoothstep(.05,.62,d);
  if(dens<.01)discard;
  float heat=clamp(dens*1.15-(uWing>.5?.1:y*.7)+(n-.5)*.4,0.,1.);
  vec3 c=mix(vec3(.12,.02,.0),vec3(.9,.18,.02),smoothstep(.0,.35,heat));
  c=mix(c,vec3(1.,.55,.1),smoothstep(.3,.62,heat));c=mix(c,vec3(1.,.93,.7),smoothstep(.65,.95,heat));
  gl_FragColor=vec4(c*.5,dens*uAmt*.5);
}`;
function flameScene() {
  const { sc, cam } = mkScene('#030100', .02, 46);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#150b06', roughness: .35, metalness: .5 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  const light = new THREE.PointLight('#ff7a2a', 0, 40, 1.4); light.position.set(0, 2.6, 0); sc.add(light);
  const rune = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; const fl = createFlame({ color: '#ff5a1a', core: '#ffe9a0', width: .28, height: 1.1, seed: i * 7 }); fl.mesh.position.set(Math.cos(a) * 3, .02, Math.sin(a) * 3); fl.mesh.visible = false; sc.add(fl.mesh); rune.push(fl); const s = new THREE.Mesh(new THREE.CircleGeometry(.2, 12), new THREE.MeshBasicMaterial({ color: '#ff7a2a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending })); s.rotation.x = -Math.PI / 2; s.position.set(Math.cos(a) * 3, .03, Math.sin(a) * 3); sc.add(s); fl.glow = s; }
  const ringM = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.05, 96), new THREE.MeshBasicMaterial({ color: '#ff8a30', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); ringM.rotation.x = -Math.PI / 2; ringM.position.y = .03; sc.add(ringM);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff0c0' })); spark.position.y = 1.2; sc.add(spark);
  const mkFire = (wing, seed, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uWing: { value: wing }, uAmt: { value: 0 }, uCol: { value: 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: FIRE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.visible = false; return m; };
  const sheets = []; const body = new THREE.Group(); body.position.y = 0; sc.add(body);
  for (let i = 0; i < 6; i++) { const m = mkFire(0, i * 3.7, 5.2 - (i % 3) * .5, 7.5 + (i % 4) * .6); const a = i / 6 * Math.PI; m.rotation.y = a; m.position.y = 3.6; m.userData.a = a; body.add(m); sheets.push(m); }
  const wings = [];
  const baseGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd9a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); baseGlow.scale.set(7, 4, 1); baseGlow.position.y = .5; sc.add(baseGlow);
  const smoke = []; for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: '#2a1a12', transparent: true, opacity: 0, depthWrite: false })); s.userData = { a: rnd() * 6.28, r: 1.5 + rnd() * 4, h: 2 + rnd() * 5 }; s.scale.setScalar(3 + rnd() * 3); sc.add(s); smoke.push(s); }
  const sparks = points(700, [9, 6, 9], { size: .09, color: '#ffb050', opacity: .95 }); sc.add(sparks);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(14, .06), new THREE.MeshBasicMaterial({ color: '#fff4d8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending })); line.position.y = 2.2; sc.add(line);
  const standee = addStandee(sc, new THREE.Vector3(-4.2, 1.9, 2.8), 3.8);
  sc.userData.focus = 11;
  return {
    scene: sc, camera: cam, heat: true, update(P, t) {
      spark.visible = P < .3; spark.scale.setScalar(1 + Math.sin(t * 30) * .3); spark.position.y = 1.2 + P * 2;
      const ig = seg(P, .14, .42), st = seg(P, .4, .56), wg = seg(P, .52, .68), col = seg(P, .84, .94);
      rune.forEach((fl, i) => { const k = ig * 12 > i ? 1 : 0; fl.mesh.visible = k > 0 && col < .5; fl.set({ intensity: k * .9, lean: Math.sin(t + i) * .2 }); fl.glow.material.opacity = k * .6 * (1 - col); });
      ringM.material.opacity = ig * .9 * (1 - col);
      body.rotation.y = t * 1.1; body.position.y = 0; baseGlow.material.opacity = st * (1 - col) * .9; baseGlow.scale.set(7 + Math.sin(t * 9) * .3, 4, 1);
      sheets.forEach((m, i) => { m.visible = st > .02 && col < .98; m.material.uniforms.uTime.value = t; m.material.uniforms.uAmt.value = st * (1 - col) * (.85 + .15 * Math.sin(t * 7 + i)); m.position.y = m.geometry.parameters.height * ((.5 + st * .6) * (1 - col * .3)) / 2 + .35; const k = 1 - col * .9; m.scale.set(k * (.6 + st * .5), (.5 + st * .6) * (1 - col * .3), 1); });
      wings.forEach((m, i) => { m.visible = wg > .02 && col < .98; m.material.uniforms.uTime.value = t; m.material.uniforms.uAmt.value = wg * (1 - col); m.position.y = 2.2 + wg * 1.6; m.scale.y = .6 + wg * .5; m.scale.x = (i ? -1 : 1) * (.4 + wg * .7); m.lookAt(cam.position.x, m.position.y, cam.position.z); m.scale.x = (i ? -1 : 1) * (.4 + wg * .7); });
      smoke.forEach((s, i) => { const u = s.userData; s.position.set(Math.cos(u.a + t * .3) * u.r, u.h + Math.sin(t + i) * .3, Math.sin(u.a + t * .3) * u.r); s.material.opacity = st * .5; });
      const sp = sparks.geometry.attributes.position; for (let i = 0; i < sp.count; i++) { let y = sp.getY(i) + .03 + (i % 5) * .004; if (y > 5.5) y = -.5; sp.setY(i, y); sp.setX(i, sp.getX(i) + Math.sin(t * 2 + i) * .004); } sp.needsUpdate = true; sparks.material.opacity = st * .95 * (1 - col) + ig * .3;
      light.intensity = (ig * 40 + st * 220) * (1 - col * .8) * (.88 + .12 * Math.sin(t * 17) + .05 * Math.sin(t * 41)); light.color.setHSL(.07 + .02 * Math.sin(t), 1, .55);
      line.material.opacity = seg(P, .88, .93) * (1 - seg(P, .97, 1)); line.scale.x = 1 - seg(P, .94, 1);
      cam.position.set(Math.sin(t * .25) * 1.2, 2.4 + P * .4, 9.6 - P * 1.4).add(shake(t, .02)); cam.lookAt(0, 2.6 + P * .3, 0);
      standee.material.opacity = seg(P, .6, .74) * (1 - seg(P, .94, 1)); standee.lookAt(cam.position.x, standee.position.y, cam.position.z);
    }
  };
}
export function buildCineScenes(ctx) {
  return { 2: sceptreScene(ctx), 3: moonScene(ctx), 4: samsaraScene(ctx), 5: gateScene(ctx), 6: queenScene(ctx), 7: flameScene(ctx) };
}
