/*
 * GC_BRIDGE — 规则引擎与表现层之间的唯一通道。
 * 规则代码不触碰任何 DOM / 定时器 / 音频，全部表现点收敛为以下四类调用。
 * 表现层（Three.js 3D 桌面对战）可整体替换 globalThis.GC_BRIDGE 实现。
 *
 * fx(type, payload)   演出事件，返回 Promise。
 *   规则在旧代码 await 演出/延时处 await 它；未等待处不 await。
 *   payload 必须是可 JSON 序列化的纯数据快照；单位引用一律 {uid, side:'ally'|'enemy', lane}。
 *
 *   需要 await 的事件（调用点位于 async 函数内）：
 *   - 'battle:enter'  {testMode, nodeId}                 开场幕布（原 playBattleEntrance；调用方多数不 await，见 engine-api）
 *   - 'turn:start'    {turn, qi, maxQi}                  回合横幅（原 animateTurnBanner）
 *   - 'draw'          {count}                            新进手牌张数（原 animateNewHandCards）
 *   - 'deploy'        {uid, id, lane, handIndex, cost, deployedCount}  部署飞牌
 *   - 'move'          {uid, from, to, swapUid, cost}     移动/换位（先演出，状态在 await 之后落地）
 *   - 'attack'        {attacker:{uid,side,lane}, target:{uid,side,lane}, damage, critical, reductionPct, killed, targetHp, targetMaxHp}
 *   - 'direct'        {attacker:{uid,side,lane}, damage, critical, outcome:'will'|'enemyWill'|'domain'|'love'|'dodge'|'spaceBlocked', redirect:{uid,side,lane}|null, will, enemyWill}
 *   - 'skill:cast'    {name, source:{uid,side,lane}|null, targets:[{uid,side,lane}], theme, motion, scope}
 *   - 'card:play'     {cardId, handIndex, target:{uid,side,lane}|null, message}
 *   - 'playerSkill'   {index, name, target:{uid,side,lane}}
 *   - 'boss:cast'     {uid, lane, name, kind}            首领技能提示（kind 见 BOSS_SKILLS）
 *   - 'unit:skip'     {uid, side, lane, label, reason:'freeze'|'skip'|'miss'|'spaceBlocked'}
 *   - 'banner'        {text, tone:'ally'|'enemy'|'gold'|'info'}   通用横条（预留，当前无产出点）
 *   - 'deaths'        {units:[{uid,side,lane}]}          一批单位死亡消散
 *   - 'return'        {uid, id, kind:'return'|'revive'|'rollback', handIndex}
 *   - 'enemy:return'  {uid, lane}                        时间删除归位
 *   - 'status:tick'   {uid, side, lane, kind:'burn'|'regen', label, value, hp, maxHp}
 *   - 'battle:win' / 'battle:lose'  {testMode}
 *
 *   不 await 的事件：
 *   - 'react'         {name, uid, side, lane, label}     状态图标脉冲（原 GHOST_VFX.react）
 *   - 'effect:expire' {uid, side, lane, key, label}      效果到期（原 GHOST_VFX.expire）
 *   - 'float'         {target:{uid,side,lane}|'will'|'enemyWill'|null, text, kind:'damage'|'heal'|'info', critical}
 *   - 'burst'         {uid, side, lane, glyph, tone}     粒子迸发；uid 为 null 时表示手牌/全场锚点
 *   - 'sound'         {kind}                             音效提示（kind 沿用旧版：hit/deploy/draw/revive/skill/move/click/win/lose/upgrade/turn/reward）
 *
 * sync(reason)        状态已变，请表现层按 state 对齐。reason: 'battle' | 'hud'
 * ui(screen, params)  请求显示界面；screen 目录见 docs/engine-api.md。'close' 表示关闭顶层界面。
 * notify(text, kind)  轻提示，kind: 'warn' | 'info'（替代旧 alert，不附带确认逻辑）
 */
globalThis.GC_BRIDGE = globalThis.GC_BRIDGE || {
  fx(type, payload) { return Promise.resolve(); },
  sync(reason) {},
  ui(screen, params) {},
  notify(text, kind) {}
};
