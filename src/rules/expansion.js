// 扩展规则（2026-11 用户确认的新内容）：卡牌池、关键词、召唤物、敌方行为与意图。
// 加载在 playability 之后、facade 之前；通过重新赋值同名全局函数来包装旧逻辑，不改旧函数体。无 DOM。
const X_ARCH={burn:'灼烧',ice:'冰控',summon:'召唤',blood:'献祭',bounce:'回手',lamp:'直击',util:'通用'};
const X_KEYWORDS={
 taunt:{name:'嘲讽',desc:'敌人的普通攻击与空路直击会优先打向它。'},
 pierce:{name:'穿透',desc:'普通攻击命中敌人时，额外按伤害的30%灼掉敌方命灯。'},
 multi:{name:'连击',desc:'每回合多行动一次。'},
 death:{name:'亡语',desc:'被击倒时触发一次效果。'},
 aura:{name:'光环',desc:'相邻路上的友军攻击提高20%。'},
 leech:{name:'吸血',desc:'普通攻击造成伤害后，恢复该伤害50%的生命。'},
 flame:{name:'灼刃',desc:'普通攻击命中后点燃目标2回合。'}
};
// [id, 名称, 费用, 稀有度, 目标, 流派, 描述, 效果列表]
const X_CARDS=[
 ['ember','引火符',1,'普通','enemy','burn','点燃一名敌人3回合，每回合受到30%攻击的灼烧。',[['burn',.3,3]]],
 ['lampoil','灯油',1,'普通','enemy','burn','造成40%伤害；目标正在灼烧时改为造成90%伤害。',[['dmgIf','burning',.9,.4]]],
 ['moth','飞蛾',1,'普通','enemy','burn','造成30%伤害；目标正在灼烧时抽1张牌。',[['dmg',.3],['drawIf','burning',1]]],
 ['candle','续烛',1,'普通','none','burn','敌方全部灼烧效果延长2回合。',[['extendBurn',2]]],
 ['ashes','余烬',0,'普通','none','burn','场上每有一名灼烧中的敌人，获得1点鬼气（最多3点）。',[['qiPerBurn',3]]],
 ['firecrow','火鸦',2,'稀有','none','burn','随机攻击敌人3次，每次造成35%伤害并点燃2回合。',[['randomHits',3,.35,['burn',.2,2]]]],
 ['detonate','引爆',2,'稀有','enemy','burn','造成50%伤害；目标正在灼烧时改为造成140%伤害并熄灭其灼烧。',[['detonate',1.4,.5]]],
 ['incense','焚香',2,'稀有','ally','burn','一名己方鬼灵获得【灼刃】3回合。',[['keyword','flame',3]]],
 ['firewall','火墙',2,'稀有','none','burn','点燃敌方全体2回合（20%），并令其造成的伤害降低15%。',[['all','burn',.2,2],['all','weaken',.15,2]]],
 ['wildfire','野火燎原',3,'珍藏','none','burn','点燃敌方全体3回合，每回合受到30%攻击的灼烧。',[['all','burn',.3,3]]],
 ['hellfire','业火红莲',5,'传说','none','burn','对敌方全体造成90%伤害，并点燃3回合（40%）。',[['all','dmg',.9],['all','burn',.4,3]]],
 ['frost','霜符',1,'普通','enemy','ice','2回合内，目标每回合有35%概率被冻结。',[['freeze',.35,2]]],
 ['chill','寒气',1,'普通','enemy','ice','目标造成的伤害降低25%，持续2回合。',[['weaken',.25,2]]],
 ['icicle','冰锥',2,'普通','enemy','ice','造成70%伤害；目标被冰冻或停止行动时伤害翻倍。',[['dmgIf','controlled',1.4,.7]]],
 ['seal','封条',2,'稀有','enemy','ice','目标下一次行动停止。',[['stun',1]]],
 ['shatter','碎冰',2,'稀有','enemy','ice','造成50%伤害；目标被冰冻或停止行动时改为150%。',[['dmgIf','controlled',1.5,.5]]],
 ['mirrorice','冰镜',2,'稀有','ally','ice','一名己方鬼灵受到的伤害降低40%，持续2回合。',[['guard',.4,2]]],
 ['coldmoon','寒月',3,'稀有','none','ice','敌方全体受到的伤害增加20%，持续2回合。',[['all','vuln',.2,2]]],
 ['glacier','冰棺',4,'珍藏','enemy','ice','目标接下来两次行动停止，期间受到的伤害增加25%。',[['stun',2],['vuln',.25,2]]],
 ['blizzard','暴雪',4,'珍藏','none','ice','对敌方全体造成30%伤害；2回合内各有30%概率被冻结。',[['all','dmg',.3],['all','freeze',.3,2]]],
 ['absolute','绝对零度',6,'传说','none','ice','敌方全体下一次行动停止；之后2回合各有50%概率被冻结。',[['all','stun',1],['all','freeze',.5,2]]],
 ['paperman','纸人',1,'普通','none','summon','在空路召来一个纸人（【嘲讽】，生命30%、攻击20%）。',[['summon','paper']]],
 ['strawdoll','草人',1,'普通','none','summon','在空路召来一个草人（【嘲讽】，【亡语】抽1张牌）。',[['summon','straw']]],
 ['bonesoldier','骨兵',2,'普通','none','summon','在空路召来一名骨兵（生命40%、攻击60%）。',[['summon','bone']]],
 ['lantern','引魂灯',2,'稀有','none','summon','在空路召来一盏引魂灯（【光环】，不会攻击）。',[['summon','lantern']]],
 ['drum','战鼓',2,'稀有','none','summon','全部召唤物攻击提高50%，并在本回合多行动一次。',[['tokens','atk',.5],['tokens','extra',1]]],
 ['puppeteer','牵丝',1,'稀有','ally','summon','献出一个召唤物：抽2张牌并获得2点鬼气。',[['needToken'],['kill'],['draw',2],['qi',2]]],
 ['mirror','借影',2,'珍藏','ally','summon','在空路召来该鬼灵的影子（生命与攻击为其50%）。',[['shadow',.5]]],
 ['bride','纸嫁娘',3,'珍藏','none','summon','在空路召来纸嫁娘（【亡语】对敌方全体造成60%伤害）。',[['summon','bride']]],
 ['legion','阴兵借道',4,'珍藏','none','summon','在所有空路各召来一名骨兵。',[['summonAll','bone']]],
 ['gatekeeper','门神',5,'传说','none','summon','在空路召来门神（【嘲讽】，生命120%、攻击80%，受到伤害降低30%）。',[['summon','gate']]],
 ['bloodpact','血契',0,'普通','ally','blood','一名己方鬼灵失去20%当前生命，获得2点鬼气。',[['pay',.2],['qi',2]]],
 ['offering','供品',1,'普通','ally','blood','一名己方鬼灵失去20%当前生命，抽2张牌。',[['pay',.2],['draw',2]]],
 ['soulburn','燃魂',2,'稀有','ally','blood','一名己方鬼灵失去30%当前生命，本场攻击增加40%。',[['pay',.3],['atk',.4]]],
 ['lifelink','同命',2,'稀有','ally','blood','一名己方鬼灵失去25%当前生命，对正前方敌人造成其两倍的伤害。',[['payStrike',.25,2]]],
 ['cutwick','剪灯',1,'稀有','none','blood','熄灭自己10%的命灯，获得3点鬼气。',[['payWill',.1],['qi',3]]],
 ['hungry','饿鬼道',2,'稀有','ally','blood','一名己方鬼灵获得【吸血】3回合。',[['keyword','leech',3]]],
 ['lastwill','遗愿',2,'稀有','ally','blood','赋予【亡语】：被击倒时对敌方全体造成100%伤害。',[['deathrattle','blast',1]]],
 ['bloodrain','血雨',3,'珍藏','none','blood','己方全体失去10%当前生命，对敌方全体造成80%伤害。',[['allies','pay',.1],['all','dmg',.8]]],
 ['martyr','殉',3,'珍藏','ally','blood','献出一名己方鬼灵或召唤物：其余友军回满生命，本场攻击增加30%。',[['kill'],['others','healFull'],['others','atk',.3]]],
 ['nirvana','涅槃灰',3,'传说','ally','blood','记下一名己方鬼灵此刻的状态：被击倒时以该状态回到手牌。',[['snapshot']]]
];
X_CARDS.push(
 ['recall','招魂幡',1,'普通','ally','bounce','一名己方鬼灵恢复30%生命并回到手牌。',[['heal',.3],['bounce']]],
 ['swapstep','移形',0,'普通','ally','bounce','一名己方鬼灵回到手牌，获得1点鬼气。',[['bounce'],['qi',1]]],
 ['reenter','再临',1,'普通','ally','bounce','一名己方鬼灵回到手牌，抽1张牌。',[['bounce'],['draw',1]]],
 ['echo','回响',2,'稀有','ally','bounce','一名己方鬼灵的全部技能冷却清零，然后回到手牌。',[['resetCd'],['bounce']]],
 ['homecoming','归巢',1,'稀有','none','bounce','下一次显形少消耗2点鬼气。',[['cheapDeploy',2]]],
 ['shadowstep','影遁',1,'稀有','ally','bounce','一名己方鬼灵本回合有60%概率闪避攻击。',[['dodge',.6,1]]],
 ['tide','潮汐',3,'珍藏','none','bounce','己方全部鬼灵回到手牌，抽2张牌并获得3点鬼气。',[['bounceAll'],['draw',2],['qi',3]]],
 ['lampstrike','剪烛',2,'普通','none','lamp','直接熄灭敌方4%的命灯。',[['will',.04]]],
 ['windlamp','风灯',1,'普通','none','lamp','恢复自己8%的命灯。',[['healWill',.08]]],
 ['openlane','开路',1,'普通','enemy','lamp','把一名敌人推到相邻的空路。',[['push']]],
 ['piercecharm','破甲符',2,'稀有','ally','lamp','一名己方鬼灵本场获得【穿透】。',[['keyword','pierce',null]]],
 ['soullantern','夺灯',4,'珍藏','none','lamp','熄灭敌方8%的命灯，恢复自己8%的命灯。',[['will',.08],['healWill',.08]]],
 ['finalblow','断灯',5,'传说','none','lamp','敌方命灯低于25%时直接熄灭；否则熄灭其10%。',[['willExecute',.25,.1]]],
 ['tauntcharm','镇宅符',1,'普通','ally','util','一名己方鬼灵获得【嘲讽】2回合，期间受到的伤害降低20%。',[['keyword','taunt',2],['guard',.2,2]]],
 ['cleanse','净水',1,'普通','ally','util','清除一名己方鬼灵身上的负面状态，并恢复10%生命。',[['cleanse'],['heal',.1]]],
 ['insight','窥命',1,'普通','none','util','抽2张牌。',[['draw',2]]],
 ['shieldcharm','金钟',2,'普通','ally','util','一名己方鬼灵获得相当于最大生命30%的护盾。',[['shield',.3]]],
 ['doubleedge','双刃',1,'普通','ally','util','一名己方鬼灵3回合内攻击增加30%，但受到的伤害增加20%。',[['atkT',.3,3],['selfVuln',.2,3]]],
 ['qipill','聚气丹',0,'稀有','none','util','获得2点鬼气。',[['qi',2]]],
 ['aura','结义',2,'稀有','ally','util','一名己方鬼灵本场获得【光环】。',[['keyword','aura',null]]],
 ['execute','斩',3,'稀有','enemy','util','目标生命低于20%时直接击倒（首领除外）；否则造成80%伤害。',[['execute',.2,.8]]],
 ['hex','钉头咒',2,'稀有','enemy','util','目标受到的伤害增加30%，持续3回合。',[['vuln',.3,3]]],
 ['dispel','破法',2,'稀有','enemy','util','击碎目标的护盾与增益，并造成30%伤害。',[['dispel'],['dmg',.3]]],
 ['wardbreak','破障符',1,'稀有','none','util','本回合鬼障直接全部破除。',[['ward',9]]],
 ['thunder','五雷符',3,'稀有','enemy','util','造成130%伤害。',[['dmg',1.3]]],
 ['multistrike','连环',3,'珍藏','ally','util','一名己方鬼灵获得【连击】2回合。',[['keyword','multi',2]]],
 ['groupshield','百鬼夜行',4,'珍藏','none','util','己方全体获得20%护盾，本场攻击增加15%。',[['allies','shield',.2],['allies','atk',.15]]],
 ['chainthunder','连锁雷',4,'珍藏','none','util','依次对每名敌人造成90%、70%、50%、30%伤害。',[['chain',[.9,.7,.5,.3]]]],
 ['qitide','鬼气潮',2,'珍藏','none','util','本场鬼气上限提高1点，并立刻获得1点鬼气。',[['maxQi',1],['qi',1]]],
 ['timeskip','偷时',3,'传说','none','util','己方全部鬼灵的技能冷却减少2回合。',[['allies','cd',2]]],
 ['meteor','天火',6,'传说','none','util','对敌方全体造成150%伤害。',[['all','dmg',1.5]]]
);
for(const [id,name,cost,rarity,target,arch,desc,ops] of X_CARDS)SKILLS[id]={id,name,cost,rarity,target,arch,desc,ops,icon:name[0]};
// 旧 14 张卡归入流派，供牌组界面分组
for(const [id,arch] of Object.entries({coin:'util',coin25:'util',coin40:'util',coin100:'util',blade:'util',spear:'util',whip:'util',horse:'util',revive:'util',relic:'bounce',rope:'bounce',valhalla:'blood',taboo:'blood',bloodmoon:'blood'}))if(SKILLS[id])SKILLS[id].arch=arch;
// 召唤物：数值按场上最强鬼灵的比例；[名称, 生命比, 攻击比, 关键词, 附加]
const X_TOKENS={
 paper:['纸人',.3,.2,['taunt']],straw:['草人',.25,.1,['taunt','death'],{death:['draw',1]}],bone:['骨兵',.4,.6,[]],
 lantern:['引魂灯',.3,0,['aura'],{noAttack:true}],bride:['纸嫁娘',.35,.4,['death'],{death:['blast',.6]}],gate:['门神',1.2,.8,['taunt'],{reduction:.3}]
};

