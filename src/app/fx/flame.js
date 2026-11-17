// 共享程序化火焰：烛焰 / 鬼火 / 火焰之眼，同一 program，差异全走 uniform。
import * as THREE from 'three';
import { noiseTexture } from '../scene/textures.js';
import { mulberry, damp } from '../core/tween.js';

const flames = new Set(), eyes = new Set();
const uTime = { value: 0 };

const VERT = `uniform float uLean,uSlant;varying vec2 vUv;
void main(){vUv=uv;
  vec3 wp=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
  float sx=length(modelMatrix[0].xyz),sy=length(modelMatrix[1].xyz);
  vec3 fwd=cameraPosition-wp;fwd.y=0.;fwd=normalize(fwd+vec3(1e-5,0.,0.));
  vec3 right=normalize(cross(vec3(0.,1.,0.),fwd));
  vec2 q=position.xy*vec2(sx,sy);
  float ca=cos(uSlant),sa=sin(uSlant);
  q=vec2(q.x*ca-q.y*sa,q.x*sa+q.y*ca);
  vec3 p=wp+right*q.x+vec3(0.,q.y,0.);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`;

const FRAG = `uniform float uTime,uSeed,uIntensity,uEye,uShape,uLean,uGust,uLid,uSmile,uWide,uOpacity,uSide;
uniform vec2 uLook;uniform vec3 uColor,uCore;varying vec2 vUv;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
void main(){
  float t=uTime;
  float flick=.86+.14*sin(t*11.+uSeed)*sin(t*3.7+uSeed*1.3)+uGust*.3*sin(t*23.+uSeed);
  vec3 col;float alpha;
  if(uEye<.5){
    float y=vUv.y;
    float x=(vUv.x-.5)*2.;
    vec2 q=vec2(x*1.4+uSeed,y*1.6-t*(.9+uGust*.9));
    float n=fbm(q);
    float n2=vn(vec2(x*2.+uSeed,y*2.4-t*.6));
    x+=(n-.5)*(.9+uShape*1.4)*y+uLean*y*y*2.2+(.06*sin(t*2.3+uSeed)+.04*sin(t*5.1))*y*y;
    float hw=mix(mix(.55,.05,pow(y,.9)),.46*(1.-y*.35)+.1*n2,uShape);
    float body=smoothstep(hw,hw-.28,abs(x))*smoothstep(0.,.06,y);
    body*=1.-smoothstep(.7,1.,y+(n-.5)*(.22+uShape*.4));
    body=mix(body,max(body,smoothstep(.5,.1,length(vec2(x,(y-.5-n*.2)*1.5)))*.85),uShape*.55);
    float heat=body*(1.-y*.5);
    col=mix(uColor,uCore,smoothstep(.45,.92,heat));
    col=mix(col,vec3(.16,.04,.02),smoothstep(.72,1.,y)*(1.-heat));
    float blue=(1.-uShape)*smoothstep(.26,.0,y)*smoothstep(.45,.0,abs(x))*body;
    col=mix(col,vec3(.18,.36,1.),blue*.85);
    alpha=body*uIntensity*flick*uOpacity;
  }else{
    vec2 p=vec2((vUv.x-.5)*3.4,(vUv.y-.5)*2.2);
    float x=p.x,lid=clamp(uLid,0.,1.);
    float ax=clamp(abs(x),0.,1.);
    float bend=uSmile*(1.-ax*ax)*.55;
    float h=(.36+uWide*.34)*(1.-.6*uSmile)*(1.-lid);
    float arc=h*pow(max(1.-ax*ax,0.),.75);
    float inEdge=smoothstep(1.02,.94,abs(x));
    float c=p.y-bend;
    float sd=abs(c)-arc;
    float inside=smoothstep(.035,-.035,sd)*inEdge;
    float depthN=clamp(1.-abs(c)/max(arc,.001),0.,1.);
    float fn=fbm(vec2(x*1.5+uSeed,p.y*2.3-t*1.5));
    float fn2=fbm(vec2(x*3.2-uSeed,p.y*4.2-t*2.6));
    float heat=clamp(depthN*(.85-.3*ax)+(fn-.5)*1.5+(fn2-.5)*.6,0.,1.);
    vec3 orange=uColor*.5,yellow=mix(uColor,vec3(1.,.6,.14),.75);
    vec3 fire=mix(orange,yellow,smoothstep(.2,.6,heat));
    fire=mix(fire,uCore,smoothstep(.62,.95,heat));
    float rim=exp(-sd*sd*900.)*inEdge*(1.-lid);
    vec3 ec=fire*(.25+1.0*heat)*inside+uColor*rim*.55;
    float a=inside*(.4+.6*heat)+rim*.5;
    // 舌：从上缘与外眼角舔出
    float topE=bend+arc;
    float dy=p.y-topE;
    float len=(.34+.7*vn(vec2(x*1.8+t*.8+uSeed,t*.9)))*(1.+.9*smoothstep(.15,1.,x*uSide)+uWide*1.3)*(1.-lid);
    float sw=sin(t*5.+dy*7.+uSeed)*.08*dy;
    float xs=x+sw;
    float colH=vn(vec2(xs*3.4+uSeed,t*.9))*.65+vn(vec2(xs*7.+uSeed,t*1.7+3.))*.35;
    float hgt=max(len,.01)*smoothstep(.28,.78,colH);
    float tong=smoothstep(0.,.05,dy)*(1.-smoothstep(hgt*.45,hgt,dy))*smoothstep(1.1,.55,abs(x))*(.6+.4*vn(vec2(xs*5.+uSeed,dy*3.-t*3.4)));
    vec3 tc=mix(uColor*.9,yellow,smoothstep(.1,.9,1.-dy/max(hgt,.02)))*.95;
    ec+=tc*tong;a+=tong*.9;
    // 竖瞳
    vec2 pp=p-vec2(uLook.x*.3,uLook.y*.1+bend*.3);
    float pupil=smoothstep(.1,.035,abs(pp.x)*(1.+abs(pp.y)*1.6))*smoothstep(arc*1.05,arc*.55,abs(pp.y))*(1.-lid);
    ec*=1.-pupil*.92;a=max(a*(1.-pupil*.8),rim*.5);
    float ember=smoothstep(.1,.0,abs(c))*lid*.35*inEdge;
    ec+=uColor*ember;a+=ember;
    col=ec*1.7;
    alpha=clamp(a,0.,1.)*uIntensity*flick*uOpacity*smoothstep(1.1,.9,abs(p.y))*inEdge;
  }
  if(alpha<.004)discard;
  gl_FragColor=vec4(col,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function makeMat() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: noiseTexture() }, uTime, uSeed: { value: Math.random() * 40 },
      uIntensity: { value: 1 }, uEye: { value: 0 }, uShape: { value: 0 }, uLean: { value: 0 }, uGust: { value: 0 },
      uLid: { value: 0 }, uSmile: { value: 0 }, uWide: { value: 0 }, uLook: { value: new THREE.Vector2() },
      uSlant: { value: 0 }, uSide: { value: 1 }, uColor: { value: new THREE.Color('#ffb066') }, uCore: { value: new THREE.Color('#fff4d6') },
      uOpacity: { value: 1 }
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
}
let quadGeo = null;
function quad() { quadGeo ||= (() => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, .5, 0); return g; })(); return quadGeo; }
const eyeGeo = () => { const g = new THREE.PlaneGeometry(1, 1); return g; };

export function createFlame({ color = '#ffb066', core = '#fff4d6', width = .12, height = .3, shape = 'candle', seed } = {}) {
  const m = makeMat(), u = m.uniforms;
  u.uColor.value.set(color); u.uCore.value.set(core); u.uShape.value = shape === 'wisp' ? 1 : 0;
  if (seed != null) u.uSeed.value = seed;
  const mesh = new THREE.Mesh(quad(), m);
  mesh.scale.set(width * 2, height, 1); mesh.userData.noPick = true; mesh.renderOrder = 8;
  flames.add(mesh);
  return {
    mesh, material: m,
    set({ color: c, core: k, intensity, lean, gust } = {}) {
      if (c !== undefined) u.uColor.value.set(c);
      if (k !== undefined) u.uCore.value.set(k);
      if (intensity !== undefined) u.uIntensity.value = intensity;
      if (lean !== undefined) u.uLean.value = lean;
      if (gust !== undefined) u.uGust.value = gust;
    },
    dispose() { flames.delete(mesh); mesh.removeFromParent(); /* 材质不销毁，保 program */ }
  };
}

export function createEyePair({ color = '#b3120c', size = .42, gap = .62, slant = .14 } = {}) {
  const group = new THREE.Group();
  const geo = eyeGeo(), meshes = [];
  for (const sd of [-1, 1]) {
    const mm = makeMat(); mm.uniforms.uEye.value = 1;
    mm.uniforms.uColor.value.set(color); mm.uniforms.uCore.value.set('#ffd9a8');
    mm.uniforms.uSlant.value = -sd * slant; mm.uniforms.uSide.value = sd; mm.uniforms.uSeed.value += sd * 3.7;
    const e = new THREE.Mesh(geo, mm);
    e.position.x = sd * gap * size * .5; e.scale.set(size * 1.7, size * 1.1, 1);
    e.userData.noPick = true; e.renderOrder = 9;
    group.add(e); meshes.push(e);
  }
  const grp = {
    group, meshes,
    mats: meshes.map(e => e.material),
    tx: 0, ty: 0, lx: 0, ly: 0, blinkT: 2 + Math.random() * 3, blinkPhase: 0, frozen: false,
    sacT: 1, jit: new THREE.Vector2(),
    setColor(hex) { for (const m of grp.mats) m.uniforms.uColor.value.set(hex); },
    setIntensity(v) { for (const m of grp.mats) m.uniforms.uIntensity.value = v; },
    setLid(v) { for (const m of grp.mats) m.uniforms.uLid.value = v; },
    getLid() { return grp.mats[0].uniforms.uLid.value; },
    setSmile(v) { for (const m of grp.mats) m.uniforms.uSmile.value = v; },
    setWide(v) { for (const m of grp.mats) m.uniforms.uWide.value = v; },
    look(x, y) { grp.tx = Math.max(-1, Math.min(1, x)); grp.ty = Math.max(-1, Math.min(1, y)); },
    blink() { if (!grp.frozen && grp.blinkPhase <= 0) grp.blinkPhase = .001; },
    get blinking() { return grp.blinkPhase > 0; },
    freezeBlink(v) { grp.frozen = v; },
    dispose() { eyes.delete(grp); group.removeFromParent(); },
    update(dt, t) {
      // 平滑注视 + 微眼跳
      grp.sacT -= dt;
      if (grp.sacT <= 0) { grp.sacT = .8 + Math.random() * 1.7; grp.jit.set((Math.random() - .5) * .3, (Math.random() - .5) * .2); }
      grp.lx = damp(grp.lx, grp.tx + grp.jit.x, 7, dt); grp.ly = damp(grp.ly, grp.ty + grp.jit.y, 7, dt);
      for (const m of grp.mats) m.uniforms.uLook.value.set(grp.lx, grp.ly);
      // 自然眨眼：2.2–6.5s 随机间隔，~20% 双眨
      if (!grp.frozen) {
        if (grp.blinkPhase > 0) {
          grp.blinkPhase += dt;
          const ph = grp.blinkPhase;
          let lid;
          if (ph < .09) lid = ph / .09;                  // 闭 90ms
          else if (ph < .13) lid = 1;                    // 保持 40ms
          else if (ph < .29) lid = 1 - (ph - .13) / .16; // 开 160ms
          else {
            grp.blinkPhase = 0;
            if (grp.dbl) { grp.dbl = false; grp.blinkPhase = .001; lid = 1; }
            else lid = 0;
          }
          grp.setLid(lid);
        } else {
          grp.blinkT -= dt;
          if (grp.blinkT <= 0) { grp.blinkT = 2.2 + Math.random() * 4.3; grp.blinkPhase = .001; if (Math.random() < .2) grp.dbl = true; }
        }
      }
    }
  };
  eyes.add(grp);
  return grp;
}

export function updateFlames(dt, t, camera) {
  uTime.value = t;
  for (const e of eyes) e.update(dt, t);
}
