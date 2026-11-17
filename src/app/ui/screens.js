import { createMapView } from './map-view.js';
import { createWheel } from './wheel.js';
// 五档难度的主题色（轮盘、标题页存档位、禁忌红光）
const DIFF_TONE = { easy: '#9fd0c8', normal: '#ffd98a', hard: '#ff9a4a', nightmare: '#b07cff', taboo: '#ff2a1a' };
import { createStoryStage } from './story-stage.js';
import { hasViews, artImage, viewImage } from '../core/assets.js';
import { slotList } from '../core/asset-slots.js';
import { skillTier } from '../fx/skill-tier.js';
import { GUIDE } from './guide-data.js';
import { makeCanvas } from '../scene/textures.js';
import { CW, CH, drawUnitFace, drawSkillFace, unitDescriptor, compact, RARITY } from '../cards/card-face.js';
import { play, unlockAudio } from '../core/audio.js';
import { quality, setQuality, qualityLocked, autoQuality, LITE } from '../core/quality.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => compact(Math.round((+n || 0) * 10) / 10);
const MODE_DESC = { normal: '命灯尽灭后回到上一处篝火，全队恢复，篝火之后的进度回滚。', hardcore: '命灯尽灭即本轮结束，只能重新建立旅途。', endless: '全部鬼灵从噩梦一阶起步，敌人逐波增强，伤势跨波保留，战斗中可升级。' };

