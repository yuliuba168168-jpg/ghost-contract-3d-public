const SAVE='youqi-campaign-v1';
let preferences={speed:1,sound:true,reduceFlash:false};
try{preferences={...preferences,...JSON.parse(localStorage.getItem('youqi-presentation')||'{}')}}catch{}
globalThis.presentationPreferences=preferences;
function soundCue(kind='hit'){globalThis.GC_BRIDGE.fx('sound',{kind})}
function presentationSettings(){if(busy)return;globalThis.GC_BRIDGE.ui('settings')}
function applyPresentationSettings(next={}){if(next.speed!=null)preferences.speed=+next.speed;if(next.sound!=null)preferences.sound=!!next.sound;if(next.reduceFlash!=null)preferences.reduceFlash=!!next.reduceFlash;localStorage.setItem('youqi-presentation',JSON.stringify(preferences))}

const GD=globalThis.GAME_DATA||{ranks:[],spirits:[],skillDefs:{},cards:[],playerSkills:[],rankIndex:()=>0,statsForRank:()=>({hp:1,atk:1}),unlockedSkills:()=>[]};
function spiritStats(id,rank,potential){return id==='nannan'?{hp:100000,atk:100}:GD.statsForRank(rank,potential)}

const SKILLS={
 coin:{name:'鬼币',cost:1,icon:'币',desc:'恢复一名己方鬼灵10%生命',target:'ally',rarity:'普通'},
 blade:{name:'鬼刀',cost:3,icon:'刀',desc:'一名己方鬼灵本场攻击增加10%',target:'ally',rarity:'稀有'},
 revive:{name:'复苏',cost:2,icon:'苏',desc:'抽3张牌',target:'none',rarity:'珍藏'},
 relic:{name:'鬼舍利',cost:4,icon:'舍',desc:'复活一名己方鬼灵',target:'grave',rarity:'珍藏'},
 horse:{name:'鬼马',cost:2,icon:'马',desc:'一名己方鬼灵本回合行动两次',target:'ally',rarity:'稀有'}
};
for(const c of GD.cards)SKILLS[c.id]={...c,icon:c.name[0]};
const ENEMIES={
 stray:{name:'失控恶灵',flavor:'学生体内翻出的灰白鬼影',art:'shadow'},
 daily:{name:'旧楼恶灵',flavor:'墙皮后传来指甲刮擦声',art:'shadow'},
 house:{name:'洋房怨灵',flavor:'空房里反复响起关门声',art:'shadow'},
 shade:{name:'黑影恶灵',flavor:'影子沿着别墅外墙倒爬',art:'shadow'},
 hungry:{name:'饿死鬼',flavor:'粮仓里只剩咀嚼和吞咽声',art:'hunger'},
 hanged:{name:'吊死鬼',flavor:'草绳在果树间自行收紧',art:'rope'},
 granny:{name:'鬼婆婆',flavor:'苍老怪笑撑开一座旧村鬼域',art:'granny'},
 rogue:{name:'御鬼者恶灵',flavor:'被贪念驱使的凶灵',art:'shadow'},
 nightmare:{name:'海城游鬼',flavor:'霓虹熄灭后从路口经过的影子',art:'shadow'},
 general:{name:'无头将军',flavor:'铁骑撞碎层叠鬼域',art:'general'},
 tide:{name:'鬼潮恶灵',flavor:'防线外密密麻麻的幽影',art:'tide'},
 nun:{name:'鬼尼姑',flavor:'木鱼声里，寂照庵的门缓缓开启',art:'nun'}
};
const STORY={
 intro:'全球诡异降临后，人类依托基地市艰难生存。十五岁的启灵日，林风握紧从小陪伴自己的红色波点蝴蝶结，等待那个沉睡多年的存在睁开眼睛。',
 awaken:'蝴蝶结从掌心飞起，白裙小女孩在冷光中现身。她叫童童。教室深处却有人失控，恶灵从学生身体里挤出，第一场契约之战立刻开始。',
 paper:'大红纸人走上讲台，纸做的眼睛扫过每一个人。它点名林风示范唤醒，也宣告：从今天起，所有人都要靠自己的鬼灵活下去。',
 housing:'外城的住房里封着不同等级的恶灵。旧楼最安全，洋房更危险，别墅区的黑影则足以让新人丧命。住处，也是一场考验。',
 town:'二号粮食小镇的仓库夜夜少粮。守卫不敢进入最深处，那里传出的不是脚步声，而是永远吃不饱的咀嚼声。',
 orchard:'果林里的果农被草绳吊在树上。绳索没有主人，却会追逐活人的脖颈。林风让童童先退一步，等待它露出真正的形体。',
 hunters:'贺海等人追着奖励而来。他们把林风当作猎物，也把自己的鬼灵当作掠夺工具。山路狭窄，这一次没有退让的余地。',
 mountain:'小奉山的荒寺重新亮起烛火。鬼婆婆铺开的旧村鬼域压住山道，而更深处，断续的木鱼声正把所有鬼灵引向同一个地方。',
 jizhao:'牌匾上写着“寂照庵”。木鱼一响，鬼婆婆与童童同时向门内走去。林风用鬼绳强行拉回童童，她却在关门前抢出一双崭新的红色绣花鞋。',
 shoe:'红绣鞋落在掌心后安静得像普通物件。系统提示：将它送还给主人，第二份鬼灵契约才可能开始。',
 comb:'嫁衣新娘没有拒绝鞋子。闺房的铜镜蒙着雾，林风拿起木梳，一下一下梳过她及腰的长发。镜中的红衣身影始终没有眨眼。',
 night:'鬼域合拢，宅院外的一切都消失了。林风必须在这里住过一夜。烛火熄灭后，脚步声在门外停了很久。',
 meal:'清晨，嫁衣新娘递来一碗白饭。那是鬼饭，也可能是一次试探。林风只吃了一口，米饭却有真实的温度。',
 sedan:'红毯从闺房一直铺向门外，鬼轿已停在尽头。嫁衣新娘戴上红盖头，正一步步离开。林风冲上去掀开盖头，阻止了这场并非自愿的出嫁。',
 contract:'一滴血落在萱华唇边。红衣女鬼停下脚步，契约完成。她依旧安静，却第一次没有走向鬼轿。',
 haicheng:'海城比柳城更繁华，也藏着更强的鬼。联盟挂职、拍卖行与猎鬼委托同时开放，新的路线从这里分岔。',
 post:'林风抢下鬼邮差的包，从里面找到一封女鬼求救信：“救我，鬼气很浓，比我厉害。”信纸冰冷，寄件地却指向柳城。',
 defeat:'卓会长的围剿队伍败退。七重鬼域前，无头将军甚至没有展开自己的鬼域，只凭铁骑一次冲撞便让屏障同时破碎。',
 general:'无头将军从雾中策马而来。童童与萱华并肩站定，远处残存的御鬼者也放出鬼灵。这将是离开海城前最艰难的一战。',
 tide:'柳城西防线外，鬼潮像黑色海水一样压来。每一道缺口都有人倒下，林风只能带着两只鬼灵沿防线逐段清理。',
 letter:'第二次截住鬼邮差后，包里出现“寂照”的回信与一张指向柳城的地图。最初的木鱼声，从未真正停止。',
 final:'林风重新站在寂照庵门前。红鞋、鬼轿、求救信与鬼潮的源头在这里交汇。门内传来木鱼的最后一声，鬼尼姑抬起头。'
};
const NODES={
 start:{act:1,title:'启灵日',type:'event',story:'intro',next:['awaken']},
 awaken:{act:1,title:'童童苏醒',type:'event',story:'awaken',next:['classFight'],effect:'contractTong'},
 classFight:{act:1,title:'启灵教室',type:'battle',story:'awaken',enemies:[['stray',1]],next:['paper']},
 paper:{act:1,title:'红色纸人',type:'event',story:'paper',next:['housing']},
 housing:{act:1,title:'外城分房',type:'event',story:'housing',next:['oldBuilding','foreignHouse','villa']},
 oldBuilding:{act:1,title:'旧楼',type:'battle',story:'housing',enemies:[['daily',1]],next:['camp1']},
 foreignHouse:{act:1,title:'七层洋房',type:'battle',story:'housing',enemies:[['house',2]],next:['camp1']},
 villa:{act:1,title:'别墅黑影',type:'battle',story:'housing',enemies:[['shade',2],['shade',1]],next:['camp1'],bonus:'blade'},
 camp1:{act:1,title:'外城篝火',type:'camp',next:['hunt']},
 hunt:{act:2,title:'柳城猎鬼',type:'event',story:'town',next:['grainTown','orchard','counter']},
 grainTown:{act:2,title:'粮食小镇',type:'battle',story:'town',enemies:[['hungry',2],['hungry',1]],next:['mountain']},
 orchard:{act:2,title:'果林吊绳',type:'battle',story:'orchard',enemies:[['hanged',3]],next:['mountain'],bonus:'coin'},
 counter:{act:2,title:'反杀御鬼者',type:'battle',story:'hunters',enemies:[['rogue',4],['rogue',4],['rogue',3]],next:['mountain'],bonus:'relic'},
 mountain:{act:2,title:'小奉山',type:'boss',story:'mountain',enemies:[['granny',4],['rogue',3]],next:['jizhao']},
 jizhao:{act:2,title:'寂照庵',type:'event',story:'jizhao',next:['camp2'],effect:'shoe'},
 camp2:{act:2,title:'山下篝火',type:'camp',next:['shoe']},
 shoe:{act:3,title:'送还绣花鞋',type:'event',story:'shoe',next:['comb']},
 comb:{act:3,title:'闺房梳头',type:'event',story:'comb',next:['night']},
 night:{act:3,title:'鬼域一夜',type:'event',story:'night',next:['meal']},
 meal:{act:3,title:'吃下鬼饭',type:'event',story:'meal',next:['sedan']},
 sedan:{act:3,title:'阻止鬼轿',type:'battle',story:'sedan',enemies:[['shade',4],['shade',4]],next:['contractXuan']},
 contractXuan:{act:3,title:'契约萱华',type:'event',story:'contract',next:['camp3'],effect:'contractXuan'},
 camp3:{act:3,title:'红烛篝火',type:'camp',next:['haicheng']},
 haicheng:{act:4,title:'进入海城',type:'event',story:'haicheng',next:['auction','haunt','recruit']},
 auction:{act:4,title:'拍卖行善灵',type:'reward',story:'haicheng',next:['post'],cards:2},
 haunt:{act:4,title:'海城猎鬼',type:'battle',story:'haicheng',enemies:[['nightmare',5],['nightmare',4]],next:['post']},
 recruit:{act:4,title:'柳茹的招揽',type:'event',story:'haicheng',next:['post'],effect:'recruit'},
 post:{act:4,title:'鬼邮差第一封信',type:'event',story:'post',next:['defeat'],effect:'letter'},
 defeat:{act:4,title:'卓会长大败',type:'event',story:'defeat',next:['general']},
 general:{act:4,title:'无头将军',type:'boss',story:'general',enemies:[['general',6],['nightmare',5],['nightmare',5]],next:['camp4'],effect:'unlockHorse'},
 camp4:{act:4,title:'海城篝火',type:'camp',next:['tide1']},
 tide1:{act:5,title:'救援御鬼者',type:'battle',story:'tide',enemies:[['tide',5],['tide',5]],next:['tide2']},
 tide2:{act:5,title:'西防线第一波',type:'battle',story:'tide',enemies:[['tide',5],['tide',5],['tide',4]],next:['camp5']},
 camp5:{act:5,title:'防线篝火',type:'camp',next:['tide3']},
 tide3:{act:5,title:'西防线鬼潮',type:'boss',story:'tide',enemies:[['tide',6],['tide',5],['tide',5],['tide',4]],next:['letter']},
 letter:{act:5,title:'鬼邮差第二封信',type:'event',story:'letter',next:['finalCamp'],effect:'letter2'},
 finalCamp:{act:5,title:'寂照庵外篝火',type:'camp',next:['final']},
 final:{act:6,title:'终章 寂照庵',type:'boss',story:'final',enemies:[['nun',8],['shade',7],['shade',7]],next:['ending']},
 ending:{act:6,title:'长明之后',type:'ending',story:'final',next:[]}
};
const ACT_ROWS={
 1:[['start'],['awaken'],['classFight'],['paper'],['housing'],['oldBuilding','foreignHouse','villa'],['camp1']],
 2:[['hunt'],['grainTown','orchard','counter'],['mountain'],['jizhao'],['camp2']],
 3:[['shoe'],['comb'],['night'],['meal'],['sedan'],['contractXuan'],['camp3']],
 4:[['haicheng'],['auction','haunt','recruit'],['post'],['defeat'],['general'],['camp4']],
 5:[['tide1'],['tide2'],['camp5'],['tide3'],['letter'],['finalCamp']],
 6:[['final'],['ending']]
};
const EXCLUSIVE=[['oldBuilding','foreignHouse','villa'],['grainTown','orchard','counter'],['auction','haunt','recruit']];
const DEFAULT={version:1,current:'start',available:['start'],completed:[],spirits:[],deck:['coin','coin','coin','blade','revive','relic'],xp:0,will:1,maxWill:1,horse:false,letters:0,log:['旅途开始'],battle:null,ending:false,campChoices:{}};
let state=loadState(),busy=false,selected=null,targetMode=null;
function clone(x){return JSON.parse(JSON.stringify(x))}
function loadState(){try{const x=JSON.parse(localStorage.getItem(SAVE));if(x?.version===1)return normalizeState(x)}catch{}return clone(DEFAULT)}
function normalizeState(x){x.campChoices||={};for(const s of x.spirits||[]){s.onceUsed||={};s.skillRestore||={};if(s.id==='nannan'){s.maxHp=100000;s.atk=100;s.rankName='禁忌';s.rankIndex=0;s.hp=s.dead?0:Math.min(100000,s.hp||100000)}const c=GD.spirits.find(v=>v.id===s.id);if(c&&!s.rankName){s.rankName=c.initialRank;s.rankIndex=Math.max(0,GD.rankIndex(c.initialRank));s.level=s.rankIndex+1;s.potential=c.potential;s.type=c.type;const stats=spiritStats(s.id,s.rankName,s.potential);s.maxHp=stats.hp;s.hp=Math.min(Math.max(1,s.hp||stats.hp),s.maxHp);s.atk=stats.atk}}syncPlayerVitality(x,false);return x}
function save(){if(!state.battle?.testMode)localStorage.setItem(SAVE,JSON.stringify(state));updateHud()}
function spirit(id){return state.spirits.find(s=>s.id===id)}
function maxHp(level){return Math.min(10,level*(level+1)/2)}
function enemyHp(level){return Math.min(10,Math.max(1,level*2))}
function spiritCost(){return (state.battle?.deployedCount||0)+1}
function syncPlayerVitality(target=state,full=false){const old=target.maxWill||1,highest=Math.max(1,...(target.spirits||[]).map(s=>s.maxHp||1)),next=Math.min(10,Math.max(1,Math.ceil(highest*.6)));target.maxWill=next;if(full)target.will=next;else target.will=Math.max(1,Math.min(next,(target.will||1)+Math.max(0,next-old)))}
function addSpirit(id,level){if(spirit(id))return;const c=GD.spirits.find(v=>v.id===id)||{name:id==='tong'?'童童':'萱华',initialRank:level===1?'F级':'A级',potential:3,type:'恶灵'},rankName=c.initialRank,rankIndex=Math.max(0,GD.rankIndex(rankName)),stats=spiritStats(id,rankName,c.potential);state.spirits.push({id,name:c.name,rankName,rankIndex,level:rankIndex+1,potential:c.potential,type:c.type,xp:0,maxHp:stats.hp,hp:stats.hp,atk:stats.atk,dead:false,onceUsed:{},skillRestore:{}});syncPlayerVitality(state,true);state.log.unshift(`契约鬼灵：${c.name}（${rankName}）`)}
function updateHud(){globalThis.GC_BRIDGE.sync('hud')}
function renderHome(){updateHud();globalThis.GC_BRIDGE.ui('home')}
function openCollection(){if(state.battle)return;globalThis.GC_BRIDGE.ui('collection')}
function showOwnedSpirit(i){globalThis.GC_BRIDGE.ui('ownedSpirit',{index:i})}
function upgradeOwnedSpirit(i){const s=state.spirits[i],rank=GD.ranks[s.rankIndex],next=s.id==='nannan'?null:GD.ranks[s.rankIndex+1];if(!next||state.xp<rank.upgradeXp)return;state.xp-=rank.upgradeXp;s.rankIndex++;s.rankName=next.name;s.level=s.rankIndex+1;const stats=spiritStats(s.id,s.rankName,s.potential);s.maxHp=stats.hp;s.hp=s.maxHp;s.atk=stats.atk;s.dead=false;syncPlayerVitality(state,false);state.log.unshift(`${s.name}提升至${s.rankName}并恢复全部生命`);save();showOwnedSpirit(i)}
function confirmReset(){globalThis.GC_BRIDGE.ui('confirmReset')}
function resetCampaign(){state=clone(DEFAULT);save();closeModal();renderHome()}
function renderMap(){updateHud();const act=Math.max(1,...state.available.map(id=>NODES[id]?.act||1),...state.completed.map(id=>NODES[id]?.act||1));globalThis.GC_BRIDGE.ui('map',{act})}
function enterNode(id){if(!state.available.includes(id)||busy)return;state.current=id;const n=NODES[id];if(n.type==='battle'||n.type==='boss')showStoryBeforeBattle(id);else if(n.type==='camp')showCamp(id);else if(n.type==='reward')showRewardNode(id);else if(n.type==='ending')showEnding();else showEvent(id)}
function storyText(key){return STORY[key]||''}
function showEvent(id){globalThis.GC_BRIDGE.ui('event',{id})}
function continueEvent(id){const n=NODES[id];applyEffect(n.effect,id);completeNode(id);closeModal();renderMap()}
function applyEffect(effect,id){if(effect==='contractTong')addSpirit('tong',1);if(effect==='contractXuan')addSpirit('xuan',5);if(effect==='shoe')state.log.unshift('获得红色绣花鞋');if(effect==='letter')state.letters=1;if(effect==='letter2')state.letters=2;if(effect==='recruit'){state.xp+=2;state.log.unshift('接受联盟情报，获得2经验')}if(effect==='unlockHorse'){state.horse=true;state.deck.push('horse');state.log.unshift('契约坐骑鬼马，鬼马卡已加入牌组')}save()}
function completeNode(id){if(!state.completed.includes(id))state.completed.push(id);if(NODES[id]?.type==='camp')for(const s of state.spirits){for(const name of Object.keys(s.skillRestore||{})){s.skillRestore[name]--;if(s.skillRestore[name]<=0){delete s.skillRestore[name];delete s.onceUsed?.[name];state.log.unshift(`${s.name}的${name}已在四次篝火后恢复`)}}}const group=EXCLUSIVE.find(g=>g.includes(id));state.available=state.available.filter(x=>x!==id&&(!group||!group.includes(x)));for(const next of NODES[id].next)if(!state.completed.includes(next)&&!state.available.includes(next))state.available.push(next);save()}
function showStoryBeforeBattle(id){globalThis.GC_BRIDGE.ui('beforeBattle',{id})}
function retreatToMap(){closeModal();renderMap()}
function startBattle(nodeId){for(const own of state.spirits)for(const name of Object.keys(own.onceUsed||{}))if(GD.skillDefs[name]?.oncePerBattle)delete own.onceUsed[name];const n=NODES[nodeId],enemies=n.enemies.map(([id,level],i)=>({uid:`e${i}`,id,name:ENEMIES[id].name,level,maxHp:enemyHp(level),hp:enemyHp(level),baseAtk:Math.ceil(level/2),atk:Math.ceil(level/2),lane:i,dead:false,type:'恶灵',effects:{}})),selectedGhosts=state.spirits.filter(s=>!s.dead&&(!state.squad?.length||state.squad.includes(s.id))).slice(0,6).map(s=>s.id),guaranteed=selectedGhosts.slice(0,Math.min(3,selectedGhosts.length)),pool=shuffle([...selectedGhosts.slice(guaranteed.length),...state.deck.slice(0,25)]),openingQi=nodeId==='classFight'?3:1,hand=[...guaranteed,...pool.splice(0,Math.max(0,6-guaranteed.length))],enemyWill=Math.max(...enemies.map(e=>e.maxHp));syncPlayerVitality(state,false);state.battle={nodeId,turn:1,qi:openingQi,maxQi:openingQi,deployedCount:0,will:state.will,maxWill:state.maxWill,enemyWill,maxEnemyWill:enemyWill,enemies,units:Array(4).fill(null),hand,draw:pool,grave:[],removedEnemies:[],temp:[],revivedCount:0,playerSkillsUsed:{},log:[nodeId==='classFight'?'教学：鬼灵均从手牌部署；本场第1个鬼灵消耗1鬼气':'战斗开始']};selected=null;targetMode=null;save();globalThis.GC_BRIDGE.ui('battle');globalThis.GC_BRIDGE.fx('battle:enter',{testMode:false,nodeId})}
function formatNum(n){return Number.isInteger(+n)?String(+n):Number(n||0).toFixed(1).replace(/\.0$/,'')}
function skillDetailMeta(d={},name=''){const parts=[d.passive?'被动技能':'主动技能'];if(d.cost!=null&&!d.passive)parts.push(`${d.cost}鬼气`);if(d.cooldown)parts.push(`${d.cooldown}回合冷却`);if(d.duration)parts.push(`持续${d.duration}回合`);if(d.once)parts.push(name==='绝望'?'使用后经过4次篝火恢复':'永久仅可使用一次');else if(d.oncePerBattle)parts.push('每场战斗一次');if(d.toggle)parts.push('领域展开/收回');return parts.join(' · ')}
function replacementText(name){const chain=GD.upgradeChains?.find(c=>c.includes(name));if(!chain)return'';const i=chain.indexOf(name);return i?`升级替换：${chain[i-1]} → ${name}`:(chain.length>1?`后续可升级为：${chain.slice(1).join(' → ')}`:'')}
function showCodexSpirit(id){const s=GD.spirits.find(x=>x.id===id);if(!s)return;globalThis.GC_BRIDGE.ui('codexSpirit',{id})}
function renderCodex(){updateHud();globalThis.GC_BRIDGE.ui('codex')}
let testSnapshot=null,lastTestConfig=null;
function defaultTestConfig(){return {playerHp:10,qi:6,allies:[{on:true,id:'tong',rank:'F级',pos:'0'},{on:true,id:'xuan',rank:'A级',pos:'1'},...Array.from({length:4},(_,i)=>({on:false,id:GD.spirits[(i+2)%GD.spirits.length]?.id||'tong',rank:GD.spirits[(i+2)%GD.spirits.length]?.initialRank||'F级',pos:'hand'}))],enemies:Array.from({length:4},(_,i)=>({on:i<2,name:`测试恶灵${i+1}`,pos:String(i),atk:i+1,hp:i+3})),cards:['coin','blade','horse','revive','','','','','','']}}
function renderTestLab(config=lastTestConfig||defaultTestConfig()){lastTestConfig=clone(config);updateHud();globalThis.GC_BRIDGE.ui('testLab')}
function initUnit(u){
 if(u.initialized)return u;
 const skills=GD.unlockedSkills(u.id,u.rankName);u.cooldowns||={};u.onceUsed||={};u.effects||={};u.baseAtk=u.baseAtk??u.atk;u.baseMaxHp=u.baseMaxHp??u.maxHp;
 const inferno=skills.includes('地狱之主+')?.8:skills.includes('地狱之主')?.6:0;
 const pre=skills.includes('前世+++')?.75:skills.includes('前世++')?.45:skills.includes('前世+')?.27:skills.includes('前世')?.12:0;
 u.passiveAttackBonus=inferno+pre;u.incomingBonus=inferno?(inferno===.8?.3:.2):0;u.passiveHpBonus=pre;u.attackBonuses||={};
 u.atk=u.baseAtk*(1+u.passiveAttackBonus);if(pre){u.maxHp=u.baseMaxHp*(1+pre);u.hp*=1+pre}
 if(skills.includes('无敌规律'))addEffect(u,'invincible','无敌规律',1,{invincible:true});
 u.preAttackInvincible=skills.includes('佛系规律+')?3:skills.includes('佛系规律')?2:0;
 u.dodgeCharges=skills.includes('圣灵闪遁')?4:skills.includes('无解闪遁')?2:skills.includes('闪遁')?1:0;
 u.initialized=true;return u;
}
function makeTestUnit(a,lane){const c=GD.spirits.find(s=>s.id===a.id),stats=spiritStats(a.id,a.rank,c?.potential||1);return {uid:`p${lane}-${a.id}`,id:a.id,name:c.name,rankName:a.id==='nannan'?'禁忌':a.rank,rankIndex:GD.rankIndex(a.rank),level:Math.max(0,GD.rankIndex(a.rank))+1,potential:a.potential??c.potential,type:c.type,baseAtk:a.atk??stats.atk,atk:a.atk??stats.atk,baseMaxHp:a.hp??stats.hp,maxHp:a.hp??stats.hp,hp:a.currentHp??a.hp??stats.hp,lane,dead:false,extra:0,cooldowns:clone(a.cooldowns||{}),effects:clone(a.effects||{}),onceUsed:{}}}
function startTestBattle(cfg=defaultTestConfig()){const allies=cfg.allies.filter(a=>a.on),enemiesCfg=cfg.enemies.filter(e=>e.on);if(!allies.length||!enemiesCfg.length){globalThis.GC_BRIDGE.notify('双方至少各启用1名鬼灵','warn');return}const enemyPos=enemiesCfg.map(e=>e.pos);if(new Set(enemyPos).size!==enemyPos.length){globalThis.GC_BRIDGE.notify('敌方不能有两个单位占据相同位置','warn');return}lastTestConfig=clone(cfg);testSnapshot=clone(state);const units=Array(4).fill(null),hand=allies.map(a=>({kind:'ghost',unit:makeTestUnit(a,0)}));hand.push(...cfg.cards.filter(Boolean));const enemies=enemiesCfg.map((e,i)=>({uid:`te${i}`,id:`test-enemy-${i}`,name:e.name,level:1,type:'恶灵',lane:+e.pos,baseAtk:e.atk,atk:e.atk,maxHp:e.hp,hp:e.hp,dead:false,effects:{}})),enemyWill=Math.max(...enemies.map(e=>e.maxHp));state.battle={testMode:true,nodeId:'test',turn:1,qi:cfg.qi,maxQi:cfg.qi,deployedCount:0,will:cfg.playerHp,maxWill:cfg.playerHp,enemyWill,maxEnemyWill:enemyWill,enemies,units,hand,draw:[],grave:[],removedEnemies:[],playerSkillsUsed:{},log:['自定义测试战斗开始：全部我方鬼灵在手牌中']};selected=null;targetMode=null;globalThis.GC_BRIDGE.ui('battle');globalThis.GC_BRIDGE.fx('battle:enter',{testMode:true,nodeId:'test'})}
function exitTestBattle(){if(busy)return;state=testSnapshot||clone(DEFAULT);testSnapshot=null;selected=null;targetMode=null;renderTestLab(lastTestConfig||defaultTestConfig())}
function exitTestToHome(){state=testSnapshot||state;testSnapshot=null;renderHome()}
function renderBattle(){if(!state.battle)return;globalThis.GC_BRIDGE.sync('battle')}
function cooldown(u,key){return u.cooldowns?.[key]||0}
function addEffect(u,key,label,turns,data={}){u.effects||={};u.effects[key]={label,turns,...data};return u.effects[key]}
function removeEffect(u,key){if(u.effects)delete u.effects[key]}
function blocksNegative(u){return GD.unlockedSkills(u.id,u.rankName).includes('梦的规律')}
function addNegative(u,key,label,turns,data={}){if(blocksNegative(u))return false;addEffect(u,key,label,turns,data);return true}
function statusText(u){const s=[];for(const e of Object.values(u.effects||{}))s.push(`${e.label}${e.turns==null?'':` ${e.turns}回合`}`);for(const [key,value] of Object.entries(u.attackBonuses||{}))s.push(`${SKILLS[key]?.name||key}攻击+${Math.round(value*100)}%`);if(u.shield)s.push(`护盾${formatNum(u.shield)}`);if(u.extraAdd)s.push(`额外加算${Math.round(u.extraAdd*100)}%`);if(u.dodgeCharges>0)s.push(`闪遁剩余${u.dodgeCharges}次`);if(u.preAttackInvincible>0)s.push(`佛系无敌剩余${u.preAttackInvincible}次攻击`);if(u.passiveAttackBonus)s.push(`被动攻击+${Math.round(u.passiveAttackBonus*100)}%`);for(const [k,v] of Object.entries(u.cooldowns||{}))if(v)s.push(`${k}冷却${v}`);return s.join(' · ')||'无增益或负面效果'}
function handSpirit(entry){return entry?.kind==='ghost'?entry.unit:typeof entry==='string'?spirit(entry):null}
function selectHand(i){if(busy)return;const entry=state.battle.hand[i],sp=handSpirit(entry),id=typeof entry==='string'?entry:null,c=id?SKILLS[id]:null;if(!sp&&!c)return;selected={kind:'hand',index:i,id};targetMode=sp?'deploy':c.target;if(c&&['none','grave'].includes(c.target)){playSkill(i,-1);return}renderBattle()}
function allyLane(lane){if(busy||!selected)return;const b=state.battle;if(selected.kind==='hand'&&handSpirit(b.hand[selected.index])&&!b.units[lane])deployGhost(selected.index,lane);else if(targetMode==='ally')playSkill(selected.index,lane);else if(targetMode?.startsWith('player:'))usePlayerSkill(+targetMode.split(':')[1],lane)}
function allyTarget(lane){if(busy)return;if(selected?.kind==='hand'&&targetMode==='ally')playSkill(selected.index,lane);else if(targetMode?.startsWith('player:'))usePlayerSkill(+targetMode.split(':')[1],lane);else if(targetMode?.startsWith('exactAlly:'))resolveExactSkill(targetMode.slice(10),bUnit(lane));else{selected={kind:'unit',lane};targetMode=null;renderBattle()}}
function enemyTarget(uid){if(busy)return;const b=state.battle,e=b.enemies.find(x=>x.uid===uid);if(targetMode?.startsWith('exactEnemy:')&&e)resolveExactSkill(targetMode.slice(11),e);else if(targetMode?.startsWith('confuseSecond:')&&e)resolveConfuse(targetMode.slice(14),e);else if(selected?.kind==='hand'&&targetMode==='enemy'&&e)playSkill(selected.index,e.lane)}
function bUnit(lane){return state.battle?.units[lane]}
async function moveSpirit(delta){if(busy||selected?.kind!=='unit')return;const b=state.battle,from=selected.lane,to=from+delta,other=to>=0&&to<=3?b.units[to]:null,cost=other?0:1;if(to<0||to>3||b.qi<cost)return;busy=true;try{await globalThis.GC_BRIDGE.fx('move',{uid:b.units[from].uid,from,to,swapUid:other?.uid||null,cost});soundCue('move');b.qi-=cost;b.units[to]=b.units[from];b.units[from]=other||null;b.units[to].lane=to;if(other)other.lane=from;b.log.unshift(other?`${b.units[to].name}与${other.name}免费交换位置`:`${b.units[to].name}移动一格，消耗1鬼气`);selected={kind:'unit',lane:to};save();renderBattle()}finally{busy=false}}
function playerSkillRestriction(i,u){const minimum=[10,13,17][i];if(minimum==null)return '未知御鬼者技能';const rank=Number.isFinite(u?.rankIndex)?u.rankIndex:GD.rankIndex(u?.rankName);return rank>=minimum?'':`${GD.playerSkills[i].name}只能用于${GD.ranks[minimum].name}及以上鬼灵`; }
function selectPlayerSkill(i){if(busy||state.battle.playerSkillsUsed?.[i])return;selected={kind:'playerSkill',index:i};targetMode=`player:${i}`;renderBattle()}
async function usePlayerSkill(i,lane){const b=state.battle,u=b.units[lane];if(busy||!u||b.playerSkillsUsed?.[i])return;const s=GD.playerSkills[i],restriction=playerSkillRestriction(i,u);if(restriction){globalThis.GC_BRIDGE.notify(restriction,'warn');return}if(i===0){const cost=Math.ceil(b.maxWill*.4);if(b.will<=cost){globalThis.GC_BRIDGE.notify('当前生命不足以支付血祭','warn');return}b.will-=cost;u.hp=u.maxHp;u.extraAdd=(u.extraAdd||0)+.5;addEffect(u,'bloodSacrifice','血祭增幅',null);b.log.unshift(`血祭增幅：牺牲${cost}生命，${u.name}恢复并增伤50%`)}else if(i===1){addAttackBonus(u,'heroFusion',.2);addEffect(u,'heroFusion','英灵融合',null);u.extraAdd=(u.extraAdd||0)+.3;u.damageShare=.1;b.log.unshift(`英灵融合：${u.name}获得攻击与额外伤害加成`)}else{if((u.rankIndex??0)<17){globalThis.GC_BRIDGE.notify('神火只能赐予半圣灵级及以上鬼灵','warn');return}addAttackBonus(u,'divineFire',.3);u.extraAdd=(u.extraAdd||0)+.17;u.regen=.15;addEffect(u,'divineFire','神火',null);state.xp=Math.floor(state.xp/2);b.log.unshift(`神火：${u.name}获得神火强化`)}b.playerSkillsUsed[i]=true;selected=null;targetMode=null;await globalThis.GC_BRIDGE.fx('playerSkill',{index:i,name:s.name,target:{uid:u.uid,side:'ally',lane:u.lane}});globalThis.GHOST_VFX?.react(s.name,u);globalThis.GC_BRIDGE.fx('burst',{uid:u.uid,side:'ally',lane:u.lane,glyph:i===0?'◆':i===2?'☀':'◇',tone:i===0?'#ff394f':'#e9d27f'});renderBattle();save()}
const ENEMY_TARGET_SKILLS=new Set(['寒冰右手','鬼火','鬼火+','55开','55开+','画卷绝杀','解析','解析+','解析++','解析+++','解析++++','时间梦境','丰都鬼军','寂灭蝶珠','入梦','入梦+','时间删除','迷惑','空间规律','空间规律+','鬼主权杖']);
const ALLY_TARGET_SKILLS=new Set(['白虎驱邪纹','白虎驱邪纹+','时间回退']);
function exactSpiritSkill(name){if(busy||selected?.kind!=='unit')return;const u=bUnit(selected.lane),d=GD.skillDefs[name]||{};if(!u||d.passive||cooldown(u,name)||state.battle.qi<(d.cost||0))return;if(ENEMY_TARGET_SKILLS.has(name)){targetMode=`exactEnemy:${name}`;renderBattle();return}if(ALLY_TARGET_SKILLS.has(name)){targetMode=`exactAlly:${name}`;renderBattle();return}resolveExactSkill(name,null)}
function consumeExactSkill(u,name){const b=state.battle,d=GD.skillDefs[name]||{};if(b.qi<(d.cost||0)||cooldown(u,name)||((d.once||d.oncePerBattle)&&u.onceUsed?.[name]))return false;b.qi-=d.cost||0;u.cooldowns||={};u.onceUsed||={};if(d.cooldown)u.cooldowns[name]=d.cooldown;if(d.once||d.oncePerBattle)u.onceUsed[name]=true;if(d.once&&!b.testMode){const s=spirit(u.id);if(s){s.onceUsed||={};s.onceUsed[name]=true;if(name==='绝望'){s.skillRestore||={};s.skillRestore[name]=4}}}return true}
function activeSource(){return selected?.kind==='unit'?bUnit(selected.lane):null}
function addTeamTimedEffect(key,label,turns,data={}){for(const u of state.battle.units.filter(Boolean))addEffect(u,key,label,turns,data)}
async function resolveExactSkill(name,target){const b=state.battle,u=activeSource(),d=GD.skillDefs[name]||{};if(!u||busy)return;if(name==='迷惑'){selected.confuseFirst=target.uid;targetMode=`confuseSecond:${target.uid}`;b.log.unshift(`迷惑：请选择${target.name}要攻击的另一名敌人`);renderBattle();return}if(name==='画卷绝杀'&&target.hp/target.maxHp>=.15){globalThis.GC_BRIDGE.notify('目标生命必须低于15%','warn');return}if(name==='鬼主权杖'&&target.rankIndex!=null&&target.rankIndex>=20){globalThis.GC_BRIDGE.notify('鬼主权杖不能秒杀圣灵三阶及以上目标','warn');return}if(!consumeExactSkill(u,name))return;busy=true;try{soundCue('skill');await globalThis.GHOST_VFX?.cast(name,u,target);let message=d.desc||name;switch(name){
case '邪灵形态':case '女武神形态':{const pct=name==='邪灵形态' ? .2 : .45,turns=name==='邪灵形态'?2:3;addEffect(u,'form',name,turns,{attackBonus:pct});break}
case '鬼瞳':for(const e of b.enemies.filter(x=>!x.dead))addNegative(e,'eye','鬼瞳',2,{receivedBonus:.334});break;
case '寒冰右手':dealSkillDamage(u,target,1.25,name);break;
case '无解防御':addEffect(u,'defense','无解防御',2,{reduction:.9});break;
case '鬼域':case '英灵领域':case '伞域':toggleDomain(u,name);break;
case '鬼火':case '鬼火+':{const ratio=name==='鬼火' ? .56 : .67;addNegative(target,'ghostFire',name,2,{ratio,sourceUid:u.uid,sourceSnapshot:clone(u),source:u.name});break}
case '鬼绣球':case '鬼绣球+':{const pct=name==='鬼绣球' ? .25 : .409;addTeamTimedEffect('ghostBall',name,4,{skillBonus:pct});break}
case '55开':case '55开+':{const turns=name==='55开'?4:5;addEffect(u,'equal',name,turns,{snapshot:{atk:u.atk,maxHp:u.maxHp,hp:u.hp,baseAtk:u.baseAtk},copiedAttack:effectiveAttack(target)});u.maxHp=target.maxHp;u.hp=Math.min(target.hp,u.maxHp);break}
case '伞分身':case '伞分身+':{const pct=name==='伞分身' ? .3 : .459;for(const a of b.units.filter(Boolean)){a.shield=(a.shield||0)+u.maxHp*pct;addEffect(a,'umbrellaShield',name,null)}break}
case '虚化':case '虚化+':{const turns=name==='虚化'?1:2;b.enemySkillNull=turns;for(const e of b.enemies.filter(x=>!x.dead))addNegative(e,'virtual','技能失效',turns);break}
case '画卷绝杀':target.hp=0;target.dead=true;break;
case '白虎驱邪纹':case '白虎驱邪纹+':target.hp=Math.min(target.maxHp,target.hp+target.maxHp*(name.endsWith('+') ? .3 : .2));break;
case '解析':case '解析+':case '解析++':case '解析+++':case '解析++++':applyAnalysis(target,name);break;
case '火凤燎原':case '火凤燎原+':case '不完全火焰规律':case '半完全火焰规律':{const ratio={'火凤燎原':.23,'火凤燎原+':.31,'不完全火焰规律':.43,'半完全火焰规律':.56}[name];for(const e of b.enemies.filter(x=>!x.dead))dealSkillDamage(u,e,ratio,name);break}
case '女王领域':for(const e of b.enemies.filter(x=>!x.dead))addNegative(e,'queenField','女王领域',5,{outgoingReduction:.275});break;
case '金字塔镇压':case '金字塔镇压+':{const ratio=name.endsWith('+') ? .26 : .15;for(const e of b.enemies.filter(x=>!x.dead))dealSkillDamage(u,e,ratio,name);break}
case '时间梦境':addNegative(target,'timeDream','时间梦境',2,{skip:1,nextExtra:1});break;
case '水分身':case '水分身+':{const pct=name.endsWith('+') ? .36 : .23;for(const a of b.units.filter(Boolean))addEffect(a,'waterClone',name,2,{regenFlat:u.maxHp*pct});break}
case '无象灵水躯':case '无象灵水躯+':addEffect(u,'waterBody',name,name.endsWith('+')?2:1,{reduction:.7});break;
case '丰都鬼军':for(let i=0;i<10&&!target.dead;i++){dealSkillDamage(u,target,.06+Math.random()*.05,`${name}第${i+1}击`);refreshCombatCards();globalThis.GHOST_VFX?.react(name,target);globalThis.GC_BRIDGE.fx('burst',{uid:target.uid,side:'enemy',lane:target.lane,glyph:'╱',tone:'#4fd7a8'});soundCue('hit')}break;
case '鬼门关降临':for(const e of b.enemies.filter(x=>!x.dead))dealSkillDamage(u,e,1.34,name);break;
case '幻影蝶翼':addEffect(u,'butterfly',name,2,{dodge:.6});break;
case '寂灭蝶珠':dealSkillDamage(u,target,2.2,name);break;
case '入梦':case '入梦+':addNegative(target,'dream',name,1,{skip:1,receivedBonus:name.endsWith('+') ? .3 : .2});break;
case '时间回退':target.rollbackSnapshot=clone(target);addEffect(target,'rollback','时间回退记录',null);break;
case '时间删除':removeEnemyTemporarily(target,4);break;
case '云梦泽':case '云梦泽+':{const pct=name.endsWith('+') ? .5 : .3;for(const a of b.units.filter(Boolean)){if(a.effects?.cloudDream)expireEffect(a,'cloudDream',a.effects.cloudDream);const hpGain=a.baseMaxHp*(1+(a.passiveHpBonus||0))*pct;a.maxHp+=hpGain;a.hp+=hpGain;addEffect(a,'cloudDream',name,7,{attackBonus:pct,hpGain})}break}
case '冰雪':for(const e of b.enemies.filter(x=>!x.dead))addNegative(e,'ice','冰雪',2,{freezeChance:.25});break;
case '欺骗':b.deceit={unitUid:u.uid,turns:1};for(const e of b.enemies.filter(x=>!x.dead))addNegative(e,'deceit','欺骗',1);break;
case '绝望':applyDespair();break;
case '空间规律':case '空间规律+':addNegative(target,'spaceLaw',name,2,{cannotAttackPlayer:true});break;
case '鬼主权杖':target.hp=0;target.dead=true;break;
case '轮回':reviveAll(b,.5);break;
case '太阴之力':b.qi+=6;addEffect(u,'lunar','太阴之力',1);break;
default:message=`${name}为被动技能或文档未给出主动结算方式`;break}
b.log.unshift(`${u.name}释放${name}：${message}`);selected=null;targetMode=null;await animatePendingDeaths();cleanup();renderBattle();if((globalThis.MAINLINE_RUNTIME?.allEnemiesDefeated(b)??b.enemies.every(e=>e.dead)))await winBattle();else save()}finally{busy=false}}
async function resolveConfuse(attackerUid,target){const b=state.battle,u=activeSource(),attacker=b.enemies.find(e=>e.uid===attackerUid&&!e.dead);if(!u||!attacker||attacker.uid===target.uid){globalThis.GC_BRIDGE.notify('请选择另一名敌方单位','warn');return}if(!consumeExactSkill(u,'迷惑'))return;busy=true;try{await globalThis.GHOST_VFX?.cast('迷惑',u,attacker);const damage=rollAttackDamage(attacker,effectiveAttack(attacker),'迷惑攻击');dealRawDamage(attacker,target,damage,'迷惑');b.log.unshift(`${u.name}使用迷惑：${attacker.name}攻击${target.name}`);selected=null;targetMode=null;await animatePendingDeaths();cleanup();renderBattle();if((globalThis.MAINLINE_RUNTIME?.allEnemiesDefeated(b)??b.enemies.every(e=>e.dead)))await winBattle();else save()}finally{busy=false}}
function effectiveAttack(u){
 const skills=GD.unlockedSkills(u?.id,u?.rankName),ratio=u?.maxHp?u.hp/u.maxHp:1;
 let bonus=(u.passiveAttackBonus||0)+Object.values(u.attackBonuses||{}).reduce((a,x)=>a+Number(x),0);
 for(const e of Object.values(u.effects||{}))bonus+=e.attackBonus||0;
 let value=u.effects?.equal?u.effects.equal.copiedAttack:Number(u?.baseAtk??u?.atk??0)*(1+bonus);
 if(skills.includes('人类规律')||skills.includes('人类规律+'))value*=(skills.includes('人类规律+')?2.5:2)*Math.max(0,(state.battle?.will??state.will)/Math.max(1,state.battle?.maxWill||state.maxWill||1));
 const law=skills.includes('完全因果律')?[.2,.5,1]:skills.includes('半完全因果律')?[.1,.35,.6]:skills.includes('不完全因果律')?[.05,.25,.4]:null;
 if(law)value*=1+(ratio<.1?law[2]:ratio<.25?law[1]:ratio<.5?law[0]:0);
 return Math.max(0,value);
}
function addAttackBonus(u,key,pct){u.attackBonuses||={};u.attackBonuses[key]=(u.attackBonuses[key]||0)+pct}
function stripPositiveEffects(u){
 const positive=new Set(['form','defense','ghostBall','umbrellaShield','waterClone','waterBody','butterfly','rollback','cloudDream','lunar','divineFire','bloodSacrifice','heroFusion','domain','horse','bloodmoon']);
 for(const [key,e] of Object.entries(u.effects||{}))if(positive.has(key)||key.startsWith('card-'))expireEffect(u,key,e);
 u.attackBonuses={};u.extraAdd=0;u.shield=0;u.regen=0;u.damageShare=0;u.extra=0;delete u.rollbackSnapshot;
 u.atk=u.baseAtk*(1+(u.passiveAttackBonus||0));return u;
}
function outgoingMultiplier(u){let n=1;for(const e of Object.values(u?.effects||{}))if(e.outgoingReduction)n*=1-e.outgoingReduction;return n}
function receivedMultiplier(u){let n=1+(u?.incomingBonus||0);for(const e of Object.values(u?.effects||{}))if(e.receivedBonus)n+=e.receivedBonus;return Math.max(0,n)}
function critProfile(source){const potential=Math.max(1,Math.min(6,Number(source?.potential)||1)),progress=(potential-1)/5;return {potential,chance:.02+progress*.08,multiplier:1.4+progress*.6}}
function rollAttackDamage(source,amount,label='攻击'){const reductionPct=1+Math.floor(Math.random()*20),profile=critProfile(source),critical=Math.random()<profile.chance,multiplier=critical?profile.multiplier:1,damage=Math.max(0,Number(amount||0)*(1-reductionPct/100)*multiplier);source.lastAttackRoll={reductionPct,critical,critChance:profile.chance,critMultiplier:profile.multiplier,label};if(critical)state.battle?.log?.unshift(`${source.name}的${label}触发暴击：${Math.round(profile.chance*100)}%概率，伤害倍率${Math.round(profile.multiplier*100)}%`);return damage}
function skillDamage(source,target,ratio){const base=effectiveAttack(source)*Number(ratio||0)*(1+(source?.effects?.ghostBall?.skillBonus||0))*(1+(source?.extraAdd||0))*rankMultiplier(source,target)*receivedMultiplier(target)*outgoingMultiplier(source);return rollAttackDamage(source,base,'技能攻击')}
function dealSkillDamage(source,target,ratio,label){const amount=skillDamage(source,target,ratio);return dealRawDamage(source,target,amount,label,true)}
function dealRawDamage(source,target,amount,label='攻击',isSkill=false,noRevenge=false){
 if(!target||target.dead)return 0;const b=state.battle;
 if(target.effects?.invincible||target.preAttackInvincible>0){b.log.unshift(`${target.name}的无敌效果免疫了${label}`);globalThis.GHOST_VFX?.react(target.effects?.invincible?'无敌规律':'佛系规律',target,'无敌');return 0}
 const dodge=target.effects?.butterfly?.dodge||0;if(dodge&&Math.random()<dodge){b.log.unshift(`${target.name}使用幻影蝶翼闪避${label}`);globalThis.GHOST_VFX?.react('幻影蝶翼',target,'闪避');return 0}
 let damage=Math.max(0,Number(amount||0));for(const e of Object.values(target.effects||{}))if(e.reduction)damage*=1-e.reduction;
 if(target.damageShare){const share=damage*target.damageShare;b.will-=share;damage-=share;b.log.unshift(`英灵融合将${formatNum(share)}伤害转移给玩家`)}
 if(target.shield>0){const blocked=Math.min(target.shield,damage);target.shield-=blocked;damage-=blocked;globalThis.GHOST_VFX?.react('伞分身',target,`护盾 -${formatNum(blocked)}`);if(target.shield<=0){target.shield=0;removeEffect(target,'umbrellaShield')}}
 const oldRatio=target.maxHp?target.hp/target.maxHp:1;target.hp-=damage;if(damage>0){b.log.unshift(`${source?.name||label}对${target.name}造成${formatNum(damage)}伤害`);if(target.effects?.eye)globalThis.GHOST_VFX?.react('鬼瞳',target,'伤害加深');if(target.effects?.waterBody)globalThis.GHOST_VFX?.react('无象灵水躯',target,'水体减伤');if(target.effects?.defense)globalThis.GHOST_VFX?.react('无解防御',target,'护盾减伤')}
 if(target.hp<=0){target.hp=0;target.dead=true;globalThis.GHOST_VFX?.react('死亡',target,'消散')}else if(target.id==='tong'&&[.5,.25,.1].some(v=>oldRatio>=v&&target.hp/target.maxHp<v))globalThis.GHOST_VFX?.react('完全因果律',target,'因果增强');
 if(!noRevenge&&!target.dead&&target.id==='artemis'&&GD.unlockedSkills(target.id,target.rankName).includes('复仇')&&Math.random()<.5&&source&&!source.dead){globalThis.GHOST_VFX?.react('复仇',target,'月箭反击');const counter=rollAttackDamage(target,effectiveAttack(target)*2*(1+(target.extraAdd||0))*rankMultiplier(target,source)*receivedMultiplier(source)*outgoingMultiplier(target),'复仇');b.log.unshift(`${target.name}触发复仇，反击${source.name}`);dealRawDamage(target,source,counter,'复仇',false,true)}
 return damage;
}
function toggleDomain(u,name){const b=state.battle;if(b.domain?.uid===u.uid){globalThis.GHOST_VFX?.react(name,u,'领域收回');removeEffect(u,'domain');b.domain=null;b.log.unshift(`${u.name}收回${name}`);return}if(b.domain){const old=b.units.find(x=>x?.uid===b.domain.uid);if(old)removeEffect(old,'domain')}const multiplier=name==='鬼域'?4:(name==='英灵领域'?0.7:1.2);b.domain={uid:u.uid,name,multiplier};addEffect(u,'domain',name,null,{domain:true,multiplier})}
function applyAnalysis(target,name){if(blocksNegative(target))return;const info={'解析':[4,90],'解析+':[5,85],'解析++':[6,80],'解析+++':[8,70],'解析++++':[10,60]}[name],next=(target.analysis||0)+info[0];target.analysis=next;addNegative(target,'analysis',`解析 ${next}%`,null,{analysis:next});if(next>=info[1]&&!target.analysisBroken){target.analysisBroken=true;target.atk*=.2;target.baseAtk=(target.baseAtk??target.atk)*.2;target.maxHp*=.2;target.hp=Math.min(target.hp*.2,target.maxHp);addNegative(target,'analysisBroken','已解析：属性-80%',null);state.battle.log.unshift(`${target.name}解析完成，攻击与生命降低80%`)}}
function removeEnemyTemporarily(target,turns){if(blocksNegative(target))return;const b=state.battle,index=b.enemies.indexOf(target);if(index<0)return;addNegative(target,'timeDelete','时间删除',turns);b.enemies.splice(index,1);b.removedEnemies||=[];b.removedEnemies.push({unit:target,returnTurn:b.turn+turns,originalLane:target.lane});b.log.unshift(`${target.name}被从时间中删除，${turns}回合后返回`)}
function applyDespair(){const b=state.battle;b.despairWorld=true;for(const e of b.enemies.filter(x=>!x.dead)){const ri=e.rankIndex??0,chance=ri>=20?.6:ri>=19?.8:1,success=Math.random()<chance;if(!success||blocksNegative(e)){b.log.unshift(`${e.name}抵抗了绝望`);continue}e.maxHp=100;e.hp=100;e.baseAtk=100;e.atk=100;e.attackBonuses={};e.passiveAttackBonus=0;addNegative(e,'despair','绝望',null)}b.log.unshift('绝望按成功概率改写敌方属性：成功者生命与攻击变为100')}
function reviveAll(b,pct=.5){let count=0;const ids=new Set();for(const item of b.grave.splice(0)){const u=typeof item==='string'?clone(spirit(item)):clone(item);if(!u||ids.has(u.id))continue;ids.add(u.id);u.dead=false;u.hp=Math.max(1,u.maxHp*pct);b.hand.push({kind:'ghost',unit:u});if(!b.testMode){const own=spirit(u.id);if(own){own.dead=false;own.hp=Math.min(own.maxHp,u.hp)}}globalThis.GC_BRIDGE.fx('return',{uid:u.uid??null,id:u.id,kind:'revive',handIndex:b.hand.length-1});count++}if(!b.testMode)for(const own of state.spirits.filter(x=>x.dead&&!ids.has(x.id))){own.dead=false;own.hp=Math.max(1,own.maxHp*pct);b.hand.push(own.id);globalThis.GC_BRIDGE.fx('return',{uid:null,id:own.id,kind:'revive',handIndex:b.hand.length-1});count++}b.revivedCount=(b.revivedCount||0)+count;b.log.unshift(`轮回复活${count}名鬼灵`);if(count)soundCue('revive');return count}
async function animatePendingDeaths(){const b=state.battle;if(!b)return;const units=[...b.units.filter(u=>u?.dead).map(u=>({uid:u.uid??null,side:'ally',lane:u.lane})),...b.enemies.filter(e=>e.dead).map(e=>({uid:e.uid,side:'enemy',lane:e.lane}))];if(units.length)await globalThis.GC_BRIDGE.fx('deaths',{units})}
let deployedUidSeq=0;
async function deployGhost(index,lane){const b=state.battle,entry=b.hand[index],source=handSpirit(entry),cost=spiritCost();if(busy||!source||b.qi<cost||b.units[lane])return;busy=true;try{
 const u=clone(source);u.uid=u.uid||`p${Date.now()}-${++deployedUidSeq}-${source.id}`;u.lane=lane;u.dead=false;u.baseAtk??=u.atk;u.baseMaxHp??=u.maxHp;initUnit(u);
 b.qi-=cost;b.deployedCount=(b.deployedCount||0)+1;b.hand.splice(index,1);b.units[lane]=u;
 b.log.unshift(`部署第${b.deployedCount}个鬼灵：${u.name}消耗${cost}鬼气，进入第${lane+1}路`);selected=null;targetMode=null;save();soundCue('deploy');renderBattle();await globalThis.GC_BRIDGE.fx('deploy',{uid:u.uid,id:u.id,lane,handIndex:index,cost,deployedCount:b.deployedCount});globalThis.GC_BRIDGE.fx('burst',{uid:u.uid,side:'ally',lane,glyph:'✦',tone:'#4fd7a8'});
 }finally{busy=false}}
