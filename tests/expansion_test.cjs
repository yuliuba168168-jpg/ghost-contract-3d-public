// 扩展卡牌冒烟：72 张新卡逐张经真实入口 playSkill 打出，校验扣费、离手、无异常。
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const RULES=path.join(__dirname,'..','src','rules');
const ctx={console,setTimeout,clearTimeout,queueMicrotask,__HEADLESS__:true,localStorage:{getItem:()=>null,setItem:()=>{}}};
vm.createContext(ctx);
for(const n of ['bridge','codex','vfx','app','polish','mainline-data','mainline-data-2','mainline','playability','expansion','facade'])vm.runInContext(fs.readFileSync(path.join(RULES,n+'.js'),'utf8'),ctx,{filename:n+'.js'});
const rec={fx:[],notify:[]};
ctx.GC_BRIDGE={fx(t,p){rec.fx.push({type:t,payload:p});return Promise.resolve()},sync(){},ui(){},notify(t,k){rec.notify.push(t)}};
const GC=ctx.GC,old=ctx.__CAMPAIGN_TEST__,tick=()=>new Promise(r=>setTimeout(r,0));
async function fresh(){
 old.setState(old.clone(old.DEFAULT));
 GC.actions.startTestBattle({playerHp:10,qi:10,xp:1000,enemyHp:999999,allies:[{on:true,id:'xuan',rank:'S级'}],
  enemies:[0,1].map(i=>({on:true,name:'木桩'+(i+1),rank:'F级',potential:1,atk:1,hp:100000,pos:String(i)})),cards:[],draw:['coin','coin','coin','coin']});
 GC.actions.selectHand(0);GC.actions.allyLane(1);for(let i=0;i<5&&GC.busy;i++)await tick();return GC.state.battle}
(async()=>{
 const ids=Object.keys(GC.SKILLS).filter(id=>GC.SKILLS[id].ops);assert.equal(ids.length,72);
 let played=0;const failed=[];
 for(const id of ids){
  const c=GC.SKILLS[id],b=await fresh();assert.ok(b.units[1],'deployed');
  if(c.ops.some(o=>o[0]==='needToken')){b.hand.push('paperman');b.qi=99;await GC.actions.playSkill(b.hand.length-1,-1)}
  b.hand.push(id);b.qi=50;const n=b.hand.length,notes=rec.notify.length;
  const lane=c.target==='enemy'?1:c.target==='ally'?(c.ops.some(o=>o[0]==='needToken')?b.units.findIndex(u=>u?.token):1):-1;
  try{await GC.actions.playSkill(n-1,lane)}catch(e){failed.push(id+': '+e.message);continue}
  if(b.hand.filter(x=>x===id).length!==0)failed.push(id+': not played ('+(rec.notify.slice(notes).join('/')||'no notice')+')');else played++;
  if(GC.busy)failed.push(id+': busy stuck');
 }
 if(failed.length){console.log(failed.join('\n'));process.exit(1)}
 // ---- 效果断言 ----
 const play=async(b,id,lane=-1)=>{b.hand.push(id);b.qi=50;await GC.actions.playSkill(b.hand.length-1,lane);assert.ok(!b.hand.includes(id),id+' left hand')};
 const fxOf=(from,type)=>rec.fx.slice(from).filter(f=>f.type===type);
 let b=await fresh(),e0=b.enemies[0],e1=b.enemies[1],xuan=b.units[1];
 // 灼烧：引火符后回合结束有 burn 结算
 await play(b,'ember',1);assert.ok(e1.effects.ghostFire,'ember burns');let mark=rec.fx.length;await GC.actions.endTurn();
 assert.ok(fxOf(mark,'status:tick').some(f=>f.payload.kind==='burn'&&f.payload.uid===e1.uid&&f.payload.value>0),'burn ticks');
 // 嘲讽：纸人把 0 路敌人的直击引到自己身上
 b=await fresh();e0=b.enemies[0];await play(b,'paperman');const paper=b.units.find(u=>u?.token==='paper');assert.ok(paper,'paper token');
 mark=rec.fx.length;await GC.actions.endTurn();
 assert.ok(fxOf(mark,'attack').some(f=>f.payload.attacker.uid===e0.uid&&f.payload.target.uid===paper.uid),'taunt redirects');
 assert.equal(b.grave.filter(g=>g.token).length,0,'tokens never enter the grave');
 // 光环 + 静守：引魂灯相邻加攻且自己不攻击
 b=await fresh();xuan=b.units[1];const base=ctx.effectiveAttack(xuan);await play(b,'lantern');const lamp=b.units.find(u=>u?.token==='lantern');
 assert.equal(Math.abs(lamp.lane-1),1,'lantern adjacent');assert.ok(Math.abs(ctx.effectiveAttack(xuan)/base-1.2)<1e-9,'aura +20%');
 mark=rec.fx.length;await GC.actions.endTurn();assert.ok(!fxOf(mark,'attack').some(f=>f.payload.attacker.uid===lamp.uid)&&!fxOf(mark,'direct').some(f=>f.payload.attacker.uid===lamp.uid),'lantern idle');
 // 连击
 b=await fresh();xuan=b.units[1];await play(b,'multistrike',1);mark=rec.fx.length;await GC.actions.endTurn();
 assert.equal(fxOf(mark,'attack').filter(f=>f.payload.attacker.uid===xuan.uid).length,2,'multi attacks twice');
 // 穿透
 b=await fresh();await play(b,'piercecharm',1);let will=b.enemyWill;await GC.actions.endTurn();assert.ok(b.enemyWill<will,'pierce burns enemy lamp');
 // 封条：敌人停止一次行动
 b=await fresh();e1=b.enemies[1];await play(b,'seal',1);mark=rec.fx.length;await GC.actions.endTurn();
 assert.ok(fxOf(mark,'unit:skip').some(f=>f.payload.uid===e1.uid),'seal stuns');assert.ok(!fxOf(mark,'attack').some(f=>f.payload.attacker.uid===e1.uid),'stunned enemy idle');
 // 亡语：纸嫁娘被献出后对敌方全体造成伤害，并抽牌回气
 b=await fresh();e0=b.enemies[0];await play(b,'bride');const bride=b.units.find(u=>u?.token==='bride');const hp0=e0.hp;
 await play(b,'puppeteer',bride.lane);assert.ok(e0.hp<hp0,'deathrattle blast');assert.ok(!b.units.includes(bride),'token removed');
 // 回手
 b=await fresh();await play(b,'swapstep',1);assert.equal(b.units[1],null);assert.ok(b.hand.some(h=>h?.kind==='ghost'||h==='xuan'),'bounced to hand');
 // 命灯
 b=await fresh();will=b.enemyWill;await play(b,'lampstrike');assert.ok(Math.abs(will-b.enemyWill-b.maxEnemyWill*.04)<1e-6,'lamp strike');
 console.log(`expansion_test PASS: ${played}/${ids.length} new cards played; burn, taunt, aura, multi, pierce, stun, deathrattle, bounce, lamp verified`);
})().catch(e=>{console.error(e);process.exit(1)});
