// Drives real battles through the real input entry points only (selectHand/allyLane/endTurn),
// with a recording bridge. Verifies event coverage, payload completeness and serializability.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const RULES=path.join(__dirname,'..','src','rules');
let seed=1;
const ctx={console,setTimeout,clearTimeout,queueMicrotask,__HEADLESS__:true,localStorage:{getItem:()=>null,setItem:()=>{}}};
vm.createContext(ctx);
for(const n of ['bridge','codex','vfx','app','polish','mainline-data','mainline-data-2','mainline','playability','expansion','facade'])vm.runInContext(fs.readFileSync(path.join(RULES,n+'.js'),'utf8'),ctx,{filename:n+'.js'});
const rec={fx:[],sync:[],ui:[],notify:[]};
ctx.GC_BRIDGE={fx(t,p){rec.fx.push({type:t,payload:p});return Promise.resolve()},sync(r){rec.sync.push(r)},ui(s,p){rec.ui.push({screen:s,params:p})},notify(t,k){rec.notify.push({text:t,kind:k})}};
ctx.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
vm.runInContext('Math.random=random',ctx);
const GC=ctx.GC,ML=ctx.__MAINLINE_TEST__,old=ctx.__CAMPAIGN_TEST__,GD=ctx.GAME_DATA;
const AWAITED={
 'battle:enter':['testMode','nodeId'],'turn:start':['turn','qi','maxQi'],'draw':['count'],
 'deploy':['uid','id','lane','handIndex','cost','deployedCount'],'move':['uid','from','to','swapUid','cost'],
 'attack':['attacker','target','damage','critical','reductionPct','killed','targetHp','targetMaxHp'],
 'direct':['attacker','damage','critical','outcome','redirect','will','enemyWill'],
 'skill:cast':['name','source','targets','theme','motion','scope'],
 'card:play':['cardId','handIndex','target','message'],'playerSkill':['index','name','target'],
 'boss:cast':['uid','lane','name','kind'],'unit:skip':['uid','side','lane','label','reason'],
 'banner':['text','tone'],'deaths':['units'],'return':['uid','id','kind','handIndex'],
 'enemy:return':['uid','lane'],'status:tick':['uid','side','lane','kind','label','value','hp','maxHp'],
 'battle:win':['testMode'],'battle:lose':['testMode']
};
function plain(v,depth=0){if(depth>12)return false;if(v===null||v===undefined)return true;const t=typeof v;if(t==='string'||t==='number'||t==='boolean')return true;if(t!=='object')return false;const tag=Object.prototype.toString.call(v);if(tag==='[object Array]')return v.every(x=>plain(x,depth+1));return tag==='[object Object]'&&Object.values(v).every(x=>plain(x,depth+1))}
function checkPayloads(){for(const e of rec.fx){assert.ok(plain(e.payload),`fx ${e.type} payload contains non-plain data`);assert.doesNotThrow(()=>JSON.stringify(e.payload),`fx ${e.type} not serializable`);const req=AWAITED[e.type];if(req)for(const f of req)assert.ok(e.payload&&e.payload[f]!==undefined,`fx ${e.type} missing field ${f}: ${JSON.stringify(e.payload)}`)}}
const tick=()=>new Promise(r=>setTimeout(r,0));
const isGhostEntry=h=>typeof h==='string'?GD.spirits.some(s=>s.id===h):h?.kind==='ghost';
async function deployAffordable(){
 const b=GC.state.battle;
 for(let i=0;i<b.hand.length;i++){
  if(!isGhostEntry(b.hand[i]))continue;
  const lane=[0,1,2,3].find(l=>!b.units[l]);if(lane==null)return;
  if(b.qi<b.deployedCount+1)return;
  GC.actions.selectHand(i);
  if(GC.selection.targetMode!=='deploy'){GC.actions.cancelSelection();continue}
  GC.actions.allyLane(lane);await tick();
 }
}
async function playBattle(maxTurns=60){
 let turns=0;
 while(GC.state.battle&&turns++<maxTurns){await deployAffordable();await GC.actions.endTurn();await tick()}
 return turns;
}
function settle(){const r=GC.state.pendingSettlement;if(r){r.remaining=0;GC.actions.finishSettlement()}}
async function main(){
 // ---- Act 1: full real-input battle from a fresh slot ----
 GC.actions.newSlot(0,'normal','循环测试');
 ML.grantContract(ML.ML.arcs[0].contracts[0]);
 ML.completeNode('a01-story');
 GC.actions.startBattle('a01-battle');
 let b=GC.state.battle;
 const spiritsInHand=b.hand.filter(isGhostEntry).length;
 const expected=Math.min(6,Math.min(3,GC.state.spirits.filter(s=>!s.dead).length)+Math.min(25,GC.state.deck.length)+Math.max(0,GC.state.spirits.filter(s=>!s.dead).length-3));
 assert.equal(b.hand.length,expected,`opening hand ${b.hand.length} != expected ${expected}`);
 assert.ok(b.hand.includes('tong')||b.hand.some(h=>h?.unit?.id==='tong'),'opening hand must include Tong Tong');
 const turns1=await playBattle();
 assert.ok(!GC.state.battle,`act1 battle did not conclude in 60 turns`);
 assert.equal(GC.busy,false,'busy must reset after battle');
 const types=new Set(rec.fx.map(e=>e.type));
 assert.ok(types.has('deploy'),'missing deploy event');
 assert.ok(types.has('attack')||types.has('direct'),'missing attack/direct event');
 assert.ok(types.has('turn:start'),'missing turn:start event');
 assert.ok(types.has('draw'),'missing draw event');
 assert.ok(types.has('battle:win'),'missing battle:win event');
 assert.ok(GC.state.pendingSettlement,'act1 should end in settlement');
 checkPayloads();
 settle();
 // ---- Acts 2-6: seeded battles after the balance-test style preparation ----
 for(let arc=2;arc<=6;arc++){
  seed=arc;
  for(let a=0;a<arc;a++)for(const c of ML.ML.arcs[a].contracts)ML.grantContract(c);
  ML.grantTraining(arc-1);ML.trainTeam(arc-1);ML.fullHeal();
  const state=GC.state;
  const team=state.spirits.filter(s=>s.id!=='nannan').sort((a,b)=>b.rankIndex-a.rankIndex||b.atk-a.atk).slice(0,4);
  state.squad=team.map(s=>s.id);
  const mark=rec.fx.length;
  GC.actions.startBattle(`a0${arc}-battle`);
  const turns=await playBattle();
  assert.ok(!GC.state.battle,`act${arc} battle did not conclude within 60 turns`);
  assert.equal(GC.busy,false,`busy stuck after act${arc}`);
  assert.ok(rec.fx.slice(mark).some(e=>e.type==='battle:win'||e.type==='battle:lose'),`act${arc} produced no win/lose event`);
  settle();
 }
 checkPayloads();
 console.log(`PASS: act1 real-input battle won in ${turns1} turns with ${rec.fx.length} recorded fx events; acts 2-6 completed via selectHand/allyLane/endTurn; all payloads plain JSON data.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