// ---------- 卡牌解释器 ----------
let xSeq=0;
function xAllies(b){return b.units.filter(u=>u&&!u.dead)}
function xFoes(b){return b.enemies.filter(e=>!e.dead)}
function xSource(b){const best=xAllies(b).filter(u=>!u.token).sort((a,c)=>effectiveAttack(c)-effectiveAttack(a))[0];if(best)return best;const atk=(b.directScale||1)*1.4;return {name:'符咒',atk,baseAtk:atk,maxHp:atk*10,hp:atk*10,effects:{},pseudo:true}}
function xAmount(src,t,ratio){return src.pseudo?src.atk*ratio*receivedMultiplier(t):skillDamage(src,t,ratio)}
function xHit(b,src,t,ratio,label){return dealRawDamage(src,t,xAmount(src,t,ratio),label,true,true)}
function xBurning(e){return !!e.effects?.ghostFire}
function xControlled(e){return !!(e.effects?.ice||skipEffect(e))}
function xHasKey(u,k){return !!(u&&!u.dead&&(u.keywords?.includes(k)||u.effects?.['kw-'+k]))}
function xSpawn(b,kind,lane,from){
 const t=X_TOKENS[kind],ref=from||xSource(b),hp=Math.max(1,Math.round((ref.baseMaxHp||ref.maxHp)*(from?kind:t[1]))),atk=+((ref.baseAtk||ref.atk)*(from?kind:t[2])).toFixed(1);
 const u={uid:`t${Date.now()}-${++xSeq}`,id:from?'token-shadow':'token-'+kind,artId:from?from.id:null,token:from?'shadow':kind,name:from?from.name+'之影':t[0],type:from?from.type:'召唤物',rankName:ref.rankName,rankIndex:ref.rankIndex,level:ref.level,potential:1,maxHp:hp,hp,baseMaxHp:hp,atk,baseAtk:atk,lane,dead:false,effects:{},cooldowns:{},onceUsed:{},keywords:from?[]:[...t[3]],initialized:true,noSkills:true};
 if(!from&&t[4]?.death)u.deathrattle=t[4].death;if(!from&&t[4]?.noAttack)u.noAttack=true;if(!from&&t[4]?.reduction)addEffect(u,'tokenHide','门神',null,{reduction:t[4].reduction});
 b.units[lane]=u;return u}
