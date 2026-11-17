# 鬼灵契约3D · 无界面规则引擎接口目录

适用加载顺序：`bridge → codex → vfx → app → polish → mainline-data → mainline → playability → facade`（经典脚本，共享 globalThis；后加载文件覆盖前文件的同名全局函数，本文档记录的是**覆盖链末端的真实行为**）。

规则代码与表现层的唯一通道是 `globalThis.GC_BRIDGE`。表现层可整体替换实现；每次调用时规则代码才读取 `GC_BRIDGE.xxx`。无界面运行时默认全部是空操作。

```js
GC_BRIDGE.fx(type, payload) -> Promise   // 演出事件
GC_BRIDGE.sync(reason)                  // 'battle' | 'hud'，状态已变请对齐
GC_BRIDGE.ui(screen, params)            // 请求显示界面；'close' = 关闭顶层
GC_BRIDGE.notify(text, kind)            // 'warn' | 'info'，替代旧 alert
```

约定：
- fx payload 是可 JSON 序列化的纯数据快照。
- 单位引用一律 `{uid, side:'ally'|'enemy', lane}`。我方单位在 `deployGhost` 时获得稳定唯一 uid（`p{ts}-{seq}-{id}`，含自增序号防同毫秒碰撞）。
- 需要 `await` 的事件：规则在该位置原本有 `await` 演出/延时。表现层 `fx()` 返回的 Promise 决议时机 = 动画播完的时机，可以据此做演出节奏。
- `sync` 是兜底：任何 `renderBattle()/refreshCombatCards()/updateHud()` 的旧调用点都换成了 `sync('battle'|'hud')`。

---

## 1. fx 事件目录

### 1.1 需要 `await` 的事件

| type | payload | 发出位置（函数 → 文件） |
|---|---|---|
| `battle:enter` | `{testMode, nodeId}` | `startBattle`（app.js 非主线、mainline.js 主线）、`startTestBattle`（polish.js）、`loadSlot` 恢复中战斗（mainline.js）。**注意：所有调用点都不 await 它**（旧版入场动画不阻塞输入） |
| `turn:start` | `{turn, qi, maxQi}` | `endTurn`（app.js）回合开始恢复鬼气后 |
| `draw` | `{count}`（实际新进手牌张数，可为 0） | `endTurn` 抽牌后（app.js）；`playSkill` 中 revive/relic/valhalla 抽牌后（app.js） |
| `deploy` | `{uid, id, lane, handIndex, cost, deployedCount}` | `deployGhost`（app.js） |
| `move` | `{uid, from, to, swapUid, cost}` | `moveSpirit`（app.js）。**先演出后落地**：事件发出时格子还没换 |
| `attack` | `{attacker:{uid,side,lane}, target:{uid,side,lane}, damage, critical, reductionPct, killed, targetHp, targetMaxHp}` | `attackAnim`（app.js），`endTurn` 敌我自动攻击、`resolveConfuse` 之外的所有普通攻击 |
| `direct` | `{attacker:{uid,side,lane}, damage, critical, outcome:'will'|'enemyWill'|'domain'|'love'|'dodge', redirect:{uid,side,lane}|null, will, enemyWill}` | `hitWill`/`hitEnemyWill`（app.js 非主线）、`mainDirectAttack`（mainline.js 主线直击） |
| `skill:cast` | `{name, source:{uid,side,lane}|null, targets:[{uid,side,lane}], theme, motion, scope}` | `GHOST_VFX.cast`（vfx.js）→ 由 `resolveExactSkill`/`resolveConfuse`（app.js）触发；theme/motion/scope 取自 `GHOST_VFX.definitions`，scope ∈ `self|target|enemies|allies|board` |
| `card:play` | `{cardId, handIndex, target:{uid,side,lane}|null, message}` | `playSkill`（app.js） |
| `playerSkill` | `{index, name, target:{uid,side,lane}}` | `usePlayerSkill`（app.js） |
| `boss:cast` | `{uid, lane, name, kind}` | `enemySkills`（mainline.js）首领放技能时；kind ∈ `slow|shield|summon|strike|mark|heal|rage|shift`，描述见 `BOSS_SKILLS[kind].desc` |
| `unit:skip` | `{uid, side, lane, label, reason:'freeze'|'skip'|'miss'|'spaceBlocked'}` | `endTurn`（app.js）：我方 skip、敌方冻结/skip/欺骗未命中/空间封锁 |
| `banner` | `{text, tone:'ally'|'enemy'|'gold'|'info'}` | 预留类型，当前无产出点（旧 flashText 已全部归类到更具体事件） |
| `deaths` | `{units:[{uid,side,lane}]}` | `animatePendingDeaths`（app.js）、`attackAnim` 击杀后 |
| `return` | `{uid, id, kind:'return'|'revive'|'rollback', handIndex}` | `playSkill` 鬼绳回手（app.js）、`cleanup` 时间回退复活、`reviveAll`/`reviveOne` |
| `enemy:return` | `{uid, lane}` | `advanceStatuses`（app.js）时间删除归位 |
| `status:tick` | `{uid, side, lane, kind:'burn'|'regen', label, value, hp, maxHp}` | `advanceStatuses`（app.js）：鬼火灼烧 / 水分身·神火回复 |
| `battle:win` | `{testMode}` | `winBattle`（app.js 非主线、mainline.js 主线，均 await） |
| `battle:lose` | `{testMode}` | `loseBattle`（app.js、mainline.js；均不 await，见下） |

