// 对手：从桌沿后方升起、俯身压向牌桌的兜帽黑雾人影。
// 三层视差烟层(fx/smoke) + 飘散烟团 + 一双火焰之眼(fx/flame)。
import * as THREE from 'three';
import { makeCanvas, canvasTexture, noiseTexture } from './textures.js';
import { tween, damp, mulberry, wait } from '../core/tween.js';
import { quality, onQuality } from '../core/quality.js';
import { createEyePair } from '../fx/flame.js';
import { createSmokeMesh } from '../fx/smoke.js';
import { pointer } from '../core/input.js';

export const EYE_COLORS = ['#b3120c', '#c8641a', '#1f8a5b', '#1c6fa8', '#6a2fa0', '#b08a1e', '#a31455', '#8fa3ad'];
export function eyeColorFor(nodeId, boss) {
  const h = [...(nodeId || 'idle')].reduce((v, c) => (v * 31 + c.charCodeAt(0)) >>> 0, 11);
  return { color: EYE_COLORS[h % EYE_COLORS.length], boost: boss ? 1.25 : 1 };
}

let puffTex = null;
export function puffTexture() {
  if (puffTex) return puffTex;
  const [c, g] = makeCanvas(256), rnd = mulberry(555);
  for (let i = 0; i < 26; i++) {
    const x = 128 + (rnd() - .5) * 120, y = 128 + (rnd() - .5) * 120, r = 30 + rnd() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.3)'); gr.addColorStop(.55, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    const a = rnd() * 6.28, d = 55 + rnd() * 75, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
    g.globalAlpha = rnd() * .5; g.beginPath(); g.arc(x, y, 1 + rnd() * 9, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  m.addColorStop(0, 'rgba(255,255,255,1)'); m.addColorStop(.7, 'rgba(255,255,255,1)'); m.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = m; g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'source-over';
  return puffTex = canvasTexture(c);
}
export function mistTexture() { return puffTexture(); }

export function createOpponent(scene) {
  const group = new THREE.Group();
  group.position.set(0, 0, -3.5);
  scene.add(group);
  const body = new THREE.Group(), head = new THREE.Object3D();
  head.position.set(0, 1.5, .2);
  group.add(body, head);

  // 剪影背后极淡的冷色背雾，把黑影从背景里抠出来（不落在身上）
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.5, .3), new THREE.MeshBasicMaterial());
  proxy.position.set(0, 1.05, 0); proxy.visible = false; proxy.userData.dofProxy = true; proxy.userData.noPick = true; body.add(proxy);
  const back = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: '#505866', transparent: true, opacity: .7, depthWrite: false }));
  back.position.set(0, 1.55, -.75); back.scale.set(8.6, 5.4, 1);
  back.userData.noPick = true; back.renderOrder = 1; body.add(back);

  // 三层视差烟层：同一实心剪影、不同噪声种子 → 边缘蠕动冒烟的纯黑人形
  const layers = [];
  const layerDef = [
    { z: .18, w: 4.9, h: 3.3, y: -1.56, seed: 11, ro: 3 },
    { z: -.08, w: 4.6, h: 3.15, y: -1.38, seed: 47, ro: 3 },
    { z: -.34, w: 4.3, h: 3.0, y: -1.2, seed: 83, ro: 2 }
  ];
  for (const d of layerDef) {
    const L = createSmokeMesh({ w: d.w, h: d.h, shape: 0, seed: d.seed, renderOrder: d.ro, solid: 1 });
    L.mesh.position.set(0, d.y, d.z); body.add(L.mesh); layers.push(L);
  }
  const U = i => layers[i].uniforms;

  // 桌面蔓延薄雾：贴着桌面向玩家方向缓慢爬行
  const rnd = mulberry(77), creepers = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: '#0a0a10', transparent: true, opacity: 0, depthWrite: false }));
    s.position.set(-2.6 + i * .55, .02 + rnd() * .1, 1.2 + rnd() * .6);
    s.scale.set(1.7 + rnd() * .9, .5, 1);
    s.userData = { x: s.position.x, z: s.position.z, sp: .04 + rnd() * .07, seed: rnd() * 9, o: .12 + rnd() * .12, noPick: true };
    s.renderOrder = 4; body.add(s); creepers.push(s);
  }

  // 飘散烟团：肩部/兜帽顶剥离、上飘、侧移、消散
  const puffs = [];
  function newPuff() {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: '#060609', transparent: true, opacity: 0, depthWrite: false }));
    s.userData = { noPick: true, life: 9, max: 1, vx: 0, vy: .4, vz: 0, grow: .3, o0: .5, spin: 0 };
    s.renderOrder = 5; body.add(s); puffs.push(s); return s;
  }
  for (let i = 0; i < 60; i++) newPuff();
  function spawnPuff(x, y, z, o = {}) {
    const s = puffs.find(p => p.userData.life >= p.userData.max);
    if (!s) return;
    const u = s.userData;
    u.life = 0; u.max = o.life || 3 + rnd() * 2;
    u.vx = o.vx ?? (rnd() - .5) * .3; u.vy = o.vy ?? .3 + rnd() * .35; u.vz = o.vz ?? (rnd() - .5) * .15;
    u.grow = o.grow ?? .4 + rnd() * .35; u.o0 = o.op ?? .5; u.spin = (rnd() - .5) * .4;
    s.position.set(x, y, z); s.scale.setScalar(o.size || .3 + rnd() * .25); s.material.rotation = rnd() * 6.28;
  }
  function tearPuffs(n, dir = 0, spreadY = 1.7) {
    for (let i = 0; i < n; i++) spawnPuff((rnd() - .5) * 1.8, .5 + rnd() * spreadY, .2, {
      vx: dir + (rnd() - .5) * 1.6, vy: .5 + rnd() * .9, vz: .3 + rnd() * .7, life: 1.5 + rnd(), op: .7, size: .4 + rnd() * .4
    });
  }
  function tendril(lane) {
    const lx = -1.95 + lane * 1.3 - group.position.x, lz = -1.05 - group.position.z;
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      wait(i * 55).then(() => spawnPuff(lx * f + (rnd() - .5) * .15, 1.3 - f * .9, .3 + lz * f, { life: 1.2, vy: .1, op: .55, size: .3 }));
      // 收回：末段反向小团
      if (i > 5) wait(i * 55 + 260).then(() => spawnPuff(lx * f, .35, .3 + lz * f, { life: .9, vy: .5, vz: -.5, op: .4, size: .25 }));
    }
  }

  // 一双火焰之眼
  const eyes = createEyePair({ color: '#c8641a', size: .66, gap: 1.9, slant: .16 });
  eyes.group.position.copy(head.position);
  body.add(eyes.group);
  eyes.setIntensity(.3); eyes.setLid(.55);
  const eyeBaseX = eyes.meshes.map(e => e.position.x);

  const st = {
    tx: 0, ty: 0, lookTtl: 0, eyes: .1, teyes: .1, lean: 0, recoil: 0,
    emitMul: 1, dying: 0, boost: 1, hold: false, eyeHold: false,
    moodE: 0, moodA: 0, loom: 0
  };
  const tmp = new THREE.Vector3();

  function lookAt(point) {
    tmp.copy(point).sub(group.position);
    st.tx = THREE.MathUtils.clamp(tmp.x * .09, -.6, .6);
    st.ty = THREE.MathUtils.clamp((tmp.y - 1.5) * .12, -.35, .25);
    st.lookTtl = 2.5;
  }
  function setEyes(v) { st.teyes = Math.max(.06, v); }
  function setEyeColor(hex, boost = 1) { eyes.setColor(hex); st.boost = boost; }
  function setMood({ enemyLife = 1, allyLife = 1 } = {}) {
    st.moodE = enemyLife < .3 ? 1 - enemyLife / .3 : 0;
    st.moodA = allyLife < .3 ? 1 - allyLife / .3 : 0;
  }

  function resetTransients() {
    st.eyeHold = false; eyes.freezeBlink(false);
    eyes.setSmile(0); eyes.setWide(0);
    for (const m of eyes.mats) m.uniforms.uGust.value = 0;
    for (const L of layers) { L.uniforms.uShear.value = 0; L.uniforms.uSurge.value = 0; L.uniforms.uImplode.value = 0; }
    st.recoil = 0;
  }

  const seq = { id: 0 };
  let terminal = null, lastBlock = 0;
  async function play(name, opts = {}) {
    if (terminal) return;
    const my = ++seq.id, alive = () => seq.id === my;
    resetTransients();
    const T = (u, to, o) => { const p = tween(u, to, o); return p; };
    if (name === 'enter') {
      for (const L of layers) L.uniforms.uDensity.value = 0;
      eyes.freezeBlink(true); eyes.setLid(1); eyes.setIntensity(0);
      group.visible = true; st.eyeHold = true;
      await Promise.all(layers.map(L => T(L.uniforms.uDensity, { value: 1 }, { dur: 1400, ease: 'outCubic' })));
      if (!alive()) return;
      for (const m of eyes.mats) tween(m.uniforms.uLid, { value: .3 }, { dur: 700, ease: 'inOutQuad' });
      await wait(700); if (!alive()) return;
      st.eyeHold = false; eyes.freezeBlink(false); eyes.setLid(.2);
      return;
    }
    if (name === 'hit') {
      const amt = opts.amount || 1;
      for (const L of layers) T(L.uniforms.uShear, { value: .8 * amt }, { dur: 140, ease: 'outQuad' }).then(() => T(L.uniforms.uShear, { value: 0 }, { dur: 700, ease: 'outCubic' }));
      st.recoil = amt; tween(st, { recoil: 0 }, { dur: 800, ease: 'outElastic' });
      tearPuffs(4 + Math.round(amt * 5), -.6);
      eyes.freezeBlink(true); eyes.setLid(.9);
      await wait(140); if (!alive()) return;
      eyes.setLid(.2); eyes.freezeBlink(false);
      return;
    }
    if (name === 'unitDeath') {
      const lx = THREE.MathUtils.clamp(((opts.lane ?? 1.5) - 1.5) * .5, -.5, .5);
      eyes.look(lx, -.1); eyes.freezeBlink(true); st.eyeHold = true; st.lookTtl = 3;
      eyes.setLid(.55); eyes.setIntensity(1.2 * st.boost);
      tendril(opts.lane ?? 1.5);
      await wait(500); if (!alive()) return;
      eyes.setLid(.2); st.eyeHold = false; eyes.freezeBlink(false);
      return;
    }
    if (name === 'allyDeath') {
      eyes.freezeBlink(true); eyes.setSmile(.9);
      for (const L of layers) T(L.uniforms.uSwell, { value: .14 }, { dur: 900, ease: 'outCubic' }).then(() => T(L.uniforms.uSwell, { value: 0 }, { dur: 900 }));
      await wait(950); if (!alive()) return;
      eyes.setSmile(0); eyes.freezeBlink(false);
      return;
    }
    if (name === 'cast') {
      st.eyeHold = true;
      for (const L of layers) {
        T(L.uniforms.uSurge, { value: 1 }, { dur: 300, ease: 'outCubic' }).then(() => T(L.uniforms.uSurge, { value: 0 }, { dur: 500 }));
        T(L.uniforms.uTurb, { value: .8 }, { dur: 300 }).then(() => alive() && T(L.uniforms.uTurb, { value: .35 }, { dur: 500 }));
      }
      eyes.setIntensity(1.3 * st.boost);
      for (let i = 0; i < 10; i++) spawnPuff((rnd() - .5) * 1.4, .3 + rnd(), .4, { vz: .8 + rnd() * .8, vy: .15, life: 1.4, op: .5 });
      await wait(500); if (!alive()) return;
      st.eyeHold = false;
      return;
    }
    if (name === 'wardBreak') {
      eyes.freezeBlink(true); eyes.setWide(1); eyes.setIntensity(1.4 * st.boost); st.eyeHold = true;
      for (const L of layers) {
        T(L.uniforms.uShear, { value: (Math.random() > .5 ? 1 : -1) * .9 }, { dur: 220, ease: 'outQuad' }).then(() => T(L.uniforms.uShear, { value: 0 }, { dur: 800, ease: 'inOutCubic' }));
      }
      tearPuffs(8, 0, 2.2);
      await wait(300); if (!alive()) return;
      eyes.setLid(.2); eyes.setWide(0); st.eyeHold = false; eyes.freezeBlink(false);
      return;
    }
    if (name === 'wardBlock') {
      const now = performance.now();
      if (now - lastBlock < 600) return;
      lastBlock = now;
      eyes.setLid(.55); eyes.freezeBlink(true);
      for (const L of layers) T(L.uniforms.uSurge, { value: .6 }, { dur: 220, ease: 'outCubic' }).then(() => T(L.uniforms.uSurge, { value: 0 }, { dur: 500 }));
      spawnPuff((rnd() - .5) * .8, .9 + rnd() * .5, .5, { vz: .9, vy: .1, life: 1.1, op: .5, size: .5 });
      await wait(320); if (!alive()) return;
      eyes.setLid(.2); eyes.freezeBlink(false);
      return;
    }
    if (name === 'wary') {
      if (opts.tier === 'strong') {
        st.recoil = .9; tween(st, { recoil: 0 }, { dur: 900, ease: 'outElastic' });
        for (const L of layers) T(L.uniforms.uShear, { value: -1 }, { dur: 200, ease: 'outQuad' }).then(() => T(L.uniforms.uShear, { value: 0 }, { dur: 800 }));
        tearPuffs(10, -.8, 2.2);
        eyes.setWide(.6); wait(400).then(() => alive() && eyes.setWide(0));
      } else {
        eyes.freezeBlink(true); eyes.setLid(.4);
        await wait(260); if (!alive()) return;
        eyes.setLid(.2); eyes.freezeBlink(false);
      }
      return;
    }
    if (name === 'turn') {
      st.eyeHold = true; eyes.setIntensity(1.1 * st.boost);
      st.lean = 1; await wait(600); if (!alive()) return;
      st.eyeHold = false;
      return;
    }
    if (name === 'win') {
      terminal = 'win';
      eyes.freezeBlink(true); st.dying = 1; st.eyeHold = true;
      eyes.setWide(1); eyes.setIntensity(1.5 * st.boost);
      await wait(400); if (!alive()) return;
      for (const m of eyes.mats) m.uniforms.uGust.value = 1;
      for (const L of layers) T(L.uniforms.uTurb, { value: 1.4 }, { dur: 500 });
      await wait(500); if (!alive()) return;
      for (const L of layers) {
        T(L.uniforms.uImplode, { value: 1 }, { dur: 420, ease: 'inCubic' });
        T(L.uniforms.uBlow, { value: 1.2 }, { dur: 1100, ease: 'inQuad', delay: 250 });
      }
      await tween(layers[0].uniforms.uDensity, { value: 0 }, { dur: 700, ease: 'inQuad' });
      st.emitMul = 0; tearPuffs(60, 0, 2.4);
      for (const m of eyes.mats) { m.uniforms.uGust.value = 0; tween(m.uniforms.uIntensity, { value: 0 }, { dur: 500, ease: 'inQuad' }); }
      eyes.meshes.forEach((e, i) => { tween(e.position, { x: e.position.x + (i ? .4 : -.4), y: e.position.y - .25 }, { dur: 600 }); });
      await wait(650);
      if (alive()) group.visible = false;
      return;
    }
    if (name === 'lose') {
      terminal = 'lose';
      st.eyeHold = true; st.hold = true;
      eyes.setIntensity(1.5 * st.boost); eyes.freezeBlink(true);
      for (const L of layers) { T(L.uniforms.uSwell, { value: .5 }, { dur: 900, ease: 'outCubic' }); T(L.uniforms.uSurge, { value: 1.2 }, { dur: 900 }); }
      tween(group.position, { z: -3.0, y: .3 }, { dur: 900, ease: 'outCubic' });
      for (let i = 0; i < 26; i++) wait(i * 60).then(() => spawnPuff((rnd() - .5) * 2.6, .1 + rnd() * .3, .9, { vz: 1 + rnd(), vy: .1, life: 2, op: .45, size: .6 }));
      await wait(750); if (!alive()) return;
      eyes.setLid(.5); eyes.setSmile(1);
      return;
    }
  }
  function reset() {
    seq.id++; terminal = null; st.hold = false; st.dying = 0; st.emitMul = 1;
    group.visible = true; group.position.set(0, 0, -3.5); group.rotation.set(0, 0, 0);
    L_uniformReset();
    resetTransients();
    eyes.setLid(.5); eyes.setIntensity(.3);
    eyes.meshes.forEach((e, i) => e.position.set(eyeBaseX[i], 0, 0));
    eyes.look(0, 0);
    st.lean = 0; st.teyes = .1; st.moodE = 0; st.moodA = 0;
    for (const s of puffs) { s.userData.life = 9; s.userData.max = 1; s.material.opacity = 0; }
  }
  function L_uniformReset() {
    for (const L of layers) {
      L.uniforms.uDensity.value = 1; L.uniforms.uSwell.value = 0; L.uniforms.uShear.value = 0;
      L.uniforms.uSurge.value = 0; L.uniforms.uImplode.value = 0; L.uniforms.uTurb.value = .35;
      L.uniforms.uMood.value = 0; L.uniforms.uBlow.value = 0;
    }
  }

  let emitT = 0;
  const camDir = new THREE.Vector3();
  function update(dt, t, camera) {
    if (camera) { camera.getWorldDirection(camDir); const pitch = Math.asin(-camDir.y) * 57.2958; eyes.group.position.y = head.position.y + Math.min(1.3, Math.max(0, (36 - pitch) / 30)) * .5; }
    for (const L of layers) L.uniforms.uTime.value = t;
    if (!group.visible) return;
    st.eyes = damp(st.eyes, st.teyes, 4, dt);
    if (!st.dying && !st.eyeHold) {
      eyes.setIntensity((.28 + st.eyes * .85) * st.boost);
      if (!eyes.frozen && !eyes.blinking) eyes.setLid(.22 - st.eyes * .15);
    }
    // 待机眼神缓慢跟随指针；lookAt 目标优先 2.5s
    st.lookTtl -= dt;
    if (!st.eyeHold && st.lookTtl <= 0) { st.tx = pointer.nx * .7; st.ty = pointer.ny * .45; }
    eyes.look(st.tx, st.ty);
    // 心情：敌命危→更紊乱、眼闪；我命危→更靠前更高大
    st.loom = damp(st.loom, st.moodA, 2, dt);
    for (const L of layers) {
      L.uniforms.uMood.value = st.moodE;
      L.uniforms.uSwell.value = Math.max(L.uniforms.uSwell.value, st.loom * .18);
    }
    if (st.moodE > .3) for (const m of eyes.mats) m.uniforms.uGust.value = st.moodE * .5;
    else if (!st.dying && !st.eyeHold) for (const m of eyes.mats) m.uniforms.uGust.value = 0;
    body.position.z = st.lean * .3 - st.recoil * .4 + st.loom * .2;
    body.position.y = Math.sin(t * .55) * .04 + st.loom * .15;
    // 持续剥离烟丝
    emitT -= dt;
    if (emitT <= 0 && layers[0].uniforms.uDensity.value > .3 && st.emitMul > 0) {
      emitT = .16 / st.emitMul;
      const side = rnd() > .5 ? 1 : -1;
      const topZone = rnd() > .6;
      spawnPuff(
        (rnd() - .5) * (topZone ? .5 : 1.7),
        topZone ? 1.6 + rnd() * .5 : .4 + rnd() * 1.0,
        .15,
        { vx: side * (.12 + rnd() * .22) + layers[0].uniforms.uShear.value * .4, vy: .3 + rnd() * .3, op: .45 }
      );
      if (layers[0].uniforms.uSurge.value > .1) spawnPuff((rnd() - .5) * 2, .15 + rnd() * .4, .6, { vz: .6 + layers[0].uniforms.uSurge.value * rnd(), vy: .12, op: .4 });
    }
    for (const s of puffs) {
      const u = s.userData;
      if (u.life > u.max) continue;
      u.life += dt;
      if (u.life <= 0 || u.life > u.max) { s.material.opacity = 0; continue; }
      const f = u.life / u.max;
      s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
      s.scale.addScalar(u.grow * dt);
      s.material.rotation += u.spin * dt;
      s.material.opacity = u.o0 * Math.sin(Math.min(1, f) * Math.PI) * Math.min(1, layers[0].uniforms.uDensity.value + .2);
    }
    for (const c of creepers) {
      c.position.x = c.userData.x + Math.sin(t * c.userData.sp + c.userData.seed) * .5;
      c.position.z = c.userData.z + Math.cos(t * c.userData.sp * .7 + c.userData.seed) * .3 + st.loom * .3;
      c.material.opacity = c.userData.o * (1 + Math.sin(t * .3 + c.userData.seed) * .3);
    }
  }

  const applyQuality = () => { const n = Math.round(quality().mist * 2.6); puffs.forEach((p, i) => { p.visible = i < n; }); creepers.forEach((c, i) => c.visible = i < quality().fog * 3 + 1); };
  applyQuality(); onQuality(applyQuality);

  return {
    group, head, neck: head, lookAt, setEyes, setEyeColor, setMood,
    recoil: a => play('hit', { amount: a }), lean(a, d = 380) { return tween(st, { lean: a }, { dur: d, ease: 'outCubic' }); },
    gesture() { for (const L of layers) tween(L.uniforms.uSwell, { value: .18 }, { dur: 300 }).then(() => tween(L.uniforms.uSwell, { value: 0 }, { dur: 420 })); },
    play, reset, update, headWorld: (v = new THREE.Vector3()) => head.getWorldPosition(v), eyes, layers
  };
}
