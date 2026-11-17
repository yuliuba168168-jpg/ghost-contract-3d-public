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
  manifest = await fetch('assets/gen/manifest.json').then(r => r.json());
  const jobs = [];
  for (const [id, views] of Object.entries(manifest.views)) for (const [pose, info] of Object.entries(views)) jobs.push([`view:${id}:${pose}`, 'assets/gen/' + info.file]);
  for (const [id, info] of Object.entries(manifest.art)) jobs.push([`art:${id}`, 'assets/gen/' + info.file]);
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