### 1.2 不 `await` 的事件

| type | payload | 发出位置 |
|---|---|---|
| `react` | `{name, uid, side, lane, label}` | `GHOST_VFX.react`（vfx.js）——所有被动触发/状态脉冲调用点（app.js 内 `dealRawDamage`/`endTurn`/`hitWill`/`resolveExactSkill`/`advanceStatuses`/`cleanup`/`enemySkills` 等几十处） |
| `effect:expire` | `{uid, side, lane, key, label}` | `GHOST_VFX.expire`（vfx.js）→ `expireEffect`/`stripPositiveEffects` |
| `float` | `{target:{uid,side,lane}|'will'|'enemyWill'|null, text, kind:'damage'|'heal'|'info', critical}` | `attackAnim`、`hitWill`、`hitEnemyWill`、`mainDirectAttack`、`enemySkills` 首领 strike |
| `burst` | `{uid, side, lane, glyph, tone}`；uid 为 null 表示手牌/全场锚点 | `deployGhost`、`playSkill`、`usePlayerSkill`、`enemySkills`、`attackAnim`、`丰都鬼军` |
| `sound` | `{kind}` | `soundCue`（app.js）——kind 沿用旧版：`hit/deploy/draw/revive/skill/move/click/win/lose/upgrade/turn/reward` |

### 1.3 sync / ui / notify

- `sync('battle')`：旧 `renderBattle()`、`refreshCombatCards()` 的所有调用点（部署、移动、技能结算、状态推进、回手、回合推进等）。注意同一位置常常先有 awaited 事件再发 sync——都要处理。
- `sync('hud')`：旧 `updateHud()` 的所有调用点（含 `save()` 内部）。
- `notify(text,'warn')`：替代旧 `alert`：资源不足、目标非法（等级/生命/满血/冷却）、迷惑选错第二目标、存档写入失败提示等。**warn 不影响流程，动作函数已 return，未扣资源**。

---

## 2. ui 界面目录

screen 由 `GC_BRIDGE.ui(screen, params)` 发出；`close` 表示关闭顶层覆盖层。旧版每个界面就是一段 HTML+按钮绑定；下表列出旧界面展示的信息、数据来源（新 UI 自己取数）和可用动作。**所有动作函数被调用即执行（无确认框）**；按钮禁用条件按旧逻辑记录。

