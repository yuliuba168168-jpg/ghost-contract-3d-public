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
 ['execute','斩',3,'稀有','enemy','util','目标生命低于20%时直接击倒（首领和带技能的精英除外）；否则造成80%伤害。',[['execute',.2,.8]]],
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
 for(const k of u.keywords)addEffect(u,'kw-'+k,X_KEYWORDS[k].name,null);
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
  else if(k==='cheapDeploy')b.xDeployDiscount=(b.xDeployDiscount||0)+a;
  else if(k==='will')b.enemyWill-=b.maxEnemyWill*a;
  else if(k==='healWill')b.will=Math.min(b.maxWill,b.will+b.maxWill*a);
  else if(k==='payWill')b.will=Math.max(1,b.will-b.maxWill*a);
  else if(k==='willExecute'){if(b.enemyWill/b.maxEnemyWill<a)b.enemyWill=0;else b.enemyWill-=b.maxEnemyWill*c}
  else if(k==='payStrike'){b.xBloodTurn=b.turn;const lost=target.hp*a;target.hp=Math.max(1,target.hp-lost);const e=b.enemies.find(x=>!x.dead&&x.lane===target.lane);if(e)dealRawDamage(target,e,lost*c*receivedMultiplier(e),ctx.card.name,true,true)}
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
  soundCue('skill');b.qi-=c.cost;b.hand.splice(index,1);const message=xRun(b,c.ops,target,ctx);b.log.unshift(`${c.name}：${message}`);b.cardsPlayed=(b.cardsPlayed||0)+1;(b.archPlayed||={})[c.arch||'util']=(b.archPlayed[c.arch||'util']||0)+1;
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

// ---------- 场地 ----------
const X_FIELDS={
 bloodmoon:['血月','双方全部单位攻击提高15%。'],
 styx:['冥河','每回合开始，双方生命比例最低的单位各恢复6%生命。'],
 scorch:['焦土','所有灼烧造成的伤害提高50%。'],
 grave:['乱葬岗','任何单位被击倒时，我方获得1点鬼气（每回合最多2点）。'],
 market:['鬼市','每回合打出的第一张技能卡少消耗1点鬼气。'],
 battlefield:['古战场','召唤物的生命与攻击提高30%。'],
 lanterns:['灯会','双方命灯受到的空路直击提高25%。'],
 thunder:['雷泽','每回合开始，双方各有一个随机单位受到其最大生命6%的雷击（不会致命）。']
};
const X_FIELD_KEYS=Object.keys(X_FIELDS);
function xSetField(b,key,by){b.field=key;const [name,desc]=X_FIELDS[key];b.log.unshift(`${by?by+'：':''}场地变为【${name}】——${desc}`);globalThis.GC_BRIDGE.fx('field:change',{id:key,name,desc,by:by||null})}
const xPrevAddEffect=addEffect;
addEffect=function(u,key,label,turns,data={}){
 if(state.battle?.field==='scorch'){if(key==='ghostFire'&&data.ratio)data={...data,ratio:data.ratio*1.5};else if(key==='bossBurn')data={...data,burnPct:(data.burnPct||.08)*1.5}}
 return xPrevAddEffect(u,key,label,turns,data)};
const xPrevEffAtk3=effectiveAttack;
effectiveAttack=function(u){const v=xPrevEffAtk3(u);return state.battle?.field==='bloodmoon'?v*1.15:v};
const xPrevSpawn=xSpawn;
xSpawn=function(b,kind,lane,from){const u=xPrevSpawn(b,kind,lane,from);if(b.field==='battlefield'){u.maxHp=u.hp=u.baseMaxHp=Math.round(u.maxHp*1.3);u.atk=u.baseAtk=+(u.atk*1.3).toFixed(1)}b.summoned=(b.summoned||0)+1;return u};
xFieldOnDeath=function(b,e){if(b.field==='grave'&&(b.xGraveTurn!==b.turn||b.xGraveQi<2)){if(b.xGraveTurn!==b.turn){b.xGraveTurn=b.turn;b.xGraveQi=0}b.xGraveQi++;b.qi++;b.log.unshift('乱葬岗：获得1点鬼气')}};
const xPrevHitWill3=hitWill,xPrevHitEnemyWill=hitEnemyWill;
hitWill=async function(e){const b=state.battle,w=b?.will;await xPrevHitWill3(e);if(b&&state.battle===b&&b.field==='lanterns'&&b.will<w)b.will=Math.max(0,b.will-(w-b.will)*.25)};
hitEnemyWill=async function(u){const b=state.battle,w=b?.enemyWill;await xPrevHitEnemyWill(u);if(b&&state.battle===b&&b.field==='lanterns'&&b.enemyWill<w)b.enemyWill=Math.max(0,b.enemyWill-(w-b.enemyWill)*.25)};
const xPrevPlaySkill2=playSkill;
playSkill=function(index,lane){
 const b=state.battle,id=b?.hand[index],c=typeof id==='string'?SKILLS[id]:null;
 if(!b||!c||b.field!=='market'||b.xMarketTurn===b.turn||!c.cost||busy)return xPrevPlaySkill2(index,lane);
 const n=b.hand.length;b.qi+=1;const r=xPrevPlaySkill2(index,lane);
 if(b.hand.length<n||b.hand[index]!==id){b.xMarketTurn=b.turn;b.log.unshift('鬼市：这张牌少消耗1点鬼气')}else b.qi-=1;
 return r};
function xFieldTurn(b){
 if(b.field==='styx'){for(const [list,side] of [[xAllies(b),'ally'],[xFoes(b),'enemy']]){const u=list.filter(x=>x.hp<x.maxHp).sort((x,y)=>x.hp/x.maxHp-y.hp/y.maxHp)[0];if(u){const v=Math.min(u.maxHp-u.hp,u.maxHp*.06);u.hp+=v;xFloat(u,side,`冥河 +${formatNum(v)}`,'heal')}}}
 else if(b.field==='thunder'){for(const [list,side] of [[xAllies(b),'ally'],[xFoes(b),'enemy']]){if(!list.length)continue;const u=list[Math.floor(Math.random()*list.length)],v=Math.min(u.hp-1,u.maxHp*.06);if(v>0){u.hp-=v;xFloat(u,side,`雷击 -${formatNum(v)}`,'damage');globalThis.GC_BRIDGE.fx('burst',{uid:u.uid,side,lane:u.lane,glyph:'ϟ',tone:'#bcd4ff'})}}}
}

// ---------- 鬼障破障条件 ----------
const X_WARD={
 blood:['血障','本回合只要有己方单位被击倒、被献出或以生命支付代价，鬼障自动破除一层。',b=>b.xBloodTurn===b.turn],
 fire:['火障','只要场上有敌人正在灼烧，鬼障自动破除一层。',b=>xFoes(b).some(xBurning)],
 ice:['冰障','只要场上有敌人被冰冻或停止行动，鬼障自动破除一层。',b=>xFoes(b).some(xControlled)],
 array:['阵障','己方四路全部站满（召唤物也算）时，鬼障自动破除一层。',b=>b.units.every(u=>u&&!u.dead)],
 lamp:['灯障','我方命灯低于一半时，鬼障自动破除一层。',b=>b.will/b.maxWill<.5],
 lone:['影障','首领身边的随从全部倒下后，鬼障自动破除一层。',b=>xFoes(b).length<=1]
};
const X_WARD_KEYS=Object.keys(X_WARD);
for(const [name,desc] of Object.values(X_WARD))BOSS_SKILLS['破障·'+name]={name:'破障·'+name,kind:'trait',desc:'这名首领的鬼障另有破法：'+desc};
const xPrevWardCasts=wardCasts;
wardCasts=function(b=state.battle){let n=xPrevWardCasts(b);if(b?.ward&&b.wardRule&&X_WARD[b.wardRule][2](b))n+=1;return n};
const xPrevApply=xApply;
xApply=function(b,op,t,src,ctx){if(op[0]==='pay'||op[0]==='kill')b.xBloodTurn=b.turn;return xPrevApply(b,op,t,src,ctx)};

