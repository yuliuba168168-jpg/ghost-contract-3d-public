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
 console.log(`expansion_test PASS: ${played}/${ids.length} new cards played`);
})().catch(e=>{console.error(e);process.exit(1)});