function xEmptyLane(b){return [0,1,2,3].find(i=>!b.units[i])}
function xApply(b,op,t,src,ctx){
 const [k,a,c,d]=op,L=ctx.card.name;
 switch(k){
  case 'dmg':xHit(b,src,t,a,L);break;
  case 'dmgIf':xHit(b,src,t,(a==='burning'?xBurning(t):xControlled(t))?c:d,L);break;
  case 'burn':addEffect(t,'ghostFire',L,c,{sourceUid:src.uid,sourceSnapshot:src.pseudo?src:clone(src),ratio:a});break;
  case 'freeze':addEffect(t,'ice',L,c,{freezeChance:a});break;
  case 'stun':addEffect(t,'xStun',L,null,{skip:a});break;
  case 'vuln':addEffect(t,'xVuln',L,c,{receivedBonus:a});break;
  case 'weaken':addEffect(t,'xWeak',L,c,{outgoingReduction:a});break;
  case 'heal':t.hp=Math.min(t.maxHp,t.hp+t.maxHp*a);break;
  case 'healFull':t.hp=t.maxHp;break;
  case 'shield':t.shield=(t.shield||0)+t.maxHp*a;addEffect(t,'umbrellaShield',L,null);break;
  case 'guard':addEffect(t,'xGuard',L,c,{reduction:a});break;
  case 'dodge':addEffect(t,'butterfly',L,c,{dodge:a});break;
  case 'atk':addAttackBonus(t,'x-'+ctx.id,a);addEffect(t,'x-'+ctx.id,`${L} 攻击+${Math.round(a*100)}%`,null);break;
  case 'atkT':addEffect(t,'xEdge',L,c,{attackBonus:a});break;
  case 'selfVuln':addEffect(t,'xEdgeCost',L+'·代价',c,{receivedBonus:a});break;
  case 'extra':t.extra=(t.extra||0)+a;break;
  case 'keyword':addEffect(t,'kw-'+a,X_KEYWORDS[a].name,c);break;
  case 'pay':t.hp=Math.max(1,t.hp-t.hp*a);break;
  case 'kill':t.hp=0;t.dead=true;t.sacrificed=true;break;
  case 'cd':for(const n of Object.keys(t.cooldowns||{}))t.cooldowns[n]=Math.max(0,t.cooldowns[n]-a);break;
  case 'resetCd':for(const n of Object.keys(t.cooldowns||{}))t.cooldowns[n]=0;break;
  case 'cleanse':for(const [key,e] of Object.entries(t.effects||{}))if(e.receivedBonus||e.outgoingReduction||e.skip||e.burnPct||key==='bossBurn')delete t.effects[key];break;
  case 'deathrattle':t.deathrattle=[a,c];addEffect(t,'kw-death','亡语·'+L,null);break;
  case 'snapshot':{const s=clone(t);delete s.rollbackSnapshot;t.rollbackSnapshot=s;addEffect(t,'rollback',L,null);break}
  case 'dispel':t.shield=0;for(const [key,e] of Object.entries(t.effects||{}))if(e.attackBonus||key.toLowerCase().includes('shield')||key==='bossFortify')delete t.effects[key];break;
  case 'execute':if(t.hp/t.maxHp<a&&!t.bossSkills?.length){t.hp=0;t.dead=true}else xHit(b,src,t,c,L);break;
  case 'detonate':if(xBurning(t)){xHit(b,src,t,a,L);removeEffect(t,'ghostFire')}else xHit(b,src,t,c,L);break;
  case 'push':{const to=[t.lane-1,t.lane+1].find(i=>i>=0&&i<4&&!b.enemies.some(e=>!e.dead&&e.lane===i));if(to!=null)t.lane=to;break}
 }
}
function xRun(b,ops,target,ctx){
 const src=xSource(b);let msg=ctx.card.desc;
 for(const op of ops){
  const [k,a,c,d]=op;
  if(k==='all'){for(const e of xFoes(b))xApply(b,op.slice(1),e,src,ctx)}
  else if(k==='allies'){for(const u of xAllies(b))xApply(b,op.slice(1),u,src,ctx)}
  else if(k==='others'){for(const u of xAllies(b))if(u!==target)xApply(b,op.slice(1),u,src,ctx)}
  else if(k==='tokens'){for(const u of xAllies(b))if(u.token)xApply(b,op.slice(1),u,src,ctx)}
  else if(k==='draw')drawCards(a);
  else if(k==='drawIf'){if(a==='burning'?xBurning(target):xControlled(target))drawCards(c)}
  else if(k==='qi')b.qi+=a;
  else if(k==='maxQi')b.maxQi+=a;
  else if(k==='qiPerBurn')b.qi+=Math.min(a,xFoes(b).filter(xBurning).length);
  else if(k==='extendBurn'){for(const e of xFoes(b))if(e.effects?.ghostFire)e.effects.ghostFire.turns=(e.effects.ghostFire.turns||0)+a}
  else if(k==='randomHits'){for(let i=0;i<a;i++){const pool=xFoes(b);if(!pool.length)break;const e=pool[Math.floor(Math.random()*pool.length)];xHit(b,src,e,c,ctx.card.name);if(!e.dead&&d)xApply(b,d,e,src,ctx)}}
  else if(k==='chain'){xFoes(b).sort((x,y)=>x.lane-y.lane).forEach((e,i)=>xHit(b,src,e,a[Math.min(i,a.length-1)],ctx.card.name))}
  else if(k==='summon'){const lane=xEmptyLane(b);if(lane!=null)xSpawn(b,a,lane)}
  else if(k==='summonAll'){for(let i=0;i<4;i++)if(!b.units[i])xSpawn(b,a,i)}
  else if(k==='shadow'){const lane=xEmptyLane(b);if(lane!=null)xSpawn(b,a,lane,target)}
  else if(k==='bounce'){if(target.token){b.units[target.lane]=null}else{ctx.returned.push(target);b.units[target.lane]=null;returnUnitToHand(target)}}
  else if(k==='bounceAll'){for(const u of xAllies(b)){b.units[u.lane]=null;if(!u.token){ctx.returned.push(u);returnUnitToHand(u)}}}
  else if(k==='cheapDeploy')b.deployedCount=Math.max(0,b.deployedCount-a);
  else if(k==='will')b.enemyWill-=b.maxEnemyWill*a;
  else if(k==='healWill')b.will=Math.min(b.maxWill,b.will+b.maxWill*a);
  else if(k==='payWill')b.will=Math.max(1,b.will-b.maxWill*a);
  else if(k==='willExecute'){if(b.enemyWill/b.maxEnemyWill<a)b.enemyWill=0;else b.enemyWill-=b.maxEnemyWill*c}
  else if(k==='payStrike'){const lost=target.hp*a;target.hp=Math.max(1,target.hp-lost);const e=b.enemies.find(x=>!x.dead&&x.lane===target.lane);if(e)dealRawDamage(target,e,lost*c*receivedMultiplier(e),ctx.card.name,true,true)}
  else if(k==='ward'){if(b.ward){if(b.wardTurn!==b.turn){b.wardTurn=b.turn;b.wardCasts=0}b.wardCasts+=a}}
  else if(k==='needToken'){}
  else if(target)xApply(b,op,target,src,ctx);
 }
 return msg}
