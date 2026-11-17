import * as THREE from 'three';
import { woodTextures, plasterTextures, tabletTexture, lanternTexture, talismanTexture, glowTexture, noiseTexture, paperBump, windowPaperTexture, portraitTexture, makeCanvas, canvasTexture } from './textures.js';
import { TABLE } from './table.js';
import { mulberry } from '../core/tween.js';
import { createFlame } from '../fx/flame.js';

const END = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';

function repeatAll(t, x, y) { for (const k of ['map', 'bump', 'normal', 'rough']) if (t[k]) t[k].repeat.set(x, y); }

function cobwebTexture() {
  const [c, g] = makeCanvas(256), rnd = mulberry(4);
  g.translate(0, 0); g.strokeStyle = 'rgba(210,214,220,.55)'; g.lineWidth = 1.1;
  const spokes = 7, R = 250;
  for (let i = 0; i < spokes; i++) { const a = i / (spokes - 1) * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); }
  for (let r = 24; r < R; r += 22 + rnd() * 10) {
    g.beginPath();
    for (let i = 0; i < spokes; i++) { const a = i / (spokes - 1) * Math.PI / 2, rr = r * (.88 + rnd() * .2), x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? g.quadraticCurveTo((x + px) / 2 * .92, (y + py) / 2 * .92, x, y) : g.moveTo(x, y); var px = x, py = y; }
    g.stroke();
  }
  return canvasTexture(c);
}

