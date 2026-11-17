import { makeCanvas, FONT, PALETTE } from '../scene/textures.js';
import { artImage, viewImage, hasArt, hasViews } from '../core/assets.js';
import { mulberry } from '../core/tween.js';

export const CW = 512, CH = 742;
const NUM = '"Palatino Linotype","Palatino","Book Antiqua","Times New Roman",serif';
const INK = '#17131c', BONE = PALETTE.bone, CIN = '#b3241a';
export const TYPE_STYLE = {
  '善灵': { char: '善', color: '#c9d2de' }, '恶灵': { char: '恶', color: '#d8402e' }, '规律鬼': { char: '律', color: '#a98cf2' },
  '邪神': { char: '邪', color: '#c2409a' }, '正神': { char: '神', color: '#ffd98a' }, '禁忌': { char: '禁', color: '#f1ece0' }
};
export const RARITY = { '普通': '#857d70', '稀有': '#5f8a7a', '珍藏': '#b8281c', '传说': '#e8c88a' };
const staticCache = new Map();
export const EYES = ['#b3120c', '#c8641a', '#1f8a5b', '#1c6fa8', '#6a2fa0', '#b08a1e', '#a31455', '#8fa3ad'];
export function mistEyes(g, cx, cy, s, name, boss) {
  // 恰好一双火焰之眼：杏仁轮廓 + 上火舌 + 亮核 + 竖瞳
  const h = [...(name || '鬼')].reduce((v, ch) => (v * 31 + ch.charCodeAt(0)) >>> 0, 7), rnd = mulberry(h), main = EYES[h % EYES.length];
  const k = boss ? 1.3 : 1;
  const eye = (x, y, w, tilt) => {
    g.save(); g.translate(x, y); g.rotate(tilt);
    g.shadowColor = main; g.shadowBlur = w * (boss ? 1.4 : 1);
    g.fillStyle = main;
    g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(-w * .4, -w * .55, 0, -w * .5); g.quadraticCurveTo(w * .4, -w * .55, w, 0);
    g.quadraticCurveTo(w * .4, w * .42, 0, w * .42); g.quadraticCurveTo(-w * .4, w * .42, -w, 0); g.fill();
    // 火舌舔过上缘
    g.beginPath();
    for (let i = 0; i < 4; i++) { const fx = -w * .7 + i * w * .45, fh = w * (.55 + rnd() * .5); g.moveTo(fx, -w * .38); g.quadraticCurveTo(fx + w * .1, -fh, fx + w * .22, -w * .34); }
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#fff4d6'; g.globalAlpha = .85;
    g.beginPath(); g.ellipse(0, -w * .05, w * .5, w * .12, 0, 0, 7); g.fill(); g.globalAlpha = 1;
    g.fillStyle = '#04030a'; g.beginPath(); g.ellipse(0, 0, w * .09, w * .34, 0, 0, 7); g.fill();
    g.restore();
  };
  for (const sd of [-1, 1]) eye(cx + sd * 56 * s * k, cy - 20 * s, 36 * s * k, sd * -.22);
  return main;
}