// 出牌前校验；返回提示文字表示不能打出
function xBlocked(b,c,target){
 const ops=c.ops.map(o=>o[0]);
 if(c.target==='ally'&&!target)return '需要选择一名己方鬼灵';
 if(c.target==='enemy'&&!target)return '需要选择一名敌人';
 if(ops.includes('needToken')&&!target.token)return '只能献出召唤物';
 if((ops.includes('summon')||ops.includes('shadow'))&&xEmptyLane(b)==null)return '没有空路可以召唤';
 if(ops.includes('summonAll')&&xEmptyLane(b)==null)return '没有空路可以召唤';
 if(ops.includes('push')&&![target.lane-1,target.lane+1].some(i=>i>=0&&i<4&&!b.enemies.some(e=>!e.dead&&e.lane===i)))return '相邻没有空路';
 if(ops.includes('snapshot')&&target.token)return '召唤物无法被记录';
 return ''}
async function xPlayCard(index,lane){
 if(busy)return;const b=state.battle,id=b.hand[index],c=SKILLS[id];if(!c||b.qi<c.cost)return;
 const target=c.target==='ally'?b.units[lane]:c.target==='enemy'?b.enemies.find(e=>!e.dead&&e.lane===lane):null,why=xBlocked(b,c,target);
 if(why){globalThis.GC_BRIDGE.notify(why,'warn');return}
 busy=true;const handBefore=b.hand.length,ctx={id,card:c,returned:[]};
 try{
  soundCue('skill');b.qi-=c.cost;b.hand.splice(index,1);const message=xRun(b,c.ops,target,ctx);b.log.unshift(`${c.name}：${message}`);b.cardsPlayed=(b.cardsPlayed||0)+1;
  selected=null;targetMode=null;noteCast(c.name);save();await animatePendingDeaths();renderBattle();
  await globalThis.GC_BRIDGE.fx('card:play',{cardId:id,handIndex:index,target:target?{uid:target.uid,side:c.target==='enemy'?'enemy':'ally',lane:target.lane}:null,message});
  globalThis.GC_BRIDGE.fx('burst',{uid:target?target.uid:null,side:c.target==='enemy'?'enemy':'ally',lane:target?target.lane:null,glyph:'◈',tone:'#e4cf8a'});
  await animatePendingDeaths();for(const u of ctx.returned)await globalThis.GC_BRIDGE.fx('return',{uid:u.uid,id:u.id,kind:'return',handIndex:b.hand.length-1});
  if(b.hand.length>handBefore-1)await globalThis.GC_BRIDGE.fx('draw',{count:b.hand.length-(handBefore-1)});
  cleanup();renderBattle();if((globalThis.MAINLINE_RUNTIME?.allEnemiesDefeated(b)??b.enemies.every(e=>e.dead))||b.enemyWill<=0)await winBattle();
 }finally{busy=false}
}
const xPrevPlaySkill=playSkill;
playSkill=function(index,lane){const b=state.battle,id=b?.hand[index],c=typeof id==='string'?SKILLS[id]:null;return c?.ops?xPlayCard(index,lane):xPrevPlaySkill(index,lane)};

