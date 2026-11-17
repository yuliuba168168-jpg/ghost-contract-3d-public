/* globalThis.GC — headless rules-engine facade for the presentation layer.
 * Loaded last; every earlier global function is reachable through GC.actions / GC.query.
 * Read-only live views of engine state plus data-table references. */
(function(g){
function lex(name){try{return (0,eval)(`typeof ${name}!=="undefined"?${name}:null`)}catch{return null}}
function cancelSelection(){if(lex('busy'))return;selected=null;targetMode=null;g.GC_BRIDGE.sync('battle')}
const ACTION_NAMES=['selectHand','allyLane','allyTarget','enemyTarget','exactSpiritSkill','selectPlayerSkill','usePlayerSkill','moveSpirit','playSkill','deployGhost','endTurn',
 'renderHome','renderMap','renderCodex','showCodexSpirit','renderTestLab','renderEndless','renderSettlement','showSettlementReplacement','pickSettlementCard','chooseSettlementCard','cancelSettlementReplace','discardSettlementRewards','settlementManage','finishSettlement',
 'enterNode','showEvent','continueEvent','continueMainlineEvent','showStoryBeforeBattle','beforeBattleUpgrade','prepareBattle','confirmSquad','cancelPrepare','prepareManageCards','startBattle','retryBattle','retreatToMap','continueFromDefeat','returnToTitle',
 'showCamp','campHeal','campSearchCards','campUpgrade','campLeave','campManage','campTraining','upgradeChoice','upgradeAtCamp',
 'showRewardNode','claimRewardNode','claimInvestigation','rewardManage','chooseReward','replaceReward','cancelRewardReplace','skipRewards',
 'showEnding','finishEnding','readEndingAct','openStoryArchive','viewArchiveAct','closeStoryArchive','openReader','readerPage','closeReader',
 'openCollection','closeCollection','removeDeckCard','showOwnedSpirit','upgradeOwnedSpirit','showContractTrials','contractSpirit','closeContractTrials','emergencyRest','acceptEmergencyRest',
 'createSlotDialog','confirmNewSlot','newSlot','loadSlot','exportSlots','exportSlotsData','importSlotsData',
 'journal','presentationSettings','applyPresentationSettings','confirmReset','resetCampaign','showTraining','trainTeam','trainingHeal','trainingManage','trainingClose',
 'setDifficulty','startTestBattle','exitTestBattle','exitTestToHome','defaultTestConfig','showBattleDetails','openBattleUpgrade','closeBattleUpgrade','upgradeInBattle'];
const actions={};
for(const name of ACTION_NAMES)if(typeof g[name]==='function')actions[name]=g[name];
actions.cancelSelection=cancelSelection;
if(typeof g.OPEN_PLAY_GUIDE==='function')actions.openGuide=g.OPEN_PLAY_GUIDE;
if(typeof g.SHOW_PLAY_TIP==='function')actions.showTip=g.SHOW_PLAY_TIP;
if(typeof g.RESET_PLAY_TIPS==='function')actions.resetGuideTips=g.RESET_PLAY_TIPS;
const QUERY_NAMES=['enemyRoster','endlessRoster','rewardInfo','rewardCandidates','effectiveAttack','statusText','cooldown','spiritCost','playerSkillRestriction','skillDetailMeta','replacementText',
 'spiritStats','critProfile','upgradeBudget','contractPrice','formatNum','handSpirit','maxHp','enemyHp','rankMultiplier','storyText','parseCooldowns','configuredEffects',
 'validImportedSlot','allEnemiesDefeated','weightedReward','skillDamage','dealSkillDamage','rollAttackDamage','skipEffect','blocksNegative','outgoingMultiplier','receivedMultiplier',
 'wardInfo','tuned','upgradeGhostRecord','initUnit','makeTestUnit','spirit','syncPlayerVitality','fullHeal','fullHealPlayerOnly','normalizeState','readSlots','writeSlots','clone','addSpirit','enemyHp'];
const query={};
for(const name of QUERY_NAMES)if(typeof g[name]==='function')query[name]=g[name];
query.difficultyOf=(s)=>lex('difficultyOf')?(s?difficultyOf(s):difficultyOf()):'easy';
query.unlockedSkills=(id,rank)=>g.GAME_DATA.unlockedSkills(id,rank);
query.grantTraining=(...a)=>lex('grantTraining')?grantTraining(...a):0;
const GC={
 get state(){return lex('state')},
 get battle(){const s=lex('state');return s?s.battle:null},
 get selection(){return {selected:lex('selected'),targetMode:lex('targetMode')}},
 get busy(){return !!lex('busy')},
 get slots(){return lex('slots')},
 get activeSlot(){return lex('activeSlot')},
 get preferences(){return lex('preferences')},
 GD:g.GAME_DATA,
 get SKILLS(){return lex('SKILLS')},
 get NODES(){return lex('NODES')},
 get STORY(){return lex('STORY')},
 get ENEMIES(){return lex('ENEMIES')},
 get ACT_ROWS(){return lex('ACT_ROWS')},
 get ML(){return g.MAINLINE_DATA||null},
 get BOSS_SKILLS(){return lex('BOSS_SKILLS')},
 get MODE_NAMES(){return lex('MODE_NAMES')},
 get DIFFICULTIES(){return lex('DIFFICULTIES')},
 get MAIN_KEYS(){return lex('MAIN_KEYS')},
 get PLAY_GUIDE(){return g.PLAY_GUIDE||null},
 get VFX(){return g.GHOST_VFX||null},
 actions,
 query,
 boot(){updateHud();renderHome()}
};
g.GC=GC;
})(globalThis);
