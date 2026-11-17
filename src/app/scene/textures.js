import * as THREE from 'three';
import { mulberry } from '../core/tween.js';

export const PALETTE = {
  void: '#050506', fog: '#0b0b0c', candle: '#ff9a3c', moon: '#8ea0c0', cinnabar: '#b0231a',
  bone: '#e0d8c4', paper: '#cbbf9f', spirit: '#aeb9cc', spiritEdge: '#55607a', ally: '#d8dde6', gold: '#e6c88a'
};
export const FONT = '"STKaiti","KaiTi","Kaiti SC","Noto Serif CJK SC","Songti SC","SimSun",serif';

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function canvasTexture(canvas, { srgb = true, repeat = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

const cache = new Map();
function once(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export function noiseTexture() {
  return once('noise', () => {
    const size = 256, [c, g] = makeCanvas(size), img = g.createImageData(size, size), rnd = mulberry(77);
    const octave = cells => {
      const grid = Array.from({ length: cells * cells }, () => rnd());
      return (x, y) => {
        const fx = x / size * cells, fy = y / size * cells, x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const at = (i, j) => grid[((j + cells) % cells) * cells + ((i + cells) % cells)];
        const a = at(x0, y0), b = at(x0 + 1, y0), d = at(x0, y0 + 1), e = at(x0 + 1, y0 + 1);
        return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy;
      };
    };
    const o = [octave(4), octave(8), octave(16), octave(32)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = o[0](x, y) * .5 + o[1](x, y) * .27 + o[2](x, y) * .15 + o[3](x, y) * .08, i = (y * size + x) * 4;
      const w = o[1](x + 91, y + 37) * .6 + o[2](x + 13, y + 59) * .4;
      img.data[i] = v * 255; img.data[i + 1] = w * 255; img.data[i + 2] = o[3](x, y) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvasTexture(c, { srgb: false, repeat: true, aniso: 1 });
  });
}

export function woodTextures(key, { base = '#2b1810', tone = '#4a2a1a', planks = 0, seed = 5, wear = 1, wax = 0 } = {}) {
  return once('wood:' + key, () => {
    const S = 1024, [mc, m] = makeCanvas(S), [bc, b] = makeCanvas(S), rnd = mulberry(seed);
    m.fillStyle = base; m.fillRect(0, 0, S, S);
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    const grad = m.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, 'rgba(90,48,26,.28)'); grad.addColorStop(.5, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(8,4,6,.45)');
    m.fillStyle = grad; m.fillRect(0, 0, S, S);
    for (let i = 0; i < 1300; i++) {
      const y = rnd() * S, amp = 2 + rnd() * 9, freq = .004 + rnd() * .01, ph = rnd() * 9, light = rnd() > .55;
      const a = .03 + rnd() * .09;
      m.strokeStyle = light ? `rgba(150,92,52,${a})` : `rgba(6,3,2,${a * 1.6})`;
      b.strokeStyle = light ? `rgba(255,255,255,${a * 1.5})` : `rgba(0,0,0,${a * 2.2})`;
      m.lineWidth = b.lineWidth = .6 + rnd() * 1.8;
      m.beginPath(); b.beginPath();
      for (let x = -10; x <= S + 10; x += 24) {
        const yy = y + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph * 2) * amp * .25;
        if (x < 0) { m.moveTo(x, yy); b.moveTo(x, yy); } else { m.lineTo(x, yy); b.lineTo(x, yy); }
      }
      m.stroke(); b.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const x = rnd() * S, y = rnd() * S, r = 12 + rnd() * 26;
      for (let k = 6; k > 0; k--) {
        m.strokeStyle = `rgba(8,4,2,${.12 + rnd() * .1})`; m.lineWidth = 1.5;
        m.beginPath(); m.ellipse(x, y, r * k / 3, r * k / 7, 0, 0, 7); m.stroke();
        b.strokeStyle = 'rgba(0,0,0,.18)'; b.lineWidth = 1.5;
        b.beginPath(); b.ellipse(x, y, r * k / 3, r * k / 7, 0, 0, 7); b.stroke();
      }
    }
    if (planks) for (let i = 0; i <= planks; i++) {
      const y = i * S / planks;
      m.fillStyle = 'rgba(0,0,0,.75)'; m.fillRect(0, y - 2, S, 4);
      b.fillStyle = 'rgba(0,0,0,.9)'; b.fillRect(0, y - 3, S, 6);
      for (let k = 0; k < 2; k++) { const x = rnd() * S; m.fillRect(x, y, 3, S / planks); b.fillRect(x - 1, y, 5, S / planks); }
    }
    for (let i = 0; i < 90 * wear; i++) {
      const x = rnd() * S, y = rnd() * S, len = 20 + rnd() * 160, ang = rnd() * Math.PI, a = .05 + rnd() * .12;
      m.strokeStyle = `rgba(190,150,110,${a})`; m.lineWidth = .7;
      m.beginPath(); m.moveTo(x, y); m.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); m.stroke();
      b.strokeStyle = `rgba(0,0,0,${a * 2.5})`; b.lineWidth = 1;
      b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); b.stroke();
    }
    for (let i = 0; i < 14 * wear; i++) {
      const x = rnd() * S, y = rnd() * S, r = 20 + rnd() * 70, g2 = m.createRadialGradient(x, y, 0, x, y, r);
      const dark = rnd() > .4;
      g2.addColorStop(0, dark ? 'rgba(4,2,3,.5)' : 'rgba(214,196,160,.13)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g2; m.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const tint = m.createLinearGradient(0, 0, S, 0);
    tint.addColorStop(0, 'rgba(0,0,0,.25)'); tint.addColorStop(.5, tone + '22'); tint.addColorStop(1, 'rgba(0,0,0,.25)');
    m.fillStyle = tint; m.fillRect(0, 0, S, S);
    for (let i = 0; i < wax; i++) {
      const x = rnd() * S, y = rnd() * S, r = 5 + rnd() * 16, gw = m.createRadialGradient(x, y, 0, x, y, r);
      gw.addColorStop(0, 'rgba(206,190,150,.6)'); gw.addColorStop(.8, 'rgba(180,160,120,.4)'); gw.addColorStop(1, 'rgba(180,160,120,0)');
      m.fillStyle = gw; m.beginPath(); m.ellipse(x, y, r, r * (.6 + rnd() * .5), rnd() * 3, 0, 7); m.fill();
      b.fillStyle = 'rgba(255,255,255,.35)'; b.beginPath(); b.ellipse(x, y, r * .9, r * .6, rnd() * 3, 0, 7); b.fill();
    }
    for (let i = 0; i < Math.ceil(wax / 5); i++) {
      const x = rnd() * S, y = rnd() * S, r = 26 + rnd() * 40;
      m.strokeStyle = 'rgba(10,6,4,.22)'; m.lineWidth = 3; m.beginPath(); m.ellipse(x, y, r, r * .95, 0, 0, 6.2); m.stroke();
    }
    return { map: canvasTexture(mc, { repeat: true, aniso: 8 }), bump: canvasTexture(bc, { srgb: false, repeat: true, aniso: 8 }), normal: normalFromHeight(bc, 2.4), rough: roughFromHeight(bc, .6, .3) };
  });
}

export function glowTexture() {
  return once('glow', () => {
    const [c, g] = makeCanvas(128), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(.6, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return canvasTexture(c);
  });
}

export function flameTexture() {
  return once('flame', () => {
    const [c, g] = makeCanvas(64, 128);
    g.translate(32, 100); g.scale(1, 2.6);
    const r = g.createRadialGradient(0, 0, 0, 0, -8, 30);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.22, 'rgba(255,255,255,.9)'); r.addColorStop(.55, 'rgba(255,255,255,.3)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.beginPath(); g.ellipse(0, -8, 22, 30, 0, 0, 7); g.fill();
    return canvasTexture(c);
  });
}

export function smokeTexture() {
  return once('smoke', () => {
    const [c, g] = makeCanvas(128), rnd = mulberry(9);
    for (let i = 0; i < 26; i++) {
      const x = 64 + (rnd() - .5) * 60, y = 64 + (rnd() - .5) * 60, r = 16 + rnd() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    return canvasTexture(c);
  });
}

const RUNE_STROKES = '敕令镇魂契引冥灵封禁';
export function runeCircleTexture(index = 0) {
  return once('rune:' + index, () => {
    const S = 512, [c, g] = makeCanvas(S), rnd = mulberry(100 + index * 7);
    g.translate(S / 2, S / 2);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
    const ring = (r, w, dash) => { g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); g.setLineDash([]); };
    ring(236, 5); ring(214, 2, [3, 9]); ring(150, 3); ring(132, 1.5, [14, 6]);
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2, r0 = 222, r1 = i % 3 ? 230 : 240;
      g.lineWidth = i % 3 ? 1.5 : 3; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke();
    }
    g.font = `34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + index;
      g.save(); g.rotate(a); g.translate(0, -183); g.globalAlpha = .55 + rnd() * .45;
      g.fillText(RUNE_STROKES[(i + index * 3) % RUNE_STROKES.length], 0, 0); g.restore();
    }
    g.globalAlpha = 1; g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; g.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); g.lineTo(Math.cos(a) * 128, Math.sin(a) * 128); }
    g.stroke();
    g.font = `92px ${FONT}`; g.globalAlpha = .85;
    g.fillText('壹贰叁肆'[index % 4], 0, 6);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) { g.globalAlpha = rnd() * .6; g.beginPath(); g.arc((rnd() - .5) * S, (rnd() - .5) * S, 1 + rnd() * 7, 0, 7); g.fill(); }
    return canvasTexture(c);
  });
}

export function talismanTexture(index = 0) {
  return once('talisman:' + index, () => {
    const [c, g] = makeCanvas(96, 256), rnd = mulberry(40 + index);
    g.fillStyle = '#c9b06a'; g.fillRect(0, 0, 96, 256);
    const sh = g.createLinearGradient(0, 0, 96, 256); sh.addColorStop(0, 'rgba(255,240,190,.25)'); sh.addColorStop(1, 'rgba(40,20,0,.45)');
    g.fillStyle = sh; g.fillRect(0, 0, 96, 256);
    g.strokeStyle = '#a3170f'; g.fillStyle = '#a3170f'; g.lineWidth = 4; g.lineCap = 'round';
    g.font = `40px ${FONT}`; g.textAlign = 'center';
    g.fillText('敕', 48, 44);
    g.beginPath(); g.moveTo(48, 54);
    for (let y = 60; y < 236; y += 16) g.quadraticCurveTo(48 + (rnd() - .5) * 96, y + 8, 48 + (rnd() - .5) * 30, y + 16);
    g.stroke();
    g.lineWidth = 2; g.strokeRect(8, 8, 80, 240);
    return canvasTexture(c);
  });
}

export function paperTexture() {
  return once('paper', () => {
    const S = 256, [c, g] = makeCanvas(S), rnd = mulberry(3);
    g.fillStyle = '#d9cfb4'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() > .5 ? '90,70,40' : '255,250,235'},${rnd() * .08})`; g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 3, 1 + rnd() * 2); }
    return canvasTexture(c, { repeat: true });
  });
}

export function coinTexture() {
  return once('coin', () => {
    const [c, g] = makeCanvas(128);
    g.fillStyle = '#e6dcc0'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.fillRect(48, 48, 32, 32);
    g.globalCompositeOperation = 'source-over'; g.strokeStyle = 'rgba(120,90,50,.6)'; g.lineWidth = 3;
    g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); g.strokeRect(44, 44, 40, 40);
    return canvasTexture(c);
  });
}

