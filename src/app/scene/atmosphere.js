import * as THREE from 'three';
import { noiseTexture, coinTexture } from './textures.js';
import { quality, onQuality, view } from '../core/quality.js';
import { TABLE } from './table.js';

const END = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';

export function createAtmosphere(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const uTime = { value: 0 };

  const MAX = 420, pos = new Float32Array(MAX * 3), seed = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) { pos[i * 3] = (Math.random() - .5) * 13; pos[i * 3 + 1] = Math.random() * 6 - .6; pos[i * 3 + 2] = (Math.random() - .5) * 11 - .5; seed[i] = Math.random() * 100; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    uniforms: { uTime, uScale: { value: innerHeight } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed;uniform float uTime,uScale;varying float vA;
      void main(){vec3 p=position;float t=uTime*.07;
        p.x+=sin(t*1.3+aSeed)*.9+sin(t*3.1+aSeed*2.)*.2;p.y=mod(p.y+.6+t*(.5+fract(aSeed)*.8),6.6)-.6;p.z+=cos(t*1.1+aSeed*1.7)*.8;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        float lit=smoothstep(7.5,1.,length(p.xz-vec2(0.,-.3)))*smoothstep(6.,.2,p.y);
        vA=lit*(.35+.65*abs(sin(uTime*.9+aSeed*3.)));
        gl_PointSize=(1.2+fract(aSeed*7.)*2.4)*uScale/900.*(6./-mv.z);}`,
    fragmentShader: `varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.0,d)*vA;gl_FragColor=vec4(vec3(1.,.74,.48)*a*.9,a);${END}}`
  }));
  dust.frustumCulled = false; dust.userData.noPick = true;
  group.add(dust);

  const fogLayers = [];
  const fogMat = (speed, alpha, scale) => new THREE.ShaderMaterial({
    uniforms: { uTime, uNoise: { value: noiseTexture() }, uSpeed: { value: speed }, uAlpha: { value: alpha }, uScale: { value: scale }, uColor: { value: new THREE.Color('#25262a') } },
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: `uniform sampler2D uNoise;uniform float uTime,uSpeed,uAlpha,uScale;uniform vec3 uColor;varying vec2 vUv;varying vec3 vW;
      void main(){vec2 p=vW.xz*uScale;float n=texture2D(uNoise,p+vec2(uTime*uSpeed,uTime*uSpeed*.6)).r;float m=texture2D(uNoise,p*2.3-vec2(uTime*uSpeed*1.4,0.)).g;
        float f=smoothstep(.34,.82,n*.65+m*.35);float edge=smoothstep(.5,.2,length(vUv-.5));
        float lit=.55+1.2*smoothstep(13.,2.,length(vW.xz));
        gl_FragColor=vec4(uColor*lit,f*edge*uAlpha);${END}}`
  });
  const fogGeo = new THREE.PlaneGeometry(64, 64);
  [[TABLE.floorY + .35, .012, .3, .021], [TABLE.floorY + 1.1, -.009, .34, .03], [TABLE.floorY + 2.2, .016, .2, .017]].forEach(([y, speed, alpha, scale]) => {
    const m = new THREE.Mesh(fogGeo, fogMat(speed, alpha, scale));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = 2; m.userData.noPick = true;
    group.add(m); fogLayers.push(m);
  });

  const mist = new THREE.Mesh(new THREE.PlaneGeometry(11, 7.5), new THREE.ShaderMaterial({
    uniforms: { uTime, uNoise: { value: noiseTexture() }, uAlpha: { value: .05 }, uColor: { value: new THREE.Color('#7a808a') } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D uNoise;uniform float uTime,uAlpha;uniform vec3 uColor;varying vec2 vUv;
      void main(){float n=texture2D(uNoise,vUv*vec2(1.1,.8)+vec2(uTime*.011,uTime*.004)).r;float m=texture2D(uNoise,vUv*2.6-vec2(uTime*.02,0.)).g;
        float f=smoothstep(.42,.9,n*.7+m*.3);float e=smoothstep(.0,.2,vUv.x)*smoothstep(1.,.8,vUv.x)*smoothstep(.0,.25,vUv.y)*smoothstep(1.,.7,vUv.y);
        gl_FragColor=vec4(uColor*f*e*uAlpha,f*e*uAlpha);${END}}`
  }));
  mist.rotation.x = -Math.PI / 2; mist.position.set(0, .09, -.2); mist.renderOrder = 3; mist.userData.noPick = true;
  group.add(mist);

  const coins = [];
  const coinMat = new THREE.MeshStandardMaterial({ map: coinTexture(), transparent: true, alphaTest: .4, side: THREE.DoubleSide, roughness: .9, color: '#d8cfb6', emissive: '#40382c', emissiveIntensity: .5 });
  const coinGeo = new THREE.PlaneGeometry(.34, .34);
  function resetCoin(c, initial) {
    const side = Math.random() > .5 ? 1 : -1; c.position.set(side * (2.6 + Math.random() * 3.6), initial ? Math.random() * 9 - 2 : 7 + Math.random() * 3, -2.6 - Math.random() * 5);
    c.userData = { vy: .22 + Math.random() * .2, seed: Math.random() * 100, wait: initial ? 0 : Math.random() * 14, noPick: true };
  }
  for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(coinGeo, coinMat); resetCoin(c, true); group.add(c); coins.push(c); }

  function applyQuality() {
    const q = quality();
    dustGeo.setDrawRange(0, q.dust);
    fogLayers.forEach((m, i) => { m.visible = i < q.fog; });
    mist.visible = q.fog > 1;
  }
  applyQuality(); onQuality(applyQuality);

  function update(dt, t) {
    uTime.value = t;
    dust.material.uniforms.uScale.value = view.h;
    for (const c of coins) {
      const u = c.userData;
      if (u.wait > 0) { u.wait -= dt; continue; }
      c.position.y -= u.vy * dt;
      c.position.x += Math.sin(t * 1.3 + u.seed) * .12 * dt;
      c.rotation.set(Math.sin(t * 1.1 + u.seed) * 1.2, t * .7 + u.seed, Math.cos(t * .9 + u.seed) * .9);
      if (c.position.y < TABLE.floorY + .2) resetCoin(c, false);
    }
  }
  return { group, update, mist, uTime };
}