export function compact(n) {
  n = Number(n) || 0;
  if (n >= 100000) { const v = n / 10000; return (v >= 100 ? Math.round(v) : +v.toFixed(1)) + '万'; }
  if (n >= 1000) return String(Math.round(n));
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}
function fit(g, text, maxW, size, font = FONT, weight = 'bold', min = 14) {
  let s = size;
  for (; s > min; s -= 2) { g.font = `${weight} ${s}px ${font}`; if (g.measureText(text).width <= maxW) break; }
  g.font = `${weight} ${s}px ${font}`;
  return s;
}
function wrap(g, text, x, y, maxW, lh, maxLines = 5) {
  let line = '', n = 0;
  for (const ch of text) {
    if (g.measureText(line + ch).width > maxW) {
      g.fillText(line, x, y + n * lh); line = ch; n++;
      if (n >= maxLines) return;
    } else line += ch;
  }
  if (line) g.fillText(line, x, y + n * lh);
}
function speckle(g, rnd, n, light, dark, w = CW, h = CH) {
  for (let i = 0; i < n; i++) { g.fillStyle = rnd() > .5 ? light : dark; g.globalAlpha = rnd() * .22; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
  g.globalAlpha = 1;
}
function inkWash(g, rnd, x, y, w, h, colors) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = colors[0]; g.fillRect(x, y, w, h);
  for (let i = 0; i < 46; i++) {
    const cx = x + rnd() * w, cy = y + rnd() * h, r = 40 + rnd() * 150, gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, colors[1 + Math.floor(rnd() * (colors.length - 1))]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = .1 + rnd() * .22; g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  g.globalAlpha = 1; g.restore();
}
function nichePath(g) {
  const x0 = 30, x1 = CW - 30, y0 = 30, y1 = 476, r = 96;
  g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0 + r); g.arcTo(x0, y0, x0 + r, y0, r); g.lineTo(x1 - r, y0); g.arcTo(x1, y0, x1, y0 + r, r); g.lineTo(x1, y1); g.closePath();
}
function seal(g, x, y, size, char, color = CIN, fg = BONE) {
  g.save(); g.translate(x, y); g.rotate(-.05);
  g.fillStyle = color; g.beginPath(); g.roundRect(-size / 2, -size / 2, size, size, size * .12); g.fill();
  g.strokeStyle = fg; g.globalAlpha = .7; g.lineWidth = size * .03; g.strokeRect(-size * .41, -size * .41, size * .82, size * .82); g.globalAlpha = 1;
  g.fillStyle = fg; g.font = `bold ${size * .66}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(char, 0, size * .04);
  g.globalCompositeOperation = 'destination-out';
  const rnd = mulberry(char.charCodeAt(0));
  for (let i = 0; i < 60; i++) { g.globalAlpha = rnd() * .7; g.beginPath(); g.arc((rnd() - .5) * size, (rnd() - .5) * size, rnd() * size * .035, 0, 7); g.fill(); }
  g.restore();
}

export function artIdFor(unit) {
  if (!unit) return null;
  if (unit.id === 'tong') {
    const form = unit.effects?.form?.label;
    if (form === '邪灵形态' && hasArt('tong_evil')) return 'tong_evil';
    if (form === '女武神形态' && hasArt('tong_valkyrie')) return 'tong_valkyrie';
  }
  if (unit.artId && hasArt(unit.artId)) return unit.artId;
  return hasArt(unit.id) ? unit.id : null;
}

// 无立绘鬼灵的占位：每个类型一种背景母题，名字首字做成拓片，类型字做落款印
function motif(g, rnd, type) {
  const cx = CW / 2, cy = 236;
  g.save(); g.lineCap = 'round';
  const disc = (color, r, a) => { const m = g.createRadialGradient(cx, cy, r * .2, cx, cy, r); m.addColorStop(0, color); m.addColorStop(.82, color); m.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = a; g.fillStyle = m; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.globalAlpha = 1; };
  if (type === '善灵') {
    disc('#8ea0c0', 150, .5);
    g.strokeStyle = 'rgba(236,228,210,.34)'; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const y = cy + 60 + i * 44, o = (rnd() - .5) * 60; g.beginPath(); g.moveTo(40, y); g.bezierCurveTo(150 + o, y - 34, 250 + o, y + 34, CW / 2 + o, y); g.bezierCurveTo(330 + o, y - 30, 420 + o, y + 26, CW - 40, y - 6); g.stroke(); }
  } else if (type === '恶灵') {
    disc('#6e160f', 156, .85);
    g.strokeStyle = 'rgba(10,6,5,.8)'; g.lineWidth = 3;
    for (let i = 0, n = 6 + (rnd() * 3 | 0); i < n; i++) { let a = rnd() * 7, r = 14 + rnd() * 30, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 5; k++) { a += (rnd() - .5) * 1.1; r = 22 + rnd() * 26; px += Math.cos(a) * r; py += Math.sin(a) * r; g.lineTo(px, py); } g.stroke(); }
  } else if (type === '规律鬼') {
    g.strokeStyle = 'rgba(236,228,210,.26)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { g.setLineDash([4 + i * 5, 10 + i * 4]); g.beginPath(); g.arc(cx, cy, 56 + i * 38, 0, 7); g.stroke(); }
    g.setLineDash([]); g.strokeStyle = 'rgba(201,162,90,.6)'; g.lineWidth = 6;
    for (let i = 0; i < 8; i++) { g.save(); g.translate(cx, cy); g.rotate(i / 8 * Math.PI * 2); const broken = rnd() < .5; g.beginPath(); if (broken) { g.moveTo(-26, -198); g.lineTo(-6, -198); g.moveTo(6, -198); g.lineTo(26, -198); } else { g.moveTo(-26, -198); g.lineTo(26, -198); } g.stroke(); g.restore(); }
  } else if (type === '邪神') {
    disc('#2a0f1c', 170, .9);
    g.strokeStyle = 'rgba(8,5,6,.85)';
    for (let i = 0; i < 5; i++) { const a0 = i / 5 * Math.PI * 2 + rnd(), bend = (rnd() - .5) * 2.2; for (let k = 0; k < 14; k++) { const t0 = k / 14, t1 = (k + 1) / 14, pt = t => { const a = a0 + bend * t * t, r = 20 + t * 230; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }; const [x0, y0] = pt(t0), [x1, y1] = pt(t1); g.lineWidth = 22 * (1 - t0) + 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); } }
  } else if (type === '正神') {
    disc('#c9a25a', 120, .28);
    g.strokeStyle = 'rgba(232,200,138,.5)'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r0 = 96, r1 = i % 2 ? 190 : 232; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke(); }
    g.beginPath(); g.arc(cx, cy, 96, 0, 7); g.stroke();
  } else {
    for (const rot of [-.62, .62]) { g.save(); g.translate(cx, cy); g.rotate(rot); g.fillStyle = 'rgba(203,191,159,.5)'; g.fillRect(-330, -30, 660, 60); g.strokeStyle = 'rgba(110,22,15,.7)'; g.lineWidth = 2; g.strokeRect(-330, -24, 660, 48); g.fillStyle = 'rgba(184,40,28,.75)'; g.font = `bold 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let i = -4; i <= 4; i++) g.fillText('封', i * 70, 2); g.restore(); }
  }
  g.restore();
}
const rubCache = new Map();
function rubbing(ch) {
  if (rubCache.has(ch)) return rubCache.get(ch);
  const [c, g] = makeCanvas(360, 360), rnd = mulberry(ch.charCodeAt(0) * 7 + 3);
  g.fillStyle = 'rgba(236,228,210,.86)'; g.font = `bold 300px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 180, 190);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 2600; i++) { g.globalAlpha = .35 + rnd() * .65; g.beginPath(); g.arc(rnd() * 360, rnd() * 360, .6 + rnd() * rnd() * 5, 0, 7); g.fill(); }
  g.globalAlpha = .5; for (let i = 0; i < 9; i++) { g.fillRect(0, rnd() * 360, 360, 1 + rnd() * 2); }
  rubCache.set(ch, c); return c;
}

function drawArt(g, unit, rnd) {
  const x = 30, y = 30, w = CW - 60, h = 446, style = TYPE_STYLE[unit.type] || TYPE_STYLE['恶灵'];
  g.save(); nichePath(g); g.clip();
  const art = artIdFor(unit), img = art ? artImage(art) : null;
  if (img) {
    const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
    g.drawImage(img, x + (w - dw) / 2, y + (h - dh) * .25, dw, dh);
  } else if (hasViews(unit.id)) {
    inkWash(g, rnd, x, y, w, h, ['#161427', '#3a3f8a', '#6f7fd8', '#241a3a']);
    const moon = g.createRadialGradient(CW / 2, 190, 10, CW / 2, 190, 210);
    moon.addColorStop(0, 'rgba(233,226,208,.5)'); moon.addColorStop(1, 'rgba(233,226,208,0)');
    g.fillStyle = moon; g.fillRect(x, y, w, h);
    const v = viewImage(unit.id, 'front'), dh = h * 2.15, dw = v.width / v.height * dh;
    g.drawImage(v, CW / 2 - dw / 2, y + 14, dw, dh);
  } else if (unit.spirit) {
    inkWash(g, rnd, x, y, w, h, ['#0d0a09', '#2a1a14', '#3d1712', '#15100e', style.color]);
    motif(g, rnd, unit.type);
    g.drawImage(rubbing(unit.name[0]), CW / 2 - 180, 70);
    seal(g, CW - 118, 398, 104, style.char, CIN);
  } else {
    inkWash(g, rnd, x, y, w, h, ['#07070a', '#141316', '#0d0b0c', '#0a0a0d']);
    const cx = CW / 2, cy = 250;
    for (let i = 0; i < 30; i++) { const px = cx + (rnd() - .5) * 260, py = cy + (rnd() - .5) * 260, r = 60 + rnd() * 90, gr = g.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, 'rgba(0,0,0,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2); }
    mistEyes(g, cx, cy, 1.25, unit.name, unit.boss && !unit.elite);
  }
  const fade = g.createLinearGradient(0, 300, 0, 476); fade.addColorStop(0, 'rgba(10,8,7,0)'); fade.addColorStop(1, 'rgba(10,8,7,.92)');
  g.fillStyle = fade; g.fillRect(x, 300, w, 176);
  g.restore();
}

function drawUnitStatic(unit) {
  const [c, g] = makeCanvas(CW, CH), rnd = mulberry((unit.name || 'x').split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7));
  const style = TYPE_STYLE[unit.type] || TYPE_STYLE['恶灵'];
  const bg = g.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, '#16110f'); bg.addColorStop(1, '#0a0807');
  g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
  speckle(g, rnd, 1500, '#3a302a', '#000');
  drawArt(g, unit, rnd);
  g.lineJoin = 'round';
  nichePath(g); g.strokeStyle = 'rgba(233,226,208,.45)'; g.lineWidth = 2; g.stroke();
  g.strokeStyle = style.color; g.globalAlpha = .7; g.lineWidth = 2; g.strokeRect(13, 13, CW - 26, CH - 26); g.globalAlpha = 1;

  const name = unit.name || '';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if ([...name].length <= 5) {
    const chars = [...name], sh = chars.length * 46 + 26;
    g.save(); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
    g.fillStyle = '#e9e2d0'; g.fillRect(46, 92, 58, sh); g.restore();
    g.fillStyle = CIN; g.fillRect(46, 92, 58, 5);
    g.fillStyle = INK; g.font = `bold 40px ${FONT}`;
    chars.forEach((ch, i) => g.fillText(ch, 75, 128 + i * 46));
  } else {
    g.fillStyle = 'rgba(8,7,12,.78)'; g.fillRect(30, 404, CW - 60, 52);
    g.fillStyle = BONE; fit(g, name, CW - 96, 34); g.fillText(name, CW / 2, 431);
  }
  g.font = `bold 26px ${FONT}`;
  const rank = unit.rankName || `Lv.${unit.level || 1}`, rw = g.measureText(rank).width + 30;
  g.fillStyle = 'rgba(10,8,7,.86)'; g.beginPath(); g.roundRect(CW - 44 - rw, 48, rw, 42, 6); g.fill();
  g.strokeStyle = 'rgba(233,226,208,.5)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = BONE; g.fillText(rank, CW - 44 - rw / 2, 70);
  g.fillStyle = 'rgba(10,8,7,.86)'; g.beginPath(); g.arc(CW - 72, 126, 27, 0, 7); g.fill();
  g.strokeStyle = style.color; g.lineWidth = 3; g.stroke();
  g.fillStyle = style.color; g.font = `bold 30px ${FONT}`; g.fillText(style.char, CW - 72, 128);
  if (unit.boss) {
    g.fillStyle = '#ffd98a'; g.font = `bold 24px ${FONT}`;
    g.fillStyle = 'rgba(10,8,7,.86)'; g.beginPath(); g.roundRect(CW - 112, 164, 80, 34, 5); g.fill();
    g.fillStyle = '#ffd98a'; g.fillText('首领', CW - 72, 182);
    const skills = unit.bossSkills || [];
    g.font = `bold 23px ${FONT}`;
    let tx = CW / 2 - skills.reduce((s, n) => s + g.measureText(n).width + 30, 0) / 2 + 4;
    for (const s of skills) { const w = g.measureText(s).width + 22; g.fillStyle = 'rgba(140,22,16,.92)'; g.beginPath(); g.roundRect(tx, 364, w, 34, 4); g.fill(); g.fillStyle = BONE; g.fillText(s, tx + w / 2, 382); tx += w + 8; }
  }
  g.strokeStyle = 'rgba(233,226,208,.4)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(44, 492); g.lineTo(CW - 44, 492); g.stroke();
  g.fillStyle = style.color; g.save(); g.translate(CW / 2, 492); g.rotate(Math.PI / 4); g.fillRect(-6, -6, 12, 12); g.restore();

  g.save(); g.translate(72, 572);
  g.fillStyle = BONE; g.beginPath(); g.moveTo(0, -46); g.quadraticCurveTo(22, -8, 9, 22); g.lineTo(-9, 22); g.quadraticCurveTo(-22, -8, 0, -46); g.fill();
  g.fillStyle = CIN; g.fillRect(-20, 22, 40, 8); g.fillStyle = BONE; g.fillRect(-5, 30, 10, 22);
  g.restore();
  g.save(); g.translate(292, 574);
  const fl = g.createLinearGradient(0, -44, 0, 30); fl.addColorStop(0, '#ffd98a'); fl.addColorStop(1, '#e0452c');
  g.fillStyle = fl; g.beginPath(); g.moveTo(0, -46); g.bezierCurveTo(30, -6, 24, 28, 0, 30); g.bezierCurveTo(-24, 28, -30, -6, 0, -46); g.fill();
  g.fillStyle = BONE; g.fillRect(-22, 34, 44, 7);
  g.restore();
  return c;
}

function staticKey(u) {
  return [u.id, u.name, u.rankName, u.type, artIdFor(u), u.boss ? (u.bossSkills || []).join(',') : '', u.spirit ? 1 : 0, u.elite ? 1 : 0].join('|');
}

export function unitDescriptor(unit) {
  const GD = globalThis.GC.GD, meta = GD.spirits.find(s => s.id === unit.id);
  return {
    id: unit.id, name: unit.name, rankName: unit.rankName, level: unit.level, type: unit.type || meta?.type || '恶灵', spirit: !!meta,
    boss: !!unit.bossSkills?.length, elite: !!unit.elite, bossSkills: unit.bossSkills || [], effects: unit.effects,
    baseAtk: unit.baseAtk ?? unit.atk, hp: Math.max(0, unit.hp), maxHp: unit.maxHp, shield: unit.shield || 0
  };
}
export function unitFaceKey(d) { return staticKey(d) + '#' + [compact(d.baseAtk), compact(d.hp), compact(d.maxHp), Math.round(d.hp / d.maxHp * 100), d.shield > 0 ? 1 : 0].join('|'); }

export function drawUnitFace(canvas, d) {
  const key = staticKey(d);
  if (!staticCache.has(key)) staticCache.set(key, drawUnitStatic(d));
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, CW, CH); g.drawImage(staticCache.get(key), 0, 0);
  g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  g.textAlign = 'left'; g.fillStyle = BONE;
  const atk = compact(d.baseAtk);
  fit(g, atk, 150, 104, NUM); g.fillText(atk, 106, 612);
  const ratio = Math.max(0, Math.min(1, d.hp / Math.max(1, d.maxHp))), low = ratio < .25, mid = ratio < .5;
  const hp = compact(d.hp), max = '/' + compact(d.maxHp);
  g.font = `bold 38px ${NUM}`; const mw = Math.min(84, g.measureText(max).width);
  const s = fit(g, hp, 166 - mw, 84, NUM);
  const hw = g.measureText(hp).width;
  g.fillStyle = low ? '#ff5a40' : mid ? '#ffc27a' : BONE; g.fillText(hp, 326, 612 - (84 - s) * .2);
  g.fillStyle = 'rgba(233,226,208,.75)'; fit(g, max, 84, 38, NUM); g.fillText(max, 326 + hw + 4, 612);
  g.fillStyle = '#1c1916'; g.beginPath(); g.roundRect(40, 668, CW - 80, 14, 3); g.fill();
  if (ratio > 0) {
    const bar = g.createLinearGradient(40, 0, CW - 40, 0);
    bar.addColorStop(0, low ? '#ff3b24' : mid ? '#a8301c' : '#7a1810'); bar.addColorStop(1, low ? '#ff7a50' : mid ? '#e0703a' : '#b8281c');
    g.fillStyle = bar; g.beginPath(); g.roundRect(40, 668, Math.max(8, (CW - 80) * ratio), 14, 3); g.fill();
  }
  if (d.shield > 0) { g.strokeStyle = '#c9d2de'; g.lineWidth = 3; g.beginPath(); g.roundRect(37, 665, CW - 74, 20, 5); g.stroke(); }
}

const ICONS = {
  coin(g, n = 1) {
    const pts = n === 1 ? [[0, 0]] : n === 3 ? [[-52, 14], [0, -22], [52, 14]] : n === 6 ? [[-66, -40], [0, -52], [66, -40], [-66, 38], [0, 50], [66, 38]] : [[-76, -62], [-26, -74], [26, -74], [76, -62], [-76, 0], [-26, -8], [26, -8], [76, 0], [-52, 62], [0, 70], [52, 62]];
    if (n > 1) { g.strokeStyle = CIN; g.lineWidth = 7; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
    const r = n === 1 ? 86 : n === 3 ? 46 : n === 6 ? 38 : 30;
    for (const [x, y] of pts) {
      g.fillStyle = '#2a2420'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = '#b08a3c'; g.beginPath(); g.arc(x, y, r * .9, 0, 7); g.fill();
      g.fillStyle = '#2a2420'; g.fillRect(x - r * .3, y - r * .3, r * .6, r * .6);
      g.strokeStyle = '#6b4f1c'; g.lineWidth = r * .07; g.beginPath(); g.arc(x, y, r * .7, 0, 7); g.stroke();
    }
  },
  blade(g) {
    g.rotate(-.7); g.fillStyle = INK;
    g.beginPath(); g.moveTo(-120, 16); g.quadraticCurveTo(10, -44, 128, -16); g.quadraticCurveTo(60, 14, 20, 20); g.lineTo(-120, 26); g.closePath(); g.fill();
    g.fillStyle = '#d9d2c4'; g.beginPath(); g.moveTo(-70, 12); g.quadraticCurveTo(20, -28, 112, -14); g.quadraticCurveTo(30, -6, -70, 18); g.fill();
    g.fillStyle = CIN; g.fillRect(-98, 0, 14, 40); g.fillStyle = INK; g.fillRect(-150, 10, 54, 18);
  },
  spear(g) {
    g.rotate(-.85); g.fillStyle = INK; g.fillRect(-150, -6, 230, 12);
    g.beginPath(); g.moveTo(70, -26); g.lineTo(158, 0); g.lineTo(70, 26); g.lineTo(88, 0); g.closePath(); g.fill();
    g.fillStyle = '#d9d2c4'; g.beginPath(); g.moveTo(92, -10); g.lineTo(146, 0); g.lineTo(92, 10); g.closePath(); g.fill();
    g.fillStyle = CIN; g.beginPath(); g.moveTo(60, -8); g.quadraticCurveTo(30, 40, 46, 66); g.quadraticCurveTo(66, 30, 60, -8); g.fill();
  },
  whip(g) {
    g.strokeStyle = INK; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-110, 96); g.bezierCurveTo(-60, -40, 40, 120, 70, -20); g.bezierCurveTo(84, -90, 20, -110, 4, -70); g.stroke();
    g.strokeStyle = '#b08a3c'; g.lineWidth = 5; g.setLineDash([4, 22]);
    g.beginPath(); g.moveTo(-110, 96); g.bezierCurveTo(-60, -40, 40, 120, 70, -20); g.bezierCurveTo(84, -90, 20, -110, 4, -70); g.stroke(); g.setLineDash([]);
    g.fillStyle = CIN; g.beginPath(); g.arc(-110, 96, 16, 0, 7); g.fill();
  },
  horse(g) {
    g.strokeStyle = INK; g.lineWidth = 30; g.lineCap = 'round';
    g.beginPath(); g.arc(0, -6, 78, Math.PI * .82, Math.PI * .18, false); g.stroke();
    g.fillStyle = '#d9d2c4'; for (let i = 0; i < 7; i++) { const a = Math.PI * .86 + i / 6 * Math.PI * 1.28; g.beginPath(); g.arc(Math.cos(a) * 78, -6 + Math.sin(a) * 78, 5, 0, 7); g.fill(); }
    g.strokeStyle = CIN; g.lineWidth = 6; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-120 + i * 12, 96 - i * 22); g.lineTo(-64 + i * 12, 96 - i * 22); g.stroke(); }
  },
  rope(g) {
    g.strokeStyle = '#5a4630'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-120, -60); g.bezierCurveTo(-20, -120, 60, 10, -10, 40); g.bezierCurveTo(-70, 60, -60, -30, 10, -10); g.bezierCurveTo(90, 20, 80, 90, 130, 80); g.stroke();
    g.strokeStyle = '#c9b06a'; g.lineWidth = 4; g.setLineDash([8, 10]);
    g.beginPath(); g.moveTo(-120, -60); g.bezierCurveTo(-20, -120, 60, 10, -10, 40); g.bezierCurveTo(-70, 60, -60, -30, 10, -10); g.bezierCurveTo(90, 20, 80, 90, 130, 80); g.stroke(); g.setLineDash([]);
  },
  relic(g) {
    for (let i = 0; i < 8; i++) { g.save(); g.rotate(i / 8 * Math.PI * 2); g.fillStyle = i % 2 ? '#d9d2c4' : '#b9af9a'; g.beginPath(); g.moveTo(0, 20); g.quadraticCurveTo(46, 60, 0, 118); g.quadraticCurveTo(-46, 60, 0, 20); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.restore(); }
    const gr = g.createRadialGradient(-10, -12, 4, 0, 0, 44); gr.addColorStop(0, '#fff'); gr.addColorStop(.5, '#ffd98a'); gr.addColorStop(1, '#b3761a');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 42, 0, 7); g.fill();
  },
  valhalla(g) {
    g.fillStyle = INK; g.beginPath(); g.moveTo(-140, -30); g.quadraticCurveTo(0, -130, 140, -30); g.lineTo(112, -30); g.quadraticCurveTo(0, -84, -112, -30); g.closePath(); g.fill();
    g.fillRect(-120, -34, 240, 16);
    for (const x of [-92, -32, 28, 88]) g.fillRect(x - 10, -18, 20, 118);
    g.fillRect(-130, 96, 260, 16);
    g.fillStyle = '#ffd98a'; g.beginPath(); g.moveTo(-18, 96); g.lineTo(-18, 20); g.quadraticCurveTo(0, -6, 18, 20); g.lineTo(18, 96); g.fill();
  },
  bloodmoon(g) {
    const gr = g.createRadialGradient(-20, -24, 10, 0, 0, 104); gr.addColorStop(0, '#ff6a50'); gr.addColorStop(1, '#7d120c');
    g.fillStyle = gr; g.beginPath(); g.arc(0, -10, 100, 0, 7); g.fill();
    g.fillStyle = 'rgba(60,6,4,.45)'; for (const [x, y, r] of [[-34, -40, 22], [30, 6, 30], [-20, 40, 14], [46, -54, 12]]) { g.beginPath(); g.arc(x, y - 10, r, 0, 7); g.fill(); }
    g.fillStyle = '#7d120c'; for (const [x, l] of [[-50, 46], [-6, 70], [44, 38]]) { g.beginPath(); g.moveTo(x - 9, 70); g.quadraticCurveTo(x, 90 + l, x + 9, 70); g.fill(); }
  },
  taboo(g) {
    g.strokeStyle = BONE; g.lineWidth = 8; g.beginPath(); g.moveTo(-124, 0); g.quadraticCurveTo(0, -96, 124, 0); g.quadraticCurveTo(0, 96, -124, 0); g.stroke();
    g.fillStyle = '#0b090c'; g.beginPath(); g.arc(0, 0, 52, 0, 7); g.fill(); g.stroke();
    g.fillStyle = BONE; g.font = `bold 84px ${NUM}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 6);
  },
  revive(g) {
    g.strokeStyle = INK; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); for (let a = 0; a < 15; a += .2) { const r = 8 + a * 7.4, x = Math.cos(a) * r, y = Math.sin(a) * r; a ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.fillStyle = CIN; g.beginPath(); g.moveTo(0, -34); g.bezierCurveTo(26, -4, 20, 22, 0, 24); g.bezierCurveTo(-20, 22, -26, -4, 0, -34); g.fill();
  }
};

