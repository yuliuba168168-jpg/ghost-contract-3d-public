import * as THREE from 'three';
import { tween, wait, kill } from '../core/tween.js';
import { play } from '../core/audio.js';
import { createParticles } from '../fx/particles.js';
import { createOverlay } from '../fx/overlay.js';
import { slotPos, standPos } from './board-layout.js';
import { Card3D } from '../cards/card-mesh.js';
import { Apparition } from '../cards/apparition.js';
import { compact } from '../cards/card-face.js';
import { castSkillFx, themeColor, reactFx, STRONG } from '../fx/skill-fx.js';
import { skillTier, cardTier, bossTier } from '../fx/skill-tier.js';
import { createEmblems } from '../fx/emblems.js';
import { BOSS_EMBLEM } from '../fx/skill-sig.js';
import { eyeColorFor } from '../scene/opponent.js';

const AWAITED = new Set(['turn:start', 'draw', 'deploy', 'move', 'attack', 'direct', 'skill:cast', 'card:play', 'playerSkill', 'boss:cast', 'unit:skip', 'banner', 'deaths', 'return', 'enemy:return', 'status:tick', 'battle:win', 'bond:strike']);
const fmt = n => compact(Math.round(Math.abs(n) * 10) / 10);

export function createDirector(ctx) {
  const FORM = { '邪灵形态': 'tong_evil', '女武神形态': 'tong_valkyrie' };
  const cine = () => ctx.cine;
  const { battle: view, rig, props, table, opponent, lights, scene } = ctx;
  const P = ctx.particles = createParticles(scene);
  const O = ctx.overlay = createOverlay(ctx);
  const GC = globalThis.GC;
  const floated = new Map();
  let phase = 'ally', running = 0, entering = false, settle = Promise.resolve();
  const now = () => performance.now();
  const chest = ent => { const p = ent.app.group.position.clone(); p.y += ent.app.height * .55; return p; };
  const cardPos = ent => ent.card.group.position.clone();
  const mark = key => floated.set(key, now());
  const recently = (key, ms = 700) => now() - (floated.get(key) || -1e9) < ms;

  function shakeEntity(ent, amp = .09, dur = 300) {
    const g = ent.card.group, base = g.position.x, s = { k: 0 };
    return tween(s, { k: 1 }, { dur, ease: 'linear', onUpdate: () => { g.position.x = base + Math.sin(s.k * 34) * amp * (1 - s.k); } }).then(() => { g.position.x = base; });
  }
  function hpFloat(ent, delta) {
    if (Math.abs(delta) < .05) return;
    const pos = chest(ent);
    if (delta < 0) O.floatText(pos, '-' + fmt(delta), { kind: ent.side === 'ally' ? 'damage' : 'dealt' });
    else O.floatText(pos, '+' + fmt(delta), { kind: 'heal' });
    mark(ent.uid);
  }
  function settleHp(ent, silent = false) {
    const u = ent.unit; if (!u) return 0;
    const delta = Math.max(0, u.hp) - Math.max(0, ent.lastHp);
    ent.lastHp = u.hp;
    if (!ent.vanishing) ent.card.setUnit(u);
    if (!silent && delta) hpFloat(ent, delta);
    return delta;
  }
  ctx.on('hpChange', (ent, delta, gone) => {
    if (recently(ent.uid, 250)) return;
    if (gone) { if (ent.lastHp > 0 && ent.unit?.dead) hpFloat(ent, -ent.lastHp); return; }
    hpFloat(ent, delta);
    if (delta < 0) { ent.card.flash(ent.side === 'ally' ? '#ff5a40' : '#ffffff', .7, 300); ent.app.flash('#ffffff', .8, 260); shakeEntity(ent, .05, 220); P.burst(chest(ent), { count: 10, color: ent.side === 'ally' ? '#ff6a4a' : '#dfe6ff', speed: 1.4, size: .06 }); }
    else { ent.app.flash('#b9f2d0', .7, 400); P.rise(cardPos(ent), { count: 10, color: '#b9f2d0', radius: .4 }); }
  });
  ctx.on('vanish', (ent, kind) => {
    if (kind === 'quiet') return;
    const pos = chest(ent);
    play('death');
    P.burst(pos, { count: 26, colors: ent.side === 'ally' ? ['#9fb0ff', '#5a3df0', '#dfe6ff'] : ['#ff5a40', '#c2261d', '#ffb066'], speed: 1.5, gravity: .8, up: 1.2, life: 1.1, size: .08, drag: 1.2 });
    P.ring(cardPos(ent), { color: ent.side === 'ally' ? '#9fb0ff' : '#ff5a40', radius: 1.1, dur: 600 });
    table.pulseSlot(ent.side, ent.lane, 1.2);
    if (ent.side === 'ally') { wait(260).then(() => P.bolt(pos, props.urn.mouth(), { color: '#9fb0ff', arc: 1.2, dur: 620, size: .45, ease: 'inOutQuad' })).then(() => { P.flare(props.urn.mouth(), { color: '#9fb0ff', scale: 1.4 }); }); if (GC.battle) opponent.play('allyDeath'); }
    else if (GC.battle) opponent.play('unitDeath', { lane: ent.lane });
  });
  ctx.on('unitArrived', ent => {
    table.pulseSlot(ent.side, ent.lane, 1.4);
    P.pillar(cardPos(ent), { color: ent.side === 'ally' ? '#9fb0ff' : '#ff5a40', radius: .5, height: 2.2, dur: 700 });
    play('deploy');
  });

  ctx.on('battleSynced', b => {
    if (!b) return;
    ctx.ward?.setInfo(GC.query.wardInfo ? GC.query.wardInfo() : null);
    opponent.setMood({ enemyLife: b.maxEnemyWill ? b.enemyWill / b.maxEnemyWill : 1, allyLife: b.maxWill ? b.will / b.maxWill : 1 });
  });

  function enemyPhase() {
    if (phase === 'enemy') return;
    phase = 'enemy';
    opponent.play('turn');
    rig.goTo('enemy', { dur: 700 });
    O.caption('敌方行动', { tone: 'enemy', dur: 1000 });
    ctx.props.bell.setEnabled(false);
  }
  function allyPhase() {
    if (phase === 'ally') return;
    phase = 'ally';
    opponent.setEyes(.08); opponent.lean(0, 600);
    rig.goTo('battle', { dur: 700 });
  }
  function sideOf(ref) { return ref?.side || (view.get(ref?.uid)?.side) || 'ally'; }

  function impact(T, { damage, critical, attackerSide }) {
    const pos = chest(T), color = attackerSide === 'ally' ? '#dfe6ff' : '#ff6a4a';
    if (!damage) {
      P.ring(pos, { color: '#bcd0ff', radius: .8, vertical: true }); T.app.flash('#bcd0ff', .9, 380);
      O.floatText(pos, '免疫', { kind: 'info' }); play('paper'); mark(T.uid); T.lastHp = T.unit.hp;
      return;
    }
    T.card.flash(critical ? '#ffd98a' : attackerSide === 'ally' ? '#ffffff' : '#ff5a40', critical ? 1.3 : .85, 340);
    T.app.flash('#ffffff', 1.1, 300);
    P.slash(pos, rig.camera, { color: critical ? '#ffd98a' : color, length: critical ? 2.4 : 1.6, angle: -.5 + Math.random() * .5 });
    if (critical) P.slash(pos, rig.camera, { color: '#ffffff', length: 2, angle: .9 });
    P.burst(pos, { count: critical ? 38 : 18, colors: [color, '#ffffff', '#ffb066'], speed: critical ? 3 : 1.9, size: .07, life: critical ? .8 : .55 });
    P.ring(cardPos(T), { color, radius: critical ? 1.6 : 1, dur: 440 });
    shakeEntity(T, critical ? .16 : .09, critical ? 420 : 300);
    table.pulseSlot(T.side, T.lane, critical ? 1.6 : .9);
    rig.shake(critical ? .12 : .045, critical ? 440 : 240);
    if (critical) { rig.kick(-2.6, 380); O.flash('#ffd98a', .12, 300); }
    play(critical ? 'crit' : 'hit');
    T.card.setUnit(T.unit); T.lastHp = T.unit.hp;
    O.floatText(pos, (critical ? '暴击 ' : '') + '-' + fmt(damage), { kind: critical ? 'crit' : T.side === 'ally' ? 'damage' : 'dealt' });
    mark(T.uid);
    if (T.side === 'enemy' && !GC.battle?.enemies.some(e => !e.dead && e.uid !== T.uid) && T.unit.dead) opponent.recoil(1);
  }

  async function flyCardTo(card, to, { dur = 420, rot = [-Math.PI / 2, 0, 0], scale = 1, arc = 1.1, ease = 'inOutCubic' } = {}) {
    const g = card.group, from = g.position.clone(), s = { t: 0 }, r0 = g.rotation.clone(), sc0 = g.scale.x;
    await tween(s, { t: 1 }, {
      dur, ease, onUpdate: () => {
        const t = s.t;
        g.position.lerpVectors(from, to, t); g.position.y += Math.sin(t * Math.PI) * arc;
        g.rotation.set(r0.x + (rot[0] - r0.x) * t, r0.y + (rot[1] - r0.y) * t, r0.z + (rot[2] - r0.z) * t);
        g.scale.setScalar(sc0 + (scale - sc0) * t);
      }
    });
  }

  const handlers = {
    async 'battle:enter'(p) {
      entering = true; ctx.inputLock = true; ctx.cine?.resetSeen();
      view.hold();
      try {
        phase = 'ally'; floated.clear();
        opponent.reset();
        { const ec = eyeColorFor(GC.battle?.nodeId || 'test', GC.NODES[GC.battle?.nodeId]?.type === 'boss'); opponent.setEyeColor(ec.color, ec.boost); }
        opponent.play('enter');
        lights.state.dim = 1; ctx.R.grade.uDesat.value = 0; ctx.R.grade.uEdgeDark.value = 0;
        view.clear(false); view.active = true;
        table.clearGlow();
        rig.goTo('battle', { dur: 1000 });
        const b = GC.battle; if (!b) return;
        view.syncProps(b);
        view.hand.setVisible(true);
        const title = b.testMode ? '演武 · 自定测试' : (GC.NODES[b.nodeId]?.title || '');
        O.banner(b.testMode ? '演武开坛' : '契约展开', { tone: 'info', sub: title, dur: 1300 });
        play('turn');
        await wait(420);
        opponent.setEyes(1); opponent.gesture(1);
        const hold0 = new THREE.Vector3(0, 1.3, -3);
        let i = 0;
        const enemies = b.enemies.filter(e => !e.dead);
        for (const e of enemies) {
          const ent = view.create(e, 'enemy', e.lane, { appear: false });
          const target = cardPos(ent);
          ent.card.group.position.copy(hold0).x += (e.lane - 1.5) * .25; ent.card.group.rotation.set(.4, 0, .3); ent.card.group.scale.setScalar(.5);
          ent.app.material.uniforms.uOpacity.value = 0;
          const delay = i++ * 150;
          wait(delay).then(async () => {
            play('draw');
            await flyCardTo(ent.card, target, { dur: 420, arc: .7, rot: [-Math.PI / 2, 0, (Math.random() - .5) * .05] });
            play('deploy'); table.pulseSlot('enemy', e.lane, 1.3); P.burst(target, { count: 10, color: '#ff8a70', speed: 1.2, flat: true, gravity: 0, size: .06 });
            ent.app.appear(700);
          });
        }
        for (const item of b.removedEnemies || []) view.create(item.unit, 'enemy', item.originalLane, { appear: true });
        b.units.forEach((u, lane) => { if (u && !u.dead) view.create(u, 'ally', lane, { appear: true }); });
        await wait(enemies.length * 150 + 520);
        opponent.setEyes(.08);
        view.hand.sync(b); play('draw');
        await wait(350);
      } finally { view.release(); entering = false; ctx.inputLock = false; ctx.emit('refresh'); }
    },
    async 'turn:start'(p) {
      allyPhase();
      view.syncNow(true);
      props.setQi(p.qi, p.maxQi);
      P.rise(props.censer.position.clone().setY(.5), { count: 16, color: '#8f9bff', radius: .5, speed: 1.1 });
      play('turn');
      props.bell.setEnabled(true);
      await O.banner(`第 ${p.turn} 回合`, { tone: 'ally', sub: `鬼气 ${p.qi} / ${p.maxQi}`, dur: 820 });
    },
    async draw(p) {
      const b = GC.battle; if (!b) return;
      view.hand.sync(b);
      if (p.count > 0) { play('draw'); await wait(240 + Math.min(4, p.count) * 70); }
    },
    async deploy(p) {
      const b = GC.battle, unit = b?.units[p.lane];
      const item = view.hand.detach(p.handIndex), target = slotPos('ally', p.lane, new THREE.Vector3());
      table.setSlotGlow('ally', p.lane, 1);
      if (item) {
        item.card.setCost(null); item.card.setHighlight(null);
        await flyCardTo(item.card, target.clone().setY(.9), { dur: 300, arc: .5, rot: [-1.1, 0, 0], scale: .9, ease: 'outCubic' });
        await flyCardTo(item.card, target, { dur: 170, arc: 0, rot: [-Math.PI / 2, 0, 0], scale: 1, ease: 'inCubic' });
        item.card.dispose();
      }
      play('deploy'); rig.shake(.05, 260); table.pulseSlot('ally', p.lane, 1.8); table.setSlotGlow('ally', p.lane, 0);
      P.burst(target, { count: 22, colors: ['#9fb0ff', '#dfe6ff', '#5a3df0'], speed: 1.8, flat: true, gravity: 0, size: .07, drag: 2.4 });
      P.ring(target, { color: '#9fb0ff', radius: 1.2, dur: 520 });
      if (unit && !view.get(unit.uid)) {
        const ent = view.create(unit, 'ally', p.lane, { appear: true });
        P.pillar(target, { color: '#9fb0ff', radius: .5, height: 2.4, dur: 800 });
        P.rise(target, { count: 16, color: '#9fb0ff', radius: .45 });
        ent.card.flash('#9fb0ff', .9, 420);
      }
      view.syncProps(b);
      mark('burst:' + p.uid);
      await wait(380);
    },
    async move(p) {
      const ent = view.get(p.uid), other = p.swapUid ? view.get(p.swapUid) : null;
      play('move');
      const hop = (e, lane) => {
        const g = e.card.group, a = g.position.clone(), b2 = slotPos(e.side, lane, new THREE.Vector3()), s = { t: 0 }, sa = e.app.group.position.clone(), sb = standPos(e.side, lane, new THREE.Vector3());
        e.lane = lane;
        return tween(s, { t: 1 }, { dur: 320, ease: 'inOutCubic', onUpdate: () => { g.position.lerpVectors(a, b2, s.t); g.position.y += Math.sin(s.t * Math.PI) * (other ? (e === ent ? .5 : .15) : .3); e.app.group.position.lerpVectors(sa, sb, s.t); } });
      };
      const jobs = [];
      if (ent) jobs.push(hop(ent, p.to));
      if (other) jobs.push(hop(other, p.from));
      await Promise.all(jobs);
      table.pulseSlot('ally', p.to, 1);
      P.burst(slotPos('ally', p.to, new THREE.Vector3()), { count: 8, color: '#9fb0ff', speed: 1, flat: true, gravity: 0, size: .05 });
    },
    async attack(p) {
      const A = view.get(p.attacker.uid), T = view.get(p.target.uid), enemy = p.attacker.side === 'enemy';
      if (enemy) enemyPhase();
      if (!A || !T) { view.syncNow(true); await wait(160); return; }
      if (enemy) { opponent.lookAt(T.card.group.position); opponent.setEyes(1); }
      A.card.setHighlight('acting');
      const home = A.app.group.position.clone(), cHome = A.card.group.position.clone(), dir = enemy ? 1 : -1, tp = T.app.group.position;
      tween(A.card.group.position, { z: cHome.z - dir * .12, y: cHome.y + .12 }, { dur: 160, ease: 'outQuad' });
      await tween(A.app.group.position, { z: home.z - dir * .24, y: home.y + .08 }, { dur: 180, ease: 'outQuad' });
      play('whoosh');
      tween(A.card.group.position, { z: cHome.z + dir * .36, y: cHome.y + .03 }, { dur: 110, ease: 'inQuad' });
      await tween(A.app.group.position, { z: home.z + (tp.z - home.z) * .7, x: home.x + (tp.x - home.x) * .7, y: home.y }, { dur: 120, ease: 'inCubic' });
      impact(T, { damage: p.damage, critical: p.critical, attackerSide: p.attacker.side });
      tween(A.card.group.position, { x: cHome.x, y: cHome.y, z: cHome.z }, { dur: 280, ease: 'outCubic' });
      await tween(A.app.group.position, { x: home.x, y: home.y, z: home.z }, { dur: 300, ease: 'outCubic' });
      A.card.setHighlight(null);
      if (enemy) opponent.setEyes(.5);
      await wait(p.critical ? 160 : 50);
    },
    async direct(p) {
      const A = view.get(p.attacker.uid), enemy = p.attacker.side === 'enemy', b = GC.battle, crit = !!p.critical;
      if (enemy) enemyPhase();
      const from = A ? chest(A) : slotPos(p.attacker.side, p.attacker.lane, new THREE.Vector3()).setY(.6);
      if (A) {
        A.card.setHighlight('acting');
        const home = A.app.group.position.clone(), dir = enemy ? 1 : -1;
        await tween(A.app.group.position, { z: home.z - dir * .2, y: home.y + .1 }, { dur: 170, ease: 'outQuad' });
        tween(A.app.group.position, { z: home.z + dir * .5 }, { dur: 120, ease: 'inCubic' }).then(() => tween(A.app.group.position, { x: home.x, y: home.y, z: home.z }, { dur: 320, ease: 'outCubic' }));
      }
      play('whoosh');
      if (p.outcome === 'enemyWill') {
        const to = props.lifeAnchor('enemy');
        await P.bolt(from, to, { color: '#dfe6ff', arc: 1.2, dur: 400, size: crit ? .9 : .6, trail: 4 });
        props.setLife('enemy', p.enemyWill, b?.maxEnemyWill ?? 10);
        P.burst(to, { count: crit ? 30 : 18, colors: ['#dfe6ff', '#ff8a70', '#ffffff'], speed: 2.2, size: .07 }); P.flare(to, { color: '#dfe6ff', scale: crit ? 3 : 2 });
        opponent.recoil(crit ? 1.5 : 1); rig.shake(crit ? .1 : .05, 300); play(crit ? 'crit' : 'hit');
        O.floatText(to.clone().setY(.9), (crit ? '暴击 ' : '') + '-' + fmt(p.damage), { kind: crit ? 'crit' : 'dealt' }); mark('enemyWill');
      } else if (p.outcome === 'will') {
        opponent.gesture(p.attacker.lane > 1 ? 1 : -1);
        const to = props.lifeAnchor('ally');
        await P.bolt(from, to, { color: '#ff4a2a', arc: 1.5, dur: 440, size: crit ? .9 : .65, trail: 4 });
        props.setLife('ally', p.will, b?.maxWill ?? 10);
        P.burst(to, { count: crit ? 34 : 20, colors: ['#ff4a2a', '#ffb066', '#ffffff'], speed: 2.4, size: .08 }); P.flare(to, { color: '#ff4a2a', scale: crit ? 3.2 : 2.2 });
        O.flash('#c2261d', crit ? .5 : .32, 520); rig.shake(crit ? .17 : .1, 460); play(crit ? 'crit' : 'hit');
        const g = ctx.R.grade; g.uEdgeDark.value = .7; tween(g.uEdgeDark, { value: 0 }, { dur: 900 });
        O.floatText(to.clone().setY(.9), (crit ? '暴击 ' : '') + '-' + fmt(p.damage), { kind: crit ? 'crit' : 'damage' }); mark('will');
      } else {
        const Rn = view.byRef(p.redirect), lure = props.lifeAnchor('ally').lerp(from, .45).setY(1.2);
        await P.bolt(from, lure, { color: '#ff4a2a', arc: .5, dur: 260, size: .6 });
        if (Rn) {
          const label = p.outcome === 'domain' ? (b?.domain?.name || '鬼域') + ' · 牵引' : p.outcome === 'love' ? '爱的规律 · 代受' : '闪遁';
          await P.bolt(lure, chest(Rn), { color: p.outcome === 'dodge' ? '#ff8a70' : '#b08cff', arc: .4, dur: 240, size: .6, ease: 'outQuad' });
          O.floatText(chest(Rn).setY(1.5), label, { kind: 'info' });
          if (p.outcome === 'dodge') {
            Rn.app.flash('#ff5a40', 1.2, 500); props.puff(chest(Rn), { color: '#c2463a', size: 1.1, rise: .8 }); P.burst(chest(Rn), { count: 16, color: '#ff8a70', speed: 1.4, gravity: .4 }); play('paper'); mark(Rn.uid);
          } else {
            const delta = settleHp(Rn, true);
            impact(Rn, { damage: Math.abs(delta), critical: crit, attackerSide: 'enemy' });
          }
        }
      }
      if (A) A.card.setHighlight(null);
      await wait(260);
    },
    async 'skill:cast'(p) {
      if (p.source?.side === 'enemy') enemyPhase();
      else opponent.play('wary', { tier: STRONG.has(p.name) ? 'strong' : 'normal' });
      if (cine()) {
        const Sx = view.byRef(p.source), enemySide = p.source?.side === 'enemy', def = GC.VFX?.definitions?.[p.name];
        const tier = enemySide ? (Sx?.unit?.bossSkills?.length ? 2 : 1) : skillTier(p.name);
        await cine().play({ kind: 'skill', name: p.name, tier, theme: p.theme || def?.theme, side: enemySide ? 'enemy' : 'ally', portrait: Sx ? { id: Sx.unit?.id, name: Sx.unit?.name, form: FORM[p.name] } : null, sub: def?.subtitle });
      }
      await castSkillFx(ctx, p, { chest, cardPos, shakeEntity });
    },
    async 'card:play'(p) {
      const item = view.hand.detach(p.handIndex), T = view.byRef(p.target), S = GC.SKILLS[p.cardId] || {};
      const show = new THREE.Vector3(0, 2.05, 1.15), color = { '普通': '#e9e2d0', '稀有': '#8f9bff', '珍藏': '#c08cff', '传说': '#ffd98a' }[S.rarity] || '#e9e2d0';
      play('skill'); opponent.play('wary', { tier: 'normal' });
      if (cine()) { const def = GC.VFX?.definitions?.[S.name]; await cine().play({ kind: 'card', cardId: p.cardId, name: S.name || p.cardId, tier: cardTier(p.cardId), theme: def?.theme || { '普通': 'ink', '稀有': 'shield', '珍藏': 'dream', '传说': 'phoenix' }[S.rarity] || 'ink', side: 'ally', portrait: null, sub: def?.subtitle }); }
      O.caption(S.name || p.cardId, { tone: 'gold', dur: 1000 });
      if (item) {
        item.card.setCost(null); item.card.setHighlight(null);
        const q = rig.camera.rotation;
        await flyCardTo(item.card, show, { dur: 300, arc: .2, rot: [q.x, q.y, q.z], scale: .95, ease: 'outCubic' });
        P.flare(show, { color, scale: 2.6, dur: 420 });
        await wait(160);
        P.burst(show, { count: 30, color, speed: 1.6, gravity: 0, life: .7, size: .07 });
        play('paper');
        const done = item.card.dissolve(420, color);
        if (T) await P.bolt(show, chest(T), { color, arc: .3, dur: 320, size: .7, trail: 4 });
        await done; item.card.dispose();
      }
      const all = [...view.units.values()];
      if (T) {
        T.app.flash(color, 1.1, 500); T.card.flash(color, .8, 420); P.ring(cardPos(T), { color, radius: 1.1 }); P.rise(cardPos(T), { count: 14, color, radius: .45 }); table.pulseSlot(T.side, T.lane, 1.4);
      } else if (['taboo', 'bloodmoon'].includes(p.cardId)) {
        O.flash(p.cardId === 'bloodmoon' ? '#c2261d' : '#ffffff', .3, 700); rig.shake(.07, 400); play('dread');
        for (const e of all) { e.app.flash(p.cardId === 'bloodmoon' ? '#ff3b30' : '#ffffff', 1, 600); P.rise(cardPos(e), { count: 8, color: p.cardId === 'bloodmoon' ? '#ff3b30' : '#e9e2d0', radius: .4 }); }
      } else {
        P.rise(props.deck.topPosition(new THREE.Vector3()), { count: 14, color, radius: .4 });
      }
      view.syncNow(true);
      await wait(300);
    },
    async playerSkill(p) {
      const T = view.byRef(p.target), art = props.artifacts[p.index], b = GC.battle;
      const color = ['#ff2a2a', '#ffe6a8', '#ffd98a'][p.index] || '#ffffff';
      if (cine()) await cine().play({ kind: 'player', index: p.index, name: p.name, tier: 3, theme: ['bloodsacrifice', 'shield', 'divinefire'][p.index] || 'fate', side: 'ally', portrait: null });
      O.caption(p.name, { tone: 'gold', dur: 1200 }); play(p.index === 0 ? 'dread' : 'skill'); opponent.play('wary', { tier: p.index === 0 ? 'strong' : 'normal' });
      const from = art.group.position.clone().setY(.5);
      P.flare(from, { color, scale: 2.4, dur: 500 }); P.rise(from, { count: 18, color, radius: .3, speed: 1.4 });
      if (p.index === 0) { O.flash('#c2261d', .3, 600); if (b) props.setLife('ally', b.will, b.maxWill); rig.shake(.06, 300); }
      await wait(240);
      if (T) {
        await Promise.all([0, 1, 2].map(i => wait(i * 80).then(() => P.bolt(from, chest(T), { color, arc: 1 + i * .3, side: (i - 1) * .6, dur: 460, size: .6, trail: 4 }))));
        T.app.flash(color, 1.4, 700); T.card.flash(color, 1, 600);
        P.pillar(cardPos(T), { color, radius: .6, height: 3, dur: 1000 }); P.ring(cardPos(T), { color, radius: 1.4, dur: 700 }); P.burst(chest(T), { count: 30, color, speed: 2, gravity: .5, life: .9 });
        table.pulseSlot('ally', T.lane, 2);
        settleHp(T);
      }
      if (T) (ctx.emblems ||= createEmblems(ctx)).show(['drop', 'wings', 'flame'][p.index], chest(T).add(new THREE.Vector3(0, .5, 0)), { color, size: 1.8, dur: 1000, ease: 'outElastic' });
      art.setUsed(true);
      view.syncNow(true);
      await wait(420);
    },
    async 'boss:cast'(p) {
      enemyPhase();
      const B = view.get(p.uid), kindColor = { shield: '#dfe6ff', slow: '#b08cff', summon: '#ff5a40', strike: '#ff3b30', mark: '#ff8a70', heal: '#b9f2d0', rage: '#ff3b30', shift: '#c9a0ff', aoe: '#ff5a40', drain: '#c2261d', curse: '#b08cff', burn: '#ff7a3a', seal: '#d9c38a', steal: '#8f9bff', chaos: '#c9d0ff', execute: '#ff2a2a', dread: '#8a86a8', siphon: '#ff8a70', purge: '#e6f0ff', fortify: '#dfe6ff' }[p.kind] || '#ff5a40';
      if (cine()) await cine().play({ kind: 'boss', name: p.name, tier: bossTier(p.kind, !!B?.unit?.bossSkills?.length), theme: 'eye', side: 'enemy', portrait: null });
      O.caption(p.name, { tone: 'enemy', sub: '首领技能', dur: 1300 });
      play('dread'); opponent.play('cast');
      rig.shake(.04, 500);
      const g = ctx.R.grade; tween(g.uEdgeDark, { value: .5 }, { dur: 250 }).then(() => tween(g.uEdgeDark, { value: 0 }, { dur: 700 }));
      if (B) {
        B.card.setHighlight('target'); B.card.flash(kindColor, 1, 600); B.app.flash(kindColor, 1.3, 700);
        P.pillar(cardPos(B), { color: kindColor, radius: .7, height: 3.2, dur: 1000 }); P.ring(cardPos(B), { color: kindColor, radius: 1.6, dur: 700 });
        await tween(B.app.group.position, { y: B.app.group.position.y + .3 }, { dur: 320, ease: 'outCubic' });
        const allies = [...view.units.values()].filter(e => e.side === 'ally');
        if (['slow', 'mark'].includes(p.kind)) { const t = allies.sort((a, c) => (c.unit?.hp || 0) - (a.unit?.hp || 0))[0]; if (t) { await P.bolt(chest(B), chest(t), { color: kindColor, arc: .9, dur: 380, size: .6 }); t.app.flash(kindColor, 1.2, 500); P.ring(cardPos(t), { color: kindColor, radius: 1 }); } }
        else if (p.kind === 'strike') { const t = allies.find(e => e.lane === B.lane); if (t) { await P.bolt(chest(B), chest(t), { color: kindColor, arc: .2, dur: 220, size: .9 }); P.slash(chest(t), rig.camera, { color: kindColor, length: 2.2 }); rig.shake(.1, 320); play('crit'); } }
        else if (p.kind === 'shield') { P.ring(chest(B), { color: kindColor, radius: 1, vertical: true, dur: 700 }); }
        else if (p.kind === 'heal') P.rise(cardPos(B), { count: 24, color: kindColor, radius: .5, speed: 1.2 });
        else if (p.kind === 'rage') P.burst(chest(B), { count: 30, color: kindColor, speed: 2.2, gravity: 1, up: 1.4 });
        const EM = ctx.emblems ||= createEmblems(ctx), front = allies.find(e => e.lane === B.lane), byAtk = [...allies].sort((a, c) => GC.query.effectiveAttack(c.unit) - GC.query.effectiveAttack(a.unit))[0], byHp = [...allies].sort((a, c) => (c.unit?.hp || 0) - (a.unit?.hp || 0))[0];
        EM.show(BOSS_EMBLEM[p.kind] || '咒', chest(B).add(new THREE.Vector3(0, .7, 0)), { color: kindColor, size: 1.5, dur: 900, spin: p.kind === 'chaos' ? 1 : 0 });
        const zap = async (t, em) => { if (!t) return; await P.bolt(chest(B), chest(t), { color: kindColor, arc: .7, dur: 340, size: .6, trail: 5 }); EM.show(em, chest(t).add(new THREE.Vector3(0, .5, 0)), { color: kindColor, size: 1, dur: 700 }); t.app.flash(kindColor, 1.2, 500); P.ring(cardPos(t), { color: kindColor, radius: 1 }); };
        if (p.kind === 'aoe' || p.kind === 'dread') { await Promise.all(allies.map((t, i) => wait(i * 70).then(() => zap(t, BOSS_EMBLEM[p.kind])))); rig.shake(.09, 360); play('hit'); }
        else if (p.kind === 'drain' || p.kind === 'execute') { if (front) { await zap(front, BOSS_EMBLEM[p.kind]); P.slash(chest(front), rig.camera, { color: kindColor, length: 2.4 }); rig.shake(.11, 340); play('crit'); if (p.kind === 'drain') P.bolt(chest(front), chest(B), { color: '#ff5a40', arc: .5, dur: 380, size: .5 }); } }
        else if (p.kind === 'curse' || p.kind === 'seal') await zap(byAtk, BOSS_EMBLEM[p.kind]);
        else if (p.kind === 'burn') await zap(byHp, 'flame');
        else if (p.kind === 'steal') { await P.bolt(props.censer.position.clone().setY(.6), chest(B), { color: '#8f9bff', arc: 1.4, dur: 520, size: .7, trail: 7 }); P.flare(chest(B), { color: '#8f9bff', scale: 2 }); }
        else if (p.kind === 'siphon') { await P.bolt(chest(B), props.lifeAnchor('ally'), { color: kindColor, arc: 1.5, dur: 460, size: .7, trail: 6 }); O.flash('#c2261d', .25, 500); if (GC.battle) props.setLife('ally', GC.battle.will, GC.battle.maxWill); }
        else if (p.kind === 'purge' || p.kind === 'fortify') for (const t of view.units.values()) if (t.side === 'enemy') { P.ring(chest(t), { color: kindColor, radius: .9, vertical: true, dur: 650 }); t.app.flash(kindColor, .9, 500); }
        tween(B.app.group.position, { y: standPos('enemy', B.lane).y }, { dur: 300, ease: 'inCubic' });
        B.card.setHighlight(null);
      }
      await wait(420);
      opponent.setEyes(.5); opponent.lean(1, 400);
    },
    async 'unit:skip'(p) {
      if (p.side === 'enemy') enemyPhase();
      const ent = view.get(p.uid);
      if (ent) {
        let text = { freeze: '冰封 · 无法行动', skip: `${p.label || ''} · 无法行动`, miss: '落空', spaceBlocked: '空间封锁' }[p.reason] || p.label || '无法行动';
        if (p.reason === 'ward') { text = '鬼障 · 直击无效'; ctx.ward?.ripple(-1.95 + ent.lane * 1.3); opponent.play('wardBlock'); }
        O.floatText(chest(ent).setY(1.5), text, { kind: 'info' }); mark(ent.uid);
        ent.app.flash(p.reason === 'freeze' ? '#bfe6ff' : '#8a86a8', .9, 500); shakeEntity(ent, .04, 300); play('paper');
      }
      await wait(ent ? 420 : 60);
    },
    async banner(p) { await O.banner(p.text, { tone: p.tone }); },
    async deaths(p) {
      const jobs = [];
      for (const ref of p.units || []) {
        const ent = view.get(ref.uid);
        if (ent) { if (!recently(ent.uid, 900) && ent.lastHp > 0) hpFloat(ent, -ent.lastHp); ent.lastHp = 0; jobs.push(view.vanish(ent, 'death')); }
        else if (view.vanishing.has(ref.uid)) jobs.push(view.vanishing.get(ref.uid));
      }
      if (jobs.length) { rig.shake(.03, 300); await Promise.race([Promise.all(jobs), wait(820)]); }
    },
    async return(p) {
      const b = GC.battle, ent = p.uid ? view.get(p.uid) : null;
      if (p.kind === 'return' && ent) {
        const pos = cardPos(ent).setY(.5);
        play('move'); P.ring(cardPos(ent), { color: '#dfe6ff', radius: 1 }); P.rise(cardPos(ent), { count: 12, color: '#dfe6ff', radius: .4 });
        await Promise.all([ent.app.disperse(300), tween(ent.card.group.position, { y: .5 }, { dur: 260, ease: 'outCubic' })]);
        view.remove(ent);
        view.hand.spawnFrom(pos);
      } else {
        const mouth = props.urn.mouth();
        play('revive'); P.pillar(mouth.clone().setY(0), { color: '#dfe6ff', radius: .4, height: 2.6, dur: 900 }); P.rise(mouth, { count: 20, color: '#dfe6ff', radius: .3, speed: 1.5 });
        if (ent) view.vanish(ent, 'quiet');
        view.hand.spawnFrom(mouth);
        O.floatText(mouth.clone().setY(1.3), p.kind === 'rollback' ? '时间回退 · 复生' : '魂归', { kind: 'info' });
      }
      if (b) view.hand.sync(b);
      await wait(360);
    },
    async 'enemy:return'(p) {
      view.syncNow(true);
      const ent = view.get(p.uid);
      if (ent) {
        if (ent.lane !== p.lane) view.place(ent, p.lane, true);
        ent.removed = false; ent.card.setDim(false); ent.app.resetOpacity(); ent.app.appear(700);
        P.ring(cardPos(ent), { color: '#d9c38a', radius: 1.4, dur: 700 }); P.pillar(cardPos(ent), { color: '#d9c38a', radius: .5, height: 2.4 });
        O.floatText(chest(ent).setY(1.5), '时间归位', { kind: 'info' }); play('revive'); ctx.emit('unitSynced', ent);
      }
      await wait(520);
    },
    async 'status:tick'(p) {
      if (p.side === 'enemy' && phase !== 'enemy') { /* statuses resolve after enemy acts */ }
      const ent = view.get(p.uid);
      if (ent) {
        const pos = chest(ent);
        if (p.kind === 'burn') {
          P.burst(pos, { count: 22, colors: ['#7f8cff', '#5a3df0', '#dfe6ff'], speed: 1.2, gravity: 1.6, up: 1.4, life: .8, size: .08 }); P.pillar(cardPos(ent), { color: '#7f8cff', radius: .45, height: 1.8, dur: 600 });
          ent.card.flash('#7f8cff', .8, 300); ent.app.flash('#7f8cff', 1, 300); shakeEntity(ent, .05, 240); play('flame');
          if (p.value > 0) O.floatText(pos, '-' + fmt(p.value), { kind: ent.side === 'ally' ? 'damage' : 'dealt' });
        } else {
          P.rise(cardPos(ent), { count: 16, color: '#b9f2d0', radius: .45, speed: 1 }); ent.app.flash('#b9f2d0', .8, 400); play('revive');
          if (p.value > 0) O.floatText(pos, '+' + fmt(p.value), { kind: 'heal' });
        }
        mark(ent.uid); ent.lastHp = ent.unit.hp; ent.card.setUnit(ent.unit);
      }
      await wait(ent ? 360 : 30);
    },
    async 'battle:win'(p) {
      play('win'); phase = 'ally';
      props.bell.setEnabled(false);
      rig.goTo('enemy', { dur: 900 });
      for (const ent of [...view.units.values()]) if (ent.side === 'enemy') view.vanish(ent, 'death');
      props.setLife('enemy', 0, 10);
      const head = opponent.headWorld();
      P.burst(head, { count: 60, colors: ['#c2261d', '#e9e2d0', '#ffb066'], speed: 2.6, gravity: -1.2, up: 1.2, life: 1.6, size: .1, drag: .8 });
      opponent.play('win');
      O.flash('#ffd98a', .22, 900);
      await O.banner('胜', { tone: 'gold', sub: p.testMode ? '演武结束' : '鬼域消散 · 契约得守', dur: 1700 });
      view.hand.setVisible(false);
      ctx.ward?.setInfo(null);
    },
    async 'battle:lose'(p) {
      view.hold();
      try {
        play('lose'); phase = 'ally';
        props.bell.setEnabled(false);
        opponent.play('lose');
        props.setLife('ally', 0, 10);
        tween(lights.state, { dim: .22 }, { dur: 1100 }); tween(ctx.R.grade.uDesat, { value: .7 }, { dur: 1100 });
        O.flash('#c2261d', .4, 900); rig.shake(.1, 600);
        view.hand.setVisible(false);
        await O.banner('败', { tone: 'enemy', sub: p.testMode ? '演武结束' : '命灯尽灭', dur: 1700 });
        ctx.ward?.setInfo(null);
      } finally { view.release(); }
    },
    react(p) {
      if (p.name === '鬼障') {
        const ent = p.uid ? view.get(p.uid) : null;
        if (p.label && p.label !== '鬼障') { opponent.play('wardBreak'); ctx.ward?.tear(); }
        else { opponent.play('wardBlock'); if (ent) ctx.ward?.ripple(-1.95 + ent.lane * 1.3); }
      }
      reactFx(ctx, p, { chest, cardPos, recently, mark });
    },
    'effect:expire'(p) {
      const ent = view.get(p.uid);
      if (ent && !recently('exp:' + p.uid, 300)) { mark('exp:' + p.uid); P.rise(cardPos(ent), { count: 6, color: '#8a86a8', radius: .4, speed: .7, life: .8 }); }
    },
    burst(p) {
      const ent = p.uid ? view.get(p.uid) : null;
      if (!ent || recently(ent.uid, 500) || recently('burst:' + p.uid, 800)) return;
      P.burst(chest(ent), { count: 10, color: ent.side === 'ally' ? '#9fb0ff' : '#ff8a70', speed: 1.3, size: .06 });
    },
    float(p) {
      if (typeof p.target === 'string') { if (recently(p.target, 900)) return; O.floatText(props.lifeAnchor(p.target === 'will' ? 'ally' : 'enemy').setY(.9), p.text, { kind: p.critical ? 'crit' : p.kind === 'damage' ? 'damage' : 'info' }); return; }
      const ent = p.target ? view.get(p.target.uid) : null;
      if (!ent || recently(ent.uid, 900)) return;
      O.floatText(chest(ent), p.text, { kind: p.critical ? 'crit' : p.kind === 'heal' ? 'heal' : p.kind === 'damage' ? (ent.side === 'ally' ? 'damage' : 'dealt') : 'info' }); mark(ent.uid);
    }
  };

  function handle(type, payload) {
    ctx.emit('fx', type, payload);
    const fn = handlers[type] || ctx.xfx?.[type];
    if (!fn) return Promise.resolve();
    if (!AWAITED.has(type)) {
      const r = fn(payload);
      if (r?.then) { running++; const done = r.catch(e => console.error('[fx]', type, e)).finally(() => { running--; }); settle = Promise.all([settle, done]); }
      return Promise.resolve();
    }
    view.hold(); running++;
    const job = (async () => { try { await fn(payload); } catch (e) { console.error('[fx]', type, e); } finally { view.release(); running--; } })();
    settle = Promise.all([settle, job]);
    return job;
  }
  function onTurnEnded() { if (phase === 'enemy') allyPhase(); }
  async function warmup() {
    await ctx.cine?.warmup?.();
    ctx.emblems ||= createEmblems(ctx);
    { const shown = []; scene.traverse(o => { if (o.isMesh && o.castShadow) { let n = o; const chain = []; while (n && n !== scene) { if (!n.visible) chain.push(n); n = n.parent; } for (const c of chain) { c.visible = true; shown.push(c); } } }); await wait(260); for (const c of shown) c.visible = false; }
    for (const pose of ['enemy', 'title', 'map', 'inspect', 'shrine', 'cards', 'gallery', 'battle']) { rig.set(pose); await new Promise(r => setTimeout(r, 70)); }
    const cam = rig.camera, p = cam.position.clone().addScaledVector(cam.getWorldDirection(new THREE.Vector3()), 4), q = p.clone().add(new THREE.Vector3(.2, .1, 0));
    const E = ctx.emblems ||= createEmblems(ctx), o = { dur: 160 };
    P.burst(p, { count: 3, life: .15, size: .01 }); P.ring(p, { ...o, radius: .1 }); P.ring(p, { ...o, radius: .1, vertical: true }); P.slash(p, cam, { ...o, length: .1 });
    P.pillar(p, { ...o, radius: .05, height: .1 }); P.beam(p, q, { ...o, width: .01 }); P.flare(p, { ...o, scale: .1 }); P.bolt(p, q, { ...o, size: .05, trail: 1 });
    E.show('eye', p, { size: .1, dur: 160 }); E.show('wheel', p, { size: .1, dur: 160, flat: true });
    props.puff(p, { size: .05, rise: .05, dur: 160 });
    const cards = [new Card3D(), new Card3D({ emissive: .2 })], apps = [new Apparition({ id: 'tong', name: '童童', side: 'ally' }), new Apparition({ name: '恶灵', side: 'enemy' })];
    cards[0].setSkill(Object.keys(GC.SKILLS)[0]); cards[1].setUnit({ id: 'tong', name: '童童', rankName: 'F级', type: '善灵', atk: 1, baseAtk: 1, hp: 1, maxHp: 1 });
    cards.forEach((c, i) => { c.group.position.copy(i ? q : p); c.group.scale.setScalar(.04); c.setHighlight('selected'); c.setAura('#ffffff', 1); c.setShade(true); c.setCost(1, !i); scene.add(c.group); });
    apps.forEach((a, i) => { a.group.position.copy(i ? q : p); a.group.scale.setScalar(.04); a.material.uniforms.uOpacity.value = .5; scene.add(a.group); });
    await new Promise(r => setTimeout(r, 320));
    cards.forEach(c => c.dispose()); apps.forEach(a => a.dispose());
  }
  function update(dt) {
    P.update(dt);
    if (phase === 'enemy' && !GC.busy && !running) allyPhase();
    if (!GC.busy && !running && GC.battle && !props.bell.state.enabled && !entering) props.bell.setEnabled(true);
  }
  return { handle, update, warmup, onTurnEnded, settled: () => settle, get running() { return running; }, particles: P, overlay: O, settleHp, hpFloat, chest, cardPos, shakeEntity, flyCardTo };
}