function returnUnitToHand(u){const b=state.battle;if(b.domain?.uid===u.uid)b.domain=null;stripPositiveEffects(u);u.lane=-1;b.hand.push({kind:'ghost',unit:clone(u)});if(!b.testMode){const own=spirit(u.id);if(own){own.hp=Math.min(own.maxHp,u.hp);own.onceUsed=clone(u.onceUsed||{})}}}
function reviveOne(b){const item=b.grave.shift();if(item){const u=typeof item==='string'?clone(spirit(item)):clone(item);u.dead=false;u.hp=Math.max(1,u.maxHp*.1);b.hand.push({kind:'ghost',unit:u});if(!b.testMode){const own=spirit(u.id);if(own){own.dead=false;own.hp=Math.min(own.maxHp,u.hp)}}return u.name}if(!b.testMode){const own=state.spirits.find(s=>s.dead);if(own){own.dead=false;own.hp=Math.max(1,own.maxHp*.1);b.hand.push(own.id);return own.name}}return false}
async function playSkill(index,targetLane){if(busy)return;const b=state.battle,id=b.hand[index],c=SKILLS[id];if(!c||b.qi<c.cost)return;const target=b.units[targetLane];if(c.target==='ally'&&!target)return;busy=true;let returnUnit=null;const handBefore=b.hand.length;try{soundCue('skill');let message=c.desc;if(id==='relic'){const name=reviveOne(b);if(!name){globalThis.GC_BRIDGE.notify('没有阵亡的鬼灵','warn');return}b.revivedCount=(b.revivedCount||0)+1;message=`${name}被鬼舍利唤回`}else if(id==='rope'){const u=b.units[targetLane];returnUnit=u;returnUnitToHand(u);b.units[targetLane]=null;message=`${u.name}回到手牌（增益去除，其余状态保留）`}else if(id.startsWith('coin')){const pct={coin:.1,coin25:.25,coin40:.4,coin100:1}[id];target.hp=Math.min(target.maxHp,target.hp+target.maxHp*pct);addEffect(target,`card-${id}`,c.name,1,{heal:pct});message=`${target.name}恢复${Math.round(pct*100)}%生命`}else if(['blade','spear','whip'].includes(id)){const pct={blade:.1,spear:.2,whip:.35}[id];addAttackBonus(target,id,pct);addEffect(target,`card-${id}`,`${c.name} 攻击+${Math.round(pct*100)}%`,null);message=`${target.name}攻击增加${Math.round(pct*100)}%`}else if(id==='horse'){target.extra=1;addEffect(target,'horse','鬼马：追加行动',1);message=`${target.name}本回合行动2次`}else if(id==='revive'){const n=3+(b.revivedCount||0);drawCards(n);message=`抽取${n}张牌（含${b.revivedCount||0}名已复苏鬼灵加成）`}else if(id==='valhalla'){b.valhalla=3;message='英灵殿将在3回合后复活所有己方鬼灵'}else if(id==='taboo'){for(const u of [...b.units.filter(Boolean),...b.enemies.filter(e=>!e.dead)])if(u.type!=='禁忌'&&Math.random()<.1)u.dead=true;message='禁忌降临：每名非禁忌单位接受10%即死判定'}else if(id==='bloodmoon'){for(const u of [...b.units.filter(Boolean),...b.enemies.filter(e=>!e.dead)]){u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.2);addAttackBonus(u,'bloodmoon',.2);addEffect(u,'bloodmoon','血月 攻击+20%',null);if(u.type!=='善灵'&&Math.random()<.2)u.dead=true}message='血月：全场恢复20%生命并增加20%攻击，同时接受死亡判定'}b.qi-=c.cost;b.hand.splice(index,1);b.log.unshift(`${c.name}：${message}`);selected=null;targetMode=null;save();await animatePendingDeaths();renderBattle();await globalThis.GC_BRIDGE.fx('card:play',{cardId:id,handIndex:index,target:target?{uid:target.uid,side:'ally',lane:target.lane}:null,message});globalThis.GC_BRIDGE.fx('burst',{uid:target?target.uid:null,side:'ally',lane:target?target.lane:null,glyph:'◈',tone:'#e4cf8a'});await animatePendingDeaths();if(returnUnit)await globalThis.GC_BRIDGE.fx('return',{uid:returnUnit.uid,id:returnUnit.id,kind:'return',handIndex:b.hand.length-1});if(['revive','relic','valhalla'].includes(id))await globalThis.GC_BRIDGE.fx('draw',{count:Math.max(1,b.hand.length-handBefore+1)});cleanup();if((globalThis.MAINLINE_RUNTIME?.allEnemiesDefeated(b)??b.enemies.every(e=>e.dead)))await winBattle()}finally{busy=false}}
function drawCards(n){soundCue('draw');const b=state.battle;for(let i=0;i<n&&b.hand.length<12&&b.draw.length;i++)b.hand.push(b.draw.shift())}
function skipEffect(u){return Object.values(u.effects||{}).find(e=>e.skip>0)}
async function endTurn(){
 if(busy)return;busy=true;const b=state.battle;
 try{
  for(let lane=0;lane<4;lane++){const u=b.units[lane];if(!u||u.dead)continue;const stop=skipEffect(u);if(stop){stop.skip--;b.log.unshift(`${u.name}受${stop.label}影响，本回合无法行动`);globalThis.GHOST_VFX?.react(stop.label,u,'无法行动');globalThis.GC_BRIDGE.fx('unit:skip',{uid:u.uid,side:'ally',lane,label:stop.label,reason:'skip'});continue}const count=1+(u.extra||0)+(u.nextExtra||0);u.extra=0;u.nextExtra=0;for(let k=0;k<count&&!u.dead;k++){const e=b.enemies.find(x=>x.lane===lane&&!x.dead);if(e)await attackAnim(u,e,false);else await hitEnemyWill(u);if(u.preAttackInvincible>0)u.preAttackInvincible--}}
  cleanup();if((globalThis.MAINLINE_RUNTIME?.allEnemiesDefeated(b)??b.enemies.every(e=>e.dead))||b.enemyWill<=0){await winBattle();return}
  await globalThis.MAINLINE_RUNTIME?.enemySkills(b);if(b.will<=0){loseBattle();return}
  for(const e of [...b.enemies.filter(x=>!x.dead)]){const ice=e.effects?.ice;if(ice&&Math.random()<(ice.freezeChance||.25)){b.log.unshift(`${e.name}被冰雪冻结，本回合无法行动`);globalThis.GHOST_VFX?.react('冰雪',e);await globalThis.GC_BRIDGE.fx('unit:skip',{uid:e.uid,side:'enemy',lane:e.lane,label:'冻结',reason:'freeze'});continue}const stop=skipEffect(e);if(stop){stop.skip--;if(stop.nextExtra)e.nextExtra=(e.nextExtra||0)+stop.nextExtra;b.log.unshift(`${e.name}受${stop.label}影响，本回合无法行动`);globalThis.GHOST_VFX?.react(stop.label,e,'无法行动');await globalThis.GC_BRIDGE.fx('unit:skip',{uid:e.uid,side:'enemy',lane:e.lane,label:stop.label,reason:'skip'});continue}const count=1+(e.nextExtra||0);e.nextExtra=0;for(let k=0;k<count&&!e.dead;k++){const deceived=b.deceit&&b.deceit.turns>0,yuzao=deceived?b.units.find(x=>x?.id==='yuzao'&&!x.dead):null;if(yuzao){if(Math.random()<.2)await attackAnim(e,yuzao,true);else{b.log.unshift(`${e.name}受欺骗影响，攻击玉藻前但未命中`);globalThis.GHOST_VFX?.react('欺骗',yuzao,'落空');await globalThis.GC_BRIDGE.fx('unit:skip',{uid:e.uid,side:'enemy',lane:e.lane,label:'未命中',reason:'miss'})}}else{const u=b.units[e.lane];if(u&&!u.dead)await attackAnim(e,u,true);else if(e.effects?.spaceLaw?.cannotAttackPlayer){b.log.unshift(`${e.name}受空间规律限制，无法攻击玩家`);globalThis.GHOST_VFX?.react(e.effects.spaceLaw.label,e,'空间封锁');globalThis.GC_BRIDGE.fx('unit:skip',{uid:e.uid,side:'enemy',lane:e.lane,label:e.effects.spaceLaw.label,reason:'spaceBlocked'})}else await hitWill(e)}}}
  cleanup();if(b.will<=0||(!b.testMode&&state.spirits.length&&state.spirits.every(s=>s.dead))){loseBattle();return}
  await advanceStatuses();cleanup();if((globalThis.MAINLINE_RUNTIME?.allEnemiesDefeated(b)??b.enemies.every(e=>e.dead))||b.enemyWill<=0){await winBattle();return}
  b.turn++;b.maxQi=Math.min(b.mainline?Math.max(10,b.deployedCount+1):10,b.maxQi+1);b.qi=b.maxQi;if(b.qiPenalty){b.qi=Math.max(1,b.qi-b.qiPenalty);b.log.unshift(`敌方噬取了${b.qiPenalty}点鬼气`);b.qiPenalty=0}const mengpo=b.units.find(u=>u?.id==='mengpo'&&GD.unlockedSkills(u.id,u.rankName).includes('地府降临'));if(mengpo){b.qi+=2;b.log.unshift('地府降临：本回合额外恢复2点鬼气');globalThis.GHOST_VFX?.react('地府降临',mengpo,'鬼气 +2')}const handBefore=b.hand.length;drawCards(1);b.log.unshift(`第${b.turn}回合：鬼气恢复到${b.qi}`);save();renderBattle();await globalThis.GC_BRIDGE.fx('draw',{count:b.hand.length-handBefore});await globalThis.GC_BRIDGE.fx('turn:start',{turn:b.turn,qi:b.qi,maxQi:b.maxQi})
 }finally{busy=false}
}
function expireEffect(u,key,e){globalThis.GHOST_VFX?.expire(u,key,e);if(key==='equal'&&e.snapshot){u.atk=e.snapshot.atk;u.baseAtk=e.snapshot.baseAtk;u.maxHp=e.snapshot.maxHp;u.hp=Math.min(u.hp,e.snapshot.maxHp)}else if(key==='cloudDream'){u.maxHp=Math.max(1,u.maxHp-(e.hpGain||0));u.hp=Math.min(u.hp,u.maxHp)}delete u.effects[key]}
function tickEffects(u){for(const [key,e] of Object.entries(u.effects||{})){if(e.turns==null)continue;e.turns--;if(e.turns<=0)expireEffect(u,key,e)}}
async function advanceStatuses(){
 const b=state.battle;
 for(const e of b.enemies.filter(x=>!x.dead)){const fire=e.effects?.ghostFire;if(fire){const source=b.units.find(u=>u?.uid===fire.sourceUid)||b.hand.map(handSpirit).find(u=>u?.uid===fire.sourceUid)||fire.sourceSnapshot;if(source){const before=e.hp;globalThis.GHOST_VFX?.react(fire.label,e);dealSkillDamage(source,e,fire.ratio||.56,fire.label);refreshCombatCards();await globalThis.GC_BRIDGE.fx('status:tick',{uid:e.uid,side:'enemy',lane:e.lane,kind:'burn',label:fire.label,value:before-e.hp,hp:e.hp,maxHp:e.maxHp});soundCue('hit')}}tickEffects(e);for(const k of Object.keys(e.cooldowns||{}))if(e.cooldowns[k]>0)e.cooldowns[k]--}
 for(const u of b.units.filter(Boolean)){const water=u.effects?.waterClone;if(water?.regenFlat||u.regen){const before=u.hp;u.hp=Math.min(u.maxHp,u.hp+(water?.regenFlat||0)+u.maxHp*(u.regen||0));globalThis.GHOST_VFX?.react(water?.label||'神火',u);refreshCombatCards();await globalThis.GC_BRIDGE.fx('status:tick',{uid:u.uid,side:'ally',lane:u.lane,kind:'regen',label:water?.label||'神火',value:u.hp-before,hp:u.hp,maxHp:u.maxHp})}tickEffects(u);for(const k of Object.keys(u.cooldowns||{}))if(u.cooldowns[k]>0)u.cooldowns[k]--}
 for(const u of b.hand.map(handSpirit).filter(u=>u?.initialized)){tickEffects(u);for(const k of Object.keys(u.cooldowns||{}))if(u.cooldowns[k]>0)u.cooldowns[k]--}
 if(b.enemySkillNull&&--b.enemySkillNull<=0)b.enemySkillNull=0;if(b.deceit&&--b.deceit.turns<=0)b.deceit=null;
 for(const item of [...(b.removedEnemies||[])]){item.unit.effects.timeDelete.turns=Math.max(0,item.returnTurn-(b.turn+1));if(item.returnTurn<=b.turn+1){let lane=item.originalLane;if(b.enemies.some(e=>!e.dead&&e.lane===lane))lane=[0,1,2,3].find(x=>!b.enemies.some(e=>!e.dead&&e.lane===x));if(lane==null){item.returnTurn++;continue}item.unit.lane=lane;removeEffect(item.unit,'timeDelete');b.enemies.push(item.unit);b.removedEnemies.splice(b.removedEnemies.indexOf(item),1);b.log.unshift(`${item.unit.name}从时间删除中返回第${lane+1}路`);await globalThis.GC_BRIDGE.fx('enemy:return',{uid:item.unit.uid,lane});soundCue('revive');renderBattle()}}
 if(b.valhalla&&--b.valhalla===0)reviveAll(b,.5)
}
function rankMultiplier(a,t){if(a.rankIndex==null||t.rankIndex==null)return 1;const d=a.rankIndex-t.rankIndex;if(d>=4)return 2;if(d===3)return 1.75;if(d===2)return 1.5;if(d===1)return 1.25;if(d===-1)return .75;if(d===-2)return .5;if(d===-3)return .25;if(d<=-4)return 0;return 1}
async function attackAnim(a,t,enemy){refreshCombatCards();
 const base=effectiveAttack(a)*(1+(a.extraAdd||0))*rankMultiplier(a,t)*receivedMultiplier(t)*outgoingMultiplier(a),damage=dealRawDamage(a,t,rollAttackDamage(a,base,'普通攻击'),'普通攻击'),crit=a.lastAttackRoll?.critical;soundCue('hit');
 await globalThis.GC_BRIDGE.fx('attack',{attacker:{uid:a.uid,side:enemy?'enemy':'ally',lane:a.lane},target:{uid:t.uid,side:enemy?'ally':'enemy',lane:t.lane},damage,critical:crit,reductionPct:a.lastAttackRoll?.reductionPct,killed:!!t.dead,targetHp:t.hp,targetMaxHp:t.maxHp});
 globalThis.GC_BRIDGE.fx('float',{target:{uid:t.uid,side:enemy?'ally':'enemy',lane:t.lane},text:damage?`${crit?'暴击 ':''}-${formatNum(damage)}`:'免疫',kind:damage?'damage':'info',critical:crit});globalThis.GC_BRIDGE.fx('burst',{uid:t.uid,side:enemy?'ally':'enemy',lane:t.lane,glyph:'╱',tone:crit?'#c8a35c':enemy?'#d75a48':'#4fd7a8'});
 if(t.dead)await globalThis.GC_BRIDGE.fx('deaths',{units:[{uid:t.uid,side:enemy?'ally':'enemy',lane:t.lane}]});refreshCombatCards();
}
function refreshCombatCards(){if(!state.battle)return;globalThis.GC_BRIDGE.sync('battle')}
async function hitWill(e){const b=state.battle;let damage=rollAttackDamage(e,effectiveAttack(e)*(1+(e.extraAdd||0))*outgoingMultiplier(e),'直接攻击'),domain=b.domain&&b.units.find(u=>u?.uid===b.domain.uid&&!u.dead);if(domain){const moved=damage*b.domain.multiplier*rankMultiplier(e,domain)*receivedMultiplier(domain);b.log.unshift(`${b.domain.name}将玩家伤害转移给${domain.name}`);globalThis.GHOST_VFX?.react(b.domain.name,domain,'伤害转移');dealRawDamage(e,domain,moved,b.domain.name);await globalThis.GC_BRIDGE.fx('direct',{attacker:{uid:e.uid,side:'enemy',lane:e.lane},damage:moved,critical:e.lastAttackRoll?.critical,outcome:'domain',redirect:{uid:domain.uid,side:'ally',lane:domain.lane},will:b.will,enemyWill:b.enemyWill});return}const isuna=b.units.find(u=>u?.id==='isuna'&&GD.unlockedSkills(u.id,u.rankName).includes('爱的规律')&&!u.dead);if(isuna){globalThis.GHOST_VFX?.react('爱的规律',isuna,'代受伤害');dealRawDamage(e,isuna,damage*2*rankMultiplier(e,isuna)*receivedMultiplier(isuna),'爱的规律');b.log.unshift(`爱的规律：${isuna.name}替玩家承受双倍伤害`);await globalThis.GC_BRIDGE.fx('direct',{attacker:{uid:e.uid,side:'enemy',lane:e.lane},damage,critical:e.lastAttackRoll?.critical,outcome:'love',redirect:{uid:isuna.uid,side:'ally',lane:isuna.lane},will:b.will,enemyWill:b.enemyWill});return}const xuan=b.units.find(u=>u?.id==='xuan'&&(u.dodgeCharges||0)>0);if(b.will-damage<=0&&xuan){xuan.dodgeCharges--;globalThis.GHOST_VFX?.react('闪遁',xuan,'免疫');b.log.unshift('闪遁触发：萱华化为红烟，免疫本次致命伤害');await globalThis.GC_BRIDGE.fx('direct',{attacker:{uid:e.uid,side:'enemy',lane:e.lane},damage:0,critical:e.lastAttackRoll?.critical,outcome:'dodge',redirect:{uid:xuan.uid,side:'ally',lane:xuan.lane},will:b.will,enemyWill:b.enemyWill});globalThis.GC_BRIDGE.fx('float',{target:{uid:xuan.uid,side:'ally',lane:xuan.lane},text:'免疫',kind:'info',critical:false});return}b.will-=damage;b.log.unshift(`${e.name}令我方生命-${formatNum(damage)}`);await globalThis.GC_BRIDGE.fx('direct',{attacker:{uid:e.uid,side:'enemy',lane:e.lane},damage,critical:e.lastAttackRoll?.critical,outcome:'will',redirect:null,will:b.will,enemyWill:b.enemyWill});globalThis.GC_BRIDGE.fx('float',{target:'will',text:`${e.lastAttackRoll?.critical?'暴击 ':''}我方 -${formatNum(damage)}`,kind:'damage',critical:e.lastAttackRoll?.critical})}
async function hitEnemyWill(u){const damage=rollAttackDamage(u,effectiveAttack(u)*(1+(u.extraAdd||0))*outgoingMultiplier(u),'直接攻击');state.battle.enemyWill-=damage;state.battle.log.unshift(`${u.name}令敌方生命-${formatNum(damage)}`);await globalThis.GC_BRIDGE.fx('direct',{attacker:{uid:u.uid,side:'ally',lane:u.lane},damage,critical:u.lastAttackRoll?.critical,outcome:'enemyWill',redirect:null,will:state.battle.will,enemyWill:state.battle.enemyWill});globalThis.GC_BRIDGE.fx('float',{target:'enemyWill',text:`${u.lastAttackRoll?.critical?'暴击 ':''}敌方 -${formatNum(damage)}`,kind:'damage',critical:u.lastAttackRoll?.critical})}
function cleanup(){const b=state.battle;for(let i=0;i<4;i++){const u=b.units[i];if(u?.dead){if(b.domain?.uid===u.uid)b.domain=null;if(u.rollbackSnapshot){globalThis.GHOST_VFX?.react('时间回退',u,'逆转复活');const restored=clone(u.rollbackSnapshot);restored.initialized=true;delete restored.rollbackSnapshot;removeEffect(restored,'rollback');restored.dead=false;restored.lane=i;b.hand.push({kind:'ghost',unit:restored});if(!b.testMode){const own=spirit(u.id);if(own){own.dead=false;own.hp=Math.max(1,Math.min(own.maxHp,restored.hp));own.onceUsed=clone(restored.onceUsed||{})}}globalThis.GC_BRIDGE.fx('return',{uid:restored.uid??null,id:restored.id,kind:'rollback',handIndex:b.hand.length-1});soundCue('revive');b.log.unshift(`时间回退：${u.name}以记录状态复活并回到手牌`);b.revivedCount=(b.revivedCount||0)+1}else if(b.testMode)b.grave.push(clone(u));else{const s=spirit(u.id);if(s){s.hp=0;s.dead=true;s.onceUsed=clone(u.onceUsed||s.onceUsed||{});b.grave.push(clone(u))}}b.units[i]=null}else if(u&&!b.testMode){const s=spirit(u.id);if(s){s.hp=Math.min(s.maxHp,Math.max(0,u.hp));s.onceUsed=clone(u.onceUsed||s.onceUsed||{})}}}save()}
async function winBattle(){const b=state.battle;if(b.testMode){await globalThis.GC_BRIDGE.fx('battle:win',{testMode:true});globalThis.GC_BRIDGE.ui('testEnd',{result:'win'});return}const n=NODES[b.nodeId],levels=n.enemies.map(x=>x[1]),cardCount=Math.floor(levels.reduce((a,x)=>a+x,0)/2),xp=levels.reduce((sum,l)=>sum+(GD.ranks[Math.max(0,l-1)]?.killXp||1),0);state.will=Math.max(1,b.will);state.xp+=xp;for(const u of b.units.filter(Boolean)){const s=spirit(u.id);if(s)s.hp=Math.min(s.maxHp,Math.max(1,u.hp))}if(n.effect)applyEffect(n.effect,b.nodeId);if(n.bonus&&state.deck.length<25){state.deck.push(n.bonus);state.log.unshift(`额外获得${SKILLS[n.bonus].name}`)}state.log.unshift(`战胜${n.title}，获得${xp}经验与${cardCount}张卡牌`);const nodeId=b.nodeId;state.battle=null;completeNode(nodeId);save();await globalThis.GC_BRIDGE.fx('battle:win',{testMode:false});showRewards(cardCount,()=>{closeModal();renderMap()})}
function loseBattle(){const b=state.battle;if(b.testMode){globalThis.GC_BRIDGE.fx('battle:lose',{testMode:true});globalThis.GC_BRIDGE.ui('testEnd',{result:'lose'});return}const id=b.nodeId;state.battle=null;state.will=Math.max(1,state.will);for(const s of state.spirits){s.hp=Math.max(0,s.hp);s.dead=s.hp<=0}save();globalThis.GC_BRIDGE.fx('battle:lose',{testMode:false});globalThis.GC_BRIDGE.ui('defeat',{nodeId:id})}
function retryBattle(id){closeModal();startBattle(id)}
function weightedReward(){const roll=Math.random()*100,rarity=roll<50?'普通':roll<80?'稀有':roll<95?'珍藏':'传说',pool=Object.keys(SKILLS).filter(id=>SKILLS[id].rarity===rarity&&(id!=='horse'||state.horse));return pool[Math.floor(Math.random()*pool.length)]||'coin'}
let rewardDone=null;
function showRewards(count,done){if(count<=0||state.deck.length>=25){done();return}state.pendingReward={remaining:Math.min(count,25-state.deck.length),candidates:null,pendingPick:null};rewardDone=done;rollRewardCandidates()}
function rollRewardCandidates(){const r=state.pendingReward;if(!r)return;r.candidates=Array.from(new Set(Array.from({length:6},weightedReward))).slice(0,3);save();globalThis.GC_BRIDGE.ui('rewards')}
function chooseReward(i){const r=state.pendingReward,id=r?.candidates?.[i];if(!r||!SKILLS[id])return false;state.deck.push(id);r.remaining--;r.candidates=null;save();soundCue('draw');if(r.remaining<=0||state.deck.length>=25){const d=rewardDone;rewardDone=null;state.pendingReward=null;d()}else rollRewardCandidates();return true}
function finishRewards(){const d=rewardDone;rewardDone=null;state.pendingReward=null;if(d)d()}
function skipRewards(){finishRewards()}
function showRewardNode(id){globalThis.GC_BRIDGE.ui('rewardNode',{id})}
function claimRewardNode(id){showRewards(2,()=>{completeNode(id);closeModal();renderMap()})}
function showCamp(id){globalThis.GC_BRIDGE.ui('camp',{id,used:!!state.campChoices[id]})}
function campHeal(id){if(state.campChoices[id])return;for(const s of state.spirits){s.dead=false;s.hp=Math.min(s.maxHp,s.hp+s.maxHp*.6)}state.will=Math.min(state.maxWill,state.will+state.maxWill*.6);state.campChoices[id]='heal';save();showCamp(id)}
function campSearchCards(id){if(state.campChoices[id])return;state.campChoices[id]='cards';save();showRewards(5,()=>showCamp(id))}
function campUpgrade(id){upgradeChoice(id)}
function campLeave(id){completeNode(id);closeModal();renderMap()}
function upgradeChoice(campId){globalThis.GC_BRIDGE.ui('upgradeChoice',{campId})}
function upgradeAtCamp(i,campId){const s=state.spirits[i],rank=GD.ranks[s.rankIndex],next=s.id==='nannan'?null:GD.ranks[s.rankIndex+1];if(!next||state.xp<rank.upgradeXp)return;state.xp-=rank.upgradeXp;s.rankIndex++;s.rankName=next.name;s.level=s.rankIndex+1;const stats=spiritStats(s.id,s.rankName,s.potential);s.maxHp=stats.hp;s.hp=stats.hp;s.atk=stats.atk;s.dead=false;syncPlayerVitality(state,true);state.log.unshift(`${s.name}升至${s.rankName}`);save();showCamp(campId)}
function showEnding(){state.ending=true;save();globalThis.GC_BRIDGE.ui('ending')}
function finishEnding(){completeNode('ending');closeModal();renderHome()}
function closeModal(){globalThis.GC_BRIDGE.ui('close')}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function journal(){globalThis.GC_BRIDGE.ui('journal')}
globalThis.__CAMPAIGN_TEST__={stripPositiveEffects,returnUnitToHand,deployGhost,expireEffect,addEffect,addAttackBonus,applyDespair,advanceStatuses,resolveExactSkill,cleanup,reviveOne,reviveAll,spiritStats,setSelection:x=>selected=x,NODES,STORY,SKILLS,ENEMIES,DEFAULT,ACT_ROWS,GD,clone,getState:()=>state,setState:x=>state=x,addSpirit,startBattle,completeNode,applyEffect,maxHp,enemyHp,renderTestLab,startTestBattle,rankMultiplier,spiritCost,effectiveAttack,critProfile,rollAttackDamage,skillDamage,dealRawDamage,initUnit,applyAnalysis,selectHand,allyLane,allyTarget,enemyTarget,exactSpiritSkill,selectPlayerSkill,usePlayerSkill,moveSpirit,playSkill,endTurn,hitWill,hitEnemyWill,drawCards,chooseReward,skipRewards,finishRewards,getBattle:()=>state.battle,getSelection:()=>({selected,targetMode}),isBusy:()=>busy};
