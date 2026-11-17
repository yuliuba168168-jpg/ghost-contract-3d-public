// 背景音乐：assets/music/<曲名>.mp3|wav|ogg|m4a 存在就播放，没有就按回退表找替代，全都没有则保持静音。
// 曲名与用途见 docs/assets.md。循环用同一首曲子的两个 <audio> 首尾交叉淡化完成。
const DIR = 'assets/music/', KEY = 'gc3d-music-vol', FADE = 2.2, TAIL = 3;
const FALLBACK = {
  title: ['map'], map: ['title'], camp: ['map', 'title'], event: ['camp', 'map'], contract: ['story_calm', 'camp', 'map'],
  story_calm: ['map'], story_dread: ['story_calm', 'map'], story_sorrow: ['story_calm', 'map'], story_resolve: ['story_calm', 'map'],
  battle_1: [], battle_2: ['battle_1'], battle_3: ['battle_2', 'battle_1'], elite: ['boss_ghost', 'battle_2', 'battle_1'], endless: ['battle_2', 'battle_1'],
  boss_ghost: ['battle_3', 'battle_2', 'battle_1'], boss_god: ['boss_ghost', 'battle_3', 'battle_2', 'battle_1'], boss_taboo: ['boss_ghost', 'battle_3', 'battle_2', 'battle_1'],
  boss_final: ['boss_god', 'boss_ghost', 'battle_3', 'battle_2', 'battle_1'], ending: ['story_sorrow', 'story_calm', 'title']
};
const MOOD = { story_sorrow: /离别|眼泪|哭|再见|牺牲|永别|怀念|遗言|坟/g, story_dread: /尸|血|诡异|阴冷|惨叫|恶灵|鬼域|黑暗|恐惧|腐/g, story_resolve: /决战|誓|守护|并肩|迎战|决意|反击|冲锋/g };
const CAMP_SHEETS = new Set(['camp', 'collection', 'codex', 'codexSpirit', 'ownedSpirit', 'training', 'prepare', 'achievements', 'records', 'guide', 'journal']);

export function createMusic(ctx) {
  const files = new Map(), moodCache = new Map();
  let level = (() => { const v = parseFloat(localStorage.getItem(KEY)); return Number.isFinite(v) ? v : .5; })();
  let cur = null, curName = '', stinger = null, ready = false, timer = 0;
  const master = () => { const p = globalThis.GC?.preferences || {}; return p.sound === false ? 0 : level; };

  function resolve(name) { for (const n of [name, ...(FALLBACK[name] || [])]) if (files.has(n)) return n; return ''; }
  function fade(a, to, dur, then) {
    const from = a.volume, t0 = performance.now(); clearInterval(a._f); a._fading = true;
    a._f = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / (dur * 1000)); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k >= 1) { clearInterval(a._f); a._fading = false; then?.(); } }, 50);
  }
  function make(name) { const a = new Audio(DIR + files.get(name)); a.preload = 'auto'; a.volume = 0; a._name = name; return a; }
  function drop(a, dur = FADE) { if (!a) return; fade(a, 0, dur, () => { a.pause(); a.src = ''; }); }
  function start(name) {
    const a = make(name), old = cur; cur = a; curName = name;
    a.play().then(() => { fade(a, master(), FADE); drop(old); }).catch(() => { if (cur === a) { cur = old; curName = old?._name || ''; } });
  }
  function moodOf(n) {
    if (!n?.story) return 'story_calm'; if (moodCache.has(n.story)) return moodCache.get(n.story);
    const text = String(globalThis.GC.STORY[n.story] || '').slice(0, 4000); let best = 'story_calm', top = 2;
    for (const k in MOOD) { const c = (text.match(MOOD[k]) || []).length; if (c > top) { top = c; best = k; } }
    moodCache.set(n.story, best); return best;
  }
  function bossTrack(n, GC) {
    if (n.act >= GC.ML.arcs.length) return 'boss_final';
    if (/禁忌/.test(n.novelRank || '') || /囡囡/.test(n.title)) return 'boss_taboo';
    return /神|佛|帝|天庭|天使|菩萨|圣/.test(n.title) ? 'boss_god' : 'boss_ghost';
  }
  function pick() {
    const GC = globalThis.GC; if (!GC) return 'title';
    const st = GC.state, b = GC.battle, sheet = document.querySelector('.sheet')?.dataset.sheet || '', base = ctx.screens?.base, n = GC.NODES[st?.current];
    if (b && ctx.battleActive) {
      const node = GC.NODES[b.nodeId], base2 = b.nodeId === 'endless-arena' || st.daily ? 'endless' : !node || b.testMode ? 'battle_1' : node.type === 'boss' ? bossTrack(node, GC) : node.elite ? 'elite' : node.act <= 15 ? 'battle_1' : node.act <= 30 ? 'battle_2' : 'battle_3';
      return b.maxWill && b.will / b.maxWill <= .25 && files.has('crisis') ? 'crisis' : base2;
    }
    if (sheet === 'ending') return 'ending';
    if (sheet === 'shop' || sheet === 'omen' || sheet === 'omenResult') return 'event';
    if (sheet === 'pact') return 'contract';
    if (sheet === 'daily') return 'endless';
    if (ctx.storyStage?.active || sheet === 'event') return n?.contract ? 'contract' : n?.type === 'ending' ? 'ending' : n?.type === 'boss' || n?.type === 'battle' ? 'story_dread' : moodOf(n);
    if (CAMP_SHEETS.has(sheet) && base !== 'home') return 'camp';
    return base === 'home' ? 'title' : base === 'endless' ? 'endless' : 'map';
  }
  function tick() {
    if (!ready || !files.size) return;
    if (cur && !cur._fading && !stinger) cur.volume = master();
    if (stinger) return;
    const name = resolve(pick());
    if (!name) { if (cur) { drop(cur); cur = null; curName = ''; } return; }
    if (name !== curName) return start(name);
    if (cur && cur.duration && cur.currentTime > cur.duration - TAIL) start(name);   // 首尾交叉淡化
    else if (cur && cur.paused && cur.readyState > 1) cur.play().catch(() => { });
  }
  function sting(name) {
    if (!files.has(name) || !master()) return; const a = make(name); stinger = a; if (cur) fade(cur, master() * .15, .4);
    const done = () => { if (stinger === a) stinger = null; a.src = ''; };
    a.onended = done; a.onerror = done; a.play().then(() => fade(a, master(), .2)).catch(done); setTimeout(done, 30000);
  }
  ctx.on('fx', type => { if (type === 'battle:win') sting('victory'); else if (type === 'battle:lose') sting('defeat'); });
  fetch('/__list?dir=assets/music').then(r => r.ok ? r.json() : []).then(list => {
    for (const f of list) { const m = /^([a-z0-9_]+)\.(mp3|wav|ogg|m4a)$/i.exec(f); if (m && !files.has(m[1].toLowerCase())) files.set(m[1].toLowerCase(), f); }
  }).catch(() => { }).finally(() => { ready = true; timer = setInterval(tick, 400); });
  addEventListener('pointerdown', () => { if (cur?.paused) cur.play().catch(() => { }); }, { passive: true });
  return {
    get level() { return level; }, setLevel(v) { level = Math.max(0, Math.min(1, +v || 0)); localStorage.setItem(KEY, String(level)); if (cur) cur.volume = master(); },
    get track() { return curName; }, get tracks() { return [...files.keys()]; }, pick, resolve, sting
  };
}
