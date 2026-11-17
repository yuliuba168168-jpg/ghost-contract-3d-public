import { play } from './core/audio.js';

export function installBridge(ctx) {
  const B = globalThis.GC_BRIDGE;
  B.sync = reason => {
    if (globalThis.GC.battle) ctx.battle.sync();
    ctx.screens?.onSync?.(reason);
  };
  B.fx = (type, payload) => {
    if (type === 'sound') { play(payload?.kind); return Promise.resolve(); }
    try { return Promise.resolve(ctx.director?.handle(type, payload || {})).catch(err => { console.error('[fx]', type, err); }); }
    catch (err) { console.error('[fx]', type, err); return Promise.resolve(); }
  };
  B.ui = (screen, params) => {
    if (ctx.screens) ctx.screens.show(screen, params);
    else if (screen === 'battle') { ctx.rig.goTo('battle', { dur: 900 }); ctx.battle.sync(); }
  };
  B.notify = (text, kind) => {
    if (ctx.screens?.toast) ctx.screens.toast(text, kind); else console.info('[notify]', kind, text);
  };
}
