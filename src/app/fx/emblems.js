import * as THREE from 'three';
import { makeCanvas, canvasTexture, FONT } from '../scene/textures.js';
import { tween, wait } from '../core/tween.js';

const S = 256, C = S / 2;
const ring = (g, r, w = 6, dash) => { g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); g.setLineDash([]); };
const glyph = (g, ch, size = 130) => { g.font = `bold ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 0, size * .06); };
const petal = (g, n, r0, r1, w) => { for (let i = 0; i < n; i++) { g.save(); g.rotate(i / n * Math.PI * 2); g.beginPath(); g.moveTo(0, -r0); g.quadraticCurveTo(w, -(r0 + r1) / 2, 0, -r1); g.quadraticCurveTo(-w, -(r0 + r1) / 2, 0, -r0); g.fill(); g.restore(); } };
const DRAW = {
  eye(g) { g.lineWidth = 9; g.beginPath(); g.moveTo(-116, 0); g.quadraticCurveTo(0, -92, 116, 0); g.quadraticCurveTo(0, 92, -116, 0); g.stroke(); g.beginPath(); g.arc(0, 0, 46, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(0, 0, 9, 40, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; for (let i = -3; i <= 3; i++) { g.lineWidth = 4; g.beginPath(); g.moveTo(i * 30, -64 + Math.abs(i) * 12); g.lineTo(i * 36, -96 + Math.abs(i) * 14); g.stroke(); } },
  wings(g) { for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(s * 10, 20); g.quadraticCurveTo(s * (60 + i * 12), -110 + i * 26, s * (120 - i * 6), -84 + i * 40); g.quadraticCurveTo(s * (70 - i * 4), -30 + i * 22, s * 10, 20); g.fill(); } },
  hand(g) { g.beginPath(); g.roundRect(-44, -10, 88, 96, 22); g.fill(); for (let i = 0; i < 4; i++) { g.beginPath(); g.roundRect(-44 + i * 23, -100 + Math.abs(i - 1.5) * 16, 19, 100, 9); g.fill(); } g.beginPath(); g.roundRect(-78, 6, 40, 22, 10); g.fill(); g.lineWidth = 5; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.beginPath(); g.moveTo(Math.cos(a) * 104, Math.sin(a) * 104); g.lineTo(Math.cos(a) * 122, Math.sin(a) * 122); g.stroke(); } },
  hex(g) { g.lineWidth = 9; for (const r of [112, 78]) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .52; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.stroke(); } g.globalAlpha = .28; g.fill(); g.globalAlpha = 1; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + .52; g.lineWidth = 5; g.beginPath(); g.moveTo(Math.cos(a) * 78, Math.sin(a) * 78); g.lineTo(Math.cos(a) * 112, Math.sin(a) * 112); g.stroke(); } },
  umbrella(g) { g.beginPath(); g.moveTo(-116, 4); g.quadraticCurveTo(0, -150, 116, 4); for (let i = 3; i >= -3; i--) g.quadraticCurveTo(i * 33 + 16, -18, i * 33 - 16.5, 4); g.fill(); g.lineWidth = 7; g.beginPath(); g.moveTo(0, -70); g.lineTo(0, 100); g.arc(-14, 100, 14, 0, Math.PI); g.stroke(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 3; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(0, -72); g.lineTo(i * 44, 2); g.stroke(); } g.globalCompositeOperation = 'source-over'; },
  yinyang(g) { g.beginPath(); g.arc(0, 0, 108, -Math.PI / 2, Math.PI / 2); g.arc(0, 54, 54, Math.PI / 2, -Math.PI / 2, true); g.arc(0, -54, 54, Math.PI / 2, -Math.PI / 2); g.fill(); ring(g, 110, 7); g.beginPath(); g.arc(0, 54, 15, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, -54, 15, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; },
  scroll(g) { g.fillRect(-92, -72, 184, 144); g.beginPath(); g.roundRect(-112, -86, 26, 172, 10); g.roundRect(86, -86, 26, 172, 10); g.fill(); g.globalCompositeOperation = 'destination-out'; glyph(g, '杀', 110); g.globalCompositeOperation = 'source-over'; },
  compass(g) { ring(g, 112, 7); ring(g, 86, 3, [4, 8]); ring(g, 44, 5); for (let i = 0; i < 24; i++) { g.save(); g.rotate(i / 24 * 6.28); g.fillRect(-2, -112, i % 6 ? 4 : 7, i % 6 ? 14 : 26); g.restore(); } g.beginPath(); g.moveTo(0, -80); g.lineTo(12, 0); g.lineTo(0, 80); g.lineTo(-12, 0); g.closePath(); g.fill(); },
  crown(g) { g.beginPath(); g.moveTo(-104, 60); g.lineTo(-116, -40); g.lineTo(-58, 10); g.lineTo(0, -84); g.lineTo(58, 10); g.lineTo(116, -40); g.lineTo(104, 60); g.closePath(); g.fill(); g.fillRect(-104, 70, 208, 18); for (const x of [-116, 0, 116]) { g.beginPath(); g.arc(x, x ? -48 : -92, 11, 0, 7); g.fill(); } },
  pyramid(g) { g.beginPath(); g.moveTo(0, -108); g.lineTo(118, 88); g.lineTo(-118, 88); g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 5; for (const y of [-40, 10, 54]) { g.beginPath(); g.moveTo(-120, y); g.lineTo(120, y); g.stroke(); } g.beginPath(); g.moveTo(0, -108); g.lineTo(26, 88); g.stroke(); g.beginPath(); g.arc(0, 26, 15, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; },
  clock(g) { ring(g, 110, 9); for (let i = 0; i < 12; i++) { g.save(); g.rotate(i / 12 * 6.28); g.fillRect(-3, -106, 6, i % 3 ? 14 : 28); g.restore(); } g.lineCap = 'round'; g.lineWidth = 9; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -74); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); g.lineTo(46, 22); g.stroke(); g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); },
  drop(g) { g.beginPath(); g.moveTo(0, -112); g.bezierCurveTo(84, -10, 78, 96, 0, 100); g.bezierCurveTo(-78, 96, -84, -10, 0, -112); g.fill(); g.globalCompositeOperation = 'destination-out'; g.lineWidth = 7; g.beginPath(); g.arc(0, 30, 44, .5, 2); g.stroke(); g.globalCompositeOperation = 'source-over'; },
  wave(g) { g.lineWidth = 11; g.lineCap = 'round'; for (let k = -2; k <= 2; k++) { g.globalAlpha = 1 - Math.abs(k) * .22; g.beginPath(); for (let x = -116; x <= 116; x += 8) g[x === -116 ? 'moveTo' : 'lineTo'](x, k * 38 + Math.sin(x / 26 + k) * 15); g.stroke(); } g.globalAlpha = 1; },
  banner(g) { g.fillRect(-84, -112, 9, 224); g.beginPath(); g.moveTo(-74, -106); g.lineTo(104, -86); g.lineTo(72, -34); g.lineTo(104, 18); g.lineTo(-74, 36); g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; g.translate(-2, -36); glyph(g, '酆', 92); g.globalCompositeOperation = 'source-over'; },
  gate(g) { g.fillRect(-116, -70, 34, 180); g.fillRect(82, -70, 34, 180); g.beginPath(); g.moveTo(-128, -70); g.quadraticCurveTo(0, -128, 128, -70); g.lineTo(128, -44); g.lineTo(-128, -44); g.closePath(); g.fill(); g.globalAlpha = .16; g.fillRect(-82, -44, 164, 154); g.globalAlpha = 1; g.globalCompositeOperation = 'destination-out'; g.fillRect(-3, -44, 6, 154); g.globalCompositeOperation = 'source-over'; g.translate(0, 26); glyph(g, '鬼', 88); },
  butterfly(g) { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -6); g.bezierCurveTo(s * 40, -120, s * 130, -90, s * 96, -14); g.bezierCurveTo(s * 80, 10, s * 30, 6, 0, -6); g.fill(); g.beginPath(); g.moveTo(0, 2); g.bezierCurveTo(s * 70, 14, s * 96, 96, s * 44, 92); g.bezierCurveTo(s * 20, 86, s * 8, 40, 0, 2); g.fill(); } g.fillRect(-4, -40, 8, 96); },
  moon(g) { g.beginPath(); g.arc(0, 0, 104, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(44, -24, 90, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; },
  lotus(g) { petal(g, 8, 18, 112, 40); g.globalAlpha = .6; g.rotate(Math.PI / 8); petal(g, 8, 10, 76, 30); g.globalAlpha = 1; g.beginPath(); g.arc(0, 0, 15, 0, 7); g.fill(); },
  snow(g) { g.lineWidth = 9; g.lineCap = 'round'; for (let i = 0; i < 6; i++) { g.save(); g.rotate(i / 6 * 6.28); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -110); g.moveTo(0, -64); g.lineTo(26, -90); g.moveTo(0, -64); g.lineTo(-26, -90); g.moveTo(0, -30); g.lineTo(16, -46); g.moveTo(0, -30); g.lineTo(-16, -46); g.stroke(); g.restore(); } },
  portal(g) { g.lineWidth = 8; for (const r of [112, 80, 48]) { g.beginPath(); g.moveTo(0, -r); g.lineTo(r * .66, 0); g.lineTo(0, r); g.lineTo(-r * .66, 0); g.closePath(); g.stroke(); } g.globalAlpha = .3; g.fill(); g.globalAlpha = 1; },
  wheel(g) { ring(g, 112, 9); ring(g, 30, 7); for (let i = 0; i < 6; i++) { g.save(); g.rotate(i / 6 * 6.28); g.fillRect(-4, -108, 8, 78); g.beginPath(); g.arc(0, -70, 13, 0, 7); g.fill(); g.restore(); } },
  flame(g) { g.beginPath(); g.moveTo(0, -116); g.bezierCurveTo(70, -40, 90, 40, 46, 92); g.bezierCurveTo(20, 116, -20, 116, -46, 92); g.bezierCurveTo(-96, 30, -30, -10, -36, -56); g.bezierCurveTo(-10, -40, -4, -76, 0, -116); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(4, 0); g.bezierCurveTo(40, 40, 30, 84, 0, 90); g.bezierCurveTo(-34, 80, -24, 34, 4, 0); g.fill(); g.globalCompositeOperation = 'source-over'; },
  ball(g) { ring(g, 92, 9); g.lineWidth = 5; for (let i = 0; i < 4; i++) { g.save(); g.rotate(i / 4 * Math.PI); g.beginPath(); g.ellipse(0, 0, 92, 34, 0, 0, 7); g.stroke(); g.restore(); } petal(g, 6, 0, 34, 15); g.fillRect(-4, 92, 8, 30); },
  heart(g) { g.beginPath(); g.moveTo(0, 96); g.bezierCurveTo(-150, -10, -76, -124, 0, -44); g.bezierCurveTo(76, -124, 150, -10, 0, 96); g.fill(); },
  arrow(g) { g.rotate(-.78); g.fillRect(-110, -5, 180, 10); g.beginPath(); g.moveTo(116, 0); g.lineTo(62, -28); g.lineTo(74, 0); g.lineTo(62, 28); g.closePath(); g.fill(); for (const x of [-110, -92]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 24, -24); g.lineTo(x - 6, 0); g.lineTo(x - 24, 24); g.closePath(); g.fill(); } },
  phoenix(g) { g.beginPath(); g.moveTo(-10, 10); g.bezierCurveTo(-60, -110, -124, -70, -120, -24); g.bezierCurveTo(-90, -50, -50, -30, -10, 10); g.fill(); g.beginPath(); g.moveTo(10, 10); g.bezierCurveTo(60, -110, 124, -70, 120, -24); g.bezierCurveTo(90, -50, 50, -30, 10, 10); g.fill(); g.beginPath(); g.ellipse(0, 6, 17, 34, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0, -36, 13, 0, 7); g.fill(); g.lineWidth = 7; g.lineCap = 'round'; for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(0, 36); g.quadraticCurveTo(s * 44, 80, s * 30, 118); g.stroke(); } },
  fox(g) { g.beginPath(); g.moveTo(0, 96); g.lineTo(-88, -6); g.lineTo(-104, -108); g.lineTo(-40, -58); g.lineTo(40, -58); g.lineTo(104, -108); g.lineTo(88, -6); g.closePath(); g.fill(); g.globalCompositeOperation = 'destination-out'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 20, 0); g.lineTo(s * 62, -22); g.lineTo(s * 50, 8); g.closePath(); g.fill(); } g.globalCompositeOperation = 'source-over'; },
  claw(g) { g.lineCap = 'round'; for (let i = -1; i <= 1; i++) { g.lineWidth = 20 - Math.abs(i) * 5; g.beginPath(); g.moveTo(i * 54 - 28, -108); g.quadraticCurveTo(i * 54 + 22, 0, i * 54 - 14, 108); g.stroke(); } },
  chain(g) { g.lineWidth = 9; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(i * 34, 0, 22, 13, i % 2 ? Math.PI / 2 : 0, 0, 7); g.stroke(); } },
  sword(g) { g.rotate(.78); g.beginPath(); g.moveTo(0, -122); g.lineTo(14, -96); g.lineTo(11, 40); g.lineTo(-11, 40); g.lineTo(-14, -96); g.closePath(); g.fill(); g.fillRect(-40, 40, 80, 11); g.fillRect(-6, 51, 12, 46); g.beginPath(); g.arc(0, 104, 11, 0, 7); g.fill(); },
  bridge(g) { g.lineWidth = 15; g.beginPath(); g.arc(0, 150, 170, Math.PI * 1.22, Math.PI * 1.78); g.stroke(); g.lineWidth = 5; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 30, 4 + Math.abs(i) * 7); g.lineTo(i * 30, -30 + Math.abs(i) * 7); g.stroke(); } g.beginPath(); g.arc(0, 150, 204, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); },
  skull(g) { g.beginPath(); g.arc(0, -16, 88, 0, 7); g.fill(); g.fillRect(-48, 44, 96, 50); g.globalCompositeOperation = 'destination-out'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 36, -14, 22, 27, 0, 0, 7); g.fill(); } g.beginPath(); g.moveTo(0, 16); g.lineTo(11, 40); g.lineTo(-11, 40); g.fill(); for (let i = -1; i <= 1; i++) g.fillRect(i * 24 - 2, 60, 4, 36); g.globalCompositeOperation = 'source-over'; }
};
const textures = new Map();
function texture(name) {
  if (textures.has(name)) return textures.get(name);
  const [c, g] = makeCanvas(S); g.translate(C, C); g.fillStyle = g.strokeStyle = '#fff'; g.lineJoin = 'round';
  if (DRAW[name]) DRAW[name](g); else { ring(g, 112, 6); ring(g, 96, 2, [5, 9]); glyph(g, name[0], 132); }
  const t = canvasTexture(c); textures.set(name, t); return t;
}

export function createEmblems(ctx) {
  const geo = new THREE.PlaneGeometry(1, 1), scene = ctx.scene, cam = ctx.rig.camera;
  function make(name, pos, { color = '#ffffff', size = 1.4, flat = false, opacity = 1, additive = true, aspect = 1 } = {}) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture(name), color, transparent: true, opacity: 0, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, depthTest: flat, side: THREE.DoubleSide }));
    m.position.copy(pos); m.renderOrder = flat ? 27 : 33; m.userData = { noPick: true, flat, size, aspect, opacity, spin: 0 };
    if (flat) { m.rotation.x = -Math.PI / 2; m.position.y = Math.max(.035, pos.y); } else m.quaternion.copy(cam.quaternion);
    m.scale.set(size * aspect * .2, size * .2, 1);
    scene.add(m);
    return m;
  }
  const open = (m, dur = 240, e = 'outBack') => { const u = m.userData; tween(m.material, { opacity: u.opacity }, { dur: dur * .7 }); return tween(m.scale, { x: u.size * u.aspect, y: u.size }, { dur, ease: e }); };
  const close = (m, dur = 320, grow = 1.25) => { const u = m.userData; tween(m.scale, { x: u.size * u.aspect * grow, y: u.size * grow }, { dur, ease: 'outQuad' }); return tween(m.material, { opacity: 0 }, { dur, ease: 'inQuad' }).then(() => { m.removeFromParent(); m.material.dispose(); }); };
  const spin = (m, turns, dur) => m.userData.flat ? tween(m.rotation, { z: m.rotation.z + turns * 6.283 }, { dur, ease: 'inOutQuad' }) : (() => { const s = { a: 0 }; let last = 0; return tween(s, { a: turns * 6.283 }, { dur, ease: 'inOutQuad', onUpdate: () => { m.rotateZ(s.a - last); last = s.a; } }); })();
  const move = (m, to, dur, e = 'inOutCubic') => tween(m.position, { x: to.x, y: m.userData.flat ? Math.max(.035, to.y) : to.y, z: to.z }, { dur, ease: e });
  async function show(name, pos, o = {}) {
    const m = make(name, pos, o), dur = o.dur || 900, jobs = [];
    await open(m, Math.min(260, dur * .3), o.ease);
    if (o.spin) jobs.push(spin(m, o.spin, dur * .55));
    if (o.to) jobs.push(move(m, o.to, dur * .5, o.moveEase));
    jobs.push(wait(dur * .5));
    await Promise.all(jobs);
    await close(m, dur * .25, o.grow ?? 1.25);
  }
  return { make, open, close, spin, move, show, texture };
}