// ---------- 首领二阶段 ----------
const X_PHASES={
 frenzy:['暴走','此后每回合都施放技能，攻击提高25%。'],
 mirror:['镜像','在空路留下一个生命为自身四成的镜像；没有空路时改为获得20%护盾。'],
 molt:['蜕壳','清除自身全部减益，并获得最大生命25%的护盾，持续3回合。'],
 snuff:['夺灯','立刻熄灭我方8%的命灯，并恢复自身8%生命。'],
 rewrite:['改场','黑影替它改写场地规则。'],
 devour:['噬从','吞掉全部随从：每吞一名恢复15%生命、攻击提高20%；没有随从时攻击提高30%。']
};
const X_PHASE_KEYS=Object.keys(X_PHASES);
for(const [name,desc] of Object.values(X_PHASES))BOSS_SKILLS['二阶段·'+name]={name:'二阶段·'+name,kind:'trait',desc:'生命第一次降到一半时：'+desc};
function xPhase(b,e){
 const key=e.phase2,[name,desc]=X_PHASES[key];e.phased=true;b.log.unshift(`${e.name}进入二阶段【${name}】：${desc}`);
 if(key==='frenzy'){e.bossEvery=1;e.bossNext=Math.min(e.bossNext||b.turn,b.turn);addEffect(e,'xPhaseAtk','暴走',null,{attackBonus:.25})}
 else if(key==='mirror'){const lane=[0,1,2,3].find(i=>!b.enemies.some(o=>!o.dead&&o.lane===i));if(lane==null){e.shield=(e.shield||0)+e.maxHp*.2;addEffect(e,'xPhaseShield','镜像',3,{shieldExpiry:true})}else{const hp=Math.max(1,Math.round(e.maxHp*.4));b.enemies.push({...clone(e),uid:e.uid+'-m',name:e.name+'的镜像',hp,maxHp:hp,lane,dead:false,effects:{},shield:0,bossSkills:[],bossTraits:[],phase2:null,phased:true,elite:false,bossUses:{}});globalThis.GC_BRIDGE.fx('enemy:return',{uid:e.uid+'-m',lane})}}
 else if(key==='molt'){for(const [k,x] of Object.entries(e.effects||{}))if(k==='ghostFire'||k==='ice'||x.skip||x.receivedBonus||x.outgoingReduction)delete e.effects[k];e.shield=(e.shield||0)+e.maxHp*.25;addEffect(e,'xPhaseShield','蜕壳',3,{shieldExpiry:true})}
 else if(key==='snuff'){b.will=Math.max(1,b.will-b.maxWill*.08);e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.08)}
 else if(key==='rewrite')xSetField(b,X_FIELD_KEYS[(X_FIELD_KEYS.indexOf(b.field)+3)%X_FIELD_KEYS.length],'黑影');
 else if(key==='devour'){const m=xFoes(b).filter(o=>o!==e);for(const o of m){o.hp=0;o.dead=true;o.xGone=true}const k=m.length;e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.15*k);addEffect(e,'xPhaseAtk','噬从',null,{attackBonus:k?.2*k:.3})}
 globalThis.GC_BRIDGE.fx('boss:phase',{uid:e.uid,lane:e.lane,name:e.name,phase:name,desc});xSay(b,'phase');
}
const xPrevCleanup3=cleanup;
cleanup=function(){
 const b=state.battle;
 if(b){if(b.units.some(u=>u?.dead))b.xBloodTurn=b.turn;for(const e of xFoes(b))if(e.phase2&&!e.phased&&e.hp/e.maxHp<=.5)xPhase(b,e)}
 xPrevCleanup3();
};
function xSay(b,event){globalThis.GC_BRIDGE.fx('shadow',{event,turn:b.turn})}

// ---------- 战斗开场布置 ----------
function xSetupBattle(b){
 const n=NODES[b.nodeId]||{},endless=b.nodeId==='endless-arena',arc=endless?(state.wave||1):(n.arc||0),lead=b.enemies[0],seed=n.type==='boss'||endless?arc*3+1:xHash(b.nodeId);
 b.x=1;
 if(lead&&lead.bossSkills?.length&&(n.type==='boss'||endless)&&n.difficulty!==1){
  lead.phase2=X_PHASE_KEYS[arc%X_PHASE_KEYS.length];lead.bossTraits=[...(lead.bossTraits||[]),'二阶段·'+X_PHASES[lead.phase2][0]];
  if(b.ward){b.wardRule=X_WARD_KEYS[arc%X_WARD_KEYS.length];lead.bossTraits.push('破障·'+X_WARD[b.wardRule][0]);b.log.unshift(`${X_WARD[b.wardRule][0]}：${X_WARD[b.wardRule][1]}`)}
 }
 if(n.difficulty!==1&&(endless||arc>=2)){b.field=X_FIELD_KEYS[seed%X_FIELD_KEYS.length];if(lead?.phase2==='rewrite'&&!b.field)b.field=X_FIELD_KEYS[0];b.log.unshift(`场地【${X_FIELDS[b.field][0]}】：${X_FIELDS[b.field][1]}`)}
 else if(lead?.phase2==='rewrite'){lead.bossTraits=lead.bossTraits.filter(x=>x!=='二阶段·改场');lead.phase2='frenzy';lead.bossTraits.push('二阶段·暴走')}
}
const xPrevStart=startBattle;
startBattle=function(id){
 xPrevStart(id);const b=state.battle;if(!b||!b.mainline||b.nodeId!==id||b.x)return;
 xSetupBattle(b);save();globalThis.GC_BRIDGE.sync('battle');xSay(b,'start');
};
xTurnStart=function(b){
 xBehaviorTurn(b);if(b.field)xFieldTurn(b);
 const n=NODES[b.nodeId]||{};
 if(b.field&&n.type==='boss'&&b.turn===5&&!b.fieldSwapped){b.fieldSwapped=true;xSetField(b,X_FIELD_KEYS[(X_FIELD_KEYS.indexOf(b.field)+5)%X_FIELD_KEYS.length],'黑影拂过桌面');xSay(b,'rule')}
 xSay(b,'turn');save();globalThis.GC_BRIDGE.sync('battle');
};

// ---------- 敌方意图（纯查询） ----------
function xIntents(b=state.battle){
 if(!b)return [];
 return xFoes(b).map(e=>{
  const out={uid:e.uid,lane:e.lane,cast:null,castIn:null,action:'attack',targetUid:null,targetLane:null,damage:0,times:1+(e.nextExtra||0),behavior:e.behavior||null};
  if(e.bossSkills?.length){
   const name=e.bossSkills[bossCastSlot(e)%e.bossSkills.length],d=BOSS_SKILLS[name],spent=bossSkillSpent(e,name);
   if(b.turn>=(e.bossNext||0)){if(d&&!spent&&!(b.enemySkillNull>0))out.cast={name,kind:d.kind,desc:d.desc}}else out.castIn=e.bossNext-b.turn;
  }
  if(skipEffect(e)){out.action='skip';return out}
  const deceived=b.deceit&&b.deceit.turns>0;let t=deceived?b.units.find(u=>u?.id==='yuzao'&&!u.dead):null;
  if(!t&&e.behavior==='sniper')t=xSniperTarget(b);
  if(!t){const front=b.units[e.lane];t=front&&!front.dead&&xHasKey(front,'taunt')?front:xTaunter(b,e.lane)||(front&&!front.dead?front:null)}
  const atk=effectiveAttack(e)*(1+(e.extraAdd||0))*outgoingMultiplier(e);
  if(t){out.targetUid=t.uid;out.targetLane=t.lane;let d=atk*rankMultiplier(e,t)*receivedMultiplier(t);for(const x of Object.values(t.effects||{}))if(x.reduction)d*=1-x.reduction;out.damage=d}
  else if(e.effects?.spaceLaw?.cannotAttackPlayer)out.action='skip';
  else{out.action='lamp';out.damage=b.mainline?Math.max(b.maxWill*(b.directFloor||0),Math.min(b.maxWill*(b.directBite||.2),atk))*(b.field==='lanterns'?1.25:1):atk}
  if(e.effects?.ice)out.freeze=e.effects.ice.freezeChance||.25;
  return out});
}
function xKeywordsOf(u){return Object.keys(X_KEYWORDS).filter(k=>u?.keywords?.includes(k)||u?.effects?.['kw-'+k]).map(k=>({key:k,...X_KEYWORDS[k]}))}
globalThis.GC_X={ARCH:X_ARCH,KEYWORDS:X_KEYWORDS,TOKENS:X_TOKENS,BEHAVIORS:X_BEHAVIORS,FIELDS:X_FIELDS,WARD:X_WARD,PHASES:X_PHASES,
 intents:xIntents,keywordsOf:xKeywordsOf,field:(b=state.battle)=>b?.field?{id:b.field,name:X_FIELDS[b.field][0],desc:X_FIELDS[b.field][1]}:null,
 wardRule:(b=state.battle)=>b?.ward&&b.wardRule?{id:b.wardRule,name:X_WARD[b.wardRule][0],desc:X_WARD[b.wardRule][1],met:X_WARD[b.wardRule][2](b)}:null};

