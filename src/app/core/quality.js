const KEY = 'gc3d-quality-v3';
export const LEVELS = {
  cinema: { name: 'cinema', pixels: 4.2e6, minScale: .85, bloom: true, shadows: true, softShadows: true, shadowSize: 2048, candleShadowSize: 2048, candleShadows: 2, shadowEvery: 1, bloomScale: .85, candles: 3, dust: 600, fog: 3, mist: 24, ao: true, dof: true },
  high: { name: 'high', pixels: 2.1e6, minScale: .72, bloom: true, shadows: true, softShadows: true, shadowSize: 1024, candleShadowSize: 1024, candleShadows: 2, shadowEvery: 2, bloomScale: .75, candles: 3, dust: 420, fog: 3, mist: 18, ao: true, dof: true },
  medium: { name: 'medium', pixels: 1.5e6, minScale: .75, bloom: true, shadows: true, softShadows: false, shadowSize: 512, candleShadowSize: 512, candleShadows: 0, shadowEvery: 2, bloomScale: .5, candles: 2, dust: 220, fog: 2, mist: 14, ao: false, dof: false },
  low: { name: 'low', pixels: 1.0e6, minScale: .7, bloom: false, shadows: false, softShadows: false, shadowSize: 256, candleShadowSize: 256, candleShadows: 0, shadowEvery: 4, bloomScale: .5, candles: 1, dust: 90, fog: 1, mist: 10, ao: false, dof: false }
};
LEVELS.lite = { name: 'lite', pixels: 1.0e6, minScale: .75, bloom: false, shadows: false, softShadows: false, shadowSize: 256, candleShadowSize: 256, candleShadows: 0, shadowEvery: 8, bloomScale: .5, candles: 1, dust: 0, fog: 0, mist: 0, ao: false, dof: false };
export const LITE = new URLSearchParams(location.search).get('lite') === '1';
export const view = { h: innerHeight, pr: 1, scale: 1 };
const listeners = new Set();
let current = LEVELS.cinema, locked = false;

export function initQuality() {
  if (LITE) { current = LEVELS.lite; locked = true; return current; }
  const forced = new URLSearchParams(location.search).get('q');
  const saved = forced || localStorage.getItem(KEY);
  if (saved && LEVELS[saved]) { current = LEVELS[saved]; locked = !!forced || localStorage.getItem(KEY + '-locked') === '1'; }
  else if (Math.min(innerWidth, innerHeight) < 500) current = LEVELS.medium;
  return current;
}
export function quality() { return current; }
export function qualityLocked() { return locked; }
export function onQuality(fn) { listeners.add(fn); }
export function setQuality(name, lock = true) {
  if (!LEVELS[name]) return;
  const changed = current.name !== name;
  current = LEVELS[name]; locked = lock;
  localStorage.setItem(KEY, name);
  if (lock) localStorage.setItem(KEY + '-locked', '1'); else localStorage.removeItem(KEY + '-locked');
  if (changed) for (const fn of listeners) fn(current);
}
export function autoQuality() {
  for (const k of Object.keys(localStorage)) if (k.startsWith(KEY)) localStorage.removeItem(k);
  const changed = current !== LEVELS.cinema;
  current = LEVELS.cinema; locked = false;
  for (const fn of listeners) fn(current, changed);
}
export function lowerQuality() {
  if (locked || current.name === 'low') return false;
  setQuality({ cinema: 'high', high: 'medium' }[current.name] || 'low', false);
  return true;
}
export function savedScale() { const v = +localStorage.getItem(KEY + '-scale-' + current.name); return v >= current.minScale && v <= 1 ? v : 1; }
export function saveScale(v) { localStorage.setItem(KEY + '-scale-' + current.name, String(v)); }
