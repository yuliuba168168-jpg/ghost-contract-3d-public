// 剧情实景呈现：碎纸血字 / 香灰显字 / 烛影纸屏。文字在 3D 实物上逐字显现，按钮仍是 DOM（.story-bar）。
import * as THREE from 'three';
import { makeCanvas, canvasTexture, paperBump, glowTexture, smokeTexture, noiseTexture, FONT } from '../scene/textures.js';
import { viewImage, hasViews } from '../core/assets.js';
import { tween, damp, kill, mulberry } from '../core/tween.js';
import { play, unlockAudio } from '../core/audio.js';
import { focusState } from '../core/renderer.js';

const PUNCT = '，。、；：！？）》」』”’…—';
const TEXT_W = 1024;

// ───────── 排版：自动分页 + 文字图 + 时间图 ─────────
function wrap(text, cpl) {
  const lines = [];
  for (const para of String(text || '').split('\n')) {
    const p = para.replace(/\s+$/g, '');
    if (!p) { lines.push(''); continue; }
    let i = 0;
    while (i < p.length) {
      let n = Math.min(cpl, p.length - i);
      if (i + n < p.length && PUNCT.includes(p[i + n])) n++;
      lines.push(p.slice(i, i + n)); i += n;
    }
  }
  return lines;
}
function paginate(pages, cpl, maxLines) {
  const out = [];
  for (const pg of pages) {
    const lines = wrap(pg, cpl);
    for (let i = 0; i < lines.length; i += maxLines) out.push(lines.slice(i, i + maxLines));
  }
  return out.length ? out : [['']];
}
function renderPage(lines, { W = TEXT_W, H, fs, lh, cpl, x0 = 0, y0 = 0, color = '#fff' }) {
  const [tc, tg] = makeCanvas(W, H), [mc, mg] = makeCanvas(W, H);
  mg.fillStyle = '#000'; mg.fillRect(0, 0, W, H);
  tg.font = `${fs}px ${FONT}`; tg.textBaseline = 'middle'; tg.textAlign = 'center'; tg.fillStyle = color;
  const adv = Math.floor((W - x0 * 2) / cpl), total = lines.reduce((a, l) => a + [...l].length, 0) || 1;
  let k = 0;
  lines.forEach((ln, r) => {
    [...ln].forEach((ch, c) => {
      k++;
      const x = x0 + c * adv + adv / 2, y = y0 + r * lh + lh / 2;
      tg.fillText(ch, x, y);
      const v = Math.round(10 + (k / total) * 235);
      mg.fillStyle = `rgb(${v},${v},${v})`; mg.fillRect(x - adv / 2 - 1, y - lh / 2, adv + 2, lh);
    });
  });
  const tt = canvasTexture(tc, { srgb: false, aniso: 4 }), mt = canvasTexture(mc, { srgb: false, aniso: 1 });
  mt.minFilter = mt.magFilter = THREE.NearestFilter; mt.generateMipmaps = false; tt.colorSpace = THREE.NoColorSpace;
  return { text: tt, time: mt, count: total };
}

// ───────── 着色器 ─────────
const QUAD_VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const INK_FRAG = `uniform sampler2D uText,uTime;uniform float uP,uAlpha,uDark;uniform vec3 uFresh,uDry;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  float a=texture2D(uText,vUv).a,a2=texture2D(uText,vUv,3.).a,tm=texture2D(uTime,vUv).r;
  float n=h(floor(vUv*vec2(420.,300.)))*.05;
  float rv=smoothstep(tm,tm+.035,uP+n-.02);
  float wet=1.-smoothstep(0.,.3,uP-tm);
  vec3 col=mix(uDry,uFresh,wet*.9)+wet*step(.55,a)*vec3(.2,.1,.08);
  float al=(a*rv+a2*.32*rv*(.4+wet))*uAlpha*(.86+.14*h(vUv*640.));
  if(al<.004)discard;
  gl_FragColor=vec4(col*uDark,clamp(al,0.,1.));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const ASH_FRAG = `uniform sampler2D uText,uTime,uNoise;uniform float uP,uCover,uBlow,uAlpha;varying vec2 vUv;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.07+vec2(11.3,7.9);a*=.5;}return s;}
