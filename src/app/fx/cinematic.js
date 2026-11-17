// 全屏技能演出：独立正交叠加场景，作为后期链的一遍（GTAO/景深之后、泛光/调色之前）。
// 四级：1 快闪窄带 / 2 斜切画幅 / 3 全幕 / 4 绝技（7 个专属场面）。
import * as THREE from 'three';
import { makeCanvas, canvasTexture, FONT } from '../scene/textures.js';
import { createEyePair } from './flame.js';
import { viewImage, artImage } from '../core/assets.js';
import { tween, speed, mulberry } from '../core/tween.js';
import { play as sfx, duck } from '../core/audio.js';
import { TIER_DUR, SPECIAL, motifIndex } from './skill-tier.js';
import { themeColor } from './skill-fx.js';
import { drawSkillFace, CW, CH } from '../cards/card-face.js';
import { buildCineScenes } from './cine-scenes.js';
import { focusState } from '../core/renderer.js';

const MODES = ['full', 'smart', 'table'];
const MODE_NAME = { full: '全屏 + 牌桌', smart: '精简', table: '仅牌桌' };

const COMMON = `
uniform float uTime,uP,uTier,uAspect;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
float spk(vec2 g,float th){return step(th,h21(floor(g)))*smoothstep(.5,.08,length(fract(g)-.5));}
float cineMask(vec2 p){
  if(uTier<1.5){vec2 n=normalize(vec2(.45,1.));float c=mix(-2.0,2.0,uP);return smoothstep(.12,.095,abs(dot(p,n)-c));}
  if(uTier<2.5){vec2 n=normalize(vec2(-.25,1.));float g=smoothstep(0.,.16,uP)*(1.-smoothstep(.86,1.,uP));float hh=.46*g;return smoothstep(hh,hh-.015,abs(dot(p,n)));}
  return 1.;
}`;
const VERT = 'varying vec2 vUv;varying vec2 vP;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vP=w.xy;gl_Position=projectionMatrix*viewMatrix*w;}';

