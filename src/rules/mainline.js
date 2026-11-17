/* Complete offline campaign. Existing ghost skills remain defined in codex.js. */
const ML=globalThis.MAINLINE_DATA;
const SLOT_KEY='youqi-mainline-slots-v2';
const MODE_NAMES={normal:'普通',hardcore:'极限',endless:'无尽'};
let activeSlot=null,slots=readSlots(),roundSnapshot=null,readerPosition=0;
const legacyHome=renderHome,legacyMap=renderMap,legacyStart=startBattle,legacyWin=winBattle,legacyLose=loseBattle;
const legacyCollection=openCollection,legacyDetails=showBattleDetails;
const legacyEndTurn=endTurn,legacyEnemyHit=hitWill,legacyAllyHit=hitEnemyWill,legacySave=save,legacyPrepare=prepareBattle;
const MAIN_KEYS=new Set(),ALLOWED_STORY_GHOSTS=new Set();
for(const a of ML.arcs)for(const c of a.contracts)if(!c.id.startsWith('support:'))ALLOWED_STORY_GHOSTS.add(c.id);

function readSlots(){
 for(const key of [SLOT_KEY,SLOT_KEY+'-backup'])try{
  const v=JSON.parse(localStorage.getItem(key)||'null');
  if(v?.version===2&&Array.isArray(v.slots)&&v.slots.length===4)return v.slots;
 }catch{}
 return Array(4).fill(null);
}
function writeSlots(){
 const payload=JSON.stringify({version:2,slots});
 try{localStorage.setItem(SLOT_KEY+'-backup',localStorage.getItem(SLOT_KEY)||payload);localStorage.setItem(SLOT_KEY,payload);return true}
 catch(e){globalThis.GC_BRIDGE.notify('存档写入失败，请先导出备份，避免关闭后丢失。','warn');return false}
}
save=function(){
 if(!state.mainline){legacySave();return}
 if(!state.battle?.testMode&&activeSlot!==null){
  const snapshot=clone(roundSnapshot||state);snapshot.log=snapshot.log.slice(0,250);
  if(snapshot.battle)snapshot.battle.log=snapshot.battle.log.slice(0,150);
  snapshot.updatedAt=Date.now();slots[activeSlot]=snapshot;writeSlots();
 }
 updateHud();
};
function freshCampaign(mode,name){
 const x=clone(DEFAULT);Object.assign(x,{mainline:true,mode,name:name||MODE_NAMES[mode]+'旅途',version:1,current:'a01-story',available:['a01-story'],maxWill:10,will:10,supportContracts:[],storyRead:[],pendingSettlement:null,checkpoint:null,wave:1,fallen:false,battle:null,trainClaims:{}});
 x.deck=['coin','coin','coin','blade','blade','revive','relic','horse','rope','ghostclothes','ghostclothes'].filter(id=>SKILLS[id]);
 x.horse=true;return x;
}
function fullHeal(target=state){for(const s of target.spirits){s.hp=s.maxHp;s.dead=false}target.will=target.maxWill=10;}
function recordCheckpoint(id){const snap=clone(state);snap.battle=null;snap.pendingSettlement=null;snap.checkpoint=null;snap.current=id;snap.available=NODES[id]?.next?.slice()||snap.available;fullHeal(snap);state.checkpoint={node:id,snapshot:snap};save();}