// ---------- 关键词与召唤物 ----------
function xTaunter(b,lane){const list=xAllies(b).filter(u=>xHasKey(u,'taunt'));return list.sort((x,y)=>Math.abs(x.lane-lane)-Math.abs(y.lane-lane))[0]||null}
function xFloat(u,side,text,kind='info'){globalThis.GC_BRIDGE.fx('float',{target:{uid:u.uid,side,lane:u.lane},text,kind})}
function xDeath(b,u){
 const [k,a]=u.deathrattle,src=xSource(b);b.log.unshift(`${u.name}的亡语发动`);globalThis.GC_BRIDGE.fx('keyword',{kind:'death',uid:u.uid,side:'ally',lane:u.lane,name:u.name});
 if(k==='draw'){const n=b.hand.length;drawCards(a);globalThis.GC_BRIDGE.fx('draw',{count:b.hand.length-n})}
 else if(k==='blast')for(const e of xFoes(b)){const dealt=xHit(b,src,e,a,'亡语');xFloat(e,'enemy',dealt?`-${formatNum(dealt)}`:'免疫',dealt?'damage':'info')}
}
const xPrevCleanup=cleanup;
cleanup=function(){
 const b=state.battle;
 if(b)for(let i=0;i<4;i++){const u=b.units[i];if(!u?.dead)continue;if(u.deathrattle&&!u.rattled){u.rattled=true;xDeath(b,u)}if(u.token){if(b.domain?.uid===u.uid)b.domain=null;b.units[i]=null}}
 xPrevCleanup();
};
const xPrevReturn=returnUnitToHand;
returnUnitToHand=function(u){if(u?.token){const b=state.battle;if(b.units[u.lane]===u)b.units[u.lane]=null;return}return xPrevReturn(u)};
const xPrevEffAtk=effectiveAttack;
effectiveAttack=function(u){
 let v=xPrevEffAtk(u);const b=state.battle;
 if(b&&u&&u.lane>=0&&b.units[u.lane]===u){let n=0;for(const i of [u.lane-1,u.lane+1])if(xHasKey(b.units[i],'aura'))n++;if(n)v*=1+.2*n}
 return v};
