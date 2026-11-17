import * as THREE from 'three';
import { register, unregister, onBackgroundClick, onBackgroundContext } from '../core/input.js';
import { play, unlockAudio } from '../core/audio.js';
import { compact } from '../cards/card-face.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createBattleInput(ctx) {
  const { battle: view, props, table } = ctx, GC = globalThis.GC, A = GC.actions, Q = GC.query;
  const ui = document.getElementById('ui');
  const hud = document.createElement('div'); hud.className = 'hud'; hud.style.display = 'none';
  hud.innerHTML = `<div class="hud-top"><div class="hud-turn"><small>回合</small><b id="hudTurn">1</b></div><div class="hud-title"><b id="hudTitle"></b><span id="hudSub"></span></div></div><div class="hud-menu" id="hudMenu"></div>`;
  const tags = document.createElement('div'); tags.className = 'tags'; tags.style.display = 'none';
  const tip = document.createElement('div'); tip.className = 'tip'; tip.style.display = 'none';
  ui.append(hud, tags, tip);
  const $ = id => hud.querySelector('#' + id);
  let tagKey = '', tagEnt = null, tipAnchor = null, hoverEnt = null, tipXY = [-1, -1], tagXY = [-1, -1];
  const busy = () => GC.busy || ctx.inputLock || ctx.director?.running > 0;
  const mode = () => GC.selection.targetMode || '';
  const sel = () => GC.selection.selected;

  function act(fn, sound = 'click') {
    unlockAudio();
    if (busy() || ctx.screens?.modalOpen) return;
    play(sound);
    try { const r = fn(); if (r?.catch) r.catch(e => console.error(e)); } catch (e) { console.error(e); }
    refresh();
  }

  view.hand.setHandlers({
    onClick: item => act(() => { const s = sel(); if (s?.kind === 'hand' && s.index === item.index) A.cancelSelection(); else A.selectHand(item.index); }),
    onHover: () => play('hover'),
    onDetail: item => { if (!busy()) A.showBattleDetails({ kind: 'hand', index: item.index }); }
  });
  table.slots.ally.forEach((mesh, lane) => register(mesh, {
    enabled: () => !!GC.battle && !GC.battle.units[lane] && mode() === 'deploy',
    onHover: () => table.pulseSlot('ally', lane, 1.2),
    onClick: () => act(() => A.allyLane(lane), 'click')
  }));
  ctx.on('unitCreated', ent => {
    register(ent.card.group, {
      enabled: () => !ent.vanishing,
      onHover: () => { hoverEnt = ent; showTip(ent); },
      onOut: () => { if (hoverEnt === ent) { hoverEnt = null; hideTip(); } },
      onClick: () => clickUnit(ent),
      onLongPress: () => detail(ent),
      onContext: () => detail(ent)
    });
  });
  ctx.on('unitRemoved', ent => { unregister(ent.card.group); if (hoverEnt === ent) { hoverEnt = null; hideTip(); } if (tagEnt === ent) hideTags(); });
  ctx.on('vanish', ent => { if (hoverEnt === ent) { hoverEnt = null; hideTip(); } if (tagEnt === ent) hideTags(); });

  function detail(ent) {
    if (busy()) return;
    A.showBattleDetails(ent.side === 'ally' ? { kind: 'unit', lane: ent.lane, uid: ent.uid } : { kind: 'enemy', uid: ent.uid });
  }
  function clickUnit(ent) {
    const m = mode();
    if (ent.side === 'ally') {
      act(() => { const s = sel(); if (!m && s?.kind === 'unit' && s.lane === ent.lane) A.cancelSelection(); else A.allyTarget(ent.lane); });
    } else if (m.startsWith('exactEnemy:') || m.startsWith('confuseSecond:') || m === 'enemy') act(() => A.enemyTarget(ent.uid));
    else detail(ent);
  }
  const touch = (kind, pos) => { const r = globalThis.GC_X?.touchProp(kind); if (!r) return; play(kind === 'bell' ? 'paper' : 'click'); ctx.xhud?.propSay(r, pos); ctx.emit('refresh'); };
  const idle = () => !GC.battle && !ctx.screens?.modalOpen && !!GC.state?.mainline && ctx.screens?.base === 'map';
  register(props.bell.group, {
    enabled: () => !!GC.battle || idle(),
    onHover: () => props.bell.setHover(true), onOut: () => props.bell.setHover(false),
    onClick: () => GC.battle ? endTurn() : (props.bell.ring?.(), touch('bell', props.bell.group.position))
  });
  props.artifacts.forEach((a, i) => register(a.group, {
    enabled: () => !!GC.battle,
    onHover: () => { a.hoverTarget = 1; const s = GC.GD.playerSkills[i]; showTipAt(a.group.position.clone().setY(1.2), `<b>${esc(s.name)}</b><em>御鬼者技能 · 每场一次${GC.battle?.playerSkillsUsed?.[i] ? ' · 已使用' : ''}</em><p>${esc(s.desc)}</p>`); },
    onOut: () => { a.hoverTarget = 0; hideTip(); },
    onClick: () => { if (GC.battle?.playerSkillsUsed?.[i]) { ctx.overlay.toast(`${GC.GD.playerSkills[i].name}本场已使用`, 'warn'); return; } act(() => { const s = sel(); if (s?.kind === 'playerSkill' && s.index === i) A.cancelSelection(); else A.selectPlayerSkill(i); }); }
  }));
  register(props.deck.group, { enabled: () => !!GC.battle, onHover: () => showTipAt(props.deck.group.position.clone().setY(.9), `<b>牌堆</b><p>余 ${GC.battle?.draw.length ?? 0} 张。每回合开始抽 1 张，手牌上限 12。</p>`), onOut: hideTip });
  register(props.urn.group, { enabled: () => !!GC.battle || idle(), onClick: () => { if (!GC.battle) touch('urn', props.urn.group.position); }, onHover: () => !GC.battle ? showTipAt(props.urn.group.position.clone().setY(1.3), '<b>魂瓮</b><p>叩一叩。</p>') : showTipAt(props.urn.group.position.clone().setY(1.3), `<b>魂瓮</b><p>${(GC.battle?.grave || []).map(u => esc(typeof u === 'string' ? Q.spirit(u)?.name : u.name)).join('、') || '尚无阵亡的鬼灵'}</p>`), onOut: hideTip });
  register(props.censer, { enabled: () => !!GC.battle || idle(), onClick: () => { if (!GC.battle) touch('censer', props.censer.position); }, onHover: () => { const b = GC.battle; if (!b) return showTipAt(props.censer.position.clone().setY(1.5), '<b>香炉</b><p>上一炷香。</p>'); showTipAt(props.censer.position.clone().setY(1.5), `<b>鬼气 ${b.qi}/${b.maxQi}</b><p>本场第 ${b.deployedCount + 1} 次显形需 ${Q.spiritCost()} 鬼气；左右移动每格 1 鬼气，相邻换位不耗鬼气。</p>`); }, onOut: hideTip });

  function endTurn() {
    unlockAudio();
    if (busy() || !GC.battle || ctx.screens?.modalOpen) return;
    hideTags(); hideTip(); ctx.overlay.hint('');
    A.cancelSelection();
    props.bell.setEnabled(false); props.bell.ring(); play('bell');
    Promise.resolve(A.endTurn()).catch(e => console.error(e)).finally(() => refresh());
    refresh();
  }
  onBackgroundClick(() => { if (GC.battle && !busy() && (sel() || mode())) act(() => A.cancelSelection()); });
  onBackgroundContext(() => { if (GC.battle && !busy()) act(() => A.cancelSelection()); });
  addEventListener('keydown', ev => {
    if (!GC.battle || ctx.screens?.modalOpen || ev.target?.matches?.('input,textarea,select')) return;
    if (ev.key === 'Escape') act(() => A.cancelSelection());
    else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); endTurn(); }
    else if (/^[1-9]$/.test(ev.key)) { const i = +ev.key - 1; if (GC.battle.hand[i] != null) act(() => A.selectHand(i)); }
  });

  function unitTip(u, ent) {
    const eff = Q.effectiveAttack(u), base = u.baseAtk ?? u.atk, boss = u.bossSkills?.length ? `<p><em>首领技能</em> ${u.bossSkills.map(esc).join('、')}（第 ${u.bossNext} 回合起）</p>` : '';
    return `<b>${esc(u.name)}</b><em>${esc(u.rankName || '')} · ${esc(u.type || '')}${ent?.removed ? ' · 时间删除中' : ''}</em><p>原攻 ${compact(base)}　现攻 ${compact(Math.round(eff * 10) / 10)}　生命 ${compact(Math.round(u.hp * 10) / 10)}/${compact(u.maxHp)}${u.shield ? `　护盾 ${compact(Math.round(u.shield))}` : ''}</p><p>${esc(Q.statusText(u))}</p>${boss}<p class="muted">右键 / 长按 查看完整详情</p>`;
  }
  function showTip(ent) { if (matchMedia('(hover: none)').matches || tagEnt === ent) return; tipAnchor = () => ent.card.group.position.clone().setY(.2).add(new THREE.Vector3(0, 0, -.8)); tip.innerHTML = unitTip(ent.unit, ent); tip.style.display = ''; placeTip(); }
  function showTipAt(world, html) { if (matchMedia('(hover: none)').matches) return; tipAnchor = () => world; tip.innerHTML = html; tip.style.display = ''; placeTip(); }
  function hideTip() { tipAnchor = null; tip.style.display = 'none'; }
  function placeTip() {
    if (!tipAnchor) return;
    const p = ctx.overlay.project(tipAnchor());
    const x = Math.round(Math.max(160, Math.min(innerWidth - 160, p.x))), y = Math.round(Math.max(120, p.y));
    if (x !== tipXY[0] || y !== tipXY[1]) { tipXY = [x, y]; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  }
  function hideTags() { tagEnt = null; tagKey = ''; tags.style.display = 'none'; tags.replaceChildren(); }
  function buildTags(ent) {
    const b = GC.battle, u = b.units[ent.lane]; if (!u) { hideTags(); return; }
    const skills = Q.unlockedSkills(u.id, u.rankName), defs = GC.GD.skillDefs;
    const key = ent.uid + '|' + b.qi + '|' + skills.map(n => `${n}:${Q.cooldown(u, n)}:${u.onceUsed?.[n] ? 1 : 0}`).join(',') + '|' + b.units.map(x => x ? 1 : 0).join('') + '|' + (b.domain?.uid || '');
    if (key === tagKey) return;
    tagKey = key; tagEnt = ent; tags.replaceChildren(); tags.style.display = ''; if (hoverEnt === ent) hideTip();
    const add = (label, small, cls, disabled, fn, title) => {
      const t = document.createElement('button'); t.className = 'tag ' + cls; t.disabled = !!disabled; t.title = title || '';
      t.innerHTML = `${esc(label)}<small>${esc(small)}</small>`; t.style.animationDelay = tags.children.length * 35 + 'ms';
      t.onclick = ev => { ev.stopPropagation(); if (!t.disabled) act(fn); };
      tags.append(t);
    };
    const mv = d => { const to = ent.lane + d, other = to >= 0 && to <= 3 ? b.units[to] : null, cost = other ? 0 : 1; add(d < 0 ? '左移' : '右移', other ? '换位' : '1气', 'move', to < 0 || to > 3 || b.qi < cost, () => A.moveSpirit(d)); };
    mv(-1);
    for (const name of skills) {
      const d = defs[name] || {}, cd = Q.cooldown(u, name), used = (d.once || d.oncePerBattle) && u.onceUsed?.[name];
      if (d.passive) add(name, '被动', 'passive', true, () => { }, d.desc);
      else if (d.toggle) add(name, b.domain?.uid === u.uid ? '收回' : '展开', 'domain', false, () => A.exactSpiritSkill(name), d.desc);
      else add(name, used ? '已用' : cd ? `冷却${cd}` : `${d.cost || 0}气`, d.once ? 'domain' : '', used || cd > 0 || b.qi < (d.cost || 0), () => A.exactSpiritSkill(name), d.desc);
    }
    mv(1);
    add('详情', '查看', 'move', false, () => detail(ent));
  }
  function placeTags() {
    if (!tagEnt) return;
    const p = ctx.overlay.project(tagEnt.card.group.position.clone().add(new THREE.Vector3(0, .1, -.85)));
    const x = Math.round(Math.max(180, Math.min(innerWidth - 180, p.x))), y = Math.round(p.y);
    if (x !== tagXY[0] || y !== tagXY[1]) { tagXY = [x, y]; tags.style.left = x + 'px'; tags.style.top = y + 'px'; }
  }

  function refresh() {
    const b = GC.battle;
    hud.style.display = b ? '' : 'none';
    if (!b) { hideTags(); hideTip(); ctx.overlay?.hint(''); table.clearGlow(); return; }
    const m = mode(), s = sel(), locked = busy();
    $('hudTurn').textContent = b.turn;
    $('hudTitle').textContent = b.testMode ? '演武 · 自定测试' : (GC.NODES[b.nodeId]?.title || '');
    $('hudSub').textContent = b.testMode ? '结果不写入存档' : `${GC.MODE_NAMES?.[GC.state.mode] || ''} · ${GC.DIFFICULTIES?.[b.difficulty]?.name || '简单'}${GC.state.mode === 'endless' ? ` · 第${GC.state.wave}波` : ''} · 敌 ${b.enemies.filter(e => !e.dead).length}${(b.removedEnemies || []).length ? `（${b.removedEnemies.length} 名被时间删除）` : ''}`;
    for (const it of view.hand.items) {
      it.selected = s?.kind === 'hand' && s.index === it.index;
      it.card.setHighlight(it.selected ? 'selected' : it.affordable && !locked && !m ? 'playable' : null);
      it.card.setDim(!it.affordable);
    }
    view.hand.setLowered(m && !locked ? 1 : 0);
    table.clearGlow();
    if (m === 'deploy') b.units.forEach((u, lane) => { if (!u) table.setSlotGlow('ally', lane, 1); });
    const first = m.startsWith('confuseSecond:') ? m.slice(14) : null;
    for (const ent of view.units.values()) {
      if (ent.vanishing) continue;
      let h = null;
      if (ent.side === 'ally') { if (m === 'ally' || m.startsWith('player:') || m.startsWith('exactAlly:')) h = 'allyTarget'; else if (s?.kind === 'unit' && s.lane === ent.lane) h = 'selected'; }
      else if ((m.startsWith('exactEnemy:') || first) && !ent.removed && ent.uid !== first) h = 'target';
      else if (first && ent.uid === first) h = 'selected';
      if (ent.card.highlight !== 'acting') ent.card.setHighlight(h);
    }
    props.artifacts.forEach((a, i) => { a.hoverTarget = s?.kind === 'playerSkill' && s.index === i ? 1 : a.hoverTarget && hoverArtifact === i ? 1 : 0; });
    let hint = '';
    if (!locked) {
      if (m === 'deploy') hint = `选择一处空阵位显形 · 耗 ${Q.spiritCost()} 鬼气`;
      else if (m === 'ally') hint = `选择一名我方鬼灵 · ${GC.SKILLS[s?.id]?.name || ''}`;
      else if (m.startsWith('player:')) hint = `选择一名我方鬼灵 · ${GC.GD.playerSkills[+m.slice(7)]?.name || ''}`;
      else if (m.startsWith('exactEnemy:')) hint = `选择敌方目标 · ${m.slice(11)}`;
      else if (m.startsWith('exactAlly:')) hint = `选择我方目标 · ${m.slice(10)}`;
      else if (first) hint = '迷惑 · 再选一名被攻击的敌人';
    }
    ctx.overlay?.hint(hint);
    if (!locked && s?.kind === 'unit' && !m) { const ent = [...view.units.values()].find(e => e.side === 'ally' && e.lane === s.lane && !e.vanishing); if (ent) buildTags(ent); else hideTags(); }
    else hideTags();
    props.bell.setEnabled(!locked);
    menu(b);
  }
  let hoverArtifact = -1, menuKey = '';
  function menu(b) {
    const key = `${b.testMode ? 't' : ''}${GC.state.mode}`;
    if (key === menuKey) return;
    menuKey = key;
    const box = $('hudMenu'); box.replaceChildren();
    const btn = (label, fn) => { const x = document.createElement('button'); x.className = 'ink-btn'; x.textContent = label; x.onclick = () => { unlockAudio(); play('click'); fn(); }; box.append(x); };
    btn('战况', () => ctx.screens?.show('battleLog'));
    if (GC.state.mode === 'endless' && !b.testMode) btn('战中升级', () => { if (!busy()) A.openBattleUpgrade(); });
    btn('指南', () => A.openGuide?.(0));
    btn('设置', () => A.presentationSettings());
    if (ctx.cine) btn(`演出 · ${ctx.cine.modeName}`, () => ctx.cine.cycle());
    if (b.testMode) btn('结束演武', () => { if (!busy()) A.exitTestBattle(); });
    else btn('离开', () => ctx.screens?.show('leaveBattle'));
  }
  ctx.on('cineMode', () => { menuKey = ''; refresh(); });
  ctx.on('battleSynced', refresh);
  ctx.on('battleCleared', () => { menuKey = ''; refresh(); });
  ctx.on('refresh', refresh);

  let wasBusy = false, lastTip = '';
  function update() {
    placeTags(); placeTip();
    const bz = busy();
    if (bz !== wasBusy) { wasBusy = bz; refresh(); }
    if (hoverEnt && tipAnchor && !bz && hoverEnt !== tagEnt) { const html = unitTip(hoverEnt.unit, hoverEnt); if (html !== lastTip) { lastTip = html; tip.innerHTML = html; } }
  }
  return { refresh, update, endTurn, hideTags, hideTip };
}
