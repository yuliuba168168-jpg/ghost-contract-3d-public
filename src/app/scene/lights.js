import * as THREE from 'three';
import { quality, onQuality } from '../core/quality.js';

// 光源只有：烛火(~1900K)、窗外低饱和月光、灯笼暖光；环境底光极暗近中性。
export function createLights(scene, renderer) {
  const group = new THREE.Group();
  scene.add(group);

  const hemi = new THREE.HemisphereLight('#3a3b40', '#1a1612', .62);
  group.add(hemi);

  const key = new THREE.SpotLight('#ffb36b', 120, 26, .44, .95, 1.6);
  key.position.set(.4, 9.5, 2.8);
  key.target.position.set(0, 0, -.5);
  key.castShadow = true;
  key.shadow.bias = -.0006; key.shadow.normalBias = .03; key.shadow.radius = 4;
  key.shadow.camera.near = 3; key.shadow.camera.far = 18;
  group.add(key, key.target);

  const moon = new THREE.SpotLight('#8ea0c0', 220, 40, .5, .9, 1.4);
  moon.position.set(-15, 9, -7);
  moon.target.position.set(1.5, 0, -2.6);
  group.add(moon, moon.target);

  const rim = new THREE.Object3D();
  rim.position.set(-4, 3, -10);
  group.add(rim);

  const hand = new THREE.PointLight('#ffb878', 8, 5, 1.6);
  const back = new THREE.PointLight('#ffa968', 140, 30, 1.4);
  back.position.set(0, 4.5, -13.5);
  group.add(back);
  var rimBack = new THREE.PointLight('#8aa0c4', 32, 9, 1.6); rimBack.position.set(0, 2.4, -7.2); group.add(rimBack);
  const under = new THREE.PointLight('#b8401f', 1.6, 6, 1.8);
  under.position.set(0, .35, -2.75);
  group.add(under);
  const candles = [];
  function addCandle(x, y, z, intensity = 7) {
    const light = new THREE.PointLight('#ff9a3c', intensity, 11, 1.7);
    light.position.set(x, y, z);
    light.userData = { base: intensity, boost: 1, x, y, z, seed: Math.random() * 100 };
    light.shadow.bias = -.0012; light.shadow.normalBias = .02; light.shadow.radius = 5;
    light.shadow.camera.near = .08; light.shadow.camera.far = 14;
    group.add(light); candles.push(light);
    applyQuality();
    return light;
  }

  function sizeShadow(l, size) {
    if (l.shadow.mapSize.x !== size) { l.shadow.mapSize.set(size, size); l.shadow.map?.dispose(); l.shadow.map = null; }
  }
  function applyQuality() {
    const q = quality();
    if (!key) return;
    key.castShadow = q.shadows;
    const order = [0, 2, 1], boost = [1, 1.7, 1.25, 1][Math.min(3, q.candles)] || 1;
    order.forEach((ci, rank) => {
      const c = candles[ci];
      if (!c) return;
      c.visible = rank < q.candles; c.userData.boost = boost;
      c.castShadow = q.shadows && rank < q.candleShadows;
      sizeShadow(c, q.candleShadowSize);
    });
    sizeShadow(key, q.shadowSize);
  }
  applyQuality(); onQuality(applyQuality);

  // 初始占位环境图（启动后由 bakeEnvironment 用房间本身替换）
  const envScene = new THREE.Scene();
  const panel = (color, x, y, z, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, z); envScene.add(m); };
  envScene.background = new THREE.Color('#050506');
  panel(new THREE.Color('#ffb36b').multiplyScalar(5), 0, 6, 3, 2.2);
  panel(new THREE.Color('#ff9a3c').multiplyScalar(2.5), 5, 1, 2, 1);
  panel(new THREE.Color('#8ea0c0').multiplyScalar(2.2), -9, 5, -4, 3);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, .04).texture;
  scene.environmentIntensity = .35;
  pmrem.dispose();

  const hiddenForBake = [];
  function bakeEnvironment() {
    const prev = scene.environment;
    scene.environment = null;
    hiddenForBake.length = 0;
    scene.traverse(o => { if ((o.isSprite || o.isPoints || o.userData.dofProxy) && o.visible) { o.visible = false; hiddenForBake.push(o); } });
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(scene, .02, .1, 80, { size: 256, position: new THREE.Vector3(0, 1.8, -.4) });
    for (const o of hiddenForBake) o.visible = true;
    pm.dispose();
    scene.environment = rt.texture;
    scene.environmentIntensity = .6;
    prev?.dispose?.();
  }

  const state = { dim: 1, keyBase: 120 };
  function update(dt, t) {
    for (const c of candles) {
      const u = c.userData, n = Math.sin(t * 11 + u.seed) * .5 + Math.sin(t * 23.7 + u.seed * 2.1) * .3 + Math.sin(t * 5.3 + u.seed * .7) * .4;
      if (!c.visible) continue;
      c.intensity = u.base * u.boost * (1 + n * .13) * state.dim;
      c.position.set(u.x + Math.sin(t * 9 + u.seed) * .02, u.y + n * .015, u.z + Math.cos(t * 7.3 + u.seed) * .02);
    }
    back.intensity = 140; rimBack.intensity = 32 * state.dim * state.dim; hemi.intensity = .62;
    key.intensity = state.keyBase * (quality().plain ? 1.9 : 1) * state.dim * (1 + Math.sin(t * 6.1) * .012 + Math.sin(t * 17) * .008);
  }
  return { group, key, moon, hemi, hand, candles, addCandle, update, state, bakeEnvironment };
}