const xPrevAttack=attackAnim;
attackAnim=async function(a,t,enemy){
 const b=state.battle;
 if(enemy&&b&&!(b.deceit&&b.deceit.turns>0)&&!xHasKey(t,'taunt')){const tk=xTaunter(b,a.lane);if(tk){b.log.unshift(`${tk.name}的嘲讽引走了${a.name}的攻击`);t=tk}}
 const before=Math.max(0,t.hp)+(t.shield||0);
 await xPrevAttack(a,t,enemy);
 const dealt=Math.max(0,before-(Math.max(0,t.hp)+(t.shield||0)));
 if(b&&state.battle===b&&dealt>0){if(enemy)await xEnemyHitHook(b,a,t,dealt);else{
  if(xHasKey(a,'pierce')){const v=Math.min(dealt*.3,b.maxEnemyWill*.06);b.enemyWill-=v;b.log.unshift(`${a.name}的穿透灼掉敌方命灯${formatNum(v)}`);xFloat(t,'enemy',`穿透 命灯-${formatNum(v)}`)}
  if(xHasKey(a,'leech')&&!a.dead){const v=Math.min(a.maxHp-a.hp,dealt*.5);if(v>0){a.hp+=v;xFloat(a,'ally',`吸血 +${formatNum(v)}`,'heal')}}
  if(xHasKey(a,'flame')&&!t.dead)addEffect(t,'ghostFire','灼刃',2,{sourceUid:a.uid,sourceSnapshot:clone(a),ratio:.2});
  refreshCombatCards()}}
};
async function xEnemyHitHook(b,e,t,dealt){}
const xPrevHitWill=hitWill;
hitWill=async function(e){const b=state.battle,tk=b&&!(b.deceit&&b.deceit.turns>0)?xTaunter(b,e.lane):null;if(tk){await attackAnim(e,tk,true);return}return xPrevHitWill(e)};
const xPrevEndTurn=endTurn;
endTurn=async function(){
 if(busy)return;const b=state.battle;
 if(b)for(const u of xAllies(b)){if(xHasKey(u,'multi'))u.extra=(u.extra||0)+1;if(u.noAttack)addEffect(u,'xIdle','静守',null,{skip:1})}
 await xPrevEndTurn();
 if(state.battle===b&&b)xTurnStart(b);
};
function xTurnStart(b){}