export function cardGlowTexture() {
  return once('cardGlow', () => {
    const W = 256, H = 352, [c, g] = makeCanvas(W, H), pad = 44, r = 20;
    g.shadowColor = '#fff'; g.shadowBlur = 30; g.strokeStyle = '#fff'; g.lineWidth = 10;
    for (let i = 0; i < 2; i++) { g.beginPath(); g.roundRect(pad, pad, W - pad * 2, H - pad * 2, r); g.stroke(); }
    return canvasTexture(c);
  });
}

export function ashTexture() {
  return once('ash', () => {
    const [c, g] = makeCanvas(1024, 64), rnd = mulberry(21);
    for (let i = 0; i < 5200; i++) {
      const x = rnd() * 1024, spread = Math.pow(rnd(), 2.2) * 30 * (rnd() > .5 ? 1 : -1), y = 32 + spread;
      g.fillStyle = `rgba(226,220,205,${.08 + rnd() * .5})`;
      g.fillRect(x, y, 1 + rnd() * 2.4, 1 + rnd() * 2);
    }
    return canvasTexture(c);
  });
}

export function tabletTexture() {
  return once('tablet', () => {
    const [c, g] = makeCanvas(256, 256), rnd = mulberry(12);
    g.fillStyle = '#1a1210'; g.fillRect(0, 0, 256, 256);
    g.font = `22px ${FONT}`; g.textAlign = 'center';
    const chars = '林陈王李赵周吴郑冯卫蒋沈韩杨朱秦';
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      const x = 16 + i * 32, y0 = j * 128;
      g.fillStyle = '#241815'; g.fillRect(x - 12, y0 + 6, 24, 116);
      g.fillStyle = `rgba(190,150,96,${.25 + rnd() * .4})`;
      for (let k = 0; k < 4; k++) g.fillText(chars[Math.floor(rnd() * chars.length)], x, y0 + 34 + k * 24);
    }
    return canvasTexture(c);
  });
}

