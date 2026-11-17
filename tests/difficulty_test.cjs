// Difficulty ladder. Two bots play the whole main route with real inputs:
//  - "plain": deploys ghosts in front of enemies and rings the bell, never uses skills or cards
//  - "skill": additionally fires every ready ghost skill / card at a sensible target (no combos, no planning)
// 简单 must be 100% for the plain bot; harder tiers must punish the plain bot more than the skill bot;
// 噩梦/禁忌 must be impossible for the plain bot beyond the tutorial fight (鬼障).
// Usage: node tests\difficulty_test.cjs [N]            full ladder with assertions
//        $env:DIFF_ONLY='normal,hard'; $env:DIFF_SET='{"normal":{"bite":0.27}}'   exploration: prints rates, skips ladder assertions
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
let seed=1;const ctx={console,localStorage:{getItem:()=>null,setItem:()=>{}},setTimeout,clearTimeout,__HEADLESS__:true};
vm.createContext(ctx);for(const n of ['bridge','codex','vfx','app','polish','mainline-data','mainline-data-2','mainline','playability','facade'])vm.runInContext(fs.readFileSync(`src/rules/${n}.js`,'utf8'),ctx);
ctx.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};vm.runInContext('Math.random=random',ctx);
const A=ctx.__MAINLINE_TEST__,GC=ctx.GC,Q=GC.query,X=GC.actions,order=['easy','normal','hard','nightmare','taboo'];
const only=process.env.DIFF_ONLY?process.env.DIFF_ONLY.split(','):null,explore=!!(only||process.env.DIFF_SET||process.env.DIFF_BOT||process.env.DIFF_CREDIT);
if(process.env.DIFF_SET)for(const [d,o] of Object.entries(JSON.parse(process.env.DIFF_SET)))Object.assign(A.DIFFICULTIES[d],o);
// DIFF_CREDIT=1: a player who reaches act N has won every earlier fight, so a lost fight still credits its xp, plus one 调查 per act.
const MAX=process.env.DIFF_BOT==='max',VERBOSE=!!process.env.DIFF_VERBOSE,CREDIT=!!process.env.DIFF_CREDIT; // DIFF_BOT=max: exploration bot that also over-levels and uses 御鬼者 skills, 鬼主权杖, 画卷绝杀
const tick=()=>new Promise(r=>setTimeout(r,0)),settle=async()=>{for(let i=0;i<50&&GC.busy;i++)await tick();await tick()};
const ENEMY=new Set(['寒冰右手','鬼火','鬼火+','55开','55开+','画卷绝杀','解析','解析+','解析++','解析+++','解析++++','时间梦境','丰都鬼军','寂灭蝶珠','入梦','入梦+','时间删除','空间规律','空间规律+','鬼主权杖']),ALLY=new Set(['白虎驱邪纹','白虎驱邪纹+','时间回退']),SKIP=new Set(['迷惑','绝望','鬼主权杖','鬼域','英灵领域','伞域','55开','55开+','画卷绝杀']);
async function useSkills(b,state){
 if(MAX)for(const i of [1,0]){if(state.battle!==b||b.playerSkillsUsed?.[i])continue;const t=b.units.filter(Boolean).sort((a,c)=>Q.effectiveAttack(c)-Q.effectiveAttack(a))[0];if(!t||Q.playerSkillRestriction(i,t)||i===0&&b.will<b.maxWill*.85)continue;X.cancelSelection();X.selectPlayerSkill(i);X.allyTarget(t.lane);await settle();}
 for(let lane=0;lane<4;lane++){const u=b.units[lane];if(!u||state.battle!==b)continue;
  for(const name of Q.unlockedSkills(u.id,u.rankName)){const d=GC.GD.skillDefs[name]||{};if(state.battle!==b||!b.units[lane])break;
   const special=MAX&&(name==='鬼主权杖'||name==='画卷绝杀');
   if(d.passive||d.toggle||SKIP.has(name)&&!special||Q.cooldown(u,name)||b.qi<(d.cost||0)||(d.once||d.oncePerBattle)&&u.onceUsed?.[name])continue;
   let foes=b.enemies.filter(e=>!e.dead);if(!foes.length)return;
   if(name==='画卷绝杀')foes=foes.filter(e=>e.hp/e.maxHp<.15);if(name==='鬼主权杖')foes=foes.filter(e=>(e.rankIndex??0)<20);if(!foes.length)continue;
   X.cancelSelection();X.allyTarget(lane);X.exactSpiritSkill(name);
   const m=GC.selection.targetMode||'';
   if(m.startsWith('exactEnemy:'))X.enemyTarget(foes.sort((a,c)=>c.hp-a.hp)[0].uid);
   else if(m.startsWith('exactAlly:')){const w=b.units.filter(Boolean).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp)[0];X.allyTarget(w.lane)}
   await settle();X.cancelSelection();
  }}
 for(let k=0;k<6&&state.battle===b;k++){const i=b.hand.findIndex(e=>typeof e==='string'&&GC.SKILLS[e]&&!['rope','taboo','bloodmoon','valhalla','relic'].includes(e)&&b.qi>=GC.SKILLS[e].cost+1);if(i<0)break;const id=b.hand[i],t=b.units.filter(Boolean).sort((a,c)=>id.startsWith('coin')?a.hp/a.maxHp-c.hp/c.maxHp:Q.effectiveAttack(c)-Q.effectiveAttack(a))[0];if(GC.SKILLS[id].target==='ally'&&(!t||id.startsWith('coin')&&t.hp/t.maxHp>.7))break;X.cancelSelection();X.selectHand(i);if(GC.selection.targetMode==='ally')X.allyTarget(t.lane);await settle();}
 X.cancelSelection();
}
// DIFF_BOT=max — a paced player: breaks the ward as cheaply as it can every round and keeps long-cooldown skills for later rounds
// instead of firing everything at once. Still no lane planning or combos; it is a feasibility probe, not an upper bound.
async function usePaced(b,state){
 for(const i of [1,0]){if(state.battle!==b||b.playerSkillsUsed?.[i])continue;const t=b.units.filter(Boolean).sort((a,c)=>Q.effectiveAttack(c)-Q.effectiveAttack(a))[0];if(!t||Q.playerSkillRestriction(i,t)||i===0&&b.will<b.maxWill*.85)continue;X.cancelSelection();X.selectPlayerSkill(i);X.allyTarget(t.lane);await settle();}
 for(let guard=0;guard<14&&state.battle===b;guard++){
  const foesAll=b.enemies.filter(e=>!e.dead);if(!foesAll.length)return;
  const w=Q.wardInfo(b),need=w?w.layers-w.casts:0,opts=[];
  for(let lane=0;lane<4;lane++){const u=b.units[lane];if(!u)continue;for(const name of Q.unlockedSkills(u.id,u.rankName)){const d=GC.GD.skillDefs[name]||{};
   if(d.passive||d.toggle||['迷惑','绝望','55开','55开+'].includes(name)||Q.cooldown(u,name)||b.qi<(d.cost||0)||(d.once||d.oncePerBattle)&&u.onceUsed?.[name])continue;
   let foes=foesAll;if(name==='画卷绝杀')foes=foes.filter(e=>e.hp/e.maxHp<.15);if(name==='鬼主权杖')foes=foes.filter(e=>(e.rankIndex??0)<20);if(!foes.length)continue;
   opts.push({kind:'skill',lane,name,cd:d.cooldown||0,cost:d.cost||0,foes,kill:name==='画卷绝杀'||name==='鬼主权杖'});}}
  b.hand.forEach((id,i)=>{const c=typeof id==='string'&&GC.SKILLS[id];if(!c||['rope','taboo','bloodmoon','valhalla','relic'].includes(id)||b.qi<c.cost)return;const heal=id.startsWith('coin'),t=b.units.filter(Boolean).sort((a,c2)=>heal?a.hp/a.maxHp-c2.hp/c2.maxHp:Q.effectiveAttack(c2)-Q.effectiveAttack(a))[0];if(c.target==='ally'&&!t)return;opts.push({kind:'card',i,id,cd:0,cost:c.cost,t,filler:heal&&t.hp/t.maxHp>.7});});
  if(!opts.length)break;
  const longReady=opts.filter(o=>o.kind==='skill'&&o.cd>=3).length;let pick;
  if(need>0)pick=opts.sort((a,c)=>(c.kill?1:0)-(a.kill?1:0)||a.filler-c.filler&&0||a.cost-c.cost||a.cd-c.cd)[0];
  else pick=opts.filter(o=>o.kill||(o.kind==='skill'?(o.cd<=2||longReady>2*(w?.layers||1)):!o.filler&&b.qi-o.cost>=2)).sort((a,c)=>(c.kill?1:0)-(a.kill?1:0)||a.cd-c.cd)[0];
  if(!pick)break;
  X.cancelSelection();
  if(pick.kind==='card'){X.selectHand(pick.i);if(GC.selection.targetMode==='ally')X.allyTarget(pick.t.lane)}
  else{X.allyTarget(pick.lane);X.exactSpiritSkill(pick.name);const m=GC.selection.targetMode||'';
   if(m.startsWith('exactEnemy:'))X.enemyTarget([...pick.foes].sort((a,c)=>c.hp-a.hp)[0].uid);
   else if(m.startsWith('exactAlly:')){const t=b.units.filter(Boolean).sort((a,c)=>a.hp/a.maxHp-c.hp/c.maxHp)[0];X.allyTarget(t.lane)}}
  await settle();X.cancelSelection();
 }
}
async function campaign(diff,iteration,skilled){
 seed=iteration*977+order.indexOf(diff);A.newSlot(0,'normal','d',diff);const state=A.getState();let wins=0,fights=0,turns=0;const won=[];
 A.grantContract(A.ML.arcs[0].contracts[0]);
 for(const arc of A.ML.arcs){
  A.grantTraining(arc.act-1);A.trainTeam(arc.act-1);
  if(MAX)for(let g=0;g<400;g++){const pool=state.spirits.filter(s=>s.id!=='nannan').sort((a,b)=>b.rankIndex-a.rankIndex||b.atk-a.atk).slice(0,4).sort((a,b)=>a.rankIndex-b.rankIndex);if(!pool.some(s=>Q.upgradeGhostRecord(s)))break}
  A.fullHeal();
  const team=state.spirits.filter(s=>s.id!=='nannan').sort((a,b)=>b.rankIndex-a.rankIndex||b.atk-a.atk).slice(0,6);
  state.squad=team.map(s=>s.id);const credit=CREDIT?A.rewardInfo(arc.id+'-battle').xp+GC.GD.ranks[Math.max(0,arc.rank-1)].killXp:0;A.startBattle(arc.id+'-battle');const b=state.battle;let turn=0;
  while(state.battle===b&&turn++<40){
   for(let k=0;k<4;k++){const hi=b.hand.findIndex(e=>Q.handSpirit(e));if(hi<0||b.qi<Q.spiritCost())break;const lanes=[0,1,2,3].filter(l=>!b.units[l]);if(!lanes.length)break;const lane=lanes.find(l=>b.enemies.some(e=>!e.dead&&e.lane===l))??lanes[0];X.selectHand(hi);await X.deployGhost(hi,lane);}
   if(skilled)await (MAX?usePaced:useSkills)(b,state);
   if(state.battle===b)await X.endTurn();
  }
  fights++;turns+=turn;const ok=!!state.pendingSettlement&&state.battle==null&&A.getState()===state;
  if(ok){wins++;won.push(arc.id);state.pendingSettlement=null;}else{A.setState(state);state.battle=null;state.pendingSettlement=null;for(const s of state.spirits){s.dead=false;s.hp=s.maxHp}}
  if(credit)state.xp+=ok?credit-A.rewardInfo(arc.id+'-battle').xp:credit;
  for(const c of arc.contracts)A.grantContract(c);
 }
 return {wins,fights,won,turns};
}
// 鬼障: without an active cast in the round, neither enemy units nor the enemy life pool can be damaged, however strong the attackers are.
async function wardChecks(){
 for(const d of order){A.newSlot(0,'normal','d',d);A.grantContract(A.ML.arcs[0].contracts[0]);A.startBattle('a01-battle');assert.equal(A.getState().battle.ward,0,`tutorial must have no ward on ${d}`);}
 // soft ward on 普通/困难: skill-less rounds still hurt, but less; it eases in over the first acts
 for(const [d,full] of [['normal',.6],['hard',.4]]){A.newSlot(0,'normal','d',d);A.grantContract(A.ML.arcs[0].contracts[0]);const s=A.getState();
  A.startBattle('a02-battle');assert.equal(s.battle.ward,1);assert.ok(s.battle.wardBase>full&&s.battle.wardBase<1,`${d} early ward is softer`);assert.equal(A.wardFactor(s.battle),s.battle.wardBase);
  s.battle=null;A.startBattle('a20-battle');assert.equal(s.battle.wardBase,full);assert.equal(A.wardFactor(s.battle),full);}
 for(let [d,node,layers] of [['easy','a02-battle',0],['easy','a20-battle',0],['nightmare','a02-battle',1],['nightmare','a20-battle',1],['taboo','a02-battle',1],['taboo','a20-battle',2]]){
  seed=4242;A.newSlot(0,'normal','d',d);A.grantContract(A.ML.arcs[0].contracts[0]);const s=A.getState();
  for(const g of s.spirits){g.maxHp=g.hp=1e7;g.atk=1e7;g.rankIndex=22;g.rankName=GC.GD.ranks[22].name;g.level=23}
  s.deck=Array(12).fill('coin');
  A.startBattle(node);const b=s.battle;assert.equal(b.ward,layers,`${d} ${node} ward layers`);
  assert.equal(A.enemyRoster(node)[0].bossTraits.includes('鬼障'),layers>0,`${d} 鬼障 listed on the lead enemy`);
  if(!layers)continue;
  assert.equal(b.wardBase,0,`${d}: no damage at all without casts`);d=d+' '+node;
  const hi=b.hand.findIndex(e=>Q.handSpirit(e)),foeLane=b.enemies[0].lane;X.selectHand(hi);await X.deployGhost(hi,foeLane);
  const hi2=b.hand.findIndex(e=>Q.handSpirit(e)),free=[0,1,2,3].find(l=>!b.units[l]&&!b.enemies.some(e=>!e.dead&&e.lane===l));
  if(hi2>=0&&free!=null&&b.qi>=Q.spiritCost()){X.selectHand(hi2);await X.deployGhost(hi2,free);}
  const hp0=b.enemies.map(e=>e.hp),will0=b.enemyWill;
  for(let t=0;t<4&&s.battle===b;t++)await X.endTurn();
  assert.equal(s.battle,b,`${d}: battle must still be running after 4 skill-less rounds`);
  assert.deepEqual(b.enemies.map(e=>e.hp),hp0,`${d}: enemy units must be untouched without casts`);assert.equal(b.enemyWill,will0,`${d}: enemy life pool must be untouched without casts`);
  assert.equal(A.wardFactor(b),0);
  const play=async()=>{const i=b.hand.findIndex(e=>e==='coin');assert.ok(i>=0&&b.qi>=1,'need a coin card');const u=b.units.find(Boolean);u.hp=u.maxHp/2;X.cancelSelection();X.selectHand(i);X.allyTarget(u.lane);await settle();};
  await play();assert.equal(A.wardFactor(b),1/layers,`${d}: one cast`);
  if(layers>1){await play();assert.equal(A.wardFactor(b),1,`${d}: two casts`);}
  await X.endTurn();
  assert.ok(s.battle!==b||b.enemies.some((e,i)=>e.hp<hp0[i])||b.enemyWill<will0,`${d}: attacks must land once the ward is broken`);
  if(s.battle===b)assert.equal(A.wardFactor(b),0,`${d}: ward closes again next round`);
 }
}
(async()=>{
 for(const id of ['a05-battle','a30-battle','a46-battle']){let prev=null;for(const d of order){A.newSlot(0,'normal','d',d);const r=A.enemyRoster(id),power=r.reduce((s,e)=>s+e.hp*e.atk,0),skills=r.reduce((s,e)=>s+e.bossSkills.length+e.bossTraits.length,0);for(const e of r)for(const s of [...e.bossSkills,...e.bossTraits])assert.ok(A.BOSS_SKILLS[s],s);if(prev){assert.ok(power>prev.power,`${id} ${d} power`);assert.ok(skills>=prev.skills,`${id} ${d} skills`);}prev={power,skills};}}
 A.newSlot(0,'normal','d','easy');A.grantContract(A.ML.arcs[0].contracts[0]);const s=A.getState();A.startBattle('a01-battle');assert.equal(s.battle.maxWill,10);assert.equal(s.battle.maxEnemyWill,10);
 s.battle=null;s.spirits[0].maxHp=s.spirits[0].hp=640;s.will=5;A.startBattle('a02-battle');assert.equal(s.battle.maxWill,640);assert.equal(s.battle.maxEnemyWill,640);assert.equal(s.battle.will,320);
 if(!process.env.DIFF_SET){await wardChecks();console.log('PASS: 鬼障 weakens skill-less rounds on 普通/困难, blocks them on 噩梦/禁忌, and opens after 1 / 2 casts.');}
 const plain={},skill={},N=+(process.argv[2]||2),run=only||order,rounds={};
 for(const d of run){let w=0,f=0,w2=0,f2=0,t=0,t2=0;for(let i=1;i<=N;i++){const r=await campaign(d,i,false);w+=r.wins;f+=r.fights;t+=r.turns;if(A.DIFFICULTIES[d].ward&&A.DIFFICULTIES[d].wardBase===0)assert.deepEqual(r.won.filter(id=>id!==A.ML.arcs[0].id),[],`${d}: the skill-less bot won ${r.won}`);const q=await campaign(d,i,true);w2+=q.wins;f2+=q.fights;t2+=q.turns;if(VERBOSE)console.log(d,'run',i,'lost acts — plain:',A.ML.arcs.filter(a=>!r.won.includes(a.id)).map(a=>a.act).join(','),'| skill:',A.ML.arcs.filter(a=>!q.won.includes(a.id)).map(a=>a.act).join(','))}plain[d]=w/f;skill[d]=w2/f2;rounds[d]=[t/f,t2/f2];}
 const line=o=>run.map(d=>`${A.DIFFICULTIES[d].name} ${Math.round(o[d]*100)}%`).join(' / ');
 console.log('plain bot: '+line(plain));console.log('skill bot: '+line(skill));console.log('avg rounds (plain/skill): '+run.map(d=>`${A.DIFFICULTIES[d].name} ${rounds[d].map(v=>v.toFixed(1)).join('/')}`).join('  '));
 if(explore)return;
 assert.equal(plain.easy,1,'简单 must be clearable without skills');
 for(let i=1;i<order.length;i++)assert.ok(plain[order[i]]<=plain[order[i-1]]+.03,'plain bot must not get stronger on harder tiers');
 for(const d of order)assert.ok(skill[d]>=plain[d]-.04,'using skills must not be worse on '+d);
 assert.ok(plain.normal<=.92&&skill.normal>=.85,'普通: skills should help and mostly suffice');
 // The naive skill bot's 困难 rate is 81-91% per seeded run (86% over two), so the bound has to sit above a single run's spread.
 assert.ok(plain.hard<=.8&&skill.hard<=.93&&skill.hard<=skill.normal-.04,'困难 too soft');
 assert.ok(plain.nightmare<=1/46+1e-9&&plain.taboo<=1/46+1e-9,'噩梦/禁忌: only the tutorial fight may be won without skills');
 assert.ok(skill.nightmare<=.5&&skill.taboo<=.1,'upper tiers too soft for the naive skill bot');
 console.log('PASS: difficulty ladder; life pools follow the strongest squad ghost.');
})().catch(e=>{console.error(e);process.exit(1)});
