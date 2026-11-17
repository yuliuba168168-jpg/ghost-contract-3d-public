(function(g){
const definitions={};
function define(names,theme,glyph,subtitle,motion='ray',scope='target'){
 for(const name of names.split('|'))definitions[name]={theme,glyph,subtitle,motion,scope};
}
define('鬼域','domain','◈','黑青鬼雾覆盖战场 · 伤害牵引','ring','board');
define('英灵领域','fate','✶','苍金红羽牵动因果丝','ring','board');
define('伞域','umbrella','☂','纸伞张开 · 雨丝承伤','ring','board');
define('邪灵形态|女武神形态','scarlet','✦','红裙翻卷 · 黑影张开','rise','self');
define('鬼瞳','eye','◉','竖瞳睁开 · 红线扫过敌阵','scan','enemies');
define('寒冰右手','ice','❄','冰晶右手推出霜刺','ray','target');
define('无解防御','shield','⬡','四角护片合成暗红冰盾','fold','self');
define('不完全因果律|半完全因果律|完全因果律','fate','◎','红色因果轮随生命转动','ring','self');
define('鬼火|鬼火+','ghostfire','♨','幽蓝鬼火沿桌面飞向目标','orbs','target');
define('闪遁|无解闪遁|圣灵闪遁','smoke','囍','红烟留影 · 纸钱飘散','fade','self');
define('鬼绣球|鬼绣球+','wedding','✿','绣球旋转 · 红线连接友军','orbs','allies');
define('伞分身|伞分身+','umbrella','☂','伞影分散 · 友军护盾张开','fan','allies');
define('55开|55开+','mirror','☯','伞面映出目标 · 数值翻转','split','target');
define('虚化|虚化+','void','虚','敌阵错位 · 技能封印','scan','enemies');
define('画卷绝杀','ink','虎','水墨画卷合拢 · 白虎爪痕','slash','target');
define('白虎驱邪纹|白虎驱邪纹+','heal','虎','白虎额纹洗净伤痕','rise','target');
define('解析|解析+|解析++|解析+++|解析++++','analysis','析','罗盘刻度扫描目标','scan','target');
define('火凤燎原|火凤燎原+|不完全火焰规律|半完全火焰规律','phoenix','凤','火凤掠过敌方阵列','sweep','enemies');
define('女王领域','queen','♛','月轮与王冠压制敌阵','ring','enemies');
define('金字塔镇压|金字塔镇压+','pyramid','△','象形金字塔轰然落下','drop','enemies');
define('时间梦境','clock','⌛','金色时钟令目标停顿','clock','target');
define('爱的规律','love','♡','金色丝带转移玩家伤害','ribbon','self');
define('水分身|水分身+','water','◌','水波横穿友军 · 分身凝聚','sweep','allies');
define('无象灵水躯|无象灵水躯+','water','≈','身形化水 · 攻击穿过水幕','wave','self');
define('无敌规律','mask','☠','鬼焰与面具凝成护盾','fold','self');
define('丰都鬼军','army','⚑','丰都城门开启 · 十道鬼兵斩痕','sweep','target');
define('鬼门关降临','gate','門','鬼门关升起 · 锁链席卷敌阵','drop','enemies');
define('前世|前世+|前世++|前世+++','memory','∞','前世残影与今生重合','echo','self');
define('幻影蝶翼','butterfly','蝶','紫蝶分出交错残像','fan','self');
define('人类规律|人类规律+','lifeline','♥','生命脉冲化为攻击','ribbon','self');
define('寂灭蝶珠','butterfly','◉','蝶群聚珠 · 紫色冲击塌缩','implode','target');
define('入梦|入梦+','dream','☾','云带盖住敌牌 · 双眼合拢','veil','target');
define('梦的规律','dream','☾','弯月倒影吞没负面效果','wave','self');
define('时间回退','clock','↶','钟盘记录友军状态','clock','target');
define('时间删除','clock','⌛','扫描线擦除目标时间','scan','target');
define('云梦泽|云梦泽+','cloud','☁','莲花云海托起友军','sweep','allies');
define('佛系规律|佛系规律+','lotus','✿','冰晶莲瓣护印保持无敌','fold','self');
define('冰雪','ice','❄','暴雪扫过敌阵 · 冰花封行动','sweep','enemies');
define('迷惑','fox','狐','狐尾提线操纵敌方攻击','ribbon','target');
define('欺骗','fox','狐','三道狐影引开攻击','echo','enemies');
define('绝望','despair','绝','万籁停顿 · 黑手改写数值','implode','enemies');
define('地狱之主|地狱之主+','inferno','♛','蝠翼与王座同时升起','rise','self');
define('空间规律|空间规律+','space','◇','空间门折叠攻击轨迹','split','target');
define('鬼主权杖','royal','♛','王权法阵锁定目标','drop','target');
define('轮回','reincarnation','轮','轮回盘倒转 · 亡者归来','ring','allies');
define('地府降临','underworld','桥','奈何桥下魂火涌入鬼气','sweep','self');
define('太阴之力','moon','☽','六枚月相符文注入鬼气','orbs','self');
define('复仇','moon','➹','月箭沿伤害轨迹反射','ray','target');
define('死亡','void','◇','魂光随卡牌消散','fade','self');
define('神火','divinefire','☀','金色神火环绕契约鬼灵','ring','self');
define('血祭增幅','bloodsacrifice','◆','血色契印强化契约鬼灵','ring','self');

const stateThemes={form:'scarlet',eye:'eye',defense:'shield',domain:'domain',ghostFire:'ghostfire',ghostBall:'wedding',equal:'mirror',umbrellaShield:'umbrella',virtual:'void',analysis:'analysis',analysisBroken:'analysis',queenField:'queen',timeDream:'clock',waterClone:'water',waterBody:'water',invincible:'mask',butterfly:'butterfly',dream:'dream',rollback:'clock',timeDelete:'clock',cloudDream:'cloud',ice:'ice',deceit:'fox',despair:'despair',spaceLaw:'space',lunar:'moon',divineFire:'divinefire',bloodSacrifice:'bloodsacrifice'};
const labels={eye:'鬼瞳',ghostFire:'鬼火',queenField:'女王领域',timeDream:'时间梦境',waterClone:'水分身',waterBody:'灵水躯',invincible:'无敌',butterfly:'蝶翼',rollback:'时间回退',timeDelete:'时间删除',cloudDream:'云梦泽',ice:'冻结',deceit:'欺骗',spaceLaw:'空间封锁',analysisBroken:'已解析',ghostBall:'鬼绣球',umbrellaShield:'伞盾'};
function passiveStates(unit){if(!unit||!g.GAME_DATA?.spirits.some(s=>s.id===unit.id))return[];const skills=g.GAME_DATA.unlockedSkills(unit.id,unit.rankName||'F级'),out=[];
 const has=base=>skills.find(s=>s===base||s.startsWith(base+'+'));
 for(const family of [['不完全因果律','fate'],['半完全因果律','fate'],['完全因果律','fate'],['前世','memory'],['人类规律','lifeline'],['梦的规律','dream'],['地狱之主','inferno'],['爱的规律','love'],['地府降临','underworld'],['复仇','moon']]){const name=has(family[0]);if(name)out.push({label:name,theme:family[1],glyph:definitions[name]?.glyph||'✦',passive:true})}
 if(unit.dodgeCharges>0)out.push({label:`闪遁 ${unit.dodgeCharges}次`,theme:'smoke',glyph:'◌',passive:true});
 if(unit.preAttackInvincible>0)out.push({label:`佛系规律 ${unit.preAttackInvincible}次`,theme:'lotus',glyph:'✿',passive:true});
 if(unit.id==='tong'&&skills.some(s=>s.includes('因果律'))){const ratio=unit.hp/Math.max(1,unit.maxHp),level=ratio<.1?3:ratio<.25?2:ratio<.5?1:0;if(level)out.push({label:`因果强化 ${level}层`,theme:'fate',glyph:'◎'})}
 if(unit.rollbackSnapshot&&!unit.effects?.rollback)out.push({label:'时间回退',theme:'clock',glyph:'↶'});
 return out;
}
function cardStates(unit){const active=Object.entries(unit.effects||{}).map(([key,e])=>({key,label:e.label||labels[key],theme:key==='domain'?(definitions[e.label]?.theme||'domain'):stateThemes[key]||definitions[e.label]?.theme||'domain',glyph:definitions[e.label]?.glyph||'✦',turns:e.turns,analysis:e.analysis}));return [...active,...passiveStates(unit)];}
function cardVisual(unit){const states=cardStates(unit);return {states,themes:[...new Set(states.map(s=>s.theme))],badges:states.map(s=>`${s.glyph} ${s.label}${s.analysis!=null?` ${s.analysis}%`:''}${s.turns==null?'':` · ${s.turns}`}`)};}
const colors={domain:'#4fd7a8',fate:'#c8a35c',umbrella:'#8edfc2',scarlet:'#c85d47',eye:'#d75a48',ice:'#b9e7d9',shield:'#d2bd86',ghostfire:'#4fd7a8',smoke:'#9ac9b8',wedding:'#c8a35c',mirror:'#b5d8cc',void:'#81958d',ink:'#e8f0e2',heal:'#8be3bc',analysis:'#61ddb0',phoenix:'#dca85d',queen:'#ddc079',pyramid:'#c8a35c',clock:'#9ed7c3',love:'#d6b985',water:'#72d9b5',mask:'#57cda2',army:'#5bcda6',gate:'#67d9ae',memory:'#c5b27e',butterfly:'#a88ac4',lifeline:'#d78988',dream:'#78d8b2',cloud:'#b8ded0',lotus:'#d9eee6',fox:'#ca8d76',despair:'#10110f',inferno:'#cf684f',space:'#8f81b0',royal:'#4fd7a8',reincarnation:'#9dd5bc',underworld:'#4fd7a8',moon:'#d7e3dd',divinefire:'#d9b85f',bloodsacrifice:'#d33f42'};
function color(theme){return colors[theme]||'#a9dfeb'}
function currentBattle(){return typeof state!=='undefined'?state?.battle:null}
function sideOf(unit){const b=currentBattle();return b&&b.enemies.includes(unit)?'enemy':'ally'}
function unitRef(unit){return unit?{uid:unit.uid??null,side:sideOf(unit),lane:unit.lane??null}:null}
function scopeTargets(scope,source,target){
 const b=currentBattle();
 if(scope==='self')return source?[unitRef(source)]:[];
 if(scope==='target')return target?[unitRef(target)]:[];
 if(scope==='enemies')return b?b.enemies.filter(e=>!e.dead).map(unitRef):[];
 if(scope==='allies')return b?b.units.filter(Boolean).map(unitRef):[];
 return b?[...b.units.filter(Boolean).map(unitRef),...b.enemies.filter(e=>!e.dead).map(unitRef)]:[];
}
async function cast(name,source,target){const def=definitions[name];if(!def)return;await g.GC_BRIDGE.fx('skill:cast',{name,source:unitRef(source),targets:scopeTargets(def.scope,source,target),theme:def.theme,motion:def.motion,scope:def.scope})}
function react(name,unit,label){const def=definitions[name]||{theme:'domain',glyph:'✦',motion:'fold'};const ref=unitRef(unit);g.GC_BRIDGE.fx('react',{name,uid:ref?ref.uid:null,side:ref?ref.side:null,lane:ref?ref.lane:null,label:label??null})}
function expire(unit,key,e){const name=e?.label||labels[key]||key,ref=unitRef(unit);g.GC_BRIDGE.fx('effect:expire',{uid:ref?ref.uid:null,side:ref?ref.side:null,lane:ref?ref.lane:null,key,label:name})}
g.GHOST_VFX={definitions,cardStates,cardVisual,cast,react,expire,color};
})(globalThis);