// ---------- 敌人行为类型 ----------
const X_BEHAVIORS={
 guard:['盾卫','被动：受到的全部伤害降低25%。'],
 bomber:['自爆','被动：被击倒时炸伤正前方的鬼灵（其最大生命的15%）；前方无人时熄灭我方3%命灯。'],
 leech:['吸血','被动：普通攻击造成伤害后，恢复该伤害50%的生命。'],
 swift:['疾行','被动：每逢第3、6、9…回合多行动一次。'],
 sniper:['远射','被动：无视站位，总是攻击场上生命比例最低的鬼灵。'],
 splitter:['增殖','被动：第一次被击倒时，在原地留下一个生命减半的分身。'],
 hexer:['咒师','被动：普通攻击命中后，目标受到的伤害增加10%，持续2回合。'],
 wailer:['哀嚎','被动：被击倒时，其余敌人攻击提高20%。'],
 lurker:['潜伏','被动：开场前2回合有50%概率闪避攻击。'],
 parasite:['寄生','被动：普通攻击命中后，我方下回合可用鬼气减少1点（每回合最多2点）。'],
 drummer:['鼓手','被动：只要它在场，其余敌人攻击提高15%。'],
 binder:['缚灵','被动：每逢第3、6、9…回合，令正前方的鬼灵下次行动停止。']
};
const X_BEHAVIOR_KEYS=Object.keys(X_BEHAVIORS);
for(const [name,desc] of Object.values(X_BEHAVIORS))BOSS_SKILLS[name]={name,kind:'trait',desc,behavior:true};
function xHash(s){let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))>>>0;return h}
function xIs(e,k){return !!e&&!e.dead&&e.behavior===k}
function xGiveBehavior(e,key){
 const [name]=X_BEHAVIORS[key];e.behavior=key;e.bossTraits=[...(e.bossTraits||[]),name];
 if(e.name.startsWith('随从 · '))e.name=name+' · '+e.name.slice(5);else if(e.name==='无尽游鬼')e.name=name+'游鬼';
 if(key==='guard')addEffect(e,'xbGuard','盾卫',null,{reduction:.25});
 if(key==='lurker')addEffect(e,'butterfly','潜伏',2,{dodge:.5});
 return e}