| screen | 发出函数 | params | 旧界面内容与数据来源 | 可用动作（签名 → 说明 / 前置条件） |
|---|---|---|---|---|
| `home` | `renderHome`（app/mainline 覆盖） | 无 | 标题、4 个存档槽（`slots[]`，含 name/mode/fallen/wave/updatedAt）、导出/导入、重置、图鉴、指南、设置 | `createSlotDialog(i)`；`loadSlot(i)`（槽存在且 !fallen）；`exportSlots()`/`exportSlotsData()` 返回 JSON 字符串；`importSlotsData(jsonText)` → `{ok,error?}`；`confirmReset()`；`renderCodex()`；`OPEN_PLAY_GUIDE(i)`；`presentationSettings()` |
| `slotDialog` | `createSlotDialog(i)` | `{index, occupied}` | 选模式（普通/极限/无尽）与命名 | `confirmNewSlot(i,mode,name)` → `newSlot`；`closeModal()` 取消 |
| `map` | `renderMap` | `{act}` | 当前 act、路线图（`ACT_ROWS[act]`）、节点完成/可达状态（`state.completed/state.available`）、资源栏（xp/will/鬼灵数） | `enterNode(id)`（id ∈ state.available 且 !busy 且 !pendingSettlement）；`openCollection()`；`journal()`；`openStoryArchive()`；`presentationSettings()` |
| `event` | `showEvent(id)` / 主线同名覆盖 | `{id}` | `NODES[id].title`、`STORY[NODES[id].story]` 全文 | 非主线：`continueEvent(id)`（应用 effect、completeNode）；主线：`continueMainlineEvent(id)`（幕首契约+训练补助、契约节点发放鬼灵） |
| `beforeBattle` | `showStoryBeforeBattle(id)` | `{id}` | 节点标题、预告剧情 `STORY[n.story]`、敌方预览 `enemyRoster(id)`（名称/等级/攻/血/首领技能） | `prepareBattle(id)`（进备战）；`beforeBattleUpgrade(id)`（普通/极限→修行面板，无尽→收藏升级）；`retreatToMap()` |
| `prepare` | `prepareBattle(id)`（polish） | `{id, defaultSquad:[id…]}` | 出战选择：最多 6 名存活鬼灵（`state.spirits` 中 !dead；默认 `state.squad` 或前 6 名） | `confirmSquad(id,ids)`（1≤ids≤6，否则 notify）；`prepareManageCards(id)`（开收藏后返回）；`cancelPrepare()` |
| `battle` | `startBattle`/`startTestBattle`/`loadSlot` | 无（自行取 `state.battle`） | 见 §3 状态机；手牌 `b.hand`（鬼灵 id 字符串、`{kind:'ghost',unit}`、卡 id 字符串混合）、`b.units[4]`、`b.enemies`、`b.qi/b.maxQi`、`b.will/b.enemyWill`、`b.log` | 全部战斗输入（§3）；非战斗按钮：`openBattleUpgrade()`（仅无尽）、`showBattleDetails(sel)`、`OPEN_PLAY_GUIDE()`、测试模式 `exitTestBattle()`/`exitTestToHome()` |
| `battleDetail` | `showBattleDetails(sel)` | `sel`（{kind:'unit',lane} 或 {kind:'enemy',uid} 等选择快照） | 单位详情：名字/等级/原攻(`baseAtk`)/当前攻击(`effectiveAttack(u)`)/生命/冷却(`cooldown`)/状态(`statusText`)/技能列表(`GD.unlockedSkills`+`skillDetailMeta`) | 选中我方单位时：`moveSpirit(-1|1)`、`exactSpiritSkill(name)`；禁用：busy、cooldown>0、qi<cost、被动技 |
| `rewards` | `rollRewardCandidates`（polish 覆盖） | 无（取 `state.pendingReward`） | 三选一卡牌：`pendingReward.candidates`（卡 id→`SKILLS[id]`）、剩余轮次 `remaining` | `chooseReward(i)`（牌组<25 直接入组；=25 转 `rewardReplace`）；`skipRewards()`/`finishRewards()` 放弃剩余 |
| `rewardReplace` | `chooseReward`（deck=25 时） | 无（`pendingReward.pendingPick`） | 新卡 vs 现有 25 张牌组列表 | `replaceReward(i)`（替换第 i 张）；`cancelRewardReplace()` 退回三选一 |
| `collection` | `openCollection(back)`（polish 覆盖；`collectionReturn` 回调） | 无 | 鬼灵列表 `state.spirits`、牌组 `state.deck`（≤25）、支援契约 `state.supportContracts` | `showOwnedSpirit(i)`；`removeDeckCard(i)`（直接移除，无返还）；`showContractTrials()`；`closeCollection()` 回 `back` |
| `ownedSpirit` | `showOwnedSpirit(i)` | `{index:i}` | 鬼灵详情同 battleDetail + `upgradeBudget`、`spiritStats`、`critProfile`、`unlockedSkills` 各等级解锁 | `upgradeOwnedSpirit(i)`（xp ≥ `GD.ranks[s.rankIndex].upgradeXp` 且非 nannan；战斗中仅无尽可用→`upgradeInBattle(i)`） |
| `contractTrials` | `showContractTrials` | 无 | 全部 `GD.spirits` 图鉴 + 契约价 `contractPrice(c)`（初始等级 killXp，nannan=1000000） | `contractSpirit(id)`（xp 不足返回 false）；`closeContractTrials()` |
| `emergencyRest` | `emergencyRest(done)` | 无 | 无存活鬼灵时的紧急营地 | `acceptEmergencyRest()`（全队回 10%、will 满，然后执行 done 回调界面） |
| `camp` | `showCamp(id)` | `{id, used?}`（app 版含 used；主线版 fullHeal 后发 `{id}`） | 篝火：恢复、补给、升级、整理、离开（主线版已自动全恢复） | 非主线：`campHeal(id)`/`campSearchCards(id)`/`campUpgrade(id)`/`campLeave(id)`，各项每篝火一次（`state.campChoices[id]`）；主线：`campManage(id)`、`campTraining(id)`、`campLeave(id)` |
| `upgradeChoice` | `upgradeChoice(campId)` | `{campId}` | 选鬼灵升级（同 ownedSpirit 数据） | `upgradeAtCamp(i,campId)` |
| `training` | `showTraining(arc,back)`、`trainingHeal` | `{arc}` | 修行面板：本幕补助（`grantTraining(arc)`，每幕一次，4 名非 nannan 鬼灵升级预算）、当前 xp、推荐培养 | `trainTeam(arc)`（自动升到本幕等级）；`trainingHeal()`（全队回满）；`trainingManage()`（开收藏后返回）；`trainingClose()` |
| `rewardNode` | `showRewardNode(id)` | app `{id}`；主线 `{id,xp}` | 奖励节点：剧情 + 经验数 + 卡牌轮数 | 非主线 `claimRewardNode(id)`（2 轮三选一）；主线 `claimInvestigation(id)`（xp + 1 轮）、`rewardManage(id)` |
| `settlement` | `renderSettlement`（主线） | 无（取 `state.pendingSettlement`） | 战胜结算：`{node,title,xp,cards,remaining,candidates,wave?}`，三选一牌 | `pickSettlementCard(i)`（deck<25→`chooseSettlementCard(i)`；=25→`settlementReplace`）；`discardSettlementRewards()`；`settlementManage()`；`finishSettlement()`（要求 remaining≤0；无尽 wave+1） |
| `settlementReplace` | `showSettlementReplacement(index)` | `{index}` | 同上替换流 | `chooseSettlementCard(index, replaceIndex)`；`cancelSettlementReplace()` |
| `defeat` | `loseBattle` | app `{nodeId}`；主线 `{mode:'normal',checkpoint}` | 失败画面：普通模式已回滚篝火 | `retryBattle(id)`（非主线）；`continueFromDefeat()`；`returnToTitle()` |
| `fallen` | `loseBattle`（极限/无尽） | `{mode,wave}` | 团灭：存档标记 fallen | `returnToTitle()`（loadSlot 会拒绝 fallen 槽） |
| `ending` | `showEnding` | 无 | 尾声剧情 `STORY['main-ending']`（或旧版 `ending` 节点） | `readEndingAct()`（打开第 28 幕阅读器）；`finishEnding()` |
| `storyArchive` | `openStoryArchive(back)` | 无 | 28 幕列表 `ML.arcs`（剧透警告） | `viewArchiveAct(i)`；`closeStoryArchive()` |
| `archiveAct` | `viewArchiveAct(i)` | `{arc}` | 该幕 summary + 正文入口 | `openReader(arc,back)`；返回 `storyArchive` |
| `reader` | `openReader`/`readerPage` | `{arc, page}` | 小说分页 `ML.arcs[arc].pages[page]` | `readerPage(±1)`（0..pages.length-1 夹取）；`closeReader()` |
| `endless` | `renderEndless` | 无 | 无尽大厅：波次 `state.wave`、本波敌人 `endlessRoster()`、全部鬼灵列表 | `prepareBattle('endless-arena')`/`startBattle('endless-arena')`；`openCollection()`（升级）；`returnToTitle()` |
| `battleUpgrade` | `openBattleUpgrade` | 无 | 无尽战斗内升级面板（鬼灵列表+费用 `upgradeBudget`） | `upgradeInBattle(i)`（xp 足够；场上/手牌/牌库/墓地同 id 单位同步升级满血）；`closeBattleUpgrade()` |
| `testLab` | `renderTestLab(cfg)` | 无（cfg 存 `lastTestConfig`） | 测试台配置（`defaultTestConfig()`：双方各 6 行 + 攻血/等级/潜力/位置/冷却/效果/手牌/牌库/鬼气/生命） | `startTestBattle(cfg)`（校验：双方各≥1、敌 pos 唯一、我方 id 不重复，否则 notify 不开始）；战斗中 `exitTestBattle()`/`exitTestToHome()` |
| `testEnd` | testMode 胜负 | `{result:'win'|'lose'}` | 测试结束 | `exitTestBattle()` 回测试台；`exitTestToHome()` |
| `journal` | `journal` | 无 | `state.log`（最近 250 条） | 只读 |
| `settings` | `presentationSettings` | 无 | `preferences {speed,sound,reduceFlash}` + 指南提示开关 + 音量 | `applyPresentationSettings({speed?,sound?,reduceFlash?,volume?,guideHints?})`；`RESET_PLAY_TIPS()` |
| `confirmReset` | `confirmReset` | 无 | 重置确认 | `resetCampaign()`（state=DEFAULT） |
| `tip` | `SHOW_PLAY_TIP(index,force)`（首次自动触发） | `{index,title,text}` | 首次操作提示（`PLAY_GUIDE` 26 条） | 关闭即可；`seen` 存 `youqi-guide-v1` |
| `guide` | `OPEN_PLAY_GUIDE(index)` | `{index}` | 完整操作指南 26 条 | 翻页由 UI 自行实现（数据在 `GC.PLAY_GUIDE`） |
| `codex` | `renderCodex` | 无 | 图鉴：全部 `GD.spirits` + `GD.cards` + 等级表 | `showCodexSpirit(id)` |
| `codexSpirit` | `showCodexSpirit(id)` | `{id}` | 单个鬼灵全等级解锁/数值 | 只读 |
| `close` | `closeModal` | 无 | 关闭顶层覆盖 | — |