const BOSS_SKILLS={};
const bossKind={
 '木鱼引路':'slow','旧村鬼域':'shield','迎亲队列':'summon','红烛守护':'shield','铁骑冲阵':'strike','甲胄加固':'shield',
 '镜中借影':'summon','镜面护盾':'shield','遗迹回声':'mark','伞影困阵':'slow','画中围猎':'mark','破卷鬼锋':'strike',
 '假面误导':'slow','灰雾遮蔽':'shield','黑骨重塑':'heal','荒海侵蚀':'mark','寒域封路':'slow','双鬼共振':'rage',
 '牢笼封路':'slow','绝对防御':'shield','流沙封锁':'mark','时间迟滞':'slow','隐匿试探':'shield','鬼军集结':'summon',
 '黄金眼':'strike','圣光甲胄':'shield','远射威慑':'strike','游荡换位':'shift','绝望侵蚀':'mark','不存在之步':'shift',
 '镜壁潜袭':'strike','假门引路':'slow','沉睡低语':'slow','诅咒回响':'mark','山印禁行':'slow','供奉汲取':'heal',
 '滔天巨浪':'strike','深海甲壳':'shield','昨日回环':'heal','暗影代价':'rage','画鬼点睛':'summon','母画护身':'shield',
 '幻面迷阵':'slow','洞中聚灵':'summon','疫雾扩散':'mark','旧城回声':'rage','祈愿梦域':'slow','白面换影':'shift',
 '疫潮蔓延':'mark','诅咒共鸣':'rage','虚无地狱':'slow','伪经锁魂':'mark','一眼万年':'slow','狐面幻境':'shield'
};
const BOSS_DESCS={
 slow:'敌方阶段开始，令生命最高的我方在场鬼灵下次行动停止1次；只持续1回合，不会连续封锁同一单位。',
 shield:'获得最大生命18%的护盾，持续2回合；护盾不累积。',
 summon:'在一个空路召来一名较弱随从，场上最多4名敌人；每场最多召唤1次。',
 strike:'对正前方鬼灵造成一次特殊攻击，最高为目标最大生命的18%；没有目标时只蓄势，不直接伤害玩家。',
 mark:'给生命最高的我方在场鬼灵添加2回合标记，期间受到伤害增加15%；不能叠加。',
 heal:'恢复自身最大生命12%，每场最多恢复2次。',
 rage:'获得2回合20%攻击强化，不能叠加。',
 shift:'移动到相邻空路，若无空路则获得1回合10%攻击强化。'
};
Object.assign(bossKind,{
 '阴风横扫':'aoe','噬魂':'drain','厄咒':'curse','业火缠身':'burn','封灵印':'seal','夺气':'steal','乱阵':'chaos','行刑':'execute','威压':'dread','蚀灯':'siphon','涤秽':'purge','结阵':'fortify',
 '八首毒瘴':'dread','蛇首再生':'heal','毒种蔓延':'burn','煞气箭':'strike','尸煞侵体':'curse','坟土重生':'heal','神火煞箭':'execute','万尸朝拜':'summon','不灭尸身':'fortify',
 '星辰神域':'fortify','七杀星坠':'aoe','摘星':'steal','阎王印':'seal','厉鬼索命':'execute','地狱不空':'summon','千灯夺魂':'curse','失魂鬼潮':'summon','古路触手':'aoe',
 '吞天':'drain','蛇腹烈焰':'burn','黑蝶化梦':'chaos','鸡脚屋':'shift','诅咒新法':'curse','林中恶魔':'summon','九首再生':'heal','毒血':'burn','裂缝挤压':'aoe',
 '堕天之翼':'aoe','残缺之月':'seal','地狱熔岩':'burn','脱胎换骨':'heal','鬼婴替死':'summon','五鬼破军':'aoe','天狗食月':'steal','幽鬼四出':'summon','四方皆力':'fortify',
 '赤地千里':'burn','止风雨':'seal','不祥':'dread','镜中星':'chaos','帝后偷袭':'execute','香火不绝':'heal','泰坦之握':'execute','地狱君主':'summon','魔盒灾厄':'curse',
 '堕落低语':'curse','裹尸布':'fortify','黑暗天使':'summon','尘世之环':'fortify','毒涎':'burn','巨狼同行':'summon','不可伤害':'fortify','黑暗天使军团':'summon','神罚':'execute'
});
Object.assign(BOSS_DESCS,{
 aoe:'对我方全部在场鬼灵各造成一次相当于攻击55%的伤害，单体最高为其最大生命的14%。',
 drain:'汲取正前方鬼灵：造成一次攻击80%的伤害（最高为其最大生命的20%），并恢复自身等量生命。',
 curse:'诅咒攻击最高的我方在场鬼灵，使其接下来造成的伤害降低30%，持续2回合。',
 burn:'点燃生命最高的我方在场鬼灵，接下来2个敌方阶段开始时各损失最大生命的8%。',
 seal:'封印攻击最高的我方在场鬼灵：其全部主动技能进入至少2回合冷却。',
 steal:'噬取鬼气：我方下回合可用鬼气减少2点（至少保留1点）。',
 chaos:'搅乱阵型：将我方两名在场鬼灵对调位置；只有一名时把它推到相邻空位。',
 execute:'对正前方鬼灵行刑：生命低于25%时直接击杀，否则造成一次攻击100%的伤害（最高为其最大生命的25%）。',
 dread:'威压全场：我方全部在场鬼灵受到的伤害增加12%，持续2回合，不叠加。',
 siphon:'蚀灯：直接熄灭我方命灯上限的6%，不能被鬼域转移；每场最多3次。',
 purge:'净化全部敌方单位身上的控制与减益状态（解析除外）；每场最多2次。',
 fortify:'为全部敌方单位各附加最大生命10%的护盾，持续2回合。'
});
for(const [name,kind] of Object.entries(bossKind))BOSS_SKILLS[name]={name,kind,desc:BOSS_DESCS[kind],cooldown:4};
const BOSS_TRAITS={'狂怒':'被动：生命低于50%后，攻击提高40%。','坚壁':'被动：受到的全部伤害降低20%。','不死之躯':'被动：第一次被击倒时以35%生命重新站起（画卷绝杀、鬼主权杖等直接击杀可以绕过）。','鬼障':'全场：每回合开始时鬼障重新合拢。鬼障未破时，我方普通攻击、反击与空路直击被削弱：普通保留六成，困难保留四成，噩梦与禁忌完全无效。本回合内我方每主动施放一次鬼灵技能（领域开关不算）、打出一张技能卡或使用一次御鬼者技能，破除一层（禁忌有两层）；技能伤害不受鬼障影响。'};
for(const [name,desc] of Object.entries(BOSS_TRAITS))BOSS_SKILLS[name]={name,kind:'trait',desc};
const EXTRA_SKILLS=['阴风横扫','厄咒','业火缠身','封灵印','夺气','乱阵','行刑','威压','蚀灯','涤秽','结阵','噬魂'],MINION_SKILLS=['厄咒','结阵','夺气','阴风横扫'];
const DIFFICULTIES={
 easy:{name:'简单',life:1,bite:.2,hp:1,atk:1,every:2,extra:0,count:0,rank:0,xp:1,elite:0,traits:[],minionTraits:[],desc:'敌人保持基础强度。按推荐培养，把鬼灵放到有敌人的路上，不放技能也能通关。'},
 normal:{name:'普通',life:1.3,bite:.22,strike:.163,hp:2.82,atk:2.4,every:2,extra:1,count:1,rank:0,xp:1.15,elite:0,ward:1,wardBase:.6,traits:[],minionTraits:[],desc:'敌人更耐打、更疼，首领多一个技能，第 9 幕起多一名敌人。全场有一层薄鬼障：当回合不主动施放技能或打出技能卡，普通攻击与空路直击只剩六成。需要适时释放鬼灵技能与卡牌。'},
 hard:{name:'困难',life:1.6,bite:.25,strike:.163,hp:3.4,atk:2.9,easeActs:10,flat:.5,every:2,extra:1,count:1,rank:0,xp:1.3,elite:1,ward:1,wardBase:.4,traits:[],minionTraits:[],desc:'敌人更强，随从带有精英技能。鬼障更厚：当回合不施放技能，普通攻击与空路直击只剩四成。需要了解等级压制、站位与鬼气节奏，并会用技能。'},
 nightmare:{name:'噩梦',life:2,bite:.3,strike:.126,hp:4,atk:3.2,easeActs:10,flat:.8,every:1,extra:2,count:1,rank:0,xp:1.5,elite:2,ward:1,wardBase:0,traits:['狂怒','坚壁'],minionTraits:[],desc:'首领每回合施法，并带有狂怒与坚壁。鬼障完全合拢：当回合不主动施放技能或打出技能卡，普通攻击与空路直击全部无效。需要熟练衔接多名鬼灵的技能。'},
 taboo:{name:'禁忌',life:2.6,bite:.36,strike:.1,hp:4.4,atk:3.4,easeActs:10,flat:1,every:1,extra:3,count:1,rank:1,xp:2,elite:3,ward:2,wardBase:0,traits:['狂怒','坚壁','不死之躯'],minionTraits:['坚壁'],desc:'敌人在等级压制上高一级，首领拥有不死之躯。两层鬼障：当回合施放一次技能只恢复一半普攻效果，两次才完全破除。要求对规则有深入理解，常规打法无法通关。'}
};
// Scale applied on 2026-11-16 at the user's request: enemy strength x1.5 for 普通/困难, x2.5 for 噩梦, x4 for 禁忌 relative to the
// previous table (hp/atk 2.3/2.15, 3/2.7, 3.6/3, 5/3.8; strike cap .2 everywhere). "Strength" = unit hp x unit atk, split evenly
// (each x sqrt(k)); the enemy life pool is toughened by the same sqrt(k) through `strike`, the share one direct hit can remove.
// The table holds the full-strength values. They ease in over acts 2-8, while the roster grows from one ghost to five (see tuned()):
// multipliers interpolate, boss traits / elite skills / every-round casting start at act 7, the extra enemy and 禁忌's rank bonus at act 9.
// (2026-11 更新：缓入长度是每档的 easeActs——普通 8 幕、困难以上 10 幕；mid = 缓入的 75%（普通第 7 幕、困难以上第 9 幕），full = 缓入结束
// （普通第 9 幕、困难以上第 11 幕）。鬼障基础减伤 wardBase 也按同一条 r 缓入，噩梦/禁忌不再从第 2 幕起就让普攻完全无效。)
// Without the ramp the first acts were the wall (one or two ghosts against three or four enemies): the naive skill-using bot of
// tests/difficulty_test.cjs lost acts 2-4 on 普通, 2-8 on 困难 and everything up to act 14 on 噩梦, while later acts were too soft.
// 按等级段拉平（难度参数 flat，0=不拉平，只有困难以上使用）：原始数值里敌人相对鬼灵的强度各等级段相差数倍——鬼灵生命表是
// …800,900,1400,1800,5000,10000,50000,120000…，中段升一级几乎不变强、后段升一级翻几倍，后期首领又是血厚攻低的沙包。高难度的统一
// 倍率乘上去后 13–25 幕成墙、26 幕起却不痛。两张表把每个等级段的「首领攻击/鬼灵生命」「首领生命/鬼灵攻击」拉到同一水平：
// 以练满到等级上限（幕等级+1）的鬼灵为基准，由 46 幕主战在简单难度下的实际敌人算出（夹在 0.5–4 后再归一），下标是幕的等级 0..22。
const FLAT_A=[1.45,1.45,0.8,0.8,0.8,0.96,1.18,0.95,0.85,1.0,1.37,1.48,1.99,1.01,1.02,0.95,1.97,2.03,3.08,3.08,3.08,2.79,0.38];
const FLAT_H=[1.25,1.25,1.25,1.25,1.11,0.96,1.39,1.01,0.87,1.16,1.07,0.86,1.17,0.73,0.97,0.85,1.26,0.77,0.77,0.58,1.51,2.19,1.36];
function tuned(n){
 const D=n?.difficulty===1?DIFFICULTIES.easy:diffCfg(),r=n?.mainline&&n.act?Math.min(1,Math.max(0,(n.act-1)/(D.easeActs||8))):1,full=r>=1,mid=r>=.75,mix=(a,b)=>full?b:a+(b-a)*r;
 const k=Math.max(0,Math.min(22,n?.rank||0)),w=n?.mainline&&n.act?(D.flat||0)*r:0;
 // 拉平只许削峰、不许倒挂：有 flat 的难度（困难以上）任何一幕的生命/攻击倍率都不低于普通难度同幕的倍率再加一点（困难+7.5%、噩梦+12%、禁忌+15%）
 const N=DIFFICULTIES.normal,up=w>0?1+.15*(D.flat||0):0,lowHp=up?Math.pow(N.hp,r)*up:0,lowAtk=up?Math.pow(N.atk,r)*up:0;
 return {...D,ramp:r,hp:Math.max(Math.pow(D.hp,r)*Math.pow(FLAT_H[k],w),lowHp),atk:Math.max(Math.pow(D.atk,r)*Math.pow(FLAT_A[k],w),lowAtk),life:mix(1,D.life),bite:mix(.2,D.bite),biteFloor:(D.biteFloor||0)*r,strike:mix(.2,D.strike||.2),count:full?D.count:0,rank:full?D.rank:0,extra:Math.round(D.extra*(n?.mainline&&n.act?Math.min(1,Math.max(0,(n.act-1)/8)):1)),every:mid?D.every:2,elite:mid?D.elite:0,traits:mid?D.traits:[],minionTraits:full?D.minionTraits:[],ward:D.ward?(full?D.ward:1):0,wardBase:D.wardBase==null?1:mix(1,D.wardBase)};
}
// 首领技能的次数上限（召唤 1 次、治疗 2 次、噬气 3 次、净化 2 次）。轮到已用满的技能时顺延到下一个还能用的，不再白白空过一个施法回合。
function bossSkillSpent(e,name){const d=BOSS_SKILLS[name],uses=e.bossUses?.[name]||0;return !!d&&(d.kind==='summon'&&uses>=1||d.kind==='heal'&&uses>=2||d.kind==='siphon'&&uses>=3||d.kind==='purge'&&uses>=2)}
function bossCastSlot(e){const L=e.bossSkills.length,at=e.bossCastIndex||0;for(let i=0;i<L;i++)if(!bossSkillSpent(e,e.bossSkills[(at+i)%L]))return at+i;return at}
function setDifficulty(d){if(!DIFFICULTIES[d]||!state.mainline||state.battle)return false;state.difficulty=d;if(state.mode==='endless')ensureEndlessNode();state.log.unshift('难度调整为'+DIFFICULTIES[d].name);save();return true}
function difficultyOf(s=state){return DIFFICULTIES[s?.difficulty]?s.difficulty:'easy'}
function diffCfg(){return DIFFICULTIES[difficultyOf()]}

