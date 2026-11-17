import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { simplifyScene, restoreScene } from './plain-materials.js';
import { quality, onQuality, lowerQuality, floorQuality, view, savedScale, saveScale } from './quality.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 },
    uVignette: { value: 1.05 }, uGrain: { value: .05 }, uAberration: { value: .0004 },
    uDesat: { value: 0 }, uTint: { value: new THREE.Color('#ffffff') }, uTintAmt: { value: 0 },
    uFlash: { value: new THREE.Color('#ffffff') }, uFlashAmt: { value: 0 }, uEdgeDark: { value: 0 }
  },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `
    uniform sampler2D tDiffuse;uniform float uTime,uVignette,uGrain,uAberration,uDesat,uTintAmt,uFlashAmt,uEdgeDark;
    uniform vec3 uTint,uFlash;varying vec2 vUv;
    float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    void main(){
      vec2 c=vUv-.5;float d=length(c);
      vec2 off=c*d*uAberration*2.;
      vec3 col=vec3(texture2D(tDiffuse,vUv+off).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-off).b);
      float l=dot(col,vec3(.299,.587,.114));
      col=mix(col,vec3(l),uDesat+.2);
      col=mix(col*vec3(.9,.97,1.08),col*vec3(1.08,1.0,.9),smoothstep(.02,.5,l));
      col=mix(col,col*uTint*1.6+uTint*l*.25,uTintAmt);
      float v=smoothstep(.92,.18,d*uVignette);
      col*=mix(.16,1.,v);
      col*=1.-uEdgeDark*smoothstep(.18,.62,d);
      col+=uFlash*uFlashAmt*(.35+.65*smoothstep(.0,.7,d));
      float g=hash(vUv*vec2(1920.,1080.)+fract(uTime)*311.)-.5;
      col+=g*uGrain*(.35+l);
      gl_FragColor=vec4(max(col,0.),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
};

// AO/景深的深度与法线通道用 overrideMaterial 渲染，半透明/着色器广告牌/精灵会被当成实体，渲染前统一隐藏
function withoutFx(scene, fn, proxies = false) {
  const hidden = [], shown = [];
  if (proxies) scene.traverse(o => { if (o.userData.dofProxy) { o.visible = true; shown.push(o); } });
  scene.traverse(o => {
    if (!o.visible) return;
    const m = o.material;
    if (o.isSprite || (m && (Array.isArray(m) ? m.some(x => x.transparent || x.isShaderMaterial) : (m.transparent || m.isShaderMaterial)))) { o.visible = false; hidden.push(o); }
  });
  try { fn(); } finally { for (const o of hidden) o.visible = true; for (const o of shown) o.visible = false; }
}
function makeGtao(scene, camera) {
  const p = new GTAOPass(scene, camera, 512, 512);
  p.updateGtaoMaterial({ radius: .42, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
  p.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 });
  p.blendIntensity = 1;
  const render = p.render.bind(p);
  p.render = (...a) => withoutFx(p.scene, () => render(...a), true);
  return p;
}
const FOCUS_DIR = new THREE.Vector3();
export const focusState = { override: null };
function makeBokeh(scene, camera) {
  const p = new BokehPass(scene, camera, { focus: 8, aperture: .00042, maxblur: .011 });
  const render = p.render.bind(p);
  p.render = (...a) => withoutFx(p.scene, () => {
    camera.getWorldDirection(FOCUS_DIR);
    const t = FOCUS_DIR.y < -.05 ? (camera.position.y - .15) / -FOCUS_DIR.y : 8;
    p.uniforms.focus.value = focusState.override ?? Math.max(4, Math.min(24, t));
    p.uniforms.aspect.value = camera.aspect;
    render(...a);
  }, true);
  return p;
}
// 全屏演出叠加层：画在当前读缓冲上（GTAO/景深之后、泛光/调色之前），无叠加时零开销
class OverlayPass extends Pass {
  constructor() { super(); this.needsSwap = false; this.scene = null; this.camera = null; }
  render(renderer, writeBuffer, readBuffer) {
    if (!this.scene) return;
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.setRenderTarget(readBuffer); renderer.render(this.scene, this.camera); renderer.autoClear = ac;
  }
}
const DistortShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uStrength: { value: 0 }, uMode: { value: 0 }, uCenter: { value: new THREE.Vector2(.5, .5) }, uAspect: { value: 1.78 }, uP: { value: 0 } },
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uStrength,uMode,uAspect,uP;uniform vec2 uCenter;varying vec2 vUv;
    float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
    void main(){
      vec2 uv=vUv,d=vec2(0.);vec2 q=(uv-uCenter)*vec2(uAspect,1.);float r=length(q);
      if(uMode<1.5){d=vec2(vn(vec2(uv.x*14.,uv.y*8.-uTime*2.4))-.5,vn(vec2(uv.x*10.+9.,uv.y*7.-uTime*2.))-.5)*.016*(1.-uv.y*.5);}
      else if(uMode<2.5){d=normalize(q+1e-4)*sin(r*38.-uTime*5.)*.006+vec2(sin(uv.y*18.+uTime*2.),cos(uv.x*14.+uTime*1.7))*.004;}
      else if(uMode<3.5){vec2 g=uv*vec2(uAspect*3.,3.);vec2 ip=floor(g),fp=fract(g);float md=9.;vec2 mc=vec2(0.);for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 b=vec2(float(i),float(j));vec2 pt=vec2(h(ip+b),h(ip+b+vec2(5.3,1.7)));float dd=length(b+pt-fp);if(dd<md){md=dd;mc=ip+b;}}d=(vec2(h(mc),h(mc+7.))-.5)*.05*smoothstep(.0,.5,uP);}
      else if(uMode<4.5){float w=sin(r*26.-uTime*4.+uP*18.)*exp(-abs(r-uP*1.6)*3.);d=normalize(q+1e-4)*w*.02/vec2(uAspect,1.);}
      else {float n=vn(uv*7.+uTime*.3)-.5;float m=vn(uv*7.+19.-uTime*.3)-.5;d=vec2(n,m)*.03*smoothstep(0.,.6,uP);}
      d*=uStrength;
      vec4 c=texture2D(tDiffuse,uv+d);
      if(uMode>2.5&&uMode<3.5){c.r=texture2D(tDiffuse,uv+d*1.15).r;c.b=texture2D(tDiffuse,uv+d*.85).b;}
      gl_FragColor=c;
    }`
};const BUDGET = 1000 / 60, WINDOW = 40;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.setClearColor('#050506');

  let composer = null, bloom = null, gtao = null, bokeh = null, scene = null, camera = null, scale = 1, frame = 0, pinned = 0;
  const grade = new ShaderPass(GradeShader), overlay = new OverlayPass();
  const distort = new ShaderPass(DistortShader); distort.enabled = false; let renderPass = null, mainScene = null;

  function applySize() {
    const q = quality(), base = Math.min(devicePixelRatio || 1, Math.sqrt(q.pixels / Math.max(1, innerWidth * innerHeight)));
    const pr = Math.max(q.plain ? .18 : .3, base * scale);
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight, false);
    composer?.setPixelRatio(pr);
    composer?.setSize(innerWidth, innerHeight);
    view.h = innerHeight * pr; view.pr = pr; view.scale = scale;
  }
  function applyQuality(recompile) {
    const q = quality();
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.type = q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (bloom) bloom.enabled = q.bloom;
    if (gtao) gtao.enabled = !!q.ao;
    if (bokeh) bokeh.enabled = !!q.dof;
    scale = savedScale();
    tuner.reset();
    applySize();
    if (recompile) scene?.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  }

  const tuner = {
    samples: [], hold: 3, stable: 0, upWait: 30, probing: 0, slow: 0, crawl: 0,
    reset() { this.samples.length = 0; this.hold = 3; this.stable = 0; this.probing = 0; this.slow = 0; },
    setScale(v) { scale = Math.round(v * 100) / 100; saveScale(scale); applySize(); this.hold = 1; this.stable = 0; },
    push(ms) {
      if (document.hidden) { this.samples.length = 0; this.crawl = 0; return; }
      // 单帧超过 1/4 秒多半是编译着色器或切回窗口，不计入；但连续 6 帧都这么慢就是机器带不动（软件渲染约 3–5 帧/秒），直接落到极简档
      if (ms > 250) { this.samples.length = 0; if (++this.crawl >= 6 && !api.busy) { this.crawl = 0; floorQuality(); } return; }
      this.crawl = 0;
      this.samples.push(ms);
      if (this.samples.length < WINDOW) return;
      const s = this.samples.sort((a, b) => a - b), med = s[WINDOW >> 1];
      this.samples = [];
      if (this.hold > 0) { this.hold--; return; }
      const q = quality();
      if (med > BUDGET * 1.17) {
        if (this.probing) { this.probing = 0; this.upWait = Math.min(480, this.upWait * 2); }
        if (scale > q.minScale + .005) { this.slow = 0; this.setScale(Math.max(q.minScale, scale * (med > BUDGET * 1.55 ? .82 : .9))); }
        else if (++this.slow >= 3) { this.slow = 0; lowerQuality(); }
      } else {
        this.slow = 0;
        if (this.probing && --this.probing === 0) this.upWait = Math.max(30, this.upWait >> 1);
        if (scale < 1 && ++this.stable >= this.upWait) { this.setScale(Math.min(1, scale / .9)); this.probing = 4; }
      }
    }
  };

  const api = {
    renderer, hud: true, overlayOn: false,
    setOverlay(s, c) { overlay.scene = s; overlay.camera = c; },
    distort: distort.uniforms,
    // 把主渲染（含 GTAO/景深）临时切到另一个场景（绝技小场景）；传 null 恢复牌桌
    useScene(s, c) { const sc = s || scene, cm = c || camera; renderPass.scene = sc; renderPass.camera = cm; gtao.scene = sc; gtao.camera = cm; bokeh.scene = sc; bokeh.camera = cm; api.sceneSwapped = !!s; },
    attach(s, c) {
      scene = s; camera = c;
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
      mainScene = scene;
      renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
      gtao = makeGtao(scene, camera);
      composer.addPass(gtao);
      bokeh = makeBokeh(scene, camera);
      composer.addPass(bokeh);
      composer.addPass(overlay);
      composer.addPass(distort);
      bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), .32, .55, 1.05);
      const bloomSize = bloom.setSize.bind(bloom);
      bloom.setSize = (w, h) => bloomSize(Math.max(8, w * quality().bloomScale), Math.max(8, h * quality().bloomScale));
      composer.addPass(bloom);
      composer.addPass(grade);
      applyQuality(false);
    },
    get grade() { return grade.uniforms; },
    get scale() { return scale; },
    resize() {
      if (!camera) return;
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      applySize(); tuner.hold = 1;
    },
    tune(ms) { tuner.push(ms); },
    render(dt, t) {
      if (!composer) return;
      grade.uniforms.uTime.value = t;
      if (quality().plain && renderPass.scene) simplifyScene(renderPass.scene, frame);
      if (frame++ % quality().shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
      overlay.enabled = !!api.overlayOn; distort.enabled = distort.uniforms.uStrength.value > .001;
      distort.uniforms.uTime.value = t; distort.uniforms.uAspect.value = innerWidth / innerHeight;
      composer.render(dt);
      // HUD 标签（图层 1）在后期链之后单独绘制：不受景深/泛光/烟雾影响，始终清晰
      if (api.hud) {
        const mask = camera.layers.mask, ac = renderer.autoClear;
        camera.layers.set(1); renderer.autoClear = false; renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        camera.layers.mask = mask; renderer.autoClear = ac;
      }
      // Effects create and dispose materials constantly. Without this, three frees a shader program when its last
      // material is disposed and recompiles it on the next cast, which stalls the frame on every skill.
      const programs = renderer.info.programs;
      if (programs && programs.length !== pinned) { for (const p of programs) if (!p.gcPinned) { p.gcPinned = true; p.usedTimes++; } pinned = programs.length; }
    }
  };
  addEventListener('resize', () => api.resize());
  onQuality(q => { if (!q.plain) { restoreScene(mainScene); if (renderPass?.scene && renderPass.scene !== mainScene) restoreScene(renderPass.scene); } document.body.classList.toggle('plain-gfx', !!q.plain && q.name !== 'lite'); applyQuality(true); });
  return api;
}