const BG_FRAG = `${COMMON}
uniform float uMotif,uSpecial,uDark,uFlash,uAlpha,uCalm;uniform vec3 uA,uB,uC;varying vec2 vUv;varying vec2 vP;
vec3 motif(vec2 p,float t,float id){
  vec3 col=uA*.15;
  if(id<.5){float f=fbm(vec2(p.x*1.4,p.y*1.1-t*1.1)+vec2(0.,fbm(p*2.-t*.4)*1.2));float fl=smoothstep(.15,.85,f+.55-(p.y+1.)*.35);
    col=mix(uA*.25,mix(uB,uC,smoothstep(.55,1.,fl)),fl);col+=uC*spk(vec2(p.x*40.,(p.y-t*.8)*40.),.985)*1.4;}
  else if(id<1.5){float s=fbm(p*vec2(2.,3.)+3.);float cr=abs(fract(dot(p,vec2(.7,1.2))*3.+s*2.)-.5);
    float fa=smoothstep(.03,.0,cr)+smoothstep(.04,.0,abs(fract(dot(p,vec2(-1.,.5))*2.5+s)-.5));
    col=mix(uA*.3,uB,smoothstep(.3,.8,s))+uC*fa*.9+uC*pow(max(0.,sin(t*2.+p.x*4.)),8.)*.15;}
  else if(id<2.5){vec2 c=vec2(sin(t*.3)*.4,cos(t*.25)*.2);float r=length(p-c);float w=sin(r*16.-t*3.+fbm(p*3.+t*.2)*5.);
    float caus=pow(abs(sin(p.x*7.+fbm(p*4.+t*.3)*6.)*sin(p.y*7.+fbm(p*4.-t*.3)*6.)),.4);col=mix(uA*.35,uB,.5+.5*w)+uC*caus*.4*(1.-p.y*.3);}
  else if(id<3.5){vec2 q=p*1.3;q+=vec2(fbm(q+t*.1),fbm(q*1.3-t*.12))*1.2;float d=fbm(q*1.5);col=mix(uC*.9,uA*.1,smoothstep(.38,.62,d));col=mix(col,uB*.5,smoothstep(.62,.8,d)*.5);}
  else if(id<4.5){float r=length(p),a=atan(p.y,p.x);float ring=smoothstep(.012,.0,abs(r-.75))+smoothstep(.01,.0,abs(r-1.05))*.6;
    float tick=step(.86,fract(a*12./6.2832))*smoothstep(.06,.0,abs(r-.9));
    float hand=smoothstep(.012,.0,abs(sin(a-t*1.2))*r)*step(r,.7)*step(0.,cos(a-t*1.2));float hand2=smoothstep(.01,.0,abs(sin(a+t*.2))*r)*step(r,.5)*step(0.,cos(a+t*.2));
    col=mix(uA*.2,uB,fbm(p*2.+t*.1)*.5)+uC*(ring+tick+hand+hand2)+uB*.2*smoothstep(.2,.0,abs(r-.4));}
  else if(id<5.5){vec2 g=p*2.2;vec2 ip=floor(g),fp=fract(g);float md=9.,m2=9.;vec2 mc=vec2(0.);for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 b=vec2(float(i),float(j));vec2 pt=vec2(h21(ip+b),h21(ip+b+vec2(5.3,1.7)));float dd=length(b+pt-fp);if(dd<md){m2=md;md=dd;mc=ip+b;}else if(dd<m2)m2=dd;}
    float edge=smoothstep(.07,.0,m2-md);vec3 shard=mix(uA*.4,uB,h21(mc))*(.45+.55*fbm(p*3.+h21(mc)*9.+t*.1*h21(mc+2.)));
    col=shard*.85+uC*edge*1.3+uC*pow(max(0.,sin(t*2.+h21(mc)*6.)),10.)*.3;}
  else if(id<6.5){vec2 c=vec2(.0,-.15);float r=length(p-c);float disc=smoothstep(.62,.6,r);float cr=fbm((p-c)*5.+1.);
    col=uA*.1+uC*disc*(.65+.5*cr)+uB*smoothstep(1.3,.5,r)*.5;col+=uC*spk(p*vec2(60.,40.)+17.,.992)*(.5+.5*sin(t*3.+p.x*9.))*(1.-disc);}
  else if(id<7.5){float c1=smoothstep(.0,.06,abs(fract(p.x*2.2)-.5)-.38);float fog=fbm(vec2(p.x*1.5+t*.1,p.y*2.+t*.2));
    float fl=smoothstep(.55,.9,fbm(vec2(p.x*5.,p.y*5.-t*1.5)))*smoothstep(.4,-1.,p.y);col=uA*.18+uB*fog*.45*smoothstep(.6,-.8,p.y)+uC*fl+uA*c1*.15;}
  else if(id<8.5){vec2 g=p*3.+vec2(t*.2,t*.3);vec2 cid=floor(g),f=fract(g)-.5;float ph=h21(cid)*6.28;float flap=abs(sin(t*4.+ph));
    vec2 q=vec2(abs(f.x),f.y);float wing=smoothstep(.25,.2,length((q-vec2(.18*flap+.02,.0))*vec2(1.,1.5)))*step(.4,h21(cid+3.));
    col=mix(uA*.25,uB,fbm(p*2.+t*.1)*.6)+uC*wing*(.6+.4*h21(cid+7.));}
  else if(id<9.5){float ay=abs(p.y);float lid=.42*(1.-pow(abs(p.x)/1.3,2.));float inside=step(ay,lid)*step(abs(p.x),1.3);float r=length(p);
    float iris=smoothstep(.3,.28,r),pupil=smoothstep(.1,.08,abs(p.x))*smoothstep(.3,.1,ay);
    col=uA*.12+inside*(uB*.4+uC*iris*(.5+.5*fbm(vec2(atan(p.y,p.x)*3.,r*6.-t))))*(1.-pupil*.9)+uB*smoothstep(.06,.0,abs(ay-lid))*step(abs(p.x),1.3);}
  else {float a=atan(p.y,p.x),r=length(p);float rays=pow(.5+.5*sin(a*14.+t*.4+fbm(vec2(a*2.,t*.2))*3.),3.);
    float halo=smoothstep(.04,.0,abs(r-.7-.05*sin(t)))+smoothstep(.03,.0,abs(r-1.))*.5;
    col=uA*.2+uB*rays*smoothstep(1.8,.2,r)*.8+uC*halo+uC*spk(vec2(p.x*30.,(p.y-t*.6)*30.),.99)*1.2;}
  if(id<.5){float fa=smoothstep(.02,.0,abs(fract(length(p-vec2(0.,-.6))*4.-t*.3)-.5)-.44)*smoothstep(-.9,.3,p.y);col+=uC*fa*.3;}
  else if(id<1.5){float aa=atan(p.y+.9,p.x),sr=length(vec2(p.x,p.y+.9));col+=uC*smoothstep(.02,.0,sr-(.4+.7*pow(abs(sin(aa*7.)),6.)))*.5;}
  else if(id<3.5&&id>2.5){float rd=fbm(vec2(p.x*1.6+2.,1.))*.7-.55;col=mix(col,uA*.05,smoothstep(.01,.0,p.y-rd)*.8);}
  return col;
}
vec4 despair(vec2 p,float t,float P){
  float r=length(p);float cracks=smoothstep(.2,.6,P);float drain=smoothstep(.0,.5,P)*smoothstep(.1,1.4,r*1.1-.1);
  float cr=0.;for(int k=0;k<2;k++){vec2 q=p*(1.6+float(k)*1.2)+fbm(p*3.+float(k))*.6;float l=min(abs(fract(q.x+q.y*.5)-.5),abs(fract(q.y*1.3+q.x*.4)-.5));cr+=smoothstep(.007,.0,l)*step(h21(floor(q)+float(k)),cracks*.4);}
  vec4 o=vec4(vec3(.5)*(1.-min(1.,cr*cracks*.6)),clamp(drain*.62+cr*.32*cracks,0.,1.));
  float hn=fbm(p*4.+3.)+(vn(p*38.)-.5)*.08;float hole=step(hn,(P-.5)*.9)*step(.5,P)*smoothstep(.3,1.,r);float hedge=smoothstep(.04,.0,abs(hn-(P-.5)*.9))*step(.5,P)*smoothstep(.3,1.,r);o=vec4(mix(o.rgb,vec3(0.),hole),max(o.a,hole));
  float hd=smoothstep(.06,.05,length(p-vec2(0.,-.02)));float body=smoothstep(.1,.085,length((p-vec2(0.,-.17))*vec2(1.,.6)));float sil=0.;
  float lamp=0.;
  o=vec4(mix(o.rgb,vec3(.01),max(sil,lamp)),max(o.a,max(sil,lamp)));
  o=vec4(mix(o.rgb,vec3(.75,.72,.66),hedge*.5),max(o.a,hedge*.5));float fadeOut=1.-smoothstep(.93,1.,P);o.a*=fadeOut;return o;
}
vec3 special(vec2 p,float t,float sp,float P){
  vec3 col=vec3(0.);
  if(sp<1.5){ // 绝望：颜色被抽走，旧照片裂纹剥落，只剩孩子背影与熄灯
    float cracks=smoothstep(.2,.6,P);float g=(.25+.5*fbm(p*2.+1.))*(1.-smoothstep(.3,1.6,length(p)*.9));
    vec3 warm=vec3(.55,.42,.3)*g;vec3 gray=vec3(g*.9);col=mix(warm,gray,smoothstep(.0,.35,P));
    float cr=0.;for(int k=0;k<3;k++){vec2 q=p*(3.+float(k)*2.1)+fbm(p*3.+float(k))*.6;float l=min(abs(fract(q.x+q.y*.5)-.5),abs(fract(q.y*1.3+q.x*.4)-.5));cr+=smoothstep(.02,.0,l)*step(h21(floor(q)+float(k)),cracks*.9);}
    col-=cr*.35*cracks;
    float hole=step(fbm(p*4.+3.),(P-.5)*.9)*step(.5,P);col=mix(col,vec3(.015),hole*smoothstep(.2,1.,length(p)));
    float hd=smoothstep(.075,.065,length(p-vec2(0.,.02)));float body=smoothstep(.12,.1,length((p-vec2(0.,-.14))*vec2(1.,.62)));
    float sil=0.;col=mix(col,vec3(.01),sil);
    float lamp=step(abs(p.x-.3),.018)*step(abs(p.y+.18),.05)+step(abs(p.x-.3),.03)*step(abs(p.y+.24),.012);col=mix(col,vec3(.3),lamp*smoothstep(.5,.75,P));
    col*=1.-.4*smoothstep(.0,.2,P)*smoothstep(.5,1.5,length(p));
  } else if(sp<2.5){ // 鬼主权杖
    float fall=smoothstep(.16,.5,P);fall=fall*fall*(3.-2.*fall);float ry=mix(1.7,-.25,fall);
    float rod=step(ry,p.y)*step(p.y,ry+1.9)*smoothstep(.03,.018,abs(p.x));float hd=smoothstep(.1,.07,length((p-vec2(0.,ry))*vec2(1.,.8)));
    float glow=exp(-length(p-vec2(0.,ry))*5.)*smoothstep(.1,.45,P);float land=smoothstep(.48,.56,P);
    float r=length(p*vec2(1.,2.2)-vec2(0.,-.5)),a=atan(p.y*2.2+.5,p.x);float rn=0.;
    for(int k=0;k<3;k++){float rr=.35+.3*float(k);float rw=smoothstep(.012,.0,abs(r-rr*land));float rune=step(.45,fract(a*(10.+float(k)*6.)/6.2832+t*.15*float(k+1)))*smoothstep(.07,.0,abs(r-rr*land+.05));rn+=rw+rune*.8;}
    float beam=smoothstep(.09,.0,abs(p.x))*smoothstep(.8,.88,P)*(.8+.5*fbm(vec2(p.y*3.,t*6.)));
    col=uA*.03+uC*(rod*.6+hd)+uB*(glow+rn*land*.9)+vec3(.6,1.,.75)*beam*1.4;
  } else if(sp<3.5){ // 太阴之力
    float rise=smoothstep(.06,.62,P);rise=rise*rise*(3.-2.*rise);vec2 c=vec2(0.,mix(-2.1,-.15,rise));vec2 q=p-c;float r=length(q);
    float disc=smoothstep(1.18,1.165,r);float cr=fbm(q*4.+1.);float crt=0.;for(int k=0;k<4;k++){vec2 cc=vec2(h21(vec2(float(k),1.))-.5,h21(vec2(float(k),2.))-.5)*1.4;crt+=smoothstep(.02,.0,abs(length(q-cc)-.14-.05*float(k)))*.5;}
    vec3 moon=mix(vec3(.5,.58,.74),vec3(.95,.97,1.),cr)-crt*.2;
    float flood=smoothstep(.3,.9,P)*(.5+.5*sin(p.y*12.-t*2.+fbm(p*2.)*3.))*smoothstep(-1.2,.8,p.y+.6);
    float stars=spk(p*vec2(70.,45.),1.-.03*smoothstep(.3,1.,P))*(.4+.6*sin(t*3.+h21(floor(p*vec2(70.,45.)))*30.));
    col=vec3(.006,.012,.03)+moon*disc*.62+uB*smoothstep(1.9,1.1,r)*.28*(1.-disc)+uB*flood*.35+vec3(.8,.9,1.)*stars*(1.-disc)*.8;
  } else if(sp<4.5){ // 轮回
    float spin=t*(.4+P*P*5.);float a=atan(p.y,p.x)-spin;float r=length(p);
    float spokes=smoothstep(.05,.0,abs(fract(a*6./6.2832+.5)-.5))*smoothstep(1.3,.2,r)*step(.2,r);
    float rim=smoothstep(.02,.0,abs(r-1.))+smoothstep(.02,.0,abs(r-.85))*.7+smoothstep(.02,.0,abs(r-.22));
    float flow=pow(.5+.5*sin(a*18.-r*10.+t*3.),4.)*smoothstep(.78,.92,r)*smoothstep(1.05,.95,r);
    float bloom=smoothstep(.42,.75,P);float pr=bloom*.8*abs(cos(atan(p.y,p.x)*4.+spin*.3))+.08;float petals=smoothstep(.02,.0,abs(r-pr))+smoothstep(pr,pr-.04,r)*.25*bloom;
    float rip=smoothstep(.78,1.,P)*(.5+.5*sin(r*30.-P*60.));float white=smoothstep(.86,1.,P);
    col=uA*.06+uC*(spokes*.8+rim)+uB*flow*.8+uC*petals*bloom*.9+uB*rip*.4*smoothstep(1.4,.2,r);col=mix(col,vec3(1.),white*.85);
  } else if(sp<5.5){ // 鬼门关降临
    float rise=smoothstep(.0,.38,P);rise=rise*rise*(3.-2.*rise);float open=smoothstep(.46,.66,P);vec2 q=p+vec2(0.,mix(-1.8,0.,rise));
    float ax=abs(q.x);float gap=open*.85;float door=step(gap,ax)*step(ax,gap+.95)*step(abs(q.y),1.15);
    float metal=.25+.35*fbm(q*6.+1.);vec2 st=fract(vec2((ax-gap)*5.,q.y*5.))-.5;float stud=smoothstep(.11,.07,length(st))*door;float seam=smoothstep(.012,.0,abs(fract((ax-gap)*2.6)-.5)-.47)*door;
    float ring=smoothstep(.015,.0,abs(length(vec2(ax-gap-.5,q.y+.1))-.15))*door;
    vec3 bronze=vec3(.32,.22,.12)*metal*(1.+stud*1.4)*(1.-seam*.6)+uC*ring*.35;
    float light=step(ax,gap)*step(abs(q.y),1.15)*(.25+.45*fbm(vec2(q.x*3.,q.y*2.-t)));
    float cell=floor(q.x*7.);vec2 lc=vec2(fract(q.x*7.)-.5,q.y*7.-floor(q.y*7.));float hh=-.1+.5*h21(vec2(cell,3.))*smoothstep(.55,.95,P);float by=q.y-hh;float sil=(step(abs(lc.x),.17)*step(by,0.)*step(-.9,by)+smoothstep(.1,.08,length(vec2(lc.x*1.,by*3.+.0)-vec2(0.,.12))))*step(ax,gap)*smoothstep(.55,.9,P);
    col=uA*.03+bronze*door+uC*light*(1.-sil*.95)+uB*smoothstep(1.2,-1.,p.y)*.15*open;col*=1.+.5*sin(t*30.)*0.;
  } else if(sp<6.5){ // 女王领域
    float rr=length(p-vec2(0.,-.5));float arch=smoothstep(.012,.0,abs(rr-.8))*step(-.5,p.y)+smoothstep(.012,.0,abs(rr-.55))*step(-.5,p.y)*.7;
    float pill=smoothstep(.012,.0,abs(abs(p.x)-.8))*step(p.y,-.5)*step(-1.,p.y)+smoothstep(.012,.0,abs(abs(p.x)-.55))*step(p.y,-.5)*.7;
    float crown=smoothstep(.015,.0,abs(p.y-.55-.1*sin(p.x*18.)))*step(abs(p.x),.5);
    float build=smoothstep(.04,.34,P);float gv=length(vec2(p.x,(p.y+.9)*2.6));float ground=smoothstep(.02,.0,abs(fract(gv*3.-t*.4*P)-.5)-.44)*step(p.y,-.35)*smoothstep(.22,.5,P);
    float px=mix(-2.4,2.4,smoothstep(.45,.78,P));float cy=.35+.25*sin(p.x*3.);float tr=smoothstep(.07,.0,abs(p.y-cy))*smoothstep(px-1.,px,p.x)*step(p.x,px);
    float press=pow(fbm(vec2(p.x*20.,p.y*2.+t*7.)),3.)*smoothstep(.55,.9,P)*.5;
    col=uA*.03+uC*(arch+pill+crown)*build+uB*ground*.8+uC*tr*1.6+uB*press+uC*exp(-length(p-vec2(0.,.2))*2.)*.25*build;
  } else { // 半完全火焰规律
    float spark=exp(-length(p)*30.)*(1.+.5*sin(t*40.))*smoothstep(.0,.05,P)*(1.-smoothstep(.2,.3,P));
    float r=length(p),a=atan(p.y,p.x);float ig=smoothstep(.14,.42,P);float rg=smoothstep(.014,.0,abs(r-.7))*step(a/6.2832+.5,ig);
    float rn=step(.55,fract(a*12./6.2832))*smoothstep(.07,.0,abs(r-.62))*step(a/6.2832+.5,ig);
    float st=smoothstep(.4,.55,P)*(1.-smoothstep(.82,.9,P));vec2 sw=vec2(a*1.2+t*.8,r*3.-t*2.);float f=fbm(sw+vec2(0.,fbm(sw*1.7)*1.6));
    float wing=abs(p.x)*1.1-abs(p.y-.1)*.3;float fire=smoothstep(.25,.9,f+(1.15-r)*.7+wing*.15)*st;
    float ash=spk(vec2(p.x*45.+t*5.,(p.y-t*1.2)*45.),.985)*st;
    float line=smoothstep(.012,.0,abs(p.y))*smoothstep(1.7,.0,abs(p.x))*smoothstep(.86,.93,P);
    col=uC*spark*3.+uB*(rg+rn)*1.4+mix(uB,uC,fire)*fire*2.+uC*ash*1.5+vec3(1.,.95,.85)*line*2.5;
  }
  return col;
}
void main(){
  vec2 p=vP;float t=uTime;float P=uP;float m=cineMask(p);
  if(uSpecial>.5&&uSpecial<1.5){vec4 d=despair(p,t,P);vec3 dc=mix(d.rgb,vec3(1.),uFlash);if(d.a*uAlpha<.004)discard;gl_FragColor=vec4(dc,clamp(d.a*uAlpha,0.,1.));return;}
  vec3 col;
  if(uSpecial>1.5)col=special(p,t,uSpecial,P);
  else{
    float inten=smoothstep(.0,.22,P)*(uTier>2.5?1.:1.);
    vec2 pp=p;if(uTier>2.5)pp=p*(1.-.1*P);
    col=motif(pp,t,uMotif)*(.4+.9*inten);
    if(uTier>2.5){col=col*.72+motif(pp*1.7+vec2(.4,.1),t*.6+3.,uMotif)*.38;}
    if(uTier>1.5&&uTier<2.5){float sl=smoothstep(.75,.95,vn(vec2(p.y*40.,t*9.-p.x*2.)));col+=uC*sl*.35;}
    if(uTier>2.5){col+=uC*spk(vec2((p.x+t*.15)*26.,(p.y-t*.3)*26.),.996)*1.5;float ch=smoothstep(.72,.95,P);col+=uC*ch*ch*.35*exp(-length(p)*1.6);}
    col*=1.-uDark*smoothstep(.2,1.4,length(p));
    if(uTier<1.5)col*=.6;
  }
  col=mix(col,vec3(1.),uFlash);
  float al=m*uAlpha;
  if(uTier>1.5&&uTier<2.5){float e=smoothstep(.03,.0,abs(abs(dot(p,normalize(vec2(-.25,1.))))-.46*smoothstep(0.,.16,P)*(1.-smoothstep(.86,1.,P))));col+=uC*e*1.4;}
  if(al<.003)discard;
  gl_FragColor=vec4(col,clamp(al,0.,1.));
}`;