void main(){
  float a=texture2D(uText,vUv).a,a2=texture2D(uText,vUv,2.5).a,tm=texture2D(uTime,vUv).r;
  float ed=pow(pow(abs(vUv.x-.5)*2.,4.)+pow(abs(vUv.y-.5)*2.,4.),.25)+(fbm(vUv*5.+2.)-.5)*.2;
  float pat=smoothstep(1.0,.82,ed);
  float scatter=step(h21(floor(vUv*vec2(900.,720.))),smoothstep(1.08,.8,ed)*1.15);
  float dens=mix(scatter*.8,1.,smoothstep(.9,.74,ed));
  float thick=.5+.5*fbm(vUv*9.+7.);
  dens*=smoothstep(.12,.5,thick+(pat-.5)*.3);
  float sweep=clamp((uCover*1.5-(vUv.x*.6+fbm(vUv*3.)*.4))*6.,0.,1.);
  float blow=clamp((uBlow*1.7-(1.-vUv.x)*.6-fbm(vUv*4.+9.)*.4)*6.,0.,1.);
  dens*=sweep*(1.-blow);
  float rv=smoothstep(tm,tm+.04,uP-.02+h21(floor(vUv*400.))*.03);
  float txt=a*rv,ridge=clamp(a2*1.6-a,0.,1.)*rv;
  float grain=.75+.5*h21(vUv*vec2(1900.,1500.));
  float al=clamp(dens*(1.-txt)*uAlpha,0.,1.);
  vec3 col=vec3(.5,.48,.45)*grain*(.7+.5*fbm(vUv*14.))+ridge*vec3(.22,.21,.19);
  if(al<.01)discard;
  gl_FragColor=vec4(col,al*.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const SCREEN_FRAG = `uniform sampler2D uPaper;uniform float uTime,uFlick,uAlpha;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec4 p=texture2D(uPaper,vUv);
  float r=length((vUv-vec2(.5,.45))*vec2(1.,1.15));
  float glow=smoothstep(.85,.0,r);
  float fl=.9+.1*sin(uTime*7.+sin(uTime*2.3)*2.)+uFlick*.22*sin(uTime*31.);
  vec3 col=p.rgb*vec3(1.,.74,.42)*(.4+1.25*glow)*fl;
  col*=.9+.1*h(vUv*900.);
  gl_FragColor=vec4(col*uAlpha,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function inkMat(fresh, dry, dark = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uText: { value: null }, uTime: { value: null }, uP: { value: 0 }, uAlpha: { value: 1 }, uDark: { value: dark }, uFresh: { value: new THREE.Color(fresh) }, uDry: { value: new THREE.Color(dry) } },
    vertexShader: QUAD_VERT, fragmentShader: INK_FRAG, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3
  });
}

// ───────── 程序化贴图 ─────────
function tornPaperTexture(seed) {
  const W = 1024, H = 832, [c, g] = makeCanvas(W, H), rnd = mulberry(seed);
  const pts = [], m = 26;
  const edge = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + (rnd() - .5) * 22, y0 + (y1 - y0) * t + (rnd() - .5) * 22]); } };
  edge(m, m, W - m, m + 10, 30); edge(W - m, m + 10, W - m - 8, H - m, 26); edge(W - m - 8, H - m, m + 14, H - m - 6, 30); edge(m + 14, H - m - 6, m, m, 26);
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.save(); g.clip();
  const bg = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 640); bg.addColorStop(0, '#bda97c'); bg.addColorStop(1, '#8e7a52');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 5000; i++) { g.fillStyle = rnd() > .5 ? 'rgba(255,240,200,.07)' : 'rgba(60,40,15,.1)'; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 6, 1 + rnd() * 2); }
  for (let i = 0; i < 14; i++) { const x = rnd() * W, y = rnd() * H, r = 40 + rnd() * 120, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(70,45,15,.28)'); gr.addColorStop(1, 'rgba(70,45,15,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.strokeStyle = 'rgba(40,25,8,.22)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(rnd() * W, 0); g.lineTo(rnd() * W, H); g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(50,28,8,.7)'; g.lineWidth = 5; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
  return canvasTexture(c);
}
function paperFibre() {
  const [c, g] = makeCanvas(512), rnd = mulberry(9);
  g.fillStyle = '#d9cba6'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) { const x = rnd() * 512, y = rnd() * 512, a = rnd() * 6.28, l = 6 + rnd() * 24; g.strokeStyle = rnd() > .5 ? 'rgba(255,248,225,.25)' : 'rgba(110,80,40,.18)'; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 18; i++) { const x = rnd() * 512, y = rnd() * 512, r = 30 + rnd() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,80,30,.2)'); gr.addColorStop(1, 'rgba(120,80,30,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = canvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export function sealTexture(ch) {
  const [c, g] = makeCanvas(256), rnd = mulberry(5);
  g.translate(128, 128); g.rotate(-.04);
  g.strokeStyle = 'rgb(176,30,18)'; g.lineWidth = 12; g.strokeRect(-108, -108, 216, 216);
  g.lineWidth = 3; g.strokeRect(-92, -92, 184, 184);
  g.fillStyle = 'rgb(176,30,18)'; g.font = `bold 150px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 0, 10);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  for (let i = 0; i < 120; i++) { g.globalAlpha = .35 + rnd() * .65; g.beginPath(); g.arc((rnd() - .5) * 226, (rnd() - .5) * 226, .8 + rnd() * 2.4, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const t = canvasTexture(c); t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}function silhouetteCanvas(fig, h = 640) {
  const pad = 24;
  const img = fig.kind === 'spirit' ? viewImage(fig.id, 'front') : null;
  if (img) {
    const w = Math.round(h * img.width / img.height), [c, g] = makeCanvas(w + pad * 2, h + pad * 2);
    g.filter = 'blur(1.6px)'; g.drawImage(img, pad, pad, w, h); g.filter = 'none';
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    return { canvas: c, aspect: c.width / c.height };
  }
  const w = Math.round(h * .62), [c, g] = makeCanvas(w + pad * 2, h + pad * 2);
  g.translate(pad + w / 2, pad); g.fillStyle = '#000';
  g.filter = 'blur(2px)';
  if (fig.kind === 'mist') {
    g.beginPath(); g.ellipse(0, h * .3, w * .27, h * .22, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-w * .5, h); g.quadraticCurveTo(-w * .46, h * .5, -w * .16, h * .46); g.lineTo(w * .16, h * .46); g.quadraticCurveTo(w * .46, h * .5, w * .5, h); g.closePath(); g.fill();
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc((Math.sin(i * 2.1) * .5) * w * .5, h * (.08 + (i % 4) * .05), 10 + (i % 3) * 6, 0, 7); g.fill(); }
    const [ec, eg] = makeCanvas(c.width, c.height); eg.translate(pad + w / 2, pad);
    for (const sx of [-1, 1]) { const gr = eg.createRadialGradient(sx * w * .1, h * .3, 0, sx * w * .1, h * .3, 26); gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(.35, 'rgba(255,140,50,.85)'); gr.addColorStop(1, 'rgba(255,110,30,0)'); eg.fillStyle = gr; eg.beginPath(); eg.ellipse(sx * w * .1, h * .3, 20, 9, sx * -.2, 0, 7); eg.fill(); }
    return { canvas: c, aspect: c.width / c.height, eyes: ec };
  } else {
    g.beginPath(); g.ellipse(0, h * .14, w * .15, h * .1, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-w * .12, h * .22); g.quadraticCurveTo(-w * .5, h * .55, -w * .4, h); g.lineTo(w * .4, h); g.quadraticCurveTo(w * .5, h * .55, w * .12, h * .22); g.closePath(); g.fill();
  }
  return { canvas: c, aspect: c.width / c.height };
}
function ashGrain() {
  const [c, g] = makeCanvas(32); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(210,205,196,1)'); gr.addColorStop(1, 'rgba(210,205,196,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return canvasTexture(c);
}

export function createStoryStage(ctx) {
  const scene = ctx.scene, rig = ctx.rig;
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const light = new THREE.PointLight('#ffb066', 0, 7, 1.5); scene.add(light);
  const ui = document.getElementById('ui') || document.body;
  const click = document.createElement('div'); click.className = 'story-click'; click.style.display = 'none';
  const bar = document.createElement('div'); bar.className = 'story-bar'; bar.style.display = 'none';
  const extraEl = document.createElement('div'); extraEl.className = 'story-extra'; extraEl.style.display = 'none';
  const hint = document.createElement('div'); hint.className = 'story-hint'; hint.textContent = '点击任意处显现全文'; hint.style.display = 'none';
  ui.append(click, extraEl, bar, hint);

  const rnd = mulberry(31);
  const grainTex = ashGrain(), paperTex = paperFibre();
  const grains = [];
  for (let i = 0; i < 90; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: grainTex, transparent: true, depthWrite: false, opacity: 0, color: '#b5b0a6' })); s.userData = { noPick: true, life: 9, max: 1, v: new THREE.Vector3() }; s.scale.setScalar(.05); scene.add(s); grains.push(s); }
  function grain(pos, v, life = 1.6, size = .05, color = '#b5b0a6') {
    const s = grains.find(x => x.userData.life >= x.userData.max); if (!s) return;
    const u = s.userData; u.life = 0; u.max = life * (.7 + Math.random() * .6); u.v.copy(v); s.position.copy(pos); s.scale.setScalar(size * (.6 + Math.random())); s.material.color.set(color);
  }

  let spec = null, S = null, active = false, token = 0, time = 0;

  function clearScene() {
    for (const c of [...root.children]) { c.removeFromParent(); c.traverse?.(o => { o.geometry?.dispose?.(); }); }
    S = null;
  }
  function setBar(buttons) {
    bar.replaceChildren();
    for (const f of buttons) {
      if (f === '-') { const s = document.createElement('span'); s.className = 'spacer'; bar.append(s); continue; }
      const b = document.createElement('button'); b.className = 'ink-btn' + (f.primary ? ' primary' : ''); b.textContent = f.label; b.disabled = !!f.disabled;
      b.onclick = ev => { ev.stopPropagation(); unlockAudio(); play('click'); f.onClick(); };
      bar.append(b);
    }
  }

  // ───────── 页管理 ─────────
  function layout(style) {
    if (style === 'shadow') return { cpl: 18, maxLines: 6, fs: 54, lh: 74, W: TEXT_W, H: 512, x0: 20, y0: 10 };
    if (style === 'ash') return { cpl: 15, maxLines: 7, fs: 46, lh: 80, W: TEXT_W, H: 832, x0: 170, y0: 135 };
    return { cpl: 17, maxLines: 8, fs: 50, lh: 82, W: TEXT_W, H: 832, x0: 120, y0: 92 };
  }
  function buildScreens() {
    const L = layout(spec.style);
    const screens = paginate(spec.pages && spec.pages.length ? spec.pages : [''], L.cpl, L.maxLines);
    return screens.map(lines => ({ lines, tex: null }));
  }
  function pageTex(i) {
    const sc = S.screens[i], L = layout(spec.style);
    if (!sc.tex) sc.tex = renderPage(sc.lines, { ...L });
    return sc.tex;
  }
  function applyPage(i) {
    S.index = i; S.p = 0; S.done = false; S.skipped = false;
    const t = pageTex(i);
    S.ink.material.uniforms.uText.value = t.text; S.ink.material.uniforms.uTime.value = t.time;
    S.ink.material.uniforms.uP.value = 0;
    S.dur = Math.max(1.3, t.count * .06);
    bar.style.display = 'none'; extraEl.style.display = 'none'; hint.style.display = '';
    S.styleOnPage?.(i);
  }
  function finishReveal() {
    S.done = true; hint.style.display = 'none';
    const last = S.index >= S.screens.length - 1;
    const btns = [];
    if (!last) btns.push({ label: '下一页', primary: true, onClick: () => next() });
    else for (const f of spec.foot || []) {
      if (f === '-') { btns.push('-'); continue; }
      btns.push({ label: f.label, primary: f.primary, disabled: f.disabled, onClick: () => activate(f) });
    }
    setBar(btns); bar.style.display = '';
    if (last && spec.extra) { extraEl.replaceChildren(spec.extra); extraEl.style.display = ''; }
  }
  function next() {
    if (!S || S.index >= S.screens.length - 1) return;
    play(spec.style === 'ash' ? 'hush' : 'rustle');
    applyPage(S.index + 1);
    S.onNext?.();
  }
  function skip() {
    if (!S || S.done) return;
    S.p = 1.25; unlockAudio();
  }
  async function activate(f) {
    const my = token;
    if (f.seal && S.sealFn) { bar.style.display = 'none'; extraEl.style.display = 'none'; await S.sealFn(); }
    if (my !== token) return;
    hideInternal();
    f.fn?.();
  }
  click.addEventListener('click', () => { if (!S) return; if (!S.done) skip(); else if (S.index < S.screens.length - 1) next(); });
  addEventListener('keydown', ev => { if (active && (ev.key === ' ' || ev.key === 'Enter') && !(ev.target instanceof HTMLButtonElement)) { ev.preventDefault(); if (!S.done) skip(); else if (S.index < S.screens.length - 1) next(); } });

  // ───────── 样式：碎纸血字 ─────────
  function buildBlood() {
    const g = new THREE.Group(); root.add(g);
    const geo = new THREE.PlaneGeometry(3.3, 2.7, 28, 22), pos = geo.attributes.position, base = Float32Array.from(pos.array);
    for (let i = 0; i < pos.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; pos.setZ(i, Math.sin(x * 2.3 + y * 1.1) * .018 + Math.sin(y * 5.1 - x * 1.7) * .01); base[i * 3 + 2] = pos.getZ(i); }
    geo.computeVertexNormals();
    const paper = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tornPaperTexture(7), bumpMap: paperBump(), bumpScale: 1.4, roughness: .95, alphaTest: .5, side: THREE.DoubleSide }));
    paper.castShadow = true; paper.receiveShadow = true;
    const ink = new THREE.Mesh(geo, inkMat('#d8321c', '#7a140c'));
    ink.renderOrder = 6;
    const proxy = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.7), new THREE.MeshBasicMaterial()); proxy.visible = false; proxy.userData.dofProxy = true; proxy.userData.noPick = true;
    const holder = new THREE.Group(); holder.add(paper, ink, proxy);
    holder.rotation.x = -Math.PI / 2; g.add(holder);
    g.position.set(.1, 2.4, .25); g.rotation.set(.5, .35, 0);
    const seal = new THREE.Mesh(new THREE.PlaneGeometry(.95, .95), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
    seal.position.set(.85, -.7, .06); seal.visible = false; holder.add(seal);
    const st = { group: g, holder, geo, base, paper, ink, seal, curl: 0, enter: 0 };
    return st;
  }
  function curlGeo(st, c) {
    const pos = st.geo.attributes.position, b = st.base, phi = .55, cp = Math.cos(phi), sp = Math.sin(phi), r = .13;
    let umin = 1e9, umax = -1e9;
    for (let i = 0; i < pos.count; i++) { const u = b[i * 3] * cp + b[i * 3 + 1] * sp; umin = Math.min(umin, u); umax = Math.max(umax, u); }
    const uc = umax - c * (umax - umin) * 1.08;
    for (let i = 0; i < pos.count; i++) {
      const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2], u = x * cp + y * sp;
      if (u > uc) { const d = u - uc, ang = Math.min(d / r, Math.PI * 5), u2 = uc + r * Math.sin(ang) * (1 - ang / 40), z2 = r * (1 - Math.cos(ang)); pos.setXYZ(i, x + (u2 - u) * cp, y + (u2 - u) * sp, z + z2); }
      else pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true; st.geo.computeVertexNormals();
  }
  function burnAway(st) {
    play('ember');
    return new Promise(res => {
      const o = { c: 0 }; const v = new THREE.Vector3(), p = new THREE.Vector3();
      tween(o, { c: 1 }, {
        dur: 1500, ease: 'inQuad', onUpdate: () => {
          curlGeo(st, o.c);
          for (let k = 0; k < 2; k++) { p.set((Math.random() - .3) * 2.6, .1, (Math.random() - .5) * 2.0).add(st.group.position); v.set(.3 + Math.random() * .4, .35 + Math.random() * .4, (Math.random() - .5) * .3); grain(p, v, 1.8, .05, '#8a8378'); }
        }
      }).then(() => { st.group.visible = false; res(); });
    });
  }

  // ───────── 样式：香灰显字 ─────────
  function buildAsh() {
    const g = new THREE.Group(); root.add(g);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 3.0), new THREE.ShaderMaterial({
      uniforms: { uText: { value: null }, uTime: { value: null }, uNoise: { value: noiseTexture() }, uP: { value: 0 }, uCover: { value: 0 }, uBlow: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: QUAD_VERT, fragmentShader: ASH_FRAG, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
    }));
    plane.rotation.x = -Math.PI / 2; plane.position.set(0, .03, .0); plane.renderOrder = 5;
    g.add(plane);
    return { group: g, plane, ink: plane, cover: 0 };
  }

  // ───────── 样式：烛影纸屏 ─────────
  function buildShadow() {
    const g = new THREE.Group(); root.add(g);
    g.position.set(0, 0, -2.4);
    const woodMat = new THREE.MeshStandardMaterial({ color: '#2a1b12', roughness: .8 });
    const SW = 4.6, SH = 3.6, SY = 2.1;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.ShaderMaterial({ uniforms: { uPaper: { value: paperTex }, uTime: { value: 0 }, uFlick: { value: 0 }, uAlpha: { value: 0 } }, vertexShader: QUAD_VERT, fragmentShader: SCREEN_FRAG }));
    paper.position.y = SY; g.add(paper);
    const proxy = new THREE.Mesh(new THREE.PlaneGeometry(SW + .6, SH + .3), new THREE.MeshBasicMaterial()); proxy.visible = false; proxy.userData.dofProxy = true; proxy.userData.noPick = true; proxy.position.y = SY; g.add(proxy);
    for (const x of [-SW / 2 - .1, SW / 2 + .1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.2, SH + .5, .22), woodMat); post.position.set(x, SY, 0); post.castShadow = true; g.add(post); const foot = new THREE.Mesh(new THREE.BoxGeometry(.5, .12, .9), woodMat); foot.position.set(x, .06, 0); g.add(foot); }
    for (const y of [SY + SH / 2 + .12, SY - SH / 2 - .1]) { const bar2 = new THREE.Mesh(new THREE.BoxGeometry(SW + .5, .2, .22), woodMat); bar2.position.set(0, y, 0); g.add(bar2); }
    const ink = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.9), inkMat('#b38b5c', '#3a2010'));
    ink.position.set(0, 1.32, .03); ink.renderOrder = 6; g.add(ink);
    const figs = [];
    const list = spec.figures && spec.figures.length ? spec.figures : [{ id: '', name: '', kind: 'mist' }];
    list.forEach((fig, i) => {
      const { canvas, aspect, eyes } = silhouetteCanvas(fig, 640), tex = canvasTexture(canvas);
      const hgt = fig.kind === 'mist' ? 1.2 : 1.35, w = hgt * aspect;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: '#000' }));
      const n = list.length, tx = n === 1 ? 0 : -1.7 + (3.4 * i) / (n - 1);
      m.position.set(tx + (i % 2 ? 2.8 : -2.8), SY + .98, .02); m.renderOrder = 4;
      if (eyes) { const em = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ map: canvasTexture(eyes), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); em.position.z = .004; m.add(em); m.userData.eyeMesh = em; }
      g.add(m); figs.push({ m, tx, w, hgt, seed: rnd() * 9, flip: 1 });
    });
    return { group: g, paper, ink, figs, SY, flick: 0 };
  }

  // ───────── show / hide ─────────
  function setBase(style) {
    const mapShown = !!ctx.mapView?.shown;
    S.restoreDim = mapShown ? .3 : 1;
    kill(ctx.lights.state); tween(ctx.lights.state, { dim: style === 'shadow' ? .55 : .62 }, { dur: 700 });
    focusState.override = style === 'shadow' ? 7.8 : 4.6;
  }
  function show(sp) {
    token++;
    if (S) { clearScene(); }
    spec = sp; active = true; time = 0;
    unlockAudio();
    root.visible = true;
    S = { screens: null, index: 0, p: 0, done: false, dur: 1.5, style: sp.style, enterT: 0 };
    let st;
    if (sp.style === 'blood') st = buildBlood(); else if (sp.style === 'ash') st = buildAsh(); else st = buildShadow();
    Object.assign(S, st);
    S.screens = buildScreens();
    setBase(sp.style);
    click.style.display = ''; hint.style.display = ''; document.body.classList.add('story-on'); bar.dataset.kicker = sp.kicker || ''; bar.dataset.title = sp.title || '';
    ctx.input?.hideTags?.(); ctx.input?.hideTip?.();
    const my = token;
    if (sp.style === 'blood') {
      rig.goTo('read', { dur: 1000 }); light.position.set(0, 1.8, .8); light.color.set('#ffb066');
      play('rustle');
      tween(S.group.position, { y: .04 }, { dur: 1100, ease: 'outCubic' }); tween(S.group.rotation, { x: 0, y: .05 }, { dur: 1100, ease: 'outCubic' }).then(() => { if (my === token) { S.enterT = 1; } });
      S.sealFn = sealRun;
    } else if (sp.style === 'ash') {
      rig.goTo('read', { dur: 1000 }); light.position.set(0, 1.9, .9); light.color.set('#ffb87a'); play('hush');
      tween(S, { cover: 1 }, { dur: 1600, ease: 'inOutQuad', onUpdate: () => { S.plane.material.uniforms.uCover.value = S.cover; } }).then(() => { if (my === token) S.enterT = 1; });
    } else {
      rig.goTo('screen', { dur: 1100 }); light.position.set(0, 2.2, 3.2); light.color.set('#ffa860'); play('ember');
      tween(S.paper.material.uniforms.uAlpha, { value: 1 }, { dur: 1000 });
      S.figs.forEach((f, i) => { tween(f.m.position, { x: f.tx }, { dur: 1600 + i * 200, ease: 'outCubic', delay: 500 }); tween(f.m.material, { opacity: .94 }, { dur: 900, delay: 500 + i * 150 }); });
      S.onNext = () => {
        S.flick = 1; play('ember');
        S.figs.forEach((f, i) => { const dx = (i % 2 ? -1 : 1) * .22; tween(f.m.position, { x: f.tx + dx }, { dur: 900, ease: 'inOutCubic' }); f.flip = -f.flip; });
      };
      S.enterT = .6;
    }
    light.intensity = 0; tween(light, { intensity: sp.style === 'shadow' ? 12 : 7 }, { dur: 1200 });
    applyPage(0);
    S.p = -(sp.style === 'blood' ? .35 : sp.style === 'ash' ? .5 : .7);
  }

  function hideInternal() {
    if (!active) return;
    active = false; token++;
    const st = S, style = spec?.style, my = token;
    click.style.display = 'none'; bar.style.display = 'none'; extraEl.style.display = 'none'; hint.style.display = 'none'; document.body.classList.remove('story-on');
    focusState.override = null;
    kill(ctx.lights.state); tween(ctx.lights.state, { dim: st?.restoreDim ?? 1 }, { dur: 600 });
    tween(light, { intensity: 0 }, { dur: 700 });
    const pose = ctx.screens?.base;
    if (pose === 'map') rig.goTo('map', { dur: 1000 });
    if (!st) return;
    const finish = () => { if (S === st) { clearScene(); root.visible = false; } };
    if (style === 'blood') burnAway(st).then(finish);
    else if (style === 'ash') {
      play('hush'); const p = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i < 70; i++) { p.set((Math.random() - .5) * 3.4, .06, (Math.random() - .5) * 2.6); v.set(1.2 + Math.random() * 1.6, .3 + Math.random() * .7, (Math.random() - .5) * .7); grain(p, v, 1.6, .06); }
      tween(st.plane.material.uniforms.uBlow, { value: 1 }, { dur: 1300, ease: 'inQuad' }).then(finish);
    } else {
      st.figs.forEach(f => tween(f.m.material, { opacity: 0 }, { dur: 800 }));
      tween(st.paper.material.uniforms.uAlpha, { value: 0 }, { dur: 1100 }).then(finish);
    }
    void my;
  }

  async function sealRun() {
    const st = S; if (!st?.seal) return;
    const ch = (spec.sealChar || '契')[0];
    st.seal.material.map = sealTexture(ch); st.seal.material.needsUpdate = true; st.seal.visible = true;
    st.seal.scale.setScalar(1.7); st.seal.material.opacity = 0;
    play('stamp');
    await Promise.all([tween(st.seal.scale, { x: 1, y: 1 }, { dur: 200, ease: 'outCubic' }), tween(st.seal.material, { opacity: .96 }, { dur: 140 })]);
    tween(st.group.position, { y: .015 }, { dur: 70 }).then(() => tween(st.group.position, { y: .04 }, { dur: 260, ease: 'outElastic' }));
    await new Promise(r => setTimeout(r, 650));
  }

  function update(dt, t) {
    if (!active || !S) {
      for (const s of grains) { const u = s.userData; if (u.life >= u.max) { s.material.opacity = 0; continue; } u.life += dt; s.position.addScaledVector(u.v, dt); u.v.y -= .2 * dt; s.material.opacity = (1 - u.life / u.max) * .7; }
      return;
    }
    time += dt;
    const spd = Math.max(.25, Number(globalThis.GC?.preferences?.speed) || 1);
    if (!S.done) {
      S.p += dt / S.dur * spd * (S.p > 1 ? 4 : 1);
      if (S.p > 1.18) finishReveal();
    }
    const P = Math.max(0, S.p);
    S.ink.material.uniforms.uP.value = P;
    if (S.style === 'blood') {
      light.intensity = Math.max(light.intensity, 0);
    } else if (S.style === 'ash') {
      const wp = Math.min(1, P);
      if (!S.done && P > 0 && P < 1.1) { const pp = new THREE.Vector3((wp - .5) * 3.0 + (Math.random() - .5) * .5, .05, (Math.random() - .35) * 2.0), vv = new THREE.Vector3((Math.random() - .3) * .5, .15 + Math.random() * .25, (Math.random() - .5) * .4); if (Math.random() < .5) grain(pp, vv, .9, .04); }
    } else {
      S.flick = damp(S.flick, 0, 3, dt);
      S.paper.material.uniforms.uTime.value = time; S.paper.material.uniforms.uFlick.value = S.flick;
      S.figs.forEach(f => { if (f.m.userData.eyeMesh) f.m.userData.eyeMesh.material.opacity = f.m.material.opacity; f.m.rotation.z = Math.sin(time * .9 + f.seed) * .012; f.m.scale.set(f.flip, 1 + Math.sin(time * 1.7 + f.seed) * .006, 1); f.m.position.y = S.SY + .98 + Math.sin(time * .7 + f.seed) * .01; });
      light.position.y = 2.2 + Math.sin(time * 7) * .08 + S.flick * .3;
    }
    for (const s of grains) { const u = s.userData; if (u.life >= u.max) { s.material.opacity = 0; continue; } u.life += dt; s.position.addScaledVector(u.v, dt); u.v.y -= .2 * dt; s.material.opacity = (1 - u.life / u.max) * .7; }
  }

  function warm() {
    const prev = { spec, S, active }; const dummy = new THREE.Group(); root.add(dummy); root.visible = true;
    const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true;
    const mi = inkMat('#d8321c', '#7a140c'); mi.uniforms.uText.value = t; mi.uniforms.uTime.value = t;
    const ma = new THREE.ShaderMaterial({ uniforms: { uText: { value: t }, uTime: { value: t }, uNoise: { value: noiseTexture() }, uP: { value: 0 }, uCover: { value: 0 }, uBlow: { value: 0 }, uAlpha: { value: 1 } }, vertexShader: QUAD_VERT, fragmentShader: ASH_FRAG, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const ms = new THREE.ShaderMaterial({ uniforms: { uPaper: { value: paperTex }, uTime: { value: 0 }, uFlick: { value: 0 }, uAlpha: { value: 1 } }, vertexShader: QUAD_VERT, fragmentShader: SCREEN_FRAG });
    const mp = new THREE.MeshStandardMaterial({ map: tornPaperTexture(7), bumpMap: paperBump(), bumpScale: 1.4, roughness: .95, alphaTest: .5, side: THREE.DoubleSide });
    const mb = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: '#000' });
    const g = new THREE.PlaneGeometry(.1, .1);
    for (const m of [mi, ma, ms, mp, mb]) dummy.add(new THREE.Mesh(g, m));
    try { ctx.R.renderer.compile(scene, rig.camera); } finally { dummy.removeFromParent(); root.visible = prev.active; }
    void prev;
  }

  function hide() { hideInternal(); }
  return {
    show, hide, update, warm,
    get active() { return active; },
    get style() { return spec?.style; },
    get done() { return !!S?.done; }
  };
}