export function createScreens(ctx) {
  const GC = globalThis.GC, A = GC.actions, Q = GC.query, GD = GC.GD;
  const ui = document.getElementById('ui');
  const layer = document.createElement('div'); layer.style.cssText = 'inset:0;pointer-events:none'; ui.append(layer);
  const mapLabels = document.createElement('div'); mapLabels.style.cssText = 'inset:0;pointer-events:none;overflow:hidden'; layer.append(mapLabels);
  const baseEl = document.createElement('div'); baseEl.style.cssText = 'inset:0;pointer-events:none;position:absolute'; layer.append(baseEl);
  const tipEl = document.createElement('div'); layer.append(tipEl);
  const mapView = (ctx.makeMapView || createMapView)(ctx, mapLabels); ctx.mapView = mapView;
  let base = '', sheetEl = null, sheetName = '', queue = [], archiveFrom = 'map', testCfg = null, codexTab = 'spirits';
  const thumbs = new Map();
  ctx.battleActive = false;

  function thumb(key, draw) {
    if (!thumbs.has(key)) { const [full] = makeCanvas(CW, CH); draw(full); const [small, g] = makeCanvas(256, 371); g.drawImage(full, 0, 0, 256, 371); thumbs.set(key, small); }
    const src = thumbs.get(key), [c, g] = makeCanvas(256, 371); g.drawImage(src, 0, 0); c.className = 'thumb';
    return c;
  }
  const unitThumb = u => { const d = unitDescriptor(u); return thumb('u:' + [d.id, d.name, d.rankName, num(d.baseAtk), num(d.hp), num(d.maxHp), d.bossSkills.join()].join('|'), c => drawUnitFace(c, d)); };
  const skillThumb = id => thumb('s:' + id, c => drawSkillFace(c, id));
  const spiritUnit = s => ({ id: s.id, name: s.name, rankName: s.rankName, type: s.type, baseAtk: s.atk, atk: s.atk, hp: s.dead ? 0 : s.hp, maxHp: s.maxHp });
  const codexUnit = (c, rank = c.initialRank) => { const st = Q.spiritStats(c.id, rank, c.potential); return { id: c.id, name: c.name, rankName: c.id === 'nannan' ? '禁忌' : rank, type: c.type, baseAtk: st.atk, atk: st.atk, hp: st.hp, maxHp: st.hp }; };

  function fill(root, html) { root.innerHTML = html; root.querySelectorAll('[data-thumb]').forEach(el => { const [kind, ...rest] = el.dataset.thumb.split(':'), key = rest.join(':'); el.replaceWith(kind === 's' ? skillThumb(key) : unitThumb(thumbSources.get(key))); }); }
  const thumbSources = new Map(); let thumbSeq = 0;
  const TU = u => { const k = 'k' + (++thumbSeq); thumbSources.set(k, u); return `<i data-thumb="u:${k}"></i>`; };
  const TS = id => `<i data-thumb="s:${esc(id)}"></i>`;

  function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; sheetName = ''; } if (glowEl?.classList.contains('on')) tabooGlow(false); }   // 禁忌红光跟着面板一起收
  function sheet(name, { kicker = '', title = '', aside = '', body = '', foot = [], cls = '', acts = {} }) {
    closeSheet();
    ctx.input?.hideTags?.(); ctx.input?.hideTip?.();
    const veil = document.createElement('div'); veil.className = 'sheet-veil';
    const box = document.createElement('div'); box.className = 'sheet ' + cls;
    box.dataset.sheet = name;
    fill(box, `<div class="sheet-head"><div><span class="kicker">${esc(kicker)}</span><h2>${esc(title)}</h2></div><div class="aside">${aside}</div></div><div class="sheet-body">${body}</div><div class="sheet-foot"></div>`);
    thumbSources.clear();
    const footEl = box.querySelector('.sheet-foot');
    for (const f of foot) {
      if (f === '-') { const s = document.createElement('span'); s.className = 'spacer'; footEl.append(s); continue; }
      const b = document.createElement('button'); b.className = 'ink-btn' + (f.primary ? ' primary' : ''); b.textContent = f.label; b.disabled = !!f.disabled;
      b.onclick = () => { unlockAudio(); play('click'); f.fn(); };
      footEl.append(b);
    }
    box.addEventListener('click', ev => {
      const el = ev.target.closest('[data-act]');
      if (!el || el.disabled) return;
      unlockAudio(); play('click');
      acts[el.dataset.act]?.(el.dataset.arg, el, box);
    });
    veil.append(box); ui.append(veil);
    sheetEl = veil; sheetName = name;
    play('paper');
    return box;
  }
  function setBase(name) {
    if (base === name) return false;
    base = name; tipEl.replaceChildren();   // 换界面时收起上一个界面的指南提示
    baseEl.replaceChildren();
    ctx.battleActive = name === 'battle'; ctx.R.hud = name === 'battle';
    if (name !== 'map') mapView.hide();
    if (name !== 'battle') { ctx.battle.clear(false); ctx.battle.hand.setVisible(false); ctx.emit('refresh'); ctx.overlay?.hint(''); ctx.status?.setDespair(false); ctx.opponent.reset(); ctx.lights.state.dim = 1; ctx.R.grade.uDesat.value = 0; ctx.R.grade.uEdgeDark.value = 0; const st = GC.state; ctx.props.deck.setCount(st?.deck?.length || 0); ctx.props.setLife('ally', st?.mainline ? st.will : 10, st?.mainline ? st.maxWill : 10); ctx.props.setLife('enemy', 10, 10); ctx.props.setQi(0, 0); ctx.props.urn.setCount(st?.spirits?.filter(s => s.dead).length || 0); ctx.props.artifacts.forEach(a => { if (a.used) a.setUsed(false); }); }
    return true;
  }
  const btn = (label, fn, primary) => { const b = document.createElement('button'); b.className = 'ink-btn' + (primary ? ' primary' : ''); b.textContent = label; b.onclick = () => { unlockAudio(); play('click'); fn(); }; return b; };
  // 难度轮盘：不显示原始倍率（各难度的倍率经过按等级段拉平，数字本身不可比），改用五格强度刻度
  const DIFF_BARS = { easy: [1, 0, 0], normal: [2, 1, 1], hard: [3, 2, 2], nightmare: [4, 4, 4], taboo: [5, 5, 5] };
  const bars = n => `<i class="bars">${[0, 1, 2, 3, 4].map(k => `<u class="${k < n ? 'on' : ''}"></u>`).join('')}</i>`;
  const diffItems = () => Object.keys(GC.DIFFICULTIES).map(d => ({ key: d, name: GC.DIFFICULTIES[d].name, desc: GC.DIFFICULTIES[d].desc, color: DIFF_TONE[d], cls: 'diff-' + d }));
  const diffCard = it => { const b = DIFF_BARS[it.key] || [1, 0, 0]; return `<b>${esc(it.name)}</b><p>${esc(it.desc)}</p><div class="diff-bars"><span>敌势${bars(b[0])}</span><span>鬼障${bars(b[1])}</span><span>首领${bars(b[2])}</span></div>`; };
  // 选中禁忌难度：整屏泛起脉动的红光，3D 画面一并压红
  let glowEl = null;
  function tabooGlow(on) {
    if (on && !glowEl) { glowEl = document.createElement('div'); glowEl.className = 'taboo-glow'; glowEl.innerHTML = '<i></i><b>禁忌</b>'; (document.getElementById('ui') || document.body).append(glowEl); }
    if (glowEl) { glowEl.classList.toggle('on', !!on); document.body.classList.toggle('taboo', !!on); }
    ctx.overlay?.flash && on && ctx.overlay.flash('#c2261d', .35, 900);
  }
  const slotLine = s => s ? `${GC.MODE_NAMES[s.mode]} · ${GC.DIFFICULTIES[s.difficulty]?.name || '简单'} · ${s.mode === 'endless' ? `第${s.wave}波` : (GC.NODES[s.current]?.title || '启程')}` : '尚未启程';

  const stage = (ctx.makeStoryStage || createStoryStage)(ctx); ctx.storyStage = stage;
  const storyMode = () => { const v = localStorage.getItem('gc3d-story-mode'); return !LITE && !ctx.simple && (v ? v !== 'plain' : !quality().plain); };   // 极简档默认纯文字剧情
  const shownBattle = new Set();
  const htmlEl = html => { const d = document.createElement('div'); fill(d, html); return d; };
  function stageEvent(id, n, main, arc, kick, text, extra, foot) {
    if (!main || !storyMode()) return false;
    let style, pages, figures = [], sealChar = '';
    if (n.chapterIntro && arc) {
      style = 'shadow';
      pages = String(arc.summary || '').split('\n').map(s => s.trim()).filter(Boolean); if (!pages.length) pages = [text];
      figures.push({ id: 'tong', name: '童童', kind: 'spirit' });
      for (const c of arc.contracts || []) if (c.id !== 'tong' && hasViews(c.id) && figures.length < 3) figures.push({ id: c.id, name: c.name, kind: 'spirit' });
      figures.push({ id: '', name: arc.boss || '', kind: 'mist' });
    } else if (n.contract) {
      style = 'blood'; pages = [text]; sealChar = (GD.spirits.find(s => s.id === n.contract.id)?.name || n.contract.name || '契')[0];
    } else if (id.endsWith('-fork')) {
      style = 'ash'; const segs = String(arc?.summary || '').split('\n').map(s => s.trim()).filter(Boolean); pages = [segs[2], text].filter(Boolean);
    } else return false;
    stage.show({ style, kicker: kick, title: n.title, pages, figures, sealChar, extra: extra ? htmlEl(extra) : null, foot: foot.map(f => f === '-' ? f : { ...f, seal: !!(n.contract && f.primary) }) });
    return true;
  }
  const S = {
    home() {
      closeSheet(); setBase('home'); base = 'home';
      ctx.rig.goTo('title', { dur: 1400 });
      baseEl.replaceChildren();
      const root = document.createElement('div'); root.className = 'title-screen';
      root.innerHTML = `<div class="title-logo"><div class="seal">契</div><h1>全球诡异时代<small>鬼灵契约</small></h1></div><div><div class="slots"></div><div class="title-foot" style="margin-top:16px"></div></div>`;
      // 存档位轮盘：转到正面的那一位才能操作
      const list = (GC.slots || []).map((s, i) => ({ s, i, color: s ? (s.fallen ? '#8a8480' : DIFF_TONE[s.difficulty] || '#c2261d') : '#bec7d4' }));
      const last = +localStorage.getItem('gc3d-last-slot'), start = list[last]?.s ? last : Math.max(0, list.findIndex(o => o.s && !o.s.fallen));
      const wheel = createWheel(list, {
        index: start, itemWidth: 300, cls: 'slot-wheel', onChange: () => play('click'),
        render: ({ s, i }) => `<div class="slot${s ? ' used' : ''}${s?.fallen ? ' fallen' : ''}"><i class="no">${'壹贰叁肆'[i]}</i><b>${s ? esc(s.name) : '空白旅途'}</b><span>${esc(slotLine(s))}</span><span>${s ? `鬼灵 ${s.spirits.length} · 经验 ${num(s.xp)}${s.battle ? ' · 战斗中' : ''}${s.fallen ? ' · 本轮已结束' : ''}` : '普通 / 极限 / 无尽'}</span><div class="acts"></div></div>`
      });
      list.forEach(({ s, i }) => {
        const acts = wheel.cells[i].querySelector('.acts');
        if (s && !s.fallen) acts.append(btn('继续旅途', () => { localStorage.setItem('gc3d-last-slot', i); A.loadSlot(i); }, true));
        acts.append(btn(s ? '重建' : '建立新旅途', () => { localStorage.setItem('gc3d-last-slot', i); A.createSlotDialog(i); }, !s));
      });
      root.querySelector('.slots').replaceWith(wheel.el);
      const foot = root.querySelector('.title-foot');
      foot.append(btn('鬼灵图鉴', () => A.renderCodex()), btn('演武台', () => A.renderTestLab()), btn('剧情档案', () => { archiveFrom = 'home'; A.openStoryArchive(A.renderHome); }), btn('每日挑战', () => show('daily')), btn('成就战绩', () => show('achievements')), btn('成绩榜', () => show('records')), btn('操作指南', () => show('guide', { index: 0 })),
        btn('设置', () => A.presentationSettings()), btn('导出存档', exportSlots), btn('导入存档', importSlots));
      baseEl.append(root);
    },
    slotDialog({ index, occupied }) {
      let mode = 'normal', diff = 'easy', boon = '';
      const DF = GC.DIFFICULTIES, boons = [{ key: '', name: '不带馈赠', desc: '空手上路。', unlocked: true }, ...(globalThis.GC_X?.boons() || [])];
      const box = sheet('slotDialog', {
        kicker: `存档位 ${'壹贰叁肆'[index]}`, title: occupied ? '替换这段旅途' : '建立新旅途', cls: 'wheels',
        body: `${occupied ? '<p class="red">确认后将替换此位原有的旅途，其余三位不受影响。可先回标题导出备份。</p>' : ''}<div class="field"><span>旅途名称</span><input type="text" id="slotName" maxlength="24" value="旅途${index + 1}"></div><div id="wheels"></div><p class="muted" style="margin-top:6px;text-align:center">左右方向键、滚轮或拖动都可以转动轮盘。难度可以在旅途中（战斗之外）随时调整。</p>`,
        foot: [{ label: '返回', fn: () => { tabooGlow(false); A.returnToTitle(); } }, { label: '确认开始', primary: true, fn: () => { tabooGlow(false); globalThis.GC_X?.setBoon(mode === 'endless' ? '' : boon); A.confirmNewSlot(index, mode, box.querySelector('#slotName').value.trim() || `旅途${index + 1}`, diff); } }]
      });
      const host = box.querySelector('#wheels');
      const wm = createWheel(Object.keys(MODE_DESC).map(m => ({ key: m, name: GC.MODE_NAMES[m], desc: MODE_DESC[m], color: { normal: '#bec7d4', hardcore: '#ff8a70', endless: '#9fd0c8' }[m] })), { label: '模式', cls: 'compact', itemWidth: 250, onChange: it => { mode = it.key; play('click'); wb.el.classList.toggle('off', mode === 'endless'); }, render: it => `<b>${esc(it.name)}</b><p>${esc(it.desc)}</p>` });
      const wd = createWheel(diffItems(), { label: '难度', itemWidth: 250, onChange: it => { diff = it.key; play(it.key === 'taboo' ? 'boss' : 'click'); tabooGlow(it.key === 'taboo'); }, render: diffCard });
      const wb = createWheel(boons.map(o => ({ ...o, disabled: !o.unlocked, color: '#ffd98a' })), { label: '开局馈赠（普通与极限模式）', itemWidth: 250, onChange: it => { boon = it.unlocked ? it.key : ''; play('click'); }, render: it => `<b>${esc(it.name)}</b><p>${esc(it.desc)}</p><small>${it.unlocked ? (it.key ? '已解锁' : '') : '未解锁：' + esc(it.need)}</small>` });
      host.append(wm.el, wd.el, wb.el);
    },
    difficulty() {
      const cur = Q.difficultyOf(); let pick = cur;
      const box = sheet('difficulty', { kicker: '难度', title: '调整旅途难度', cls: 'wheels', body: '<div id="wheels"></div><p class="muted" style="text-align:center">转到想要的难度后确认。只影响之后的战斗。</p>',
        foot: [{ label: '返回', fn: () => { tabooGlow(false); A.renderMap(); } }, { label: '确认', primary: true, fn: () => { tabooGlow(false); if (pick !== cur) { A.setDifficulty(pick); toast('难度已调整为 ' + GC.DIFFICULTIES[pick].name); } A.renderMap(); } }] });
      const w = createWheel(diffItems(), { index: Object.keys(GC.DIFFICULTIES).indexOf(cur), itemWidth: 250, onChange: it => { pick = it.key; play(it.key === 'taboo' ? 'boss' : 'click'); tabooGlow(it.key === 'taboo'); }, render: diffCard });
      box.querySelector('#wheels').append(w.el); tabooGlow(cur === 'taboo');
    },
    map({ act }) {
      closeSheet();
      // 延迟弹出的法器/条款面板不得顶掉玩家在这 0.4 秒里打开的其他面板（曾把结算面板顶掉，留下过期的路线图）
      const later = fn => setTimeout(() => { if (!sheetEl && base === 'map' && !GC.battle && !stage.active) fn(); }, 400);
      if (globalThis.GC_X?.pendingRelic()) later(() => S.relicPick());
      else if (globalThis.GC_X?.pendingPact()) later(() => S.pact?.());
      const st = GC.state, changed = setBase('map');
      if (changed) ctx.rig.goTo('map', { dur: 1100 });
      mapView.show(act, id => A.enterNode(id));
      const arc = GC.ML.arcs[act - 1], arcIndex = act - 1;
      baseEl.replaceChildren();
      const hud = document.createElement('div'); hud.className = 'map-hud';
      hud.innerHTML = `<div class="map-head"><small>${esc(st.name || '')} · ${GC.MODE_NAMES[st.mode] || ''} · ${GC.DIFFICULTIES[Q.difficultyOf()].name}</small><b>第${act}幕 · ${esc(arc?.title || '')}</b><span>点击燃起的鬼火前往下一处</span></div><div class="map-res"><b>经验<i>${num(st.xp)}</i></b><b>命灯<i>${num(st.will)}/${num(st.maxWill)}</i></b><b>鬼灵<i>${st.spirits.filter(s => !s.dead).length}/${st.spirits.length}</i></b><b>牌组<i>${st.deck.length}/25</i></b><b>冥钱<i>${st.coins || 0}</i></b><b>法器<i>${st.relics?.length || 0}</i></b></div><div class="map-bar"></div>`;
      hud.querySelector('.map-bar').append(btn('鬼灵与卡牌', () => A.openCollection(), true), btn('修行与恢复', () => A.showTraining(arcIndex)), btn(`难度 · ${GC.DIFFICULTIES[Q.difficultyOf()].name}`, () => show('difficulty')), btn('剧情档案', () => { archiveFrom = 'map'; A.openStoryArchive(A.renderMap); }), btn('旅途记录', () => A.journal()), btn('指南', () => show('guide', { index: 2 })), btn('设置', () => A.presentationSettings()), btn('回到标题', () => A.renderHome()));
      baseEl.append(hud);
    },
    event({ id }) {
      const n = GC.NODES[id], main = GC.MAIN_KEYS?.has(id), text = GC.STORY[n.story] || '', arc = n.arc != null ? GC.ML.arcs[n.arc] : null;
      const kick = n.contract ? '契约' : n.chapterIntro ? `第${n.act}幕 · 开篇` : id.endsWith('-fork') ? '岔路' : '剧情';
      let extra = '';
      if (n.contract) { const c = n.contract, sp = GD.spirits.find(s => s.id === c.id); extra = sp ? `<div class="split" style="margin-top:14px"><div>${TU(codexUnit(sp))}</div><div><h3>缔结契约</h3><p>继续后，<b class="goldc">${esc(sp.name)}</b>（${esc(sp.initialRank)} · ${esc(sp.type)} · 潜力 ${sp.potential}）将加入队伍，并且全队恢复。</p><p class="muted">初始技能：${Q.unlockedSkills(sp.id, sp.initialRank).map(esc).join('、') || '无'}</p></div></div>` : `<h3>支援契约</h3><p>「${esc(c.name)}」以支援档案保存，不占阵位。原著没有给出对应的战斗技能表，因此不虚构技能。</p>`; }
      if (n.chapterIntro && arc) extra += `<p class="muted" style="margin-top:14px">本幕取材：原著第 ${arc.from}—${arc.to} 章（提供稿第 ${arc.volume} 份）。推荐等级：${esc(GD.ranks[arc.rank]?.name || '')}。继续后发放本幕修行补助。</p>`;
      const foot = [{ label: '鬼灵与卡牌', fn: () => A.openCollection(() => A.showEvent(id)) }];
      if (n.chapterIntro && arc?.pages?.length) foot.push({ label: '展开小说正文', fn: () => A.openReader(n.arc, () => A.showEvent(id)) });
      foot.push('-', { label: n.contract ? '缔结契约' : '继续', primary: true, fn: () => main ? A.continueMainlineEvent(id) : A.continueEvent(id) });
      if (stageEvent(id, n, main, arc, kick, text, extra, foot)) return;
      sheet('event', { kicker: kick, title: n.title, body: `<div class="story">${esc(text)}</div>${extra}`, foot });
    },
    beforeBattle({ id }) {
      const n = GC.NODES[id], enemies = id === 'endless-arena' ? Q.endlessRoster() : Q.enemyRoster(id), info = Q.rewardInfo(id), arc = n.arc != null && id !== 'endless-arena' ? GC.ML.arcs[n.arc] : null;
      const stagedBattle = storyMode() && GC.MAIN_KEYS?.has(id) && (n.type === 'battle' || n.type === 'boss') && !!GC.STORY[n.story];
      if (stagedBattle && !shownBattle.has(id)) {
        shownBattle.add(id);
        stage.show({ style: 'blood', kicker: n.type === 'boss' ? '凶兆 · 首领' : '战书', title: n.title, pages: [GC.STORY[n.story]], figures: [], extra: null, foot: [{ label: '查看敌情', primary: true, fn: () => S.beforeBattle({ id }) }] });
        return;
      }
      const cards = enemies.map(e => `<div class="cell card">${TU(e)}<b>${esc(e.name)}</b><span>${esc(e.rankName)} · 攻 ${num(e.atk)} · 命 ${num(e.hp)}</span>${[...(e.bossSkills || []), ...(e.bossTraits || [])].map(s => `<p><b class="red" style="display:inline;font-size:14px">${esc(s)}</b>　${esc(GC.BOSS_SKILLS[s]?.desc || '')}</p>`).join('')}</div>`).join('');
      sheet('beforeBattle', {
        kicker: n.type === 'boss' ? '战前情报 · 首领' : '战前情报', title: n.title, cls: 'wide', aside: `预计奖励<br><b class="goldc">${num(info.xp)}</b> 经验 · <b class="goldc">${info.cards}</b> 轮三选一`,
        body: `${stagedBattle ? '' : `<div class="story quote">${esc(GC.STORY[n.story] || '')}</div>`}<h3>将要面对</h3><div class="grid c${Math.max(3, Math.min(4, enemies.length))}" style="max-width:${enemies.length * 250}px">${cards}</div><p class="muted" style="margin-top:12px">${arc ? `原著层次：${esc(n.novelRank || arc.novelRank || '')}。` : ''}当前难度：${GC.DIFFICULTIES[Q.difficultyOf()].name}。双方命灯以出战鬼灵中最高的生命为准（至少 10），敌方命灯随难度加厚。空路直击每次只能打掉对方命灯的一部分（简单难度两成；难度越高，我方直击的上限越低、敌方直击越重）。</p>`,
        foot: [{ label: '返回路线', fn: () => A.retreatToMap() }, { label: '升级与备战', fn: () => A.beforeBattleUpgrade(id) }, '-', { label: '选择出战鬼灵', primary: true, fn: () => A.prepareBattle(id) }]
      });
    },
    prepare({ id, defaultSquad }) {
      const st = GC.state, alive = st.spirits.filter(s => !s.dead), chosen = new Set((defaultSquad || []).filter(x => alive.some(s => s.id === x)).slice(0, 6));
      if (!chosen.size) alive.slice(0, 6).forEach(s => chosen.add(s.id));
      const box = sheet('prepare', {
        kicker: '出战', title: GC.NODES[id].title, cls: 'wide', aside: `牌组 <b class="goldc">${st.deck.length}</b>/25`,
        body: `<p>选择 1 至 6 名鬼灵出战。鬼灵全部从手牌显形；起手共 6 张，其中至多 3 名出战鬼灵优先入手，不足 3 名则全部入手。本场第 X 次显形消耗 X 点鬼气。</p><div class="grid c6" id="squad">${alive.map(s => `<button class="cell card ${chosen.has(s.id) ? 'on' : ''}" data-act="pick" data-arg="${s.id}">${TU(spiritUnit(s))}<b>${esc(s.name)}</b><span>${esc(s.rankName)}</span></button>`).join('')}</div><p class="muted" id="squadCount" style="margin-top:10px"></p>`,
        foot: [{ label: '返回路线', fn: () => A.cancelPrepare() }, { label: '管理卡牌', fn: () => A.prepareManageCards(id) }, '-', { label: '进入战斗', primary: true, fn: () => A.confirmSquad(id, alive.filter(s => chosen.has(s.id)).map(s => s.id)) }],
        acts: { pick: (sid, el) => { if (chosen.has(sid)) chosen.delete(sid); else if (chosen.size < 6) chosen.add(sid); else { toast('最多选择 6 名鬼灵', 'warn'); return; } el.classList.toggle('on', chosen.has(sid)); count(); } }
      });
      const count = () => { box.querySelector('#squadCount').textContent = `已选 ${chosen.size} / 6`; };
      count();
    },
    battle() {
      closeSheet(); setBase('battle'); baseEl.replaceChildren(); ctx.battleActive = true;
      ctx.battle.hand.setVisible(true); ctx.battle.requestSync(); ctx.emit('refresh');
    },
    battleDetail(sel) {
      const b = GC.battle; if (!b || !sel) return;
      let u = null, cardId = null, side = 'ally';
      if (sel.kind === 'unit') u = b.units[sel.lane];
      else if (sel.kind === 'enemy') { u = b.enemies.find(e => e.uid === sel.uid) || (b.removedEnemies || []).find(x => x.unit.uid === sel.uid)?.unit; side = 'enemy'; }
      else if (sel.kind === 'hand') { const e = b.hand[sel.index]; u = Q.handSpirit(e); if (!u) cardId = e; }
      if (cardId) { const c = GC.SKILLS[cardId], meta = GD.cards.find(x => x.id === cardId); sheet('battleDetail', { kicker: meta?.event ? '事件卡' : '技能卡', title: c.name, cls: 'narrow', body: `<div class="split"><div>${TS(cardId)}</div><div><div class="stats"><b>费用<i>${c.cost}</i></b><b>稀有度<i style="color:${RARITY[c.rarity]}">${esc(c.rarity)}</i></b></div><p>${esc(meta?.desc || c.desc)}</p><p class="muted">${c.target === 'ally' ? '需要选择一名我方场上鬼灵。' : c.target === 'grave' ? '作用于魂瓮中的阵亡鬼灵。' : c.target === 'enemy' ? '需要选择一名敌人。' : c.target === 'lane' ? '需要选择一条空路。' : '无需目标，点击即生效。'}</p>${c.arch ? `<p class="blue">流派 · ${esc(globalThis.GC_X.ARCH[c.arch])}</p>` : ''}</div></div>`, foot: [{ label: '返回', primary: true, fn: () => closeSheet() }] }); return; }
      if (!u) return;
      const skills = Q.unlockedSkills(u.id, u.rankName), crit = Q.critProfile(u), states = GC.VFX.cardStates(u), base = u.baseAtk ?? u.atk;
      const skillRows = skills.map(nm => { const d = GD.skillDefs[nm] || {}, cd = u.cooldowns?.[nm] || 0; return `<div class="cell"><b>${esc(nm)}${cd ? `<span class="corner">冷却 ${cd}</span>` : ''}</b><span>${esc(Q.skillDetailMeta(d, nm))}</span><p>${esc(d.desc || '')}</p></div>`; }).join('');
      const boss = [...(u.bossSkills || []), ...(u.bossTraits || [])].map(nm => `<div class="cell"><b class="red">${esc(nm)}</b><span>${GC.BOSS_SKILLS[nm]?.kind === 'trait' ? '被动特性' : '敌方技能 · 下次施放不早于第 ' + u.bossNext + ' 回合'}</span><p>${esc(GC.BOSS_SKILLS[nm]?.desc || '')}</p></div>`).join('');
      const X = globalThis.GC_X, kw = (X?.keywordsOf(u) || []).map(k => `<div class="cell"><b class="goldc">${esc(k.name)}</b><p>${esc(k.desc)}</p></div>`).join('') + (u.token ? `<div class="cell"><b>召唤物</b><p>被击倒后直接消散，不进魂瓮，也不能回手。</p></div>` : '');
      const it = side === 'enemy' ? X?.intents(b).find(i => i.uid === u.uid) : null;
      const intent = it ? `<h3>下回合意图</h3><p>${it.cast ? `施放【${esc(it.cast.name)}】；` : ''}${it.action === 'skip' ? '无法行动。' : it.action === 'lamp' ? `直击命灯约 ${num(it.damage)}${it.times > 1 ? ' ×' + it.times : ''}。` : `攻击第 ${it.targetLane + 1} 路约 ${num(it.damage)}${it.times > 1 ? ' ×' + it.times : ''}。`}</p>` : '';
      sheet('battleDetail', {
        kicker: side === 'enemy' ? '敌方单位' : sel.kind === 'hand' ? '手牌中的鬼灵' : '我方单位', title: `${u.name} · ${u.rankName || ''}`,
        body: `<div class="split"><div>${TU(u)}</div><div><div class="stats"><b>原本攻击<i>${num(base)}</i></b><b>当前攻击<i>${num(Q.effectiveAttack(u))}</i></b><b>生命<i>${num(u.hp)}/${num(u.maxHp)}</i></b>${u.shield ? `<b>护盾<i>${num(u.shield)}</i></b>` : ''}<b>暴击<i>${Math.round(crit.chance * 100)}% ×${crit.multiplier.toFixed(2)}</i></b></div><h3>状态</h3>${states.length ? states.map(s => `<span class="pill" style="color:${s.passive ? 'rgba(233, 226, 208,.6)' : '#bec7d4'}">${esc(s.label)}${s.analysis != null ? ` ${s.analysis}%` : ''}${s.turns != null ? ` · 余${s.turns}回合` : ''}</span>`).join('') : '<p class="muted">无持续状态</p>'}<p class="muted" style="margin-top:8px">${esc(Q.statusText(u))}</p>${kw ? `<h3>关键词</h3><div class="grid c2">${kw}</div>` : ''}${intent}${boss ? `<h3>敌方技能与特性</h3><div class="grid c2">${boss}</div>` : ''}${skillRows ? `<h3>技能</h3><div class="grid c2">${skillRows}</div>` : ''}</div></div>`,
        foot: [{ label: '返回战场', primary: true, fn: () => closeSheet() }]
      });
    },
    battleLog() {
      const b = GC.battle; if (!b) return;
      sheet('battleLog', { kicker: '战况', title: `第 ${b.turn} 回合`, cls: 'narrow', body: `<div class="log">${b.log.slice(0, 120).map(x => `<p>${esc(x)}</p>`).join('')}</div>`, foot: [{ label: '返回战场', primary: true, fn: () => closeSheet() }] });
    },
    leaveBattle() {
      sheet('leaveBattle', { kicker: '离开战斗', title: '回到标题？', cls: 'narrow', body: '<p>旅途会保存在本回合开始时的状态。之后从同一存档位「继续旅途」即可回到这场战斗。</p>', foot: [{ label: '留在战场', fn: () => closeSheet() }, { label: '回到标题', primary: true, fn: async () => { closeSheet(); if (GC.busy) toast('等这一手结算完就回标题…'); for (let i = 0; i < 240 && GC.busy; i++) await new Promise(r => setTimeout(r, 50)); A.renderHome(); } }] });   // 结算途中不切存档：等规则层的异步链跑完，避免旧链改到之后读入的存档
    },
    rewards() {
      const r = GC.state.pendingReward; if (!r) return;
      sheet('rewards', { kicker: '战利', title: '三选一', aside: `剩余 <b class="goldc">${r.remaining}</b> 张`, body: `<div class="grid c3" style="max-width:780px;margin:0 auto">${(r.candidates || []).map((id, i) => `<button class="cell card" data-act="pick" data-arg="${i}">${TS(id)}<b>${esc(GC.SKILLS[id].name)}</b><span>${esc(GC.SKILLS[id].rarity)} · ${GC.SKILLS[id].cost} 鬼气</span></button>`).join('')}</div>`, foot: [{ label: '放弃剩余奖励', fn: () => A.skipRewards() }], acts: { pick: i => A.chooseReward(+i) } });
    },
    rewardReplace() {
      const r = GC.state.pendingReward; if (!r) return;
      sheet('rewardReplace', { kicker: '牌组已满', title: `用「${GC.SKILLS[r.pendingPick]?.name}」替换哪一张？`, cls: 'wide', body: deckGrid('rep'), foot: [{ label: '返回候选', fn: () => A.cancelRewardReplace() }], acts: { rep: i => A.replaceReward(+i) } });
    },
    collection() {
      const st = GC.state, arm = { i: -1 };
      sheet('collection', {
        kicker: '非战斗管理', title: '鬼灵与卡牌', cls: 'wide', aside: `经验 <b class="goldc">${num(st.xp)}</b>`,
        body: `<h3>契约鬼灵 ${st.spirits.length}</h3><div class="grid c6">${st.spirits.map((s, i) => `<button class="cell card ${s.dead ? 'dead' : ''}" data-act="spirit" data-arg="${i}">${TU(spiritUnit(s))}<b>${esc(s.name)}</b><span>${esc(s.rankName)}${s.dead ? ' · 阵亡' : ''}</span></button>`).join('') || '<p class="muted">尚未缔结契约。</p>'}</div><h3>牌组 ${st.deck.length}/25</h3><p class="muted">点一张牌两次可将其移除（不返还）。同名牌可以重复。</p>${deckGrid('rm')}${st.relics?.length ? `<h3>法器 ${st.relics.length}</h3><div class="grid c3">${globalThis.GC_X.relics().map(r => `<div class="cell"><b class="goldc">${esc(r.name)}</b><p>${esc(r.desc)}</p></div>`).join('')}</div>` : ''}${st.supportContracts?.length ? `<h3>支援契约</h3><div class="grid c2">${st.supportContracts.map(c => `<div class="cell"><b>${esc(c.name)}</b><p>${esc(c.text)}</p></div>`).join('')}</div>` : ''}`,
        foot: [{ label: '返回', primary: true, fn: () => A.closeCollection() }],
        acts: { spirit: i => A.showOwnedSpirit(+i), rm: (i, el) => { if (arm.i === +i) A.removeDeckCard(+i); else { arm.i = +i; el.parentElement.querySelectorAll('.cell').forEach(c => c.classList.remove('on')); el.classList.add('on'); toast('再点一次确认移除这张牌', 'warn'); } } }
      });
    },
    ownedSpirit({ index }) {
      const st = GC.state, s = st.spirits[index]; if (!s) return;
      const rank = GD.ranks[s.rankIndex], next = s.id === 'nannan' ? null : GD.ranks[s.rankIndex + 1], cost = rank?.upgradeXp, skills = Q.unlockedSkills(s.id, s.rankName), crit = Q.critProfile(s), meta = GD.spirits.find(c => c.id === s.id);
      const nextSkills = next ? Q.unlockedSkills(s.id, next.name).filter(n => !skills.includes(n)) : [], canBattle = !st.battle || st.mode === 'endless';
      sheet('ownedSpirit', {
        kicker: '鬼灵详情', title: `${s.name} · ${s.rankName}`, aside: `经验 <b class="goldc">${num(st.xp)}</b>`,
        body: `<div class="split"><div>${TU(spiritUnit(s))}</div><div><div class="stats"><b>原本攻击<i>${num(s.atk)}</i></b><b>生命<i>${num(s.hp)}/${num(s.maxHp)}</i></b><b>潜力<i>${s.potential}</i></b><b>暴击<i>${Math.round(crit.chance * 100)}% ×${crit.multiplier.toFixed(2)}</i></b></div><h3>当前技能</h3><div class="grid c2">${skills.map(nm => { const d = GD.skillDefs[nm] || {}; return `<div class="cell"><b>${esc(nm)}</b><span>${esc(Q.skillDetailMeta(d, nm))}</span><p>${esc(d.desc || '')}</p>${Q.replacementText(nm) ? `<p class="blue">${esc(Q.replacementText(nm))}</p>` : ''}${s.onceUsed?.[nm] ? `<p class="red">已使用${s.skillRestore?.[nm] ? ` · 再经过 ${s.skillRestore[nm]} 次篝火恢复` : ''}</p>` : ''}</div>`; }).join('') || '<p class="muted">当前等级没有技能。</p>'}</div>${next ? `<h3>下一级 · ${esc(next.name)}</h3><p>升级消耗 <b class="goldc">${num(cost)}</b> 经验，升级后回满生命。${nextSkills.length ? `新技能：<b class="blue">${nextSkills.map(esc).join('、')}</b>` : '本级为数值成长。'}</p>` : `<p class="muted">${s.id === 'nannan' ? '囡囡为禁忌，数值固定，不随等级变化。' : '已达到最高等级。'}</p>`}${meta ? `<p class="muted">完整升级链见标题页的鬼灵图鉴。</p>` : ''}</div></div>`,
        foot: [{ label: '返回面板', fn: () => st.battle ? A.openBattleUpgrade() : A.closeContractTrials() }, '-', { label: !next ? '无法再提升' : s.rankIndex >= Q.rankCap() ? '已到本幕等级上限' : `提升至 ${next.name} · ${num(cost)} 经验`, primary: true, disabled: !next || st.xp < cost || !canBattle || s.rankIndex >= Q.rankCap(), fn: () => { if (st.battle) { A.upgradeInBattle(index); show('ownedSpirit', { index }); } else A.upgradeOwnedSpirit(index); } }]
      });
    },
    relicPick() {
      const list = globalThis.GC_X?.pendingRelic(); if (!list) return;
      sheet('relicPick', { kicker: '精英战利品', title: '带走一件法器', cls: 'wide', body: `<div class="grid c3">${list.map(o => `<button class="cell card" data-act="pick" data-arg="${o.key}"><b class="goldc">${esc(o.name)}</b><p>${esc(o.desc)}</p></button>`).join('')}</div>`,
        acts: { pick: k => { play('reward'); globalThis.GC_X.chooseRelic(k); closeSheet(); A.renderMap(); } } });
    },
    shop({ id }) {
      const X = globalThis.GC_X, s = X.shop(id); if (!s) return; let arming = -1;
      const cell = it => `<button class="cell card ${it.sold ? 'dead' : ''}" data-act="buy" data-arg="${it.index}" ${it.sold || s.coins < it.price ? 'disabled' : ''}>${it.kind === 'card' ? TS(it.key) : ''}<b ${it.kind === 'relic' ? 'class="goldc"' : ''}>${esc(it.name)}</b><span>${it.sold ? '已售' : it.price + ' 冥钱'}${it.rarity ? ' · ' + esc(it.rarity) : ''}</span><p>${esc(it.desc)}</p></button>`;
      sheet('shop', { kicker: '鬼市', title: '摊主把价钱写在纸上', cls: 'wide', aside: `冥钱 <b class="goldc">${s.coins}</b>`,
        body: `<h3>卡牌</h3><div class="grid c4">${s.items.filter(i => i.kind === 'card').map(cell).join('')}</div><h3>法器</h3><div class="grid c2">${s.items.filter(i => i.kind === 'relic').map(cell).join('')}</div><h3>其它</h3><div class="grid c2">${s.items.filter(i => i.kind === 'xp' || i.kind === 'incense' || i.kind === 'remove').map(cell).join('')}</div><div id="shopDeck"></div>`,
        foot: [{ label: '鬼灵与卡牌', fn: () => A.openCollection(() => S.shop({ id })) }, '-', { label: '离开鬼市', primary: true, fn: () => { closeSheet(); X.leaveNode(id); } }],
        acts: {
          buy: i => { const it = s.items[+i]; if (it.kind === 'remove') { arming = +i; document.getElementById('shopDeck').innerHTML = `<h3>烧掉哪一张？</h3>${deckGrid('burn')}`; return; } if (X.buy(id, +i)) { play('reward'); S.shop({ id }); } },
          burn: d => { if (arming >= 0 && X.buy(id, arming, +d)) { play('paper'); S.shop({ id }); } }
        } });
    },
    omen({ id }) {
      const X = globalThis.GC_X, o = X.omen(id); if (!o) return;
      sheet('omen', { kicker: '异兆', title: o.title, cls: 'narrow', body: `<p>${esc(o.text)}</p><div class="grid c1">${o.options.map(p => `<button class="cell" data-act="pick" data-arg="${p.index}" ${p.disabled ? 'disabled' : ''}><b>${esc(p.label)}</b><p>${esc(p.desc)}</p></button>`).join('')}</div>`,
        acts: { pick: i => { const r = X.chooseOmen(id, +i); if (!r) return; play('dread'); sheet('omenResult', { kicker: '异兆 · ' + o.title, title: r.label, cls: 'narrow', body: `<p>${esc(r.text)}</p>${r.got.length ? `<p class="goldc">${r.got.map(esc).join('　')}</p>` : ''}`, foot: [{ label: '继续上路', primary: true, fn: () => { closeSheet(); A.renderMap(); } }] }); } } });
    },
    pact() {
      const p = globalThis.GC_X?.pendingPact(); if (!p) return;
      sheet('pact', { kicker: '契约条款', title: `与「${p.name}」立下哪一种契约？`, cls: 'wide',
        body: `<p class="muted">每名鬼灵只立一次，立下后不能更改。</p><div class="grid c4">${p.options.map(o => `<button class="cell card" data-act="pick" data-arg="${o.key}"><b class="goldc">${esc(o.name)}</b><span>${esc(o.desc)}</span><p class="muted">${esc(o.flavor)}</p></button>`).join('')}</div>`,
        acts: { pick: k => { play('reward'); globalThis.GC_X.choosePact(k); closeSheet(); if (globalThis.GC_X.pendingPact()) setTimeout(() => { if (!sheetEl) S.pact(); }, 250); else A.renderMap(); } } });
    },
    contractTrials() {
      const st = GC.state, cands = GD.spirits.filter(c => !st.spirits.some(s => s.id === c.id) && !['tong', 'xuan'].includes(c.id));
      sheet('contractTrials', { kicker: '契约回响', title: '缔结新的契约', cls: 'wide', aside: `经验 <b class="goldc">${num(st.xp)}</b>`, body: `<div class="grid c6">${cands.map(c => `<button class="cell card" data-act="c" data-arg="${c.id}" ${st.xp < Q.contractPrice(c) ? 'disabled' : ''}>${TU(codexUnit(c))}<b>${esc(c.name)}</b><span>${num(Q.contractPrice(c))} 经验</span></button>`).join('') || '<p>全部契约已完成。</p>'}</div>`, foot: [{ label: '返回面板', primary: true, fn: () => A.closeContractTrials() }], acts: { c: id => A.contractSpirit(id) } });
    },
    emergencyRest() {
      sheet('emergencyRest', { kicker: '安全营地', title: '契约尚未断绝', cls: 'narrow', body: '<p>全部鬼灵阵亡时可以退回营地：每名鬼灵恢复 10% 生命，命灯回满。不消耗经验。</p>', foot: [{ label: '休整后继续', primary: true, fn: () => A.acceptEmergencyRest() }] });
    },
    camp({ id }) {
      const n = GC.NODES[id], st = GC.state, main = GC.MAIN_KEYS?.has(id);
      const list = `<div class="grid c4">${st.spirits.map(s => `<div class="cell"><b>${esc(s.name)}</b><span>${esc(s.rankName)} · 命 ${num(s.hp)}/${num(s.maxHp)}${s.dead ? ' · 阵亡' : ''}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, s.hp / s.maxHp * 100))}%"></i></div></div>`).join('')}</div>`;
      if (main) sheet('camp', { kicker: '篝火', title: n.title, aside: `经验 <b class="goldc">${num(st.xp)}</b>`, body: `<p>火光驱散了寒意。全队生命与命灯已经恢复，此处成为普通模式的复活点。离开前可以整理牌组、升级鬼灵或领取本幕修行补助。</p>${list}`, foot: [{ label: '鬼灵与卡牌', fn: () => A.campManage(id) }, { label: '修行与恢复', fn: () => A.campTraining(id) }, '-', { label: '离开篝火', primary: true, fn: () => A.campLeave(id) }] });
      else { const used = !!st.campChoices?.[id]; sheet('camp', { kicker: '篝火', title: n.title, body: `<p>本次篝火可在「恢复 60% 生命」和「搜寻 5 张卡牌」中选择一次，也可消耗经验提升等级。</p>${list}`, foot: [{ label: '休息恢复', disabled: used, fn: () => A.campHeal(id) }, { label: '搜寻卡牌', disabled: used, fn: () => A.campSearchCards(id) }, { label: '提升等级', fn: () => A.campUpgrade(id) }, '-', { label: '离开篝火', primary: true, fn: () => A.campLeave(id) }] }); }
    },
    upgradeChoice({ campId }) {
      const st = GC.state;
      sheet('upgradeChoice', { kicker: '鬼灵升级', title: '选择契约鬼灵', aside: `经验 <b class="goldc">${num(st.xp)}</b>`, body: `<div class="grid c3">${st.spirits.map((s, i) => { const r = GD.ranks[s.rankIndex], nx = s.id === 'nannan' ? null : GD.ranks[s.rankIndex + 1]; return `<button class="cell" data-act="up" data-arg="${i}" ${!nx || st.xp < r.upgradeXp || s.rankIndex >= Q.rankCap() ? 'disabled' : ''}><b>${esc(s.name)} · ${esc(s.rankName)}</b><span>${!nx ? '已达最高' : s.rankIndex >= Q.rankCap() ? '已到本幕等级上限，下一幕再升' : `→ ${esc(nx.name)} · ${num(r.upgradeXp)} 经验`}</span></button>`; }).join('')}</div>`, foot: [{ label: '返回篝火', primary: true, fn: () => A.showCamp(campId) }], acts: { up: i => A.upgradeAtCamp(+i, campId) } });
    },
    training({ arc }) {
      const st = GC.state, a = GC.ML.arcs[arc], target = GD.ranks[Math.max(0, a.rank)], claim = st.trainClaims?.[a.id];
      sheet('training', {
        kicker: '修行与恢复', title: `第${a.act}幕 · ${a.title}`, aside: `经验 <b class="goldc">${num(st.xp)}</b>`,
        body: `<p>本幕修行补助：<b class="goldc">${num(claim || 0)}</b> 经验（每幕一次，已发放）。推荐等级：<b class="blue">${esc(target.name)}</b>。「按推荐培养」会优先培养出战队伍里最强的至多四名伙伴（没有编队时取全队最强的四名），从其中等级最低的开始逐级提升到推荐等级，经验不足时停止；「全队恢复」可重复使用。</p><div class="grid c4">${st.spirits.map(s => `<div class="cell ${s.dead ? 'dead' : ''}"><b>${esc(s.name)}</b><span>${esc(s.rankName)}${s.rankIndex >= a.rank || s.id === 'nannan' ? ' · 已达推荐' : ''}</span><span>命 ${num(s.hp)}/${num(s.maxHp)} · 攻 ${num(s.atk)}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, s.hp / s.maxHp * 100))}%"></i></div></div>`).join('')}</div>`,
        foot: [{ label: '返回', fn: () => A.trainingClose() }, { label: '鬼灵与卡牌', fn: () => A.trainingManage() }, '-', { label: '全队恢复', fn: () => { A.trainingHeal(); play('revive'); } }, { label: '按推荐培养', primary: true, fn: () => { A.trainTeam(arc); play('upgrade'); show('training', { arc }); } }]
      });
    },
    rewardNode({ id, xp }) {
      { const n0 = GC.NODES[id], main0 = GC.MAIN_KEYS?.has(id);
        if (main0 && storyMode() && GC.STORY[n0.story]) { stage.show({ style: 'ash', kicker: '调查', title: n0.title, pages: [GC.STORY[n0.story]], figures: [], extra: htmlEl(`<p>调查所得：<b class="goldc">${num(xp)}</b> 经验与 1 轮三选一卡牌。</p>`), foot: [{ label: '鬼灵与卡牌', fn: () => A.rewardManage(id) }, '-', { label: '完成调查', primary: true, fn: () => A.claimInvestigation(id) }] }); return; } }
      const n = GC.NODES[id], main = GC.MAIN_KEYS?.has(id);
      sheet('rewardNode', { kicker: '调查', title: n.title, body: `<div class="story">${esc(GC.STORY[n.story] || '')}</div><p style="margin-top:12px">${main ? `调查所得：<b class="goldc">${num(xp)}</b> 经验与 1 轮三选一卡牌。` : '可以从中挑选两张技能卡。'}</p>`, foot: main ? [{ label: '鬼灵与卡牌', fn: () => A.rewardManage(id) }, '-', { label: '完成调查', primary: true, fn: () => A.claimInvestigation(id) }] : [{ label: '查看鬼物', primary: true, fn: () => A.claimRewardNode(id) }] });
    },
    settlement() {
      const r = GC.state.pendingSettlement; if (!r) return;
      const picking = r.remaining > 0 && r.candidates;
      sheet('settlement', {
        kicker: r.investigation ? '调查所得' : r.wave != null ? `无尽 · 第 ${r.wave} 波` : '战后结算', title: r.title, aside: `经验 +<b class="goldc">${num(r.xp)}</b><br>牌组 ${GC.state.deck.length}/25`,
        body: picking ? `<p>还可领取 <b class="goldc">${r.remaining}</b> 轮。三张里选一张加入牌组${GC.state.deck.length >= 25 ? '（牌组已满，需要替换一张旧牌）' : ''}。稀有度权重：普通 50% · 稀有 30% · 珍藏 15% · 传说 5%。</p><div class="grid c3" style="max-width:780px;margin:0 auto">${r.candidates.map((id, i) => `<button class="cell card" data-act="pick" data-arg="${i}">${TS(id)}<b>${esc(GC.SKILLS[id].name)}</b><span style="color:${RARITY[GC.SKILLS[id].rarity]}">${esc(GC.SKILLS[id].rarity)} · ${GC.SKILLS[id].cost} 鬼气</span></button>`).join('')}</div>` : `<p>奖励已经领取完毕。${r.wave != null ? '下一波敌人会更强；鬼灵的伤势与阵亡不会自动恢复。' : '可以继续上路。'}</p>`,
        foot: picking ? [{ label: '放弃剩余奖励', fn: () => A.discardSettlementRewards() }, { label: '鬼灵与卡牌', fn: () => A.settlementManage() }] : [{ label: '鬼灵与卡牌', fn: () => A.settlementManage() }, '-', { label: '继续', primary: true, fn: () => A.finishSettlement() }],
        acts: { pick: i => { play('reward'); A.pickSettlementCard(+i); } }
      });
    },
    settlementReplace({ index }) {
      const r = GC.state.pendingSettlement; if (!r?.candidates) return;
      sheet('settlementReplace', { kicker: '牌组已满', title: `用「${GC.SKILLS[r.candidates[index]]?.name}」替换哪一张？`, cls: 'wide', body: deckGrid('rep'), foot: [{ label: '返回候选', fn: () => A.cancelSettlementReplace() }], acts: { rep: i => { A.chooseSettlementCard(index, +i); A.renderSettlement(); } } });
    },
    defeat(p) {
      const main = !!GC.state.mainline;
      sheet('defeat', { kicker: '命灯尽灭', title: '战斗失败', cls: 'narrow', body: main ? `<p>普通模式：已回到上一处篝火${p.checkpoint ? `（${esc(GC.NODES[p.checkpoint]?.title || '')}）` : ''}，全队与命灯恢复。篝火之后的路线、经验与卡牌已经回滚，可以重新选择。</p>` : '<p>当前地点没有完成，可以重新挑战或返回路线。</p>', foot: main ? [{ label: '回到标题', fn: () => A.returnToTitle() }, { label: '从篝火继续', primary: true, fn: () => A.continueFromDefeat() }] : [{ label: '返回路线', fn: () => A.continueFromDefeat() }, { label: '重新挑战', primary: true, fn: () => A.retryBattle(p.nodeId) }] });
    },
    fallen(p) {
      sheet('fallen', { kicker: p.mode === 'endless' ? '无尽 · 终局' : '极限 · 终局', title: '旅途到此为止', cls: 'narrow', body: p.mode === 'endless' ? `<p>你坚持到了第 <b class="goldc">${p.wave}</b> 波。本轮挑战结束，可以在存档位重新建立无尽旅途。</p>` : '<p>极限模式下命灯尽灭即本轮结束。这个存档位不能继续，只能重新建立旅途。</p>', foot: [{ label: '回到标题', primary: true, fn: () => A.returnToTitle() }] });
    },
    ending() {
      if (storyMode() && GC.STORY['main-ending']) {
        const st0 = GC.state, figs = st0.spirits.filter(s => hasViews(s.id)).slice(0, 6).map(s => ({ id: s.id, name: s.name, kind: 'spirit' }));
        stage.show({ style: 'shadow', kicker: '终幕', title: '永永远远', pages: [GC.STORY['main-ending']], figures: figs, extra: htmlEl(`<p>本次旅途：首领 ${st0.completed.filter(k => GC.NODES[k]?.type === 'boss').length} 场，契约伙伴 ${st0.spirits.length} 名，支援契约 ${st0.supportContracts?.length || 0} 项。</p><p class="muted">主线依所提供的三份原著稿改编，至第二部第 556 章完结。</p>`), foot: [{ label: '回顾最后一幕', fn: () => A.readEndingAct() }, '-', { label: '完成并回到标题', primary: true, fn: () => A.finishEnding() }] });
        return;
      }
      const st = GC.state;
      sheet('ending', { kicker: '终幕', title: '永永远远', body: `<div class="story">${esc(GC.STORY['main-ending'] || '')}</div><p style="margin-top:14px">本次旅途：首领 ${st.completed.filter(k => GC.NODES[k]?.type === 'boss').length} 场，契约伙伴 ${st.spirits.length} 名，支援契约 ${st.supportContracts?.length || 0} 项。</p><p class="muted">主线依所提供的三份原著稿改编，至第二部第 556 章完结。</p>`, foot: [{ label: '回顾最后一幕', fn: () => A.readEndingAct() }, '-', { label: '完成并回到标题', primary: true, fn: () => A.finishEnding() }] });
    },
    storyArchive() {
      sheet('storyArchive', { kicker: '剧情档案', title: `全 ${GC.ML.arcs.length} 幕`, cls: 'wide', body: `<p class="muted">共 ${GC.ML.arcs.reduce((a, x) => a + x.pages.length, 0)} 段原著章节节选，约 ${Math.round(GC.ML.chineseCount / 10000)} 万字。尚未抵达的幕含有剧透。</p><div class="grid c4">${GC.ML.arcs.map((a, i) => `<button class="cell" data-act="act" data-arg="${i}"><b>第${a.act}幕 · ${esc(a.title)}</b><span>原著第 ${a.from}—${a.to} 章 · ${a.pages.length} 段</span></button>`).join('')}</div>`, foot: [{ label: '返回', primary: true, fn: () => A.closeStoryArchive() }], acts: { act: i => A.viewArchiveAct(+i) } });
    },
    archiveAct({ arc }) {
      const a = GC.ML.arcs[arc];
      sheet('archiveAct', { kicker: `第${a.act}幕 · 原著第 ${a.from}—${a.to} 章`, title: a.title, body: `<div class="story">${esc(a.summary)}</div><p class="muted" style="margin-top:12px">主战：${esc(a.boss)}${a.bossSkills?.length ? `（${a.bossSkills.map(esc).join('、')}）` : ''}　契约：${a.contracts.map(c => esc(c.name)).join('、') || '无'}</p>`, foot: [{ label: '返回目录', fn: () => A.openStoryArchive(archiveFrom === 'home' ? A.renderHome : A.renderMap) }, '-', { label: `阅读正文（${a.pages.length} 段）`, primary: true, disabled: !a.pages.length, fn: () => A.openReader(arc, () => A.viewArchiveAct(arc)) }] });
    },
    reader({ arc, page }) {
      const a = GC.ML.arcs[arc], p = a.pages[page]; if (!p) return;
      const box = sheet('reader', { kicker: `第${a.act}幕 · ${a.title} · 原著第 ${p.chapter} 章`, title: p.title, cls: 'wide', aside: `${page + 1} / ${a.pages.length}`, body: `<div class="story" style="max-width:860px;margin:0 auto">${esc(p.text)}</div>`, foot: [{ label: '合上', fn: () => A.closeReader() }, '-', { label: '上一段', disabled: page <= 0, fn: () => A.readerPage(-1) }, { label: '下一段', primary: true, disabled: page >= a.pages.length - 1, fn: () => A.readerPage(1) }] });
      box.querySelector('.sheet-body').scrollTop = 0;
    },
    endless() {
      closeSheet(); setBase('endless'); ctx.rig.goTo('shrine', { dur: 1200 });
      const st = GC.state, enemies = Q.endlessRoster();
      baseEl.replaceChildren();
      const hud = document.createElement('div'); hud.className = 'map-hud';
      hud.innerHTML = `<div class="map-head"><small>${esc(st.name || '')} · 无尽</small><b>第 ${st.wave} 波</b><span>${enemies.map(e => `${esc(e.name)} ${esc(e.rankName)}`).join('　')}</span></div><div class="map-res"><b>经验<i>${num(st.xp)}</i></b><b>存活<i>${st.spirits.filter(s => !s.dead).length}/${st.spirits.length}</i></b><b>牌组<i>${st.deck.length}/25</i></b></div><div class="map-bar"></div>`;
      hud.querySelector('.map-bar').append(btn('查看敌情并出战', () => A.showStoryBeforeBattle('endless-arena'), true), btn('鬼灵与卡牌', () => A.openCollection(() => A.renderMap())), btn(`难度 · ${GC.DIFFICULTIES[Q.difficultyOf()].name}`, () => show('difficulty')), btn('旅途记录', () => A.journal()), btn('指南', () => show('guide', { index: 21 })), btn('设置', () => A.presentationSettings()), btn('回到标题', () => A.renderHome()));
      const afx = globalThis.GC_X?.affixes() || [];
      if (afx.length) { const d = document.createElement('span'); d.className = 'affix-line'; d.innerHTML = '词缀　' + afx.map(x => `<b title="${esc(x.desc)}">${esc(x.name)}</b>`).join(''); hud.querySelector('.map-head').append(d); }
      hud.querySelector('.map-bar').append(btn('成绩榜', () => show('records')));
      baseEl.append(hud);
    },
    daily() {
      const X = globalThis.GC_X, d = X.dailyInfo(), DF = GC.DIFFICULTIES, nameOf = id => GD.spirits.find(s => s.id === id)?.name || id; let diff = 'normal';
      const box = sheet('daily', { kicker: '每日挑战', title: d.date, cls: 'wide', aside: d.best ? `今日最佳 <b class="goldc">${d.best} 波</b>` : '今日尚未挑战',
        body: `<p class="muted">所有人今天拿到的是同一支队伍、同一副牌和同样的三条词缀。无尽规则，倒下即结束，成绩记为完成的波数。</p>
          <h3>词缀</h3><div class="grid c3">${d.affixes.map(x => `<div class="cell"><b class="red">${esc(x.name)}</b><p>${esc(x.desc)}</p></div>`).join('')}</div>
          <h3>出战鬼灵</h3><p>${d.squad.map(nameOf).map(esc).join('　')}</p><h3>牌组</h3><p>${d.deck.map(id => esc(GC.SKILLS[id].name)).join('　')}</p>
          <h3>难度</h3><div class="grid c5" id="ddiffs">${Object.keys(DF).map(k => `<button class="cell ${k === diff ? 'on' : ''}" data-act="diff" data-arg="${k}"><b>${DF[k].name}</b></button>`).join('')}</div>
          <h3>占用哪个存档位</h3><div class="grid c4">${(GC.slots || []).map((s, i) => `<button class="cell" data-act="go" data-arg="${i}"><b>${'壹贰叁肆'[i]} · ${s ? esc(s.name) : '空白'}</b><span>${s ? '将被替换' : '可用'}</span></button>`).join('')}</div>`,
        foot: [{ label: '返回', fn: () => closeSheet() }],
        acts: { diff: (k, el) => { diff = k; box.querySelectorAll('#ddiffs .cell').forEach(c => c.classList.toggle('on', c === el)); }, go: i => { if (X.startDaily(+i, diff)) { closeSheet(); A.renderMap(); } } } });
    },
    achievements() {
      const X = globalThis.GC_X, s = X.stats(), list = X.achievements(), done = list.filter(a => a.done).length, AR = X.ARCH;
      const row = (k, v) => `<b>${k}<i>${v}</i></b>`;
      sheet('achievements', { kicker: '成就与战绩', title: `已达成 ${done} / ${list.length}`, cls: 'wide',
        body: `<div class="stats">${row('胜', s.wins)}${row('负', s.losses)}${row('击倒', s.kills)}${row('首领', s.bossWins)}${row('最快', s.fastest ? s.fastest + ' 回合' : '—')}${row('无伤亡', s.flawless)}${row('新卡', s.cards)}${row('召唤', s.summons)}${row('合击', s.bonds)}${row('无尽', s.maxWave ? s.maxWave + ' 波' : '—')}</div>
          <p class="muted">流派　${Object.keys(AR).map(k => `${AR[k]} ${s.arch[k] || 0}`).join('　')}</p>
          <div class="grid c4 ach">${list.map(a => `<div class="cell ${a.done ? 'on' : 'off'}"><b>${a.done ? '● ' : '○ '}${esc(a.name)}</b><p>${esc(a.desc)}</p></div>`).join('')}</div>`,
        foot: [{ label: '返回', primary: true, fn: () => closeSheet() }] });
    },
    records() {
      const r = globalThis.GC_X.records(), DF = GC.DIFFICULTIES, days = Object.keys(r.daily).sort().reverse().slice(0, 14);
      sheet('records', { kicker: '成绩榜', title: '无尽与每日挑战', cls: 'wide',
        body: `<div class="split"><div><h3>无尽 · 前十</h3>${r.endless.length ? r.endless.map((e, i) => `<div class="cell"><b>${i + 1}. 第 ${e.wave} 波</b><span>${esc(DF[e.difficulty]?.name || '')} · ${esc(e.date)} · ${esc(e.name || '')}</span></div>`).join('') : '<p class="muted">还没有记录。无尽旅途倒下时会记下完成的波数。</p>'}</div><div><h3>每日挑战</h3>${days.length ? days.map(k => `<div class="cell"><b>${esc(k)}</b><span>${r.daily[k]} 波</span></div>`).join('') : '<p class="muted">还没有记录。</p>'}</div></div>`,
        foot: [{ label: '返回', primary: true, fn: () => closeSheet() }] });
    },
    battleUpgrade() {
      const st = GC.state;
      sheet('battleUpgrade', { kicker: '无尽 · 战中升级', title: '消耗经验提升鬼灵', cls: 'wide', aside: `经验 <b class="goldc">${num(st.xp)}</b>`, body: `<p class="muted">升级后该鬼灵回满生命；场上、手牌与牌堆中的同名单位同步提升，冷却、状态与累计显形费用不变。</p><div class="grid c4">${st.spirits.map((s, i) => { const r = GD.ranks[s.rankIndex], nx = s.id === 'nannan' ? null : GD.ranks[s.rankIndex + 1]; return `<button class="cell ${s.dead ? 'dead' : ''}" data-act="up" data-arg="${i}" ${!nx || st.xp < r.upgradeXp ? 'disabled' : ''}><b>${esc(s.name)} · ${esc(s.rankName)}</b><span>${nx ? `→ ${esc(nx.name)} · ${num(r.upgradeXp)} 经验` : '不可提升'}</span><span>命 ${num(s.hp)}/${num(s.maxHp)}${s.dead ? ' · 阵亡' : ''}</span></button>`; }).join('')}</div>`, foot: [{ label: '返回战场', primary: true, fn: () => { closeSheet(); A.closeBattleUpgrade(); } }], acts: { up: i => { if (A.upgradeInBattle(+i)) play('upgrade'); show('battleUpgrade'); } } });
    },
    testLab() { testLab(); },
    testEnd({ result }) {
      sheet('testEnd', { kicker: '演武结束', title: result === 'win' ? '演武胜利' : '演武失败', cls: 'narrow', body: `<p>${result === 'win' ? '敌方单位全部消散，或敌方命灯尽灭。' : '我方命灯尽灭。'}本场结果没有写入正式存档。</p>`, foot: [{ label: '回到标题', fn: () => A.exitTestToHome() }, { label: '返回演武台', primary: true, fn: () => A.exitTestBattle() }] });
    },
    journal() {
      const st = GC.state;
      sheet('journal', { kicker: '旅途记录', title: GC.NODES[st.current]?.title || '启程之前', cls: 'narrow', body: `<div class="log">${(st.log || []).slice(0, 250).map(x => `<p>${esc(x)}</p>`).join('') || '<p>尚无记录。</p>'}</div>`, foot: [{ label: '合上', primary: true, fn: () => closeSheet() }] });
    },
    settings() {
      const p = GC.preferences || {}, tips = (() => { try { return JSON.parse(localStorage.getItem('youqi-guide-v1') || '{}').enabled !== false; } catch { return true; } })();
      let speed = p.speed || 1, q = qualityLocked() ? quality().name : 'auto', story = storyMode() ? 'stage' : 'plain', cine = ctx.cine?.mode || 'full', vslot = ctx.video?.slotMode?.() || 'black';
      const story0 = story, cine0 = cine;   // 没改动的项不写入：否则按画质给出的自动默认值会被存成玩家的显式选择
      const q0 = q, tierName = { cinema: '影院', high: '高', medium: '中', low: '低', potato: '极简', lite: '试玩' }[quality().name];
      const box = sheet('settings', {
        kicker: '设置', title: '演出 · 声音 · 画质', cls: 'narrow',
        body: `<div class="field"><span>演出速度</span><div class="seg" id="sp">${[[1, '正常'], [1.6, '快速'], [2.4, '极速']].map(([v, l]) => `<button data-act="sp" data-arg="${v}" class="${+speed === v ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="field"><span>画质</span><div class="seg" id="ql">${[['auto', `自动（当前${tierName}）`], ['cinema', '影院'], ['high', '高'], ['medium', '中'], ['low', '低'], ['potato', '极简']].map(([v, l]) => `<button data-act="ql" data-arg="${v}" class="${q === v ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="field"><span>剧情呈现</span><div class="seg" id="sty">${[['stage', '实景'], ['plain', '文字面板']].map(([v, l]) => `<button data-act="sty" data-arg="${v}" class="${story === v ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="field"><span>技能演出</span><div class="seg" id="cin">${[['full', '全屏 + 牌桌'], ['smart', '精简'], ['table', '仅牌桌']].map(([v, l]) => `<button data-act="cin" data-arg="${v}" class="${cine === v ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="field"><span>缺技能视频时</span><div class="seg" id="vsl">${[['black', '纯黑占位'], ['cine', '程序演出']].map(([v, l]) => `<button data-act="vsl" data-arg="${v}" class="${vslot === v ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="field"><span>音效</span><input type="checkbox" id="snd" ${p.sound !== false ? 'checked' : ''}></div><div class="field"><span>音效音量</span><input type="range" id="vol" min="0" max="100" value="${Math.round((p.volume ?? .55) * 100)}"></div><div class="field"><span>音乐音量</span><input type="range" id="mus" min="0" max="100" value="${Math.round((ctx.music?.level ?? .5) * 100)}"></div><div class="field"><span>减少闪烁</span><input type="checkbox" id="rf" ${p.reduceFlash ? 'checked' : ''}></div><div class="field"><span>首次操作提示</span><input type="checkbox" id="tips" ${tips ? 'checked' : ''}></div><p class="muted">渲染分辨率会随帧率自动升降，以尽量保持 60 帧。「自动」在分辨率降到底仍不足时再降一档画质；手动选择高／中／低后只调分辨率，不换档。</p>`,
        foot: [{ label: '重置提示与教学', fn: () => { localStorage.setItem('youqi-guide-v1', JSON.stringify({ enabled: true, seen: {} })); ctx.tutorial?.reset(); toast('操作提示与新手引导已重置：新旅途的第一场战斗会重新教学'); } }, { label: '查看指南', fn: () => show('guide', { index: 0 }) }, { label: '素材清单', fn: () => show('assets') }, '-', { label: '保存', primary: true, fn: () => { ctx.music?.setLevel(+box.querySelector('#mus').value / 100); A.applyPresentationSettings({ speed, sound: box.querySelector('#snd').checked, reduceFlash: box.querySelector('#rf').checked, volume: +box.querySelector('#vol').value / 100, guideHints: box.querySelector('#tips').checked }); if (story !== story0) localStorage.setItem('gc3d-story-mode', story); if (cine !== cine0) ctx.cine?.setMode(cine); ctx.video?.setSlotMode?.(vslot); if (q !== q0) { if (q === 'auto') autoQuality(); else setQuality(q, true); } document.body.classList.toggle('reduce-flash', !!GC.preferences.reduceFlash); closeSheet(); } }],
        acts: { vsl: (v, el) => { vslot = v; box.querySelectorAll('#vsl button').forEach(b => b.classList.toggle('on', b === el)); }, cin: (v, el) => { cine = v; box.querySelectorAll('#cin button').forEach(b => b.classList.toggle('on', b === el)); }, sty: (v, el) => { story = v; box.querySelectorAll('#sty button').forEach(b => b.classList.toggle('on', b === el)); }, sp: (v, el) => { speed = +v; box.querySelectorAll('#sp button').forEach(b => b.classList.toggle('on', b === el)); }, ql: (v, el) => { q = v; box.querySelectorAll('#ql button').forEach(b => b.classList.toggle('on', b === el)); } }
      });
    },
    confirmReset() { sheet('confirmReset', { kicker: '重置', title: '重新开始？', cls: 'narrow', body: '<p>当前旅途将被清空。</p>', foot: [{ label: '取消', fn: () => closeSheet() }, { label: '确认', primary: true, fn: () => A.resetCampaign() }] }); },
    tip({ index }) {
      const g = GUIDE[index]; if (!g) return;
      tipEl.replaceChildren();
      const d = document.createElement('div'); d.className = 'tip guide-tip';
      d.innerHTML = `<b>${esc(g[0])}</b><p>${esc(g[1])}</p>`;
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;margin-top:8px;justify-content:flex-end';
      row.append(btn('完整指南', () => { d.remove(); show('guide', { index }); }), btn('知道了', () => d.remove(), true));
      d.append(row); tipEl.append(d);
      setTimeout(() => d.remove(), 14000);
    },
    // 素材清单：外部制作的视频 / 音乐 / 卡面 / 立绘，哪些已放入、哪些还是空位
    assets() {
      const S = slotList(GC.GD, skillTier), groups = [['video', '技能视频', 'assets/video'], ['music', '音乐', 'assets/music'], ['cards', '卡面', 'assets/cards'], ['views', '立绘（透明底抠图）', 'assets/views']];
      const label = (k, s) => k === 'video' ? `${s.owner} · ${s.skill}${s.passive ? '（被动）' : ''}` : k === 'music' ? s.where : k === 'cards' ? s.owner : `${s.owner} · ${s.pose}`;
      const box = sheet('assets', { kicker: '素材清单', title: '已放入与空位', body: '<p class="muted">读取中…</p>', foot: [{ label: '返回设置', fn: () => show('settings') }, '-', { label: '关闭', primary: true, fn: closeSheet }] });
      Promise.all(groups.map(g => fetch('/__list?dir=' + g[2]).then(r => r.ok ? r.json() : []).catch(() => []))).then(lists => {
        if (!box.isConnected) return;
        const html = groups.map(([k, name, dir], i) => {
          const on = new Set(lists[i].map(f => String(f).replace(/\.[^.]+$/, '').toLowerCase()));
          const have = s => on.has(s.key) || (k === 'cards' && !!artImage(s.key)) || (k === 'views' && !!viewImage(s.key.replace(/_(front|side|back)$/, ''), s.key.split('_').pop()));
          const n = S[k].filter(have).length;
          return `<h3>${name} · 已放入 ${n} / ${S[k].length}</h3><p class="muted">放到 <b>${dir}/</b>，文件名如下（扩展名 ${S[k][0].ext.join(' / ')}）。绿色为已放入。</p><div class="asset-list">${S[k].map(s => `<span class="${have(s) ? 'have' : ''}" title="${esc(label(k, s))}">${esc(s.key)}　${esc(label(k, s))}</span>`).join('')}</div>`;
        }).join('');
        fill(box.querySelector('.sheet-body'), `<p class="muted">每个文件对应游戏的哪一处，详见 docs/素材导入说明.md。放入文件后刷新页面即生效。</p>${html}`);
      });
    },
    guide({ index = 0 }) {
      const prev = sheetName && sheetName !== 'guide' && sheetName !== 'settings' ? null : null; void prev;
      sheet('guide', { kicker: '操作指南', title: GUIDE[index][0], cls: 'wide', aside: `${index + 1} / ${GUIDE.length}`, body: `<div class="split" style="grid-template-columns:230px 1fr"><div class="grid" style="gap:4px">${GUIDE.map((g, i) => `<button class="cell ${i === index ? 'on' : ''}" style="padding:5px 10px" data-act="go" data-arg="${i}"><b style="font-size:14px">${i + 1}. ${esc(g[0])}</b></button>`).join('')}</div><div><p style="font-size:18px;line-height:2">${esc(GUIDE[index][1])}</p></div></div>`, foot: [{ label: '上一条', disabled: index <= 0, fn: () => show('guide', { index: index - 1 }) }, { label: '下一条', disabled: index >= GUIDE.length - 1, fn: () => show('guide', { index: index + 1 }) }, '-', { label: '合上', primary: true, fn: () => closeSheet() }], acts: { go: i => show('guide', { index: +i }) } });
    },
    codex() {
      closeSheet(); if (base !== 'home') setBase('home');
      const tabs = `<div class="seg" style="margin-bottom:14px">${[['spirits', '鬼灵'], ['cards', '卡牌'], ['ranks', '等级表'], ['rules', '规则摘要']].map(([k, l]) => `<button data-act="tab" data-arg="${k}" class="${codexTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      let body = '';
      if (codexTab === 'spirits') body = `<div class="grid c6">${GD.spirits.map(c => `<button class="cell card" data-act="sp" data-arg="${c.id}">${TU(codexUnit(c))}<b>${esc(c.name)}</b><span>${esc(c.initialRank)} · 潜力 ${c.potential}</span></button>`).join('')}</div>`;
      else if (codexTab === 'cards') body = `${[['', '旧卡'], ...Object.entries(globalThis.GC_X.ARCH)].map(([k, l]) => { const ids = Object.keys(GC.SKILLS).filter(id => (GC.SKILLS[id].arch || '') === k); return ids.length ? `<h3>${esc(l)} ${ids.length}</h3><div class="grid c6">${ids.map(id => `<div class="cell card" title="${esc(GC.SKILLS[id].desc || '')}">${TS(id)}<b>${esc(GC.SKILLS[id].name)}</b><span style="color:${RARITY[GC.SKILLS[id].rarity]}">${esc(GC.SKILLS[id].rarity)} · ${GC.SKILLS[id].cost} 鬼气</span><p>${esc(GC.SKILLS[id].desc || '')}</p></div>`).join('')}</div>` : ''; }).join('')}<h3>关键词</h3><div class="grid c4">${Object.values(globalThis.GC_X.KEYWORDS).map(k => `<div class="cell"><b class="goldc">${esc(k.name)}</b><p>${esc(k.desc)}</p></div>`).join('')}</div><div></div><h3>御鬼者技能</h3><div class="grid c3">${GD.playerSkills.map(s => `<div class="cell"><b>${esc(s.name)}</b><span>每场战斗一次</span><p>${esc(s.desc)}</p></div>`).join('')}</div>`;
      else if (codexTab === 'ranks') body = `<table class="t"><tr><th>等级</th><th>生命</th><th>攻击</th><th>升级经验</th><th>击杀经验</th></tr>${GD.ranks.map(r => `<tr><td>${esc(r.name)}</td><td>${r.hp[0] === r.hp[1] ? r.hp[0] : r.hp.join('–')}</td><td>${r.atk[0] === r.atk[1] ? r.atk[0] : r.atk.join('–')}</td><td>${r.upgradeXp}</td><td>${r.killXp}</td></tr>`).join('')}</table><p class="muted" style="margin-top:10px">潜力 1—6 越高，数值越接近区间上限；潜力 6 取最大值。囡囡为禁忌，固定生命 100000、攻击 100。</p>`;
      else body = `<div class="grid c2">${[['伤害', `普通攻击：${GD.damageRules.normal}。技能：${GD.damageRules.skill}。每次攻击的伤害随机削减 1%—20%。`], ['暴击', '潜力 1：2% 概率、140% 伤害；潜力 6：10% 概率、200% 伤害；中间线性递增。'], ['等级压制', '攻击方每高一级伤害 ×1.25 / 1.5 / 1.75 / 2（四级及以上）；每低一级 ×0.75 / 0.5 / 0.25 / 0。'], ['显形与鬼气', '本场第 X 次显形消耗 X 鬼气，回手再上场继续累计。开局 3 鬼气，每回合上限 +1 并回满。左右移动每格 1 鬼气，相邻换位免费。'], ['命灯', '双方命灯互相独立，上限取出战鬼灵中最高的生命（至少 10），敌方命灯随难度加厚。空路直击每次只能打掉对方命灯的一部分：简单难度两成，难度越高我方的上限越低（禁忌一成）、敌方直击越重。双方的命灯在桌上各是一支命烛，烛越短越危险；鼠标停在烛上（触屏点一下）看具体数值。'], ['难度', '简单：敌人为基础强度。普通／困难／噩梦／禁忌：敌人生命与攻击逐级提高，首领获得额外技能；普通第 9 幕起多一名敌人，困难起随从带精英技能；噩梦起首领每回合施法并带狂怒、坚壁；禁忌的敌人在等级压制上高一级，首领拥有不死之躯。'], ['回手', '回手去除增益，保留生命、负面效果、冷却与已消耗的次数。时间回退按记录的完整状态复活。'], ['起手与牌组', '战前至多选 6 名鬼灵，牌组上限 25 张。起手 6 张，出战鬼灵足够时至少 3 名在手。'], ['奖励', '战后先结算经验，再多轮三选一。稀有度权重：普通 50%、稀有 30%、珍藏 15%、传说 5%。']].map(([t, d]) => `<div class="cell"><b>${t}</b><p>${esc(d)}</p></div>`).join('')}</div>`;
      sheet('codex', { kicker: '图鉴', title: '鬼灵 · 卡牌 · 规则', cls: 'wide', body: tabs + body, foot: [{ label: '回到标题', primary: true, fn: () => { closeSheet(); if (GC.state?.mainline && base !== 'home') A.renderMap(); } }], acts: { tab: k => { codexTab = k; S.codex(); }, sp: id => A.showCodexSpirit(id) } });
    },
    codexSpirit({ id }) {
      const c = GD.spirits.find(x => x.id === id); if (!c) return;
      const owned = GC.state?.spirits?.find(x => x.id === id), crit = Q.critProfile(c);
      const rows = (c.id === 'nannan' ? [{ name: '禁忌' }] : GD.ranks.slice(Math.max(0, GD.rankIndex(c.initialRank)))).map(r => { const st = Q.spiritStats(c.id, r.name, c.potential), names = c.unlocks.find(x => x[0] === r.name)?.[1] || []; return `<tr><td>${esc(r.name)}</td><td>${num(st.atk)}</td><td>${num(st.hp)}</td><td class="blue">${names.map(esc).join('、') || ''}</td></tr>`; }).join('');
      const skills = c.unlocks.flatMap(([rank, names]) => names.map(nm => ({ rank, nm, d: GD.skillDefs[nm] || {} })));
      sheet('codexSpirit', { kicker: `${c.type} · 初始 ${c.initialRank} · 潜力 ${c.potential}`, title: c.name, cls: 'wide', aside: owned ? `已契约：${esc(owned.rankName)}` : '', body: `<div class="split"><div>${TU(codexUnit(c))}<div class="stats"><b>暴击率<i>${Math.round(crit.chance * 100)}%</i></b><b>暴击伤害<i>${Math.round(crit.multiplier * 100)}%</i></b></div></div><div><h3>等级与数值</h3><table class="t"><tr><th>等级</th><th>攻击</th><th>生命</th><th>解锁</th></tr>${rows}</table><h3>全部技能</h3><div class="grid c2">${skills.map(({ rank, nm, d }) => `<div class="cell"><b>${esc(nm)}<span class="corner">${esc(rank)} 解锁</span></b><span>${esc(Q.skillDetailMeta(d, nm))}</span><p>${esc(d.desc || '')}</p>${Q.replacementText(nm) ? `<p class="blue">${esc(Q.replacementText(nm))}</p>` : ''}</div>`).join('')}</div></div></div>`, foot: [{ label: '返回图鉴', primary: true, fn: () => A.renderCodex() }] });
    },
    close() { closeSheet(); }
  };

  function deckGrid(act) {
    return `<div class="grid c6">${GC.state.deck.map((id, i) => `<button class="cell card" data-act="${act}" data-arg="${i}">${TS(id)}<b>${esc(GC.SKILLS[id]?.name || id)}</b><span>${GC.SKILLS[id]?.arch ? esc(globalThis.GC_X.ARCH[GC.SKILLS[id].arch]) + ' · ' : ''}${GC.SKILLS[id]?.cost ?? 0} 鬼气</span></button>`).join('') || '<p class="muted">牌组是空的。</p>'}</div>`;
  }
  function testLab() {
    closeSheet(); if (base !== 'home') setBase('home');
    if (!testCfg) { try { testCfg = JSON.parse(localStorage.getItem('gc3d-testcfg') || 'null'); } catch { } }
    if (!testCfg) {
      testCfg = { playerHp: 10, enemyHp: 10, qi: 6, xp: 0, allies: GD.spirits.slice(0, 6).map((c, i) => ({ on: i < 3, id: c.id, rank: c.initialRank })), enemies: [0, 1, 2, 3].map(i => ({ on: i < 2, id: '', name: `试炼恶灵${'壹贰叁肆'[i]}`, pos: String(i), atk: 3 + i, hp: 12 + i * 4, rank: 'A级', effect: '' })), cards: ['coin', 'blade', 'horse', 'rope', '', ''] };
    }
    const cfg = testCfg, rankOpt = (sel, id) => id === 'nannan' ? '<option>禁忌</option>' : GD.ranks.map(r => `<option ${r.name === sel ? 'selected' : ''}>${r.name}</option>`).join('');
    const spOpt = (sel, blank) => (blank ? `<option value="">自定义恶灵</option>` : '') + GD.spirits.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.name}</option>`).join('');
    const cardOpt = sel => `<option value="">无</option>` + Object.keys(GC.SKILLS).map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${GC.SKILLS[id].name}</option>`).join('');
    const effOpt = sel => [['', '无状态'], ['eye', '鬼瞳'], ['queenField', '女王领域'], ['dream', '入梦'], ['spaceLaw', '空间规律'], ['ice', '冰雪'], ['invincible', '无敌']].map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`).join('');
    const box = sheet('testLab', {
      kicker: '演武台', title: '自定义一场测试', cls: 'wide',
      body: `<p class="muted">演武不会影响正式存档。我方鬼灵全部从手牌显形；敌方直接在场。</p><h3>我方鬼灵</h3><div class="grid c3">${cfg.allies.map((a, i) => `<div class="cell" style="cursor:default"><div class="field"><input type="checkbox" data-f="a${i}on" ${a.on ? 'checked' : ''}><select data-f="a${i}id">${spOpt(a.id)}</select><select data-f="a${i}rank">${rankOpt(a.rank, a.id)}</select></div></div>`).join('')}</div><h3>敌方单位</h3><div class="grid c2">${cfg.enemies.map((e, i) => `<div class="cell" style="cursor:default"><div class="field"><input type="checkbox" data-f="e${i}on" ${e.on ? 'checked' : ''}><select data-f="e${i}id">${spOpt(e.id, true)}</select><input type="text" data-f="e${i}name" value="${esc(e.name)}" style="width:120px"><select data-f="e${i}pos">${[0, 1, 2, 3].map(l => `<option value="${l}" ${+e.pos === l ? 'selected' : ''}>第${l + 1}路</option>`).join('')}</select></div><div class="field"><span style="min-width:2em">攻</span><input type="number" data-f="e${i}atk" value="${e.atk}" min="0"><span style="min-width:2em">命</span><input type="number" data-f="e${i}hp" value="${e.hp}" min="1"><select data-f="e${i}rank">${rankOpt(e.rank)}</select><select data-f="e${i}effect">${effOpt(e.effect)}</select></div></div>`).join('')}</div><h3>初始手牌与资源</h3><div class="field">${cfg.cards.map((c, i) => `<select data-f="c${i}">${cardOpt(c)}</select>`).join('')}</div><div class="field"><span>鬼气</span><input type="number" data-f="qi" value="${cfg.qi}" min="0" max="30"><span>我方命灯</span><input type="number" data-f="playerHp" value="${cfg.playerHp}" min="1" max="10"><span>敌方命灯</span><input type="number" data-f="enemyHp" value="${cfg.enemyHp ?? 10}" min="1" max="10"><span>经验</span><input type="number" data-f="xp" value="${cfg.xp || 0}" min="0" style="width:120px"></div>`,
      foot: [{ label: '回到标题', fn: () => { read(); closeSheet(); } }, { label: '恢复默认', fn: () => { testCfg = null; localStorage.removeItem('gc3d-testcfg'); testLab(); } }, '-', { label: '开始演武', primary: true, fn: () => { read(); const c = JSON.parse(JSON.stringify(cfg)); c.cards = c.cards.filter(Boolean); c.enemies = c.enemies.map(e => { const o = { ...e }; if (!o.id) delete o.id; else { delete o.atk; delete o.hp; } return o; }); A.startTestBattle(c); } }]
    });
    const f = k => box.querySelector(`[data-f="${k}"]`);
    function read() {
      cfg.allies.forEach((a, i) => { a.on = f(`a${i}on`).checked; a.id = f(`a${i}id`).value; a.rank = a.id === 'nannan' ? '禁忌' : f(`a${i}rank`).value; });
      cfg.enemies.forEach((e, i) => { e.on = f(`e${i}on`).checked; e.id = f(`e${i}id`).value; e.name = e.id ? GD.spirits.find(c => c.id === e.id).name : (f(`e${i}name`).value || '试炼恶灵'); e.pos = f(`e${i}pos`).value; e.atk = Math.max(0, +f(`e${i}atk`).value || 0); e.hp = Math.max(1, +f(`e${i}hp`).value || 1); e.rank = f(`e${i}rank`).value; e.effect = f(`e${i}effect`).value; e.potential = e.id ? undefined : 3; });
      cfg.cards = cfg.cards.map((_, i) => f(`c${i}`).value);
      cfg.qi = Math.max(0, +f('qi').value || 0); cfg.playerHp = Math.min(10, Math.max(1, +f('playerHp').value || 10)); cfg.enemyHp = Math.min(10, Math.max(1, +f('enemyHp').value || 10)); cfg.xp = Math.max(0, +f('xp').value || 0);
      localStorage.setItem('gc3d-testcfg', JSON.stringify(cfg));
    }
    box.addEventListener('change', ev => { const k = ev.target.dataset?.f; if (k && /^a\did$/.test(k)) { read(); const i = +k[1], c = GD.spirits.find(x => x.id === cfg.allies[i].id); cfg.allies[i].rank = c.initialRank; testLab(); } });
  }
  function exportSlots() {
    const blob = new Blob([A.exportSlotsData()], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `鬼灵契约-四档存档-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('已导出四档存档');
  }
  function importSlots() {
    sheet('import', { kicker: '导入存档', title: '替换全部四个存档位？', cls: 'narrow', body: '<p class="red">导入会用备份文件覆盖当前全部四个存档位。建议先导出当前存档。</p>', foot: [{ label: '取消', fn: () => closeSheet() }, { label: '选择备份文件', primary: true, fn: () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.onchange = async () => { const file = inp.files?.[0]; if (!file) return; const r = A.importSlotsData(await file.text()); if (r.ok) toast('导入完成'); else toast('导入失败：' + (r.error || '文件无效'), 'warn'); }; inp.click(); } }] });
  }
  function toast(text, kind) { ctx.overlay ? ctx.overlay.toast(text, kind) : console.info(text); }

  function apply(screen, params) {
    const fn = S[screen];
    if (!fn) { console.warn('[ui] unknown screen', screen); return; }
    try { fn(params || {}); } catch (e) { console.error('[ui]', screen, e); }
  }
  function show(screen, params) {
    if (screen !== 'battle' && screen !== 'close' && screen !== 'tip' && ctx.director?.running > 0 && ctx.battleActive) { queue.push([screen, params]); return; }
    apply(screen, params);
  }
  function update(dt, t) {
    mapView.update(dt, t); stage.update(dt, t);
    if (queue.length && !(ctx.director?.running > 0)) { const q = queue; queue = []; for (const [s, p] of q) apply(s, p); }
  }
  addEventListener('keydown', ev => { if (ev.key === 'Escape' && sheetEl && ['battleDetail', 'battleLog', 'journal', 'guide', 'leaveBattle'].includes(sheetName)) closeSheet(); });
  return { show, update, toast, onSync() { }, get modalOpen() { return !!sheetEl || stage.active; }, get base() { return base; }, closeSheet };
}
