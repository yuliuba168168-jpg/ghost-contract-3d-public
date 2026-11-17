const active = new Set();
const timers = new Set();

export const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inExpo: t => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inBack: t => 2.70158 * t * t * t - 1.70158 * t * t,
  outBack: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1),
  outBounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
    return n * (t -= 2.625 / d) * t + .984375;
  },
  sine: t => Math.sin(t * Math.PI)
};

export function speed() {
  return Math.max(.25, Number(globalThis.GC?.preferences?.speed) || 1);
}

export function tween(target, to, opts = {}) {
  const { dur = 400, delay = 0, onUpdate, raw = false } = opts;
  const fn = typeof opts.ease === 'function' ? opts.ease : ease[opts.ease || 'outCubic'];
  return new Promise(resolve => {
    const item = { target, to, from: null, dur: Math.max(1, dur), delay, t: 0, fn, onUpdate, resolve, raw };
    active.add(item);
  });
}

export function wait(ms, raw = false) {
  return new Promise(resolve => timers.add({ left: ms, resolve, raw }));
}

export function kill(target) {
  for (const item of active) if (item.target === target) { active.delete(item); item.resolve(false); }
}

export function updateTweens(dtMs) {
  const k = speed();
  for (const timer of timers) {
    timer.left -= dtMs * (timer.raw ? 1 : k);
    if (timer.left <= 0) { timers.delete(timer); timer.resolve(); }
  }
  for (const item of active) {
    const step = dtMs * (item.raw ? 1 : k);
    if (item.delay > 0) { item.delay -= step; continue; }
    if (!item.from) {
      item.from = {};
      for (const key of Object.keys(item.to)) item.from[key] = item.target[key];
    }
    item.t = Math.min(1, item.t + step / item.dur);
    const e = item.fn(item.t);
    for (const key of Object.keys(item.to)) item.target[key] = item.from[key] + (item.to[key] - item.from[key]) * e;
    item.onUpdate?.(e, item.t);
    if (item.t >= 1) { active.delete(item); item.resolve(true); }
  }
}

export function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, a = 0, b = 1) { return Math.min(b, Math.max(a, v)); }

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