export function lanternTexture() {
  return once('lantern', () => {
    const [c, g] = makeCanvas(256, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#b9b1a0'); gr.addColorStop(.5, '#efe7d2'); gr.addColorStop(1, '#a89f8c');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(60,40,30,.35)'; g.lineWidth = 2;
    for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * 256 / 12, 0); g.lineTo(i * 256 / 12, 256); g.stroke(); }
    g.fillStyle = '#7d120c'; g.font = `110px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('奠', 64, 132); g.fillText('灵', 192, 132);
    return canvasTexture(c);
  });
}

// ───────── 写实化：程序化 PBR（高度图 → 法线 / 粗糙度） ─────────
export function normalFromHeight(src, strength = 2, { srgb = false } = {}) {
  const w = src.width, h = src.height, [c, g] = makeCanvas(w, h);
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data, out = g.createImageData(w, h), od = out.data;
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, inv = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    od[i] = (-dx * inv * .5 + .5) * 255; od[i + 1] = (dy * inv * .5 + .5) * 255; od[i + 2] = (inv * .5 + .5) * 255; od[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return canvasTexture(c, { srgb, repeat: true, aniso: 8 });
}
export function roughFromHeight(src, base = .6, amp = .3, { invert = false } = {}) {
  const w = src.width, h = src.height, [c, g] = makeCanvas(w, h);
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data, out = g.createImageData(w, h), od = out.data;
  for (let i = 0; i < w * h; i++) {
    const v = sd[i * 4] / 255 - .5, r = Math.max(.12, Math.min(1, base + (invert ? -v : v) * amp * 2)) * 255;
    od[i * 4] = od[i * 4 + 1] = od[i * 4 + 2] = r; od[i * 4 + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return canvasTexture(c, { srgb: false, repeat: true, aniso: 8 });
}

function blotch(g, rnd, W, H, n, color, rmin, rmax, a) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H, r = rmin + rnd() * (rmax - rmin), gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color.replace('A', (a * (.4 + rnd() * .6)).toFixed(3))); gr.addColorStop(1, color.replace('A', '0'));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function crack(g, rnd, x, y, len, w, color) {
  g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
  let a = rnd() * 6.28;
  for (let i = 0; i < len; i++) { a += (rnd() - .5) * .9; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); }
  g.stroke();
}

// 旧灰泥墙：水渍、烟熏上沿、剥落露出青砖、裂缝
export function plasterTextures(key, { base = '#2d2a27', seed = 7, repeat = [2, 1] } = {}) {
  return once('plaster:' + key, () => {
    const S = 1024, [mc, m] = makeCanvas(S), [hc, h] = makeCanvas(S), rnd = mulberry(seed);
    m.fillStyle = base; m.fillRect(0, 0, S, S); h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
    blotch(m, rnd, S, S, 160, 'rgba(120,110,98,A)', 20, 120, .1);
    blotch(m, rnd, S, S, 120, 'rgba(8,6,5,A)', 20, 140, .22);
    for (let i = 0; i < 4000; i++) { const x = rnd() * S, y = rnd() * S, v = rnd() > .5; m.fillStyle = v ? 'rgba(200,190,170,.05)' : 'rgba(0,0,0,.08)'; m.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2); h.fillStyle = v ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)'; h.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 22; i++) {
      const x = rnd() * S, len = 120 + rnd() * 520, w = 6 + rnd() * 26, gr = m.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, 'rgba(24,16,10,.34)'); gr.addColorStop(1, 'rgba(24,16,10,0)');
      m.save(); m.translate(x, 0); m.fillStyle = gr; m.fillRect(-w / 2, 0, w, len); m.restore();
    }
    const soot = m.createLinearGradient(0, 0, 0, S * .4); soot.addColorStop(0, 'rgba(2,2,2,.7)'); soot.addColorStop(1, 'rgba(2,2,2,0)');
    m.fillStyle = soot; m.fillRect(0, 0, S, S * .4);
    for (let p = 0; p < 5; p++) {
      const cx = rnd() * S, cy = S * .35 + rnd() * S * .6, rx = 50 + rnd() * 90, ry = 40 + rnd() * 70, pts = [];
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, rr = .7 + rnd() * .5; pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]); }
      const path = ctx => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
      m.save(); path(m); m.clip(); h.save(); path(h); h.clip();
      m.fillStyle = '#26211f'; m.fillRect(0, 0, S, S); h.fillStyle = '#5a5a5a'; h.fillRect(0, 0, S, S);
      const bh = 22, bw = 54;
      for (let r = 0; r * bh < S; r++) for (let c = -1; c * bw < S; c++) {
        const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh, tone = 44 + rnd() * 26;
        m.fillStyle = `rgb(${tone + 14},${tone - 4},${tone - 10})`; m.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        h.fillStyle = `rgb(${128 + rnd() * 40},0,0)`; h.fillStyle = `rgb(${120 + rnd() * 36},${120 + rnd() * 36},${120 + rnd() * 36})`; h.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
      m.restore(); h.restore();
      m.strokeStyle = 'rgba(0,0,0,.5)'; m.lineWidth = 3; path(m); m.stroke(); h.strokeStyle = '#d0d0d0'; h.lineWidth = 4; path(h); h.stroke();
    }
    for (let i = 0; i < 9; i++) { const x = rnd() * S, y = rnd() * S; crack(m, rnd, x, y, 20 + rnd() * 40, 1.1, 'rgba(0,0,0,.6)'); crack(h, rnd, x, y, 20 + rnd() * 40, 2, 'rgba(0,0,0,.7)'); }
    const map = canvasTexture(mc, { repeat: true, aniso: 8 });
    const normal = normalFromHeight(hc, 3.2), rough = roughFromHeight(hc, .92, .18);
    for (const t of [map, normal, rough]) t.repeat.set(...repeat);
    return { map, normal, rough };
  });
}

// 金属：氧化发暗、局部磨亮，铜绿与烟垢
export function metalTextures(key, { base = '#7a5c36', patina = '#3f5f52', seed = 3, amount = 1 } = {}) {
  return once('metal:' + key, () => {
    const S = 512, [mc, m] = makeCanvas(S), [hc, h] = makeCanvas(S), [rc, r] = makeCanvas(S), rnd = mulberry(seed);
    m.fillStyle = base; m.fillRect(0, 0, S, S); h.fillStyle = '#808080'; h.fillRect(0, 0, S, S); r.fillStyle = '#6e6e6e'; r.fillRect(0, 0, S, S);
    blotch(m, rnd, S, S, 60, 'rgba(10,8,6,A)', 20, 90, .5 * amount);
    blotch(r, rnd, S, S, 60, 'rgba(255,255,255,A)', 20, 90, .5 * amount);
    for (let i = 0; i < 40 * amount; i++) {
      const x = rnd() * S, y = rnd() * S, rad = 8 + rnd() * 40, gr = m.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, hexA(patina, .55)); gr.addColorStop(1, hexA(patina, 0)); m.fillStyle = gr; m.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      r.fillStyle = 'rgba(255,255,255,.18)'; r.beginPath(); r.arc(x, y, rad * .6, 0, 7); r.fill();
    }
    blotch(r, rnd, S, S, 30, 'rgba(0,0,0,A)', 14, 60, .5);
    for (let i = 0; i < 1500; i++) { const x = rnd() * S, y = rnd() * S; h.fillStyle = rnd() > .5 ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.14)'; h.fillRect(x, y, 1 + rnd() * 3, 1); }
    for (let i = 0; i < 40; i++) { const x = rnd() * S, y = rnd() * S, a = rnd() * 6.28, len = 10 + rnd() * 60; h.strokeStyle = 'rgba(0,0,0,.3)'; h.lineWidth = 1; h.beginPath(); h.moveTo(x, y); h.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); h.stroke(); }
    const map = canvasTexture(mc, { repeat: true, aniso: 8 }), rough = canvasTexture(rc, { srgb: false, repeat: true, aniso: 8 });
    return { map, normal: normalFromHeight(hc, 2.2), rough };
  });
}
function hexA(hex, a) { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; }

// 粗陶：釉面开片裂纹
export function clayTextures(key = 'clay', { base = '#2c2521', seed = 17 } = {}) {
  return once('clay:' + key, () => {
    const S = 512, [mc, m] = makeCanvas(S), [hc, h] = makeCanvas(S), [rc, r] = makeCanvas(S), rnd = mulberry(seed);
    m.fillStyle = base; m.fillRect(0, 0, S, S); h.fillStyle = '#808080'; h.fillRect(0, 0, S, S); r.fillStyle = '#8c8c8c'; r.fillRect(0, 0, S, S);
    blotch(m, rnd, S, S, 70, 'rgba(0,0,0,A)', 20, 80, .35); blotch(m, rnd, S, S, 50, 'rgba(120,98,70,A)', 20, 80, .18);
    for (let i = 0; i < 160; i++) { const x = rnd() * S, y = rnd() * S; crack(m, rnd, x, y, 3 + rnd() * 10, .8, 'rgba(0,0,0,.45)'); crack(h, rnd, x, y, 3 + rnd() * 10, 1.4, 'rgba(0,0,0,.45)'); }
    for (let i = 0; i < 2500; i++) { h.fillStyle = rnd() > .5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.1)'; h.fillRect(rnd() * S, rnd() * S, 2, 2); }
    blotch(r, rnd, S, S, 50, 'rgba(0,0,0,A)', 20, 70, .5);
    return { map: canvasTexture(mc, { repeat: true, aniso: 8 }), normal: normalFromHeight(hc, 1.6), rough: canvasTexture(rc, { srgb: false, repeat: true, aniso: 8 }) };
  });
}

// 旧纸纤维（牌面/符纸的凹凸）
export function paperBump() {
  return once('paperBump', () => {
    const S = 512, [c, g] = makeCanvas(S), rnd = mulberry(55);
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { const x = rnd() * S, y = rnd() * S, a = rnd() * 6.28, len = 6 + rnd() * 22; g.strokeStyle = rnd() > .5 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.14)'; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); }
    for (let i = 0; i < 3; i++) { const y = rnd() * S; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + (rnd() - .5) * 40); g.stroke(); }
    return canvasTexture(c, { srgb: false, repeat: true, aniso: 4 });
  });
}

// 蜡烛：发光渐变（靠近火焰处透暖色）
export function waxEmissive() {
  return once('waxEmissive', () => {
    const [c, g] = makeCanvas(8, 128), gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#ffb060'); gr.addColorStop(.08, '#8a3a10'); gr.addColorStop(.3, '#000'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
    return canvasTexture(c);
  });
}

// 白纸窗：窗纸纤维 + 旧手印
export function windowPaperTexture() {
  return once('windowPaper', () => {
    const S = 512, [c, g] = makeCanvas(S, S), rnd = mulberry(88);
    g.fillStyle = '#9aa4b2'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rnd() > .5 ? '255,255,255' : '40,50,70'},${rnd() * .07})`; g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 4, 1 + rnd() * 2); }
    blotch(g, rnd, S, S, 14, 'rgba(60,50,30,A)', 30, 100, .22);
    g.save(); g.translate(S * .62, S * .58); g.rotate(-.3); g.fillStyle = 'rgba(30,24,20,.34)';
    g.beginPath(); g.ellipse(0, 20, 38, 46, 0, 0, 7); g.fill();
    for (const [x, len, a] of [[-30, 56, -.28], [-12, 70, -.08], [8, 74, .06], [28, 62, .24], [-52, 40, -.9]]) { g.save(); g.translate(x, -10); g.rotate(a); g.beginPath(); g.ellipse(0, -len / 2, 8, len / 2, 0, 0, 7); g.fill(); g.restore(); }
    g.restore();
    const f = g.createRadialGradient(S / 2, S / 2, S * .1, S / 2, S / 2, S * .7); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = f; g.fillRect(0, 0, S, S);
    return canvasTexture(c);
  });
}

