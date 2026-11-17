// 技能视频：assets/video/<id>_<序号>.mp4|webm 存在时，用它代替该技能的程序化全屏演出。
// 对应表在 video-map.js；点击、空格、回车可跳过。演出模式「仅牌桌」不播，「精简」每场每条只播一次，被动技能每场只播一次。
import { VIDEO_MAP } from './video-map.js';

export function createSkillVideo(ctx) {
  const files = new Map(), seen = new Set();
  let el = null, battleKey = '';
  fetch('/__list?dir=assets/video').then(r => r.ok ? r.json() : []).then(list => {
    for (const f of list) { const m = /^([a-z0-9_]+)\.(mp4|webm)$/i.exec(f); if (m && !files.has(m[1].toLowerCase())) files.set(m[1].toLowerCase(), f); }
  }).catch(() => { });

  function keyFor(req) {
    if (!req) return null;
    if (req.kind === 'player') return { key: 'player_' + ((req.index | 0) + 1), passive: false };
    if (req.kind !== 'skill' || !req.portrait?.id) return null;
    const raw = String(req.name || ''), plus = (raw.match(/\++$/) || [''])[0].length, name = raw.replace(/\++$/, '');
    const list = VIDEO_MAP[req.portrait.id] || [], hit = list.find(e => e[0].includes(name)) || list.find(e => e[0].some(n => name.includes(n) || n.includes(name)));
    if (!hit) return null;
    const base = `${req.portrait.id}_${hit[1]}`;
    for (let p = plus; p >= 0; p--) if (files.has(base + 'p'.repeat(p))) return { key: base + 'p'.repeat(p), passive: !!hit[2] };
    return null;
  }
  // 空位：对应表里有、但视频文件还没放进来的技能
  function slotFor(req) {
    if (!req) return null;
    if (req.kind === 'player') return { key: 'player_' + ((req.index | 0) + 1), passive: false };
    if (req.kind !== 'skill' || !req.portrait?.id) return null;
    const name = String(req.name || '').replace(/\++$/, ''), list = VIDEO_MAP[req.portrait.id] || [];
    const hit = list.find(e => e[0].includes(name)) || list.find(e => e[0].some(n => name.includes(n) || n.includes(name)));
    return hit ? { key: `${req.portrait.id}_${hit[1]}`, passive: !!hit[2] } : null;
  }
  const slotMode = () => localStorage.getItem('gc3d-video-slot') === 'cine' ? 'cine' : 'black';
  function has(req) { const k = keyFor(req); return !!k && files.has(k.key); }
  async function tryPlay(req) {
    const mode = ctx.cine?.mode || 'full'; if (mode === 'table') return false;
    let k = keyFor(req), blank = false;
    if (!k || !files.has(k.key)) { k = slotMode() === 'black' ? slotFor(req) : null; blank = true; if (!k) return false; }
    const b = globalThis.GC?.battle, bk = b ? `${b.nodeId}|${b.uid || ''}|${globalThis.GC.state?.wave || 0}` : '';
    if (bk !== battleKey || (b && b.turn === 1 && !seen.size)) { battleKey = bk; }
    if ((k.passive || mode === 'smart') && seen.has(bk + k.key)) return false;
    seen.add(bk + k.key);
    return blank ? placeholder(k.key, req) : show(files.get(k.key), req);
  }
  // 纯黑占位：视频还没做好时，在它将来出现的位置显示黑屏 + 技能名 + 文件名
  function placeholder(key, req) {
    return new Promise(resolve => {
      const wide = (req.tier || 3) >= 3, speed = Math.max(1, +(globalThis.GC?.preferences?.speed) || 1);
      const box = document.createElement('div'); box.className = 'skill-video slot' + (wide ? '' : ' band');
      const cap = document.createElement('b'); cap.textContent = req.name || '';
      const who = document.createElement('em'); who.textContent = req.kind === 'player' ? '御鬼者' : req.portrait?.name || '';
      const tip = document.createElement('small'); tip.textContent = `素材空位 · assets/video/${key}.mp4 · 点击跳过`;
      const stamp = document.createElement('i'); stamp.className = 'slot-seal'; stamp.textContent = [...(req.name || '技')][0];
      box.append(who, cap, stamp, tip); document.body.append(box); el = box; requestAnimationFrame(() => box.classList.add('on'));
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(timer); removeEventListener('keydown', onKey, true); box.remove(); if (el === box) el = null; resolve(true); };
      const onKey = e => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); } };
      const timer = setTimeout(finish, (wide ? 1500 : 800) / speed);
      box.addEventListener('pointerdown', e => { e.stopPropagation(); finish(); });
      addEventListener('keydown', onKey, true);
    });
  }
  function show(file, req) {
    return new Promise(resolve => {
      const prefs = globalThis.GC?.preferences || {}, wide = (req.tier || 3) >= 3;
      const box = document.createElement('div'); box.className = 'skill-video' + (wide ? '' : ' band') + (req.side === 'enemy' ? ' enemy' : '');
      const v = document.createElement('video'); v.playsInline = true; v.preload = 'auto'; v.src = 'assets/video/' + file;
      v.muted = prefs.sound === false; v.volume = Math.max(0, Math.min(1, prefs.volume ?? .55));
      const cap = document.createElement('b'); cap.textContent = req.name || '';
      const tip = document.createElement('small'); tip.textContent = '点击跳过';
      box.append(v, cap, tip); document.body.append(box); el = box;
      let done = false, played = false;
      const finish = () => { if (done) return; done = true; clearTimeout(guard); removeEventListener('keydown', onKey, true); box.classList.remove('on'); setTimeout(() => { v.pause(); v.removeAttribute('src'); v.load(); box.remove(); if (el === box) el = null; resolve(played); }, 160); };
      const onKey = e => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); } };
      const guard = setTimeout(finish, 9000);
      box.addEventListener('pointerdown', e => { e.stopPropagation(); finish(); });
      addEventListener('keydown', onKey, true);
      v.addEventListener('ended', finish); v.addEventListener('error', finish);
      const go = () => v.play().then(() => { played = true; box.classList.add('on'); });
      go().catch(() => { v.muted = true; go().catch(finish); });
    });
  }
  ctx.on('battleCleared', () => seen.clear());
  return { tryPlay, has, keyFor, slotFor, slotMode, setSlotMode(v) { localStorage.setItem('gc3d-video-slot', v === 'cine' ? 'cine' : 'black'); }, get files() { return [...files.keys()]; }, get playing() { return !!el; } };
}
