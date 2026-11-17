// Conservative balance check: no player active skills, no buffs or resurrection.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const RULES=path.join(__dirname,'..','src','rules');
let seed=1;const ctx={console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout,__HEADLESS__:true};
vm.createContext(ctx);for(const n of ['bridge','codex','vfx','app','polish','mainline-data','mainline-data-2','mainline','expansion','facade'])vm.runInContext(fs.readFileSync(path.join(RULES,n+'.js'),'utf8'),ctx,{filename:n+'.js'});
ctx.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};vm.runInContext('Math.random=random',ctx);
const A=ctx.__MAINLINE_TEST__,old=ctx.__CAMPAIGN_TEST__,GD=ctx.GAME_DATA;
const fail=[];let trials=0,worstTurns=0;
async function run(){
 for(let iteration=1;iteration<=40;iteration++){
  seed=iteration;A.newSlot(0,'normal','balance');let state=A.getState();
  A.grantContract(A.ML.arcs[0].contracts[0]);
  for(const arc of A.ML.arcs){
   A.grantTraining(arc.act-1);A.trainTeam(arc.act-1);A.fullHeal();
   const team=state.spirits.filter(s=>s.id!=='nannan').sort((a,b)=>b.rankIndex-a.rankIndex||b.atk-a.atk).slice(0,4);
   state.squad=team.map(s=>s.id);A.startBattle(arc.id+'-battle');const b=state.battle;let turn=0;
   while(turn++<30&&b.will>0&&!A.allEnemiesDefeated(b)&&b.enemyWill>0){
    // Place affordable reserves into occupied enemy lanes before choosing empty lanes.
    for(const s of team){if(b.units.some(u=>u?.id===s.id)||s.dead)continue;const cost=b.deployedCount+1;if(b.qi<cost)break;const lane=[0,1,2,3].find(l=>!b.units[l]&&b.enemies.some(e=>!e.dead&&e.lane===l))??[0,1,2,3].find(l=>!b.units[l]);if(lane==null)break;b.qi-=cost;b.deployedCount++;b.units[lane]=old.initUnit({...old.clone(s),uid:'p-'+s.id,lane});}
    // Reposition surviving ghosts into unguarded enemy lanes (using actual movement cost).
    for(const e of b.enemies.filter(e=>!e.dead))if(!b.units[e.lane]){const u=b.units.find(u=>u&&!u.dead&&!b.enemies.some(x=>!x.dead&&x.lane===u.lane));if(u&&b.qi>=Math.abs(e.lane-u.lane)){b.qi-=Math.abs(e.lane-u.lane);b.units[u.lane]=null;u.lane=e.lane;b.units[e.lane]=u;}}
    for(const u of b.units.filter(u=>u&&!u.dead)){
     const skip=Object.values(u.effects||{}).find(e=>e.skip>0);if(skip){skip.skip--;continue;}
     const target=b.enemies.find(e=>!e.dead&&e.lane===u.lane);
     if(target)old.dealRawDamage(u,target,old.skillDamage(u,target,1),'普通攻击');
     else b.enemyWill-=Math.min(b.maxEnemyWill*.2,old.rollAttackDamage(u,old.effectiveAttack(u)));
    }
    old.cleanup();if(A.allEnemiesDefeated(b)||b.enemyWill<=0)break;
    await A.enemySkills(b);
    for(const e of b.enemies.filter(e=>!e.dead)){
     const skip=Object.values(e.effects||{}).find(x=>x.skip>0);if(skip){skip.skip--;continue;}
     const u=b.units[e.lane];if(u&&!u.dead)old.dealRawDamage(e,u,old.skillDamage(e,u,1),'普通攻击');
     else b.will-=Math.min(b.maxWill*.2,old.rollAttackDamage(e,old.effectiveAttack(e)));
    }
    old.cleanup();await old.advanceStatuses();b.turn++;b.maxQi=Math.min(Math.max(10,b.deployedCount+1),b.maxQi+1);b.qi=b.maxQi;
    if(state.spirits.every(s=>s.dead))break;
   }
   trials++;worstTurns=Math.max(worstTurns,turn);
   if(b.will<=0||(!A.allEnemiesDefeated(b)&&b.enemyWill>0))fail.push({iteration,act:arc.act,title:arc.title,turn,life:b.will,team:team.map(s=>s.rankName)});
   state.battle=null;for(const c of arc.contracts)A.grantContract(c);
  }
 }
 fs.mkdirSync(path.join(__dirname,'out'),{recursive:true});
 fs.writeFileSync(path.join(__dirname,'out','mainline-balance-result.json'),JSON.stringify({trials,worstTurns,fail},null,2));
 assert.equal(fail.length,0,JSON.stringify(fail.slice(0,8)));console.log(`PASS: ${trials} seeded main-route fights without active skills; worst ${worstTurns} rounds.`);
}
run().catch(e=>{console.error(e);process.exit(1)});