---

## 3. 战斗输入状态机

全局：`selected`、`targetMode`、`busy`（`GC.selection` / `GC.busy` 可读）。`busy=true` 时全部输入函数直接 return；所有 async 输入都在 finally 复位 busy。

`selected` 取值：
- `null`
- `{kind:'hand', index, id}` —— 手牌第 index 张被点选；id 仅在卡牌时为卡 id（鬼灵时 null）
- `{kind:'unit', lane}` —— 我方场上 lane 路单位被选中
- `{kind:'playerSkill', index}` —— 御鬼者技能 index 被选中

`targetMode` 取值：
- `null`
- `'deploy'` —— 手牌鬼灵待部署，等 `allyLane(lane)`
- `'ally'` / `'enemy'` —— 手牌卡牌待选目标（= `SKILLS[id].target`）
- `'player:N'` —— 御鬼者技能 N 待选我方目标
- `'exactEnemy:NAME'` —— 鬼灵主动技 NAME 待选敌方目标
- `'exactAlly:NAME'` —— 待选我方目标
- `'confuseSecond:UID'` —— 迷惑已选第一目标 UID，待选被攻击的第二敌人

流转（入口 → 条件 → 结果）：

| 入口 | 前置 | 结果 |
|---|---|---|
| `selectHand(i)` | !busy；hand[i] 是鬼灵 | selected=hand，targetMode='deploy' |
|  | hand[i] 是卡且 target='none'/'grave' | 直接 `playSkill(i,-1)` |
|  | hand[i] 是卡 target='ally'/'enemy' | selected=hand，targetMode=卡 target |
| `allyLane(lane)` | targetMode='deploy' 且 units[lane] 空 | `deployGhost(index,lane)`（qi≥deployedCount+1） |
|  | targetMode='ally' | `playSkill(index,lane)` |
|  | targetMode='player:N' | `usePlayerSkill(N,lane)` |
| `allyTarget(lane)` | 同 allyLane 前三条 | 同上 |
|  | targetMode='exactAlly:NAME' | `resolveExactSkill(NAME, units[lane])` |
|  | 无 targetMode | selected={kind:'unit',lane} |
| `enemyTarget(uid)` | targetMode='exactEnemy:NAME' | `resolveExactSkill(NAME, 敌)` |
|  | targetMode='confuseSecond:UID' | `resolveConfuse(UID, 敌)`（UID≠敌.uid 否则 notify 重新选） |
|  | hand 卡 target='enemy' | `playSkill(index, 敌.lane)`（旧版即如此，实际无敌方目标卡） |
| `exactSpiritSkill(name)` | selected.unit 存在、非被动、无冷却、qi≥cost | 目标类→对应 targetMode；无目标→直接 `resolveExactSkill(name,null)` |
| `resolveExactSkill('迷惑',e)` | — | 第一次：targetMode='confuseSecond:e.uid'；第二次 enemyTarget→`resolveConfuse` |
| `selectPlayerSkill(i)` | !playerSkillsUsed[i] | selected=playerSkill，targetMode='player:i' |
| `usePlayerSkill(i,lane)` | units[lane] 存在、restriction=''（等级≥10/13/17）、will>40%（技能0） | 应用效果、标记已用、清空选择 |
| `moveSpirit(±1)` | selected.unit | 邻格空→耗1鬼气移动；有友军→免费换位；选择跟随 |
| `playSkill(index,targetLane)` | 卡、qi≥cost、target='ally'时 units[lane] 存在 | 结算（relic 无墓地→notify 不扣费） |
| `endTurn()` | !busy | 我方按路攻击/直击 → 首领技能 → 敌方行动 → 状态结算 → 新回合回气抽牌（turn:start/draw） |
| `cancelSelection()` | !busy（facade 提供） | selected/targetMode 清空 + sync('battle') |

