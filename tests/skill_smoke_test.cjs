// Smoke: every active skill of every spirit, every card, every player skill —
// all exercised through real input entry points against the recording bridge.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const RULES=path.join(__dirname,'..','src','rules');
const ctx={console,setTimeout,clearTimeout,queueMicrotask,__HEADLESS__:true,localStorage:{getItem:()=>null,setItem:()=>{}}};
vm.createContext(ctx);
for(const n of ['bridge','codex','vfx','app','polish','mainline-data','mainline-data-2','mainline','expansion','facade'])vm.runInContext(fs.readFileSync(path.join(RULES,n+'.js'),'utf8'),ctx,{filename:n+'.js'});
const rec={fx:[],sync:[],ui:[],notify:[]};
ctx.GC_BRIDGE={fx(t,p){rec.fx.push({type:t,payload:p});return Promise.resolve()},sync(r){rec.sync.push(r)},ui(s,p){rec.ui.push({screen:s,params:p})},notify(t,k){rec.notify.push({text:t,kind:k})}};
const GC=ctx.GC,old=ctx.__CAMPAIGN_TEST__,GD=ctx.GAME_DATA;
const tick=()=>new Promise(r=>setTimeout(r,0));
const LANE=3;
function freshBattle(spiritId,rank){
 old.setState(old.clone(old.DEFAULT));
 GC.actions.startTestBattle({
  playerHp:10,qi:10,xp:1000,enemyHp:999999,
  allies:[{on:true,id:spiritId,rank}],
  enemies:[0,1,2].map(i=>({on:true,name:'木桩'+(i+1),rank:'F级',potential:1,atk:1,hp:100000,pos:String(i)})),
  cards:[],draw:[]
 });
 const b=GC.state.battle;
 GC.actions.selectHand(0);assert.equal(GC.selection.targetMode,'deploy');
 GC.actions.allyLane(LANE);
 return b;
}
const enemyTargets=()=>GC.state.battle.enemies.filter(e=>!e.dead);
async function castActive(u,name){
 const b=GC.state.battle;b.qi=99;u.cooldowns={};
 GC.actions.cancelSelection();
 const fxBefore=rec.fx.length,syncBefore=rec.sync.length;
 GC.actions.allyTarget(u.lane);
 assert.equal(GC.selection.selected?.kind,'unit',`${name}: unit not selected`);
 GC.actions.exactSpiritSkill(name);
 const tm=GC.selection.targetMode;
 if(tm?.startsWith('exactEnemy:')){
  const e=enemyTargets()[0];
  if(name==='画卷绝杀')e.hp=1;
  GC.actions.enemyTarget(e.uid);
  if(GC.selection.targetMode?.startsWith('confuseSecond:'))GC.actions.enemyTarget(enemyTargets().find(x=>x.uid!==e.uid).uid);
 }else if(tm?.startsWith('exactAlly:')){
  GC.actions.allyTarget(u.lane);
 }
 await tick();
 assert.equal(GC.busy,false,`${name} left busy=true`);
 const ev=rec.fx.slice(fxBefore);
 assert.ok(ev.some(e=>e.type==='skill:cast'&&e.payload?.name===name)||ev.length>0||rec.sync.length>syncBefore,`${u.id}:${name} produced no presentation`);
}
async function main(){
 // ---- all 22 spirits: every unlocked active skill at highest available rank ----
 for(const spirit of GD.spirits){
  const rank=spirit.id==='nannan'?'禁忌':'神阶';
  const b=freshBattle(spirit.id,rank);await tick();
  const u=b.units[LANE];assert.ok(u,`${spirit.id} not deployed`);
  const actives=GD.unlockedSkills(spirit.id,rank).filter(name=>!GD.skillDefs[name]?.passive);
  for(const name of actives){
   if(!GC.state.battle)break;
   await castActive(u,name);
  }
 }
 // ---- all 14 cards through playSkill ----
 const b2=freshBattle('tong','神阶');await tick();
 const caster=b2.units[LANE];
 for(const card of GD.cards){
  const b=GC.state.battle;if(!b)break;
  b.qi=99;caster.dead=false;caster.hp=caster.maxHp;b.units[LANE]=caster;
  if(card.id==='relic')b.grave.push({...old.clone(caster),dead:true,hp:0});
  const i=b.hand.indexOf(card.id);
  if(i<0)b.hand.push(card.id);
  const before=rec.fx.length;
  GC.actions.playSkill(b.hand.indexOf(card.id),LANE);await tick();
  assert.equal(GC.busy,false,`card ${card.id} left busy`);
 }
 assert.equal(rec.fx.filter(e=>e.type==='card:play').length,14,'expected 14 card:play events');
 // ---- all 3 player skills through selectPlayerSkill -> allyTarget ----
 for(let i=0;i<3;i++){
  const b=GC.state.battle;b.qi=99;b.will=10;
  caster.dead=false;caster.hp=caster.maxHp;caster.lane=LANE;b.units[LANE]=caster;
  const before=rec.fx.length;
  GC.actions.selectPlayerSkill(i);
  assert.equal(GC.selection.targetMode,`player:${i}`);
  GC.actions.allyTarget(caster.lane);await tick();
  assert.equal(GC.busy,false,`player skill ${i} left busy`);
  assert.ok(rec.fx.slice(before).some(e=>e.type==='playerSkill'&&e.payload?.index===i),`player skill ${i} produced no event`);
 }
 // ---- status resolution: two full end turns ----
 await GC.actions.endTurn();await tick();
 await GC.actions.endTurn();await tick();
 assert.equal(GC.busy,false,'busy stuck after endTurn');
 console.log(`PASS: ${GD.spirits.length} spirits' active skills, ${GD.cards.length} cards, 3 player skills cast via real inputs; ${rec.fx.length} fx events recorded; no exceptions, busy always reset.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
