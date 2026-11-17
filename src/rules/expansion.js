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