function buildMainline(){
 ML.arcs.forEach((a,i)=>{
  const p=a.id,story=p+'-story',fight=p+'-battle',camp=p+'-camp',explore=p+'-explore',trial=p+'-trial';
  const cs=a.contracts.filter(c=>c.id!=='tong'),chain=cs.map((c,j)=>p+'-contract-'+j);
  STORY[story]=a.summary;STORY[fight]=a.summary.split('\n')[1]||a.summary;
  NODES[story]={act:a.act,title:a.title,type:'event',story,next:[fight],arc:i,chapterIntro:true};
  NODES[fight]={act:a.act,title:a.boss,type:i===0?'battle':'boss',story:fight,next:[chain[0]||p+'-fork'],arc:i,mainline:true,rank:a.rank,bossSkills:a.bossSkills,novelRank:a.novelRank,enemies:[],difficulty:i===0?1:i<3?2:3,cards:i===0?1:i<3?2:3};
  cs.forEach((c,j)=>{const key=chain[j];STORY[key]=c.text;NODES[key]={act:a.act,title:'契约 · '+c.name,type:'event',story:key,next:[chain[j+1]||p+'-fork'],arc:i,contract:c,mainline:true};});
  const fork=p+'-fork';STORY[fork]='战斗后的道路重新分开。你可以调查附近的线索，挑战一处额外的鬼域，或者直接回到安全篝火。所有道路都会汇合，关键契约已在主线中完成。额外调查不会决定伙伴的生死。';
  NODES[fork]={act:a.act,title:'旅途抉择',type:'event',story:fork,next:[explore,trial,camp],arc:i,mainline:true};
  const clue=['黄金墙外的巡逻记录','委托人的遗留笔记','未点燃的红烛','水下航道图','要塞的求援灯','遗迹中的旧伞骨','画卷边缘的鬼纹','灰雾留下的足迹','月阙古城的碑文','守城的换班手册','牢笼闭合的时刻','梦中的年历','鬼城的军旗纹样','西方寄来的旧信','雪屋外的脚印','黑洞前留下的木鱼印记','武城的电梯维修单','长公主讲述的旧故事','镇鬼塔里的经文','海潮退去的方向','城堡的旧钟','神女像底座的刻字','书童留下的画笔','腹中城的药方','村民保存的神像碎片','黄泉船上的回信','经书旁的旧印','杀生石边的封印残片','黄泉路旁的界碑','母画背面的题字','青铜剑上的铭文','星图上缺失的一宿','阎王印的拓片','通幽古路的灯油','蛇腹里的旧城砖','鸡脚屋外的脚印','月桂树的落叶','圣堂地下的锁链','太岁肉留下的土腥','祭月坛的残香','陇城的震痕','第十域的界镜','魔盒底部的刻字','裹尸布的一角','落日弓的弓弦','小岛上的请柬'][i]||'旧日的记录';
  STORY[explore]=`你停下脚步，整理${clue}。线索无法替你决定下一场战斗，却让同伴们理解这片地方发生过什么。林风把仍有用的记录交给可信任的人，再与伙伴回到篝火。调查提供额外经验与一轮卡牌选择，不改变任何关键契约。`;
  NODES[explore]={act:a.act,title:'调查 · '+clue,type:'reward',story:explore,next:[camp],arc:i,mainline:true,cards:1};
  STORY[trial]=`附近仍有一片没有清理的鬼域。林风先确认居民已经撤离，再与伙伴商定进入的位置。这里的挑战属于额外委托，失利时普通模式仍会返回篝火；直接跳过也不会阻止主线前进。`;
  NODES[trial]={act:a.act,title:'支线 · 余波清理',type:'battle',story:trial,next:[camp],arc:i,mainline:true,rank:Math.max(0,a.rank-1),enemies:[],bossSkills:[],difficulty:2,cards:2};
  NODES[camp]={act:a.act,title:a.title+' · 篝火',type:'camp',next:[i<ML.arcs.length-1?ML.arcs[i+1].id+'-story':'main-ending'],arc:i,mainline:true};
  ACT_ROWS[a.act]=[[story],[fight],...chain.map(c=>[c]),[fork],[explore,trial],[camp]];
  for(const key of [story,fight,...chain,fork,explore,trial,camp])MAIN_KEYS.add(key);
 });
 STORY['main-ending']='从柳城教室里的一枚红色蝴蝶结，到满天神佛退去的那一夜，林风与鬼灵们把信任一点点变成了可以共同守护的秩序。黑暗上帝与黑暗天庭都已不在，东方的圣灵重新现世，西方有了新的上帝。鬼族的婚礼如约举行，潘多拉合上了魔盒。开满鲜花的小岛上，童童问永远有多久。林风看着身边的每一个人，答：就是字面上的意思，永永远远。';
 NODES['main-ending']={act:ML.arcs.length,title:'终幕 · 永永远远',type:'ending',story:'main-ending',next:[],mainline:true};MAIN_KEYS.add('main-ending');ACT_ROWS[ML.arcs.length].push(['main-ending']);
 for(const key of MAIN_KEYS){const n=NODES[key];if(n.type==='battle'||n.type==='boss')n.enemies=enemyRoster(key).map(e=>[e.id,e.rankIndex+1]);}
}
function enemyRoster(id){
 const n=NODES[id],a=ML.arcs[n.arc||0],boss=n.type==='boss',tutorial=n.difficulty===1,D=tuned(n),r=Math.max(0,Math.min(22,n.rank||0)),count=Math.min(4,(tutorial?1:n.difficulty===2?2:3)+D.count);
 const result=[];
 for(let i=0;i<count;i++){
  const bi=Math.max(0,r-(i?1:0)),ri=Math.min(22,bi+D.rank),rankName=GD.ranks[ri].name,st=GD.statsForRank(GD.ranks[bi].name,i?1:3);
  const factor=(i?0.62:boss?0.92:0.8)*D.hp,atkFactor=(i?.3:.43)*D.atk,lead=!i&&boss,base=lead?(n.bossSkills||[]):[],extra=[];
  if(!i&&(boss||D.elite>=1))for(let k=0;k<(boss?D.extra:1);k++){const s=EXTRA_SKILLS[((n.arc||0)*3+k*5)%EXTRA_SKILLS.length];if(!base.includes(s)&&!extra.includes(s))extra.push(s)}
  if(i&&D.elite>=1)extra.push(MINION_SKILLS[((n.arc||0)+i)%MINION_SKILLS.length]);
  result.push({uid:'e-main'+i,id:'main-enemy-'+n.arc+'-'+i,name:i?'随从 · '+(a?.title||'余波'):(id.endsWith('-battle')?a.boss:'徘徊恶灵'),rankName,rankIndex:ri,level:ri+1,potential:i?1:3,type:'恶灵',novelRank:n.novelRank||a.novelRank,maxHp:Math.max(2,Math.round(st.hp*factor)),hp:Math.max(2,Math.round(st.hp*factor)),baseAtk:Math.max(.4,+(st.atk*atkFactor).toFixed(1)),atk:Math.max(.4,+(st.atk*atkFactor).toFixed(1)),lane:i,dead:false,effects:{},bossSkills:[...base,...extra],bossTraits:[...(lead?D.traits:i?D.minionTraits:[]),...(D.ward&&!i?['鬼障']:[])],elite:!lead&&extra.length>0,bossEvery:lead?D.every:3,bossUses:{},bossNext:lead?2:3+i});
 }
 return result;
}
buildMainline();

