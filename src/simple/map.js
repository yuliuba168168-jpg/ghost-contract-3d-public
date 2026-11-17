// 方块版路线图：每幕的节点按行排成方块，可前往的节点高亮可点。接口与 ui/map-view.js 相同。
import { play } from '../app/core/audio.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPE = { event: '卷', contract: '契', battle: '战', boss: '首', camp: '火', reward: '查', ending: '终', fork: '岔', shop: '市', omen: '兆' };
const PROPS = [['censer', '香炉'], ['urn', '魂瓮'], ['bell', '招魂铃']];

export function createSimpleMap(ctx, host) {
  const box = document.createElement('div'); box.className = 'sm'; box.hidden = true; host.append(box);
  let onEnter = null;
  const kindOf = (id, n) => n.contract ? 'contract' : id.endsWith('-fork') ? 'fork' : n.type;
  function describe(id, n) {
    const GD = globalThis.GC.GD;
    if (n.type === 'battle' || n.type === 'boss') return `${n.type === 'boss' ? '首领战' : n.elite ? '精英战 · 掉法器' : '战斗'} · ${GD.ranks[n.rank]?.name || ''} · ${n.cards || 1}轮奖励`;
    if (n.contract) return '必经契约';
    if (n.type === 'camp') return '恢复 · 存档点';
    if (n.type === 'reward') return '调查 · 经验与卡牌';
    if (n.type === 'ending') return '阶段性尾声';
    if (n.type === 'shop') return '买卖 · 花冥钱';
    if (n.type === 'omen') return '遭遇 · 有得有失';
    return id.endsWith('-fork') ? '四个去处任选其一' : '剧情';
  }
  function show(act, enter) {
    const GC = globalThis.GC, st = GC.state, rows = GC.ACT_ROWS[act] || [];
    onEnter = enter; box.hidden = false;
    box.innerHTML = `<div class="sm-rows">${rows.map(row => `<div class="sm-row">${row.map(id => {
      const n = GC.NODES[id]; if (!n) return '';
      const kind = kindOf(id, n), status = st.completed.includes(id) ? 'done' : st.available.includes(id) ? 'open' : 'locked';
      return `<button class="sm-node ${kind} ${status}" data-id="${esc(id)}" ${status === 'open' ? '' : 'disabled'}><i>${TYPE[kind] || '卷'}</i><b>${esc(n.title)}</b><small>${status === 'done' ? '已完成' : esc(describe(id, n))}</small></button>`;
    }).join('')}</div>`).join('')}</div><div class="sm-props">${PROPS.map(([k, l]) => `<button data-prop="${k}">${l}</button>`).join('')}</div>`;
    const open = box.querySelector('.sm-node.open'); if (open) open.scrollIntoView({ block: 'center' });
  }
  box.addEventListener('click', ev => {
    const node = ev.target.closest('[data-id]'), prop = ev.target.closest('[data-prop]');
    if (node && !node.disabled) { play('click'); onEnter?.(node.dataset.id); }
    else if (prop) {
      const r = globalThis.GC_X?.touchProp(prop.dataset.prop); if (!r) return;
      play('click'); ctx.overlay.toast(r.rite ? `仪式【${r.rite}】完成。${r.reward}。` : `${r.name}：${r.text}`, 'info');
      if (r.rite || prop.dataset.prop !== 'bell') globalThis.GC.actions.renderMap();
    }
  });
  return { show, hide() { box.hidden = true; }, update() { }, warm() { } };
}
