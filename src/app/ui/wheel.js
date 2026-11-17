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
      c.style.transform = `translateX(${d * itemWidth * .96}px) translateZ(${-a * 170}px) rotateY(${-d * 30}deg)`;
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
  el.addEventListener('click', ev => {
    const a = ev.target.closest('[data-step]'), c = ev.target.closest('.wheel-item'), d = ev.target.closest('.wheel-dots i');
    if (a) go(cur + +a.dataset.step); else if (d) go(+d.dataset.i); else if (c && +c.dataset.i !== cur) { ev.preventDefault(); ev.stopPropagation(); go(+c.dataset.i); }
  }, true);
  el.addEventListener('keydown', ev => { if (ev.key === 'ArrowLeft') { go(cur - 1); ev.preventDefault(); } else if (ev.key === 'ArrowRight') { go(cur + 1); ev.preventDefault(); } });
  let wheelAt = 0;
  el.addEventListener('wheel', ev => { ev.preventDefault(); const t = performance.now(); if (t - wheelAt < 160) return; wheelAt = t; go(cur + (ev.deltaY + ev.deltaX > 0 ? 1 : -1)); }, { passive: false });
  let dragX = null;
  el.addEventListener('pointerdown', ev => { if (!ev.target.closest('button, a, input')) dragX = ev.clientX; });
  addEventListener('pointerup', ev => { if (dragX == null) return; const dx = ev.clientX - dragX; dragX = null; if (Math.abs(dx) > 46) go(cur + (dx < 0 ? 1 : -1)); });
  layout();
  return { el, go, get index() { return cur; }, get item() { return items[cur]; }, cells };
}