renderHome=function(){
 updateHud();globalThis.GC_BRIDGE.ui('home');
};
function createSlotDialog(i){
 globalThis.GC_BRIDGE.ui('slotDialog',{index:i,occupied:!!slots[i]});
}
function confirmNewSlot(i,mode,name,difficulty){newSlot(i,mode,name,difficulty);closeModal();renderMap()}
function newSlot(i,mode,name,difficulty){
 if(!Number.isInteger(i)||i<0||i>3||!MODE_NAMES[mode])return false;
 activeSlot=i;state=freshCampaign(mode,name);state.difficulty=DIFFICULTIES[difficulty]?difficulty:'easy';selected=targetMode=null;busy=false;
 if(mode==='endless'){
  for(const c of GD.spirits){addSpirit(c.id);const s=spirit(c.id),st=spiritStats(c.id,'噩梦一阶',c.potential);Object.assign(s,{rankName:'噩梦一阶',rankIndex:10,level:11,maxHp:st.hp,hp:st.hp,atk:st.atk,dead:false});}
  state.xp=10000;state.current='endless-arena';state.available=[];fullHeal();ensureEndlessNode();
 }else{recordCheckpoint('a01-story');state.checkpoint.snapshot.available=['a01-story'];state.checkpoint.snapshot.current='a01-story';}
 save();return true;
}
function loadSlot(i){
 const s=slots[i];if(!s||s.fallen)return false;activeSlot=i;state=clone(s);state.mainline=true;busy=false;roundSnapshot=null;selected=targetMode=null;
 if(state.mode==='endless')ensureEndlessNode();
 if(state.battle?.testMode)state.battle=null;
 if(state.pendingSettlement){renderMap();renderSettlement();}
 else if(state.battle){if(state.battle.will<=0){loseBattle();return true}globalThis.GC_BRIDGE.ui('battle');globalThis.GC_BRIDGE.fx('battle:enter',{testMode:false,nodeId:state.battle.nodeId});}
 else{renderMap();if(state.ending)showEnding();}return true;
}
function exportSlotsData(){return JSON.stringify({version:2,slots},null,2)}
function exportSlots(){return exportSlotsData()}
function validImportedSlot(s){return !s||(s.mainline===true&&MODE_NAMES[s.mode]&&Array.isArray(s.spirits)&&Array.isArray(s.deck)&&Array.isArray(s.available)&&Array.isArray(s.completed)&&Array.isArray(s.log)&&Number.isFinite(s.xp)&&s.xp>=0&&s.spirits.every(g=>GD.spirits.some(c=>c.id===g.id))&&s.deck.every(id=>SKILLS[id])&&(s.mode==='endless'||s.available.every(id=>MAIN_KEYS.has(id)))&&(!s.battle||s.battle.nodeId==='endless-arena'||MAIN_KEYS.has(s.battle.nodeId)));}
function importSlotsData(jsonText){
 try{
  const v=JSON.parse(jsonText);if(v.version!==2||!Array.isArray(v.slots)||v.slots.length!==4||!v.slots.every(validImportedSlot))return {ok:false,error:'这不是有效的四档备份'};
  slots=clone(v.slots);activeSlot=null;state=clone(DEFAULT);writeSlots();closeModal();renderHome();return {ok:true};
 }catch(e){return {ok:false,error:e.message}}
}

renderMap=function(){
 if(!state.mainline){legacyMap();return}if(state.mode==='endless'){renderEndless();return}
 updateHud();const next=state.available[0],act=NODES[next]?.act||NODES[state.current]?.act||1;
 globalThis.GC_BRIDGE.ui('map',{act});
 if(state.pendingSettlement)renderSettlement();
};
const legacyEnter=enterNode;
enterNode=function(id){if(!state.mainline){legacyEnter(id);return}if(busy||state.pendingSettlement||!state.available.includes(id))return;state.current=id;save();const n=NODES[id];if(n.type==='camp')showCamp(id);else if(['battle','boss'].includes(n.type))showStoryBeforeBattle(id);else if(n.type==='reward')showRewardNode(id);else if(n.type==='ending')showEnding();else showEvent(id);};
const legacyEvent=showEvent;
showEvent=function(id){
 if(!MAIN_KEYS.has(id)){legacyEvent(id);return}
 globalThis.GC_BRIDGE.ui('event',{id});
};
function continueMainlineEvent(id){const n=NODES[id];if(busy)return;if(n.chapterIntro){if(n.arc===0&&!spirit('tong'))grantContract(ML.arcs[0].contracts[0]);grantTraining(n.arc);}if(n.contract)grantContract(n.contract);if(!state.storyRead.includes(id))state.storyRead.push(id);completeNode(id);closeModal();renderMap();}
function grantContract(c){if(c.id.startsWith('support:')){if(!state.supportContracts.some(s=>s.id===c.id))state.supportContracts.push(clone(c));if(c.id==='support:horse')state.horse=true;}else if(ALLOWED_STORY_GHOSTS.has(c.id))addSpirit(c.id);state.log.unshift('完成契约剧情：'+c.name);fullHeal();save();}
const legacyComplete=completeNode;
completeNode=function(id){
 if(!MAIN_KEYS.has(id)){legacyComplete(id);return}if(state.completed.includes(id))return;
 state.completed.push(id);const n=NODES[id],a=ML.arcs[n.arc||0];
 if(n.type==='camp')for(const s of state.spirits)for(const name of Object.keys(s.skillRestore||{})){if(--s.skillRestore[name]<=0){delete s.skillRestore[name];delete s.onceUsed?.[name];}}
 const siblings=[a.id+'-explore',a.id+'-trial',a.id+'-camp'];state.available=state.available.filter(x=>x!==id&&(!siblings.includes(id)||!siblings.includes(x)));
 for(const next of n.next)if(!state.completed.includes(next)&&!state.available.includes(next))state.available.push(next);
 if(n.type==='camp')recordCheckpoint(id);save();
};
let archiveBack=null,readerArc=0,readerBack=null;
function openStoryArchive(back=renderMap){
 archiveBack=back;
 globalThis.GC_BRIDGE.ui('storyArchive');
}
function viewArchiveAct(i){globalThis.GC_BRIDGE.ui('archiveAct',{arc:i})}
function closeStoryArchive(){closeModal();const back=archiveBack;archiveBack=null;back?.()}
function openReader(arcIndex,back=renderMap){
 readerArc=arcIndex;readerBack=back;readerPosition=0;
 globalThis.GC_BRIDGE.ui('reader',{arc:arcIndex,page:0});
}
function readerPage(delta){const a=ML.arcs[readerArc];if(!a)return;const next=Math.max(0,Math.min(a.pages.length-1,readerPosition+delta));if(next===readerPosition)return;readerPosition=next;globalThis.GC_BRIDGE.ui('reader',{arc:readerArc,page:readerPosition})}
function closeReader(){closeModal();const back=readerBack;readerBack=null;back?.()}

function upgradeBudget(s,target){let total=0;for(let i=s.rankIndex;i<target;i++)total+=GD.ranks[i]?.upgradeXp||0;return total;}
function grantTraining(arcIndex){
 const key=ML.arcs[arcIndex].id;if(state.trainClaims[key])return 0;
 const target=Math.max(0,ML.arcs[arcIndex].rank),s=state.spirits.filter(s=>s.id!=='nannan').sort((a,b)=>a.rankIndex-b.rankIndex).slice(0,4);
 const budget=s.reduce((sum,g)=>sum+upgradeBudget(g,target),0);state.xp+=budget;state.trainClaims[key]=budget;state.log.unshift(`本幕修行补给：${budget}经验（用于现有伙伴成长）`);save();return budget;
}
// 一键修行：优先练出战队伍里最强的 4 只（没有编队时取全队最强 4 只），从等级最低的开始一级一级升，经验不会摊到替补身上。
function trainTeam(arcIndex){const target=Math.max(0,ML.arcs[arcIndex].rank),all=state.spirits.filter(s=>s.id!=='nannan'&&!s.dead),squad=all.filter(s=>(state.squad||[]).includes(s.id)),top=(squad.length?squad:all).sort((a,b)=>b.rankIndex-a.rankIndex||b.atk-a.atk).slice(0,4);
 for(let g=0;g<400;g++){const s=top.filter(x=>x.rankIndex<target).sort((a,b)=>a.rankIndex-b.rankIndex)[0];if(!s||state.xp<GD.ranks[s.rankIndex].upgradeXp||!upgradeGhostRecord(s,Math.max(target,rankCap())))break}save();}