const ARCH_COLOR = { burn: '#c2521d', ice: '#3f7fa8', summon: '#7d6a4a', blood: '#8c1c1c', bounce: '#4f7a5a', lamp: '#b8902e', util: '#6a6470' };
function drawSkillStatic(id) {
  const S = globalThis.GC.SKILLS[id] || { name: id, cost: 0, desc: '', rarity: '普通' }, meta = globalThis.GC.GD.cards.find(c => c.id === id), event = !!meta?.event;
  const [c, g] = makeCanvas(CW, CH), rnd = mulberry(id.length * 97 + id.charCodeAt(0));
  const ink = event ? BONE : INK, rare = RARITY[S.rarity] || RARITY['普通'];
  if (event) { const bg = g.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, '#3d0f0d'); bg.addColorStop(1, '#170708'); g.fillStyle = bg; g.fillRect(0, 0, CW, CH); speckle(g, rnd, 1600, '#7d2018', '#000'); }
  else { const bg = g.createLinearGradient(0, 0, CW, CH); bg.addColorStop(0, '#bfae84'); bg.addColorStop(1, '#8f7d56'); g.fillStyle = bg; g.fillRect(0, 0, CW, CH); speckle(g, rnd, 2600, '#f1e8cc', '#5a4424'); }
  const edge = g.createRadialGradient(CW / 2, CH / 2, 200, CW / 2, CH / 2, 470); edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, event ? 'rgba(0,0,0,.6)' : 'rgba(40,22,6,.7)');
  g.fillStyle = edge; g.fillRect(0, 0, CW, CH);
  g.strokeStyle = event ? 'rgba(233,226,208,.7)' : CIN; g.lineWidth = 4; g.strokeRect(20, 20, CW - 40, CH - 40);
  g.lineWidth = 1.5; g.strokeRect(30, 30, CW - 60, CH - 60);
  g.fillStyle = rare; g.fillRect(30, 30, CW - 60, 12);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = ink; fit(g, S.name, CW - 150, 62); g.fillText(S.name, CW / 2 + 22, 98);
  g.fillStyle = rare; g.beginPath(); g.roundRect(CW / 2 - 78, 142, 156, 36, 5); g.fill();
  g.fillStyle = '#f4efe2'; g.font = `bold 23px ${FONT}`; g.fillText(`${event ? '事件' : S.arch ? globalThis.GC_X.ARCH[S.arch] : '技能'} · ${S.rarity || '普通'}`, CW / 2, 161);
  if (S.arch) { g.fillStyle = ARCH_COLOR[S.arch] || '#777'; g.fillRect(30, CH - 42, CW - 60, 12); }
  g.save(); g.translate(CW / 2, 346);
  g.strokeStyle = event ? 'rgba(233,226,208,.22)' : 'rgba(90,60,30,.3)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 150, 0, 7); g.stroke(); g.setLineDash([6, 10]); g.beginPath(); g.arc(0, 0, 162, 0, 7); g.stroke(); g.setLineDash([]);
  const icon = id.startsWith('coin') ? () => ICONS.coin(g, { coin: 1, coin25: 3, coin40: 6, coin100: 11 }[id] || 1) : ICONS[id] ? () => ICONS[id](g) : null;
  if (icon) icon(); else seal(g, 0, 0, 190, S.icon || S.name[0], CIN);
  g.restore();
  g.fillStyle = event ? 'rgba(0,0,0,.4)' : 'rgba(255,250,235,.3)'; g.beginPath(); g.roundRect(44, 532, CW - 88, 168, 8); g.fill();
  g.strokeStyle = event ? 'rgba(233,226,208,.3)' : 'rgba(90,60,30,.4)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = ink; g.font = `30px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'top';
  wrap(g, meta?.desc || S.desc || '', 62, 548, CW - 124, 38, 4);
  return c;
}
export function drawSkillFace(canvas, id) {
  const key = 'skill:' + id;
  if (!staticCache.has(key)) staticCache.set(key, drawSkillStatic(id));
  const g = canvas.getContext('2d'); g.clearRect(0, 0, CW, CH); g.drawImage(staticCache.get(key), 0, 0);
}

