import * as THREE from 'three';
import { speed, tween } from '../core/tween.js';

export function createOverlay(ctx) {
  const ui = document.getElementById('ui');
  const el = (cls, parent = ui, tag = 'div') => { const d = document.createElement(tag); d.className = cls; parent.append(d); return d; };
  const floats = el('fx-floats'), bannerBox = el('fx-banner-box'), captions = el('fx-captions'), hintEl = el('hud-hint'), toasts = el('toasts');
  const v = new THREE.Vector3();

  function project(world) {
    v.copy(world).project(ctx.rig.camera);
    return { x: (v.x * .5 + .5) * innerWidth, y: (-v.y * .5 + .5) * innerHeight, visible: v.z < 1 };
  }
  function floatText(where, text, { kind = 'damage', dy = 0, delay = 0 } = {}) {
    const p = where.isVector3 ? project(where) : where;
    const d = document.createElement('div');
    d.className = `fx-float ${kind}`;
    d.textContent = text;
    d.style.left = p.x + (Math.random() - .5) * 26 + 'px'; d.style.top = p.y + dy + 'px';
    d.style.animationDuration = 1100 / speed() + 'ms'; d.style.animationDelay = delay + 'ms';
    floats.append(d);
    setTimeout(() => d.remove(), 1200 / speed() + delay + 80);
  }
  function banner(text, { tone = 'info', sub = '', dur = 900 } = {}) {
    return new Promise(resolve => {
      bannerBox.replaceChildren();
      const d = el(`fx-banner ${tone}`, bannerBox);
      d.innerHTML = `<b></b><span></span>`;
      d.firstChild.textContent = text; d.lastChild.textContent = sub;
      const total = dur / speed();
      d.style.animationDuration = total + 'ms';
      setTimeout(() => { d.remove(); resolve(); }, total);
    });
  }
  function caption(name, { tone = 'ally', sub = '', dur = 1100 } = {}) {
    const d = el(`fx-caption ${tone}`, captions);
    d.innerHTML = '<b></b><span></span>';
    d.firstChild.textContent = name; d.lastChild.textContent = sub;
    const total = dur / speed();
    d.style.animationDuration = total + 'ms';
    setTimeout(() => d.remove(), total);
  }
  let hintText = '';
  function hint(text = '') {
    if (text === hintText) return;
    hintText = text;
    hintEl.textContent = text;
    hintEl.classList.toggle('show', !!text);
  }
  function toast(text, kind = 'info') {
    const d = el(`toast ${kind}`, toasts);
    d.textContent = text;
    setTimeout(() => d.classList.add('out'), 2200);
    setTimeout(() => d.remove(), 2700);
    while (toasts.children.length > 3) toasts.firstChild.remove();
  }
  function flash(color = '#ffffff', amount = .5, dur = 400) {
    const g = ctx.R.grade;
    if (globalThis.GC?.preferences?.reduceFlash) amount *= .25;
    g.uFlash.value.set(color); g.uFlashAmt.value = amount;
    return tween(g.uFlashAmt, { value: 0 }, { dur, ease: 'outQuad' });
  }
  return { project, floatText, banner, caption, hint, toast, flash, root: ui };
}