export function createRoom(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const rnd = mulberry(8), swingers = [], flickers = [];
  const F = TABLE.floorY;

  const floorTex = woodTextures('floor', { base: '#1a100d', tone: '#3a2218', planks: 9, seed: 23, wear: .8, wax: 6 });
  repeatAll(floorTex, 5, 5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ map: floorTex.map, normalMap: floorTex.normal, roughnessMap: floorTex.rough, roughness: 1, color: '#8a7e78' }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = F; floor.receiveShadow = true;
  group.add(floor);

  const plaster = plasterTextures('wall', { base: '#34302b', seed: 7, repeat: [6, 3.5] });
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster.map, normalMap: plaster.normal, roughnessMap: plaster.rough, roughness: 1, color: '#a39a90', side: THREE.DoubleSide });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(52, 30), wallMat); back.position.set(0, F + 15, -21); back.receiveShadow = true; group.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(52, 30), wallMat); left.rotation.y = Math.PI / 2; left.position.set(-17, F + 15, 0); left.receiveShadow = true; group.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(52, 30), wallMat); right.rotation.y = -Math.PI / 2; right.position.set(17, F + 15, 0); right.receiveShadow = true; group.add(right);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(52, 52), wallMat); ceil.rotation.x = Math.PI / 2; ceil.position.y = F + 24; group.add(ceil);

  const timber = woodTextures('timber', { base: '#170d0a', tone: '#3a2015', seed: 41, wear: .5 });
  const timberMat = new THREE.MeshStandardMaterial({ map: timber.map, normalMap: timber.normal, roughnessMap: timber.rough, roughness: 1, color: '#8f7d74' });
  for (const [x, z] of [[-9.5, -13], [9.5, -13], [-9.5, 5], [9.5, 5]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.6, .68, 24, 14), timberMat); p.position.set(x, F + 12, z); p.castShadow = true; group.add(p);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.95, 1.05, .6, 14), new THREE.MeshStandardMaterial({ color: '#2a2830', roughness: .9 })); foot.position.set(x, F + .3, z); group.add(foot);
  }
  for (const z of [-13, 5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(21, .9, .7), timberMat); b.position.set(0, F + 21.5, z); group.add(b); }
  for (const x of [-9.5, 9.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.7, .9, 19), timberMat); b.position.set(x, F + 22.2, -4); group.add(b); }

  const shelf = new THREE.Group(); shelf.position.set(0, F, -20.4); group.add(shelf);
  const shelfMat = new THREE.MeshStandardMaterial({ map: timber.map, normalMap: timber.normal, roughnessMap: timber.rough, roughness: 1, color: '#6a5a52' });
  const tabGeo = new THREE.BoxGeometry(.62, 1.5, .16);
  const tabMat = new THREE.MeshStandardMaterial({ map: tabletTexture(), roughness: .85, color: '#b0988a' });
  const rows = 6, cols = 30, inst = new THREE.InstancedMesh(tabGeo, tabMat, rows * cols), dummy = new THREE.Object3D();
  inst.castShadow = true; inst.receiveShadow = true;
  const candleGeo = new THREE.CylinderGeometry(.06, .075, .36, 8), candleMat = new THREE.MeshStandardMaterial({ color: '#cbbd9a', roughness: .55, emissive: '#6a3010', emissiveIntensity: .25 });
  const candleInst = new THREE.InstancedMesh(candleGeo, candleMat, rows * 4); let cn = 0;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const y = 1.4 + r * 2.5, plank = new THREE.Mesh(new THREE.BoxGeometry(31, .22, 1.3), shelfMat);
    plank.position.set(0, y, .2 + r * -.05); plank.receiveShadow = true; shelf.add(plank);
    for (let c = 0; c < cols; c++) {
      if (rnd() < .08) continue;
      dummy.position.set((c - cols / 2 + .5) * 1.0 + (rnd() - .5) * .12, y + .86, .1);
      dummy.rotation.set((rnd() - .5) * .06, (rnd() - .5) * .2, (rnd() - .5) * .05 + (rnd() < .04 ? .5 : 0));
      dummy.updateMatrix(); inst.setMatrixAt(n++, dummy.matrix);
    }
    for (let k = 0; k < 4; k++) {
      const px = (rnd() - .5) * 28, py = y + .11 + .18;
      dummy.position.set(px, py, .75); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); candleInst.setMatrixAt(cn++, dummy.matrix);
      const fl = createFlame({ color: '#ffa04a', core: '#fff0c8', width: .05, height: .24, seed: rnd() * 90 });
      fl.mesh.position.set(px, y + .11 + .36, .75);
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff9a4a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .12 }));
      g.scale.setScalar(.9); g.position.set(px, y + .11 + .5, .75); g.userData.noPick = true;
      shelf.add(fl.mesh, g); flickers.push({ fl, g, seed: rnd() * 100 });
    }
  }
  inst.count = n; inst.instanceMatrix.needsUpdate = true; shelf.add(inst);
  candleInst.count = cn; candleInst.instanceMatrix.needsUpdate = true; shelf.add(candleInst);

  // 窗：糊纸窗棂 + 旧手印 + 低饱和冷白月光束
  const win = new THREE.Group(); win.position.set(-16.9, F + 13.5, -7); win.rotation.y = Math.PI / 2; group.add(win);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 8.4), new THREE.MeshBasicMaterial({ map: windowPaperTexture(), color: new THREE.Color('#aab6c8').multiplyScalar(1.5) }));
  pane.position.z = .02; win.add(pane);
  const barMat = new THREE.MeshStandardMaterial({ color: '#0b0809', roughness: .9 });
  for (let i = 0; i <= 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.16, 8.6, .2), barMat); b.position.set(-3.2 + i * 6.4 / 6, 0, .12); win.add(b); }
  for (let i = 0; i <= 7; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(6.6, .16, .2), barMat); b.position.set(0, -4.2 + i * 8.4 / 7, .12); win.add(b); }
  const web = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: cobwebTexture(), transparent: true, depthWrite: false, opacity: .8 }));
  web.position.set(-3.1, 4.1, .2); web.rotation.z = Math.PI / 2; win.add(web);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 8.5, 24, 20, 1, true), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNoise: { value: noiseTexture() }, uColor: { value: new THREE.Color('#b4c0d4') } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: `uniform sampler2D uNoise;uniform float uTime;uniform vec3 uColor;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
      void main(){float n=texture2D(uNoise,vec2(vUv.x*2.,vUv.y*.6-uTime*.01)).r;float streak=texture2D(uNoise,vec2(vUv.x*6.,.3)).g;
        float fres=pow(abs(dot(vN,vV)),1.6);float a=fres*smoothstep(0.,.25,vUv.y)*smoothstep(1.,.5,vUv.y)*(.35+.65*n)*(.5+.5*streak)*.06;
        gl_FragColor=vec4(uColor*a,a);${END}}`
  }));
  shaft.position.set(-8.4, F + 9.2, -5.2); shaft.rotation.z = -1.02; shaft.rotation.y = .12; shaft.userData.noPick = true;
  group.add(shaft);

  // 纸灯笼：竹骨 + 透光不均的纸 + 内部烛火与真实点光
  const lanterns = [];
  const lanternMat = new THREE.MeshStandardMaterial({ map: lanternTexture(), emissiveMap: lanternTexture(), emissive: '#ffd9a0', emissiveIntensity: .75, roughness: .95, bumpMap: paperBump(), bumpScale: 1.2, side: THREE.DoubleSide });
  const ribMat = new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: .8 });
  for (const x of [-6.2, 6.2]) {
    const pivot = new THREE.Group(); pivot.position.set(x, F + 21.2, -8.5);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 6, 5), barMat); cord.position.y = -3;
    const shade = new THREE.Mesh(new THREE.SphereGeometry(1.25, 22, 16), lanternMat); shade.scale.y = 1.25; shade.position.y = -7.4;
    for (let i = 0; i < 6; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(1.0 + Math.abs(Math.sin(i / 5 * Math.PI)) * .28, .015, 4, 24), ribMat); rib.rotation.x = Math.PI / 2; rib.position.y = -7.4 + (i - 2.5) * .5; pivot.add(rib); }
    const capA = new THREE.Mesh(new THREE.CylinderGeometry(.5, .6, .25, 12), barMat); capA.position.y = -5.9;
    const capB = capA.clone(); capB.position.y = -8.95;
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(.05, .16, 1.6, 6), new THREE.MeshStandardMaterial({ color: '#cfc5ac', roughness: .95 })); tassel.position.y = -9.9;
    const inner = createFlame({ color: '#ffa850', core: '#fff0c8', width: .1, height: .5, seed: x + 20 });
    inner.mesh.position.y = -7.9; inner.mesh.renderOrder = 7;
    const lamp = new THREE.PointLight('#ff9a4a', 22, 16, 1.6); lamp.position.y = -7.4;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd7a0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .1 }));
    glow.scale.setScalar(4.6); glow.position.y = -7.4;
    pivot.add(cord, shade, capA, capB, tassel, inner.mesh, lamp, glow);
    group.add(pivot); lanterns.push(pivot); swingers.push({ o: pivot, amp: .05, speed: .55, seed: rnd() * 9, axis: 'z' });
    flickers.push({ fl: inner, lamp, seed: rnd() * 100, lantern: true });
  }

  // 红线符纸：旧黄纸，朱砂字，褶皱
  const cordMat = new THREE.MeshStandardMaterial({ color: '#8f2218', roughness: .85, emissive: '#3a0a06', emissiveIntensity: .12 });
  const talGeo = new THREE.PlaneGeometry(.34, .92, 1, 4); talGeo.translate(0, -.46, 0);
  { const p = talGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 9) * .012 + Math.sin(p.getY(i) * 23 + p.getX(i) * 11) * .006); talGeo.computeVertexNormals(); }
  function redString(a, b, sag, charms) {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, p = new THREE.Vector3().lerpVectors(a, b, t); p.y -= Math.sin(t * Math.PI) * sag; pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .022, 5), cordMat));
    for (let i = 0; i < charms; i++) {
      const t = (i + .6) / (charms + .2), p = curve.getPoint(t);
      if (i % 3 === 2) {
        const bell = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshStandardMaterial({ color: '#8a6a3c', metalness: .85, roughness: .5 }));
        bell.position.copy(p); bell.position.y -= .12; group.add(bell);
      } else {
        const m = new THREE.Mesh(talGeo, new THREE.MeshStandardMaterial({ map: talismanTexture(i % 4), bumpMap: paperBump(), bumpScale: 1, side: THREE.DoubleSide, roughness: .95, color: '#a89a80', emissive: '#2a2008', emissiveIntensity: .1 }));
        m.position.copy(p); m.rotation.y = (rnd() - .5) * .8; m.castShadow = true;
        group.add(m); swingers.push({ o: m, amp: .16 + rnd() * .12, speed: 1.1 + rnd() * .8, seed: rnd() * 9, axis: 'x', twist: m.rotation.y });
      }
    }
  }
  redString(new THREE.Vector3(-9.5, 3.5, -5.6), new THREE.Vector3(9.5, 3.3, -5.6), 1.15, 11);
  redString(new THREE.Vector3(-9.5, 4.3, -8.5), new THREE.Vector3(9.5, 4.6, -8.5), 1.5, 9);
  redString(new THREE.Vector3(-9.5, 6.5, -13), new THREE.Vector3(-9.5, 6, 5), 1.4, 8);
  redString(new THREE.Vector3(9.5, 6.2, -13), new THREE.Vector3(9.5, 6.6, 5), 1.4, 8);

  const stool = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 2), new THREE.MeshStandardMaterial({ map: timber.map, normalMap: timber.normal, roughnessMap: timber.rough, color: '#4a3a32', roughness: 1 }));
  stool.position.set(0, F + 1.7, -4.3); group.add(stool);

  // ── 现实诡异的细节 ──
  // 2. 一排背对着的纸扎人
  {
    const mat = new THREE.MeshStandardMaterial({ color: '#3c3830', roughness: .95, bumpMap: paperBump(), bumpScale: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Group(), s = .85 + (i % 3) * .06;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.42, .68, 2.5, 8, 1, true), mat); body.position.y = 2.1; body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 10), mat); head.position.y = 3.65; head.scale.y = 1.15;
      const hair = new THREE.Mesh(new THREE.SphereGeometry(.4, 12, 10, 0, 6.28, 0, 1.5), new THREE.MeshStandardMaterial({ color: '#0e0b0a', roughness: .9 })); hair.position.set(0, 3.7, -.03); hair.scale.y = 1.15;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.9, .08, .22), mat); arm.position.y = 2.9;
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.0, 5), barMat); stand.position.y = .5;
      f.add(body, head, hair, arm, stand); f.scale.setScalar(s);
      f.position.set(-15.2 + i * 1.0 + (rnd() - .5) * .15, F, -19.6); f.rotation.y = (rnd() - .5) * .25;
      group.add(f);
    }
  }
  // 3. 墙上被烧掉脸的旧遗像
  {
    const g = new THREE.Group(); g.position.set(7.2, F + 11.5, -20.85); group.add(g);
    const pm = new THREE.MeshStandardMaterial({ map: portraitTexture(), roughness: .8, bumpMap: paperBump(), bumpScale: .8 });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.45), pm); pic.rotation.z = .035; g.add(pic);
    const rib = new THREE.Mesh(new THREE.PlaneGeometry(2.7, .5), new THREE.MeshStandardMaterial({ color: '#0a0909', roughness: .9, side: THREE.DoubleSide })); rib.position.set(1.25, 1.55, .02); rib.rotation.z = -.7; g.add(rib);
  }
  // 4. 梁下的蛛网
  for (const [x, y, z, ry, rz] of [[-9.1, F + 21.3, -12.6, .8, 0], [9.1, F + 21.3, -12.6, 2.3, Math.PI / 2], [-9.1, F + 21.3, 4.6, -.8, 0]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: cobwebTexture(), transparent: true, depthWrite: false, opacity: .55, side: THREE.DoubleSide }));
    w.position.set(x, y - 1.2, z); w.rotation.set(0, ry, rz); w.userData.noPick = true; group.add(w);
  }

  function update(dt, t) {
    for (const s of swingers) {
      const v = Math.sin(t * s.speed + s.seed) * s.amp + Math.sin(t * s.speed * 2.7 + s.seed * 2) * s.amp * .3;
      s.o.rotation[s.axis] = v;
      if (s.twist !== undefined) s.o.rotation.y = s.twist + Math.sin(t * s.speed * .6 + s.seed) * .25;
    }
    for (const f of flickers) {
      const k = .8 + .2 * Math.sin(t * 12 + f.seed) * Math.sin(t * 5.1 + f.seed);
      if (f.lantern) { f.lamp.intensity = 22 * (.9 + .1 * k); f.fl.set({ lean: Math.sin(t * .7 + f.seed) * .25 }); continue; }
      f.fl.set({ intensity: .55 + .45 * k, lean: Math.sin(t * .5 + f.seed) * .3 });
      f.g.material.opacity = .12 * k;
    }
    shaft.material.uniforms.uTime.value = t;
  }
  return { group, update, lanterns };
}
