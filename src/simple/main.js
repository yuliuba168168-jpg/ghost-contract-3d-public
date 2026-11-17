// 方块版：不创建 WebGL、不加载 3D 场景。规则层与全部 DOM 面板（ui/screens.js）与完整版共用，
// 牌桌、路线图、演出换成纯色方块和文字。入口 simple.html，说明见 docs/simple.md。
import { createScreens } from '../app/ui/screens.js';
import { loadAssets } from '../app/core/assets.js';
import { play, unlockAudio } from '../app/core/audio.js';
import { installBridge } from '../app/bridge-impl.js';
import { createSimpleBattle } from './battle.js';
import { createSimpleMap } from './map.js';

const noop = () => { };
async function boot() {
  const bootEl = document.getElementById('boot'), ui = document.getElementById('ui');
  await loadAssets().catch(noop);
  const listeners = new Map();
  const toasts = document.createElement('div'); toasts.className = 'toasts'; ui.append(toasts);
  const ctx = {
    simple: true, params: new URLSearchParams(location.search), battleActive: false,
    on(name, fn) { (listeners.get(name) || listeners.set(name, []).get(name)).push(fn); },
    emit(name, ...args) { for (const fn of listeners.get(name) || []) { try { fn(...args); } catch (e) { console.error('[hook]', name, e); } } },
    // 以下是完整版 3D 对象的空壳，screens.js 会调用它们
    R: { hud: false, grade: { uDesat: { value: 0 }, uEdgeDark: { value: 0 } } },
    rig: { goTo: noop, set: noop, shake: noop },
    props: { setLife: noop, setQi: noop, urn: { setCount: noop }, deck: { setCount: noop }, artifacts: [] },
    opponent: { reset: noop, play: noop }, lights: { state: { dim: 1 } }, status: { setDespair: noop },
    cine: { mode: 'table', modeName: '仅牌桌', setMode: noop, cycle: noop, active: false },
    overlay: {
      hint: noop,
      toast(text, kind = 'info') { const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = text; toasts.append(d); while (toasts.children.length > 4) toasts.firstChild.remove(); setTimeout(() => d.remove(), 2600); }
    },
    makeStoryStage: () => ({ show: noop, update: noop, warm: noop, active: false }),
    makeMapView: (c, host) => createSimpleMap(c, host)
  };
  const sb = createSimpleBattle(ctx, ui);
  ctx.battle = sb.view; ctx.director = sb.director; ctx.input = { hideTags: noop, hideTip: noop };
  ctx.overlay.hint = sb.hint;
  ctx.screens = createScreens(ctx);
  ctx.music = (await import('../app/core/music.js')).createMusic(ctx);
  installBridge(ctx);
  setInterval(() => ctx.screens.update(.1, performance.now() / 1000), 100);
  addEventListener('pointerdown', unlockAudio, { once: true });
  addEventListener('keydown', unlockAudio, { once: true });
  addEventListener('contextmenu', e => e.preventDefault());
  globalThis.__gc = ctx;
  globalThis.GC.boot();
  bootEl.remove();
  globalThis.__ready = true;
}
boot().catch(err => { console.error(err); const t = document.getElementById('bootText'); if (t) t.textContent = '启动失败：' + (err?.message || err); });
