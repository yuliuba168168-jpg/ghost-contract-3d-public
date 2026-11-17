/* Preparation and test tools. Formal enemy generation and AI are intentionally unchanged. */
function showBattleDetails(sel){
 if(busy||!state.battle)return;
 globalThis.GC_BRIDGE.ui('battleDetail',sel);
}

function prepareBattle(id){
 if(busy)return;const alive=state.spirits.filter(s=>!s.dead),chosen=state.squad?.length?state.squad:alive.slice(0,6).map(s=>s.id);
 if(!alive.length){emergencyRest(()=>prepareBattle(id));return}
 globalThis.GC_BRIDGE.ui('prepare',{id,defaultSquad:chosen});
}
function confirmSquad(id,ids){
 if(!Array.isArray(ids)||!ids.length||ids.length>6){globalThis.GC_BRIDGE.notify('请选择1至6名鬼灵','warn');return}
 state.squad=ids.slice(0,6);save();closeModal();startBattle(id);
}
function prepareManageCards(id){openCollection(()=>prepareBattle(id))}
function cancelPrepare(){closeModal();renderMap()}

let collectionReturn=null;
function openCollection(back=null){
 if(busy||state.battle)return;collectionReturn=typeof back==='function'?back:null;
 globalThis.GC_BRIDGE.ui('collection');
}
function closeCollection(){const done=collectionReturn;collectionReturn=null;closeModal();done?.()}
function removeDeckCard(i){if(i<0||i>=state.deck.length)return;if(state.deck.length<=8){globalThis.GC_BRIDGE.notify('牌组至少保留 8 张','warn');return}state.deck.splice(i,1);save();openCollection(collectionReturn)}

let emergencyDone=null;
function emergencyRest(done=renderMap){
 emergencyDone=done;
 globalThis.GC_BRIDGE.ui('emergencyRest');
}
function acceptEmergencyRest(){
 for(const s of state.spirits){s.dead=false;s.hp=Math.max(1,s.maxHp*.1)}
 state.will=state.maxWill;state.log.unshift('返回安全营地，鬼灵恢复10%生命');save();closeModal();const done=emergencyDone;emergencyDone=null;done?.();
}

function showContractTrials(){
 globalThis.GC_BRIDGE.ui('contractTrials');
}
function contractSpirit(id){
 const c=GD.spirits.find(s=>s.id===id),cost=c?contractPrice(c):0;
 if(!c||state.xp<cost)return false;state.xp-=cost;addSpirit(c.id);save();soundCue('revive');showContractTrials();return true;
}
function closeContractTrials(){openCollection(collectionReturn)}
function contractPrice(c){return c.id==='nannan'?1000000:GD.ranks[Math.max(0,GD.rankIndex(c.initialRank))].killXp}

showRewards=function(count,done){
 if(count<=0){done();return}
 state.pendingReward={remaining:count,candidates:null,pendingPick:null};rewardDone=done;rollRewardCandidates();
};
rollRewardCandidates=function(){
 const r=state.pendingReward;if(!r)return;
 r.candidates=Array.from({length:3},weightedReward);save();globalThis.GC_BRIDGE.ui('rewards');
};
chooseReward=function(i){
 const r=state.pendingReward,id=r?.candidates?.[i];
 if(!r||!SKILLS[id])return false;
 if(state.deck.length>=25){r.pendingPick=id;globalThis.GC_BRIDGE.ui('rewardReplace');return true}
 state.deck.push(id);r.remaining--;r.candidates=null;save();soundCue('draw');
 if(r.remaining<=0)finishRewards();else rollRewardCandidates();return true;
};
function replaceReward(i){
 const r=state.pendingReward;
 if(!r||r.pendingPick==null||i<0||i>=state.deck.length)return false;
 state.deck[i]=r.pendingPick;r.remaining--;r.candidates=null;r.pendingPick=null;save();soundCue('draw');
 if(r.remaining<=0)finishRewards();else rollRewardCandidates();return true;
}
function cancelRewardReplace(){const r=state.pendingReward;if(!r)return;r.pendingPick=null;globalThis.GC_BRIDGE.ui('rewards')}