const PORTRAIT_FRAG = `${COMMON}
uniform sampler2D uMap;uniform float uOpacity,uSil,uBurn,uCalm,uFeather,uBias;uniform vec3 uTint,uRim;varying vec2 vUv;varying vec2 vP;
void main(){
  vec4 tx=texture2D(uMap,vUv,uBias);float m=cineMask(vP);
  float a=tx.a*uOpacity*m;
  if(uFeather>.5)a*=smoothstep(0.,.16,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
  float nb=(texture2D(uMap,vUv+vec2(.012,0.)).a+texture2D(uMap,vUv-vec2(.012,0.)).a+texture2D(uMap,vUv+vec2(0.,.012)).a+texture2D(uMap,vUv-vec2(0.,.012)).a)*.25;
  float rim=clamp((tx.a-nb)*3.,0.,1.)*(1.-uFeather);
  float n=fbm(vUv*vec2(5.,7.));if(uBurn>0.){float edge=smoothstep(uBurn-.06,uBurn,n);a*=edge;tx.rgb+=vec3(1.,.5,.15)*smoothstep(.07,.0,abs(n-uBurn))*2.5;}
  vec3 c=mix(tx.rgb*uTint,vec3(.0),uSil)+uRim*rim*.22*(1.-uSil);
  c=min(c,vec3(.98));if(a<.004)discard;
  gl_FragColor=vec4(c,a);
}`;
const TEXT_FRAG = `${COMMON}
uniform sampler2D uMap;uniform float uReveal,uVert,uOpacity,uCols;uniform vec3 uColor;varying vec2 vUv;varying vec2 vP;
void main(){
  vec4 tx=texture2D(uMap,vUv);float a=tx.a;float m=cineMask(vP);
  float along=mix(vUv.x,(floor((1.-vUv.x)*uCols)+(1.-vUv.y))/uCols,uVert);float n=fbm(vUv*vec2(6.,14.));
  float edge=along+(n-.5)*.28;float lim=uReveal*1.3-.15;
  float vis=smoothstep(lim,lim-.08,edge);
  float streak=vn(vec2(vUv.y*90.+vUv.x*4.,vUv.x*6.));vis*=mix(1.,smoothstep(.28,.5,streak),smoothstep(lim-.25,lim,edge)*.9);
  float al=a*vis*uOpacity*m;if(al<.004)discard;
  vec3 c=mix(vec3(.015),mix(uColor,vec3(1.),.45)*1.5,smoothstep(.35,.9,tx.r));
  gl_FragColor=vec4(c,al);
}`;