let backCanvas = null;
export function cardBackCanvas() {
  if (backCanvas) return backCanvas;
  const [c, g] = makeCanvas(CW, CH), rnd = mulberry(5);
  const bg = g.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, 480); bg.addColorStop(0, '#3a0f0c'); bg.addColorStop(1, '#120706');
  g.fillStyle = bg; g.fillRect(0, 0, CW, CH); speckle(g, rnd, 1800, '#6e160f', '#000');
  g.strokeStyle = 'rgba(233,226,208,.5)'; g.lineWidth = 3; g.strokeRect(22, 22, CW - 44, CH - 44); g.lineWidth = 1.5; g.strokeRect(32, 32, CW - 64, CH - 64);
  g.translate(CW / 2, CH / 2);
  g.strokeStyle = 'rgba(201,162,90,.5)';
  for (let i = 0; i < 7; i++) { g.lineWidth = i % 2 ? 1.5 : 3; g.beginPath(); g.ellipse(0, 0, 60 + i * 28, 36 + i * 40, 0, 0, 7); g.stroke(); }
  g.lineWidth = 4; g.beginPath(); g.moveTo(-200, 0); g.quadraticCurveTo(0, -150, 200, 0); g.quadraticCurveTo(0, 150, -200, 0); g.stroke();
  seal(g, 0, 0, 128, '契', CIN);
  backCanvas = c;
  return c;
}

const badgeCache = new Map();
export function costBadgeCanvas(cost, ok = true) {
  const key = cost + (ok ? 'y' : 'n');
  if (badgeCache.has(key)) return badgeCache.get(key);
  const [c, g] = makeCanvas(128);
  g.translate(64, 64);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(0, 4, 56, 0, 7); g.fill();
  const gr = g.createRadialGradient(-12, -16, 4, 0, 0, 54); gr.addColorStop(0, ok ? '#3a322b' : '#2e2b28'); gr.addColorStop(.6, ok ? '#1d1815' : '#1c1a18'); gr.addColorStop(1, ok ? '#0c0a09' : '#0e0d0c');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 52, 0, 7); g.fill();
  g.strokeStyle = ok ? '#c9a25a' : '#55504a'; g.lineWidth = 4; g.stroke();
  g.fillStyle = ok ? '#e8e0cc' : '#7a756a'; g.font = `bold 70px ${NUM}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(cost), 0, 5);
  badgeCache.set(key, c);
  return c;
}