function parseCooldowns(text){const out={};for(const item of String(text||'').split(/[，,;；]/)){const [name,value]=item.split(/[:：]/);if(name?.trim()&&Number.isFinite(+value)&&+value>=0)out[name.trim()]=Math.floor(+value)}return out}
function configuredEffects(key){const options={eye:{label:'鬼瞳',turns:2,receivedBonus:.334},queenField:{label:'女王领域',turns:5,outgoingReduction:.275},dream:{label:'入梦',turns:1,skip:1,receivedBonus:.2},spaceLaw:{label:'空间规律',turns:2,cannotAttackPlayer:true},ice:{label:'冰雪',turns:2,freezeChance:.25},invincible:{label:'无敌规律',turns:1,invincible:true}};return options[key]?{[key]:clone(options[key])}:{}}
function startTestBattle(cfg=defaultTestConfig()){
 if(busy)return;const allies=cfg.allies.filter(a=>a.on),enemiesCfg=cfg.enemies.filter(e=>e.on);
 if(!allies.length||!enemiesCfg.length){globalThis.GC_BRIDGE.notify('双方至少各启用1名鬼灵','warn');return}
 if(new Set(enemiesCfg.map(e=>e.pos)).size!==enemiesCfg.length){globalThis.GC_BRIDGE.notify('敌方位置不能重复','warn');return}
 if(new Set(allies.map(a=>a.id)).size!==allies.length){globalThis.GC_BRIDGE.notify('我方鬼灵不能重复','warn');return}
 lastTestConfig=clone(cfg);testSnapshot=clone(state);state.xp=Math.max(0,cfg.xp||0);
 const norm=e=>({...e,cooldowns:e.cooldowns||parseCooldowns(e.cooldownText||''),effects:e.effects||configuredEffects(e.effect)});
 const enemies=enemiesCfg.map((e,i)=>{const ne=norm(e),c=GD.spirits.find(s=>s.id===ne.id),u=c?makeTestUnit(ne,+ne.pos):{id:`test-enemy-${i}`,name:ne.name,rankName:ne.rank,rankIndex:GD.rankIndex(ne.rank),potential:ne.potential,type:'恶灵',baseAtk:ne.atk,atk:ne.atk,maxHp:ne.hp,hp:ne.hp,lane:+ne.pos,cooldowns:clone(ne.cooldowns),effects:clone(ne.effects),dead:false};u.uid=`te${i}`;return initUnit(u)});
 state.battle={testMode:true,nodeId:'test',turn:1,qi:cfg.qi,maxQi:Math.min(10,cfg.qi),deployedCount:0,will:cfg.playerHp,maxWill:cfg.playerHp,enemyWill:cfg.enemyHp??10,maxEnemyWill:cfg.enemyHp??10,enemies,units:Array(4).fill(null),hand:[...allies.map((a,i)=>({kind:'ghost',unit:makeTestUnit(norm(a),i)})),...(cfg.cards||[]).filter(Boolean)],draw:cfg.draw||[],grave:[],removedEnemies:[],playerSkillsUsed:{},log:['自定义测试战斗：鬼灵全部从手牌开始']};selected=null;targetMode=null;
 globalThis.GC_BRIDGE.ui('battle');globalThis.GC_BRIDGE.fx('battle:enter',{testMode:true,nodeId:'test'});
}

Object.assign(globalThis.__CAMPAIGN_TEST__,{startTestBattle,prepareBattle,showRewards,chooseReward,replaceReward,cancelRewardReplace,rollRewardCandidates,skipRewards,parseCooldowns,configuredEffects,showContractTrials,contractSpirit,removeDeckCard,closeCollection,emergencyRest,acceptEmergencyRest,confirmSquad,cancelPrepare,prepareManageCards,showBattleDetails});