function inkSilhouette(name, id) {
  const [c, g] = makeCanvas(384, 640), r = mulberry(((id || name || 'x').length * 31) + 7);
  const kind = id === 'moonqueen' ? 'queen' : id === 'nannan' ? 'child' : id === 'mengpo' ? 'crone' : 'fairy';
  const P = new Path2D();
  const ell = (x, y, rx, ry) => { P.moveTo(x + rx, y); P.ellipse(x, y, rx, ry, 0, 0, 7); };
  if (kind === 'queen') {
    ell(192, 130, 40, 50); P.moveTo(140, 90); P.lineTo(150, 30); P.lineTo(172, 62); P.lineTo(192, 14); P.lineTo(212, 62); P.lineTo(234, 30); P.lineTo(244, 90); P.closePath();
    P.moveTo(160, 170); P.bezierCurveTo(70, 210, 20, 380, 40, 636); P.lineTo(344, 636); P.bezierCurveTo(364, 380, 314, 210, 224, 170); P.closePath();
    P.moveTo(160, 200); P.bezierCurveTo(30, 260, 10, 400, 24, 470); P.lineTo(70, 440); P.closePath(); P.moveTo(224, 200); P.bezierCurveTo(354, 260, 374, 400, 360, 470); P.lineTo(314, 440); P.closePath();
  } else if (kind === 'child') {
    ell(192, 330, 34, 38); ell(150, 308, 16, 16); ell(234, 308, 16, 16);
    P.moveTo(166, 366); P.bezierCurveTo(120, 400, 100, 520, 112, 636); P.lineTo(272, 636); P.bezierCurveTo(284, 520, 264, 400, 218, 366); P.closePath();
  } else if (kind === 'crone') {
    ell(150, 190, 36, 42); P.moveTo(120, 160); P.bezierCurveTo(130, 120, 170, 120, 182, 150); P.closePath();
    P.moveTo(130, 224); P.bezierCurveTo(60, 300, 70, 500, 90, 636); P.lineTo(300, 636); P.bezierCurveTo(300, 480, 260, 330, 190, 232); P.closePath();
    P.moveTo(222, 360); P.bezierCurveTo(260, 330, 300, 360, 280, 400); P.lineTo(222, 400); P.closePath(); ell(256, 392, 38, 18);
  } else {
    ell(192, 110, 36, 46); P.moveTo(156, 90); P.bezierCurveTo(100, 150, 110, 300, 96, 360); P.lineTo(130, 330); P.bezierCurveTo(140, 220, 170, 160, 170, 120); P.closePath();
    P.moveTo(228, 90); P.bezierCurveTo(284, 150, 274, 300, 288, 360); P.lineTo(254, 330); P.bezierCurveTo(244, 220, 214, 160, 214, 120); P.closePath();
    P.moveTo(164, 150); P.bezierCurveTo(100, 200, 70, 300, 60, 400); P.bezierCurveTo(40, 520, 30, 590, 20, 636); P.lineTo(364, 636); P.bezierCurveTo(354, 590, 344, 520, 324, 400); P.bezierCurveTo(314, 300, 284, 200, 220, 150); P.closePath();
    P.moveTo(40, 200); P.bezierCurveTo(10, 320, 40, 420, 20, 520); P.lineTo(46, 500); P.bezierCurveTo(60, 400, 30, 300, 40, 200); P.closePath();
  }
  const gr = g.createLinearGradient(0, 0, 0, 640); gr.addColorStop(0, '#242427'); gr.addColorStop(.6, '#121214'); gr.addColorStop(1, '#2a2a2e');
  g.filter = 'blur(1.1px)'; g.fillStyle = gr; g.fill(P, 'nonzero');
  g.globalCompositeOperation = 'source-atop'; for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() > .5 ? '70,70,76' : '0,0,0'},${.1 + r() * .2})`; g.beginPath(); g.ellipse(r() * 384, r() * 640, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'destination-out'; g.filter = 'none'; g.setLineDash([2, 7, 1, 13]); g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)'; g.stroke(P);
  g.setLineDash([]); for (let i = 0; i < 40; i++) { g.globalAlpha = .5; g.beginPath(); g.arc(r() * 384, 560 + r() * 80, 1 + r() * 4, 0, 7); g.fill(); } g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#242427'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(30 + r() * 320, 300 + r() * 330, 1 + r() * 3, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(160,26,16,.92)'; g.fillRect(300, 590, 34, 34); g.globalCompositeOperation = 'destination-out'; g.font = `bold 24px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText([...(name || id || '灵')][0], 317, 608); g.globalCompositeOperation = 'source-over';
  const t = canvasTexture(c); t.userData.aspect = .6; return t;
}function textTexture(text, { vertical, font = 200 }) {
  const chars = [...String(text)].slice(0, vertical ? 9 : 10), n = chars.length;
  const rows = vertical ? Math.min(4, n) : 1, cols = vertical ? Math.ceil(n / rows) : n;
  const W = font * cols, H = font * rows;
  const [c, g] = makeCanvas(Math.max(8, W), Math.max(8, H));
  g.font = `bold ${font * .86}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.strokeStyle = '#000'; g.lineWidth = font * .1; g.fillStyle = '#fff';
  chars.forEach((ch, i) => {
    let x, y;
    if (vertical) { const col = Math.floor(i / rows), row = i % rows; x = W - font * (col + .5); y = font * row + font / 2; } else { x = font * i + font / 2; y = font / 2; }
    g.strokeText(ch, x, y + font * .04); g.fillText(ch, x, y + font * .04);
  });
  const t = canvasTexture(c, { srgb: false }); t.userData.aspect = W / H; t.userData.n = n; t.userData.rows = rows; t.userData.cols = cols; return t;
}function iconTexture(kind) {
  const [c, g] = makeCanvas(512, 512);
  g.translate(256, 256); g.shadowColor = '#fff'; g.shadowBlur = 24;
  if (kind === 0) { g.fillStyle = '#c4201a'; g.beginPath(); g.moveTo(0, -190); g.bezierCurveTo(150, -30, 150, 130, 0, 180); g.bezierCurveTo(-150, 130, -150, -30, 0, -190); g.fill(); g.fillStyle = 'rgba(255,200,190,.7)'; g.beginPath(); g.ellipse(-50, 20, 20, 52, .3, 0, 7); g.fill(); }
  else if (kind === 1) { g.fillStyle = '#f6efd0'; for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { g.save(); g.scale(s, 1); g.rotate(-.1 + i * .17); g.beginPath(); g.moveTo(20, -10); g.quadraticCurveTo(150 + i * 12, -90 + i * 28, 210 - i * 10, 10 + i * 36); g.quadraticCurveTo(120, 0, 20, 14); g.fill(); g.restore(); } }
  else { g.fillStyle = '#ffb040'; g.beginPath(); g.moveTo(0, -200); g.bezierCurveTo(90, -90, 130, 20, 70, 130); g.bezierCurveTo(30, 190, -30, 190, -70, 130); g.bezierCurveTo(-130, 20, -90, -90, 0, -200); g.fill(); g.fillStyle = '#fff2c0'; g.beginPath(); g.moveTo(0, -70); g.bezierCurveTo(40, 0, 50, 70, 0, 130); g.bezierCurveTo(-50, 70, -40, 0, 0, -70); g.fill(); }
  const t = canvasTexture(c); t.userData.aspect = 1; return t;
}

export function createCinematic(ctx) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1.78, 1.78, 1, -1, -10, 10); cam.position.z = 5;
  const shared = { uTime: { value: 0 }, uP: { value: 0 }, uTier: { value: 1 }, uAspect: { value: 1.78 }, uCalm: { value: 0 } };
  const quad = new THREE.PlaneGeometry(1, 1);
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uMotif: { value: 0 }, uSpecial: { value: 0 }, uDark: { value: 0 }, uFlash: { value: 0 }, uAlpha: { value: 0 }, uA: { value: new THREE.Color('#222') }, uB: { value: new THREE.Color('#888') }, uC: { value: new THREE.Color('#fff') } },
    vertexShader: VERT, fragmentShader: BG_FRAG, transparent: true, depthTest: false, depthWrite: false
  });
  const bg = new THREE.Mesh(quad, bgMat); bg.renderOrder = 1; scene.add(bg);
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blank.needsUpdate = true;
  const portraitMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uMap: { value: blank }, uOpacity: { value: 0 }, uSil: { value: 0 }, uBurn: { value: 0 }, uFeather: { value: 0 }, uBias: { value: 0 }, uTint: { value: new THREE.Color('#fff') }, uRim: { value: new THREE.Color('#fff') } },
    vertexShader: VERT, fragmentShader: PORTRAIT_FRAG, transparent: true, depthTest: false, depthWrite: false
  });
  const portrait = new THREE.Mesh(quad, portraitMat); portrait.renderOrder = 2; scene.add(portrait);
  const mkText = () => new THREE.Mesh(quad, new THREE.ShaderMaterial({
    uniforms: { ...shared, uMap: { value: blank }, uReveal: { value: 0 }, uVert: { value: 0 }, uCols: { value: 1 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#fff') } },
    vertexShader: VERT, fragmentShader: TEXT_FRAG, transparent: true, depthTest: false, depthWrite: false
  }));
  const title = mkText(), sub = mkText(); title.renderOrder = 3; sub.renderOrder = 3; scene.add(title, sub);
  let eyes = null;
  for (const o of [bg, portrait, title, sub]) o.visible = false;

  const click = document.createElement('div'); click.className = 'cine-click'; click.style.display = 'none';
  (document.getElementById('ui') || document.body).append(click);

  let mode = localStorage.getItem('gc3d-cine-mode'); if (!MODES.includes(mode)) mode = 'full';
  if (new URLSearchParams(location.search).get('lite') === '1') mode = 'table';
  const seen = new Set();
  const tex = new Map();
  let cur = null, hudWas = true, frozen = false, scenes = null;
  const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  const DMODE = { 0: 1, 2: 2, 3: 5, 4: 4, 5: 3 };

  function portraitFor(req, tier) {
    const p = req.portrait; if (!p) return null;
    let matte = false;
    const key = `${p.id}|${p.form || ''}|${p.name}|${tier >= 3}`;
    if (tex.has(key)) return tex.get(key);
    let img = null;
    const ids = p.form ? [p.form, p.id] : [p.id];
    for (const id of ids) { img = (tier >= 3 ? viewImage(id, 'front') || artImage(id) : artImage(id) || viewImage(id, 'front')); if (img) { matte = !!viewImage(id, 'front') && img === viewImage(id, 'front'); break; } }
    let t;
    if (img) { t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; t.userData.aspect = img.width / img.height; t.userData.sil = false; t.userData.matte = matte; }
    else { t = inkSilhouette(p.name, p.id); t.userData.sil = true; }
    tex.set(key, t); return t;
  }
  function cardTexture(cardId) {
    const [c] = makeCanvas(CW, CH); drawSkillFace(c, cardId); const t = canvasTexture(c); t.userData.aspect = CW / CH; t.userData.sil = false; return t;
  }

  function finish(immediate) {
    if (!cur) return;
    const c = cur; cur = null;
    const fade = immediate ? 0 : 1;
    const done = () => { if (c.s3d) { ctx.R.useScene(null); focusState.override = null; ctx.R.grade.uFlashAmt.value = 0; } ctx.R.distort.uStrength.value = 0; if (c.special === 1) tween(ctx.lights.state, { dim: c.dim0 ?? 1 }, { dur: 700 }); for (const o of [bg, portrait, title, sub]) o.visible = false; if (eyes) { eyes.group.visible = false; } ctx.R.overlayOn = false; click.style.display = 'none'; ctx.R.hud = hudWas; duck?.(1, .6); };
    if (fade) tween(bgMat.uniforms.uAlpha, { value: 0 }, { dur: 140, raw: true }).then(done); else { bgMat.uniforms.uAlpha.value = 0; done(); }
    c.resolve1?.(); c.resolve2?.();
    portraitMat.uniforms.uOpacity.value = 0; title.material.uniforms.uOpacity.value = 0; sub.material.uniforms.uOpacity.value = 0;
  }
  const reduce = () => !!globalThis.GC?.preferences?.reduceFlash;

  function effTier(req) {
    if (mode === 'table') return 0;
    if (mode === 'smart') {
      if (req.side === 'enemy') return 1;
      const key = req.kind + ':' + req.name;
      if (seen.has(key)) return 1;
      seen.add(key);
    }
    return req.tier;
  }

  function play(req) {
    const tier = effTier(req);
    if (!tier) return Promise.resolve();
    if (cur) finish(true);
    const spd = speed();
    const dur = (TIER_DUR[tier] * (req.side === 'enemy' ? (tier >= 3 ? .8 : 1) : 1)) / spd;
    const special = tier === 4 && req.kind === 'skill' ? (SPECIAL[req.name] || 0) : 0;
    const c = cur = { req, tier, dur, t: 0, special };
    const color = new THREE.Color(req.color || themeColor(req.theme));
    const A = color.clone().multiplyScalar(.18), B = color.clone(), C = color.clone().lerp(new THREE.Color('#fff'), .35);
    if (req.side === 'enemy') { A.set('#1a0404'); B.set('#b01810'); C.set('#ff7a3a'); }
    { const lum = B.r * .3 + B.g * .59 + B.b * .11; if (lum > .45) { A.multiplyScalar(.3); B.multiplyScalar(.5); C.copy(B).multiplyScalar(1.5); } }
    const SC = { '#2a2a36': 1 };
    void SC;
    const u = bgMat.uniforms;
    u.uA.value.copy(A); u.uB.value.copy(B); u.uC.value.copy(C);
    if (special === 2) { u.uA.value.set('#031a0c'); u.uB.value.set('#2cff8a'); u.uC.value.set('#a8ffcc'); }
    if (special === 6 || special === 7) { u.uA.value.set('#2a1c05'); u.uB.value.set('#e8a820'); u.uC.value.set('#fff0b8'); }
    if (special === 7) { u.uA.value.set('#2a0a02'); u.uB.value.set('#ff5a1a'); u.uC.value.set('#ffe9a0'); }
    if (special === 5) { u.uA.value.set('#041a18'); u.uB.value.set('#1fb89a'); u.uC.value.set('#9fffe0'); }
    if (special === 4) { u.uA.value.set('#1a1006'); u.uB.value.set('#e0b868'); u.uC.value.set('#fff1c8'); }
    if (special === 3) { u.uA.value.set('#04081a'); u.uB.value.set('#6f8fd8'); u.uC.value.set('#e8f0ff'); }
    u.uMotif.value = motifIndex(req.theme); u.uSpecial.value = special; u.uDark.value = 0; u.uFlash.value = 0; u.uAlpha.value = 1;
    shared.uTier.value = tier; shared.uP.value = 0; shared.uCalm.value = reduce() ? 1 : 0;
    bg.visible = true;
    // 立绘
    let tx = null;
    if (req.kind === 'card' && req.cardId) tx = cardTexture(req.cardId);
    else if (req.kind === 'player') tx = iconTexture(req.index ?? 0);
    else if (req.side !== 'enemy') tx = portraitFor(req, tier);
    c.tx = tx;
    portrait.visible = !!tx;
    if (special >= 2 && scenes?.[special]) { const s3 = scenes[special]; c.s3d = s3; bg.visible = false; portrait.visible = false; s3.scene.userData.setPortrait?.(tx); ctx.R.useScene(s3.scene, s3.camera); focusState.override = s3.scene.userData.focus || 10; ctx.R.grade.uFlash.value.set('#ffffff'); }
    if (special === 1) { c.dim0 = ctx.lights.state.dim; tween(ctx.lights.state, { dim: .3 }, { dur: 1400 }); }
    c.dmode = DMODE[motifIndex(req.theme)] ?? 2; c.dweak = DMODE[motifIndex(req.theme)] == null;
    if (tx) { portraitMat.uniforms.uMap.value = tx; portraitMat.uniforms.uSil.value = 0; portraitMat.uniforms.uTint.value.set('#fff'); portraitMat.uniforms.uBurn.value = 0; portraitMat.uniforms.uOpacity.value = 0; }
    // 敌方火眼
    if (req.side === 'enemy') {
      if (!eyes) { eyes = createEyePair({ color: '#b3120c', size: 1.3, gap: 1.6, slant: .16 }); eyes.group.renderOrder = 4; scene.add(eyes.group); }
      eyes.group.visible = true; eyes.setColor('#d8321c'); eyes.setLid(1); eyes.setIntensity(0); eyes.freezeBlink(true);
    } else if (eyes) eyes.group.visible = false;
    // 文字
    const vert = tier >= 3;
    const tt = textTexture(req.name, { vertical: vert, font: 160 });
    title.material.uniforms.uMap.value = tt; title.material.uniforms.uVert.value = vert ? 1 : 0; title.material.uniforms.uCols.value = tt.userData.cols || 1; title.material.uniforms.uReveal.value = 0; title.material.uniforms.uOpacity.value = 1;
    title.material.uniforms.uColor.value.copy(req.side === 'enemy' ? new THREE.Color('#ff6a50') : tier >= 3 ? C : new THREE.Color('#f4ecd8'));
    c.tt = tt; title.visible = true;
    const subText = req.sub && tier >= 4 ? textTexture(req.sub, { vertical: false, font: 100 }) : null;
    sub.visible = !!subText;
    if (subText) { sub.material.uniforms.uMap.value = subText; sub.material.uniforms.uVert.value = 0; sub.material.uniforms.uReveal.value = 0; sub.material.uniforms.uOpacity.value = .9; sub.material.uniforms.uColor.value.set('#e8dcc0'); c.st = subText; }
    ctx.R.overlayOn = true; hudWas = ctx.R.hud; ctx.R.hud = false;
    click.style.display = '';
    if (tier >= 3) { sfx('charge'); duck?.(.15, .35); }
    else sfx(tier === 2 ? 'whoosh' : 'rustle');
    const p1 = tier === 1 ? Promise.resolve() : tier === 2 ? new Promise(r => { c.resolve1 = r; c.at1 = .6; }) : new Promise(r => { c.resolve1 = r; c.at1 = 1; });
    c.hand = tier === 1 ? 0 : (tier === 2 ? .6 : 1);
    if (tier === 1) c.resolve1 = null;
    return p1;
  }

  function layout(c, P) {
    const asp = shared.uAspect.value, tier = c.tier, tx = c.tx;
    const ease = x => x * x * (3 - 2 * x);
    const u = bgMat.uniforms;
    let ph = 0;
    // 立绘
    if (tx) {
      const aspect = tx.userData.aspect || .6, mat = portraitMat.uniforms;
      let h, x, y, op = 1;
      if (tier === 1) { h = 2.6; const n = new THREE.Vector2(.45, 1).normalize(), cc = THREE.MathUtils.lerp(-2, 2, P); x = n.x * cc + (c.req.kind === 'card' ? 0 : 0); y = n.y * cc + (c.req.kind === 'card' ? 0 : .6); }
      else if (tier === 2) { h = 1.9; const s = ease(Math.min(1, P / .35)); x = THREE.MathUtils.lerp(asp * 1.3, asp * .38, s) + P * .08; y = -.05; }
      else if (tier === 3) { h = 2.15 + P * .15; const s = ease(Math.min(1, Math.max(0, (P - .2) / .3))); x = THREE.MathUtils.lerp(-asp * 1.2, -asp * .42, s); y = -.02 + P * .04; op = s; }
      else { h = 2.0; const s = ease(Math.min(1, Math.max(0, (P - .55) / .18))); x = -asp * .45 + (1 - s) * -.25; y = -.02; op = s * (1 - ease(Math.max(0, (P - .93) / .07))); }
      if (c.special === 1) { h = .36; x = 0; y = -.24; op = ease(Math.min(1, Math.max(0, (P - .4) / .2))) * (1 - ease(Math.max(0, (P - .93) / .07))); }
      if (c.req.kind === 'card') { h = tier >= 3 ? 2.0 : tier === 2 ? 1.7 : 1.9; mat.uBurn.value = tier >= 3 ? Math.max(0, (P - .72) / .25) : 0; }
      if (c.req.kind === 'player') { h = tier >= 3 ? 1.6 : 1.2; }
      portrait.scale.set(h * aspect, h, 1); portrait.position.set(x, y, 0);
      mat.uOpacity.value = op;
    }
    // 敌方眼睛
    if (c.req.side === 'enemy' && eyes) {
      const open = ease(Math.min(1, Math.max(0, (P - .08) / .4)));
      eyes.setLid(1 - open); eyes.setIntensity(1.1 * open * (1 - ease(Math.max(0, (P - .9) / .1))));
      const sc = tier === 1 ? 1.1 : tier === 2 ? 1.5 : 2.2;
      eyes.group.scale.setScalar(sc * (1 + P * .1));
      if (tier === 1) { const n = new THREE.Vector2(.45, 1).normalize(), cc = THREE.MathUtils.lerp(-2, 2, P); eyes.group.position.set(n.x * cc, n.y * cc, 0); }
      else if (tier === 2) eyes.group.position.set(asp * .3, 0, 0); else eyes.group.position.set(0, .1, 0);
    }
    // 标题
    const tt = c.tt, n = tt.userData.n || 2;
    if (tier === 1) {
      const nn = new THREE.Vector2(.45, 1).normalize(), cc = THREE.MathUtils.lerp(-2, 2, P);
      const hh = .17; title.scale.set(hh * tt.userData.aspect, hh, 1); title.position.set(nn.x * cc, nn.y * cc - .02, 0);
      title.material.uniforms.uReveal.value = Math.min(1, P * 3);
    } else if (tier === 2) {
      const hh = .34; title.scale.set(hh * tt.userData.aspect, hh, 1); title.position.set(-asp * .42, -.12, 0);
      title.material.uniforms.uReveal.value = Math.min(1, Math.max(0, (P - .22) / .38));
    } else {
      const cs = tier === 4 ? .4 : .36, rows = tt.userData.rows || 1, cols = tt.userData.cols || 1; title.scale.set(cs * cols, cs * rows, 1);
      title.position.set(asp * .6, -.02, 0);
      const st = tier === 4 ? .5 : .28, en = tier === 4 ? .7 : .5;
      title.material.uniforms.uReveal.value = Math.min(1, Math.max(0, (P - st) / (en - st)));
      title.material.uniforms.uOpacity.value = 1 - ease(Math.max(0, (P - .94) / .06));
    }
    if (c.st) { const hh = .1; sub.scale.set(hh * c.st.userData.aspect, hh, 1); sub.position.set(asp * .6, -.86, 0); sub.material.uniforms.uReveal.value = Math.min(1, Math.max(0, (P - .62) / .13)); sub.material.uniforms.uOpacity.value = .9 * (1 - ease(Math.max(0, (P - .94) / .06))); }
    // 暗角 / 白闪
    const calm = reduce();
    u.uDark.value = tier >= 3 ? ease(Math.min(1, P / .2)) * .6 : 0;
    let flash = 0;
    if (tier >= 3 && P > .9) flash = Math.min(1, (P - .9) / .05) * (1 - Math.max(0, (P - .97) / .03)) * (tier === 4 ? 1 : .85);
    if (tier === 2 && P > .86 && P < .93) flash = .5 * (1 - Math.abs(P - .895) / .035);
    u.uFlash.value = calm ? flash * .35 : flash;
    return ph;
  }

  function update(dt, t) {
    shared.uTime.value = t;
    const asp = innerWidth / innerHeight;
    if (Math.abs(asp - shared.uAspect.value) > .001) { shared.uAspect.value = asp; cam.left = -asp; cam.right = asp; cam.updateProjectionMatrix(); }
    bg.scale.set(asp * 2, 2, 1);
    if (!cur) return;
    const c = cur;
    if (!frozen) c.t += dt;
    const P = Math.min(1, c.t / c.dur);
    shared.uP.value = P;
    layout(c, P);
    if (c.s3d) { const a = innerWidth / innerHeight; c.s3d.camera.aspect = a; c.s3d.camera.updateProjectionMatrix(); c.s3d.update(P, shared.uTime.value, dt); ctx.R.grade.uFlashAmt.value = bgMat.uniforms.uFlash.value * .95; }
    { const D = ctx.R.distort; D.uP.value = P; if (c.tier === 3) { D.uMode.value = c.dmode; D.uStrength.value = (c.dweak ? .3 : .75) * Math.sin(Math.PI * Math.min(1, P / .96)); } else if (c.s3d?.heat) { D.uMode.value = 1; D.uStrength.value = .9 * sm(.38, .5, P) * (1 - sm(.88, .95, P)); } else if (c.special === 4) { D.uMode.value = 2; D.uStrength.value = .4 * sm(.3, .6, P); } else D.uStrength.value = 0; }
    if (c.tier === 4 && !c.omen && P > .02) { c.omen = true; sfx('omen'); }
    if (c.tier >= 3 && !c.hit && P > .9) { c.hit = true; sfx('impact'); }
    if (c.resolve1 && P >= c.hand) { const r = c.resolve1; c.resolve1 = null; r(); }
    if (P >= 1) finish(false);
  }

  function skip() { if (cur) finish(true); }
  click.addEventListener('click', ev => { ev.stopPropagation(); skip(); });
  addEventListener('keydown', ev => {
    if (cur && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); skip(); return; }
    if ((ev.key === 'v' || ev.key === 'V') && !ev.ctrlKey && !ev.metaKey && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') && ctx.battleActive) cycle();
  });

  function setMode(m) { if (!MODES.includes(m)) return; mode = m; localStorage.setItem('gc3d-cine-mode', m); ctx.emit?.('cineMode', m); }
  function cycle() { setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]); ctx.screens?.toast?.(`技能演出：${MODE_NAME[mode]}`); return mode; }

  async function warmup() {
    if (!scenes) {
      scenes = buildCineScenes(ctx);
      for (const s3 of Object.values(scenes)) { const sd = s3.scene.userData.standee; if (sd) sd.visible = true; ctx.R.useScene(s3.scene, s3.camera); s3.update(.6, 1, .016); await new Promise(r => setTimeout(r, 140)); if (sd) sd.visible = false; }
      ctx.R.useScene(null);
    }
    for (const o of [bg, portrait, title, sub]) o.visible = true;
    bgMat.uniforms.uAlpha.value = 0; portraitMat.uniforms.uOpacity.value = 0;
    if (!eyes) { eyes = createEyePair({ color: '#b3120c', size: 1.3, gap: 1.6, slant: .16 }); scene.add(eyes.group); }
    eyes.group.visible = true; eyes.setIntensity(0);
    ctx.R.overlayOn = true;
    await new Promise(r => setTimeout(r, 160));
    for (const md of [1, 2, 3, 4, 5]) { ctx.R.distort.uMode.value = md; ctx.R.distort.uStrength.value = .01; await new Promise(r => setTimeout(r, 90)); }
    ctx.R.distort.uStrength.value = 0;
    ctx.R.overlayOn = false;
    for (const o of [bg, portrait, title, sub]) o.visible = false;
    eyes.group.visible = false;
  }

  ctx.R.setOverlay?.(scene, cam);
  return {
    play, skip, warmup, update, setMode, cycle, resetSeen() { seen.clear(); },
    get mode() { return mode; }, get modeName() { return MODE_NAME[mode]; },
    get active() { return !!cur; }, get tier() { return cur?.tier || 0; }, get progress() { return cur ? cur.t / cur.dur : 0; },
    seek(P) { if (cur) cur.t = P * cur.dur; }, freeze(v) { frozen = !!v; }
  };
}