// ---------- 羁绊与合击 ----------
// [甲, 乙, 羁绊名, 合击名, 类型, 合击描述]；同场时两人攻击各+10%，每场可发动一次合击（2 鬼气）
const X_BONDS=[
 ['mengpo','yeshuang','黄泉同路','渡魂','heal','己方全体恢复30%生命，并获得15%护盾。'],
 ['yunmeng','ningdie','云梦蝶影','庄周梦蝶','control','敌方全体下一次行动停止。'],
 ['taiyin','artemis','双月同天','月蚀','lamp','直接熄灭敌方10%的命灯。'],
 ['xuenv','weila','雪国旧事','永冬','all','对敌方全体造成合计攻击90%的伤害，并令其2回合内各有40%概率被冻结。'],
 ['tong','nannan','两小无猜','捉迷藏','single','对生命最高的敌人造成合计攻击260%的伤害。'],
 ['xuan','lingluo','红妆旧梦','缠红','all','对敌方全体造成合计攻击100%的伤害。'],
 ['yuzao','mengling','镜花水月','狐梦','control','敌方全体下一次行动停止。'],
 ['lucifer','angel','堕天双翼','黑白审判','single','对生命最高的敌人造成合计攻击300%的伤害。'],
 ['moonqueen','xiyi','帝后同辇','凤权','lamp','直接熄灭敌方10%的命灯。'],
 ['jiangwei','xiaorou','相依为命','不离','heal','己方全体恢复30%生命，并获得15%护盾。'],
 ['qingzhu','isuna','规律与爱','以爱为律','all','对敌方全体造成合计攻击100%的伤害。']
];
function xBondKey(d){return d[0]+'+'+d[1]}
function xBondPair(b,d){const a=xAllies(b).find(u=>u.id===d[0]&&!u.token),c=xAllies(b).find(u=>u.id===d[1]&&!u.token);return a&&c?[a,c]:null}
function xBonds(b=state.battle){if(!b)return [];return X_BONDS.map(d=>({d,pair:xBondPair(b,d)})).filter(x=>x.pair).map(({d,pair})=>({key:xBondKey(d),name:d[2],strike:d[3],kind:d[4],desc:d[5],cost:2,used:!!b.bondUsed?.[xBondKey(d)],ready:!b.bondUsed?.[xBondKey(d)]&&b.qi>=2,uids:pair.map(u=>u.uid)}))}
const xPrevEffAtk4=effectiveAttack;
effectiveAttack=function(u){let v=xPrevEffAtk4(u);const b=state.battle;if(b&&u&&!u.token&&u.lane>=0&&b.units[u.lane]===u&&X_BONDS.some(d=>(d[0]===u.id||d[1]===u.id)&&xBondPair(b,d)))v*=1.1;return v};
async function xBondStrike(key){
 if(busy)return false;const b=state.battle,d=X_BONDS.find(x=>xBondKey(x)===key),pair=b&&d&&xBondPair(b,d);
 if(!pair){globalThis.GC_BRIDGE.notify('羁绊的两名鬼灵需要同时在场','warn');return false}
 if(b.bondUsed?.[key]){globalThis.GC_BRIDGE.notify('这个合击本场已经用过','warn');return false}
 if(b.qi<2){globalThis.GC_BRIDGE.notify('合击需要2点鬼气','warn');return false}
 busy=true;
 try{
  b.qi-=2;(b.bondUsed||={})[key]=true;b.bondsUsed=(b.bondsUsed||0)+1;const [a,c]=pair,kind=d[4],total=effectiveAttack(a)+effectiveAttack(c),src={name:d[3],atk:total,baseAtk:total,maxHp:1,hp:1,effects:{},pseudo:true};
  b.log.unshift(`${a.name}与${c.name}发动合击【${d[3]}】：${d[5]}`);soundCue('skill');noteCast(d[3]);
  await globalThis.GC_BRIDGE.fx('bond:strike',{key,name:d[2],strike:d[3],kind,a:{uid:a.uid,side:'ally',lane:a.lane},b:{uid:c.uid,side:'ally',lane:c.lane}});
  const hit=(e,r)=>{const v=dealRawDamage(a,e,src.atk*r*rankMultiplier(a,e)*receivedMultiplier(e),d[3],true,true);xFloat(e,'enemy',v?`-${formatNum(v)}`:'免疫',v?'damage':'info')};
  if(kind==='heal')for(const u of xAllies(b)){u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.3);u.shield=(u.shield||0)+u.maxHp*.15;addEffect(u,'umbrellaShield',d[3],null);xFloat(u,'ally','渡','heal')}
  else if(kind==='control')for(const e of xFoes(b)){addEffect(e,'xStun',d[3],null,{skip:1});xFloat(e,'enemy','停')}
  else if(kind==='lamp'){b.enemyWill-=b.maxEnemyWill*.1;globalThis.GC_BRIDGE.fx('float',{target:'enemyWill',text:`-${formatNum(b.maxEnemyWill*.1)}`,kind:'damage'})}
  else if(kind==='all'){const r=key==='xuenv+weila'?.9:1;for(const e of xFoes(b)){hit(e,r);if(key==='xuenv+weila'&&!e.dead)addEffect(e,'ice',d[3],2,{freezeChance:.4})}}
  else if(kind==='single'){const e=xFoes(b).sort((x,y)=>y.hp-x.hp)[0];if(e)hit(e,key==='lucifer+angel'?3:2.6)}
  save();await animatePendingDeaths();cleanup();renderBattle();
  if((globalThis.MAINLINE_RUNTIME?.allEnemiesDefeated(b)??b.enemies.every(e=>e.dead))||b.enemyWill<=0)await winBattle();
  return true;
 }finally{busy=false}
}
Object.assign(globalThis.GC_X,{BONDS:X_BONDS,bonds:xBonds,bondStrike:xBondStrike});

// ---------- 契约条款（契约抉择）----------
const X_PACTS={
 blood:['血契','攻击 +20%，最大生命 -15%。','以血为墨。她更锋利，也更容易碎。'],
 bone:['骨契','最大生命 +25%，攻击 -10%。','以骨为凭。她站得更久，出手更慢。'],
 lamp:['灯契','她出战的每场战斗：开局多1点鬼气，但我方命灯先熄6%。','以灯为押。借来的气，要用光来还。'],
 plain:['素契','没有增益，也没有代价。','只写名字，不添一笔。']
};
function xPactOf(id){return state.pacts?.[id]||null}
function xPendingPact(){const id=state.pendingPacts?.[0];if(!id)return null;const s=GD.spirits.find(x=>x.id===id);return {id,name:s?.name||id,options:Object.entries(X_PACTS).map(([key,[name,desc,flavor]])=>({key,name,desc,flavor}))}}
function xChoosePact(key){const id=state.pendingPacts?.[0];if(!id||!X_PACTS[key])return false;if(key!=='plain')xStatBump({pacts:1});(state.pacts||={})[id]=key;state.pendingPacts.shift();state.log.unshift(`与${GD.spirits.find(x=>x.id===id)?.name||id}立下${X_PACTS[key][0]}`);save();return true}
const xPrevGrant=grantContract;
grantContract=function(c){
 const had=new Set(state.spirits.map(s=>s.id));xPrevGrant(c);
 for(const s of state.spirits)if(!had.has(s.id)&&!state.pacts?.[s.id]&&!(state.pendingPacts||[]).includes(s.id)){(state.pendingPacts||=[]).push(s.id)}
 save()};
