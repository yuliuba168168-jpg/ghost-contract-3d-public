// 共享黑雾着色：浓处近黑、薄边深灰蓝、烛光/月光轮廓光。形态：figure(兜帽人影) column(烟柱) curtain(烟帘) dome(雾体单位团块)。
// 所有层在四边做衰减遮罩，任何变形下不露矩形边。
import * as THREE from 'three';
import { noiseTexture } from '../scene/textures.js';

export const SMOKE_VERT = `varying vec2 vUv;uniform float uHScale;
void main(){vUv=uv;
  vec3 wp=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
  float sc=length(modelMatrix[0].xyz);
  vec3 fwd=cameraPosition-wp;fwd.y=0.;fwd=normalize(fwd+vec3(1e-5,0.,0.));
  vec3 right=normalize(cross(vec3(0.,1.,0.),fwd));
  vec3 p=wp+right*position.x*sc+vec3(0.,position.y*sc*uHScale,0.)+fwd*position.z*sc;
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`;

export const SMOKE_FRAG = `uniform sampler2D uNoise;
uniform float uTime,uSeed,uDensity,uSwell,uShear,uSurge,uImplode,uTurb,uOpacity,uShape,uMood,uBlow,uSolid,uTop;
uniform vec3 uAxis;varying vec2 vUv;
float ns(vec2 p){return texture2D(uNoise,fract(p)).r;}
float fbm(vec2 p){return ns(p)*.45+ns(p*2.13+3.1)*.28+ns(p*4.31+9.4)*.17+ns(p*8.7+5.2)*.1;}
float fbm3(vec2 p){return ns(p)*.55+ns(p*2.4+1.7)*.3+ns(p*5.1+8.3)*.15;}
float mask(vec2 uv){return smoothstep(0.,.09,uv.x)*smoothstep(1.,.91,uv.x)*smoothstep(0.,.07,uv.y)*smoothstep(1.,.9,uv.y);}
void main(){
  vec2 p=vUv;float t=uTime;
  float sil=0.;
  if(uShape<.5){
    // 兜帽头肩：底(贴桌)→宽肩→颈→头→尖兜帽；uv.y=0 底
    float y=p.y;
    float hw=mix(.5,.34,smoothstep(.0,.4,y));
    hw=mix(hw,.3,smoothstep(.4,.55,y));
    hw=mix(hw,.13,smoothstep(.55,.66,y));
    float head=smoothstep(.16,.05,length((p-vec2(.5,.6))*vec2(1.3,.95)));
    float hood=smoothstep(.16,.04,abs(p.x-.5))*smoothstep(.78,.66,y)*smoothstep(.56,.68,y);
    hw*=1.+uSwell*.35;
    sil=smoothstep(hw,hw-.1,abs(p.x-.5));
    sil=max(sil,head);sil=max(sil,hood*.9);
    sil*=smoothstep(-.02,.14,y);
  }else if(uShape<1.5){
    // 烟柱：底部宽、顶部散开成丝
    float y=p.y;
    float hw=mix(.34,.1,smoothstep(.05,.8,y))+.06*fbm3(vec2(p.x*3.,y*2.-t*.1));
    sil=smoothstep(hw,hw-.12,abs(p.x-.5));
    sil*=smoothstep(-.02,.1,y)*(1.-smoothstep(.82,1.,y)*.5);
  }else if(uShape<2.5){
    // 烟帘：贴桌低墙，下浓上薄，上缘翻卷成丝
    float tp=uTop*(.8+.2*fbm3(vec2(p.x*3.+uSeed,t*.22)))+.05*uTop*sin(p.x*9.-t*.7+uSeed);
    sil=smoothstep(tp,tp*.12,p.y)*(.78+.22*fbm3(vec2(p.x*6.+uSeed,p.y*5.-t*.35)));
    sil*=smoothstep(.0,.12,p.x)*smoothstep(1.,.88,p.x);
  }else{
    // 雾体单位：圆头 + 向下渐宽的身体，单一连贯剪影
    vec2 hd=vec2((p.x-.5)/.263,(p.y-.692)/.192);
    float head=smoothstep(1.,.82,length(hd));
    float hw=mix(.368,.19,smoothstep(.04,.62,p.y));
    float bodyM=smoothstep(hw,hw-.08,abs(p.x-.5))*smoothstep(.72,.5,p.y);
    sil=max(head,bodyM);
    sil*=smoothstep(-.02,.05,p.y);
  }

  // 域扭曲 + 多层视差：近层快、远层慢、向上平流
  float turb=uTurb+uMood*.5;
  vec2 w1=vec2(fbm(p*1.3+vec2(0.,-t*.05)),fbm(p*1.3+vec2(5.,-t*.04)))-.5;
  vec2 q=p+w1*(.2+turb*.3)+vec2(uShear*.14*p.y*p.y,0.);
  float n1=fbm(q*vec2(1.4,1.9)+vec2(uShear*.1,-t*.07)+uSeed);
  float n2=fbm(q*vec2(3.0,4.0)+vec2(7.,-t*.14)-uSeed*1.3);
  float n3=fbm3(q*vec2(6.5,8.5)+vec2(3.,-t*.26)+uSeed*.7);
  float den=sil*smoothstep(.3,.72,n1*.62+n2*.3+n3*.18+p.y*.04);
  den*=1.-uImplode*smoothstep(.66,.3,p.y);
  // 吹散：噪声阈值整体右移（win/disperse）
  den*=smoothstep(uBlow*1.4-.05,uBlow*1.4+.35,n2*.7+n1*.5);
  den*=uDensity;
  // 整体剪影模式：核心区域强制不透明纯黑，噪声只侵蚀轮廓边缘
  float solidM=smoothstep(.28,.7,sil)*uSolid;
  den=mix(den,max(den,sil*uDensity),solidM);
  float a=clamp(den*1.5,0.,.99)*uOpacity*mask(vUv);
  if(a<.004)discard;
  // 着色：剪影=纯黑（薄丝也只是极暗灰蓝）；非剪影保留近黑烟体+克制轮廓光
  float e=.014;
  float dr=fbm(q*vec2(1.4,1.9)+vec2(uShear*.1+e*1.4,-t*.07)+uSeed)-n1;
  float du=fbm(q*vec2(1.4,1.9)+vec2(uShear*.1,-t*.07+e)+uSeed)-n1;
  float thin=clamp(1.-den*1.6,0.,1.);              // 稀薄程度
  vec3 col=mix(vec3(.016,.015,.02),vec3(.075,.08,.105),thin);   // 黑→深灰蓝
  float lit=clamp(-du*9.,0.,1.)*smoothstep(.55,.05,p.y);
  float rimL=clamp(-dr*8.,0.,1.)*smoothstep(.62,.3,p.x)*smoothstep(.95,.4,p.y);
  col+=vec3(.32,.19,.09)*lit*.5*(1.-uSolid);      // 烛暖
  col+=vec3(.16,.2,.28)*rimL*.5*(1.-uSolid);      // 月冷
  vec3 solidCol=mix(vec3(.003,.003,.004),vec3(.028,.032,.045),thin); // 纯黑体/暗丝
  col=mix(col,solidCol,uSolid);
  gl_FragColor=vec4(col,a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function smokeUniforms(extra = {}) {
  return Object.assign({
    uNoise: { value: noiseTexture() }, uTime: { value: 0 }, uSeed: { value: Math.random() * 40 },
    uDensity: { value: 1 }, uSwell: { value: 0 }, uShear: { value: 0 }, uSurge: { value: 0 },
    uImplode: { value: 0 }, uTurb: { value: .35 }, uOpacity: { value: 1 }, uShape: { value: 0 },
    uMood: { value: 0 }, uBlow: { value: 0 }, uSolid: { value: 0 }, uHScale: { value: 1 }, uTop: { value: .6 }, uAxis: { value: new THREE.Vector3() }
  }, extra);
}

let smokeGeo = null;
export function smokeGeoQuad() { smokeGeo ||= (() => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, .5, 0); return g; })(); return smokeGeo; }

export function createSmokeMesh({ w = 1, h = 1, shape = 0, seed, renderOrder = 3, solid = 0, aspect = 1 } = {}) {
  const uniforms = smokeUniforms();
  if (seed != null) uniforms.uSeed.value = seed;
  uniforms.uShape.value = shape;
  uniforms.uSolid.value = solid; uniforms.uHScale.value = aspect;
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(smokeGeoQuad(), mat);
  mesh.scale.set(w, h, 1); mesh.userData.noPick = true; mesh.renderOrder = renderOrder;
  return { mesh, material: mat, uniforms };
}
