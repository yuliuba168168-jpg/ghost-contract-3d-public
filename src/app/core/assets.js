import * as THREE from 'three';

const images = new Map();
const textures = new Map();
let manifest = { views: {}, art: {} };

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function loadAssets(onProgress) {
  manifest = await fetch('assets/gen/manifest.json').then(r => r.ok ? r.json() : null).catch(() => null) || { views: {}, art: {} };
  manifest.views ||= {}; manifest.art ||= {};
  const jobs = [];
  for (const [id, views] of Object.entries(manifest.views)) for (const [pose, info] of Object.entries(views)) jobs.push([`view:${id}:${pose}`, 'assets/gen/' + info.file]);
  for (const [id, info] of Object.entries(manifest.art)) jobs.push([`art:${id}`, 'assets/gen/' + info.file]);
  // 新卡面：assets/cards/<id>.png|webp|jpg 存在时覆盖管线产物（也让原本无图的鬼灵有卡面）
  const custom = await fetch('/__list?dir=assets/cards').then(r => r.ok ? r.json() : []).catch(() => []);
  for (const f of custom) { const m = /^([a-z0-9_]+)\.(png|webp|jpe?g)$/i.exec(f); if (m) jobs.push([`art:${m[1].toLowerCase()}`, 'assets/cards/' + f]); }
  // 新立绘：assets/views/<id>_front|side|back.png|webp（透明底抠图）存在时覆盖管线产物
  const views = await fetch('/__list?dir=assets/views').then(r => r.ok ? r.json() : []).catch(() => []);
  for (const f of views) { const m = /^([a-z0-9]+)_(front|side|back)\.(png|webp)$/i.exec(f); if (m) jobs.push([`view:${m[1].toLowerCase()}:${m[2].toLowerCase()}`, 'assets/views/' + f]); }
  let done = 0;
  await Promise.all(jobs.map(async ([key, url]) => {
    const img = await loadImage(url);
    if (img) images.set(key, img);
    onProgress?.(++done / jobs.length);
  }));
}

export function hasArt(id) { return images.has(`art:${id}`); }
export function hasViews(id) { return images.has(`view:${id}:front`); }
export function artImage(id) { return images.get(`art:${id}`) || null; }
export function viewImage(id, pose = 'front') { return images.get(`view:${id}:${pose}`) || null; }

export function viewTexture(id, pose = 'front') {
  const key = `view:${id}:${pose}`;
  if (textures.has(key)) return textures.get(key);
  const img = images.get(key);
  if (!img) return null;
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  tex.userData.aspect = img.width / img.height;
  textures.set(key, tex);
  return tex;
}