const xPrevRoster=enemyRoster;
enemyRoster=function(id){
 const list=xPrevRoster(id),n=NODES[id],arc=n?.arc||0;if(!n||n.difficulty===1||arc<1)return list;
 const seed=xHash(id);
 list.forEach((e,i)=>{if(!i&&(n.type==='boss'||arc<2))return;xGiveBehavior(e,X_BEHAVIOR_KEYS[(seed+arc*5+i*7)%X_BEHAVIOR_KEYS.length])});
 return list};
const xPrevEndlessRoster=endlessRoster;
endlessRoster=function(){
 const list=xPrevEndlessRoster(),w=state.wave||1;
 list.forEach((e,i)=>{e.bossTraits||=[];if(e.bossSkills?.length)return;xGiveBehavior(e,X_BEHAVIOR_KEYS[(w*5+i*7)%X_BEHAVIOR_KEYS.length])});
 return list};
xEnemyHitHook=async function(b,e,t,dealt){
 if(e.dead)return;
 if(e.behavior==='leech'){const v=Math.min(e.maxHp-e.hp,dealt*.5);if(v>0){e.hp+=v;xFloat(e,'enemy',`吸血 +${formatNum(v)}`,'heal')}}
 else if(e.behavior==='hexer'&&!t.dead){addEffect(t,'xbHex','咒印',2,{receivedBonus:.1});xFloat(t,'ally','咒印')}
 else if(e.behavior==='parasite'){b.qiPenalty=Math.min(2,(b.qiPenalty||0)+1);xFloat(e,'enemy','寄生 鬼气-1')}
 refreshCombatCards()};
function xEnemyDeath(b,e){
 b.kills=(b.kills||0)+1;
 if(e.behavior==='bomber'){const t=b.units[e.lane];if(t&&!t.dead){const v=t.maxHp*.15;dealRawDamage(e,t,v,'自爆',true,true);xFloat(t,'ally',`自爆 -${formatNum(v)}`,'damage')}else{b.will=Math.max(0,b.will-b.maxWill*.03);b.log.unshift(`${e.name}自爆，熄灭我方3%命灯`)}}
 else if(e.behavior==='wailer'){for(const o of xFoes(b))addEffect(o,'xbWail','哀嚎',null,{attackBonus:(o.effects?.xbWail?.attackBonus||0)+.2});b.log.unshift(`${e.name}的哀嚎令其余敌人攻击提高20%`)}
 else if(e.behavior==='splitter'&&!e.isSplit){const hp=Math.max(1,Math.round(e.maxHp*.5)),c={...clone(e),uid:e.uid+'-s',name:e.name+'（分身）',hp,maxHp:hp,dead:false,effects:{},isSplit:true,behavior:null,bossTraits:(e.bossTraits||[]).filter(x=>x!=='增殖'),shield:0};b.enemies.push(c);b.log.unshift(`${e.name}留下了一个分身`);globalThis.GC_BRIDGE.fx('enemy:return',{uid:c.uid,lane:c.lane})}
}
const xPrevCleanup2=cleanup;
cleanup=function(){
 const b=state.battle;
 if(b)for(const e of [...b.enemies])if(e.dead&&!e.xGone){e.xGone=true;xEnemyDeath(b,e);xFieldOnDeath(b,e)}
 xPrevCleanup2();
};
function xFieldOnDeath(b,e){}
const xPrevEffAtk2=effectiveAttack;
effectiveAttack=function(u){
 let v=xPrevEffAtk2(u);const b=state.battle;
 if(b&&u&&b.enemies.includes(u)){const n=b.enemies.filter(o=>o!==u&&xIs(o,'drummer')).length;if(n)v*=1+.15*n}
 return v};
// 远射：改写敌方普攻目标；空路时也优先点名
function xSniperTarget(b){return xAllies(b).sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0]||null}
const xPrevAttack2=attackAnim;
attackAnim=function(a,t,enemy){const b=state.battle;if(enemy&&b&&a.behavior==='sniper'&&!(b.deceit&&b.deceit.turns>0)){const s=xSniperTarget(b);if(s)t=s}return xPrevAttack2(a,t,enemy)};
const xPrevHitWill2=hitWill;
hitWill=function(e){const b=state.battle;if(b&&e.behavior==='sniper'&&!(b.deceit&&b.deceit.turns>0)){const s=xSniperTarget(b);if(s)return attackAnim(e,s,true)}return xPrevHitWill2(e)};
function xBehaviorTurn(b){
 if(b.turn%3)return;
 for(const e of xFoes(b)){
  if(e.behavior==='swift'){e.nextExtra=(e.nextExtra||0)+1;b.log.unshift(`${e.name}疾行：本回合行动两次`)}
  else if(e.behavior==='binder'){const t=b.units[e.lane];if(t&&!t.dead&&!skipEffect(t)){addEffect(t,'xbBind','缚灵',null,{skip:1});b.log.unshift(`${e.name}缚住了${t.name}`);xFloat(t,'ally','缚灵')}}
 }
}
