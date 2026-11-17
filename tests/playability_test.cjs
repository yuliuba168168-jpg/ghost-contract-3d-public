const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const RULES=path.join(__dirname,'..','src','rules');
const store={};const ctx={console,setTimeout,clearTimeout,__HEADLESS__:true,localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v}};vm.createContext(ctx);
for(const name of ['bridge','codex','vfx','app','polish','mainline-data','mainline-data-2','mainline','playability','expansion','facade'])vm.runInContext(fs.readFileSync(path.join(RULES,name+'.js'),'utf8'),ctx,{filename:name+'.js'});
const api=ctx.__MAINLINE_TEST__,old=ctx.__CAMPAIGN_TEST__,G=ctx.GAME_DATA;
const cast=vm.runInContext('usePlayerSkill',ctx),restriction=vm.runInContext('playerSkillRestriction',ctx);
async function run(){
 assert.equal(ctx.PLAY_GUIDE.length,26);for(const topic of ['部署','移动','御鬼者','升级','测试台','存档','声音'])assert.ok(ctx.PLAY_GUIDE.some(g=>g.join('').includes(topic)));
 for(const [skill,min] of [[0,10],[1,13],[2,17]]){
  api.newSlot(0,'endless','等级限制');api.startBattle('endless-arena');let s=api.getState(),b=s.battle;s.xp=1000;
  const u=old.initUnit({...old.clone(s.spirits[0]),uid:'p-rule',lane:0,rankIndex:min-1,rankName:G.ranks[min-1].name});b.units[0]=u;
  const before=JSON.stringify({hp:u.hp,will:b.will,xp:s.xp,effects:u.effects,extra:u.extraAdd});await cast(skill,0);
  assert.equal(JSON.stringify({hp:u.hp,will:b.will,xp:s.xp,effects:u.effects,extra:u.extraAdd}),before,'invalid target must not alter resources');assert.ok(!b.playerSkillsUsed[skill]);
  u.rankIndex=min;u.rankName=G.ranks[min].name;assert.equal(restriction(skill,u),'');await cast(skill,0);assert.equal(b.playerSkillsUsed[skill],true);assert.ok(u.effects[['bloodSacrifice','heroFusion','divineFire'][skill]]);
  assert.equal(restriction(skill,{rankName:G.ranks[min].name}),'');assert.ok(restriction(skill,{rankName:G.ranks[min-1].name}));
 }
 api.newSlot(1,'endless','伤势续存');api.startBattle('endless-arena');let s=api.getState(),b=s.battle;
 const tong=s.spirits.find(x=>x.id==='tong'),xuan=s.spirits.find(x=>x.id==='xuan');
 b.hand=b.hand.filter(x=>x!=='tong'&&x!=='xuan');b.units[0]=old.initUnit({...old.clone(tong),uid:'p-tong',lane:0,hp:12});b.units[1]=old.initUnit({...old.clone(xuan),uid:'p-xuan',lane:1,hp:0,dead:true});b.enemies.forEach(e=>e.dead=true);
 await api.winBattle();assert.equal(tong.hp,12);assert.equal(xuan.dead,true);assert.equal(xuan.hp,0);s.pendingSettlement.remaining=0;api.finishSettlement();assert.equal(s.wave,2);assert.equal(tong.hp,12);assert.equal(xuan.dead,true);assert.equal(s.will,10);
 api.save();api.loadSlot(1);s=api.getState();assert.equal(s.spirits.find(x=>x.id==='tong').hp,12);assert.equal(s.spirits.find(x=>x.id==='xuan').dead,true);api.startBattle('endless-arena');assert.ok(!s.battle.hand.includes('xuan'));assert.equal(s.spirits.find(x=>x.id==='tong').hp,12);
 console.log('PASS: 26 guide topics; all three skill level boundaries reject without resource consumption; endless injuries and deaths persist across rewards, reload and next wave.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