无目标主动技集合（`resolveExactSkill(name,null)`）：形态类、鬼瞳、无解防御、领域开关（鬼域/英灵领域/伞域）、鬼绣球、伞分身、虚化、火凤系、女王领域、金字塔镇压、水分身、无象灵水躯、鬼门关降临、幻影蝶翼、云梦泽、冰雪、欺骗、绝望、轮回、太阴之力。
敌方目标集 `ENEMY_TARGET_SKILLS`：寒冰右手、鬼火(+)、55开(+)、画卷绝杀、解析系、时间梦境、丰都鬼军、寂灭蝶珠、入梦(+)、时间删除、迷惑、空间规律(+)、鬼主权杖。
我方目标集 `ALLY_TARGET_SKILLS`：白虎驱邪纹(+)、时间回退。

---

## 4. GC 门面（facade.js）

只读视图（live getter，跟随全局绑定）：`GC.state`、`GC.battle`、`GC.selection={selected,targetMode}`、`GC.busy`、`GC.slots`、`GC.activeSlot`、`GC.preferences`。
数据表：`GC.GD`(GAME_DATA)、`GC.SKILLS`、`GC.NODES`、`GC.STORY`、`GC.ENEMIES`、`GC.ACT_ROWS`、`GC.ML`(MAINLINE_DATA)、`GC.BOSS_SKILLS`、`GC.MODE_NAMES`、`GC.MAIN_KEYS`、`GC.PLAY_GUIDE`、`GC.VFX`(GHOST_VFX)。
`GC.boot()`：表现层就绪后调用，等价旧启动（updateHud + renderHome → `ui('home')`）。
`__CAMPAIGN_TEST__`、`__MAINLINE_TEST__` 原样保留。

