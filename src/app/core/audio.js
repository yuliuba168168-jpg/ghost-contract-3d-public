let ctx = null, master = null, ambience = null;

function prefs() { return globalThis.GC?.preferences || {}; }
function ensure() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  return ctx;
}
function volume() { const p = prefs(); return p.sound === false ? 0 : (p.volume ?? .55); }

function tone({ type = 'sine', from = 220, to = from, dur = .2, gain = .2, delay = 0, attack = .005 }) {
  const t = ctx.currentTime + delay, osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + dur + .05);
}

let noiseBuffer = null;
function noise({ dur = .2, gain = .2, freq = 1200, q = .8, delay = 0, type = 'bandpass', sweep = 0 }) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuffer; src.loop = true;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + .01);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + .05);
}

const CUES = {
  click: () => { tone({ type: 'triangle', from: 520, to: 380, dur: .07, gain: .08 }); },
  hover: () => { noise({ dur: .05, gain: .03, freq: 3200, q: 2 }); },
  draw: () => { noise({ dur: .16, gain: .12, freq: 2400, q: .7, sweep: 2600 }); },
  deploy: () => { noise({ dur: .12, gain: .22, freq: 300, q: .6, type: 'lowpass' }); tone({ from: 110, to: 58, dur: .22, gain: .3 }); tone({ type: 'triangle', from: 660, to: 990, dur: .5, gain: .05, delay: .05 }); },
  move: () => { noise({ dur: .18, gain: .1, freq: 900, q: .5, sweep: 900 }); },
  hit: () => { noise({ dur: .14, gain: .32, freq: 420, q: .5, type: 'lowpass' }); tone({ type: 'square', from: 150, to: 44, dur: .16, gain: .16 }); },
  crit: () => { noise({ dur: .22, gain: .4, freq: 700, q: .4, type: 'lowpass' }); tone({ type: 'sawtooth', from: 240, to: 40, dur: .28, gain: .2 }); tone({ from: 1320, to: 880, dur: .3, gain: .06 }); },
  skill: () => { tone({ from: 196, to: 392, dur: .5, gain: .12 }); tone({ type: 'triangle', from: 294, to: 587, dur: .6, gain: .08, delay: .06 }); noise({ dur: .5, gain: .06, freq: 1800, q: 1.5, sweep: 2400 }); },
  revive: () => { [392, 523, 659, 784].forEach((f, i) => tone({ from: f, dur: .5, gain: .08, delay: i * .08 })); },
  death: () => { noise({ dur: .7, gain: .16, freq: 1600, q: .6, sweep: -1400 }); tone({ from: 220, to: 55, dur: .7, gain: .12 }); },
  bell: () => { [1046, 1568, 2093, 2637].forEach((f, i) => tone({ from: f, to: f * .995, dur: 1.6 - i * .25, gain: .09 / (i + 1), attack: .002 })); noise({ dur: .04, gain: .1, freq: 4000, q: 1 }); },
  turn: () => { tone({ from: 146, to: 146, dur: .9, gain: .14 }); tone({ from: 220, to: 219, dur: .9, gain: .07, delay: .02 }); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'triangle', from: f, dur: .9, gain: .1, delay: i * .12 })); },
  lose: () => { [330, 262, 196, 131].forEach((f, i) => tone({ from: f, dur: 1, gain: .12, delay: i * .18 })); },
  upgrade: () => { [440, 554, 659, 880].forEach((f, i) => tone({ type: 'triangle', from: f, dur: .4, gain: .08, delay: i * .06 })); },
  reward: () => { tone({ from: 880, to: 1320, dur: .35, gain: .08 }); tone({ from: 1320, to: 1760, dur: .4, gain: .06, delay: .1 }); },
  rustle: () => { noise({ dur: .55, gain: .05, freq: 3400, q: .7, sweep: -1600 }); noise({ dur: .3, gain: .035, freq: 5200, q: 1.2, delay: .12 }); },
  hush: () => { noise({ dur: 1.3, gain: .05, freq: 1500, q: .4, type: 'bandpass', sweep: 1800 }); },
  ember: () => { noise({ dur: .9, gain: .05, freq: 420, q: .5, type: 'lowpass', sweep: 500 }); tone({ type: 'sine', from: 180, to: 120, dur: .6, gain: .025 }); },
  stamp: () => { tone({ type: 'sine', from: 120, to: 62, dur: .22, gain: .16 }); noise({ dur: .12, gain: .08, freq: 300, q: .6, type: 'lowpass' }); },
  flame: () => { noise({ dur: .35, gain: .12, freq: 700, q: .4, sweep: 900 }); },
  paper: () => { noise({ dur: .2, gain: .1, freq: 2600, q: .9, sweep: -1200 }); },
  whoosh: () => { noise({ dur: .3, gain: .16, freq: 500, q: .6, sweep: 2200 }); },
  dread: () => { tone({ type: 'sawtooth', from: 55, to: 41, dur: 1.4, gain: .14 }); noise({ dur: 1.4, gain: .08, freq: 200, q: .4, type: 'lowpass' }); }
};

export function play(kind) {
  if (!ensure() || ctx.state === 'suspended' && !unlocked) return;
  master.gain.value = volume();
  if (master.gain.value <= 0) return;
  try { (CUES[kind] || CUES.click)(); } catch { }
}

let unlocked = false;
export function unlockAudio() {
  if (unlocked || !ensure()) return;
  unlocked = true;
  ctx.resume?.();
  startAmbience();
}

function startAmbience() {
  if (ambience || !ctx) return;
  const g = ctx.createGain(); g.gain.value = .0001; g.connect(master);
  const mk = (f, type, gain) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f; og.gain.value = gain; o.connect(og); og.connect(g); o.start(); return o; };
  const a = mk(55, 'sine', .5), b = mk(82.6, 'sine', .22), c = mk(110.4, 'triangle', .08);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = 1.2; lfo.connect(lg); lg.connect(b.frequency); lfo.start();
  g.gain.exponentialRampToValueAtTime(.16, ctx.currentTime + 6);
  ambience = { g, nodes: [a, b, c, lfo] };
}

export function duck(level = 1, dur = .4) { if (!ctx || !ambience) return; const g = ambience.g.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(Math.max(.0001, g.value), t); g.linearRampToValueAtTime(Math.max(.0001, .16 * level), t + dur); }
