import * as THREE from 'three';
import { flameTexture, glowTexture, smokeTexture, woodTextures, metalTextures, clayTextures, waxEmissive, makeCanvas, canvasTexture, FONT, PALETTE } from './textures.js';
import { createFlame } from '../fx/flame.js';
import { tween, damp, mulberry } from '../core/tween.js';

const V2 = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(p => V2(p[0], p[1])), seg);
const mats = {};
function bronze() { if (!mats.bronze) { const t = metalTextures('bronze'); mats.bronze = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, color: '#b8a080', metalness: .85, roughness: 1 }); } return mats.bronze; }
function darkBronze() { if (!mats.darkBronze) { const t = metalTextures('darkBronze', { base: '#3a2e22', patina: '#2a3a32', seed: 9 }); mats.darkBronze = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, color: '#a09080', metalness: .75, roughness: 1 }); } return mats.darkBronze; }
function wax() { return mats.wax ||= new THREE.MeshStandardMaterial({ color: '#d6c9a6', roughness: .48, emissive: '#ffffff', emissiveMap: waxEmissive(), emissiveIntensity: .5 }); }
function clay() { if (!mats.clay) { const t = clayTextures(); mats.clay = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, color: '#b0a090', roughness: 1, metalness: .03, side: THREE.DoubleSide }); } return mats.clay; }
function lacquer() {
  if (!mats.lacquer) { const w = woodTextures('leg'); mats.lacquer = new THREE.MeshStandardMaterial({ map: w.map, normalMap: w.normal, roughnessMap: w.rough, color: '#6a4a40', roughness: 1 }); }
  return mats.lacquer;
}
const flameMats = new Map();
function flameMat(color, glow) {
  const key = color + (glow ? 'g' : 'f');
  if (!flameMats.has(key)) flameMats.set(key, new THREE.SpriteMaterial({ map: glow ? glowTexture() : flameTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: glow ? .1 : 1 }));
  return flameMats.get(key);
}

