// 轮盘选择器：选项排在一个立体圆环上，转到正面的那一项就是选中项。
// 左右方向键 / 滚轮 / 拖拽 / 点两侧的项 / 点箭头 都可以转动。
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createWheel(items, { index = 0, onChange = null, render = it => `<b>${esc(it.name)}</b>`, itemWidth = 220, cls = '', label = '' } = {}) {
  const n = items.length;
  const el = document.createElement('div'); el.className = 'wheel ' + cls; el.tabIndex = 0; el.style.setProperty('--wheel-w', itemWidth + 'px');
  el.innerHTML = `${label ? `<div class="wheel-label">${esc(label)}</div>` : ''}<button class="wheel-arrow prev" data-step="-1" aria-label="上一项">‹</button><div class="wheel-stage"><div class="wheel-ring"></div></div><button class="wheel-arrow next" data-step="1" aria-label="下一项">›</button><div class="wheel-dots">${items.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>`;
  const ring = el.querySelector('.wheel-ring'), dots = [...el.querySelectorAll('.wheel-dots i')];
  const cells = items.map((it, i) => {
    const c = document.createElement('div'); c.className = 'wheel-item' + (it.disabled ? ' dead' : '') + (it.cls ? ' ' + it.cls : ''); c.dataset.i = i;
    if (it.color) c.style.setProperty('--tone', it.color);
    c.innerHTML = render(it, i); ring.append(c); return c;
  });
  let cur = Math.max(0, Math.min(n - 1, index));
  // 弧形排布：选中项正对玩家，两侧的项沿一段圆弧向后转开；从一端绕回另一端的项直接换位，不横穿整个画面
  const prev = cells.map(() => null);
  function layout() {
    cells.forEach((c, i) => {
      let d = ((i - cur) % n + n) % n; if (d > n / 2) d -= n;
      const a = Math.abs(d), jump = prev[i] != null && Math.abs(prev[i] - d) > 1.5; prev[i] = d;
      if (jump) { c.style.transition = 'none'; requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transition = ''; })); }
      const sx = Math.sign(d), tx = a ? itemWidth * (1 + (a - 1) * .62) : 0;
      c.style.transform = `translateX(${sx * tx}px) translateZ(${-a * 200}px) rotateY(${-sx * Math.min(56, a * 36)}deg)`;
      c.style.zIndex = String(10 - a); c.style.visibility = a > 2 ? 'hidden' : '';
      c.classList.toggle('on', i === cur); c.classList.toggle('near', a === 1); c.classList.toggle('far', a > 1);
    });
    dots.forEach((d, i) => d.classList.toggle('on', i === cur));
  }
  function go(i, silent = false) {
    i = ((i % n) + n) % n; if (i === cur) return;
    cur = i; layout();
    if (!silent) onChange?.(items[cur], cur);
  }
  let dragged = 0;   // 刚拖动过：吞掉紧随其后的那次 click，否则它会把轮盘又转回去
  el.addEventListener('click', ev => {
    if (performance.now() - dragged < 350) { dragged = 0; ev.preventDefault(); ev.stopPropagation(); return; }
    const a = ev.target.closest('[data-step]'), c = ev.target.closest('.wheel-item'), d = ev.target.closest('.wheel-dots i');
    if (a) go(cur + +a.dataset.step); else if (d) go(+d.dataset.i); else if (c && +c.dataset.i !== cur) { ev.preventDefault(); ev.stopPropagation(); go(+c.dataset.i); }
  }, true);
  el.addEventListener('keydown', ev => {
    if (ev.target.closest('input, textarea, select')) return;
    if (ev.key === 'ArrowLeft') { go(cur - 1); ev.preventDefault(); } else if (ev.key === 'ArrowRight') { go(cur + 1); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {   // 同一面板里有几个轮盘时，上下键在它们之间换焦点
      const all = [...(el.closest('.sheet') || document).querySelectorAll('.wheel')], k = all.indexOf(el) + (ev.key === 'ArrowDown' ? 1 : -1);
      if (all[k]) { all[k].focus({ preventScroll: false }); ev.preventDefault(); }
    } else if (ev.key === 'Enter' && ev.target === el) {        // 回车：当前项里的主按钮，没有就用面板的主按钮
      const b = cells[cur].querySelector('button:not([disabled]), [data-act]') || el.closest('.sheet')?.querySelector('.ink-btn.primary:not([disabled])');
      if (b) { b.click(); ev.preventDefault(); ev.stopPropagation(); }
    }
  });
  // 打开时把焦点放到第一个轮盘上，方向键立刻可用（已有焦点在输入框或别的轮盘里时不抢）
  setTimeout(() => { const f = document.activeElement; if (el.isConnected && !(f && f.closest && f.closest('.wheel, input, textarea, select'))) el.focus({ preventScroll: true }); }, 80);
  let wheelAt = 0;
  // 面板本身能上下滚动时，竖向滚轮留给面板（按住 Shift 或横向滚动仍然转轮盘）；面板不需要滚动时滚轮直接转轮盘
  const scrollable = () => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const oy = getComputedStyle(p).overflowY; if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 2) return true; } return false; };
  el.addEventListener('wheel', ev => { if (!ev.shiftKey && Math.abs(ev.deltaX) <= Math.abs(ev.deltaY) && scrollable()) return; ev.preventDefault(); const t = performance.now(); if (t - wheelAt < 160) return; wheelAt = t; go(cur + (ev.deltaY + ev.deltaX > 0 ? 1 : -1)); }, { passive: false });
  let dragX = null;
  el.addEventListener('pointerdown', ev => { if (!ev.target.closest('button, a, input')) dragX = ev.clientX; });
  const drop = ev => { if (dragX == null) return; const dx = ev.clientX - dragX; dragX = null; if (ev.type === 'pointerup' && Math.abs(dx) > 46) { dragged = performance.now(); go(cur + (dx < 0 ? 1 : -1)); } if (!el.isConnected) { removeEventListener('pointerup', drop); removeEventListener('pointercancel', drop); } };
  addEventListener('pointerup', drop); addEventListener('pointercancel', drop);
  layout();
  return { el, go, get index() { return cur; }, get item() { return items[cur]; }, cells };
}
