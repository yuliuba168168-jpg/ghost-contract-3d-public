// 轮盘选择器：选项排在一个立体圆环上，转到正面的那一项就是选中项。
// 左右方向键 / 滚轮 / 拖拽 / 点两侧的项 / 点箭头 都可以转动。
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createWheel(items, { index = 0, onChange = null, render = it => `<b>${esc(it.name)}</b>`, itemWidth = 220, cls = '', label = '' } = {}) {
  const n = items.length, step = 360 / Math.max(n, 5), radius = Math.round(itemWidth / 2 / Math.tan(Math.PI / Math.max(n, 5)) + 26);
  const el = document.createElement('div'); el.className = 'wheel ' + cls; el.tabIndex = 0; el.style.setProperty('--wheel-w', itemWidth + 'px');
  el.innerHTML = `${label ? `<div class="wheel-label">${esc(label)}</div>` : ''}<button class="wheel-arrow prev" data-step="-1" aria-label="上一项">‹</button><div class="wheel-stage"><div class="wheel-ring"></div></div><button class="wheel-arrow next" data-step="1" aria-label="下一项">›</button><div class="wheel-dots">${items.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>`;
  const ring = el.querySelector('.wheel-ring'), dots = [...el.querySelectorAll('.wheel-dots i')];
  const cells = items.map((it, i) => {
    const c = document.createElement('div'); c.className = 'wheel-item' + (it.disabled ? ' dead' : '') + (it.cls ? ' ' + it.cls : ''); c.dataset.i = i;
    if (it.color) c.style.setProperty('--tone', it.color);
    c.innerHTML = render(it, i); ring.append(c); return c;
  });
  let cur = Math.max(0, Math.min(n - 1, index)), turn = cur;   // turn：累计转过的格数（可超出 0..n-1，保证总是走最短的方向）
  function layout() {
    ring.style.transform = `translateZ(${-radius}px) rotateY(${-turn * step}deg)`;
    cells.forEach((c, i) => {
      let d = ((i - cur) % n + n) % n; if (d > n / 2) d -= n;
      c.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`;
      c.classList.toggle('on', i === cur); c.classList.toggle('near', Math.abs(d) === 1); c.classList.toggle('far', Math.abs(d) > 1);
    });
    dots.forEach((d, i) => d.classList.toggle('on', i === cur));
  }
  function go(i, silent = false) {
    i = ((i % n) + n) % n; if (i === cur) return;
    let d = i - cur; if (d > n / 2) d -= n; if (d < -n / 2) d += n;
    turn += d; cur = i; layout();
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