export function makeLabel(text, { w = 256, h = 80, size = 40, color = '#cdbf9f', scale = .9 } = {}) {
  const [c, g] = makeCanvas(w * 2, h * 2), tex = canvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.layers.set(1);
  sprite.scale.set(scale, scale * h / w, 1);
  sprite.renderOrder = 20;
  let last = null;
  sprite.userData.noPick = true;
  sprite.set = (t, col = color) => {
    if (t === last) return;
    last = t;
    g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, w, h);
    if (!t) { tex.needsUpdate = true; return; }
    let fs = size; do { g.font = `bold ${fs}px ${FONT}`; fs -= 3; } while (g.measureText(t).width > w - 40 && fs > 14);
    const tw = g.measureText(t).width, bw = tw + 30, bh = fs * 1.55;
    g.fillStyle = 'rgba(14,11,9,.62)'; g.beginPath(); g.roundRect((w - bw) / 2, (h - bh) / 2, bw, bh, 2); g.fill();
    g.strokeStyle = 'rgba(201,162,90,.45)'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = col; g.globalAlpha = .92; g.fillText(t, w / 2, h / 2 + 2); g.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  sprite.set(text);
  return sprite;
}
export function createProps(scene, lights) {
  const group = new THREE.Group();
  scene.add(group);
  const flames = [], rnd = mulberry(31);

  function makeFlame(color = PALETTE.candle, size = .24, withGlow = true, shape = 'candle') {
    const g = new THREE.Group(), fl = createFlame({ color, core: '#fff2d2', width: size * .4, height: size * 1.05, shape, seed: rnd() * 90 });
    g.add(fl.mesh);
    let glow = null;
    if (withGlow) { glow = new THREE.Sprite(flameMat(color, true)); glow.position.y = size * .4; glow.userData.noPick = true; g.add(glow); }
    const f = { group: g, s: fl.mesh, fl, glow, size, level: 1, target: 1, seed: rnd() * 100 };
    flames.push(f);
    g.userData.flame = f;
    return f;
  }
  const smokes = [];
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: '#8a86a8', transparent: true, opacity: 0, depthWrite: false }));
    sp.visible = false; sp.userData.noPick = true; group.add(sp); smokes.push(sp);
  }
  let smokeIndex = 0;
  function puff(pos, { color = '#8a86a8', size = .5, rise = .9, dur = 1300 } = {}) {
    const sp = smokes[smokeIndex++ % smokes.length];
    sp.visible = true; sp.position.copy(pos); sp.material.color.set(color); sp.material.opacity = .5; sp.scale.setScalar(size * .35);
    sp.material.rotation = Math.random() * 6;
    tween(sp.position, { y: pos.y + rise, x: pos.x + (Math.random() - .5) * .3 }, { dur, ease: 'outQuad' });
    tween(sp.scale, { x: size, y: size }, { dur, ease: 'outQuad' });
    tween(sp.material, { opacity: 0 }, { dur, ease: 'inQuad' }).then(() => { sp.visible = false; });
  }

  function candle(x, z, h, r, lit = true, mat = wax(), flameColor = PALETTE.candle) {
    const g = new THREE.Group(), stem = new THREE.Group();
    const prof = [], N = 14;
    for (let i = 0; i <= N; i++) {
      const u = i / N, lump = Math.sin(u * 9 + x * 5) * .07 + Math.sin(u * 23 + z * 7) * .035 + (rnd() - .5) * .04, melt = u > .88 ? (1 - (u - .88) / .12 * .35) : 1;
      prof.push([r * (1.04 - u * .12 + lump) * melt, h * u]);
    }
    prof.push([r * .78, h - .004], [r * .5, h - .022], [.012, h - .03], [0, h - .03]);
    const body = new THREE.Mesh(lathe(prof, 18), mat);
    body.castShadow = true; body.receiveShadow = true;
    const pool = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8), mat);
    pool.scale.set(1.8, .2, 1.8); pool.position.y = .008; pool.receiveShadow = true;
    for (let i = 0; i < 3; i++) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(r * .32, 8, 6), mat), a = rnd() * 6.28;
      drip.scale.y = 1.6 + rnd() * 2; drip.position.set(Math.cos(a) * r * .88, h * (.45 + rnd() * .45), Math.sin(a) * r * .88);
      stem.add(drip);
    }
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .06, 5), darkBronze());
    wick.position.y = h + .03;
    stem.add(body); g.add(stem, pool, wick);
    g.position.set(x, 0, z); g.rotation.z = Math.atan(.07 * x) + (rnd() - .5) * .06; g.rotation.x = (rnd() - .5) * .04;
    let f = null;
    if (lit) { f = makeFlame(flameColor, .26 + r * .6); f.group.position.y = h + .03; g.add(f.group); }
    group.add(g);
    return { group: g, stem, pool, wick, h, flame: f, top: new THREE.Vector3(x, h + .15, z) };
  }
  // 装饰蜡烛只留三支（左后一高一矮、右前一支）；其余位置让给两支命烛，桌面更干净
  const decor = [[-4.05, -2.25, 1.35, .13, 9], [-3.45, -2.5, .7, .1, 0], [4.26, .78, .85, .11, 6]];
  lights.addCandle(-3.42, 1.55, 1.66, 6);   // 我方命烛的烛光（原先左前装饰蜡烛的那盏灯）
  for (const [x, z, h, r, power] of decor) { const c = candle(x, z, h, r); if (power) lights.addCandle(x - Math.sin(c.group.rotation.z) * (h + .35), (h + .35) * Math.cos(c.group.rotation.z), z, power); }

  // 命烛：双方各一支，代替原来的二十盏命灯和数字。蜡烧得越短、火越小，命越薄；剩不到三成时火苗乱抖。具体数值只在鼠标悬停时提示。
  function lifeCandle(side) {
    const ally = side === 'ally';
    const c = ally ? candle(-3.42, 1.66, 1.2, .2) : candle(2.62, -2.45, 1.0, .16, true, new THREE.MeshStandardMaterial({ color: '#7a1810', roughness: .42 }), '#d8442a');
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(ally ? .36 : .3, ally ? .3 : .25, .04, 24), ally ? bronze() : darkBronze());
    dish.position.y = .018; dish.receiveShadow = true; c.group.add(dish);
    c.flame.size *= ally ? 1.4 : 1.25;
    return { ...c, root: c.group, value: -1, max: -1, ratio: 1, level: 1, base: c.flame.size };
  }
  const life = { ally: lifeCandle('ally'), enemy: lifeCandle('enemy') };
  function setLife(side, value, max = 10) {
    const L = life[side];
    if (L.value === value && L.max === max) return;
    const before = L.ratio;
    L.value = value; L.max = max; L.ratio = Math.max(0, Math.min(1, value / Math.max(1e-6, max)));
    if (L.ratio < before - .001) { const w = lifeAnchor(side); puff(w, { size: L.ratio <= 0 ? .5 : .3, rise: .6, color: side === 'ally' ? '#8a86a8' : '#7a4a44' }); }
  }
  function lifeAnchor(side, target = new THREE.Vector3()) {
    const L = life[side];
    return L.group.localToWorld(target.set(0, L.h * L.stem.scale.y + .15, 0));
  }
  function updateLife(dt, t) {
    for (const side of ['ally', 'enemy']) {
      const L = life[side];
      L.level = damp(L.level, L.ratio, 3.5, dt);
      const k = .12 + .88 * L.level, top = L.h * k;
      L.stem.scale.y = k; L.wick.position.y = top + .03; L.flame.group.position.y = top + .03;
      L.pool.scale.set(1.8 + (1 - L.level) * 1.5, .2 + (1 - L.level) * .12, 1.8 + (1 - L.level) * 1.5);
      const low = L.ratio > 0 && L.ratio < .3 ? .78 + .22 * Math.sin(t * 17 + (side === 'ally' ? 0 : 2)) * Math.sin(t * 5.3) : 1;
      L.flame.target = L.ratio <= 0 ? 0 : (.5 + .5 * L.ratio) * low;
    }
  }

  const censer = new THREE.Group();
  censer.position.set(-3.6, 0, .02);
  const body = new THREE.Mesh(lathe([[0, .06], [.2, .06], [.33, .16], [.37, .3], [.3, .42], [.33, .46], [.36, .5], [.31, .5], [.27, .44], [0, .4]], 24), bronze());
  body.castShadow = true; censer.add(body);
  for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28, leg = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), bronze()); leg.position.set(Math.cos(a) * .22, .05, Math.sin(a) * .22); censer.add(leg); }
  body.receiveShadow = true;
  const ash = new THREE.Mesh(new THREE.CircleGeometry(.27, 20), new THREE.MeshStandardMaterial({ color: '#6a655d', roughness: 1 }));
  ash.rotation.x = -Math.PI / 2; ash.position.y = .43; censer.add(ash);
  const censerGlow = new THREE.Sprite(flameMat('#ff7a3a', true)); censerGlow.scale.setScalar(.6); censerGlow.position.y = .55; censerGlow.userData.noPick = true; censer.add(censerGlow);
  // 三支插香：燃着的红点 + 细长上升、卷曲散开的青烟
  const sticks = [];
  for (const [sx, sz, lean] of [[-.1, .02, .12], [.02, -.07, -.06], [.11, .05, .04]]) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.006, .007, .5, 5), new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: .9 }));
    stick.position.set(sx, .43 + .25, sz); stick.rotation.z = lean; censer.add(stick);
    const tipPos = new THREE.Vector3(sx - Math.sin(lean) * .25, .43 + .5, sz);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.014, 6, 5), new THREE.MeshBasicMaterial({ color: '#ff4a1a' }));
    tip.position.copy(tipPos); censer.add(tip); sticks.push({ tipPos, tip });
  }
  const wisps = [];
  for (let i = 0; i < 36; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: '#8e98a8', transparent: true, opacity: 0, depthWrite: false }));
    sp.userData = { noPick: true, age: Math.random() * 6, life: 5 + Math.random() * 2, stick: i % 3, ph: Math.random() * 6.28, drift: (Math.random() - .5) * .3 };
    censer.add(sp); wisps.push(sp);
  }
  function updateIncense(dt, t) {
    for (const sp of wisps) {
      const u = sp.userData; u.age += dt;
      if (u.age > u.life) { u.age = 0; u.life = 5 + Math.random() * 2; u.ph = Math.random() * 6.28; u.drift = (Math.random() - .5) * .3; }
      const k = u.age / u.life, tp = sticks[u.stick].tipPos, curl = Math.min(1, k * 2.2);
      sp.position.set(tp.x + Math.sin(u.age * 1.4 + u.ph) * .05 * curl + u.drift * k * k, tp.y + u.age * .26 * (1 - k * .3), tp.z + Math.cos(u.age * 1.1 + u.ph) * .05 * curl);
      sp.scale.setScalar(.06 + k * k * .5 + k * .08);
      sp.material.opacity = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (1 - k) * .42;
      sp.material.rotation = u.ph + u.age * .2;
    }
  }
  const sockets = [];
  const cupGeo = new THREE.CylinderGeometry(.07, .05, .05, 10);
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i + .5) / 10 * Math.PI * 2, cup = new THREE.Mesh(cupGeo, darkBronze());
    cup.position.set(Math.cos(a) * .68, .025, Math.sin(a) * .68);
    const f = makeFlame('#a8c0dc', .17, true, 'wisp'); f.group.position.y = .04; f.level = f.target = 0; cup.add(f.group);
    censer.add(cup); sockets.push({ cup, flame: f });
  }
  const qiLabel = makeLabel('', { scale: 1 }); qiLabel.position.set(1.0, .4, -.55); censer.add(qiLabel);
  group.add(censer);
  const qi = { value: -1, max: -1 };
  function setQi(value, max) {
    if (qi.value === value && qi.max === max) return;
    qi.value = value; qi.max = max;
    sockets.forEach((s, i) => { s.cup.visible = i < Math.min(10, Math.max(max, value)); s.flame.target = i < value ? 1 : 0; });
    // 不再显示「鬼气 7/10」文字：十只小灯盏亮着几只就是几点鬼气，悬停香炉可看数值
  }
  function qiAnchor(i = 0, target = new THREE.Vector3()) { return sockets[Math.max(0, Math.min(9, i))].cup.getWorldPosition(target).add(new THREE.Vector3(0, .15, 0)); }

  const bell = new THREE.Group();
  bell.position.set(3.62, 0, 1.62);
  const bellPivot = new THREE.Group(); bellPivot.position.y = .62; bell.add(bellPivot);
  const bellBody = new THREE.Mesh(lathe([[0, 0], [.07, 0], [.11, -.04], [.15, -.2], [.21, -.4], [.29, -.52], [.31, -.56]], 24), new THREE.MeshStandardMaterial({ color: '#9a7440', metalness: .92, roughness: .3, side: THREE.DoubleSide }));
  bellBody.castShadow = true;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .46, 10), lacquer()); handle.position.y = .22; handle.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), lacquer()); knob.position.y = .47;
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), darkBronze()); clapper.position.y = -.46;
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(.07, .5), new THREE.MeshStandardMaterial({ color: '#b3241a', side: THREE.DoubleSide, roughness: .8 }));
  ribbon.position.set(.06, .3, 0); ribbon.rotation.z = -.5;
  bellPivot.add(bellBody, handle, knob, clapper, ribbon);
  const bellHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: PALETTE.gold, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  bellHalo.scale.setScalar(1.8); bellHalo.position.y = .35; bellHalo.userData.noPick = true; bell.add(bellHalo);
  const bellLabel = makeLabel('摇铃 · 结束回合', { w: 384, scale: 1.5, size: 40 }); bellLabel.position.y = 1.12; bellLabel.material.opacity = 0; bell.add(bellLabel);
  group.add(bell);
  const bellState = { enabled: true, hover: false, ringing: false };
  const bellApi = {
    group: bell, state: bellState, label: bellLabel,
    setEnabled(v) { bellState.enabled = v; },
    setHover(v) { bellState.hover = v; },
    async ring() {
      if (bellState.ringing) return;
      bellState.ringing = true;
      await tween(bellPivot.position, { y: 1.05 }, { dur: 140, ease: 'outCubic' });
      const swing = { a: 0 };
      await tween(swing, { a: 1 }, { dur: 620, ease: 'linear', onUpdate: () => { const k = swing.a; bellPivot.rotation.z = Math.sin(k * Math.PI * 5) * .55 * (1 - k); clapper.position.x = -Math.sin(k * Math.PI * 5 + .8) * .1 * (1 - k); } });
      bellPivot.rotation.z = 0; clapper.position.x = 0;
      await tween(bellPivot.position, { y: .62 }, { dur: 200, ease: 'outBounce' });
      bellState.ringing = false;
    }
  };

  const deck = new THREE.Group();
  deck.position.set(3.5, 0, .1); deck.rotation.y = -.08;
  const deckBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1, 1.45), new THREE.MeshStandardMaterial({ color: '#b9ad8f', roughness: .85 }));
  deckBody.castShadow = true; deck.add(deckBody);
  const deckTop = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.45), new THREE.MeshStandardMaterial({ roughness: .8 }));
  deckTop.rotation.x = -Math.PI / 2; deck.add(deckTop);
  const deckLabel = makeLabel('', { scale: .8 }); deckLabel.position.set(0, .55, .55); deck.add(deckLabel);
  group.add(deck);
  const deckApi = {
    group: deck, count: -1, top: deckTop,
    setBack(tex) { deckTop.material.map = tex; deckTop.material.needsUpdate = true; },
    setCount(n) {
      if (n === deckApi.count) return;
      deckApi.count = n;
      const h = Math.max(.012, n * .016);
      deckBody.scale.y = h; deckBody.position.y = h / 2; deckTop.position.y = h + .001;
      deck.visible = n > 0 || true; deckBody.visible = deckTop.visible = n > 0;
      deckLabel.position.y = h + .42; deckLabel.set('');
    },
    topPosition(target = new THREE.Vector3()) { return target.set(3.5, deckBody.scale.y + .02, .1); }
  };

  const urn = new THREE.Group();
  urn.position.set(-3.85, 0, -1.42);
  const urnBody = new THREE.Mesh(lathe([[0, 0], [.24, 0], [.36, .14], [.41, .36], [.33, .56], [.2, .65], [.23, .71], [.26, .73], [.2, .7], [.16, .62]], 24), clay());
  urnBody.castShadow = true; urn.add(urnBody);
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(.2, .34), new THREE.MeshStandardMaterial({ color: '#a3170f', roughness: .9, side: THREE.DoubleSide }));
  seal.position.set(0, .34, .405); seal.rotation.x = -.06; urn.add(seal);
  const urnGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: PALETTE.spiritEdge, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  urnGlow.scale.setScalar(1.1); urnGlow.position.y = .8; urnGlow.userData.noPick = true; urn.add(urnGlow);
  const urnLabel = makeLabel('', { scale: .8 }); urnLabel.position.y = 1.15; urn.add(urnLabel);
  group.add(urn);
  const urnApi = { group: urn, count: -1, glow: urnGlow, setCount(n) { if (n === urnApi.count) return; urnApi.count = n; urnLabel.set(''); tween(urnGlow.material, { opacity: n ? .5 : 0 }, { dur: 600 }); }, mouth(target = new THREE.Vector3()) { return target.set(-3.85, .8, -1.42); } };

  function plaque(char, color) {
    const [c, g] = makeCanvas(128, 200);
    g.fillStyle = '#1b1210'; g.fillRect(0, 0, 128, 200);
    g.strokeStyle = color; g.lineWidth = 5; g.strokeRect(10, 10, 108, 180);
    g.fillStyle = color; g.font = `bold 96px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(char, 64, 104);
    return canvasTexture(c);
  }
  const artifacts = [];
  {
    const g = new THREE.Group(); g.position.set(2.95, 0, -1.6);
    const bowl = new THREE.Mesh(lathe([[0, 0], [.13, 0], [.15, .03], [.27, .15], [.3, .18], [.27, .18], [.13, .05], [0, .04]], 22), clay()); bowl.castShadow = true;
    const blood = new THREE.Mesh(new THREE.CircleGeometry(.245, 22), new THREE.MeshStandardMaterial({ color: '#5a0808', emissive: '#c2140c', emissiveIntensity: .9, roughness: .15 }));
    blood.rotation.x = -Math.PI / 2; blood.position.y = .15;
    g.add(bowl, blood); group.add(g);
    artifacts.push({ group: g, index: 0, name: '血祭增幅', color: '#ff3b30', used: false, setUsed(v) { this.used = v; tween(blood.position, { y: v ? .06 : .15 }, { dur: 700 }); tween(blood.material, { emissiveIntensity: v ? .05 : .9 }, { dur: 700 }); } });
  }
  {
    const g = new THREE.Group(); g.position.set(3.6, 0, -1.68);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.46, .08, .22), lacquer()); base.position.y = .04;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(.34, .6, .07), lacquer()); slab.position.y = .38; slab.castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.3, .5), new THREE.MeshStandardMaterial({ map: plaque('英', '#d9c38a'), roughness: .6, emissive: '#6b5a30', emissiveIntensity: .5 }));
    face.position.set(0, .38, .037);
    const pivot = new THREE.Group(); pivot.add(slab, face); pivot.children.forEach(c => { c.position.y -= .08; }); pivot.position.y = .08;
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8, 0, 6.28, 0, 1.4), darkBronze()); pauldron.position.set(.3, .0, .12); pauldron.rotation.z = -.3;
    g.add(base, pivot, pauldron); group.add(g);
    artifacts.push({ group: g, index: 1, name: '英灵融合', color: '#ffe6a8', used: false, setUsed(v) { this.used = v; tween(pivot.rotation, { x: v ? -1.35 : 0 }, { dur: 600, ease: 'outBounce' }); tween(face.material, { emissiveIntensity: v ? 0 : .5 }, { dur: 400 }); } });
  }
  {
    const g = new THREE.Group(); g.position.set(4.2, 0, -1.6);
    const lamp = new THREE.Mesh(lathe([[0, 0], [.15, 0], [.16, .03], [.05, .07], [.04, .4], [.14, .47], [.15, .52], [.12, .52], [0, .46]], 18), new THREE.MeshStandardMaterial({ color: '#b08a3c', metalness: .95, roughness: .28 }));
    lamp.castShadow = true;
    const f = makeFlame('#ffe08a', .34, true); f.group.position.y = .5;
    g.add(lamp, f.group); group.add(g);
    artifacts.push({ group: g, index: 2, name: '神火', color: '#ffd98a', used: false, flame: f, setUsed(v) { this.used = v; f.target = v ? 0 : 1; } });
  }
  for (const a of artifacts) { a.label = makeLabel(a.name, { scale: .9, size: 44 }); a.label.position.y = .98; a.label.material.opacity = 0; a.group.add(a.label); a.hover = 0; a.hoverTarget = 0; }

  const world = new THREE.Vector3();
  function update(dt, t) {
    for (const f of flames) {
      f.level = damp(f.level, f.target, 7, dt);
      if (f.level < .02) { f.group.visible = false; continue; }
      f.group.visible = true;
      const n = Math.sin(t * 13 + f.seed) * .5 + Math.sin(t * 29 + f.seed * 1.7) * .3 + Math.sin(t * 7.1 + f.seed * .3) * .2;
      f.s.scale.set(f.size * .8 * f.level * (1 - n * .05), f.size * 1.05 * f.level * (1 + n * .1), 1);
      f.fl.set({ lean: n * .2, intensity: .9 + n * .1 });
      if (f.glow) f.glow.scale.setScalar(f.size * 1.5 * f.level * (1 + n * .08));
    }
    updateLife(dt, t); updateIncense(dt, t);
    bellHalo.material.opacity = damp(bellHalo.material.opacity, bellState.enabled ? (bellState.hover ? .55 : .2 + .1 * Math.sin(t * 2.4)) : 0, 6, dt);
    bellLabel.material.opacity = damp(bellLabel.material.opacity, bellState.hover && bellState.enabled ? 1 : 0, 10, dt);
    if (!bellState.ringing) bellPivot.rotation.z = Math.sin(t * 1.3) * .012;
    for (const a of artifacts) {
      a.hover = damp(a.hover, a.hoverTarget, 10, dt);
      a.label.material.opacity = a.hover;
      a.group.position.y = a.hover * .06;
    }
    censerGlow.material.opacity = .5 + .12 * Math.sin(t * 1.7);
  }
  return { group, flames, makeFlame, puff, setLife, lifeAnchor, life, setQi, qiAnchor, qi, censer, bell: bellApi, deck: deckApi, urn: urnApi, artifacts, update, world };
}
