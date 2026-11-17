const KEY = 'gc3d-quality-v3';
export const LEVELS = {
  cinema: { name: 'cinema', pixels: 4.2e6, minScale: .85, bloom: true, shadows: true, softShadows: true, shadowSize: 2048, candleShadowSize: 2048, candleShadows: 2, shadowEvery: 1, bloomScale: .85, candles: 3, dust: 600, fog: 3, mist: 24, ao: true, dof: true },
  high: { name: 'high', pixels: 2.1e6, minScale: .72, bloom: true, shadows: true, softShadows: true, shadowSize: 1024, candleShadowSize: 1024, candleShadows: 2, shadowEvery: 2, bloomScale: .75, candles: 3, dust: 420, fog: 3, mist: 18, ao: true, dof: true },
  medium: { name: 'medium', pixels: 1.5e6, minScale: .75, bloom: true, shadows: true, softShadows: false, shadowSize: 512, candleShadowSize: 512, candleShadows: 0, shadowEvery: 2, bloomScale: .5, candles: 2, dust: 220, fog: 2, mist: 14, ao: false, dof: false },
  low: { name: 'low', pixels: 1.0e6, minScale: .7, bloom: false, shadows: false, softShadows: false, shadowSize: 256, candleShadowSize: 256, candleShadows: 0, shadowEvery: 4, bloomScale: .5, candles: 1, dust: 90, fog: 1, mist: 10, ao: false, dof: false }
};
LEVELS.lite = { name: 'lite', pixels: 1.0e6, minScale: .75, bloom: false, shadows: false, softShadows: false, shadowSize: 256, candleShadowSize: 256, candleShadows: 0, shadowEvery: 8, bloomScale: .5, candles: 1, dust: 0, fog: 0, mist: 0, ao: false, dof: false };
// 极简档：给没有显卡加速（软件渲染）的浏览器用。软件渲染的帧时间几乎只跟像素数成正比（实测约 0.2 秒/百万像素），
// 所以这一档把渲染分辨率压到约 22 万像素、关掉全部后期，并跳过启动预热。
LEVELS.potato = { name: 'potato', pixels: 2.2e5, minScale: .7, bloom: false, shadows: false, softShadows: false, shadowSize: 256, candleShadowSize: 256, candleShadows: 0, shadowEvery: 8, bloomScale: .5, candles: 1, dust: 0, fog: 0, mist: 0, ao: false, dof: false, plain: true };
// 浏览器实际使用的显卡；software = 软件渲染（Microsoft Basic Render Driver / SwiftShader / llvmpipe 等）
export const gpu = (() => {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { renderer: '', software: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info'), renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { renderer, software: /basic render|swiftshader|llvmpipe|software|warp|softpipe/i.test(renderer) };
  } catch { return { renderer: '', software: false }; }
})();
export const LITE = new URLSearchParams(location.search).get('lite') === '1';
export const view = { h: innerHeight, pr: 1, scale: 1 };
const listeners = new Set();
let current = LEVELS.cinema, locked = false;

export function initQuality() {
  if (LITE) { current = LEVELS.lite; locked = true; return current; }
  const forced = new URLSearchParams(location.search).get('q');
  const saved = forced || localStorage.getItem(KEY);
  if (saved && LEVELS[saved]) { current = LEVELS[saved]; locked = !!forced || localStorage.getItem(KEY + '-locked') === '1'; }
  if (gpu.software && !locked) current = LEVELS.potato;
  else if (!locked && Math.min(innerWidth, innerHeight) < 500 && (current.name === 'cinema' || current.name === 'high')) current = LEVELS.medium;   // 窄屏只往下压，不覆盖玩家锁定的档位
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
  const auto = gpu.software ? LEVELS.potato : LEVELS.cinema, changed = current !== auto;
  current = auto; locked = false;
  for (const fn of listeners) fn(current, changed);
}
export function lowerQuality() {
  // 逐档自动降到 low 为止：30Hz 屏幕 / 省电模式下每帧恒为 33ms，不能因此一路降到极简。极简只留给软件渲染和 floorQuality（连续多帧 >250ms）
  const next = { cinema: 'high', high: 'medium', medium: 'low' }[current.name];
  if (locked || !next) return false;
  setQuality(next, false);
  return true;
}
export function savedScale() { const v = +localStorage.getItem(KEY + '-scale-' + current.name); return v >= current.minScale && v <= 1 ? v : 1; }
export function saveScale(v) { localStorage.setItem(KEY + '-scale-' + current.name, String(v)); }
// 连续多帧都慢到 1/4 秒以上（软件渲染或显卡极弱）：不逐档试，直接落到极简档
export function floorQuality() { if (locked || current.name === 'potato' || current.name === 'lite') return false; setQuality('potato', false); return true; }