// 等级上限：主线里鬼灵最多比当前幕的推荐等级高 1 级（无尽模式不限）。没有这条时，中期一场战斗的经验够连升好几级，靠等级压制可以无视难度。
function rankCap(){const top=GD.ranks.length-1;if(!state||!state.mainline||state.mode==='endless')return top;let arc=-1;for(const id of [...(state.available||[]),state.current,state.battle&&state.battle.nodeId]){const n=id&&NODES[id];if(n&&n.arc!=null)arc=Math.max(arc,n.arc)}return arc<0?top:Math.min(top,Math.max(0,ML.arcs[arc].rank)+1)}
function upgradeGhostRecord(s,cap=rankCap()){const r=GD.ranks[s.rankIndex],next=GD.ranks[s.rankIndex+1];if(s.id==='nannan'||!next||state.xp<r.upgradeXp||s.rankIndex>=cap)return false;state.xp-=r.upgradeXp;s.rankIndex++;s.rankName=next.name;s.level=s.rankIndex+1;const st=spiritStats(s.id,s.rankName,s.potential);s.maxHp=s.hp=st.hp;s.atk=st.atk;s.dead=false;return true;}
let trainingCtx=null;
function showTraining(arcIndex,back=renderMap){
 grantTraining(arcIndex);trainingCtx={arc:arcIndex,back};
 globalThis.GC_BRIDGE.ui('training',{arc:arcIndex});
}
function trainingHeal(){if(!trainingCtx)return;fullHeal();save();globalThis.GC_BRIDGE.ui('training',{arc:trainingCtx.arc})}
function trainingManage(){if(!trainingCtx)return;const ctx=trainingCtx;openCollection(()=>showTraining(ctx.arc,ctx.back))}
function trainingClose(){if(!trainingCtx)return;const back=trainingCtx.back;trainingCtx=null;closeModal();back()}
const legacyCamp=showCamp;
showCamp=function(id){
 if(!MAIN_KEYS.has(id)){legacyCamp(id);return}fullHeal();save();
 globalThis.GC_BRIDGE.ui('camp',{id});
};
function campManage(id){openCollection(()=>showCamp(id))}
function campTraining(id){showTraining(NODES[id].arc,()=>showCamp(id))}
const legacyRewardNode=showRewardNode;
showRewardNode=function(id){if(!MAIN_KEYS.has(id)){legacyRewardNode(id);return}const n=NODES[id],xp=GD.ranks[n.arc==null?0:Math.max(0,ML.arcs[n.arc].rank-1)].killXp;globalThis.GC_BRIDGE.ui('rewardNode',{id,xp});};
function claimInvestigation(id){const n=NODES[id],xp=GD.ranks[n.arc==null?0:Math.max(0,ML.arcs[n.arc].rank-1)].killXp;state.xp+=xp;completeNode(id);state.pendingSettlement={node:id,title:n.title,xp,cards:1,candidates:null,remaining:1,investigation:true};save();renderSettlement()}
function rewardManage(id){openCollection(()=>showRewardNode(id))}

const legacyBefore=showStoryBeforeBattle;
showStoryBeforeBattle=function(id){if(!state.mainline){legacyBefore(id);return}globalThis.GC_BRIDGE.ui('beforeBattle',{id});};
function beforeBattleUpgrade(id){if(state.mode==='endless')openCollection(()=>showStoryBeforeBattle(id));else showTraining(NODES[id].arc,()=>showStoryBeforeBattle(id))}
prepareBattle=function(id){legacyPrepare(id)};
startBattle=function(id){
 if(!state.mainline){legacyStart(id);return}const n=NODES[id],enemies=id==='endless-arena'?endlessRoster():enemyRoster(id);
 for(const own of state.spirits)for(const name of Object.keys(own.onceUsed||{}))if(GD.skillDefs[name]?.oncePerBattle)delete own.onceUsed[name];
 const living=state.spirits.filter(s=>!s.dead&&(!state.squad?.length||state.squad.includes(s.id))).slice(0,6),first=living.slice(0,Math.min(3,living.length)).map(s=>s.id),draw=shuffle([...living.slice(first.length).map(s=>s.id),...state.deck.slice(0,25)]),hand=[...first,...draw.splice(0,Math.max(0,6-first.length))];
 const DC=tuned(n),lifeBase=Math.max(10,...living.map(s=>s.maxHp||0)),enemyLife=lifeBase*DC.life;fullHealPlayerOnly();for(const e of enemies)if(e.bossTraits?.includes('坚壁'))addEffect(e,'bossHide','坚壁',null,{reduction:.2});
 state.battle={nodeId:id,mainline:true,difficulty:difficultyOf(),turn:1,qi:3,maxQi:3,deployedCount:0,will:lifeBase*state.will/10,maxWill:lifeBase,enemyWill:enemyLife,maxEnemyWill:enemyLife,directBite:DC.bite,directFloor:DC.biteFloor||0,directCap:DC.strike||.2,ward:DC.ward||0,wardBase:DC.ward?DC.wardBase:1,wardCasts:0,wardTurn:1,enemies,units:Array(4).fill(null),hand,draw,grave:[],removedEnemies:[],playerSkillsUsed:{},temp:[],log:[...(DC.ward?[`鬼障${DC.ward}层：每回合先主动施放${DC.ward}次技能或技能卡，普通攻击与空路直击才会完全生效；否则${DC.wardBase>0?'只剩'+Math.round(DC.wardBase*100)+'%':'全部无效'}。`]:[]),'战斗开始：第X次显形消耗X鬼气。双方命灯以出战鬼灵中最高的生命为准。'],revivedCount:0,directScale:Math.max(1,GD.statsForRank(GD.ranks[n.rank].name,3).atk/1.4)};
 selected=targetMode=null;save();globalThis.GC_BRIDGE.ui('battle');globalThis.GC_BRIDGE.fx('battle:enter',{testMode:false,nodeId:id});
};
function fullHealPlayerOnly(){state.maxWill=10;state.will=Math.min(10,Math.max(1,state.will));}
function allEnemiesDefeated(b=state.battle){return !!b&&b.enemies.every(e=>e.dead)&&!(b.removedEnemies||[]).some(x=>!x.unit.dead);}

