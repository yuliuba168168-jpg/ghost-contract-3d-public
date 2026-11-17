import * as THREE from 'three';
import { tween, kill, damp } from '../core/tween.js';
import { pointer } from '../core/input.js';

export const POSES = {
  battle: { pos: [0, 5.0, 5.6], look: [0, .1, -.8], fov: 46 },
  enemy: { pos: [0, 4.5, 5.7], look: [0, .6, -1.6], fov: 45 },
  title: { pos: [0, 2.4, 12.5], look: [0, 1.6, -2], fov: 44 },
  inspect: { pos: [0, 4.2, 4.1], look: [0, .2, -.6], fov: 44 },
  map: { pos: [0, 5.4, 4.8], look: [0, .1, -.5], fov: 44 },
  shrine: { pos: [0, 3.2, 6.4], look: [0, 1.2, -3.6], fov: 42 },
  cards: { pos: [0, 12.5, 2.4], look: [0, 0, 0], fov: 46 },
  gallery: { pos: [0, 2.2, 9.5], look: [0, 1.5, 0], fov: 40 },
  read: { pos: [0, 4.5, 2.5], look: [0, 0, -.1], fov: 42 },
  screen: { pos: [0, 2.9, 5.6], look: [0, 2.0, -2.4], fov: 41 }
};

export function createCameraRig() {
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 120);
  const s = { px: 0, py: 5.0, pz: 5.6, lx: 0, ly: .1, lz: -.8, fov: 46, kick: 0 };
  const par = { x: 0, y: 0 }, shakeState = { amp: 0, t: 0 }, look = new THREE.Vector3();
  let current = 'battle';

  function set(name) {
    const p = POSES[name];
    current = name;
    Object.assign(s, { px: p.pos[0], py: p.pos[1], pz: p.pos[2], lx: p.look[0], ly: p.look[1], lz: p.look[2], fov: p.fov });
  }
  function goTo(name, { dur = 1100, ease = 'inOutCubic' } = {}) {
    const p = POSES[name];
    if (!p) return Promise.resolve();
    current = name;
    kill(s);
    return tween(s, { px: p.pos[0], py: p.pos[1], pz: p.pos[2], lx: p.look[0], ly: p.look[1], lz: p.look[2], fov: p.fov }, { dur, ease });
  }
  function shake(strength = .08, dur = 320) { if (globalThis.GC?.preferences?.reduceFlash) strength *= .3; shakeState.amp = Math.max(shakeState.amp, strength); shakeState.decay = strength / (dur / 1000); }
  function kick(delta = -2, dur = 260) { s.kick = delta; tween(s, { kick: 0 }, { dur, ease: 'outCubic' }); }

  function update(dt, t) {
    const aspect = innerWidth / innerHeight;
    let fov = s.fov + s.kick;
    if (aspect < 1.6) fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 1.6 / aspect));
    if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    par.x = damp(par.x, pointer.inside ? pointer.nx : 0, 3, dt);
    par.y = damp(par.y, pointer.inside ? pointer.ny : 0, 3, dt);
    const breathe = Math.sin(t * .55) * .018, drift = Math.sin(t * .31 + 1.3) * .014;
    let sx = 0, sy = 0;
    if (shakeState.amp > 0) {
      sx = (Math.random() - .5) * 2 * shakeState.amp; sy = (Math.random() - .5) * 2 * shakeState.amp;
      shakeState.amp = Math.max(0, shakeState.amp - (shakeState.decay || .3) * dt);
    }
    camera.position.set(s.px + par.x * .14 + drift + sx, s.py + breathe + par.y * .05 + sy, s.pz);
    look.set(s.lx + par.x * .06, s.ly + par.y * .04, s.lz);
    camera.lookAt(look);
  }
  return { camera, set, goTo, shake, kick, update, get pose() { return current; }, state: s };
}
