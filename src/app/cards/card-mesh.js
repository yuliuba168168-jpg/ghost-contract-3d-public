import * as THREE from 'three';
import { makeCanvas, canvasTexture, noiseTexture, cardGlowTexture, paperBump } from '../scene/textures.js';
import { CW, CH, drawUnitFace, drawSkillFace, unitDescriptor, unitFaceKey, cardBackCanvas, costBadgeCanvas } from './card-face.js';
import { tween, damp, kill } from '../core/tween.js';

export const CARD_W = 1, CARD_H = 1.45, CARD_T = .022;
const cards = new Set();
let geo = null, backTex = null;
const badgeTex = new Map();

function geometries() {
  if (geo) return geo;
  const w = CARD_W, h = CARD_H, r = .065, x = -w / 2, y = -h / 2, s = new THREE.Shape();
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const face = new THREE.ShapeGeometry(s, 5), uv = face.attributes.uv, p = face.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  const body = new THREE.ExtrudeGeometry(s, { depth: CARD_T, bevelEnabled: false, curveSegments: 5 });
  body.translate(0, 0, -CARD_T / 2);
  geo = { face, body, glow: new THREE.PlaneGeometry(CARD_W * 256 / 168, CARD_H * 352 / 264), badge: new THREE.PlaneGeometry(.36, .36) };
  return geo;
}
export function backTexture() { return backTex ||= canvasTexture(cardBackCanvas(), { aniso: 8 }); }