async function enemySkills(b){
 if(!b.mainline)return;
 for(const v of b.units.filter(u=>u&&!u.dead)){const f=v.effects?.bossBurn;if(!f)continue;const dmg=v.maxHp*(f.burnPct||.08);v.hp=Math.max(0,v.hp-dmg);if(v.hp<=0)v.dead=true;b.log.unshift(`${v.name}受${f.label}灼烧，损失${formatNum(dmg)}生命`);await globalThis.GC_BRIDGE.fx('status:tick',{uid:v.uid,side:'ally',lane:v.lane,kind:'burn',label:f.label,value:dmg,hp:v.hp,maxHp:v.maxHp});}
 if(b.units.some(u=>u?.dead)){await animatePendingDeaths();cleanup();renderBattle()}
 for(const e of [...b.enemies.filter(e=>!e.dead)]){
  if(e.bossTraits?.includes('狂怒')&&e.hp/e.maxHp<.5&&!e.effects.bossFrenzy){addEffect(e,'bossFrenzy','狂怒',null,{attackBonus:.4});b.log.unshift(`${e.name}陷入狂怒，攻击提高40%`);globalThis.GHOST_VFX?.react('狂怒',e,'狂怒')}
  if(!e.bossSkills?.length||b.turn<e.bossNext)continue;
  e.bossCastIndex=bossCastSlot(e);const name=e.bossSkills[e.bossCastIndex%e.bossSkills.length],d=BOSS_SKILLS[name];e.bossNext=b.turn+(e.bossEvery||2);e.bossCastIndex=e.bossCastIndex+1;
  if(b.enemySkillNull>0){b.log.unshift(`${e.name}的${name}被虚化阻止`);continue}
  if(skipEffect(e)||e.effects.ice&&Math.random()<.25){b.log.unshift(`${e.name}无法释放${name}`);continue}
  const allies=b.units.filter(u=>u&&!u.dead),candidates=[...allies].sort((a,c)=>c.hp-a.hp),target=candidates[0],uses=e.bossUses[name]||0;
  if(d.kind==='summon'&&uses>=1||d.kind==='heal'&&uses>=2||d.kind==='siphon'&&uses>=3||d.kind==='purge'&&uses>=2)continue;
  e.bossUses[name]=uses+1;b.log.unshift(`${e.name}释放${name}`);
  await globalThis.GC_BRIDGE.fx('boss:cast',{uid:e.uid,lane:e.lane,name,kind:d.kind});soundCue('skill');globalThis.GC_BRIDGE.fx('burst',{uid:e.uid,side:'enemy',lane:e.lane,glyph:d.kind==='shield'?'◇':d.kind==='slow'?'⌛':'✦',tone:'#b18ba7'});
  if(d.kind==='shield')addEffect(e,'bossShield',name,2,{bossShield:true,shieldExpiry:true});
  if(d.kind==='shield')e.shield=e.maxHp*.18;
  if(d.kind==='heal')e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.12);
  if(d.kind==='rage')addEffect(e,'bossRage',name,2,{attackBonus:.2});
  if(d.kind==='mark'&&target)addNegative(target,'bossMark',name,2,{receivedBonus:.15});
  if(d.kind==='slow'&&target){const chosen=candidates.find(u=>u.uid!==e.lastStopped)||target;addNegative(chosen,'bossStop',name,2,{skip:1});e.lastStopped=chosen.uid;}
  if(d.kind==='strike'){const victim=b.units[e.lane];if(victim&&!victim.dead){const damage=Math.min(victim.maxHp*.18,skillDamage(e,victim,.7));dealRawDamage(e,victim,damage,name,true);globalThis.GC_BRIDGE.fx('float',{target:{uid:victim.uid,side:'ally',lane:victim.lane},text:'-'+formatNum(damage),kind:'damage',critical:false});}}
  if(d.kind==='shift'){const lane=[e.lane-1,e.lane+1].find(v=>v>=0&&v<4&&!b.enemies.some(x=>!x.dead&&x.lane===v));if(lane!=null)e.lane=lane;else addEffect(e,'bossRage',name,1,{attackBonus:.1});}
  if(d.kind==='summon'){const lane=[0,1,2,3].find(v=>!b.enemies.some(x=>!x.dead&&x.lane===v)&&!b.removedEnemies.some(x=>x.originalLane===v));if(lane!=null){const r=Math.max(0,e.rankIndex-1),st=GD.statsForRank(GD.ranks[r].name,1);b.enemies.push({uid:e.uid+'-summon',id:'main-summon',name:'鬼域随从',rankName:GD.ranks[r].name,rankIndex:r,level:r+1,potential:1,type:'恶灵',lane,maxHp:Math.max(2,st.hp*.35),hp:Math.max(2,st.hp*.35),atk:st.atk*.2,baseAtk:st.atk*.2,effects:{},dead:false});}}
  const strong=[...allies].sort((a,c)=>effectiveAttack(c)-effectiveAttack(a))[0],front=b.units[e.lane]&&!b.units[e.lane].dead?b.units[e.lane]:null;
  if(d.kind==='aoe')for(const v of allies)dealRawDamage(e,v,Math.min(v.maxHp*.14,skillDamage(e,v,.55)),name,true);
  if(d.kind==='drain'&&front){const done=dealRawDamage(e,front,Math.min(front.maxHp*.2,skillDamage(e,front,.8)),name,true);e.hp=Math.min(e.maxHp,e.hp+done);}
  if(d.kind==='curse'&&strong)addNegative(strong,'bossCurse',name,2,{outgoingReduction:.3});
  if(d.kind==='burn'&&target)addNegative(target,'bossBurn',name,3,{burnPct:.08});
  if(d.kind==='seal'&&strong&&addNegative(strong,'bossSeal',name,2,{})){strong.cooldowns||={};for(const s of GD.unlockedSkills(strong.id,strong.rankName)){const sd=GD.skillDefs[s]||{};if(!sd.passive&&!sd.toggle&&!sd.once&&!sd.oncePerBattle)strong.cooldowns[s]=Math.max(strong.cooldowns[s]||0,2);}}
  if(d.kind==='steal')b.qiPenalty=2;
  if(d.kind==='chaos'){if(allies.length>=2){const x=allies[0],y=allies[allies.length-1],lx=x.lane,ly=y.lane;b.units[lx]=y;b.units[ly]=x;x.lane=ly;y.lane=lx;}else if(allies.length===1){const x=allies[0],to=[x.lane-1,x.lane+1].find(v=>v>=0&&v<4&&!b.units[v]);if(to!=null){b.units[x.lane]=null;x.lane=to;b.units[to]=x;}}selected=targetMode=null;}
  if(d.kind==='execute'&&front){if(front.hp/front.maxHp<.25&&!front.effects?.invincible&&!(front.preAttackInvincible>0)){front.hp=0;front.dead=true;b.log.unshift(`${front.name}被${name}处决`);}else dealRawDamage(e,front,Math.min(front.maxHp*.25,skillDamage(e,front,1)),name,true);}
  if(d.kind==='dread')for(const v of allies)addNegative(v,'bossDread',name,2,{receivedBonus:.12});
  if(d.kind==='siphon'){const loss=b.maxWill*.06;b.will=Math.max(0,b.will-loss);b.log.unshift(`${name}熄灭了${formatNum(loss)}点命灯`);globalThis.GC_BRIDGE.fx('float',{target:'will',text:'-'+formatNum(loss),kind:'damage',critical:false});}
  if(d.kind==='purge')for(const x of b.enemies.filter(x=>!x.dead))for(const k of ['eye','ghostFire','queenField','ice','dream','timeDream','spaceLaw','virtual','deceit'])if(x.effects?.[k])delete x.effects[k];
  if(d.kind==='fortify')for(const x of b.enemies.filter(x=>!x.dead)){x.shield=Math.max(x.shield||0,x.maxHp*.1);addEffect(x,'bossShield',name,2,{bossShield:true,shieldExpiry:true});}
  await animatePendingDeaths();cleanup();renderBattle();
 }
}
const legacyDeal=dealRawDamage;
dealRawDamage=function(source,target,amount,label,isSkill,noRevenge){const r=legacyDeal(source,target,amount,label,isSkill,noRevenge);if(target?.dead&&target.bossTraits?.includes('不死之躯')&&!target.undyingUsed){target.undyingUsed=true;target.dead=false;target.hp=target.maxHp*.35;state.battle?.log.unshift(`${target.name}的不死之躯发动，以35%生命重新站起`);globalThis.GHOST_VFX?.react('不死之躯',target,'不死之躯');}return r;};
// 鬼障 (噩梦/禁忌): non-skill damage to the enemy side only counts once the player has actively cast this round.
function wardCasts(b=state.battle){return b&&b.wardTurn===b.turn?b.wardCasts||0:0}
function wardFactor(b=state.battle){if(!b?.ward)return 1;const base=b.wardBase||0;return base+(1-base)*Math.min(1,wardCasts(b)/b.ward)}
function wardInfo(b=state.battle){return b?.ward?{layers:b.ward,casts:Math.min(b.ward,wardCasts(b)),factor:wardFactor(b),base:b.wardBase||0}:null}
function noteCast(label){
 const b=state.battle;if(!b?.ward)return;const before=wardFactor(b);
 if(b.wardTurn!==b.turn){b.wardTurn=b.turn;b.wardCasts=0}b.wardCasts++;
 const now=wardFactor(b);if(now<=before)return;
 b.log.unshift(now>=1?`${label}破除了鬼障，本回合普通攻击与空路直击恢复正常`:`${label}削弱了鬼障（${b.wardCasts}/${b.ward}），本回合普通攻击与空路直击只有${Math.round(now*100)}%效果`);
 const lead=b.enemies.find(e=>!e.dead);if(lead)globalThis.GHOST_VFX?.react('鬼障',lead,now>=1?'鬼障已破':`鬼障 ${b.wardCasts}/${b.ward}`);
}
const legacyConsume=consumeExactSkill;
consumeExactSkill=function(u,name){const ok=legacyConsume(u,name);if(ok&&!(GD.skillDefs[name]||{}).toggle)noteCast(name);return ok};
const legacyPlaySkill=playSkill;
playSkill=function(index,lane){const b=state.battle,id=b?.hand[index],n=b?.hand.length,q=b?.qi,r=legacyPlaySkill(index,lane);if(b&&typeof id==='string'&&SKILLS[id]&&(b.hand[index]!==id||b.hand.length!==n||b.qi!==q))noteCast(SKILLS[id].name);return r};
const legacyPlayerSkill=usePlayerSkill;
usePlayerSkill=function(i,lane){const b=state.battle,used=!!b?.playerSkillsUsed?.[i],r=legacyPlayerSkill(i,lane);if(b&&!used&&b.playerSkillsUsed?.[i])noteCast(GD.playerSkills[i].name);return r};
const wardDeal=dealRawDamage;
dealRawDamage=function(source,target,amount,label,isSkill,noRevenge){
 const b=state.battle;
 if(b?.ward&&!isSkill&&target&&!target.dead&&b.enemies.includes(target)){const f=wardFactor(b);if(f<=0){b.log.unshift(`鬼障挡下了${source?.name||''}的${label||'攻击'}`);globalThis.GHOST_VFX?.react('鬼障',target,'鬼障');return 0}amount*=f}
 return wardDeal(source,target,amount,label,isSkill,noRevenge);
};
globalThis.MAINLINE_RUNTIME={enemySkills,allEnemiesDefeated};
const legacyExpire=expireEffect;
expireEffect=function(u,key,e){if(e.shieldExpiry)u.shield=0;legacyExpire(u,key,e);};
endTurn=async function(){if(busy)return;roundSnapshot=state.mainline&&!state.battle?.testMode?clone(state):null;save();try{await legacyEndTurn()}finally{roundSnapshot=null;save()}};
hitWill=async function(e){if(!state.battle?.mainline){await legacyEnemyHit(e);return}await mainDirectAttack(e,true);};
hitEnemyWill=async function(u){if(!state.battle?.mainline){await legacyAllyHit(u);return}await mainDirectAttack(u,false);};
async function mainDirectAttack(u,enemy){
 const b=state.battle,ward=enemy?1:wardFactor(b);
 if(ward<=0){b.log.unshift(`鬼障挡下了${u.name}的空路直击`);await globalThis.GC_BRIDGE.fx('unit:skip',{uid:u.uid,side:'ally',lane:u.lane,label:'鬼障',reason:'ward'});return}
 let damage=ward*Math.min(enemy?b.maxWill*(b.directBite||.2):b.maxEnemyWill*(b.directCap||.2),rollAttackDamage(u,effectiveAttack(u)*(1+(u.extraAdd||0))*outgoingMultiplier(u),'空路直击'));
 // 敌方直击的下限（难度参数 biteFloor，占我方命灯的比例）：后期鬼灵生命远高于敌方攻击，没有下限时空路几乎不掉命灯。
 if(enemy&&b.directFloor)damage=Math.max(damage,b.maxWill*b.directFloor);
 if(enemy){const domain=b.domain&&b.units.find(x=>x?.uid===b.domain.uid&&!x.dead),love=b.units.find(x=>x?.id==='isuna'&&!x.dead&&GD.unlockedSkills(x.id,x.rankName).includes('爱的规律'));
  if(domain||love){const t=domain||love;dealRawDamage(u,t,damage*(domain?b.domain.multiplier:2)*rankMultiplier(u,t)*receivedMultiplier(t),domain?b.domain.name:'爱的规律');b.log.unshift(t.name+'代受直击');await globalThis.GC_BRIDGE.fx('direct',{attacker:{uid:u.uid,side:'enemy',lane:u.lane},damage,critical:u.lastAttackRoll?.critical,outcome:domain?'domain':'love',redirect:{uid:t.uid,side:'ally',lane:t.lane},will:b.will,enemyWill:b.enemyWill});await animatePendingDeaths();return}
  const dodge=b.units.find(x=>x?.id==='xuan'&&!x.dead&&x.dodgeCharges>0);if(b.will-damage<=0&&dodge){dodge.dodgeCharges--;b.log.unshift('闪遁免疫致命直击');await globalThis.GC_BRIDGE.fx('direct',{attacker:{uid:u.uid,side:'enemy',lane:u.lane},damage:0,critical:u.lastAttackRoll?.critical,outcome:'dodge',redirect:{uid:dodge.uid,side:'ally',lane:dodge.lane},will:b.will,enemyWill:b.enemyWill});return}b.will=Math.max(0,b.will-damage);
 }else b.enemyWill=Math.max(0,b.enemyWill-damage);
 b.log.unshift(`${u.name}直击${enemy?'我方':'敌方'}生命-${formatNum(damage)}`);await globalThis.GC_BRIDGE.fx('direct',{attacker:{uid:u.uid,side:enemy?'enemy':'ally',lane:u.lane},damage,critical:u.lastAttackRoll?.critical,outcome:enemy?'will':'enemyWill',redirect:null,will:b.will,enemyWill:b.enemyWill});globalThis.GC_BRIDGE.fx('float',{target:enemy?'will':'enemyWill',text:'-'+formatNum(damage),kind:'damage',critical:u.lastAttackRoll?.critical});updateHud();
}
function rewardInfo(id){const n=NODES[id],enemies=id==='endless-arena'?endlessRoster():enemyRoster(id);let xp=Math.round(enemies.reduce((sum,e)=>sum+(GD.ranks[e.rankIndex].killXp||1),0)*(n.type==='boss'?1.5:1)*diffCfg().xp);if(id==='endless-arena')xp=Math.round(xp*(1+(state.wave-1)*.08));return {xp,cards:n.cards||1};}
winBattle=async function(){
 const b=state.battle;if(!b?.mainline||b.testMode){await legacyWin();return}if(state.pendingSettlement)return;
 const n=NODES[b.nodeId],reward=rewardInfo(b.nodeId);state.will=Math.max(1,Math.min(10,10*b.will/(b.maxWill||10)));cleanup();
 for(const u of [...b.units.filter(Boolean),...b.hand.map(handSpirit).filter(Boolean)]){const s=spirit(u.id);if(s&&!u.dead){s.hp=Math.min(s.maxHp,Math.max(1,u.hp));s.dead=false;s.onceUsed=clone(u.onceUsed||{});}}
 state.xp+=reward.xp;state.pendingSettlement={node:b.nodeId,title:n.title,...reward,remaining:reward.cards,candidates:null,wave:state.mode==='endless'?state.wave:null};state.battle=null;selected=targetMode=null;if(state.mode!=='endless')completeNode(b.nodeId);state.log.unshift(`战胜${n.title}，经验+${reward.xp}`);save();await globalThis.GC_BRIDGE.fx('battle:win',{testMode:false});renderSettlement();
};
function rewardCandidates(){const out=new Set();for(let i=0;i<50&&out.size<3;i++)out.add(weightedReward());for(const id of Object.keys(SKILLS))if(out.size<3)out.add(id);return [...out].slice(0,3);}
function chooseSettlementCard(index,replaceIndex=null){
 const r=state.pendingSettlement;if(!r||!r.candidates||r.remaining<=0||index<0||index>2)return false;const id=r.candidates[index];if(!SKILLS[id])return false;
 if(state.deck.length>=25){if(!Number.isInteger(replaceIndex)||replaceIndex<0||replaceIndex>=25)return false;state.deck[replaceIndex]=id;}else state.deck.push(id);
 r.remaining--;r.candidates=null;save();return true;
}
function renderSettlement(){
 if(!state.pendingSettlement)return;const r=state.pendingSettlement;if(r.remaining>0&&!r.candidates){r.candidates=rewardCandidates();save();}
 globalThis.GC_BRIDGE.ui('settlement');
}
function pickSettlementCard(index){if(state.deck.length<25){chooseSettlementCard(index);renderSettlement();}else showSettlementReplacement(index);}
function showSettlementReplacement(index){globalThis.GC_BRIDGE.ui('settlementReplace',{index})}
function cancelSettlementReplace(){renderSettlement()}
function discardSettlementRewards(){const r=state.pendingSettlement;if(!r)return;r.remaining=0;r.candidates=null;save();renderSettlement()}
function settlementManage(){openCollection(renderSettlement)}
function finishSettlement(){if(!state.pendingSettlement||state.pendingSettlement.remaining>0)return;const wave=state.pendingSettlement.wave;state.pendingSettlement=null;if(wave!=null){state.wave=wave+1;state.will=state.maxWill=10;ensureEndlessNode();}save();closeModal();renderMap();}
loseBattle=function(){
 const b=state.battle;if(!b?.mainline||b.testMode){legacyLose();return}state.battle=null;selected=targetMode=null;
 globalThis.GC_BRIDGE.fx('battle:lose',{testMode:false});
 if(state.mode==='normal'){
  const checkpoint=clone(state.checkpoint);if(checkpoint?.snapshot){state=clone(checkpoint.snapshot);state.checkpoint=checkpoint;fullHeal();state.log.unshift('战斗失败，返回上一个篝火，全部恢复');}else{state=freshCampaign('normal',state.name);fullHeal();}
  save();globalThis.GC_BRIDGE.ui('defeat',{mode:'normal',checkpoint:state.checkpoint?.node||null});
 }else{
  state.fallen=true;state.will=0;save();globalThis.GC_BRIDGE.ui('fallen',{mode:state.mode,wave:state.wave});
 }
};
function continueFromDefeat(){closeModal();renderMap()}
function returnToTitle(){closeModal();renderHome()}
const legacyEnding=showEnding;
showEnding=function(){if(!state.mainline){legacyEnding();return}state.ending=true;save();globalThis.GC_BRIDGE.ui('ending')};
function finishEnding(){completeNode('main-ending');closeModal();renderHome()}
function readEndingAct(){openReader(ML.arcs.length-1,showEnding)}

