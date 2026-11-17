import * as THREE from 'three';
import { wait, tween } from '../core/tween.js';
import { play } from '../core/audio.js';
import { LANES_X } from '../scene/table.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), up = (v, d) => v.clone().add(V(0, d, 0));
const each = (list, fn, gap = 80) => Promise.all(list.map((t, i) => wait(i * gap).then(() => fn(t, i))));
export const SIG_ALIAS = { '不完全火焰规律': '火凤燎原', '半完全火焰规律': '火凤燎原' };
export const REACT_EMBLEM = { '闪遁': '囍', '无解闪遁': '囍', '圣灵闪遁': '囍', '不完全因果律': 'wheel', '半完全因果律': 'wheel', '完全因果律': 'wheel', '前世': '世', '人类规律': 'heart', '梦的规律': 'moon', '爱的规律': 'heart', '地狱之主': 'crown', '地府降临': 'bridge', '复仇': 'arrow', '无敌规律': 'skull', '佛系规律': 'lotus', '幻影蝶翼': 'butterfly', '鬼瞳': 'eye', '无解防御': 'hex', '伞分身': 'umbrella', '无象灵水躯': 'wave', '冰雪': 'snow', '狂怒': 'flame', '不死之躯': 'skull', '时间回退': 'clock', '鬼火': 'flame', '欺骗': 'fox', '神火': 'flame', '血祭增幅': 'drop', '英灵融合': 'wings' };
export const BOSS_EMBLEM = { slow: 'clock', shield: 'hex', summon: 'gate', strike: 'claw', mark: 'eye', heal: 'lotus', rage: 'flame', shift: 'portal', aoe: 'wave', drain: 'drop', curse: '咒', burn: 'flame', seal: 'chain', steal: '夺', chaos: 'yinyang', execute: 'sword', dread: 'skull', siphon: '蚀', purge: '净', fortify: 'hex' };