// 被烧掉脸的旧遗像
export function portraitTexture() {
  return once('portrait', () => {
    const W = 256, H = 340, [c, g] = makeCanvas(W, H), rnd = mulberry(5);
    g.fillStyle = '#b8ab8c'; g.fillRect(0, 0, W, H);
    blotch(g, rnd, W, H, 20, 'rgba(70,50,24,A)', 20, 90, .35);
    g.fillStyle = '#2a2622'; g.fillRect(24, 24, W - 48, H - 48);
    const bg = g.createLinearGradient(0, 24, 0, H - 24); bg.addColorStop(0, '#4a443c'); bg.addColorStop(1, '#2c2924'); g.fillStyle = bg; g.fillRect(28, 28, W - 56, H - 56);
    g.fillStyle = '#16130f'; g.beginPath(); g.ellipse(W / 2, 140, 52, 64, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(40, H - 28); g.quadraticCurveTo(W / 2, 190, W - 40, H - 28); g.fill();
    g.fillStyle = '#6a6256'; g.beginPath(); g.ellipse(W / 2, 140, 40, 52, 0, 0, 7); g.fill();
    g.save(); g.beginPath(); g.ellipse(W / 2, 138, 44, 56, 0, 0, 7); g.clip();
    const burn = g.createRadialGradient(W / 2 + 6, 132, 4, W / 2 + 6, 132, 56); burn.addColorStop(0, '#050403'); burn.addColorStop(.62, '#0b0907'); burn.addColorStop(.85, 'rgba(60,34,12,.9)'); burn.addColorStop(1, 'rgba(60,34,12,0)');
    g.fillStyle = burn; g.fillRect(0, 0, W, H); g.restore();
    g.strokeStyle = '#a89c80'; g.lineWidth = 5; g.strokeRect(8, 8, W - 16, H - 16);
    g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.strokeRect(14, 14, W - 28, H - 28);
    blotch(g, rnd, W, H, 10, 'rgba(0,0,0,A)', 10, 50, .4);
    return canvasTexture(c);
  });
}

// 朱砂/香灰手绘阵痕（不发光，带磨损断续）
export function inkRuneTexture(index = 0) {
  return once('inkrune:' + index, () => {
    const src = runeCircleTexture(index).image, S = src.width, [c, g] = makeCanvas(S), rnd = mulberry(300 + index);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) { g.globalAlpha = .4 + rnd() * .6; g.beginPath(); g.ellipse(rnd() * S, rnd() * S, 4 + rnd() * 26, 2 + rnd() * 10, rnd() * 3, 0, 7); g.fill(); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    return canvasTexture(c);
  });
}