openCollection=function(back=null){
 if(state.battle){if(state.mode==='endless'&&!busy)openBattleUpgrade();return}
 const done=typeof back==='function'?back:state.pendingSettlement?renderSettlement:null;legacyCollection(done);
};
const legacyShowOwned=showOwnedSpirit;
showOwnedSpirit=function(i){legacyShowOwned(i);};
const legacyOwnedUpgrade=upgradeOwnedSpirit;
upgradeOwnedSpirit=function(i){if(state.battle&&state.mode!=='endless')return;const life=state.will;legacyOwnedUpgrade(i);if(state.mainline){state.maxWill=10;state.will=Math.min(10,life);save();}};

function ensureEndlessNode(){const rank=Math.min(22,10+Math.floor((state.wave-1)/3));NODES['endless-arena']={act:1,title:`无尽竞技场 · 第${state.wave}波`,type:state.wave%3===0?'boss':'battle',story:'endless-arena',rank,difficulty:3,cards:state.wave%3===0?3:1,enemies:[],bossSkills:['鬼军集结','双鬼共振']};STORY['endless-arena']='全部现有鬼灵已解锁，从噩梦一阶开始。每3波提升一个等级层次，同等级波次继续增强属性。鬼灵伤势与阵亡跨波次保留，可用治疗卡或升级恢复；战斗中可以消耗经验升级，累计部署费用不重置。';NODES['endless-arena'].enemies=endlessRoster().map(e=>[e.id,e.level]);}
function endlessRoster(){const rank=Math.min(22,10+Math.floor((state.wave-1)/3)),a=GD.ranks[rank],scale=1+(state.wave-1)*.08,st=GD.statsForRank(a.name,3),count=Math.min(4,2+Math.floor((state.wave-1)/5));return Array.from({length:count},(_,i)=>({uid:'e-endless-'+i,id:'endless-enemy',name:i===0&&state.wave%3===0?'无尽统领':'无尽游鬼',rankName:a.name,rankIndex:rank,level:rank+1,potential:1,type:'恶灵',novelRank:'无尽挑战',maxHp:Math.round(st.hp*.7*scale*diffCfg().hp),hp:Math.round(st.hp*.7*scale*diffCfg().hp),baseAtk:+(st.atk*.32*scale*diffCfg().atk).toFixed(1),atk:+(st.atk*.32*scale*diffCfg().atk).toFixed(1),lane:i,dead:false,effects:{},bossSkills:i===0&&state.wave%3===0?['鬼军集结','双鬼共振']:[],bossUses:{},bossNext:2}));}
function renderEndless(){ensureEndlessNode();updateHud();globalThis.GC_BRIDGE.ui('endless');if(state.pendingSettlement)renderSettlement();}
function openBattleUpgrade(){
 if(busy||!state.battle||state.mode!=='endless')return;
 globalThis.GC_BRIDGE.ui('battleUpgrade');
}
function closeBattleUpgrade(){closeModal();renderBattle()}
function upgradeInBattle(i){
 if(state.mode!=='endless'||!state.battle||busy)return false;const s=state.spirits[i];if(!s||!upgradeGhostRecord(s))return false;const b=state.battle,units=[...b.units.filter(Boolean),...b.hand.map(handSpirit).filter(Boolean),...b.draw.map(handSpirit).filter(Boolean)],matched=new Set();
 for(const u of units){if(u.id!==s.id||matched.has(u))continue;matched.add(u);const wasInitialized=!!u.initialized,oldRank=u.rankName,oldSkills=GD.unlockedSkills(u.id,oldRank),newSkills=GD.unlockedSkills(u.id,s.rankName),previous=initUnit({id:u.id,rankName:oldRank,atk:1,baseAtk:1,hp:1,maxHp:1,baseMaxHp:1}),fresh=initUnit({id:u.id,rankName:s.rankName,atk:s.atk,baseAtk:s.atk,hp:s.maxHp,maxHp:s.maxHp,baseMaxHp:s.maxHp});Object.assign(u,{rankIndex:s.rankIndex,rankName:s.rankName,level:s.level,baseAtk:s.atk,baseMaxHp:s.maxHp});if(wasInitialized){u.passiveAttackBonus=fresh.passiveAttackBonus;u.passiveHpBonus=fresh.passiveHpBonus;u.incomingBonus=fresh.incomingBonus;u.dodgeCharges=(u.dodgeCharges||0)+Math.max(0,fresh.dodgeCharges-previous.dodgeCharges);u.preAttackInvincible=(u.preAttackInvincible||0)+Math.max(0,fresh.preAttackInvincible-previous.preAttackInvincible);if(newSkills.includes('无敌规律')&&!oldSkills.includes('无敌规律'))addEffect(u,'invincible','无敌规律',1,{invincible:true});}u.atk=s.atk*(1+(wasInitialized?u.passiveAttackBonus||0:0));u.maxHp=s.maxHp*(1+(wasInitialized?u.passiveHpBonus||0:0))+(u.effects?.cloudDream?.hpGain||0);u.hp=u.maxHp;u.dead=false;}
 const dead=b.grave.filter(u=>u.id===s.id);if(dead.length){b.grave=b.grave.filter(u=>u.id!==s.id);if(!units.some(u=>u.id===s.id))b.hand.push(s.id);}
 b.log.unshift(s.name+'战斗升级至'+s.rankName);save();return true;
}
const legacyHud=updateHud;
updateHud=function(){if(state.mainline){state.maxWill=10;if(!state.battle)state.will=Math.min(10,state.will);}legacyHud();};

