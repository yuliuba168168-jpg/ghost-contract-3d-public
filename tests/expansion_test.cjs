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
 // ---- 主线首领战：行为、场地、破障条件、二阶段、意图 ----
 const A=ctx.__MAINLINE_TEST__,X=ctx.GC_X;A.newSlot(0,'normal','x','hard');const st=A.getState();A.grantContract(A.ML.arcs[0].contracts[0]);
 const seen={field:new Set(),ward:new Set(),phase:new Set(),beh:new Set()};let phased=0;
 for(const arc of A.ML.arcs){
  A.grantTraining(arc.act-1);A.trainTeam(arc.act-1);A.fullHeal();st.squad=st.spirits.filter(s=>s.id!=='nannan').slice(0,4).map(s=>s.id);
  ctx.startBattle(arc.id+'-battle');const mb=st.battle,lead=mb.enemies[0];assert.equal(mb.x,1);
  if(arc.act>=3)assert.ok(X.field(mb),'field from act 3: '+arc.act);if(mb.field)seen.field.add(mb.field);
  if(arc.act>=2){assert.ok(lead.phase2,'boss has phase 2: act '+arc.act);seen.phase.add(lead.phase2);assert.ok(lead.bossTraits.some(n=>n.startsWith('二阶段·')&&A.BOSS_SKILLS[n]));
   if(mb.ward){assert.ok(mb.wardRule&&X.wardRule(mb));seen.ward.add(mb.wardRule)}}
  for(const e of mb.enemies)if(e.behavior){seen.beh.add(e.behavior);assert.ok(A.BOSS_SKILLS[ctx.GC_X.BEHAVIORS[e.behavior][0]])}
  const it=X.intents(mb);assert.equal(it.length,mb.enemies.filter(e=>!e.dead).length);for(const i of it){assert.ok(['attack','lamp','skip'].includes(i.action));assert.ok(i.damage>=0&&Number.isFinite(i.damage));JSON.stringify(i)}
  assert.ok(it.every(i=>i.action==='lamp'||i.action==='skip'),'no allies on field → all lamp');
  if(lead.phase2){lead.hp=lead.maxHp*.4;mark=rec.fx.length;ctx.cleanup();assert.ok(lead.phased,'phase triggered');assert.equal(fxOf(mark,'boss:phase').length,1);ctx.cleanup();assert.equal(fxOf(mark,'boss:phase').length,1,'phase only once');phased++}
  st.battle=null;
 }
 assert.equal(seen.phase.size,6);assert.ok(seen.field.size>=6,'fields '+seen.field.size);assert.ok(seen.ward.size>=5,'ward rules '+seen.ward.size);assert.ok(seen.beh.size>=10,'behaviors '+seen.beh.size);
 // 破障条件：火障在有敌人灼烧时多破一层
 A.setState(old.clone(old.DEFAULT));b=await fresh();b.ward=1;b.wardBase=0;b.wardRule='fire';assert.equal(ctx.wardFactor(b),0);ctx.addEffect(b.enemies[0],'ghostFire','火',2,{ratio:.1});assert.equal(ctx.wardFactor(b),1,'fire ward rule');
 // 羁绊合击：萱华 + 绫罗
 old.setState(old.clone(old.DEFAULT));
 GC.actions.startTestBattle({playerHp:10,qi:10,xp:1000,enemyHp:999999,allies:[{on:true,id:'xuan',rank:'S级'},{on:true,id:'lingluo',rank:'S级'}],enemies:[0,1].map(i=>({on:true,name:'木桩'+(i+1),rank:'F级',potential:1,atk:1,hp:100000,pos:String(i)})),cards:[],draw:[]});
 b=GC.state.battle;GC.actions.selectHand(0);GC.actions.allyLane(0);for(let i=0;i<5&&GC.busy;i++)await tick();assert.equal(X.bonds(b).length,0,'one spirit: no bond');
 const solo=ctx.effectiveAttack(b.units[0]);GC.actions.selectHand(0);GC.actions.allyLane(1);for(let i=0;i<5&&GC.busy;i++)await tick();
 const bonds=X.bonds(b);assert.equal(bonds.length,1);assert.equal(bonds[0].key,'xuan+lingluo');assert.ok(Math.abs(ctx.effectiveAttack(b.units[0])/solo-1.1)<1e-9,'bond +10%');
 b.qi=5;const hpA=b.enemies[0].hp,hpB=b.enemies[1].hp;mark=rec.fx.length;assert.equal(await X.bondStrike('xuan+lingluo'),true);
 assert.ok(b.enemies[0].hp<hpA&&b.enemies[1].hp<hpB,'bond strike hits all');assert.equal(b.qi,3);assert.equal(fxOf(mark,'bond:strike').length,1);
 assert.equal(await X.bondStrike('xuan+lingluo'),false,'once per battle');assert.equal(GC.busy,false);
 // 契约条款
 A.newSlot(1,'normal','pact','easy');let ps=A.getState();ctx.grantContract(A.ML.arcs[0].contracts[0]);
 const pend=X.pendingPact();assert.ok(pend&&pend.options.length===4,'pending pact after contract');const pid=pend.id,own=ps.spirits.find(s=>s.id===pid);
 assert.equal(X.choosePact('blood'),true);assert.equal(X.pactOf(pid),'blood');assert.equal(X.pendingPact(),null);
 const pu=ctx.initUnit({...old.clone(own),uid:'pact-test',lane:0});assert.equal(pu.pact,'blood');assert.ok(Math.abs(pu.baseAtk/own.atk-1.2)<.02,'blood pact atk');assert.ok(Math.abs(pu.maxHp/own.maxHp-.85)<.06,'blood pact hp');
 // 无尽词缀、每日挑战、成绩
 const store={};ctx.localStorage.getItem=k=>store[k]??null;ctx.localStorage.setItem=(k,v)=>{store[k]=String(v)};
 const di=X.dailyInfo('2026-11-17');assert.equal(di.squad.length,6);assert.equal(new Set(di.squad).size,6);assert.equal(di.deck.length,12);assert.equal(di.affixes.length,3);
 assert.deepEqual(JSON.parse(JSON.stringify(X.dailyInfo('2026-11-17'))),JSON.parse(JSON.stringify(di)),'daily is deterministic');
 assert.equal(X.startDaily(2,'easy'),true);ps=A.getState();assert.ok(ps.daily&&ps.mode==='endless');assert.equal(X.affixes().length,3);
 ctx.startBattle('endless-arena');const eb=ps.battle;assert.equal(eb.affixes.length,3);ps.wave=4;assert.equal(X.affixes().length,4,'one more affix every 3 waves');
 ctx.loseBattle();assert.equal(X.records().daily[ps.daily],3,'daily record = waves cleared');
 // 战绩与成就
 let stt=X.stats();assert.ok(stt.losses>=1,'loss counted');assert.equal(X.achievements().length,X.ACH.length);
 assert.ok(X.achievements().find(a=>a.key==='daily1').done,'daily achievement');
 A.newSlot(3,'normal','stat','easy');ctx.grantContract(A.ML.arcs[0].contracts[0]);X.choosePact('bone');assert.ok(X.stats().pacts>=1,'pact counted');ctx.startBattle(A.ML.arcs[0].id+'-battle');b=A.getState().battle;
 const w0=X.stats().wins;for(const e of b.enemies){e.hp=0;e.dead=true}b.kills=b.enemies.length;await ctx.winBattle();
 stt=X.stats();assert.equal(stt.wins,w0+1,'win counted');assert.ok(stt.kills>=b.enemies.length);assert.ok(stt.done.includes('first'),'first-win achievement');assert.ok(rec.notify.some(n=>String(n).includes('成就达成')),'achievement notice');
 console.log(`expansion_test PASS: ${played}/${ids.length} new cards played; ${phased} boss phases, ${seen.field.size} fields, ${seen.ward.size} ward rules, ${seen.beh.size} behaviors, intents, bond strike, pacts, affixes, daily, records, stats, achievements; burn, taunt, aura, multi, pierce, stun, deathrattle, bounce, lamp verified`);
})().catch(e=>{console.error(e);process.exit(1)});
