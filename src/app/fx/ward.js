// 鬼障可视化：敌方一排前方的低矮黑烟帘（浓度 = 1 - factor）+ HUD 状态签 + 涟漪/撕裂/重拢。
import * as THREE from 'three';
import { createSmokeMesh } from './smoke.js';
import { glowTexture } from '../scene/textures.js';
import { tween, damp, mulberry } from '../core/tween.js';

const TIP = '本回合主动施放鬼灵技能、打出技能卡或使用御鬼者技能可破除一层；每回合开始重新合拢。';
const ANCHOR = new THREE.Vector3(2.62, .78, -2.4); // 敌命标签上方

function wardText(info) {
  if (!info) return '';
  const { layers, casts, factor } = info;
  if (factor >= 0.999) return '鬼障已破';
  const pct = Math.round(factor * 100);
  const eff = factor <= 0.001 ? '普攻无效' : `普攻 ${pct}%`;
  return layers > 1 ? `鬼障 ${casts}/${layers} · ${eff}` : `鬼障 · ${eff}`;
}

export function createWard(ctx) {
  const { scene } = ctx;
  const group = new THREE.Group();
  group.position.set(0, -.04, -.32);
  group.visible = false;
  scene.add(group);

  const rnd = mulberry(13);
  const layers = [];
  for (const [z, seed] of [[-.03, 5], [.03, 31], [0, 67]]) {
    const L = createSmokeMesh({ w: 6.2, h: .8, shape: 2, seed, renderOrder: 4, solid: 1, aspect: .8 / 6.2 });
    L.mesh.position.set(0, 0, z); group.add(L.mesh); layers.push(L);
  }

  // 贴桌余烬线（朱砂暗红）
  const ember = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#8a1a10', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  ember.scale.set(6.4, .16, 1); ember.position.set(0, .05, .12); ember.userData.noPick = true; ember.renderOrder = 5; group.add(ember);

  // 涟漪精灵池
  const ripples = [];
  function ripple(x) {
    let s = ripples.find(r => !r.visible);
    if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#050507', transparent: true, opacity: 0, depthWrite: false })); s.userData.noPick = true; s.renderOrder = 6; group.add(s); ripples.push(s); }
    s.visible = true; s.position.set(x, .5, .15); s.scale.set(.3, .2, 1);
    s.material.opacity = .7;
    tween(s.scale, { x: 1.3, y: .75 }, { dur: 500, ease: 'outCubic' });
    tween(s.material, { opacity: 0 }, { dur: 500 }).then(() => s.visible = false);
    for (let i = 0; i < 3; i++) creep(x + (rnd() - .5) * .4, .5 + rnd() * .2, .2);
  }
  // 残烟小团（重拢时从黑影流下/涟漪时溅起）
  const wisps = [];
  function creep(x, y, z, from) {
    let s = wisps.find(w => !w.visible);
    if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#050507', transparent: true, opacity: 0, depthWrite: false })); s.userData.noPick = true; s.renderOrder = 6; group.add(s); wisps.push(s); }
    s.visible = true; s.position.set(x, y, z); s.scale.setScalar(.3 + rnd() * .25);
    s.material.opacity = .55;
    const tx = from ? x + (rnd() - .5) * .8 : x, ty = from ? .3 : y + .5 + rnd() * .4;
    tween(s.position, { x: tx, y: ty }, { dur: 700, ease: 'outCubic' });
    tween(s.material, { opacity: 0 }, { dur: 700 }).then(() => s.visible = false);
  }

  // HUD 标识
  let badge = null, badgeText = '', badgePos = '';
  function ensureBadge() {
    if (badge) return;
    badge = document.createElement('div');
    badge.className = 'ward-badge';
    badge.title = TIP;
    document.getElementById('ui')?.appendChild(badge) || document.body.appendChild(badge);
    const st = badge.style;
    st.position = 'fixed'; st.zIndex = '40'; st.pointerEvents = 'auto';
    st.font = '600 13px "STKaiti","KaiTi",serif'; st.padding = '3px 10px'; st.borderRadius = '3px';
    st.background = 'rgba(10,9,16,.72)'; st.color = '#e9e2d0'; st.borderLeft = '2px solid #c2261d';
    st.letterSpacing = '.06em'; st.whiteSpace = 'nowrap'; st.transform = 'translate(-50%,-50%)';
  }

  const st = { info: null, density: 0 };
  const proj = new THREE.Vector3();

  function setInfo(info) {
    const wasOpen = st.info && (st.info.factor >= 0.999 || st.info.casts > 0);
    st.info = info;
    group.visible = !!info;
    if (badge) badge.style.display = info ? 'block' : 'none';
    // 回合开始重新合拢：从已破回到未破 → 烟丝流回
    if (info && wasOpen && info.casts === 0 && info.factor < 0.999) reform();
  }
  function tear() {
    for (const L of layers) {
      tween(L.uniforms.uBlow, { value: .55 }, { dur: 180, ease: 'outQuad' })
        .then(() => tween(L.uniforms.uBlow, { value: 0 }, { dur: 800, ease: 'outCubic' }));
      tween(L.uniforms.uShear, { value: (rnd() > .5 ? 1 : -1) * .5 }, { dur: 180 }).then(() => tween(L.uniforms.uShear, { value: 0 }, { dur: 700 }));
    }
    ripple(0);
  }
  function reform() {
    // 从黑影头部流回烟丝重新合拢
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#050507', transparent: true, opacity: .6, depthWrite: false }));
      s.userData.noPick = true; s.renderOrder = 6; scene.add(s);
      s.position.set((rnd() - .5) * 1.6, 1.3 + rnd() * .5, -3.4);
      s.scale.setScalar(.35 + rnd() * .3);
      const tx = -2.4 + i * .6 + rnd() * .3;
      tween(s.position, { x: tx, y: .4, z: -.3 }, { dur: 650 + i * 40, ease: 'inOutQuad' })
        .then(() => { tween(s.material, { opacity: 0 }, { dur: 250 }).then(() => s.removeFromParent()); });
    }
    for (const L of layers) tween(L.uniforms.uBlow, { value: 0 }, { dur: 600 });
  }

  function update(dt, t, camera) {
    if (!group.visible) { if (badge) badge.style.display = 'none'; return; }
    const info = st.info, base = info?.base ?? 0, wall = base < .2;
    const k = info ? Math.max(0, Math.min(1, (1 - info.factor) / Math.max(.01, 1 - base))) : 0;
    const hTarget = .05 + ((wall ? .62 : .28) - .05) * k, dTarget = (wall ? .98 : .42) * (.15 + .85 * k);
    st.height = damp(st.height ?? hTarget, hTarget, 4, dt);
    st.density = damp(st.density, dTarget, 3, dt);
    st.ember = damp(st.ember ?? 0, info ? .1 + .3 * k : 0, k > .5 ? 4 : 1.2, dt);
    ember.material.opacity = st.ember * (.85 + .15 * Math.sin(t * 2.3));
    for (const [i, L] of layers.entries()) {
      L.uniforms.uTime.value = t;
      L.uniforms.uDensity.value = st.density;
      L.uniforms.uTop.value = st.height / .8 * (1 - i * .08);
    }
    // HUD 标识：跟随敌命标签投影位置，内容变化才写 DOM
    ensureBadge();
    const txt = wardText(st.info);
    if (txt !== badgeText) { badgeText = txt; badge.textContent = txt; }
    proj.copy(ANCHOR).project(camera);
    const x = Math.round((proj.x * .5 + .5) * innerWidth), y = Math.round((-proj.y * .5 + .5) * innerHeight);
    const pos = x + ',' + y;
    if (pos !== badgePos) { badgePos = pos; badge.style.left = x + 'px'; badge.style.top = y + 'px'; }
    if (badge.style.display === 'none') badge.style.display = 'block';
  }
  return { group, setInfo, ripple, tear, reform, update, get info() { return st.info; } };
}