globalThis.__MAINLINE_TEST__={wardFactor,wardCasts,wardInfo,tuned,DIFFICULTIES,difficultyOf,ML,MAIN_KEYS,ALLOWED_STORY_GHOSTS,BOSS_SKILLS,MODE_NAMES,freshCampaign,newSlot,loadSlot,getSlots:()=>slots,getSlot:()=>activeSlot,enemyRoster,endlessRoster,rewardInfo,grantTraining,trainTeam,fullHeal,recordCheckpoint,grantContract,allEnemiesDefeated,enemySkills,upgradeInBattle,chooseSettlementCard,rewardCandidates,finishSettlement,readSlots,writeSlots,validImportedSlot,save,getState:()=>state,setState:x=>state=x,completeNode,startBattle,winBattle,loseBattle,exportSlotsData,importSlotsData,confirmNewSlot,continueMainlineEvent,claimInvestigation,pickSettlementCard,showSettlementReplacement,discardSettlementRewards,settlementManage,cancelSettlementReplace,continueFromDefeat,returnToTitle,finishEnding,readEndingAct,trainingHeal,trainingManage,trainingClose,campManage,campTraining,beforeBattleUpgrade,rewardManage,viewArchiveAct,closeStoryArchive,readerPage,closeReader,confirmSquad};
