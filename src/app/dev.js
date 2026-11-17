import * as THREE from 'three';
import { Card3D, backTexture } from './cards/card-mesh.js';
import { Apparition } from './cards/apparition.js';
import { wait } from './core/tween.js';

const tick = () => new Promise(r => setTimeout(r, 30));

export const DEV_BATTLE = {
  playerHp: 10, qi: 10, enemyHp: 10, xp: 0,
  allies: [
    { on: true, id: 'tong', rank: 'F级' }, { on: true, id: 'xuan', rank: 'A级' }, { on: true, id: 'isuna', rank: '噩梦一阶' },
    { on: true, id: 'lucifer', rank: '圣灵一阶' }, { on: true, id: 'moonqueen', rank: '深渊三阶' }, { on: true, id: 'nannan', rank: '禁忌' }
  ],
  enemies: [
    { on: true, name: '无头将军', pos: '0', atk: 6, hp: 40, rank: 'S级', potential: 3 },
    { on: true, id: 'yuzao', name: '玉藻前', rank: '英灵二阶', pos: '1' },
    { on: true, name: '鬼潮恶灵', pos: '3', atk: 3, hp: 12, rank: 'B级', potential: 1 }
  ],
  cards: ['coin', 'blade', 'horse', 'bloodmoon'], draw: ['coin25', 'rope', 'relic', 'spear', 'whip', 'revive']
};

export async function runDev(name, ctx) {
  const GC = globalThis.GC, A = GC.actions;
  if (name === 'battle') {
    A.startTestBattle(JSON.parse(JSON.stringify(DEV_BATTLE)));
    for (let i = 0; i < 200 && (ctx.inputLock || i < 5); i++) await tick();
    A.selectHand(0); A.allyLane(1);
    for (let i = 0; i < 80 && (GC.busy || !GC.battle.units[1]); i++) await tick();
    const idx = GC.battle.hand.findIndex(e => GC.query.handSpirit(e)?.id === 'lucifer');
    A.selectHand(idx); A.allyLane(2);
    for (let i = 0; i < 80 && (GC.busy || !GC.battle.units[2]); i++) await tick();
    A.cancelSelection();
    return;
  }
  ctx.battle.hand.setVisible(false);
  if (name === 'title') { ctx.rig.set('title'); return; }
  const root = new THREE.Group();
  ctx.scene.add(root);
  if (name === 'cards') {
    ctx.rig.set('cards');
    ctx.lights.state.keyBase = 110; ctx.lights.key.angle = 1.0; ctx.lights.hemi.intensity = 1.6;
    for (const m of ctx.table.slots.enemy.concat(ctx.table.slots.ally)) m.visible = false;
    ctx.props.group.visible = false; ctx.opponent.group.visible = false;
    const list = [];
    for (const s of GC.GD.spirits) {
      const st = GC.query.spiritStats(s.id, s.initialRank, s.potential);
      list.push({ unit: { id: s.id, name: s.name, rankName: s.initialRank, type: s.type, baseAtk: st.atk, atk: st.atk, hp: st.hp, maxHp: st.hp } });
    }
    list.push({ unit: { id: 'main-enemy-0-0', name: '启灵教室的失控恶灵', rankName: 'F级', type: '恶灵', baseAtk: .4, atk: .4, hp: 2, maxHp: 2 } });
    list.push({ unit: { id: 'main-enemy-3-0', name: '无头将军', rankName: 'S级', type: '恶灵', baseAtk: 4.1, atk: 4.1, hp: 13, maxHp: 23, bossSkills: ['铁骑冲阵', '甲胄加固'] } });
    list.push({ unit: { id: 'main-enemy-3-1', name: '随从 · 海城与无头将军', rankName: 'A级', type: '恶灵', baseAtk: 1.8, atk: 1.8, hp: 2, maxHp: 7 }, dim: true });
    for (const id of Object.keys(GC.SKILLS)) list.push({ skill: id });
    list.push({ back: true });
    const cols = 10, sx = 1.12, sz = 1.56, rows = Math.ceil(list.length / cols);
    list.forEach((it, i) => {
      const card = new Card3D({ emissive: .3 });
      if (it.unit) card.setUnit(it.unit); else if (it.skill) card.setSkill(it.skill);
      const c = i % cols, r = Math.floor(i / cols);
      card.group.position.set((c - (cols - 1) / 2) * sx, .02, (r - (rows - 1) / 2) * sz);
      card.group.rotation.x = it.back ? Math.PI / 2 : -Math.PI / 2;
      if (it.dim) card.setDim(true);
      if (it.skill) card.setCost(GC.SKILLS[it.skill].cost, i % 2 === 0);
      root.add(card.group);
    });
    void backTexture;
    return;
  }
  if (name === 'apparitions') {
    ctx.rig.set('gallery');
    ctx.props.group.visible = false; ctx.opponent.group.visible = false; ctx.table.group.visible = false;
    const spirits = GC.GD.spirits;
    spirits.forEach((s, i) => {
      const row = Math.floor(i / 8), col = i % 8;
      ['front', 'side', 'back'].forEach((pose, k) => {
        const a = new Apparition({ id: s.id, name: s.name, type: s.type, side: k === 2 ? 'ally' : 'enemy', height: 1.25 });
        a.setPose(pose); a.material.uniforms.uOpacity.value = a.baseOpacity;
        a.group.position.set((col - 3.5) * 1.75 + (k - 1) * .5, 3.2 - row * 1.55, -row * .2);
        root.add(a.group);
      });
    });
    await wait(50);
  }
}