### GC.actions（同名直挂全局函数）

战斗输入：`selectHand allyLane allyTarget enemyTarget exactSpiritSkill selectPlayerSkill usePlayerSkill moveSpirit playSkill deployGhost endTurn cancelSelection`
流程/界面：`renderHome renderMap renderCodex showCodexSpirit renderTestLab renderEndless renderSettlement showSettlementReplacement pickSettlementCard chooseSettlementCard cancelSettlementReplace discardSettlementRewards settlementManage finishSettlement enterNode showEvent continueEvent continueMainlineEvent showStoryBeforeBattle beforeBattleUpgrade prepareBattle confirmSquad cancelPrepare prepareManageCards startBattle retryBattle retreatToMap continueFromDefeat returnToTitle showCamp campHeal campSearchCards campUpgrade campLeave campManage campTraining upgradeChoice upgradeAtCamp showRewardNode claimRewardNode claimInvestigation rewardManage chooseReward replaceReward cancelRewardReplace skipRewards showEnding finishEnding readEndingAct openStoryArchive viewArchiveAct closeStoryArchive openReader readerPage closeReader openCollection closeCollection removeDeckCard showOwnedSpirit upgradeOwnedSpirit showContractTrials contractSpirit closeContractTrials emergencyRest acceptEmergencyRest createSlotDialog confirmNewSlot newSlot loadSlot exportSlots exportSlotsData importSlotsData journal presentationSettings applyPresentationSettings confirmReset resetCampaign showTraining trainTeam trainingHeal trainingManage trainingClose startTestBattle exitTestBattle exitTestToHome defaultTestConfig showBattleDetails openBattleUpgrade closeBattleUpgrade upgradeInBattle openGuide showTip resetGuideTips`

