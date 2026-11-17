/* Guided controls and gentle procedural sound. Presentation concerns moved to the presentation layer. */
(function(){
const GUIDE=[
 ['开始与存档','选择四个存档槽之一，建立普通、极限或无尽旅途。已有槽点“继续旅途”；建立新旅途会替换该槽。标题的导出／导入可备份全部四档。'],
 ['模式与死亡','普通失败返回上一个篝火，回滚之后的收获并恢复全队；极限死亡后重新开始；无尽失败结束本轮，鬼灵伤势和阵亡跨波次保留。'],
 ['路线选择','点击“下一站”推进。分支可调查、挑战或直接去篝火，都会汇合。展开“完整路线”查看连线地图，不会改变已作出的选择。'],
 ['剧情与回顾','剧情中的“继续”推进故事，“展开小说正文”阅读原著节选。完整剧情档案可以重读任意幕，后续章节包含剧透。'],
 ['契约伙伴','接受必经契约即可获得伙伴；支援契约在鬼灵面板的支援档案查看，不占战场位置。'],
 ['备战与敌人预览','战前查看敌人攻血、等级和首领技能。点选出战鬼灵，最多六名；勾选框表示已选择。确认后鬼灵进入手牌。'],
 ['选择手牌与部署','点击手牌鬼灵，再点击下方我方空位。第X次部署消耗X鬼气，回手后再部署也累计。手机可左右滑手牌；点“上一张／下一张”也能切换。'],
 ['选择单位','单击我方卡牌选择它，再点“技能与记录”。双击或长按卡牌看技能、原攻、当前攻击、生命、冷却和所有状态。单击敌人主要用于指定技能目标。'],
 ['移动与换位','选中我方单位后，在技能面板使用左移／右移。移动到相邻空格消耗1鬼气；相邻格有友军则免费换位。只能在四路范围内移动。'],
 ['主动技能与目标','选中鬼灵，打开技能面板，点击可用技能；需要目标时再点亮的目标阵营卡牌。不需要目标的技能直接释放。被动、冷却或鬼气不足的技能不可点击。'],
 ['两次选目标的技能','迷惑先选一名敌人，再选它要攻击的另一名敌人。若选错，可点“取消选择”重新选择，取消不会消耗鬼气。'],
 ['御鬼者技能','每项每场一次。血祭增幅要求噩梦级及以上，英灵融合要求半英灵级及以上，神火要求半圣灵级及以上。先点技能，再点符合等级的我方单位；不合格不扣资源、不消耗次数。'],
 ['技能卡、事件卡与回血','点击手牌技能卡，再按提示选友军或目标；无目标事件直接释放。鬼币等治疗卡可恢复鬼灵。费用显示在牌角，具体效果长按查看。'],
 ['回手与复活','鬼绳让单位回手，去除增益并保留规定的其他状态。鬼舍利等复活牌处理阵亡伙伴；复活后重新部署仍累计部署费。不要把“复活”和波次自动回血混淆。'],
 ['攻击与结束回合','鬼灵自动攻击正前方，空路攻击对方玩家生命。结束回合后，双方按顺序行动并播放动画，期间不能重复操作。可以在设置调快演出。'],
 ['鬼气与牌库','鬼气支付部署、移动、技能和卡牌。下回合增加上限并补充鬼气；牌库有牌时抽牌。手牌上限12，牌库为空后不再抽牌。'],
 ['血量、状态与详情','双方玩家独立10生命；鬼灵攻血单独计算。卡面显示原攻与生命，光效和状态图标表示持续效果；详细面板显示增益后攻击和持续回合。'],
 ['首领与行动记录','敌人预览和长按首领可查看技能。敌方行动有动画，战斗记录列出每个动作与结果；手机点“技能与记录”打开抽屉查看。'],
 ['经验与三选一奖励','胜利先获得经验，再每轮从三张卡中选一张。满25张需替换一张旧牌；可以放弃剩余卡牌。已领取进度自动保存，不会重复发经验。'],
 ['升级鬼灵','非战斗任何界面都能打开鬼灵与卡牌。选鬼灵看详情，经验够就升级，升级恢复该鬼灵满生命并替换旧版技能。普通／极限战斗中不能升级。'],
 ['篝火、修行与整理','篝火恢复全队并记录普通模式复活点。修行补助每幕一次，可按推荐培养。鬼灵与卡牌面板可移除旧牌，移除后不返还，操作前会确认。'],
 ['无尽升级与持续伤势','无尽初始全部现有鬼灵噩梦一阶；每三波提高敌人等级。波次结束不恢复鬼灵，不复活阵亡伙伴；可用治疗卡或消耗经验升级恢复。玩家生命仍按原规则在波次间恢复。'],
 ['图鉴与详细技能','图鉴只用于查阅，不等于获得角色。点击鬼灵查看数值、各等级解锁技能、效果与升级要求。用筛选和分页查看，未在主线出现的角色不加入小说路线。'],
 ['测试台','设置双方鬼灵、等级、潜力、攻血、敌方位置、手牌、牌库和状态。敌方不能占同一位置，我方不能重复。开始测试后从手牌部署；“结束测试”返回配置，主线档案不受影响。'],
 ['声音、演出与界面','设置可关闭音效、调整音量和速度、减少闪烁，开启／关闭首次操作提示。手机“菜单”保留管理、记录和设置；面板可收起，长篇剧情和档案允许内部滚动。'],
 ['退出、续玩与备份','回到标题会保存旅途，点同一存档继续。若正在演出时关闭，重开从该回合开始前继续。导入备份会替换四档，请先导出当前备份。']
];
globalThis.PLAY_GUIDE=GUIDE;
let guidePrefs;try{guidePrefs=JSON.parse(localStorage.getItem('youqi-guide-v1')||'{}')}catch{guidePrefs={}}
guidePrefs.enabled??=true;guidePrefs.seen??={};
function remember(){try{localStorage.setItem('youqi-guide-v1',JSON.stringify(guidePrefs))}catch{}}
function showTip(index,force=false){if(index<0||index>=GUIDE.length)return;if(!guidePrefs.enabled&&!force||guidePrefs.seen[index]&&!force)return;guidePrefs.seen[index]=true;remember();globalThis.GC_BRIDGE.ui('tip',{index,title:GUIDE[index][0],text:GUIDE[index][1]})}
function openGuide(index=0){if(busy)return;globalThis.GC_BRIDGE.ui('guide',{index})}
function resetGuideTips(index=0){guidePrefs.seen={};guidePrefs.enabled=true;remember();openGuide(index)}
globalThis.OPEN_PLAY_GUIDE=openGuide;globalThis.SHOW_PLAY_TIP=showTip;globalThis.RESET_PLAY_TIPS=resetGuideTips;
const baseApplySettings=applyPresentationSettings;
applyPresentationSettings=function(next={}){baseApplySettings(next);if(next.volume!=null)preferences.volume=Math.max(0,Math.min(1,+next.volume));if(next.guideHints!=null){guidePrefs.enabled=!!next.guideHints;remember()}soundCue('click')};
const oldMap=renderMap;renderMap=function(){oldMap();if(state.mainline)showTip(state.mode==='endless'?21:2);};
const oldBattle=renderBattle;renderBattle=function(){oldBattle();if(!state.battle)return;showTip(6);};
const oldUpgrade=upgradeOwnedSpirit;upgradeOwnedSpirit=function(i){const before=state.spirits[i]?.rankIndex;oldUpgrade(i);if(state.spirits[i]?.rankIndex!==before)soundCue('upgrade')};
const oldChoose=chooseSettlementCard;chooseSettlementCard=function(...args){const ok=oldChoose(...args);if(ok)soundCue('reward');return ok};
const oldWin=winBattle;winBattle=async function(){soundCue('win');await oldWin()};const oldLose=loseBattle;loseBattle=function(){soundCue('lose');oldLose()};
})();
