import * as THREE from 'three';
import { glowTexture, makeCanvas, canvasTexture, noiseTexture } from '../scene/textures.js';
import { tween, wait } from '../core/tween.js';
import { view } from '../core/quality.js';

const CAP = 1400;
const END = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';

function slashTexture() {
  const [c, g] = makeCanvas(256, 64);
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.3, 'rgba(255,255,255,.9)'); gr.addColorStop(.7, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 34); g.quadraticCurveTo(128, -6, 256, 30); g.quadraticCurveTo(128, 22, 0, 34); g.fill();
  return canvasTexture(c);
}
function ringTexture() {
  const [c, g] = makeCanvas(256);
  const gr = g.createRadialGradient(128, 128, 70, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.72, 'rgba(255,255,255,.95)'); gr.addColorStop(.86, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return canvasTexture(c);
}

export function createParticles(scene) {
  const pos = new Float32Array(CAP * 3), col = new Float32Array(CAP * 3), size = new Float32Array(CAP), alpha = new Float32Array(CAP);
  const vel = new Float32Array(CAP * 3), life = new Float32Array(CAP), maxLife = new Float32Array(CAP), grav = new Float32Array(CAP), drag = new Float32Array(CAP), baseSize = new Float32Array(CAP);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { uScale: { value: innerHeight } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aColor;attribute float aSize,aAlpha;uniform float uScale;varying vec3 vC;varying float vA;void main(){vC=aColor;vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize*uScale*1.25/-mv.z;}',
    fragmentShader: `varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d);a*=a*vA;gl_FragColor=vec4(vC*a,a);${END}}`
  }));
  points.frustumCulled = false; points.renderOrder = 30; points.userData.noPick = true;
  scene.add(points);
  let cursor = 0;
  const c = new THREE.Color();
  const textures = { slash: slashTexture(), ring: ringTexture() };

  function emit(p, v, { color = '#ffffff', size: s = .08, life: l = .6, gravity = 0, drag: d = 1.5 } = {}) {
    const i = cursor; cursor = (cursor + 1) % CAP;
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z;
    c.set(color); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    life[i] = maxLife[i] = l * (.7 + Math.random() * .6); grav[i] = gravity; drag[i] = d; baseSize[i] = s * (.6 + Math.random() * .8);
  }
  const tv = new THREE.Vector3();
  function burst(p, { count = 18, color = '#ffffff', colors = null, speed = 1.6, life: l = .6, size: s = .08, gravity = -2.2, up = .6, spread = 1, drag: d = 1.6, flat = false } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, e = flat ? 0 : (Math.random() - .5) * Math.PI * spread, sp = speed * (.35 + Math.random() * .9);
      tv.set(Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + up * speed * Math.random(), Math.sin(a) * Math.cos(e) * sp);
      emit(p, tv, { color: colors ? colors[i % colors.length] : color, size: s, life: l, gravity, drag: d });
    }
  }
  function rise(p, { count = 14, color = '#9fb0ff', radius = .4, speed = .9, life: l = 1, size: s = .07 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * radius;
      tv.set((Math.random() - .5) * .2, speed * (.5 + Math.random()), (Math.random() - .5) * .2);
      emit({ x: p.x + Math.cos(a) * r, y: p.y + Math.random() * .2, z: p.z + Math.sin(a) * r }, tv, { color, size: s, life: l, gravity: .3, drag: .6 });
    }
  }

  const sprites = [];
  function glowSprite(color, scale = 1, opacity = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
    s.scale.setScalar(scale); s.renderOrder = 31; s.userData.noPick = true;
    scene.add(s);
    return s;
  }
  async function bolt(from, to, { color = '#9fb0ff', dur = 420, arc = .8, size: s = .5, trail = 3, side = 0, ease = 'inQuad' } = {}) {
    const head = glowSprite(color, s), state = { t: 0 }, mid = new THREE.Vector3().lerpVectors(from, to, .5);
    mid.y += arc; mid.x += side;
    const p = new THREE.Vector3(), prev = from.clone();
    sprites.push(head);
    await tween(state, { t: 1 }, {
      dur, ease, onUpdate: () => {
        const t = state.t, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, cc = t * t;
        p.set(a * from.x + b * mid.x + cc * to.x, a * from.y + b * mid.y + cc * to.y, a * from.z + b * mid.z + cc * to.z);
        head.position.copy(p);
        for (let i = 0; i < trail; i++) { tv.set((Math.random() - .5) * .3, (Math.random() - .5) * .3 + .1, (Math.random() - .5) * .3); emit(prev.clone().lerp(p, Math.random()), tv, { color, size: s * .16, life: .45, drag: 2 }); }
        prev.copy(p);
      }
    });
    head.removeFromParent(); head.material.dispose();
  }
  function flare(p, { color = '#ffffff', scale = 1.6, dur = 320, opacity = 1 } = {}) {
    const s = glowSprite(color, scale * .3, opacity); s.position.copy(p);
    tween(s.scale, { x: scale, y: scale }, { dur, ease: 'outCubic' });
    return tween(s.material, { opacity: 0 }, { dur, ease: 'inQuad' }).then(() => { s.removeFromParent(); s.material.dispose(); });
  }
  const flatGeo = new THREE.PlaneGeometry(1, 1);
  function ring(p, { color = '#ffffff', radius = 1.4, dur = 520, opacity = .9, y = .03, vertical = false } = {}) {
    const m = new THREE.Mesh(flatGeo, new THREE.MeshBasicMaterial({ map: textures.ring, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    if (!vertical) m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, vertical ? p.y : y, p.z); m.scale.setScalar(.2); m.renderOrder = 29; m.userData.noPick = true;
    scene.add(m);
    tween(m.scale, { x: radius * 2, y: radius * 2 }, { dur, ease: 'outCubic' });
    return tween(m.material, { opacity: 0 }, { dur, ease: 'inQuad' }).then(() => { m.removeFromParent(); m.material.dispose(); });
  }
  function slash(p, camera, { color = '#ffffff', length = 1.6, angle = -.6, dur = 260 } = {}) {
    const m = new THREE.Mesh(flatGeo, new THREE.MeshBasicMaterial({ map: textures.slash, color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    m.position.copy(p); m.quaternion.copy(camera.quaternion); m.rotateZ(angle); m.scale.set(length * .2, length * .22, 1); m.renderOrder = 32; m.userData.noPick = true;
    scene.add(m);
    tween(m.scale, { x: length }, { dur: dur * .5, ease: 'outExpo' });
    return tween(m.material, { opacity: 0 }, { dur, ease: 'inCubic' }).then(() => { m.removeFromParent(); m.material.dispose(); });
  }
  const pillarGeo = new THREE.CylinderGeometry(.5, .5, 1, 20, 1, true); pillarGeo.translate(0, .5, 0);
  const pillarPool = [];
  function pillar(p, { color = '#ffffff', radius = .5, height = 3, dur = 800, opacity = .7 } = {}) {
    // Pillar materials are pooled, never disposed: three keys custom shaders by a per-source id that is freed
    // with the last material using it, so disposing here would force a recompile on every cast.
    const mat = pillarPool.pop();
    if (mat) { mat.uniforms.uColor.value.set(color); mat.uniforms.uOpacity.value = opacity; mat.uniforms.uT.value = 0; }
    const m = new THREE.Mesh(pillarGeo, mat || new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uNoise: { value: noiseTexture() }, uT: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform vec3 uColor;uniform float uOpacity,uT;uniform sampler2D uNoise;varying vec2 vUv;void main(){float n=texture2D(uNoise,vec2(vUv.x*2.,vUv.y*.6-uT)).r;float a=pow(1.-vUv.y,1.6)*(.4+.9*n)*uOpacity;gl_FragColor=vec4(uColor*a,a);${END}}`
    }));
    m.position.set(p.x, .02, p.z); m.scale.set(radius * .4, height, radius * .4); m.renderOrder = 28; m.userData.noPick = true;
    scene.add(m);
    tween(m.scale, { x: radius * 2, z: radius * 2 }, { dur: dur * .4, ease: 'outCubic' });
    tween(m.material.uniforms.uT, { value: 1.2 }, { dur, ease: 'linear' });
    return tween(m.material.uniforms.uOpacity, { value: 0 }, { dur, ease: 'inCubic' }).then(() => { m.removeFromParent(); pillarPool.push(m.material); });
  }
  async function beam(from, to, { color = '#ffffff', width = .12, dur = 300 } = {}) {
    const m = new THREE.Mesh(flatGeo, new THREE.MeshBasicMaterial({ map: textures.slash, color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const d = new THREE.Vector3().subVectors(to, from), len = d.length();
    m.position.lerpVectors(from, to, .5); m.rotation.set(-Math.PI / 2, 0, 0);
    m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(-d.z, d.x); m.rotation.x = -Math.PI / 2;
    m.scale.set(len, width * 6, 1); m.renderOrder = 31; m.userData.noPick = true;
    scene.add(m);
    await tween(m.material, { opacity: 0 }, { dur, ease: 'inQuad' });
    m.removeFromParent(); m.material.dispose();
  }

  function update(dt) {
    points.material.uniforms.uScale.value = view.h;
    let any = false, alive = 0;
    for (let i = 0; i < CAP; i++) {
      if (life[i] <= 0) { if (alpha[i] !== 0 || size[i] !== 0) { alpha[i] = 0; size[i] = 0; any = true; } continue; }
      any = true; alive++;
      life[i] -= dt;
      const k = Math.max(0, 1 - drag[i] * dt), j = i * 3;
      vel[j] *= k; vel[j + 1] = vel[j + 1] * k + grav[i] * dt; vel[j + 2] *= k;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < .01 && grav[i] < 0) { pos[j + 1] = .01; vel[j + 1] *= -.35; }
      const t = Math.max(0, life[i] / maxLife[i]);
      alpha[i] = Math.min(1, t * 2.2); size[i] = baseSize[i] * (.4 + .6 * t);
    }
    points.visible = alive > 0;
    if (any) { geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true; }
  }
  return { emit, burst, rise, bolt, flare, ring, slash, pillar, beam, glowSprite, update, wait };
}
