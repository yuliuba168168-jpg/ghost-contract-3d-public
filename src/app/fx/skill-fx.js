import * as THREE from 'three';
import { tween, wait } from '../core/tween.js';
import { play } from '../core/audio.js';
import { LANES_X, ROW_Z } from '../scene/table.js';
import { createEmblems } from './emblems.js';
import { SIGS, SIG_ALIAS, REACT_EMBLEM } from './skill-sig.js';

export const THEME_COLORS = {
  domain: '#6a4dff', fate: '#ffd98a', umbrella: '#c9a0ff', scarlet: '#ff3b30', eye: '#ff5a40', ice: '#bfe6ff', shield: '#dfe6ff', ghostfire: '#7f8cff',
  smoke: '#c98a9a', wedding: '#ff8a70', mirror: '#c9d0ff', void: '#8a86a8', ink: '#e9e2d0', heal: '#b9f2d0', analysis: '#9fb0ff', phoenix: '#ffb066',
  queen: '#ffd98a', pyramid: '#ffcf7a', clock: '#d9c38a', love: '#ffb0c0', water: '#8fd0ff', mask: '#c9a0ff', army: '#8f9bff', gate: '#6a4dff',
  memory: '#e9e2d0', butterfly: '#c08cff', lifeline: '#ff8a8a', dream: '#a9b8ff', cloud: '#dfe6ff', lotus: '#e6f0ff', fox: '#ffb066', despair: '#2a2a36',
  inferno: '#ff5a2a', space: '#9a7cf0', royal: '#3dff9a', reincarnation: '#dfe6ff', underworld: '#7f8cff', moon: '#e6ecff', divinefire: '#ffd98a', bloodsacrifice: '#ff2a2a'
};
export function themeColor(theme) { return THEME_COLORS[theme] || '#9fb0ff'; }
export const STRONG = new Set(['鬼门关降临', '绝望', '鬼主权杖', '轮回', '半完全火焰规律', '不完全火焰规律', '寂灭蝶珠', '云梦泽+', '画卷绝杀', '英灵领域', '女王领域', '时间删除']);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function castSkillFx(ctx, p, H) {
  const { battle: view, particles: P, overlay: O, rig, table, opponent, props } = ctx;
  const S = view.byRef(p.source), enemySide = p.source?.side === 'enemy', color = themeColor(p.theme), strong = STRONG.has(p.name);
  const targets = (p.targets || []).map(r => view.byRef(r)).filter(Boolean);
  const others = targets.filter(t => t !== S);
  const origin = S ? H.chest(S) : V(0, 1, enemySide ? ROW_Z.enemy : ROW_Z.ally);
  const hit = (t, amount = 1) => {
    t.app.flash(color, 1.1 * amount, 420); t.card.flash(color, .7 * amount, 360);
    P.ring(H.cardPos(t), { color, radius: .9 + amount * .3, dur: 480 });
    table.pulseSlot(t.side, t.lane, 1 + amount * .5);
    if (t.side !== (enemySide ? 'enemy' : 'ally')) H.shakeEntity(t, .05 * amount, 260);
  };
  const g = ctx.R.grade;
  const E = ctx.emblems ||= createEmblems(ctx), sig = SIGS[SIG_ALIAS[p.name] || p.name.replace(/\++$/, '')], foeSide = enemySide ? 'ally' : 'enemy';
  const env = { ctx, P, O, E, rig, props, H, S, origin, list: others, all: targets.length ? targets : (S ? [S] : []), foeSide, foeZ: ROW_Z[foeSide], hit };

  O.caption(p.name, { tone: enemySide ? 'enemy' : 'ally', dur: strong ? 1500 : 1150 });
  play(strong ? 'dread' : 'skill');
  if (S) {
    S.card.setHighlight('acting');
    S.app.flash(color, 1.3, 560);
    P.pillar(H.cardPos(S), { color, radius: .55, height: strong ? 3.6 : 2.6, dur: 820 });
    P.rise(H.cardPos(S), { count: strong ? 26 : 14, color, radius: .45, speed: 1.2 });
    table.pulseSlot(S.side, S.lane, 1.6);
    tween(S.app.group.position, { y: S.app.group.position.y + .22 }, { dur: 260, ease: 'outCubic' });
  }
  if (strong) { rig.kick(2.2, 700); tween(g.uEdgeDark, { value: .55 }, { dur: 240 }); }
  await wait(strong ? 420 : 280);

  const motion = p.motion;
  if (p.name === '绝望') {
    play('dread');
    await Promise.all([tween(g.uDesat, { value: .88 }, { dur: 700 }), tween(g.uEdgeDark, { value: .85 }, { dur: 700 })]);
    for (const e of view.units.values()) { e.app.flash('#000000', 0, 10); P.burst(H.chest(e), { count: 14, color: '#3a3a48', speed: 1.5, gravity: -.6, life: 1.1, size: .1 }); H.shakeEntity(e, .05, 400); }
    for (const t of others) { await P.bolt(H.chest(t).setY(3.4), H.chest(t), { color: '#6b6b80', arc: 0, dur: 200, size: .9 }); hit(t, 1.2); }
    rig.shake(.12, 600);
    ctx.status?.setDespair(true);
  } else if (p.name === '鬼主权杖') {
    g.uFlash.value.set('#3dff9a'); tween(g.uFlashAmt, { value: .5 }, { dur: 120 }).then(() => wait(700)).then(() => tween(g.uFlashAmt, { value: 0 }, { dur: 200 }));
    for (const t of others) { P.pillar(H.cardPos(t), { color: '#3dff9a', radius: .8, height: 4.2, dur: 1000 }); P.ring(H.cardPos(t), { color: '#3dff9a', radius: 1.8, dur: 900 }); }
    await wait(380);
    for (const t of others) { await P.bolt(H.chest(t).setY(4), H.chest(t), { color: '#3dff9a', arc: 0, dur: 180, size: 1.2 }); hit(t, 1.6); P.burst(H.chest(t), { count: 40, colors: ['#3dff9a', '#ffffff'], speed: 2.8 }); }
    rig.shake(.14, 520); play('crit');
    await wait(420);
  } else if (sig) {
    await sig(env);
  } else if (motion === 'ray' || motion === 'slash') {
    for (const t of others) {
      const n = motion === 'slash' ? 3 : 1;
      await P.bolt(origin, H.chest(t), { color, arc: .15, dur: 200, size: .8, trail: 5, ease: 'inCubic' });
      for (let i = 0; i < n; i++) { P.slash(H.chest(t), rig.camera, { color, length: 2 + i * .2, angle: -.8 + i * .5 }); if (n > 1) await wait(90); }
      P.burst(H.chest(t), { count: 24, colors: [color, '#ffffff'], speed: 2.2 }); hit(t, 1.2); rig.shake(.06, 260); play('hit');
    }
  } else if (motion === 'orbs' || motion === 'fan' || motion === 'ribbon') {
    const list = others.length ? others : targets;
    await Promise.all(list.map((t, i) => wait(i * 90).then(async () => {
      const k = motion === 'orbs' ? 3 : 1;
      await Promise.all(Array.from({ length: k }, (_, j) => wait(j * 70).then(() => P.bolt(origin, H.chest(t), { color, arc: motion === 'ribbon' ? 1.3 : .7 + j * .3, side: (j - (k - 1) / 2) * .9 + (motion === 'fan' ? (i - (list.length - 1) / 2) * .3 : 0), dur: motion === 'ribbon' ? 520 : 400, size: .5, trail: motion === 'ribbon' ? 6 : 3, ease: 'inOutQuad' }))));
      hit(t); P.burst(H.chest(t), { count: 12, color, speed: 1.4 }); play('flame');
    })));
    if (!list.length) P.ring(origin, { color, radius: 1.6, vertical: true });
  } else if (motion === 'scan' || motion === 'sweep') {
    const row = others.length ? others[0].side : (enemySide ? 'ally' : 'enemy'), z = ROW_Z[row], dir = enemySide ? -1 : 1;
    const head = P.glowSprite(color, motion === 'sweep' ? 2.4 : 1.2, .9), s = { x: -3.4 * dir };
    head.position.set(s.x, .5, z);
    const pending = new Set(others);
    play('whoosh');
    await tween(s, { x: 3.4 * dir }, {
      dur: motion === 'sweep' ? 620 : 520, ease: 'inOutQuad', onUpdate: () => {
        head.position.x = s.x;
        for (let i = 0; i < (motion === 'sweep' ? 5 : 2); i++) P.emit(V(s.x + (Math.random() - .5) * .3, .15 + Math.random() * (motion === 'sweep' ? 1.1 : .5), z + (Math.random() - .5) * 1.2), V(-dir * (1 + Math.random()), Math.random() * .8, (Math.random() - .5) * .6), { color, size: .08, life: .6, drag: 1.5 });
        for (const t of pending) if ((s.x - LANES_X[t.lane]) * dir >= 0) { pending.delete(t); hit(t, motion === 'sweep' ? 1.2 : .9); if (motion === 'sweep') P.burst(H.chest(t), { count: 14, color, speed: 1.6 }); }
      }
    });
    head.removeFromParent(); head.material.dispose();
    for (const t of pending) hit(t);
    if (motion === 'sweep') rig.shake(.05, 300);
  } else if (motion === 'drop') {
    const list = others.length ? others : targets;
    await Promise.all(list.map((t, i) => wait(i * 80).then(async () => {
      await P.bolt(H.chest(t).setY(4.2), H.cardPos(t).setY(.2), { color, arc: 0, dur: 260, size: 1.3, trail: 6, ease: 'inCubic' });
      P.pillar(H.cardPos(t), { color, radius: .7, height: 3.4, dur: 700 }); P.burst(H.cardPos(t).setY(.2), { count: 24, color, speed: 2.4, flat: true, gravity: 0, drag: 2 }); hit(t, 1.5); play('hit');
    })));
    rig.shake(strong ? .14 : .08, 420);
  } else if (motion === 'implode') {
    for (const t of others) {
      const c = H.chest(t);
      for (let i = 0; i < 36; i++) { const a = Math.random() * 6.28, r = 1.2 + Math.random() * .6, from = V(c.x + Math.cos(a) * r, c.y + (Math.random() - .5) * 1.2, c.z + Math.sin(a) * r); P.emit(from, V((c.x - from.x) * 3.2, (c.y - from.y) * 3.2, (c.z - from.z) * 3.2), { color, size: .08, life: .32, drag: 0 }); }
      await wait(320);
      P.flare(c, { color, scale: 3, dur: 420 }); P.burst(c, { count: 40, colors: [color, '#ffffff'], speed: 3 }); hit(t, 1.6); rig.shake(.1, 360); play('crit');
    }
  } else if (motion === 'clock' || motion === 'split' || motion === 'veil') {
    for (const t of (others.length ? others : targets)) {
      const c = H.chest(t);
      await P.bolt(origin, c, { color, arc: .6, dur: 300, size: .5 });
      for (let k = 0; k < 3; k++) { P.ring(c, { color, radius: .5 + k * .32, vertical: true, dur: 500 + k * 140 }); }
      if (motion === 'split') { P.slash(c, rig.camera, { color, length: 2, angle: .78 }); P.slash(c, rig.camera, { color, length: 2, angle: -.78 }); }
      if (motion === 'veil') props.puff(c, { color: '#6a6ad0', size: 1.4, rise: .3, dur: 1400 });
      hit(t); play('paper');
      await wait(140);
    }
  } else if (motion === 'fold' || motion === 'wave' || motion === 'echo' || motion === 'fade' || motion === 'rise') {
    const list = targets.length ? targets : (S ? [S] : []);
    for (const t of list) {
      const c = H.chest(t);
      if (motion === 'fold') { for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + .78; P.bolt(V(c.x + Math.cos(a) * 1.4, c.y + Math.sin(a) * 1.1, c.z), c, { color, arc: 0, dur: 260, size: .45 }); } await wait(260); P.ring(c, { color, radius: .95, vertical: true, dur: 700 }); }
      else if (motion === 'wave') { for (let k = 0; k < 3; k++) { P.ring(H.cardPos(t), { color, radius: .8 + k * .5, dur: 600 }); await wait(110); } }
      else if (motion === 'echo') { for (let k = 0; k < 3; k++) { t.app.flash(color, 1, 220); P.ring(c, { color, radius: .6 + k * .25, vertical: true, dur: 380 }); await wait(130); } }
      else if (motion === 'fade') { props.puff(c, { color: '#c2463a', size: 1.2, rise: .7 }); P.burst(c, { count: 16, color, speed: 1.3, gravity: .5 }); }
      else { P.pillar(H.cardPos(t), { color, radius: .65, height: 3.2, dur: 900 }); P.rise(H.cardPos(t), { count: 24, color, radius: .5, speed: 1.4 }); }
      hit(t, .8);
    }
  } else {
    const c = S ? H.cardPos(S) : V(0, 0, 0);
    P.ring(c, { color, radius: 3.6, dur: 900 }); P.ring(c, { color, radius: 2.2, dur: 700 });
    await wait(200);
    for (const t of targets) { hit(t, .9); P.pillar(H.cardPos(t), { color, radius: .5, height: 2.2, dur: 700 }); }
    if (p.scope === 'board') ctx.atmosphere.mist.material.uniforms.uColor.value.set(color);
  }

  if (p.name !== '绝望') tween(g.uEdgeDark, { value: ctx.status?.despair ? .85 : 0 }, { dur: 500 });
  if (S) { tween(S.app.group.position, { y: .03 }, { dur: 300, ease: 'inCubic' }); S.card.setHighlight(null); }
  await wait(strong ? 320 : 180);
}

export function reactFx(ctx, p, H) {
  const { battle: view, particles: P, overlay: O } = ctx;
  const ent = p.uid ? view.get(p.uid) : null;
  if (!ent) return;
  const def = globalThis.GC.VFX?.definitions?.[p.name], color = themeColor(def?.theme);
  if (p.name === '死亡') return;
  if (H.recently('react:' + p.uid + p.name, 350)) return;
  H.mark('react:' + p.uid + p.name);
  ent.app.flash(color, .8, 360);
  const em = REACT_EMBLEM[p.name] || REACT_EMBLEM[String(p.name).replace(/\++$/, '')];
  if (em) (ctx.emblems ||= createEmblems(ctx)).show(em, H.chest(ent).add(new THREE.Vector3(0, .45, 0)), { color: def ? color : '#ff5a40', size: 1, dur: 720 });
  P.ring(H.chest(ent), { color, radius: .7, vertical: true, dur: 420 });
  if (p.label && !H.recently('rl:' + p.uid, 600)) { H.mark('rl:' + p.uid); O.floatText(H.chest(ent).setY(1.55), p.label, { kind: 'info' }); }
}