function xApplyPact(u,fresh){
 const p=u.pact;if(p!=='blood'&&p!=='bone')return;const am=p==='blood'?1.2:.9,hm=p==='blood'?.85:1.25,old=u.maxHp,ratio=old?u.hp/old:1;
 u.atk=+(u.atk*am).toFixed(2);u.baseAtk=+(u.baseAtk*am).toFixed(2);u.maxHp=Math.max(1,+(old*hm).toFixed(1));u.baseMaxHp=+(u.baseMaxHp*hm).toFixed(1);
 u.hp=fresh&&p==='blood'?Math.min(u.hp,u.maxHp):Math.max(1,+(u.maxHp*ratio).toFixed(1))}
const xPrevInit=initUnit;
initUnit=function(u){
 const fresh=!u.initialized,r=xPrevInit(u),p=fresh&&!u.token&&u.uid&&state.mainline?xPactOf(u.id):null;
 if(p){u.pact=p;xApplyPact(u,true)}
 return r};
const xPrevUpgradeInBattle=upgradeInBattle;
upgradeInBattle=function(i){
 const s=state.spirits[i],r=xPrevUpgradeInBattle(i),b=state.battle;if(r===false||!s||!b)return r;
 for(const u of [...b.units.filter(Boolean),...b.hand.map(handSpirit).filter(Boolean),...b.draw.map(handSpirit).filter(Boolean)])if(u.id===s.id&&u.pact&&u.initialized)xApplyPact(u,false);
 return r};
const xPrevSetup=xSetupBattle;
xSetupBattle=function(b){
 xPrevSetup(b);const ids=state.spirits.filter(s=>!s.dead&&(!state.squad?.length||state.squad.includes(s.id))).slice(0,6).map(s=>s.id).filter(id=>xPactOf(id)==='lamp');
 if(ids.length){b.qi+=ids.length;b.will=Math.max(1,b.will-b.maxWill*.06*ids.length);b.log.unshift(`灯契：开局多${ids.length}点鬼气，命灯先熄${6*ids.length}%`)}
};
Object.assign(globalThis.GC_X,{PACTS:X_PACTS,pactOf:xPactOf,pendingPact:xPendingPact,choosePact:xChoosePact});

// ---------- 无尽词缀、每日挑战、成绩 ----------
const X_AFFIXES={
 fierce:['凶戾','敌方攻击提高20%。'],thick:['厚皮','敌方生命提高30%。'],dim:['残灯','我方命灯开局先熄15%。'],
 thin:['气薄','开局鬼气减少1点。'],armored:['铁壁','全部敌人受到的伤害降低15%。'],storm:['雷泽','场地固定为雷泽。'],
 haste:['先手','全部敌人第一回合多行动一次。'],hollow:['空手','起手少1张牌。']
};
const X_AFFIX_KEYS=Object.keys(X_AFFIXES),X_RECORD_KEY='gc3d-records-v1';
function xAffixes(wave=state.wave||1,seed=state.dailySeed||0){const n=Math.min(X_AFFIX_KEYS.length,(state.daily?3:0)+Math.floor((wave-1)/3)),out=[];for(let i=0;out.length<n&&i<40;i++){const k=X_AFFIX_KEYS[(seed+i*3+Math.floor(i/8))%X_AFFIX_KEYS.length];if(!out.includes(k))out.push(k)}return out.map(k=>({key:k,name:X_AFFIXES[k][0],desc:X_AFFIXES[k][1]}))}
function xRecords(){try{const v=JSON.parse(localStorage.getItem(X_RECORD_KEY)||'null');if(v&&Array.isArray(v.endless)&&v.daily)return v}catch{}return {endless:[],daily:{}}}
function xRecord(wave){
 const r=xRecords(),date=xToday(),entry={wave,date,difficulty:difficultyOf(),name:state.name||''};
 if(state.daily)r.daily[state.daily]=Math.max(r.daily[state.daily]||0,wave);else{r.endless.push(entry);r.endless.sort((a,c)=>c.wave-a.wave);r.endless=r.endless.slice(0,10)}
 try{localStorage.setItem(X_RECORD_KEY,JSON.stringify(r))}catch{}return r}