const form = (emblem, color) => async e => {
  e.E.show(emblem, up(e.origin, .15), { color, size: 2.3, dur: 950, ease: 'outElastic' });
  e.P.burst(e.origin, { count: 34, colors: [color, '#1a0206'], speed: 2.2, gravity: .6, up: 1.3, life: .9 });
  if (e.S) { e.S.card.flash(color, 1.1, 700); e.H.shakeEntity(e.S, .05, 400); e.hit(e.S, .6); }
  e.rig.shake(.05, 300); await wait(560);
};
const domain = (emblem, color) => async e => {
  const c = V(0, .04, -.3), m = e.E.make(emblem, c, { color, size: 7.2, flat: true, opacity: .8 });
  play('dread'); await e.E.open(m, 420, 'outCubic');
  e.P.ring(c, { color, radius: 4, dur: 900 }); e.ctx.atmosphere.mist.material.uniforms.uColor.value.set(color);
  await e.E.spin(m, .5, 700); if (e.S) e.hit(e.S, .8);
  await e.E.close(m, 400, 1.1);
};
export const SIGS = {
  '邪灵形态': form('wings', '#ff3b30'),
  '女武神形态': async e => { e.P.pillar(e.S ? e.H.cardPos(e.S) : e.origin, { color: '#ffd98a', radius: .8, height: 4, dur: 1000 }); await form('wings', '#ffd98a')(e); },
  '鬼瞳': async e => {
    const c = V(0, 1.75, e.foeZ), m = e.E.make('eye', c, { color: '#ff3b30', size: 3.6 });
    play('dread'); await e.E.open(m, 340);
    await each(e.list, async t => { await e.P.bolt(c, e.H.chest(t), { color: '#ff3b30', arc: 0, dur: 170, size: .5, trail: 4 }); e.E.show('eye', up(e.H.chest(t), .7), { color: '#ff5a40', size: .75, dur: 800 }); e.hit(t); }, 70);
    await wait(220); await e.E.close(m, 300);
  },
  '寒冰右手': async e => {
    for (const t of e.list) {
      const m = e.E.make('hand', e.origin, { color: '#bfe6ff', size: 1.3 }); await e.E.open(m, 200); play('whoosh');
      await e.E.move(m, e.H.chest(t), 260, 'inCubic'); e.E.close(m, 260, 1.8);
      e.E.show('snow', e.H.chest(t), { color: '#e6f6ff', size: 1.9, dur: 700, spin: .3 });
      e.P.burst(e.H.chest(t), { count: 34, colors: ['#bfe6ff', '#ffffff'], speed: 2.6 }); e.rig.shake(.08, 300); play('hit'); e.hit(t, 1.3);
    }
    await wait(260);
  },
  '无解防御': async e => {
    const c = e.origin;
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; e.P.bolt(V(c.x + Math.cos(a) * 1.5, c.y + Math.sin(a) * 1.2, c.z), c, { color: '#dfe6ff', arc: 0, dur: 280, size: .4 }); }
    await wait(280); play('paper'); if (e.S) e.hit(e.S, .8);
    await e.E.show('hex', c, { color: '#ff8a70', size: 1.9, dur: 900, spin: .16 });
  },
  '鬼域': domain('域', '#6a4dff'), '英灵领域': domain('wheel', '#ffd98a'), '伞域': domain('umbrella', '#c9a0ff'),
  '鬼火': async e => {
    for (const t of e.list) {
      await each([0, 1, 2], async i => { const m = e.E.make('flame', up(e.origin, .3), { color: '#7f8cff', size: .7 }); await e.E.open(m, 160); await e.E.move(m, up(e.H.chest(t), (i - 1) * .2), 380, 'inQuad'); e.E.close(m, 240, 2); e.P.burst(e.H.chest(t), { count: 12, colors: ['#7f8cff', '#dfe6ff'], speed: 1.5, gravity: 1.2, up: 1 }); play('flame'); }, 110);
      e.hit(t, 1.1); e.P.pillar(e.H.cardPos(t), { color: '#7f8cff', radius: .45, height: 2, dur: 800 });
    }
    await wait(200);
  },
  '鬼绣球': async e => {
    const c = V(0, 2.3, .4), m = e.E.make('ball', e.origin, { color: '#ff5a40', size: 1.3 });
    await e.E.open(m, 220); await Promise.all([e.E.move(m, c, 380), e.E.spin(m, 1, 500)]);
    await each(e.all, async t => { await e.P.bolt(c, e.H.chest(t), { color: '#ff3b30', arc: -.3, dur: 300, size: .35, trail: 6 }); e.hit(t, .8); }, 70);
    await e.E.close(m, 320);
  },
  '55开': async e => {
    for (const t of e.list) {
      const mid = e.origin.clone().lerp(e.H.chest(t), .5).setY(1.5), m = e.E.make('yinyang', mid, { color: '#c9d0ff', size: 1.7 });
      await e.E.open(m, 240); e.P.bolt(e.origin, mid, { color: '#ffffff', dur: 300, size: .5 }); e.P.bolt(e.H.chest(t), mid, { color: '#3a3a55', dur: 300, size: .5 });
      await e.E.spin(m, 1.5, 620); e.P.bolt(mid, e.origin, { color: '#c9d0ff', dur: 240, size: .6 }); e.hit(t); if (e.S) e.hit(e.S); await e.E.close(m, 300);
    }
  },
  '伞分身': async e => { play('paper'); await each(e.all, async t => { const m = e.E.make('umbrella', up(e.H.chest(t), 1.1), { color: '#c9a0ff', size: 1.3 }); await e.E.open(m, 260); e.E.move(m, up(e.H.chest(t), .45), 300); await e.E.spin(m, .5, 420); e.hit(t, .8); e.E.close(m, 300); }, 90); await wait(300); },
  '虚化': async e => {
    const m = e.E.make('虚', V(0, 1.5, e.foeZ), { color: '#8a86a8', size: 2.6 }); await e.E.open(m, 280);
    for (let k = 0; k < 3; k++) { for (const t of e.list) { t.app.flash('#8a86a8', .9, 150); t.card.group.position.x += (k % 2 ? -.07 : .07); } await wait(110); }
    for (const t of e.list) { t.card.group.position.x = LANES_X[t.lane]; e.hit(t, .7); }
    await e.E.close(m, 320, 1.6);
  },
  '画卷绝杀': async e => {
    for (const t of e.list) {
      const m = e.E.make('scroll', up(e.H.chest(t), .1), { color: '#e9e2d0', size: 1.6, aspect: .2 }); await e.E.open(m, 200);
      await tween(m.scale, { x: 2.6 }, { dur: 320, ease: 'outCubic' }); await wait(160); play('paper');
      await tween(m.scale, { x: .05 }, { dur: 140, ease: 'inCubic' }); e.E.close(m, 100);
      e.E.show('claw', e.H.chest(t), { color: '#ffffff', size: 2.2, dur: 500 }); e.P.burst(e.H.chest(t), { count: 40, colors: ['#e9e2d0', '#17131c'], speed: 2.8 }); e.rig.shake(.12, 360); play('crit'); e.hit(t, 1.5);
    }
    await wait(300);
  },
  '白虎驱邪纹': async e => { for (const t of e.all) { const m = e.E.make('虎', e.H.cardPos(t), { color: '#b9f2d0', size: 2, flat: true }); await e.E.open(m, 260); e.P.rise(e.H.cardPos(t), { count: 26, color: '#b9f2d0', radius: .5, speed: 1.3 }); e.E.show('claw', up(e.H.chest(t), .2), { color: '#ffffff', size: 1.1, dur: 600 }); play('revive'); await e.E.spin(m, .25, 450); e.hit(t, .8); await e.E.close(m, 300); } },
  '解析': async e => { for (const t of e.list) { const m = e.E.make('compass', up(e.H.chest(t), .1), { color: '#9fb0ff', size: 1.7 }); await e.E.open(m, 220); play('paper'); await e.E.spin(m, 1.25, 620); e.P.ring(e.H.cardPos(t), { color: '#9fb0ff', radius: 1, dur: 500 }); e.hit(t, .9); await e.E.close(m, 260, .6); } },
  '火凤燎原': async e => {
    const dir = e.foeSide === 'enemy' ? 1 : -1, m = e.E.make('phoenix', V(-4.2 * dir, 1.15, e.foeZ), { color: '#ffb066', size: 2.6 }), pending = new Set(e.list);
    await e.E.open(m, 200); play('flame'); const s = { x: -4.2 * dir };
    await tween(s, { x: 4.2 * dir }, { dur: 780, ease: 'inOutQuad', onUpdate: () => { m.position.x = s.x; for (let i = 0; i < 6; i++) e.P.emit(V(s.x - dir * Math.random() * .8, .2 + Math.random() * 1.2, e.foeZ + (Math.random() - .5)), V(-dir * (1 + Math.random() * 2), Math.random(), (Math.random() - .5) * .6), { color: Math.random() < .5 ? '#ffb066' : '#ff5a2a', size: .1, life: .7, drag: 1.2 }); for (const t of pending) if ((s.x - LANES_X[t.lane]) * dir >= 0) { pending.delete(t); e.hit(t, 1.3); e.P.pillar(e.H.cardPos(t), { color: '#ff7a3a', radius: .5, height: 2.2, dur: 600 }); play('flame'); } } });
    e.rig.shake(.07, 300); await e.E.close(m, 240);
  },
  '女王领域': async e => {
    const c = V(0, 2.9, e.foeZ), moon = e.E.make('moon', up(c, .2), { color: '#ffd98a', size: 3.2, opacity: .5 }), m = e.E.make('crown', c, { color: '#ffd98a', size: 2 });
    e.E.open(moon, 400); await e.E.open(m, 300); play('dread'); await e.E.move(m, V(0, 1.6, e.foeZ), 420, 'inCubic');
    e.P.ring(V(0, 0, e.foeZ), { color: '#ffd98a', radius: 3.6, dur: 800 }); e.rig.shake(.08, 360); for (const t of e.list) e.hit(t, 1.1);
    await wait(300); e.E.close(moon, 400); await e.E.close(m, 320);
  },
  '金字塔镇压': async e => { await each(e.list, async t => { const m = e.E.make('pyramid', up(e.H.chest(t), 2.6), { color: '#ffcf7a', size: 1.5 }); await e.E.open(m, 160); await e.E.move(m, up(e.H.cardPos(t), .55), 240, 'inCubic'); e.P.burst(e.H.cardPos(t), { count: 22, color: '#ffcf7a', speed: 2.3, flat: true, gravity: 0, drag: 2 }); e.rig.shake(.07, 240); play('hit'); e.hit(t, 1.3); e.E.close(m, 380, 1.1); }, 110); await wait(300); },
  '时间梦境': async e => { for (const t of e.list) { const m = e.E.make('clock', up(e.H.chest(t), .1), { color: '#d9c38a', size: 1.8 }); await e.E.open(m, 220); play('paper'); await e.E.spin(m, 2, 700); e.E.show('moon', up(e.H.chest(t), .8), { color: '#a9b8ff', size: .8, dur: 700 }); e.hit(t); await e.E.close(m, 300); } },
  '水分身': async e => { const w = e.E.make('wave', V(-3.6, .5, .7), { color: '#8fd0ff', size: 2.2 }); e.E.open(w, 200); play('whoosh'); e.E.move(w, V(3.6, .5, .7), 700).then(() => e.E.close(w, 200)); await each(e.all, async t => { e.E.show('drop', up(e.H.chest(t), .7), { color: '#8fd0ff', size: .9, dur: 800, to: e.H.chest(t) }); e.P.rise(e.H.cardPos(t), { count: 16, color: '#8fd0ff', radius: .45 }); e.hit(t, .8); }, 130); await wait(500); },
  '无象灵水躯': async e => { for (let k = 0; k < 3; k++) { e.E.show('wave', up(e.origin, (k - 1) * .35), { color: '#8fd0ff', size: 1.6, dur: 700 }); await wait(120); } if (e.S) { e.S.app.setOpacity(.3); wait(700).then(() => e.S.app.resetOpacity()); e.hit(e.S, .8); } play('whoosh'); await wait(420); },
  '丰都鬼军': async e => {
    const m = e.E.make('banner', up(e.origin, .6), { color: '#8f9bff', size: 1.9 }); await e.E.open(m, 260); play('dread');
    for (const t of e.list) await each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], async i => { await e.P.bolt(up(e.origin, .2), up(e.H.chest(t), (Math.random() - .5) * .6), { color: '#8f9bff', arc: .2, side: (i - 4.5) * .22, dur: 200, size: .35 }); e.P.slash(e.H.chest(t), e.rig.camera, { color: '#c9d0ff', length: 1.3, angle: Math.random() * 3 }); if (i % 3 === 0) { play('hit'); e.hit(t, .7); } }, 60);
    e.rig.shake(.08, 300); await e.E.close(m, 300);
  },
  '鬼门关降临': async e => {
    const m = e.E.make('gate', V(0, .4, e.foeZ - .5), { color: '#6a4dff', size: 5.2 }); play('dread'); e.E.open(m, 500, 'outCubic'); await e.E.move(m, V(0, 2, e.foeZ - .5), 520, 'outCubic'); e.rig.shake(.1, 500);
    await each(e.list, async t => { await e.P.bolt(V(0, 2, e.foeZ - .5), e.H.chest(t), { color: '#6a4dff', arc: 0, dur: 200, size: .7, trail: 8 }); e.E.show('chain', e.H.chest(t), { color: '#b9a8ff', size: 1.5, dur: 600 }); e.P.burst(e.H.chest(t), { count: 30, colors: ['#6a4dff', '#ffffff'], speed: 2.8 }); play('crit'); e.hit(t, 1.6); }, 90);
    e.rig.shake(.14, 420); await wait(260); await e.E.close(m, 400, 1.1);
  },
  '幻影蝶翼': async e => { play('paper'); await each([0, 1, 2, 3, 4, 5], async i => { const a = i / 6 * 6.28; await e.E.show('butterfly', e.origin, { color: '#c08cff', size: .7, dur: 800, to: V(e.origin.x + Math.cos(a) * 1.1, e.origin.y + Math.sin(a) * .8 + .2, e.origin.z), spin: .2 }); }, 50); if (e.S) e.hit(e.S, .7); },
  '寂灭蝶珠': async e => {
    for (const t of e.list) {
      const c = e.H.chest(t); await each([0, 1, 2, 3, 4, 5, 6, 7], async i => { const a = i / 8 * 6.28, m = e.E.make('butterfly', V(c.x + Math.cos(a) * 1.9, c.y + Math.sin(a) * 1.3, c.z), { color: '#c08cff', size: .6 }); await e.E.open(m, 120); await e.E.move(m, c, 360, 'inQuad'); e.E.close(m, 120, .3); }, 30);
      e.P.flare(c, { color: '#c08cff', scale: 3.6, dur: 500 }); e.P.burst(c, { count: 50, colors: ['#c08cff', '#ffffff'], speed: 3.2 }); e.P.ring(c, { color: '#c08cff', radius: 1.6, vertical: true }); e.rig.shake(.13, 400); e.rig.kick(-2.5, 380); play('crit'); e.hit(t, 1.7);
    }
    await wait(300);
  },
  '入梦': async e => { for (const t of e.list) { const m = e.E.make('moon', up(e.H.chest(t), 1.2), { color: '#a9b8ff', size: 1.4 }); await e.E.open(m, 260); e.props.puff(e.H.chest(t), { color: '#6a6ad0', size: 1.6, rise: .2, dur: 1500 }); await e.E.move(m, up(e.H.chest(t), .5), 420); e.hit(t, .8); play('paper'); await e.E.close(m, 320); } },
  '时间回退': async e => { for (const t of e.all) { const m = e.E.make('clock', up(e.H.chest(t), .1), { color: '#d9c38a', size: 1.6 }); await e.E.open(m, 220); play('paper'); await e.E.spin(m, -2.5, 700); e.P.rise(e.H.cardPos(t), { count: 18, color: '#d9c38a', radius: .45 }); e.hit(t, .8); await e.E.close(m, 280, .5); } },
  '时间删除': async e => { for (const t of e.list) { const m = e.E.make('clock', up(e.H.chest(t), .1), { color: '#d9c38a', size: 1.8 }); await e.E.open(m, 220); play('dread'); e.E.spin(m, 3, 800); await wait(420); e.E.show('portal', e.H.chest(t), { color: '#d9c38a', size: 2.2, dur: 600, grow: .1 }); t.app.setOpacity(.1); e.hit(t, 1.2); await wait(380); await e.E.close(m, 240, .2); } },
  '云梦泽': async e => {
    const c = V(0, .04, .7), m = e.E.make('lotus', c, { color: '#dfe6ff', size: 6.4, flat: true, opacity: .75 }); await e.E.open(m, 420, 'outCubic'); play('revive');
    e.ctx.atmosphere.mist.material.uniforms.uColor.value.set('#dfe6ff'); for (const t of e.all) { e.P.rise(e.H.cardPos(t), { count: 24, color: '#dfe6ff', radius: .5, speed: 1.2 }); e.hit(t, .9); }
    await e.E.spin(m, .25, 800); await e.E.close(m, 400, 1.1);
  },
  '冰雪': async e => { play('whoosh'); await each([0, 1, 2, 3, 4, 5, 6, 7, 8], async i => { const x = (Math.random() - .5) * 7; await e.E.show('snow', V(x, 2.8, e.foeZ + (Math.random() - .5)), { color: '#e6f6ff', size: .5 + Math.random() * .5, dur: 900, to: V(x + .6, .4, e.foeZ), spin: .5, moveEase: 'inQuad' }); }, 45); for (const t of e.list) { e.hit(t, .9); e.P.burst(e.H.chest(t), { count: 12, color: '#bfe6ff', speed: 1.2 }); } },
  '迷惑': async e => { const m = e.E.make('fox', up(e.origin, .7), { color: '#ffb066', size: 1.3 }); await e.E.open(m, 240); play('paper'); for (const t of e.list) { await e.P.bolt(up(e.origin, .7), e.H.chest(t), { color: '#ff8ad0', arc: 1.2, dur: 440, size: .45, trail: 7, ease: 'inOutQuad' }); e.E.show('heart', up(e.H.chest(t), .7), { color: '#ff8ad0', size: .8, dur: 700 }); e.hit(t); } await e.E.close(m, 300); },
  '欺骗': async e => { await each([-1, 0, 1], async i => { await e.E.show('fox', up(e.origin, .4), { color: '#ffb066', size: 1.2, dur: 800, to: up(e.origin, .4).add(V(i * 1.1, 0, 0)) }); }, 90); if (e.S) e.hit(e.S, .8); for (const t of e.list) e.hit(t, .6); },
  '空间规律': async e => { for (const t of e.list) { const m = e.E.make('portal', up(e.H.chest(t), .1), { color: '#9a7cf0', size: 2 }); await e.E.open(m, 240); play('whoosh'); await e.E.spin(m, .75, 500); e.P.slash(e.H.chest(t), e.rig.camera, { color: '#9a7cf0', length: 2, angle: .78 }); e.P.slash(e.H.chest(t), e.rig.camera, { color: '#9a7cf0', length: 2, angle: -.78 }); e.hit(t); await e.E.close(m, 280, .4); } },
  '轮回': async e => {
    const c = V(0, .04, -.2), m = e.E.make('wheel', c, { color: '#dfe6ff', size: 6.6, flat: true, opacity: .8 }); play('dread'); await e.E.open(m, 420, 'outCubic');
    const mouth = e.props.urn.mouth(); e.P.pillar(mouth.clone().setY(0), { color: '#dfe6ff', radius: .5, height: 3.4, dur: 1200 }); e.P.rise(mouth, { count: 40, color: '#dfe6ff', radius: .4, speed: 1.6 });
    await e.E.spin(m, -1, 1000); play('revive'); await e.E.close(m, 400, 1.15);
  },
  '太阴之力': async e => { const c = up(e.origin, 1.2), m = e.E.make('moon', c, { color: '#e6ecff', size: 1.8 }); await e.E.open(m, 300); play('revive'); await each([0, 1, 2, 3, 4, 5], async i => { await e.P.bolt(c, e.props.qiAnchor(i), { color: '#e6ecff', arc: .8, side: (i - 2.5) * .25, dur: 420, size: .4, trail: 5 }); e.P.flare(e.props.qiAnchor(i), { color: '#8f9bff', scale: .9 }); }, 70); if (e.S) e.hit(e.S, .7); await e.E.close(m, 320); }
};