### GC.query

`enemyRoster endlessRoster rewardInfo rewardCandidates effectiveAttack statusText cooldown spiritCost playerSkillRestriction skillDetailMeta replacementText spiritStats critProfile upgradeBudget contractPrice formatNum handSpirit maxHp enemyHp rankMultiplier storyText parseCooldowns configuredEffects validImportedSlot allEnemiesDefeated weightedReward skillDamage dealSkillDamage rollAttackDamage skipEffect blocksNegative outgoingMultiplier receivedMultiplier upgradeGhostRecord initUnit makeTestUnit spirit syncPlayerVitality fullHeal fullHealPlayerOnly normalizeState readSlots writeSlots clone addSpirit unlockedSkills grantTraining`

---

## 5. 分叉过程中发现的疑似缺陷 / 含义不明（仅记录，规则未改）

1. **`allyLane` 与 `allyTarget` 职责重叠**：两者都能消化 'ally' 卡目标与 'player:N'，旧版 DOM 里"点格子"和"点单位"是两条路径；新 UI 可合并为"点我方区域"。
2. **`enemyTarget` 的卡目标路径是死代码**：`playSkill` 永远用 `b.units[targetLane]` 查我方单位，而 14 张卡没有 target='enemy' 的——旧版即如此。
3. **非主线 `hitWill` 未夹取 will**：`b.will-=damage` 可成负数（主线 `mainDirectAttack` 夹到 0）；结算只看 ≤0，行为等价但 UI 显示值不同。
4. **`startBattle` 非主线 `enemyWill=Math.max(...enemy maxHp)`**：敌人总血上限当敌方生命，与主线固定 10 不一致——旧版如此。
5. **`deployGhost` uid 原为 `p{Date.now()}-{id}`**，同毫秒重复部署同 id 会撞 uid；分叉版加了自增序号（`p{ts}-{seq}-{id}`），这是唯一有意的实现级加固，规则无影响。
6. **`resolveExactSkill('55开')`**：`copiedAttack` 记录的是释放时点的 `effectiveAttack(target)` 快照；`u.hp` 取 `min(target.hp, 新maxHp)`——语义照搬。
7. **`playSkill` 的 relic（鬼舍利）**：无阵亡时 notify 后直接 return，**不扣鬼气**（`b.qi-=c.cost` 在其后）。
8. **`showRewards` 双实现**：app 版在牌组满 25 时直接跳过奖励；polish 版走 pendingPick 替换流。加载链上 polish 覆盖 app，真实行为是后者。
9. **`endTurn` 主线包装**：每个回合开始把 state 快照进 `roundSnapshot` 供 `save()` 写槽——回合中断续玩回到回合开始前。`save()` 在 `busy` 中也会执行（写快照而非战局）。
10. **`usePlayerSkill` 神火（i=2）重复校验**：`playerSkillRestriction` 已查 rank≥17，函数体内又查一次 `(u.rankIndex??0)<17`——旧版双保险，保留。
11. **`enemySkills` 首领 'slow'** 用 `e.lastStopped` 避免连续封锁同一单位，存的是我方 uid。
12. **`advanceStatuses` 手牌冷却**：只对 `initialized` 的手牌单位 tick（回手/复活单位才 initialized）。
13. **`importSlotsData` 会整体替换四档**并把 state 重置为 DEFAULT、activeSlot=null。
14. **`GC.selection` 中 `selected` 是活对象引用**（`confuseFirst` 会被原地写入）；只读使用。
15. **`startTestBattle` 的 allies `pos` 字段被忽略**：测试鬼灵一律从手牌开始（`units` 全空）。
16. **卡牌 `revive` 抽牌数含 `b.revivedCount` 加成**，`card:play` 后若属 revive/relic/valhalla 还会再发一次 `draw` 事件（含本次抽牌差值，最小 1）。
17. **`updateHud`（mainline 覆盖）把非战斗 will 夹回 ≤10**：无尽受伤续存只影响鬼灵 hp，玩家生命每波回满。