function xToday(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function xDailyInfo(date=xToday()){const seed=xHash(date),ids=GD.spirits.map(s=>s.id),squad=[],deck=[],pool=Object.keys(SKILLS).filter(id=>SKILLS[id].ops);for(let i=0;squad.length<6;i++){const id=ids[(seed+i*7)%ids.length];if(!squad.includes(id))squad.push(id)}for(let i=0;deck.length<12;i++)deck.push(pool[(seed+i*11)%pool.length]);
 const save0=state.daily,seed0=state.dailySeed;state.daily=date;state.dailySeed=seed;const affixes=xAffixes(1,seed);state.daily=save0;state.dailySeed=seed0;
 return {date,seed,squad,deck,affixes,best:xRecords().daily[date]||0}}
function xStartDaily(slot,difficulty){const d=xDailyInfo();if(!newSlot(slot,'endless','每日 · '+d.date,difficulty))return false;state.daily=d.date;state.dailySeed=d.seed;state.squad=d.squad;state.deck=[...d.deck];ensureEndlessNode();save();return true}
const xPrevSetup2=xSetupBattle;
xSetupBattle=function(b){
 xPrevSetup2(b);if(b.nodeId!=='endless-arena')return;
 const list=xAffixes();b.affixes=list.map(a=>a.key);if(!list.length)return;const has=k=>b.affixes.includes(k);
 for(const e of b.enemies){if(has('fierce')){e.atk=+(e.atk*1.2).toFixed(1);e.baseAtk=e.atk}if(has('thick')){e.maxHp=Math.round(e.maxHp*1.3);e.hp=e.maxHp}if(has('armored'))addEffect(e,'xAffixArmor','铁壁',null,{reduction:.15});if(has('haste'))e.nextExtra=(e.nextExtra||0)+1}
 if(has('dim'))b.will=Math.max(1,b.will-b.maxWill*.15);if(has('thin'))b.qi=Math.max(1,b.qi-1);if(has('storm'))b.field='thunder';
 if(has('hollow')){const i=b.hand.findIndex(h=>typeof h==='string'&&SKILLS[h]);if(i>=0)b.draw.push(...b.hand.splice(i,1))}
 b.log.unshift('词缀：'+list.map(a=>a.name).join('、'));
};
const xPrevLose=loseBattle;
loseBattle=function(){const endless=state.mode==='endless'&&state.battle&&!state.battle.testMode,wave=state.wave;const r=xPrevLose();if(endless)xRecord(Math.max(0,(wave||1)-1));return r};
Object.assign(globalThis.GC_X,{AFFIXES:X_AFFIXES,affixes:xAffixes,records:xRecords,dailyInfo:xDailyInfo,startDaily:xStartDaily});

// ---------- 战绩与成就 ----------
const X_STAT_KEY='gc3d-stats-v1';
function xStats(){let v=null;try{v=JSON.parse(localStorage.getItem(X_STAT_KEY)||'null')}catch{}return Object.assign({wins:0,losses:0,kills:0,cards:0,summons:0,bonds:0,phases:0,flawless:0,fastest:0,bossWins:0,maxAct:0,maxWave:0,pacts:0,lowLamp:0,turns:0,arch:{},diff:{},done:[]},v||{})}
function xStatSave(s){try{localStorage.setItem(X_STAT_KEY,JSON.stringify(s))}catch{}}
const X_ACH=[
 ['first','初次得胜','赢下第一场战斗。',s=>s.wins>=1],['wins10','渐入佳境','累计赢下10场战斗。',s=>s.wins>=10],['wins50','百战之身','累计赢下50场战斗。',s=>s.wins>=50],['wins100','不夜人','累计赢下100场战斗。',s=>s.wins>=100],
 ['kills100','清道夫','累计击倒100名敌人。',s=>s.kills>=100],['kills500','尸山','累计击倒500名敌人。',s=>s.kills>=500],
 ['boss10','首领猎手','累计赢下10场首领战。',s=>s.bossWins>=10],['phase5','见过真身','累计把5名首领逼入二阶段后获胜。',s=>s.phases>=5],
 ['flawless5','全身而退','5场战斗里没有任何鬼灵倒下。',s=>s.flawless>=5],['fast','速战','在3回合内赢下一场战斗。',s=>s.fastest>0&&s.fastest<=3],['lowlamp','残灯逆转','命灯不足两成时赢下一场战斗。',s=>s.lowLamp>=1],
 ['cards100','符箓成堆','累计打出100张新卡。',s=>s.cards>=100],['summon30','纸人军团','累计召唤30个召唤物。',s=>s.summons>=30],['bond10','同心','累计发动10次合击。',s=>s.bonds>=10],
 ['burn20','焚天','累计打出20张灼烧卡。',s=>(s.arch.burn||0)>=20],['ice20','霜寒','累计打出20张冰控卡。',s=>(s.arch.ice||0)>=20],['summon20','点兵','累计打出20张召唤卡。',s=>(s.arch.summon||0)>=20],
 ['blood20','以血还血','累计打出20张献祭卡。',s=>(s.arch.blood||0)>=20],['bounce20','去而复返','累计打出20张回手卡。',s=>(s.arch.bounce||0)>=20],['lamp20','吹灯人','累计打出20张直击卡。',s=>(s.arch.lamp||0)>=20],
 ['hard','破障者','在困难及以上难度赢下首领战。',s=>(s.diff.hard||0)+(s.diff.nightmare||0)+(s.diff.taboo||0)>=1],['nightmare','噩梦行者','在噩梦及以上难度赢下首领战。',s=>(s.diff.nightmare||0)+(s.diff.taboo||0)>=1],['taboo','禁忌','在禁忌难度赢下首领战。',s=>(s.diff.taboo||0)>=1],
 ['act10','初窥门径','打完主线第10幕。',s=>s.maxAct>=10],['act28','第一部终','打完主线第28幕。',s=>s.maxAct>=28],['act46','诡异时代','打完主线第46幕。',s=>s.maxAct>=46],
 ['wave10','无尽十波','无尽模式完成10波。',s=>s.maxWave>=10],['wave20','无尽二十波','无尽模式完成20波。',s=>s.maxWave>=20],
 ['pact5','白纸黑字','立下5份带代价的契约。',s=>s.pacts>=5],['daily1','今日事','完成一次每日挑战。',(s,r)=>Object.keys(r.daily).length>=1],['daily7','七日约','在7个不同的日子完成每日挑战。',(s,r)=>Object.keys(r.daily).length>=7]
];
function xAchievements(s=xStats()){const r=xRecords();return X_ACH.map(([key,name,desc,test])=>({key,name,desc,done:!!test(s,r)}))}
function xStatCommit(s){const now=xAchievements(s).filter(a=>a.done).map(a=>a.key),fresh=now.filter(k=>!s.done.includes(k));s.done=now;xStatSave(s);for(const k of fresh)globalThis.GC_BRIDGE.notify('成就达成：'+X_ACH.find(a=>a[0]===k)[1],'info');return fresh}
function xStatBump(delta){const s=xStats();for(const k in delta)s[k]=(s[k]||0)+delta[k];return xStatCommit(s)}
function xStatBattle(b,won,ctx){
 if(!b||b.testMode)return;const s=xStats();s.kills+=b.kills||0;s.cards+=b.cardsPlayed||0;s.summons+=b.summoned||0;s.bonds+=b.bondsUsed||0;s.turns+=b.turn||0;for(const k in b.archPlayed||{})s.arch[k]=(s.arch[k]||0)+b.archPlayed[k];
 if(won){s.wins++;if(!b.grave.some(u=>!u.token))s.flawless++;if(!s.fastest||b.turn<s.fastest)s.fastest=b.turn;if(b.will/b.maxWill<.2)s.lowLamp++;s.phases+=b.enemies.filter(e=>e.phased).length;
  if(ctx.boss){s.bossWins++;s.diff[ctx.diff]=(s.diff[ctx.diff]||0)+1;if(ctx.act&&b.nodeId!=='endless-arena')s.maxAct=Math.max(s.maxAct,ctx.act)}
  if(b.nodeId==='endless-arena')s.maxWave=Math.max(s.maxWave,ctx.wave||0)}
 else s.losses++;
 xStatCommit(s)}
function xBattleCtx(b){const n=b&&typeof NODES!=='undefined'?NODES[b.nodeId]:null;return {boss:n?.type==='boss',act:n?.act||0,diff:typeof difficultyOf==='function'?difficultyOf():'easy',wave:state.wave||0}}
const xPrevWin=winBattle;
winBattle=async function(){const b=state.battle,ctx=xBattleCtx(b),pending=!!state.pendingSettlement;const r=await xPrevWin();if(b&&!pending&&!b.xCounted){b.xCounted=true;xStatBattle(b,true,ctx)}return r};
const xPrevLose2=loseBattle;
loseBattle=function(){const b=state.battle,ctx=xBattleCtx(b);const r=xPrevLose2();if(b&&!b.xCounted){b.xCounted=true;xStatBattle(b,false,ctx)}return r};
Object.assign(globalThis.GC_X,{ACH:X_ACH,stats:xStats,achievements:xAchievements});

// ---------- 桌面道具互动（香炉 / 招魂铃 / 魂瓮）----------
const X_PROP_NAMES={bell:'招魂铃',censer:'香炉',urn:'魂瓮'};
// [键, 名, 序列, 线索, 奖励说明]
const X_RITES=[
 ['summon','招魂','bell,censer,urn,bell','铃响一声，香才肯燃；香燃着，瓮里的人才肯应；应过之后，再送一声铃。','一张珍藏卡'],
 ['vow','还愿','censer,censer,urn,urn','欠下的香要上两炷，欠下的人要叩两回。','200 点经验'],
 ['farewell','送魂','urn,bell,bell,censer','先叩门，再摇两声铃送她上路，最后替她点一炷香。','一张传说卡']
];
const X_WHISPERS=['铃舌上缠着一缕头发。','瓮壁是温的。','香灰里有半个指印。','有人在你背后数数。','桌子底下的那双脚，不是你的。'];
function xPropState(){return state.xProps||={seq:[],rites:[],incenseNode:null,urnAct:0,touches:0}}
function xRiteReward(key){
 const pool=r=>Object.keys(SKILLS).filter(id=>SKILLS[id].ops&&SKILLS[id].rarity===r),pick=r=>{const p=pool(r);return p[(xHash(state.name||'x')+state.spirits.length*7+xPropState().touches)%p.length]};
 if(key==='vow'){state.xp+=200;return '获得 200 点经验'}
 const id=pick(key==='summon'?'珍藏':'传说'),full=state.deck.length>=25;if(full)state.deck[state.deck.length-1]=id;else state.deck.push(id);return `获得卡牌【${SKILLS[id].name}】${full?'（牌组已满，替换了最后一张）':''}`}
function xTouchProp(kind){
 if(!X_PROP_NAMES[kind]||!state.mainline||state.battle||state.fallen)return null;
 const p=xPropState(),n=typeof NODES!=='undefined'?NODES[state.current]:null,out={kind,name:X_PROP_NAMES[kind],text:'',reward:null,rite:null};p.touches++;
 if(kind==='censer'){if(p.incenseNode===state.current)out.text='这一程的香已经上过了。';else{p.incenseNode=state.current;state.xIncense=true;out.text='上了一炷香。下一场战斗开局多 1 点鬼气。'}}
 else if(kind==='urn'){const act=n?.act||1;if(p.urnAct===act)out.text='叩了叩瓮。里面的人翻了个身。';else{p.urnAct=act;const before=state.will;state.will=Math.min(10,state.will+1);out.text=state.will>before?'瓮里有人应了一声。命灯亮了一分。':'瓮里有人应了一声。'}}
 else out.text=X_WHISPERS[p.touches%X_WHISPERS.length]+(p.rites.length<X_RITES.length?'　'+X_RITES.find(r=>!p.rites.includes(r[0]))[3]:'');
 p.seq.push(kind);if(p.seq.length>4)p.seq.shift();
 const rite=X_RITES.find(r=>r[2]===p.seq.join(',')&&!p.rites.includes(r[0]));
 if(rite){p.rites.push(rite[0]);p.seq=[];out.rite=rite[1];out.reward=xRiteReward(rite[0]);state.log.unshift(`完成仪式【${rite[1]}】：${out.reward}`);xStatBump({rites:1})}
 save();return out}
const xPrevSetup3=xSetupBattle;
xSetupBattle=function(b){xPrevSetup3(b);if(state.xIncense&&b.mainline&&!b.testMode){state.xIncense=false;b.qi+=1;b.log.unshift('香火：开局多1点鬼气')}};
X_ACH.push(['rite1','礼数','在牌桌上完成一个仪式。',s=>(s.rites||0)>=1],['rite3','通灵','完成牌桌上的全部三个仪式。',s=>(s.rites||0)>=3]);
Object.assign(globalThis.GC_X,{RITES:X_RITES,touchProp:xTouchProp,propState:()=>state.xProps||null});

// ---------- 遗物（法器）与冥钱 ----------
const X_RELICS={
 incense:['残香','每场战斗开局多1点鬼气。'],oilpot:['灯油壶','每场战斗开局，我方命灯恢复10%。'],paperdoll:['替身纸人','每场战斗开局，在最右的空路召来一个纸人。'],
 whetstone:['磨刀石','我方鬼灵攻击提高8%。'],amulet:['护身符','我方鬼灵显形时获得最大生命10%的护盾。'],abacus:['鬼算盘','战斗胜利获得的冥钱增加50%。'],
 tornpage:['残页','每场战斗起手多抽1张牌。'],clapper:['铃舌','每逢第3、6、9…回合，鬼气多1点。'],bonemirror:['照骨镜','首领的攻击降低10%。'],
 redthread:['红线','羁绊的攻击加成由10%提高到20%。'],salve:['续命膏','战斗胜利后，存活的鬼灵恢复10%生命。'],coinstring:['铜钱串','商店价格降低20%。'],
 guidelamp:['引路灯','每场战斗开局，敌方命灯先熄8%。'],frostbead:['寒珠','每场战斗开局，第一名随从停止行动1回合。'],ashbag:['骨灰袋','每场战斗开局，全部敌人失去6%生命。']
};
function xHasRelic(k){return !!state.relics?.includes(k)}
function xRelics(){return (state.relics||[]).map(k=>({key:k,name:X_RELICS[k][0],desc:X_RELICS[k][1]}))}
function xGainRelic(k){if(!X_RELICS[k]||xHasRelic(k))return false;(state.relics||=[]).push(k);state.log.unshift(`获得法器【${X_RELICS[k][0]}】`);xStatBump({relics:1});return true}
function xRelicOffer(n,seed){const pool=Object.keys(X_RELICS).filter(k=>!xHasRelic(k)),out=[];for(let i=0;out.length<Math.min(n,pool.length)&&i<60;i++){const k=pool[(seed+i*5)%pool.length];if(!out.includes(k))out.push(k)}return out}
const xPrevSetup4=xSetupBattle;
xSetupBattle=function(b){
 xPrevSetup4(b);if(!b.mainline||b.testMode||!state.relics?.length)return;
 if(xHasRelic('incense'))b.qi+=1;if(xHasRelic('oilpot'))b.will=Math.min(b.maxWill,b.will+b.maxWill*.1);if(xHasRelic('guidelamp'))b.enemyWill-=b.maxEnemyWill*.08;
 if(xHasRelic('tornpage')&&b.draw.length&&b.hand.length<12)b.hand.push(b.draw.pop());
 if(xHasRelic('paperdoll')){const lane=[3,2,1,0].find(l=>!b.units[l]);if(lane!=null)xSpawn(b,'paper',lane,null)}
 const boss=b.enemies.filter(e=>e.bossSkills?.length),minion=b.enemies.find(e=>!e.bossSkills?.length);
 if(xHasRelic('bonemirror'))for(const e of boss){e.atk=+(e.atk*.9).toFixed(1);e.baseAtk=e.atk}
 if(xHasRelic('frostbead')&&minion)addEffect(minion,'xStun','寒珠',null,{skip:1});
 if(xHasRelic('ashbag'))for(const e of b.enemies)e.hp=Math.max(1,+(e.hp*.94).toFixed(1));
 b.log.unshift('法器生效：'+xRelics().map(r=>r.name).join('、'));
};
const xPrevEffAtk5=effectiveAttack;
effectiveAttack=function(u){let v=xPrevEffAtk5(u);const b=state.battle;if(!b||!b.mainline||!u||u.lane==null||b.units[u.lane]!==u||!state.relics?.length)return v;
 if(xHasRelic('whetstone'))v*=1.08;if(xHasRelic('redthread')&&!u.token&&X_BONDS.some(d=>(d[0]===u.id||d[1]===u.id)&&xBondPair(b,d)))v*=1.2/1.1;return v};
const xPrevInit2=initUnit;
initUnit=function(u){const fresh=!u.initialized,r=xPrevInit2(u);if(fresh&&u.uid&&!u.token&&state.mainline&&state.battle?.mainline&&xHasRelic('amulet'))u.shield=(u.shield||0)+u.maxHp*.1;return r};
const xPrevTurnStart2=xTurnStart;
xTurnStart=function(b){xPrevTurnStart2(b);if(b.mainline&&xHasRelic('clapper')&&b.turn%3===0){b.qi+=1;b.log.unshift('铃舌：鬼气多1点')}};
function xCoinReward(b){const n=typeof NODES!=='undefined'?NODES[b.nodeId]:null;if(!n||b.nodeId==='endless-arena')return 0;let v=10+(n.act||1)*2;if(n.type==='boss')v*=2;else if(n.elite)v*=1.5;if(xHasRelic('abacus'))v*=1.5;return Math.round(v)}
const xPrevWin2=winBattle;
winBattle=async function(){
 const b=state.battle,real=b?.mainline&&!b.testMode&&!state.pendingSettlement,coins=real?xCoinReward(b):0,elite=real&&NODES[b.nodeId]?.elite,seed=real?xHash(b.nodeId)+(state.relics?.length||0):0;
 const r=await xPrevWin2();if(!real||b.xPaid)return r;b.xPaid=true;
 if(coins){state.coins=(state.coins||0)+coins;state.log.unshift(`获得冥钱 ${coins}`)}
 if(xHasRelic('salve'))for(const s of state.spirits)if(!s.dead)s.hp=Math.min(s.maxHp,s.hp+s.maxHp*.1);
 // 精英战的法器按幕数有上限（第 1 幕 2 件，之后约每 3.5 幕多 1 件）；到上限或已集齐时改给 3 倍冥钱，避免前十几幕就把 15 件拿全。
 if(elite){const cap=2+Math.floor((NODES[b.nodeId].act||1)/3.5),offer=(state.relics?.length||0)<cap?xRelicOffer(3,seed):[];if(offer.length)state.pendingRelic=offer;else{const extra=coins*2;state.coins=(state.coins||0)+extra;state.log.unshift(`法器已到本幕上限，改得冥钱 ${extra}`)}}
 save();return r};
function xPendingRelic(){return state.pendingRelic?.length?state.pendingRelic.map(k=>({key:k,name:X_RELICS[k][0],desc:X_RELICS[k][1]})):null}
function xChooseRelic(k){if(!state.pendingRelic?.includes(k))return false;xGainRelic(k);state.pendingRelic=null;save();return true}
X_ACH.push(['relic5','收藏家','累计获得5件法器。',s=>(s.relics||0)>=5]);
Object.assign(globalThis.GC_X,{RELICS:X_RELICS,relics:xRelics,hasRelic:xHasRelic,gainRelic:xGainRelic,pendingRelic:xPendingRelic,chooseRelic:xChooseRelic,coins:()=>state.coins||0});

// ---------- 新节点：鬼市（商店）、异兆（事件）、精英战 ----------
const X_PRICE={普通:30,稀有:50,珍藏:80,传说:120};
const X_OMENS=[
 ['井边的女人','井口坐着一个梳头的女人。她没有回头，只把木梳递了过来。',[['接过木梳','获得一件法器。下一场战斗开局全队先失去20%生命。',[['relic'],['wound',.2]]],['替她梳头','下一场战斗开局多1点鬼气。',[['incense']]],['绕开','什么也不发生。',[]]]],
 ['无人的戏台','戏台上锣鼓自己在响，台下的长凳坐满了纸人。',[['坐下看完','获得一张稀有卡。下一场战斗开局我方命灯先熄10%。',[['card','稀有'],['dim',.1]]],['往台上扔钱','花30冥钱，获得一张珍藏卡。',[['pay',30],['card','珍藏']]],['离开','什么也不发生。',[]]]],
 ['赊账的鬼差','一个鬼差拦住去路，说你阳间的账还没清。',[['认账','失去40冥钱，下一场战斗开局多1点鬼气。',[['pay',40],['incense']]],['赖账','获得40冥钱。下一场战斗开局全队先失去15%生命。',[['coins',40],['wound',.15]]]]],
 ['路边的供桌','荒路上摆着一张供桌，供品还冒着热气。',[['吃掉供品','获得40冥钱。下一场战斗开局我方命灯先熄10%。',[['coins',40],['dim',.1]]],['添一炷香','下一场战斗开局多1点鬼气。',[['incense']]],['掀了桌子','获得60冥钱，下一场战斗敌人攻击提高15%。',[['coins',60],['curse']]]]],
 ['借宿的孩子','一个孩子抱着枕头站在门口，问能不能和你们一起睡。',[['让她进来','获得150点经验。',[['xp',150]]],['给她一张牌','失去牌组最后一张牌，获得一件法器。',[['losecard'],['relic']]],['关门','什么也不发生。',[]]]],
 ['当铺','柜台很高，看不见掌柜的脸，只伸出一只手。',[['当掉一张牌','失去牌组最后一张牌，获得50冥钱。',[['losecard'],['coins',50]]],['押上命灯','获得70冥钱。下一场战斗开局我方命灯先熄10%。',[['dim',.1],['coins',70]]],['离开','什么也不发生。',[]]]],
 ['写了一半的契约','桌上摊着一张契约，只差落款。墨还是湿的。',[['替它落款','获得一张传说卡。下一场战斗开局全队先失去30%生命。',[['card','传说'],['wound',.3]]],['烧掉','获得100点经验。',[['xp',100]]]]],
 ['迷路的新娘','红盖头下面传来哭声。她问你，去婚礼的路怎么走。',[['带她一程','获得一张珍藏卡。下一场战斗敌人攻击提高15%。',[['card','珍藏'],['curse']]],['指错路','获得50冥钱。',[['coins',50]]],['掀开盖头','获得一件法器。下一场战斗开局我方命灯先熄20%。',[['relic'],['dim',.2]]]]]
];
ML.arcs.forEach((a,i)=>{
 const p=a.id,fork=p+'-fork',camp=p+'-camp',trial=p+'-trial',shop=p+'-shop',omen=p+'-omen';if(!NODES[fork]||NODES[shop])return;
 STORY[shop]='岔路尽头支着几顶没有灯的棚子。摊主们不说话，只把价钱写在纸上。冥钱在这里才花得出去：可以换牌、换法器，也可以请人把一张不想要的牌烧掉。';STORY[omen]=X_OMENS[i%X_OMENS.length][1];
 NODES[shop]={act:a.act,title:'鬼市',type:'shop',story:shop,next:[camp],arc:i,mainline:true};NODES[omen]={act:a.act,title:'异兆 · '+X_OMENS[i%X_OMENS.length][0],type:'omen',story:omen,next:[camp],arc:i,mainline:true,omen:i%X_OMENS.length};
 STORY[fork]='战斗后的道路重新分开。你可以调查附近的线索，挑战一处有精英把守的鬼域，去鬼市花掉冥钱，或者走进一处异兆；也可以直接回到安全篝火。四个去处只能选一个，所有道路都会在篝火汇合，关键契约已在主线中完成。';
 NODES[fork].next=[p+'-explore',trial,shop,omen,camp];NODES[trial].elite=true;NODES[trial].title='精英 · 余波清理';
 ACT_ROWS[a.act]=ACT_ROWS[a.act].map(row=>row.includes(trial)?[...row,shop,omen]:row);MAIN_KEYS.add(shop);MAIN_KEYS.add(omen)});
function xSiblings(id){const n=NODES[id],a=n&&ML.arcs[n.arc||0];return a?['-explore','-trial','-shop','-omen','-camp'].map(s=>a.id+s):[]}
const xPrevComplete=completeNode;
completeNode=function(id){xPrevComplete(id);const sib=xSiblings(id);if(sib.includes(id)){state.available=state.available.filter(x=>!sib.includes(x)||NODES[id].next.includes(x));save()}};
const xPrevEnter=enterNode;
enterNode=function(id){const n=NODES[id];if(!state.mainline||!n||!['shop','omen'].includes(n.type))return xPrevEnter(id);if(busy||state.pendingSettlement||!state.available.includes(id))return;state.current=id;save();globalThis.GC_BRIDGE.ui(n.type,{id})};
const xPrevRoster2=enemyRoster;
enemyRoster=function(id){const list=xPrevRoster2(id);if(NODES[id]?.elite&&list.length&&!list.xElite){for(const e of list){e.maxHp=Math.round(e.maxHp*1.25);e.hp=e.maxHp;e.atk=+(e.atk*1.1).toFixed(1);e.baseAtk=e.atk}list[0].name='精英 · '+list[0].name.replace(/^精英 · /,'')}return list};
// 物价随幕数上涨（第 1 幕 ×1，第 46 幕 ×3.7），与冥钱收入的增长对齐；法器每多一件再贵两成。
function xActMult(id){return 1+(Math.max(1,NODES[id]?.act||1)-1)*.06}
function xPriceOf(v,id){return Math.round(v*xActMult(id)*(xHasRelic('coinstring')?.8:1))}
function xOmenAmount(v,id){return Math.round(v*xActMult(id)/5)*5}
function xShopStock(id){const all=state.shopStock||={};if(all[id])return all[id];const seed=xHash(id)+xHash(state.name||''),ids=Object.keys(SKILLS).filter(k=>SKILLS[k].ops),cards=[];for(let i=0;cards.length<4&&i<40;i++){const k=ids[(seed+i*13)%ids.length];if(!cards.includes(k))cards.push(k)}return all[id]={cards,relics:xRelicOffer(2,seed),sold:[]}}
// 删牌在「鬼灵与卡牌」里本来就免费，鬼市不再卖它；换成买经验，给后期用不掉的冥钱一个去处
function xShopXp(id){const a=ML.arcs[NODES[id]?.arc||0];return GD.ranks[Math.max(0,Math.min(GD.ranks.length-1,a?.rank||0))]?.upgradeXp||100}
function xShop(id=state.current){if(NODES[id]?.type!=='shop')return null;const s=xShopStock(id),items=[...s.cards.map(k=>({kind:'card',key:k,name:SKILLS[k].name,desc:SKILLS[k].desc,rarity:SKILLS[k].rarity,price:xPriceOf(X_PRICE[SKILLS[k].rarity]||30,id)})),...s.relics.map(k=>({kind:'relic',key:k,name:X_RELICS[k][0],desc:X_RELICS[k][1],price:xPriceOf(90*(1+.2*(state.relics?.length||0)),id)})),{kind:'xp',key:'xp',name:'抄一卷经',desc:`获得${formatNum(xShopXp(id))}点经验（约够本幕等级的鬼灵升一级）。`,price:xPriceOf(60,id)},{kind:'incense',key:'incense',name:'一炷好香',desc:'下一场战斗开局多1点鬼气（与香炉上的香不叠加）。',price:xPriceOf(35,id)}];
 return {id,coins:state.coins||0,items:items.map((it,i)=>({...it,index:i,sold:s.sold.includes(it.kind+':'+it.key)||(it.kind==='relic'&&xHasRelic(it.key))}))}}
function xBuy(id,index,deckIndex){const shop=xShop(id),it=shop?.items[index];if(!it||it.sold||state.available.indexOf(id)<0)return false;if((state.coins||0)<it.price){globalThis.GC_BRIDGE.notify('冥钱不够','warn');return false}
 if(it.kind==='card'){if(state.deck.length>=25){globalThis.GC_BRIDGE.notify('牌组已满，先烧掉一张牌','warn');return false}state.deck.push(it.key)}
 else if(it.kind==='relic'){if(!xGainRelic(it.key))return false}
 else if(it.kind==='remove'){if(!Number.isInteger(deckIndex)||deckIndex<0||deckIndex>=state.deck.length||state.deck.length<=1)return false;state.deck.splice(deckIndex,1)}
 else if(it.kind==='xp')state.xp+=xShopXp(id);
 else if(it.kind==='incense'){if(state.xIncense){globalThis.GC_BRIDGE.notify('香已经点上了，下一场战斗生效','warn');return false}state.xIncense=true}
 else return false;
 state.coins-=it.price;state.shopStock[id].sold.push(it.kind+':'+it.key);save();return true}
function xLeaveNode(id=state.current){if(!['shop','omen'].includes(NODES[id]?.type)||!state.available.includes(id))return false;completeNode(id);renderMap();return true}
function xOmen(id=state.current){const n=NODES[id];if(n?.type!=='omen')return null;const [title,text,opts]=X_OMENS[n.omen];return {id,title,text,options:opts.map(([label,desc,ops],i)=>({index:i,label,desc:desc.replace(/(\d+)冥钱/g,(m,v)=>xOmenAmount(+v,id)+'冥钱'),disabled:ops.some(o=>o[0]==='pay'&&(state.coins||0)<xOmenAmount(o[1],id))||ops.some(o=>o[0]==='losecard')&&state.deck.length<=1}))}}
function xChooseOmen(id,i){const o=xOmen(id),opt=o?.options[i];if(!opt||opt.disabled||!state.available.includes(id))return null;const n=NODES[id],[label,desc,ops]=X_OMENS[n.omen][2][i],got=[];
 for(const [k,v] of ops){
  if(k==='coins')state.coins=(state.coins||0)+xOmenAmount(v,id);else if(k==='pay')state.coins-=xOmenAmount(v,id);else if(k==='xp')state.xp+=v;else if(k==='will')state.will=Math.max(1,Math.min(10,state.will+v));
  else if(k==='hurt'){for(const s of state.spirits)if(!s.dead)s.hp=Math.max(1,+(s.hp-s.maxHp*v).toFixed(1))}
  else if(k==='mend'){for(const s of state.spirits)if(!s.dead)s.hp=Math.min(s.maxHp,s.hp+s.maxHp*v)}
  else if(k==='wound')state.xWound=Math.min(.5,(state.xWound||0)+v);else if(k==='dim')state.xDim=Math.min(.4,(state.xDim||0)+v);else if(k==='heal')fullHeal();else if(k==='incense')state.xIncense=true;else if(k==='curse')state.xCurse=true;else if(k==='losecard')got.push('失去【'+SKILLS[state.deck.pop()]?.name+'】');
  else if(k==='relic'){const r=xRelicOffer(1,xHash(id)+(state.relics?.length||0))[0];if(r&&xGainRelic(r))got.push('法器【'+X_RELICS[r][0]+'】')}
  else if(k==='card'){const pool=Object.keys(SKILLS).filter(c=>SKILLS[c].ops&&SKILLS[c].rarity===v),c=pool[(xHash(id)+state.deck.length)%pool.length];if(state.deck.length<25){state.deck.push(c);got.push('卡牌【'+SKILLS[c].name+'】')}else got.push('牌组已满，卡牌没能带走')}}
 state.log.unshift(`异兆【${o.title}】：${label}`);completeNode(id);save();return {label,text:desc,got}}
// 归巢：只让「下一次」显形便宜，用掉就清零（以前直接改累计显形次数，等于整场永久减费）
const xPrevCost=spiritCost;spiritCost=function(){return Math.max(0,xPrevCost()-(state.battle?.xDeployDiscount||0))};
const xPrevDeployGhost=deployGhost;deployGhost=async function(index,lane){const b=state.battle,n=b?.deployedCount||0;await xPrevDeployGhost(index,lane);if(b&&state.battle===b&&b.xDeployDiscount&&(b.deployedCount||0)>n){b.xDeployDiscount=0;save();globalThis.GC_BRIDGE.sync('battle')}};
const xPrevSetup5=xSetupBattle;
xSetupBattle=function(b){xPrevSetup5(b);if(state.xCurse&&b.mainline&&!b.testMode){state.xCurse=false;for(const e of b.enemies){e.atk=+(e.atk*1.15).toFixed(1);e.baseAtk=e.atk}b.log.unshift('异兆：敌人攻击提高15%')}
 // 异兆的代价留到下一场战斗开局才结算，免费的全队恢复抹不掉它
 if(b.mainline&&!b.testMode&&(state.xWound||state.xDim)){const w=state.xWound||0,d=state.xDim||0;state.xWound=0;state.xDim=0;
  if(w){for(const s of state.spirits)if(!s.dead)s.hp=Math.max(1,+(s.hp-s.maxHp*w).toFixed(1));b.log.unshift(`异兆：全队先失去${Math.round(w*100)}%生命`)}
  if(d){b.will=Math.max(1,b.will-b.maxWill*d);b.log.unshift(`异兆：我方命灯先熄${Math.round(d*100)}%`)}}};
Object.assign(globalThis.GC_X,{OMENS:X_OMENS,omenAmount:xOmenAmount,priceMult:xActMult,shop:xShop,buy:xBuy,leaveNode:xLeaveNode,omen:xOmen,chooseOmen:xChooseOmen});

// ---------- 局外解锁：开局馈赠 ----------
const X_BOONS=[
 ['coins','压箱钱','开局带80冥钱。','累计赢下10场战斗',s=>s.wins>=10],
 ['relic','祖传法器','开局带一件法器。','打完主线第10幕',s=>s.maxAct>=10],
 ['cards','旧牌匣','开局牌组多2张稀有卡。','达成8个成就',s=>xAchievements(s).filter(a=>a.done).length>=8],
 ['xp','熟路','开局带400点经验。','无尽模式撑到第5波',s=>s.maxWave>=5]
];
let xBoonPick=null;
function xBoons(){const s=xStats();return X_BOONS.map(([key,name,desc,need,test])=>({key,name,desc,need,unlocked:!!test(s)}))}
function xSetBoon(key){const b=xBoons().find(o=>o.key===key);xBoonPick=b?.unlocked?key:null;return !!xBoonPick}
function xBoonInto(t,key,seed){
 if(key==='coins')t.coins=(t.coins||0)+80;else if(key==='xp')t.xp=(t.xp||0)+400;
 else if(key==='relic'){const k=Object.keys(X_RELICS)[seed%Object.keys(X_RELICS).length];if(!(t.relics||=[]).includes(k))t.relics.push(k)}
 else if(key==='cards'){const pool=Object.keys(SKILLS).filter(c=>SKILLS[c].ops&&SKILLS[c].rarity==='稀有');for(let i=0;i<2;i++)t.deck.push(pool[(seed+i*7)%pool.length])}
 t.boon=key}
const xPrevNewSlot=newSlot;
newSlot=function(i,mode,name,difficulty){const key=xBoonPick;xBoonPick=null;const ok=xPrevNewSlot(i,mode,name,difficulty);
 if(ok&&key&&mode!=='endless'){const seed=xHash(String(name||'')+key);xBoonInto(state,key,seed);if(state.checkpoint?.snapshot)xBoonInto(state.checkpoint.snapshot,key,seed);save()}return ok};
Object.assign(globalThis.GC_X,{BOONS:X_BOONS,boons:xBoons,setBoon:xSetBoon});
