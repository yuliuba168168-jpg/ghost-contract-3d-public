# 方块版（只为测试游戏性）

入口 `simple.html`（双击 `启动方块版.cmd`，地址 http://127.0.0.1:8790/simple.html）。与完整版共用规则层、存档和全部面板，只换掉表现：

- 不创建 WebGL 画布，不加载 3D 场景、后期、粒子、全屏演出、技能视频；`simple.css` 关掉全部动画、过渡、模糊和阴影。
- `src/simple/main.js`：用空壳代替 `ctx.R / rig / props / opponent / lights / cine`，照常创建 `ui/screens.js`（经 `ctx.makeMapView`、`ctx.makeStoryStage` 注入方块版路线图和空的剧情实景；`ctx.simple` 让剧情恒用纯文字面板）。
- `src/simple/battle.js`：战斗整块 DOM 按状态重画（敌方 4 路、我方 4 路、命灯、鬼气、手牌、战况），操作与 `battle/battle-input.js` 等价：点手牌 → 点空位显形或点目标；点我方鬼灵出操作条（移动、技能、详情）；右键任意方块看详情；空格 / 回车结束回合，Esc 取消，数字键选手牌。演出只有高亮、飘字、一行字幕和短暂停顿（时长见 `WAIT`，受设置里的演出速度影响）。
- `src/simple/map.js`：路线图节点按行排成方块，可前往的节点高亮；香炉 / 魂瓮 / 招魂铃是三个按钮。
- 没有：新手引导（依赖 3D 坐标）、技能视频、对手黑影形象（台词保留，文案在 `battle/shadow-lines.js`）。
