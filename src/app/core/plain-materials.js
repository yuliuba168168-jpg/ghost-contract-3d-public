// 极简画质（quality().plain）专用：软件渲染（没有显卡）时，PBR 标准材质 + 二十盏灯的逐像素计算是最大的开销。
// 这里把场景里的 MeshStandardMaterial 换成便宜得多的 MeshLambertMaterial，并关掉当前亮度为 0 的灯。
// 实测（无显卡机器）每帧约 100ms → 65ms。只在极简档启用，其余画质完全不受影响。
import * as THREE from 'three';

const FILL = 1.5;
const cache = new WeakMap();   // 标准材质 → 简化材质（保持材质共享关系）
const PROXY = ['opacity', 'transparent', 'visible', 'emissiveIntensity', 'depthWrite', 'depthTest', 'alphaTest', 'side', 'blending', 'colorWrite'];

function lambertOf(a) {
  let b = cache.get(a); if (b) return b;
  b = new THREE.MeshLambertMaterial({ map: a.map, emissiveMap: a.emissiveMap, alphaMap: a.alphaMap, vertexColors: a.vertexColors, fog: a.fog, toneMapped: a.toneMapped, polygonOffset: a.polygonOffset, polygonOffsetFactor: a.polygonOffsetFactor, polygonOffsetUnits: a.polygonOffsetUnits });
  b.name = a.name; b.userData = a.userData;
  b.color = a.color; b.emissive = a.emissive;   // 共享同一个 Color 对象：之后对原材质调色照样生效
  // 持有原材质引用的代码（淡入淡出、发光强弱）继续写原材质，这里转发过来
  for (const k of PROXY) Object.defineProperty(b, k, { get: () => a[k], set: v => { a[k] = v; }, enumerable: true, configurable: true });
  let map = a.map;
  Object.defineProperty(b, 'map', { get: () => a.map, set: v => { a.map = v; }, enumerable: true, configurable: true });
  b.userData.__plainSync = () => { if (a.map !== map) { map = a.map; b.needsUpdate = true; } };
  cache.set(a, b); return b;
}

const lights = [], filled = new WeakSet();
let sweepAt = 0;
export function simplifyScene(scene, frame) {
  // Lambert 没有环境图反射光，画面会明显变暗：每个场景补一盏暖色环境光
  if (!filled.has(scene)) { filled.add(scene); const fill = new THREE.AmbientLight('#ffdcb4', FILL); fill.name = 'plain-fill'; scene.add(fill); }
  if (frame - sweepAt >= 45 || !sweepAt) {
    sweepAt = frame || 1; lights.length = 0;
    scene.traverse(o => {
      if (o.isLight) { if (o.isPointLight || o.isSpotLight) lights.push(o); return; }
      const m = o.material; if (!m || !(o.isMesh || o.isSkinnedMesh)) return;
      if (Array.isArray(m)) { for (let i = 0; i < m.length; i++) if (m[i].isMeshStandardMaterial) m[i] = lambertOf(m[i]); }
      else if (m.isMeshStandardMaterial) o.material = lambertOf(m);
      else m.userData?.__plainSync?.();
    });
  }
  // 亮度为 0 的灯（路线图灯池、特效补光）不参与着色
  for (const l of lights) { const on = l.intensity > .001; if (l.userData.__plainOff ? on : !on) { l.userData.__plainOff = !on; l.visible = on; } }
}
