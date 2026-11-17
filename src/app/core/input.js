import * as THREE from 'three';

const entries = new Map();
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let camera = null, dom = null, hovered = null, down = null, holdTimer = null, enabled = true;
export const pointer = { x: 0, y: 0, nx: 0, ny: 0, inside: false };

export function register(object, handlers) {
  entries.set(object, handlers);
  return () => unregister(object);
}
export function unregister(object) {
  if (hovered?.object === object) { hovered.handlers.onOut?.(); hovered = null; }
  entries.delete(object);
}
export function setInputEnabled(v) { enabled = v; if (!v) clearHover(); }

function clearHover() {
  if (hovered) { hovered.handlers.onOut?.(); hovered = null; }
  if (dom) dom.style.cursor = '';
}

function pick(ev) {
  const r = dom.getBoundingClientRect();
  pointer.x = ev.clientX; pointer.y = ev.clientY;
  pointer.nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
  pointer.ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
  if (!enabled || !entries.size) return null;
  ndc.set(pointer.nx, pointer.ny);
  raycaster.setFromCamera(ndc, camera);
  const roots = [];
  for (const [object, handlers] of entries) if (object.visible && handlers.enabled?.() !== false) roots.push(object);
  const hits = raycaster.intersectObjects(roots, true);
  for (const hit of hits) {
    let o = hit.object;
    if (o.userData.noPick) continue;
    while (o && !entries.has(o)) o = o.parent;
    if (o) return { object: o, handlers: entries.get(o), point: hit.point };
  }
  return null;
}

function move(ev) {
  pointer.inside = true;
  const hit = pick(ev);
  if (hit?.object !== hovered?.object) {
    hovered?.handlers.onOut?.();
    hovered = hit;
    hit?.handlers.onHover?.(hit.point);
  }
  dom.style.cursor = hit && (hit.handlers.onClick || hit.handlers.onLongPress) ? 'pointer' : '';
  if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 8) { clearTimeout(holdTimer); down.moved = true; }
}

function press(ev) {
  if (ev.button > 0) return;
  const hit = pick(ev);
  if (hit?.object !== hovered?.object) { hovered?.handlers.onOut?.(); hovered = hit; hit?.handlers.onHover?.(hit.point); }
  down = { x: ev.clientX, y: ev.clientY, hit, moved: false, held: false };
  clearTimeout(holdTimer);
  if (hit?.handlers.onLongPress) holdTimer = setTimeout(() => { if (down && !down.moved) { down.held = true; hit.handlers.onLongPress(); } }, 480);
}

function release(ev) {
  clearTimeout(holdTimer);
  if (!down) return;
  const d = down; down = null;
  if (d.moved || d.held) return;
  const hit = pick(ev);
  if (hit && d.hit && hit.object === d.hit.object) hit.handlers.onClick?.(hit.point, ev);
  else if (!hit && !d.hit) background?.(ev);
  if (ev.pointerType === 'touch') clearHover();
}

let background = null;
export function onBackgroundClick(fn) { background = fn; }

export function initInput(canvas, cam) {
  dom = canvas; camera = cam;
  dom.addEventListener('pointermove', move);
  dom.addEventListener('pointerdown', press);
  dom.addEventListener('pointerup', release);
  dom.addEventListener('pointercancel', () => { clearTimeout(holdTimer); down = null; });
  dom.addEventListener('pointerleave', () => { pointer.inside = false; clearHover(); });
  dom.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    const hit = pick(ev);
    if (hit?.handlers.onContext) hit.handlers.onContext(); else contextBackground?.();
  });
}
let contextBackground = null;
export function onBackgroundContext(fn) { contextBackground = fn; }