function cardMaterial(map, uniforms, emissive = .05) {
  const m = new THREE.MeshStandardMaterial({ map, color: '#d6d2ca', roughness: .8, metalness: 0, bumpMap: paperBump(), bumpScale: .9, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: Math.min(emissive, .035) });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDissolve,uDim,uFlash;uniform vec3 uBurn,uFlashColor;uniform sampler2D uNoise;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float gcN=texture2D(uNoise,vMapUv*vec2(.9,1.3)).r;
        if(uDissolve>0.&&gcN<uDissolve*1.1-.05)discard;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.3,.59,.11)))*.5,uDim);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance=mix(totalEmissiveRadiance,vec3(dot(totalEmissiveRadiance,vec3(.3,.59,.11)))*.45,uDim);
        float gcB=uDissolve>0.?smoothstep(uDissolve*1.1+.09,uDissolve*1.1-.05,gcN):0.;
        totalEmissiveRadiance+=uBurn*gcB*5.+uFlashColor*uFlash;`);
  };
  m.customProgramCacheKey = () => 'gc-card';
  return m;
}

const HIGHLIGHT = { playable: ['#d8c9a6', .42], selected: ['#ffcf8a', .6], target: ['#b8342a', .55], allyTarget: ['#c9d4e4', .5], hover: ['#e0d8c4', .38], acting: ['#ffcf8a', .5] };

export class Card3D {
  constructor({ emissive = .05 } = {}) {
    const G = geometries();
    this.group = new THREE.Group();
    this.uniforms = { uDissolve: { value: 0 }, uDim: { value: 0 }, uFlash: { value: 0 }, uBurn: { value: new THREE.Color('#cfd8e6') }, uFlashColor: { value: new THREE.Color('#ffffff') }, uNoise: { value: noiseTexture() } };
    const [canvas] = makeCanvas(CW, CH);
    this.canvas = canvas;
    this.texture = canvasTexture(canvas, { aniso: 8 });
    this.front = new THREE.Mesh(G.face, cardMaterial(this.texture, this.uniforms, emissive));
    this.front.position.z = CARD_T / 2 + .0012; this.front.receiveShadow = true;
    this.back = new THREE.Mesh(G.face, cardMaterial(backTexture(), this.uniforms, .04));
    this.back.rotation.y = Math.PI; this.back.position.z = -CARD_T / 2 - .0012;
    this.body = new THREE.Mesh(G.body, new THREE.MeshStandardMaterial({ color: '#7d725a', roughness: .95, bumpMap: paperBump(), bumpScale: 1.5 }));
    this.body.castShadow = true;
    this.glow = new THREE.Mesh(G.glow, new THREE.MeshBasicMaterial({ map: cardGlowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: '#d8c9a6' }));
    this.glow.position.z = -CARD_T / 2 + .004; this.glow.userData.noPick = true; this.glow.renderOrder = 2;
    this.badge = new THREE.Mesh(G.badge, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    this.badge.position.set(-CARD_W / 2 + .1, CARD_H / 2 - .1, CARD_T / 2 + .012); this.badge.visible = false; this.badge.userData.noPick = true; this.badge.renderOrder = 4;
    this.aura = new THREE.Mesh(G.glow, new THREE.MeshBasicMaterial({ map: cardGlowTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.aura.position.z = -CARD_T / 2 + .003; this.aura.scale.setScalar(1.09); this.aura.userData.noPick = true; this.aura.renderOrder = 1; this.aura.visible = false;
    this.shade = new THREE.Mesh(G.glow, new THREE.MeshBasicMaterial({ map: cardGlowTexture(), color: '#000000', transparent: true, opacity: 0, depthWrite: false }));
    this.shade.position.z = -CARD_T / 2 + .0035; this.shade.scale.setScalar(1.05); this.shade.userData.noPick = true; this.shade.renderOrder = 1; this.shade.visible = false;
    this.auraTarget = 0; this.shadeTarget = 0;
    this.group.add(this.body, this.front, this.back, this.glow, this.aura, this.shade, this.badge);
    this.key = ''; this.glowTarget = 0; this.highlight = null; this.dimTarget = 0; this.badgeKey = '';
    cards.add(this);
  }
  setUnit(unit) {
    const d = unitDescriptor(unit), key = unitFaceKey(d);
    this.kind = 'unit';
    if (key === this.key) return false;
    this.key = key; drawUnitFace(this.canvas, d); this.texture.needsUpdate = true;
    return true;
  }
  setSkill(id) {
    this.kind = 'skill';
    if (this.key === 'skill:' + id) return;
    this.key = 'skill:' + id; drawSkillFace(this.canvas, id); this.texture.needsUpdate = true;
  }
  setCost(cost, ok = true) {
    if (cost == null) { this.badge.visible = false; this.badgeKey = ''; return; }
    const key = cost + (ok ? 'y' : 'n');
    this.badge.visible = true;
    if (key === this.badgeKey) return;
    this.badgeKey = key;
    if (!badgeTex.has(key)) badgeTex.set(key, canvasTexture(costBadgeCanvas(cost, ok)));
    this.badge.material.map = badgeTex.get(key); this.badge.material.needsUpdate = true;
  }
  setHighlight(kind) {
    if (kind === this.highlight) return;
    this.highlight = kind;
    const h = HIGHLIGHT[kind];
    if (h) { this.glow.material.color.set(h[0]); this.glowTarget = h[1]; } else this.glowTarget = 0;
  }
  setDim(v) { this.dimTarget = v ? 1 : 0; }
  setAura(color, strength = .8) {
    if (color) { const c = this.aura.material.color.set(color), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s * .4, hsl.l * .85); this.auraTarget = strength * .55; } else this.auraTarget = 0;
  }
  setShade(v) { this.shadeTarget = v ? .95 : 0; }
  flash(color = '#ffffff', amount = .9, dur = 320) {
    this.uniforms.uFlashColor.value.set(color); this.uniforms.uFlash.value = amount;
    kill(this.uniforms.uFlash);
    return tween(this.uniforms.uFlash, { value: 0 }, { dur, ease: 'outQuad' });
  }
  dissolve(dur = 700, color = '#cfd8e6') {
    this.uniforms.uBurn.value.set(color);
    this.body.visible = false; this.glowTarget = 0; this.auraTarget = 0; this.shadeTarget = 0; this.badge.visible = false;
    return tween(this.uniforms.uDissolve, { value: 1 }, { dur, ease: 'inOutQuad' });
  }
  materialize(dur = 500, color = '#cfd8e6') {
    this.uniforms.uBurn.value.set(color); this.uniforms.uDissolve.value = 1; this.body.visible = false;
    return tween(this.uniforms.uDissolve, { value: 0 }, { dur, ease: 'outQuad' }).then(() => { this.body.visible = true; });
  }
  update(dt, t) {
    const m = this.glow.material, target = this.glowTarget * (this.highlight === 'playable' ? .75 + .25 * Math.sin(t * 2.6) : .85 + .15 * Math.sin(t * 5));
    m.opacity = damp(m.opacity, target, 10, dt);
    this.glow.visible = m.opacity > .01;
    this.uniforms.uDim.value = damp(this.uniforms.uDim.value, this.dimTarget, 10, dt);
    const am = this.aura.material; am.opacity = damp(am.opacity, this.auraTarget * (.7 + .3 * Math.sin(t * 2.1 + this.front.id)), 6, dt); this.aura.visible = am.opacity > .01;
    const sm = this.shade.material; sm.opacity = damp(sm.opacity, this.shadeTarget, 5, dt); this.shade.visible = sm.opacity > .01;
  }
  dispose() {
    cards.delete(this);
    this.group.removeFromParent();
    this.texture.dispose(); this.front.material.dispose(); this.back.material.dispose(); this.body.material.dispose(); this.glow.material.dispose(); this.badge.material.dispose(); this.aura.material.dispose(); this.shade.material.dispose();
  }
}

export function updateCards(dt, t) { for (const c of cards) c.update(dt, t); }
