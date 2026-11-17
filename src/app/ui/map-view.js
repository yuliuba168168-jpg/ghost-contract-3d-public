// 桌面鬼火路线图：没有纸，路线直接由鬼火照在旧木桌上。节点=一簇鬼火+焦痕，路径=贴桌光迹，玩家=一团真火。
import * as THREE from 'three';
import { makeCanvas, canvasTexture, glowTexture, smokeTexture, FONT } from '../scene/textures.js';
import { createFlame } from '../fx/flame.js';
import { register, unregister } from '../core/input.js';
import { tween, damp, mulberry, kill } from '../core/tween.js';
import { play } from '../core/audio.js';

const PW = 6.2, PD = 4.7, LIGHTS = 8;
const TYPE = {
  event: ['卷', '#a7c9d6'], contract: ['契', '#bfe0c0'], battle: ['战', '#c85a46'], boss: ['首', '#d8352a'],
  camp: ['火', '#ff9a3c'], reward: ['查', '#8fd0b0'], ending: ['终', '#d8d4c8'], fork: ['岔', '#9fb5d9']
};

const TRAIL_VERT = 'attribute float aU;attribute float aV;attribute float aMode;varying float vU;varying float vV;varying float vMode;void main(){vU=aU;vV=aV;vMode=aMode;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const TRAIL_FRAG = `uniform float uTime;varying float vU;varying float vV;varying float vMode;
float h(float n){return fract(sin(n*91.7+3.1)*43758.5);}
void main(){
  vec3 col;float a;
  if(vMode>1.5){
    float cellL=.2;float ph=vU/cellL-uTime*.55;float cell=floor(ph),f=fract(ph);
    float wob=sin(cell*3.7+uTime*1.4)*.22;
    vec2 d=vec2((f-.5)*cellL,(vV+wob)*.035);
    float r=length(d);
    float core=smoothstep(.026,.004,r),halo=smoothstep(.07,.0,r)*.35;
    float on=.55+.45*h(cell);
    col=mix(vec3(.35,.8,.78),vec3(.92,1.,.96),core);a=(core+halo)*on;
  }else if(vMode>.5){
    float across=1.-abs(vV);
    float line=smoothstep(.0,.55,across);
    float sp=step(.985,h(floor(vU*22.)+floor(uTime*2.2)*7.))*smoothstep(.2,.8,across);
    col=mix(vec3(.55,.12,.06),vec3(1.,.55,.22),sp);a=line*(.78+.2*sin(vU*37.+uTime*2.))+sp*.6;
  }else{float across=1.-abs(vV);col=vec3(.32,.33,.34);a=.12*smoothstep(.0,.6,across);}
  gl_FragColor=vec4(col,clamp(a,0.,1.));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const bez = (p0, p1, p2, p3, t, out) => { const u = 1 - t; out.set(u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, 0, u * u * u * p0.z + 3 * u * u * t * p1.z + 3 * u * t * t * p2.z + t * t * t * p3.z); return out; };

export function createMapView(ctx, labelRoot) {
  const group = new THREE.Group();
  group.visible = false;
  ctx.scene.add(group);
  const lightRoot = new THREE.Group(); ctx.scene.add(lightRoot); let storyHid = false, hidWas = [true, true];
  const pool = [];
  for (let i = 0; i < LIGHTS; i++) { const l = new THREE.PointLight('#9fd4d0', 0, 4.2, 1.6); l.userData.free = true; lightRoot.add(l); pool.push(l); }
  const takeLight = () => pool.find(l => l.userData.free);

  const rnd = mulberry(77);
  const glowGeo = new THREE.PlaneGeometry(1, 1); glowGeo.rotateX(-Math.PI / 2);
  const glyphTex = new Map();
  function scorch(kind) {
    if (glyphTex.has(kind)) return glyphTex.get(kind);
    const [c, g] = makeCanvas(256), [ch] = TYPE[kind] || TYPE.event;
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 124); gr.addColorStop(0, 'rgba(12,6,3,.96)'); gr.addColorStop(.72, 'rgba(12,6,3,.9)'); gr.addColorStop(1, 'rgba(12,6,3,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.strokeStyle = 'rgba(190,70,28,.55)'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 104, .2, 6.1); g.stroke();
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(0,0,0,${.1 + rnd() * .2})`; g.beginPath(); g.arc(128 + (rnd() - .5) * 220, 128 + (rnd() - .5) * 220, 2 + rnd() * 8, 0, 7); g.fill(); }
    g.font = `bold 128px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(70,16,6,.9)'; g.lineWidth = 8; g.strokeText(ch, 128, 138);
    g.fillStyle = '#c4401e'; g.fillText(ch, 128, 138);
    g.strokeStyle = 'rgba(255,170,90,.55)'; g.lineWidth = 1.4; g.strokeText(ch, 128, 138);
    const t = canvasTexture(c); glyphTex.set(kind, t); return t;
  }
  const trailMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide
  });
  let trailMesh = null;
  const trailBase = new THREE.Mesh(new THREE.PlaneGeometry(.01, .01), trailMat); trailBase.visible = false; group.add(trailBase);

  // 玩家：一团真火 + 灰烬 + 迸溅的火星 + 暖色点光
  const marker = new THREE.Group(); group.add(marker);
  const fire = createFlame({ color: '#ff7a1c', core: '#ffd890', width: .3, height: 1.1, shape: 'candle', seed: 3 });
  fire.mesh.position.y = .02; marker.add(fire.mesh);
  const ashMat = new THREE.MeshBasicMaterial({ map: smokeTexture(), color: '#2a2622', transparent: true, depthWrite: false, opacity: .9 });
  const ash = new THREE.Mesh(glowGeo, ashMat); ash.scale.setScalar(.55); ash.position.y = .006; ash.userData.noPick = true; marker.add(ash);
  const markerGlow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ff8a3a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .5 }));
  markerGlow.scale.setScalar(3.4); markerGlow.position.y = .01; markerGlow.userData.noPick = true; marker.add(markerGlow);
  const sparks = [];
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb05a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.userData = { noPick: true, life: 9, max: 1, vx: 0, vy: 0, vz: 0 }; s.scale.setScalar(.05); group.add(s); sparks.push(s);
  }
  function spark(pos, big = 1) {
    const s = sparks.find(x => x.userData.life >= x.userData.max); if (!s) return;
    const u = s.userData; u.life = 0; u.max = .5 + Math.random() * .6; u.vx = (Math.random() - .5) * .5 * big; u.vy = .3 + Math.random() * .5; u.vz = (Math.random() - .5) * .5 * big;
    s.position.copy(pos); s.position.y += .25 + Math.random() * .2;
  }
  const stamp = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: .85 }));
  stamp.scale.set(1.0, 1, 1.0); stamp.position.set(PW / 2 - .55, .007, PD / 2 - .15 - .12); stamp.userData.noPick = true; group.add(stamp);
  const markerLight = new THREE.PointLight('#ffa456', 0, 6, 1.5); lightRoot.add(markerLight);

  let nodes = [], dying = [], edges = [], shown = false, actShown = -1, onEnter = null, here = null, moving = false, tMove = 0, markerLean = 0;
  const posOf = new Map();
  const vtmp = new THREE.Vector3(), mpos = new THREE.Vector3();

  function kindOf(id, n) { if (n.contract) return 'contract'; if (id.endsWith('-fork')) return 'fork'; return n.type; }
  function describe(id, n) {
    const GD = globalThis.GC.GD;
    if (n.type === 'battle' || n.type === 'boss') return `${n.type === 'boss' ? '首领战' : '战斗'} · ${GD.ranks[n.rank]?.name || ''} · ${n.cards || 1}轮奖励`;
    if (n.contract) return '必经契约';
    if (n.type === 'camp') return '恢复 · 存档点';
    if (n.type === 'reward') return '调查 · 经验与卡牌';
    if (n.type === 'ending') return '阶段性尾声';
    return id.endsWith('-fork') ? '三条路任选其一' : '剧情';
  }
  function releaseNode(n, smoke = true) {
    unregister(n.hit); n.hit.removeFromParent();
    n.label.remove();
    if (n.light) { n.light.userData.free = true; n.light.intensity = 0; }
    if (smoke && ctx.props?.puff) { vtmp.set(n.base.x, .35, n.base.z); ctx.props.puff(vtmp, { size: .5, rise: .5, dur: 900, color: '#8a8f98' }); }
    n.group.removeFromParent(); n.flame.dispose();
  }
  function clearNodes(smoke) {
    for (const n of nodes) { if (smoke) { n.out = true; dying.push(n); } else releaseNode(n, false); }
    nodes = [];
    for (const d of dying.slice()) if (!smoke) { dying.splice(dying.indexOf(d), 1); releaseNode(d, false); }
    if (trailMesh) { trailMesh.removeFromParent(); trailMesh.geometry.dispose(); trailMesh = null; }
    edges = [];
  }

  function buildTrails(rowsFlat, pos, st) {
    const GC = globalThis.GC, P = [], U = [], V = [], M = [], I = [];
    const N = 44, WM = [.012, .014, .045];
    let base = 0;
    for (const id of rowsFlat) for (const next of GC.NODES[id].next || []) {
      if (!pos[next]) continue;
      const a = pos[id], b = pos[next], zm = (a.z + b.z) / 2;
      const p0 = { x: a.x, z: a.z }, p1 = { x: a.x, z: zm }, p2 = { x: b.x, z: zm }, p3 = { x: b.x, z: b.z };
      const doneEdge = st.completed.includes(id) && (st.completed.includes(next) || st.available.includes(next));
      const openEdge = st.available.includes(next) && st.completed.includes(id) || st.available.includes(id) && !st.completed.includes(id) && false;
      const mode = doneEdge ? 1 : (st.available.includes(id) || st.completed.includes(id)) && st.available.includes(next) ? 2 : (st.available.includes(id) ? 2 : 0);
      let len = 0, prev = null;
      const pts = [];
      for (let i = 0; i <= N; i++) { const q = bez(p0, p1, p2, p3, i / N, new THREE.Vector3()); if (prev) len += q.distanceTo(prev); pts.push([q, len]); prev = q; }
      pts.forEach(([q, l], i) => {
        const q0 = pts[Math.max(0, i - 1)][0], q1 = pts[Math.min(N, i + 1)][0];
        let tx = q1.x - q0.x, tz = q1.z - q0.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const nx = -tz, nz = tx;
        for (const s of [-1, 1]) { const W = WM[mode]; P.push(q.x + nx * W * s, .016, q.z + nz * W * s); U.push(l); V.push(s); M.push(mode); }
      });
      for (let i = 0; i < N; i++) { const k = base + i * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      base += (N + 1) * 2;
      edges.push({ from: id, to: next, p0, p1, p2, p3, len });
    }
    if (!P.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aU', new THREE.Float32BufferAttribute(U, 1));
    g.setAttribute('aV', new THREE.Float32BufferAttribute(V, 1)); g.setAttribute('aMode', new THREE.Float32BufferAttribute(M, 1)); g.setIndex(I);
    trailMesh = new THREE.Mesh(g, trailMat); trailMesh.frustumCulled = false; trailMesh.renderOrder = 2; trailMesh.userData.noPick = true; group.add(trailMesh);
  }

  function drawStamp(act) {
    const [c, g] = makeCanvas(256), seal = `第${act}幕`;
    g.translate(128, 128); g.rotate(.07);
    g.strokeStyle = 'rgba(255,110,50,.7)'; g.lineWidth = 6; g.strokeRect(-92, -92, 184, 184);
    g.fillStyle = 'rgba(12,6,4,.92)'; g.fillRect(-88, -88, 176, 176);
    g.fillStyle = 'rgba(200,80,40,.85)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold 44px ${FONT}`; g.fillText('第', 0, -52); g.font = 'bold 82px Georgia, serif'; g.fillText(String(act), 0, 4); g.font = `bold 44px ${FONT}`; g.fillText('幕', 0, 58);
    stamp.material.map = canvasTexture(c); stamp.material.needsUpdate = true; void seal;
  }

  function show(act, enter) {
    const GC = globalThis.GC, st = GC.state, rows = GC.ACT_ROWS[act] || [];
    onEnter = enter;
    const changedAct = actShown !== act, wasShown = shown;
    clearNodes(wasShown && changedAct);
    const pos = {}, R = rows.length, dz = Math.min(.95, 3.8 / Math.max(1, R - 1)), z0 = R > 1 ? Math.min(1.9, dz * (R - 1) / 2) : 0;
    rows.forEach((row, r) => row.forEach((id, c) => { pos[id] = { x: row.length === 1 ? (r % 2 ? .55 : -.55) * (R > 6 ? 1 : .7) : (c - (row.length - 1) / 2) * (row.length > 2 ? 2.3 : 3.0), z: z0 - r * dz }; }));
    posOf.clear(); for (const id in pos) posOf.set(id, pos[id]);
    buildTrails(rows.flat(), pos, st);
    drawStamp(act);
    let order = 0; const ignite = !wasShown || changedAct;
    for (const row of rows) for (const id of row) {
      const n = GC.NODES[id], kind = kindOf(id, n), status = st.completed.includes(id) ? 'done' : st.available.includes(id) ? 'open' : 'locked', col = (TYPE[kind] || TYPE.event)[1];
      const g = new THREE.Group(); g.position.set(pos[id].x, 0, pos[id].z); group.add(g);
      const mark = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: scorch(kind), transparent: true, depthWrite: false, opacity: status === 'locked' ? .55 : .95, polygonOffset: true, polygonOffsetFactor: -1 }));
      mark.scale.setScalar(kind === 'boss' ? 1.35 : 1.05); mark.material.color.setScalar(status === 'open' ? 1 : status === 'done' ? .62 : .42); mark.position.y = .008; mark.userData.noPick = true; mark.renderOrder = 1;
      const wisp = kind === 'camp' ? 'candle' : 'wisp', big = kind === 'boss' ? 1.45 : 1;
      const flame = createFlame({ color: col, core: kind === 'camp' ? '#ffe0a0' : '#c8e6f0', width: .2 * big, height: .9 * big, shape: wisp, seed: rnd() * 60 });
      flame.mesh.position.y = .16;
      const pool = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: glowTexture(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      pool.scale.setScalar(1.3); pool.position.y = .012; pool.userData.noPick = true; pool.renderOrder = 3;
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .6, 12), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .3; hit.userData.noPick = false;
      g.add(mark, pool, flame.mesh, hit);
      const item = { id, kind, group: g, mark, pool, flame, hit, status, hover: 0, flash: 0, hovering: false, seed: Math.random() * 9, base: pos[id], level: ignite ? 0 : 1, delay: ignite ? (wasShown ? .35 : .5) + order * .06 : 0, big, col, out: false };
      order++;
      if (status === 'open') { const L = takeLight(); if (L) { L.userData.free = false; L.color.set(col); item.light = L; } }
      register(hit, {
        enabled: () => shown && !ctx.screens?.modalOpen && !ctx.storyStage?.active,
        onHover: () => { item.hovering = true; if (status === 'open') play('hover'); }, onOut: () => { item.hovering = false; },
        onClick: () => { if (status !== 'open') return; play('click'); item.flash = 1; setTimeout(() => onEnter?.(id), 160); }
      });
      nodes.push(item);
      const l = document.createElement('div'); l.className = 'node-label ' + status;
      l.innerHTML = `<b></b><span></span>`; l.firstChild.textContent = n.title; l.lastChild.textContent = describe(id, n);
      labelRoot.append(l); item.label = l;
    }
    const target = nodes.find(n => n.status === 'open') || nodes.find(n => n.id === st.current) || nodes[0];
    const prevHere = here;
    here = target || null;
    if (here) {
      const p = here.base, dest = { x: p.x - .42, z: p.z + .12 };
      if (shown && !changedAct && prevHere && prevHere.id !== here.id && !moving) travel(prevHere.id, here.id, dest);
      else { marker.position.set(dest.x, 0, dest.z); }
    }
    actShown = act;
    if (!shown) {
      shown = true; group.visible = true;
      if (ctx.lights) { kill(ctx.lights.state); tween(ctx.lights.state, { dim: .45 }, { dur: 800 }); }
      if (ctx.table?.setPlain) { const o = { v: 0 }; tween(o, { v: 1 }, { dur: 700, onUpdate: () => ctx.table.setPlain(o.v) }); }
      play('paper');
    }
  }

  function travel(fromId, toId, dest) {
    const e = edges.find(x => x.from === fromId && x.to === toId);
    const a = posOf.get(fromId), b = posOf.get(toId);
    const p0 = e ? { x: e.p0.x - .42, z: e.p0.z + .12 } : { x: a.x - .42, z: a.z + .12 }, p3 = dest;
    const zm = (p0.z + p3.z) / 2, p1 = { x: p0.x, z: zm }, p2 = { x: p3.x, z: zm };
    moving = true; tMove = 0;
    const o = { t: 0 }, tmp = new THREE.Vector3(), prev = new THREE.Vector3();
    marker.position.set(p0.x, 0, p0.z); prev.copy(marker.position);
    return tween(o, { t: 1 }, {
      dur: 700, ease: 'inOutCubic', onUpdate: () => {
        bez(p0, p1, p2, p3, o.t, tmp); const vx = tmp.x - prev.x, vz = tmp.z - prev.z;
        markerLean = THREE.MathUtils.clamp(-(vx * 14), -.8, .8);
        marker.position.set(tmp.x, 0, tmp.z); prev.copy(tmp);
        mpos.copy(tmp); spark(mpos, 1.4); if (Math.random() < .5) spark(mpos, 1.8);
      }
    }).then(() => { moving = false; markerLean = 0; });
  }

  function hide() {
    if (!shown) return;
    shown = false;
    clearNodes(false);
    for (const l of pool) { l.userData.free = true; l.intensity = 0; }
    markerLight.intensity = 0;
    if (ctx.lights) { kill(ctx.lights.state); tween(ctx.lights.state, { dim: 1 }, { dur: 600 }); }
    if (ctx.table?.setPlain) { const o = { v: 1 }; tween(o, { v: 0 }, { dur: 500, onUpdate: () => ctx.table.setPlain(o.v) }); }
    group.visible = false;
  }

  function warm() { const was = group.visible; group.visible = true; trailBase.visible = true; try { ctx.R.renderer.compile(ctx.scene, ctx.rig.camera); } finally { group.visible = was; trailBase.visible = false; } }

  const v = new THREE.Vector3();
  function update(dt, t) {
    trailMat.uniforms.uTime.value = t;
    { const sa = !!ctx.storyStage?.active; if (sa && !storyHid) { storyHid = true; hidWas = [group.visible, lightRoot.visible]; group.visible = lightRoot.visible = false; } else if (!sa && storyHid) { storyHid = false; group.visible = hidWas[0]; lightRoot.visible = hidWas[1]; } }
    if (!shown && !dying.length) return;
    const modal = !!ctx.screens?.modalOpen || !!ctx.storyStage?.active, storyDim = ctx.storyStage?.active ? .35 : 1;
    // 玩家火焰
    fire.set({ lean: markerLean + Math.sin(t * 1.3) * .12, intensity: 1.5 + Math.sin(t * 9) * .06, gust: moving ? .6 : 0 });
    fire.mesh.scale.set(.85 * (1 + Math.sin(t * 11) * .05), 1.5 * (1 + Math.sin(t * 17) * .08) * (moving ? 1.12 : 1), 1);
    markerGlow.material.opacity = (.42 + Math.sin(t * 7) * .06) * storyDim;
    markerLight.position.set(marker.position.x, .75, marker.position.z);
    markerLight.intensity = shown ? (18 + Math.sin(t * 8.3) * 1.2 + Math.sin(t * 21) * .6) * storyDim : 0;
    if (!moving && Math.random() < dt * .8) { mpos.copy(marker.position); spark(mpos, .7); }
    for (const s of sparks) {
      const u = s.userData; if (u.life >= u.max) { s.material.opacity = 0; continue; }
      u.life += dt; s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt; u.vy -= .35 * dt;
      s.material.opacity = Math.max(0, 1 - u.life / u.max) * .9; s.scale.setScalar(.045 * (1 - u.life / u.max * .6));
    }
    stamp.material.opacity = .8 * storyDim;
    const list = nodes.concat(dying);
    for (const n of list) {
      n.hover = damp(n.hover, n.hovering && !modal ? 1 : 0, 10, dt);
      if (n.delay > 0) n.delay -= dt;
      const goal = n.out ? 0 : n.delay > 0 ? 0 : 1;
      n.level = damp(n.level, goal, n.out ? 5 : 4, dt);
      if (n.flash) n.flash = Math.max(0, n.flash - dt * 2.2);
      const L = n.level, s = n.status, breathe = Math.sin(t * 1.7 + n.seed);
      let h = .02, w = .02, inten = .1, poolO = 0, lightI = 0;
      if (s === 'open') { h = .95 * n.big * (1 + .08 * breathe) * (1 + n.hover * .5 + n.flash * .5); w = .24 * n.big * (1 + n.hover * .2); inten = 1.05 + n.hover * .5 + n.flash * 1.2; poolO = .75 + .1 * breathe + n.hover * .3 + n.flash * .5; lightI = 3 + .4 * breathe + n.hover * 2.5 + n.flash * 4; }
      else if (s === 'done') { h = .17; w = .07; inten = .85; poolO = .16; }
      else { h = .24; w = .08; inten = .34; poolO = .04; }
      n.flame.mesh.scale.set(w * 2 * L, h * L, 1);
      n.flame.set({ intensity: inten * Math.min(1, L * 1.2), lean: s === 'open' ? Math.sin(t * .9 + n.seed) * .12 + .22 * Math.sign(marker.position.x - n.base.x) * .5 : 0 });
      n.flame.mesh.position.y = .04 + (s === 'open' ? .1 : .0) + n.hover * .06;
      n.pool.material.opacity = poolO * L * storyDim; n.pool.scale.setScalar((s === 'open' ? 2.6 : s === 'done' ? 1.2 : .9) * (1 + n.hover * .3) * (kindBig(n)));
      if (n.light) { n.light.position.set(n.base.x, .45, n.base.z); n.light.intensity = lightI * L * storyDim; }
      const showLabel = !n.out && !modal && (s === 'open' || here?.id === n.id || n.hover > .3);
      if (n.out && L < .03) { dying.splice(dying.indexOf(n), 1); releaseNode(n, true); continue; }
      v.set(n.base.x, .1, n.base.z + .62).project(ctx.rig.camera);
      const lx = Math.round((v.x * .5 + .5) * innerWidth), ly = Math.round((-v.y * .5 + .5) * innerHeight);
      if (lx !== n.lx || ly !== n.ly) { n.lx = lx; n.ly = ly; n.label.style.left = lx + 'px'; n.label.style.top = ly + 'px'; }
      if (showLabel !== n.labelOn) { n.labelOn = showLabel; n.label.style.opacity = showLabel ? '' : '0'; }
    }
  }
  const kindBig = n => n.kind === 'boss' ? 1.35 : 1;
  const debugNodes = () => nodes.map(n => { const p = new THREE.Vector3(n.base.x, .3, n.base.z).project(ctx.rig.camera); return { id: n.id, status: n.status, x: Math.round((p.x * .5 + .5) * innerWidth), y: Math.round((-p.y * .5 + .5) * innerHeight) }; });
  return { show, hide, update, warm, debugNodes, get shown() { return shown; } };
}
