import * as THREE from 'three';
import { viewTexture, hasViews } from '../core/assets.js';
import { makeCanvas, canvasTexture, noiseTexture, glowTexture, FONT } from '../scene/textures.js';
import { TYPE_STYLE, mistEyes } from './card-face.js';
import { mulberry } from '../core/tween.js';
import { tween, damp, kill } from '../core/tween.js';
import { createEyePair } from '../fx/flame.js';
import { createSmokeMesh } from '../fx/smoke.js';
import { EYE_COLORS } from '../scene/opponent.js';

const apparitions = new Set();
const uTime = { value: 0 };
const facelessCache = new Map();
let planeGeo = null, keeper = null;

function mistBody(name, boss) {
  // 中性近黑烟雾柱，无眼睛（眼睛由 fx/flame.js 的 EyePair 实体提供）
  const key = 'mist:' + name + (boss ? 'b' : '');
  if (facelessCache.has(key)) return facelessCache.get(key);
  const W = 420, H = 720, [c, g] = makeCanvas(W, H), rnd = mulberry(name.length * 131 + name.charCodeAt(0));
  for (let i = 0; i < 52; i++) {
    const t = rnd(), x = W / 2 + (rnd() - .5) * (140 + t * 160), y = 130 + t * 540, r = 60 + rnd() * 85;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(6,6,7,.95)'); gr.addColorStop(.55, 'rgba(31,30,28,.6)'); gr.addColorStop(1, 'rgba(38,37,34,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 300; i++) { g.globalAlpha = rnd() * .4; const x = rnd() * W, y = rnd() * H; g.beginPath(); g.arc(x, y, 2 + rnd() * 16, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const tex = canvasTexture(c); tex.userData.aspect = W / H;
  facelessCache.set(key, tex);
  return tex;
}
function facelessTexture(name, type, boss) {
  const key = name[0] + type + (boss ? 'b' : '');
  if (facelessCache.has(key)) return facelessCache.get(key);
  const W = 360, H = 720, [c, g] = makeCanvas(W, H), col = (TYPE_STYLE[type] || TYPE_STYLE['恶灵']).color;
  const robe = g.createLinearGradient(0, 80, 0, H); robe.addColorStop(0, '#191624'); robe.addColorStop(.55, '#231c33'); robe.addColorStop(1, 'rgba(40,34,70,0)');
  g.fillStyle = robe;
  g.beginPath(); g.moveTo(W / 2, 30); g.bezierCurveTo(W / 2 + 120, 40, W / 2 + 96, 190, W / 2 + 112, 250);
  g.bezierCurveTo(W / 2 + 190, 420, W / 2 + 150, 600, W / 2 + 176, H); g.lineTo(W / 2 - 176, H);
  g.bezierCurveTo(W / 2 - 150, 600, W / 2 - 190, 420, W / 2 - 112, 250); g.bezierCurveTo(W / 2 - 96, 190, W / 2 - 120, 40, W / 2, 30); g.fill();
  g.strokeStyle = col; g.globalAlpha = .5; g.lineWidth = 4;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2 + s * 30, 250); g.bezierCurveTo(W / 2 + s * 60, 400, W / 2 + s * 40, 560, W / 2 + s * 90, 700); g.stroke(); }
  g.globalAlpha = 1;
  const face = g.createLinearGradient(0, 80, 0, 250); face.addColorStop(0, '#f1ead8'); face.addColorStop(1, '#b9af9a');
  g.fillStyle = face; g.beginPath(); g.moveTo(W / 2, 74); g.bezierCurveTo(W / 2 + 84, 74, W / 2 + 72, 196, W / 2, 248); g.bezierCurveTo(W / 2 - 72, 196, W / 2 - 84, 74, W / 2, 74); g.fill();
  g.fillStyle = '#0b090c';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(W / 2 + s * 30, 158, 16, 7, s * .2, 0, 7); g.fill(); }
  g.fillStyle = '#b3241a'; g.font = `bold 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name[0], W / 2, 116);
  if (boss) { g.strokeStyle = '#b3241a'; g.lineWidth = 6; g.beginPath(); g.moveTo(W / 2 - 60, 60); g.lineTo(W / 2 - 34, 22); g.lineTo(W / 2, 56); g.lineTo(W / 2 + 34, 22); g.lineTo(W / 2 + 60, 60); g.stroke(); }
  const tex = canvasTexture(c); tex.userData.aspect = W / H;
  facelessCache.set(key, tex);
  return tex;
}

const VERT = `uniform float uTime,uSeed,uDisperse,uSway;varying vec2 vUv;
void main(){vUv=uv;vec3 p=position;
  p.x+=sin(uTime*1.4+uv.y*3.2+uSeed)*.022*uv.y*uSway;
  p.y+=uDisperse*.5*uv.y;p.x*=1.+uDisperse*.35*uv.y;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const FRAG = `uniform sampler2D map,uNoise;uniform vec2 uTexel;uniform float uTime,uSeed,uOpacity,uTintAmt,uDisperse,uFlip,uFlash,uGhost;uniform vec3 uTint,uRim,uFlashColor;varying vec2 vUv;
void main(){vec2 uv=vUv;uv.x=mix(uv.x,1.-uv.x,uFlip);
  uv.x+=sin(uv.y*46.+uTime*2.6+uSeed)*.0022*uGhost;
  vec4 c=texture2D(map,uv);float a=c.a;
  vec2 o=uTexel*5.;
  float an=(texture2D(map,uv+vec2(o.x,0.)).a+texture2D(map,uv-vec2(o.x,0.)).a+texture2D(map,uv+vec2(0.,o.y)).a+texture2D(map,uv-vec2(0.,o.y)).a+texture2D(map,uv+o).a+texture2D(map,uv-o).a)/6.;
  float halo=clamp(an-a,0.,1.);
  float inner=clamp(a-an,0.,1.)*1.6+pow(1.-a,2.)*a;
  vec3 col=mix(c.rgb,c.rgb*.72+uTint*.34,uTintAmt);
  col+=uRim*inner*.6;
  col=mix(col,uRim*1.25,halo/(a+halo+.0001));
  float foot=smoothstep(.0,.2,vUv.y);
  float scan=.9+.1*sin(vUv.y*120.-uTime*5.+uSeed);
  float flick=.94+.06*sin(uTime*9.+uSeed*3.)*sin(uTime*2.3+uSeed);
  float n=texture2D(uNoise,vUv*vec2(1.2,1.8)+vec2(0.,-uDisperse*.5)).r;
  float dis=smoothstep(uDisperse*1.25-.25,uDisperse*1.25,n+.02);
  float alpha=(a+halo*.7)*foot*uOpacity*mix(1.,scan*flick,uGhost)*dis;
  col+=uRim*(1.-dis)*2.+uFlashColor*uFlash*a;
  gl_FragColor=vec4(col,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Apparition {
  constructor({ id, name = '鬼', type = '恶灵', side = 'enemy', boss = false, height }) {
    planeGeo ||= (() => { const g = new THREE.PlaneGeometry(1, 1, 1, 8); g.translate(0, .5, 0); return g; })();
    this.id = id; this.side = side; this.hasViews = hasViews(id);
    this.height = height || (side === 'ally' ? .86 : boss ? 1.5 : 1.22);
    this.group = new THREE.Group();
    this.billboard = new THREE.Group();
    this.group.add(this.billboard);
    const rim = side === 'ally' ? '#cfd8e6' : this.hasViews ? '#c4ccd8' : '#ff5a40';
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: null }, uNoise: { value: noiseTexture() }, uTexel: { value: new THREE.Vector2(1 / 400, 1 / 720) }, uTime, uSeed: { value: Math.random() * 50 },
        uOpacity: { value: 0 }, uTint: { value: new THREE.Color('#cfd8e6') }, uTintAmt: { value: .3 }, uRim: { value: new THREE.Color(rim) }, uDisperse: { value: 0 },
        uFlip: { value: 0 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color('#fff') }, uSway: { value: 1 }, uGhost: { value: 1 }
      },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    keeper ||= this.material;
    this.mesh = new THREE.Mesh(planeGeo, this.material);
    this.mesh.renderOrder = 6; this.mesh.userData.noPick = true;
    this.billboard.add(this.mesh);
    this.mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: side === 'ally' ? '#2a3040' : this.hasViews ? '#4a3236' : '#141312', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.mist.scale.set(1.1, .34, 1); this.mist.position.y = .06; this.mist.userData.noPick = true; this.mist.renderOrder = 5;
    this.group.add(this.mist);
    this.faceless = this.hasViews ? null : side === 'enemy' ? mistBody(name, boss) : facelessTexture(name, type, boss);
    if (!this.hasViews && side === 'enemy') {
      const u = this.material.uniforms; u.uTintAmt.value = 0; u.uRim.value.set('#3a3836'); u.uGhost.value = .5;
      const h = [...(name || '鬼')].reduce((v, c) => (v * 31 + c.charCodeAt(0)) >>> 0, 7);
      // 与黑影同一套烟雾着色的小烟柱，替代静态贴图
      this.mesh.visible = false;
      const bw = boss ? 1.25 : .95, bh = boss ? 1.7 : 1.3;
      this.smoke = createSmokeMesh({ w: bw, h: bh, shape: 3, seed: h % 97, renderOrder: 6, solid: 1, aspect: bh / bw });
      if (boss) this.smoke.uniforms.uDensity.value = 1.15;
      this.billboard.add(this.smoke.mesh);
      this.eyes = createEyePair({ color: EYE_COLORS[h % EYE_COLORS.length], size: boss ? .17 : .13, gap: 1.3, slant: .16 });
      this.eyes.group.position.set(0, bh * .64, .03);
      this.eyes.setIntensity(0);
      this.billboard.add(this.eyes.group);
    }
    this.baseOpacity = side === 'ally' ? .58 : .92;
    this.opacityTarget = this.baseOpacity; this.pose = null; this.lunge = 0;
    this.setPose(side === 'ally' ? 'back' : 'front');
    apparitions.add(this);
  }
  setPose(pose) {
    if (pose === this.pose) return;
    this.pose = pose;
    const tex = this.hasViews ? viewTexture(this.id, pose) : this.faceless, aspect = tex.userData.aspect || .5, img = tex.image;
    this.material.uniforms.map.value = tex;
    this.material.uniforms.uTexel.value.set(1 / (img?.width || 400), 1 / (img?.height || 720));
    this.mesh.scale.set(this.height * aspect, this.height, 1);
    this.material.uniforms.uFlip.value = pose === 'side' && this.side === 'ally' ? 1 : 0;
  }
  setOpacity(v) { this.opacityTarget = v; }
  resetOpacity() { this.opacityTarget = this.baseOpacity; }
  flash(color = '#ffffff', amount = 1, dur = 300) {
    const u = this.material.uniforms; u.uFlashColor.value.set(color); u.uFlash.value = amount; kill(u.uFlash);
    if (this.smoke) { this.smoke.uniforms.uTurb.value = .9; tween(this.smoke.uniforms.uTurb, { value: .35 }, { dur: dur * 1.6 }); }
    return tween(u.uFlash, { value: 0 }, { dur, ease: 'outQuad' });
  }
  appear(dur = 650) {
    const u = this.material.uniforms; u.uDisperse.value = 1; u.uOpacity.value = this.baseOpacity;
    return tween(u.uDisperse, { value: 0 }, { dur, ease: 'outCubic' });
  }
  disperse(dur = 750) {
    this.opacityTarget = -1;
    const u = this.material.uniforms;
    tween(this.mist.material, { opacity: 0 }, { dur: dur * .6 });
    if (this.smoke) { tween(this.smoke.uniforms.uBlow, { value: 1.4 }, { dur, ease: 'inQuad' }); tween(this.smoke.uniforms.uOpacity, { value: 0 }, { dur: dur * .8 }); }
    return tween(u.uDisperse, { value: 1 }, { dur, ease: 'inQuad' });
  }
  update(dt, t, camera) {
    const u = this.material.uniforms;
    if (this.opacityTarget >= 0) {
      u.uOpacity.value = damp(u.uOpacity.value, this.opacityTarget, 6, dt);
      this.mist.material.opacity = damp(this.mist.material.opacity, Math.min(.5, this.opacityTarget * .55), 4, dt);
    }
    if (this.smoke) { this.smoke.uniforms.uTime.value = t; this.smoke.uniforms.uOpacity.value = u.uOpacity.value; }
    this.group.getWorldPosition(tmp);
    this.billboard.rotation.y = Math.atan2(camera.position.x - tmp.x, camera.position.z - tmp.z);
    this.mesh.position.y = Math.sin(t * 1.2 + u.uSeed.value) * .025 + .03;
    if (this.eyes) this.eyes.setIntensity(Math.min(1, u.uOpacity.value) * 1.5 * (1 - u.uDisperse.value));
  }
  dispose() { apparitions.delete(this); this.group.removeFromParent(); this.eyes?.dispose(); if (this.material !== keeper) this.material.dispose(); this.mist.material.dispose(); }
}
const tmp = new THREE.Vector3();

export function updateApparitions(dt, t, camera) {
  uTime.value = t;
  for (const a of apparitions) a.update(dt, t, camera);
}
