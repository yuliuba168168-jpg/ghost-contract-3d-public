// 方块版战斗：整块 DOM 按状态重画，点击走事件委托。操作与完整版 battle-input.js 等价。
import { play, unlockAudio } from '../app/core/audio.js';
import { LINES } from '../app/battle/shadow-lines.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => { n = Math.round((+n || 0) * 10) / 10; return n >= 1e8 ? +(n / 1e8).toFixed(2) + '亿' : n >= 1e4 ? +(n / 1e4).toFixed(1) + '万' : String(n); };
const WAIT = { attack: 260, direct: 260, 'skill:cast': 320, 'card:play': 240, playerSkill: 320, 'boss:cast': 420, deploy: 120, move: 100, deaths: 220, 'turn:start': 160, draw: 60, 'unit:skip': 180, 'status:tick': 90, return: 140, 'enemy:return': 140, 'bond:strike': 420, 'battle:win': 600, 'battle:lose': 600 };
const RARITY = { '普通': 'r0', '稀有': 'r1', '珍藏': 'r2', '传说': 'r3' };

export function createSimpleBattle(ctx, ui) {
  const GC = globalThis.GC, A = GC.actions, Q = GC.query, X = () => globalThis.GC_X;
  const root = document.createElement('div'); root.className = 'sb'; root.hidden = true; ui.append(root);
  let visible = false, queued = false, hintText = '', say = '', sayTimer = 0, caption = '', capTimer = 0;
  const marks = new Map(), floats = new Map();   // uid → 高亮类名 / 飘字

  const speed = () => Math.max(.25, Number(GC.preferences?.speed) || 1);
  const sleep = ms => new Promise(r => setTimeout(r, ms / speed()));
  function refresh() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); }
  function mark(uid, cls, ms = 420) { if (!uid) return; marks.set(uid, cls); setTimeout(() => { if (marks.get(uid) === cls) { marks.delete(uid); refresh(); } }, ms); }
  function float(key, text, kind = 'info', ms = 900) { if (!key || !text) return; const f = { text, kind }; floats.set(key, f); setTimeout(() => { if (floats.get(key) === f) { floats.delete(key); refresh(); } }, ms); }
  function cap(text, ms = 1100) { caption = text; clearTimeout(capTimer); capTimer = setTimeout(() => { caption = ''; refresh(); }, ms); }
  function speak(event, chance = 1) {
    const pool = LINES[event]; if (!pool || !ctx.battleActive || Math.random() > chance) return;
    say = pool[Math.floor(Math.random() * pool.length)]; clearTimeout(sayTimer); sayTimer = setTimeout(() => { say = ''; refresh(); }, 3600);
  }

  function bar(v, max, cls) { const p = Math.max(0, Math.min(100, max > 0 ? v / max * 100 : 0)); return `<span class="sb-bar ${cls}"><i style="width:${p.toFixed(0)}%"></i></span>`; }
  function unitHtml(u, side, lane, b, s, m, intent) {
    const eff = Q.effectiveAttack(u), st0 = Q.statusText(u), status = /^无增益/.test(st0) ? '' : st0, kws = X()?.keywordsOf(u) || [], f = floats.get(u.uid);
    const first = m.startsWith('confuseSecond:') ? m.slice(14) : '';
    let cls = marks.get(u.uid) || '';
    if (side === 'ally') { if (m === 'ally' || m.startsWith('player:') || m.startsWith('exactAlly:')) cls += ' can'; else if (s?.kind === 'unit' && s.lane === lane) cls += ' sel'; }
    else if ((m.startsWith('exactEnemy:') || first) && u.uid !== first) cls += ' can'; else if (first && u.uid === first) cls += ' sel';
    const boss = u.bossSkills?.length ? `<small class="sb-boss">首领 · ${esc(u.bossSkills.join('、'))}（第${u.bossNext}回合起）</small>` : '';
    let it = '';
    if (intent) {
      const parts = [];
      if (intent.cast) parts.push('术·' + intent.cast.name);
      if (intent.action === 'skip') parts.push('停手'); else parts.push((intent.action === 'lamp' ? '打命灯 ' : '攻击 ') + num(intent.damage) + (intent.times > 1 ? '×' + intent.times : ''));
      if (!intent.cast && intent.castIn != null && intent.castIn <= 1) parts.push('蓄力');
      it = `<small class="sb-int">下回合：${esc(parts.join(' · '))}</small>`;
    }
    const tip = [u.name, status, ...kws.map(k => `【${k.name}】${k.desc}`)].filter(Boolean).join('\n');
    return `<div class="sb-unit ${side} ${cls}" data-act="${side}" data-arg="${side === 'ally' ? lane : esc(u.uid)}" data-detail='${esc(JSON.stringify(side === 'ally' ? { kind: 'unit', lane, uid: u.uid } : { kind: 'enemy', uid: u.uid }))}' title="${esc(tip)}">
      <b>${esc(u.name)}</b><small>${esc(u.rankName || '')}${u.type ? ' · ' + esc(u.type) : ''}</small>
      <span class="sb-stat">攻 ${num(eff)}　命 ${num(u.hp)}/${num(u.maxHp)}${u.shield ? '　盾 ' + num(u.shield) : ''}</span>${bar(u.hp, u.maxHp, 'hp')}
      ${kws.length ? `<small class="sb-kw">${kws.map(k => esc(k.name)).join(' ')}</small>` : ''}${status ? `<small class="sb-st">${esc(status)}</small>` : ''}${boss}${it}
      ${f ? `<em class="sb-float ${f.kind}">${esc(f.text)}</em>` : ''}</div>`;
  }
  function render() {
    const b = GC.battle;
    if (!visible || !b || !ctx.battleActive) { root.hidden = true; return; }
    root.hidden = false;
    const s = GC.selection.selected, m = GC.selection.targetMode || '', locked = !!GC.busy, st = GC.state, node = GC.NODES[b.nodeId];
    const field = X()?.field(b), wr = X()?.wardRule(b), ward = Q.wardInfo ? Q.wardInfo() : null, relics = X()?.relics() || [], affixes = (st.mode === 'endless' || st.daily) ? (X()?.affixes() || []) : [];
    const intents = new Map((X()?.intents(b) || []).map(i => [i.uid, i]));
    const chips = [];
    if (field) chips.push(`<span class="sb-chip" title="${esc(field.desc)}">场地 · ${esc(field.name)}：${esc(field.desc)}</span>`);
    if (ward) chips.push(`<span class="sb-chip ward" title="鬼障：首领受到的伤害被削减；每回合施放的技能越多破得越开。">鬼障 ${ward.layers} 层 · 已破 ${ward.casts} · 伤害×${(+ward.factor).toFixed(2)}</span>`);
    if (wr) chips.push(`<span class="sb-chip ${wr.met ? 'met' : 'ward'}" title="${esc(wr.desc)}">${esc(wr.name)}${wr.met ? ' · 已满足' : ''}：${esc(wr.desc)}</span>`);
    for (const a of affixes) chips.push(`<span class="sb-chip" title="${esc(a.desc)}">词缀 · ${esc(a.name)}</span>`);
    if (relics.length) chips.push(`<span class="sb-chip" title="${esc(relics.map(r => r.name + '：' + r.desc).join('\n'))}">法器 ${relics.length}</span>`);
    const menu = [['log', '战况'], ...(st.mode === 'endless' && !b.testMode ? [['upgrade', '战中升级']] : []), ['guide', '指南'], ['settings', '设置'], b.testMode ? ['exitTest', '结束演武'] : ['leave', '离开']];

    let hint = locked ? '结算中…' : '点手牌出牌；点我方鬼灵选技能或移动；右键任意方块看详情。';
    if (!locked) {
      if (m === 'deploy') hint = `选择一处空阵位显形 · 耗 ${Q.spiritCost()} 鬼气`;
      else if (m === 'ally') hint = `选择一名我方鬼灵 · ${GC.SKILLS[s?.id]?.name || ''}`;
      else if (m.startsWith('player:')) hint = `选择一名我方鬼灵 · ${GC.GD.playerSkills[+m.slice(7)]?.name || ''}`;
      else if (m.startsWith('exactEnemy:')) hint = `选择敌方目标 · ${m.slice(11)}`;
      else if (m.startsWith('exactAlly:')) hint = `选择我方目标 · ${m.slice(10)}`;
      else if (m.startsWith('confuseSecond:')) hint = '迷惑 · 再选一名被攻击的敌人';
    }
    if (hintText) hint = hintText;

    const enemyRow = [0, 1, 2, 3].map(l => { const list = b.enemies.filter(e => !e.dead && e.lane === l); return `<div class="sb-cell enemy">${list.map(e => unitHtml(e, 'enemy', l, b, s, m, intents.get(e.uid))).join('') || '<i class="sb-empty">空</i>'}</div>`; }).join('');
    const allyRow = [0, 1, 2, 3].map(l => { const u = b.units[l]; return `<div class="sb-cell ally">${u ? unitHtml(u, 'ally', l, b, s, m, null) : `<button class="sb-slot ${m === 'deploy' ? 'can' : ''}" data-act="slot" data-arg="${l}">${'壹贰叁肆'[l]}路${m === 'deploy' ? '<br>点此显形' : ''}</button>`}</div>`; }).join('');

    let actions = '';
    if (!locked && s?.kind === 'unit' && !m && b.units[s.lane]) {
      const u = b.units[s.lane], defs = GC.GD.skillDefs, skills = Q.unlockedSkills(u.id, u.rankName), btns = [];
      const mv = d => { const to = s.lane + d, other = to >= 0 && to <= 3 ? b.units[to] : null, cost = other ? 0 : 1; btns.push(`<button data-act="move" data-arg="${d}" ${to < 0 || to > 3 || b.qi < cost ? 'disabled' : ''}>${d < 0 ? '← 左移' : '右移 →'}<small>${other ? '换位' : '1气'}</small></button>`); };
      mv(-1);
      for (const name of skills) {
        const d = defs[name] || {}, cd = Q.cooldown(u, name), used = (d.once || d.oncePerBattle) && u.onceUsed?.[name];
        if (d.passive) btns.push(`<button disabled class="passive" title="${esc(d.desc)}">${esc(name)}<small>被动</small></button>`);
        else if (d.toggle) btns.push(`<button data-act="skill" data-arg="${esc(name)}" title="${esc(d.desc)}">${esc(name)}<small>${b.domain?.uid === u.uid ? '收回' : '展开'}</small></button>`);
        else btns.push(`<button data-act="skill" data-arg="${esc(name)}" title="${esc(d.desc)}" ${used || cd > 0 || b.qi < (d.cost || 0) ? 'disabled' : ''}>${esc(name)}<small>${used ? '已用' : cd ? '冷却' + cd : (d.cost || 0) + '气'}</small></button>`);
      }
      mv(1);
      btns.push(`<button data-act="detail" data-arg='${esc(JSON.stringify({ kind: 'unit', lane: s.lane, uid: u.uid }))}'>详情</button>`, '<button data-act="cancel">取消</button>');
      actions = `<div class="sb-actions"><b>${esc(u.name)}</b>${btns.join('')}</div>`;
    } else if (!locked && (s || m)) actions = '<div class="sb-actions"><button data-act="cancel">取消选择</button></div>';

    const ps = GC.GD.playerSkills.map((k, i) => `<button class="${s?.kind === 'playerSkill' && s.index === i ? 'sel' : ''}" data-act="ps" data-arg="${i}" title="${esc(k.desc)}" ${b.playerSkillsUsed?.[i] ? 'disabled' : ''}>${esc(k.name)}<small>${b.playerSkillsUsed?.[i] ? '已用' : '每场一次'}</small></button>`).join('');
    const bonds = (X()?.bonds(b) || []).map(x => `<button class="bond" data-act="bond" data-arg="${esc(x.key)}" title="${esc(x.desc)}" ${x.ready && !locked ? '' : 'disabled'}>合击·${esc(x.strike)}<small>${x.used ? '已用' : x.cost + '气'}</small></button>`).join('');
    const hand = b.hand.map((e, i) => {
      const sp = Q.handSpirit(e), on = s?.kind === 'hand' && s.index === i ? ' sel' : '', det = `data-detail='${esc(JSON.stringify({ kind: 'hand', index: i }))}'`;
      if (sp) { const cost = Q.spiritCost(); return `<div class="sb-card spirit${on}${b.qi < cost ? ' poor' : ''}" data-act="hand" data-arg="${i}" ${det}><i>${cost}</i><b>${esc(sp.name)}</b><small>${esc(sp.rankName || '')} · 鬼灵</small><span>攻 ${num(sp.atk ?? sp.baseAtk)}　命 ${num(sp.hp)}/${num(sp.maxHp)}</span></div>`; }
      const c = GC.SKILLS[e] || { name: String(e), cost: 0, desc: '' };
      return `<div class="sb-card ${RARITY[c.rarity] || 'r0'}${on}${b.qi < c.cost ? ' poor' : ''}" data-act="hand" data-arg="${i}" ${det} title="${esc(c.desc)}"><i>${c.cost}</i><b>${esc(c.name)}</b><small>${esc(c.rarity || '')}</small><span>${esc(c.desc)}</span></div>`;
    }).join('');
    const fw = floats.get('will'), fe = floats.get('enemyWill');

    root.innerHTML = `
<div class="sb-top"><b class="sb-turn">回合 ${b.turn}</b><span class="sb-title">${esc(b.testMode ? '演武' : node?.title || '')} · ${esc(GC.DIFFICULTIES?.[Q.difficultyOf?.()]?.name || '')}</span><span class="sb-menu">${menu.map(([k, l]) => `<button data-act="menu" data-arg="${k}">${l}</button>`).join('')}</span></div>
<div class="sb-chips">${chips.join('')}</div>
<div class="sb-lamp enemy">敌方命灯 ${bar(b.enemyWill, b.maxEnemyWill ?? 10, 'lamp')} <b>${num(b.enemyWill)}/${num(b.maxEnemyWill ?? 10)}</b>${fe ? `<em class="sb-float ${fe.kind}">${esc(fe.text)}</em>` : ''}<q>${esc(say)}</q></div>
<div class="sb-board"><div class="sb-row">${enemyRow}</div><div class="sb-cap">${esc(caption)}</div><div class="sb-row">${allyRow}</div></div>
<div class="sb-lamp ally">我方命灯 ${bar(b.will, b.maxWill ?? 10, 'lamp')} <b>${num(b.will)}/${num(b.maxWill ?? 10)}</b>${fw ? `<em class="sb-float ${fw.kind}">${esc(fw.text)}</em>` : ''}
  <span class="sb-qi">鬼气 <b>${num(b.qi)}/${num(b.maxQi)}</b></span><span>牌堆 ${b.draw?.length ?? 0}</span><span>魂瓮 ${b.grave?.length ?? 0}</span>
  <span class="sb-side">${ps}${bonds}<button class="end" data-act="end" ${locked ? 'disabled' : ''}>结束回合</button></span></div>
${actions}
<div class="sb-hint">${esc(hint)}</div>
<div class="sb-hand">${hand || '<i class="sb-empty">没有手牌</i>'}</div>
<div class="sb-log">${(b.log || []).slice(0, 4).map(x => `<p>${esc(x)}</p>`).join('')}</div>`;
    ctx.emit('battleSynced', b);
  }

  function act(fn, sound = 'click') {
    unlockAudio();
    if (GC.busy || ctx.screens?.modalOpen) return;
    play(sound);
    try { const r = fn(); if (r?.catch) r.catch(e => console.error(e)).finally(refresh); } catch (e) { console.error(e); }
    refresh();
  }
  function detail(sel) { if (!GC.busy && sel) A.showBattleDetails(sel); }
  function endTurn() {
    unlockAudio();
    if (GC.busy || !GC.battle || ctx.screens?.modalOpen) return;
    A.cancelSelection(); play('bell');
    Promise.resolve(A.endTurn()).catch(e => console.error(e)).finally(refresh);
    refresh();
  }
  const parse = t => { try { return JSON.parse(t.dataset.detail || t.dataset.arg); } catch { return null; } };
  root.addEventListener('click', ev => {
    const t = ev.target.closest('[data-act]'); if (!t || t.disabled || !GC.battle) return;
    const k = t.dataset.act, arg = t.dataset.arg, s = GC.selection.selected, m = GC.selection.targetMode || '';
    if (k === 'hand') act(() => { if (s?.kind === 'hand' && s.index === +arg) A.cancelSelection(); else A.selectHand(+arg); });
    else if (k === 'slot') { if (m === 'deploy') act(() => A.allyLane(+arg)); }
    else if (k === 'ally') act(() => { if (!m && s?.kind === 'unit' && s.lane === +arg) A.cancelSelection(); else A.allyTarget(+arg); });
    else if (k === 'enemy') { if (m.startsWith('exactEnemy:') || m.startsWith('confuseSecond:') || m === 'enemy') act(() => A.enemyTarget(arg)); else detail(parse(t)); }
    else if (k === 'ps') act(() => { if (s?.kind === 'playerSkill' && s.index === +arg) A.cancelSelection(); else A.selectPlayerSkill(+arg); });
    else if (k === 'bond') act(() => X().bondStrike(arg), 'skill');
    else if (k === 'move') act(() => A.moveSpirit(+arg));
    else if (k === 'skill') act(() => A.exactSpiritSkill(arg));
    else if (k === 'detail') detail(parse(t));
    else if (k === 'cancel') act(() => A.cancelSelection());
    else if (k === 'end') endTurn();
    else if (k === 'menu') {
      unlockAudio(); play('click');
      if (arg === 'log') ctx.screens.show('battleLog'); else if (arg === 'guide') A.openGuide?.(0); else if (arg === 'settings') A.presentationSettings();
      else if (arg === 'leave') ctx.screens.show('leaveBattle'); else if (arg === 'upgrade') { if (!GC.busy) A.openBattleUpgrade(); } else if (arg === 'exitTest') { if (!GC.busy) A.exitTestBattle(); }
    }
  });
  root.addEventListener('contextmenu', ev => { ev.preventDefault(); const t = ev.target.closest('[data-detail]'); if (t) detail(parse(t)); else if (GC.battle && !GC.busy) act(() => A.cancelSelection()); });
  addEventListener('keydown', ev => {
    if (!GC.battle || !ctx.battleActive || ctx.screens?.modalOpen || ev.target?.matches?.('input,textarea,select')) return;
    if (ev.key === 'Escape') act(() => A.cancelSelection());
    else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); endTurn(); }
    else if (/^[1-9]$/.test(ev.key)) { const i = +ev.key - 1; if (GC.battle.hand[i] != null) act(() => A.selectHand(i)); }
  });
  ctx.on('refresh', refresh);

  // ---- 演出：只做高亮、飘字、一行字幕和短暂停顿 ----
  const director = {
    running: 0, update() { },
    async handle(type, p) {
      ctx.emit('fx', type, p);
      const b = GC.battle;
      if (type === 'attack') { mark(p.attacker?.uid, 'acting'); mark(p.target?.uid, 'hit'); }
      else if (type === 'direct') { mark(p.attacker?.uid, 'acting'); }
      else if (type === 'float') { const key = typeof p.target === 'string' ? p.target : p.target?.uid; float(key, p.text, p.kind + (p.critical ? ' crit' : '')); }
      else if (type === 'skill:cast') { cap(`「${p.name}」`); mark(p.source?.uid, 'acting'); for (const t of p.targets || []) mark(t.uid, 'hit'); }
      else if (type === 'card:play') { const c = GC.SKILLS[p.cardId]; cap(`出牌 · ${c?.name || p.cardId}`); if (c?.ops?.some(o => o[0] === 'kill')) speak('sacrifice'); else if (c?.rarity === '传说' || c?.rarity === '珍藏') speak('rare', .7); }
      else if (type === 'playerSkill') cap(`御鬼者 · ${p.name}`);
      else if (type === 'boss:cast') { cap(`首领施法 · ${p.name}`, 1500); mark(p.uid, 'acting', 700); }
      else if (type === 'boss:phase') { cap(`${p.name} · ${p.phase}：${p.desc}`, 2600); ctx.overlay.toast(`${p.name} 进入${p.phase}`, 'warn'); }
      else if (type === 'field:change') cap(`场地 · ${p.name}：${p.desc}`, 2200);
      else if (type === 'bond:strike') cap(`合击 · ${p.strike}`, 1400);
      else if (type === 'unit:skip') float(p.uid, p.label || '停手', 'info');
      else if (type === 'status:tick') float(p.uid, p.label, p.kind === 'burn' ? 'damage' : 'heal');
      else if (type === 'react') float(p.uid, p.label || p.name, 'info', 700);
      else if (type === 'keyword') float(p.uid, '亡语', 'info');
      else if (type === 'deaths') { for (const u of p.units || []) mark(u.uid, 'dead', 300); speak(p.units?.some(u => u.side === 'ally') ? 'allyDeath' : 'enemyDeath', .4); }
      else if (type === 'shadow') speak(p.event, p.event === 'turn' ? .4 : 1);
      else if (type === 'turn:start') { cap(`第 ${p.turn} 回合`, 800); if (b && b.will / b.maxWill < .3) speak('lowLamp', .6); }
      else if (type === 'battle:win') { cap('胜', 1500); speak('win'); }
      else if (type === 'battle:lose') { cap('败', 1500); speak('lose'); }
      else if (type === 'battle:enter') { marks.clear(); floats.clear(); caption = ''; say = ''; }
      refresh();
      const ms = WAIT[type];
      if (ms) { director.running++; try { await sleep(ms); } finally { director.running--; } refresh(); }
    }
  };
  const view = {
    sync: refresh, requestSync: refresh, update() { },
    clear() { marks.clear(); floats.clear(); caption = ''; say = ''; ctx.emit('battleCleared'); refresh(); },
    hand: { setVisible(v) { visible = !!v; refresh(); } }
  };
  return { view, director, hint(text = '') { if (text !== hintText) { hintText = text; refresh(); } } };
}
