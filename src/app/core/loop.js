import { updateTweens } from './tween.js';

const callbacks = new Set();
let last = 0, running = false, renderFn = null, elapsed = 0;
export const stats = { frameMs: 16.7, updateMs: 0, renderMs: 0, samples: [], profile: null };

export function onFrame(fn) { callbacks.add(fn); return () => callbacks.delete(fn); }
export function setRender(fn) { renderFn = fn; }
export function time() { return elapsed; }

function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  const rawMs = last ? now - last : 16.7;
  last = now;
  const dtMs = Math.min(100, rawMs), dt = dtMs / 1000;   // 上限 100ms：低帧率（软件渲染）下动画不至于变成 3–4 倍慢动作
  elapsed += dt;
  stats.frameMs += (rawMs - stats.frameMs) * .05;
  if (stats.samples.length >= 600) stats.samples.splice(0, 300);
  stats.samples.push(rawMs);
  const t0 = performance.now();
  updateTweens(dtMs);
  for (const fn of callbacks) fn(dt, elapsed);
  const t1 = performance.now();
  renderFn?.(dt, elapsed);
  const t2 = performance.now();
  stats.updateMs += (t1 - t0 - stats.updateMs) * .05;
  stats.renderMs += (t2 - t1 - stats.renderMs) * .05;
  if (stats.profile) stats.profile.push([rawMs, t1 - t0, t2 - t1]);
}

export function start() {
  if (running) return;
  running = true; last = 0;
  requestAnimationFrame(frame);
}
