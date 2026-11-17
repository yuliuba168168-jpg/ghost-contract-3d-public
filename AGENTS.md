# 鬼灵契约3D —— 工程说明

旧 2D 网页卡牌战役《全球诡异时代·鬼灵契约》的 3D 重制。规则沿用旧版（`src/rules/`，无界面规则引擎），表现层用 Three.js 全新编写（`src/app/`）。旧版的 UI 与美术（深绿+旧金“幽冥卷轴”）不得沿用。

## 运行

- 双击 `启动游戏.cmd`，或 `node serve.cjs` 后打开 http://127.0.0.1:8790/ （需要 Node.js；不能直接双击 index.html，ES 模块需要 HTTP）。
- 无打包器：`index.html` + import map。three 0.187.0 已复制到 `vendor/three/`，运行时不依赖 `node_modules`。后期用到的附加文件（均从 node_modules/three 0.187.0 原样复制，版本核对一致）：`examples/jsm/postprocessing/{GTAOPass,BokehPass}.js`、`shaders/{GTAOShader,PoissonDenoiseShader,BokehShader}.js`、`math/SimplexNoise.js`。
- 存档在该地址的 localStorage（键 `youqi-mainline-slots-v2` 及 `-backup`），与旧版不同源，互不影响；迁移用标题页导出／导入。

## 目录

```
src/rules/     规则引擎（经典脚本，共享 globalThis，禁止 DOM）。详见 docs/engine-api.md
src/app/
  main.js            启动；ctx 对象 + 事件钩子 ctx.on/emit
  bridge-impl.js     GC_BRIDGE 实现：sync→视图，fx→director，ui→screens
  core/              renderer(后期链) loop tween input(射线拾取) audio(WebAudio 合成) assets quality
  scene/             room table props(命灯/香炉/招魂铃/牌堆/魂瓮/三法器) opponent(黑雾人影：域扭曲 fbm 剪影 + 飘散烟团 + 一双火焰之眼，play() 动画) atmosphere lights camera-rig textures
  cards/             card-face(canvas 卡面) card-mesh(3D 卡) apparition(灵体广告牌着色器)
  battle/            battle-view(按 uid 对齐) hand-view director(fx 事件编排) battle-input status-view board-layout
  fx/                flame(共享火焰着色器：createFlame/createEyePair，含自然眨眼) particles skill-fx(按 motion 分类的技能演出) overlay(飘字/横幅/提示) emblems skill-sig
  ui/                screens(全部界面) map-view(桌面路线图) guide-data(26 条指南)
  styles/            base.css ui.css
tools/         build_assets.py(素材抠图) shot.cjs play.cjs e2e.cjs skills_run.cjs tour.cjs opp.cjs(对手黑影审查截图) ward.cjs(鬼障截图) eyes.cjs(火焰眼特写) real.cjs(写实化前后对照截图：before|after)
assets/gen/    管线产物（views 抠图、art 卡面、manifest.json）
tests/         7 个规则测试（.cjs，无依赖）
```

规则脚本加载顺序固定：`bridge → codex → vfx → app → polish → mainline-data → mainline-data-2 → mainline → playability → facade`。

主线共 46 幕：1–28 幕在 `mainline-data.js`（原样），29–46 幕（原著第二部 201–556 章）由 `py tools\extract_book2.py` + `py tools\build_story.py` 生成 `mainline-data-2.js`（章节提取稿在 `story-source/`）。难度五档（简单/普通/困难/噩梦/禁忌）定义在 `mainline.js` 的 `DIFFICULTIES`，敌方技能在 `bossKind`/`BOSS_DESCS`；双方命灯上限取出战鬼灵最高生命（至少 10），敌方命灯随难度加厚。技能专属演出在 `src/app/fx/skill-sig.js`（图腾在 `emblems.js`）。后加载文件覆盖前面的同名全局函数，改规则必须按覆盖链理解真实行为。

## 验证命令（PowerShell）

```powershell
# 规则测试，全部应 PASS；平衡测试必须是 "1120 seeded ... worst 5 rounds"
foreach($t in 'campaign_test','campaign_polish_test','mainline_test','playability_test','mainline_balance_test','battle_loop_test','skill_smoke_test'){ node "tests\$t.cjs" }
node tools\shot.cjs --fps battle        # 静态截图 + 5 秒帧率；可选 title battle_low battle_mobile cards apparitions
node tools\play.cjs battle              # 演武战一回合，过程截图
node tools\e2e.cjs 3                    # 真实鼠标点击自动打主线到第 3 幕；--noshots；--mode=无尽
node tools\skills_run.cjs               # 22 名鬼灵全部主动技能 + 卡牌 + 御鬼者技能在浏览器里各放一次
node tools\tour.cjs                     # 各界面与 844×390 横屏截图
node tests\difficulty_test.cjs 1        # 两个机器人跑完整 46 幕 × 5 难度（约 4 分钟），校验难度阶梯
node tools\flows.cjs                    # 浏览器里验证：难度选择/调整、失败回篝火、极限终局、导入导出、满牌替换、终幕战
py tools\build_assets.py                # 重建 assets/gen（只读接手包）
```

截图工具用 puppeteer-core 25.16.0 驱动本机 Edge（`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`，`--headless=new --use-angle=d3d11 --ignore-gpu-blocklist --enable-gpu`，真实核显可用）。脚本会自动起 `serve.cjs` 并让它保持运行。`?dev=battle|cards|apparitions|title` 是开发场景，`?q=low|medium|high` 强制画质。

## 环境坑（Windows）

- 默认 shell 是 PowerShell；`npm` 写成 `npm.cmd`；Python 用 `py`（直接敲 `python` 是坏的）；没有 git。
- PowerShell 按 GBK 读 UTF-8 会显示乱码，文件本身没问题。
- 接手包 `单机版AI接手包_2026-11-04` 只读，任何文件不许修改或在其中生成文件。

## 约定

- `src/rules/*.js`（除 mainline-data.js）不得出现 DOM/`alert`/`HAS_DOM`；一切表现走 `globalThis.GC_BRIDGE`。
- 规则不可变：数值、公式、概率、`Math.random` 调用顺序、存档结构与旧版等价。用户确认的规则改动：主线起手 7 张 → 6 张；命灯上限改为出战鬼灵最高生命（空路直击上限相应改为对方命灯的两成）；新增难度系统与敌方技能；主线补到 46 幕并让 22 名鬼灵全部可在主线契约。
- awaited 的 fx 事件期间 `battle-view` 暂停自动对齐（hold/release），事件处理函数自己负责把相关实体落到最终状态。
- 只用接手包里的现成美术；无素材的 8 名鬼灵用印章卡面 + 无相灵体，不套用别人的图。模型、贴图、音效全部程序化生成。
- 性能（基准机 Intel Iris Xe，屏幕 2520×1680 @150% 缩放 = 1680×1120 CSS 像素、devicePixelRatio 1.5）：
- 画质档位 cinema(默认)/high/medium/low 定义在 `core/quality.js`（存档键 `gc3d-quality-v3`），每档是**像素预算**而不是固定 dpr（cinema 约 4.2e6、minScale .85）；cinema/high 开 GTAO 环境遮蔽 + 景深 + 2 盏烛光点光源阴影（cinema 2048 阴影图），medium/low 关闭这些重效果。`core/renderer.js` 的 tuner 按帧时间在 `minScale..1` 之间升降渲染分辨率，降到底仍不足才降一档。
- 始终走 EffectComposer：场景 → GTAO → 景深(BokehPass) → 泛光（高阈值、降分辨率，只让火焰芯/眼睛溢出）→ 调色（同一遍里做降饱和/冷暗暖亮分离色调、色调映射、颗粒和 sRGB 输出）。画布不开 MSAA、不要深度缓冲。GTAO/景深的深度通道用 overrideMaterial 渲染，`renderer.js` 的 `withoutFx` 会在这两个 pass 里临时隐藏所有半透明/着色器/精灵物体；需要在景深里保持清晰但本身是半透明的物体（黑影）带一个 `userData.dofProxy` 的不可见代理网格（仅景深深度通道里显示）。绝望/权杖等调色效果在 low 档也生效。写实化约定：光源只有烛火/月光/灯笼；环境图由 `lights.bakeEnvironment()` 用房间本身烘焙；PBR 程序贴图（法线/粗糙度）在 `scene/textures.js`（`plasterTextures` `metalTextures` `clayTextures` `woodTextures` 等）；火焰一律 `fx/flame.js` 的 `createFlame`。`director.warmup()` 会把相机依次扫过所有机位以编译只在特定机位可见的材质。
  - **不要随手 `material.dispose()` 自定义 ShaderMaterial**：three 在最后一个材质销毁时释放着色器，下次施放要重新编译（ANGLE/D3D 上每次几十到上百毫秒）。现有做法：`renderer.js` 渲染后把所有 program 的 `usedTimes` +1 钉住；光柱材质走对象池；灵体保留一个 keeper 材质；`director.warmup()` 在启动遮罩后面把战斗特效各放一次。`node tools\perf.cjs programs` 应显示战斗各步骤 `shader links during step: 0`。
  - 阴影贴图隔帧更新（`shadowEvery`）；弹出面板时 3D 每 3 帧渲染一次；DOM 标签只在位置变化时写样式。
  - 测量：`node tools\perf.cjs battle turn skill title map`（关垂直同步看真实余量，加 `--vsync` 看 60Hz 实际表现，`--q=low`、`--toggles`）；`node tools\glprof.cjs` 找阻塞主线程的 GL 调用；`node tools\tune_check.cjs` 校验分辨率控制器。**测量前确认没有别的窗口在占 GPU**（用户自己开着游戏页时数字会偏低且抖动很大）。

- 剧情实景模式下自动化：`tools/play.cjs` 的 `clickText/has` 会先自动推进 `.story-bar`（跳过逐字显现、点下一页）再找按钮；战斗节点会先出战书碎纸，需点查看敌情才进入战前情报；`node tools\e2e.cjs 3 --noshots`（默认实景）与 `--story=plain` 两种模式都应通过。
- 路线图 `ui/map-view.js`：无纸，节点=鬼火+焦痕，路径=贴桌光迹着色器，玩家=真火沿贝塞尔飘行；8 盏点光池常驻场景（不要增减灯数，否则全场重编译）。剧情实景 `ui/story-stage.js`：碎纸血字 / 香灰显字 / 烛影纸屏，按钮是 DOM `.story-bar`，设置项 `localStorage['gc3d-story-mode']` = stage | plain。截图工具 `tools/mapshot.cjs`、`tools/storyshot.cjs`。
- HUD 标签（`makeLabel`）在图层 1，后期链之后单独绘制，不受景深/泛光影响。
- 全屏技能演出：`fx/cinematic.js`（叠加场景，`core/renderer.js` 的 OverlayPass 画在 GTAO/景深之后、泛光/调色之前；演出期间 `R.hud=false` 隐藏 HUD 标签层）+ `fx/skill-tier.js`（分级表，逐个技能由用户定，勿改）。四级：1 快闪窄带 / 2 斜切画幅 / 3 全幕 / 4 七个绝技专属场面。模式 `localStorage['gc3d-cine-mode']`=full|smart|table，设置面板、战斗右上角「演出」按钮、键盘 V 均可切换；点击/空格/回车跳过。director 在 skill:cast / card:play / playerSkill / boss:cast 里 `await ctx.cine.play(req)`（1 级不阻塞，2 级播到 60% 交棒，3/4 级播完）。验收截图 `node tools\cine.cjs`（用 `cine.freeze/seek` 定格取帧）；`GC_CINE=table node tools\skills_run.cjs` 可跑仅牌桌模式。
- 路线图相机 `map` 为斜俯视；3D HUD 标签只在战斗界面显示（`screens.setBase` 设置 `R.hud`）。
- 4 级绝技中 鬼主权杖/太阴之力/轮回/鬼门关降临/女王领域/半完全火焰规律 是 `fx/cine-scenes.js` 里的独立 THREE.Scene（实体几何 + PBR 程序贴图 + 灯光 + 粒子），演出时 `R.useScene(scene, camera)` 把 RenderPass/GTAO/景深临时切过去（`R.useScene(null)` 恢复）；绝望仍是对牌桌画面的叠加处理。3 级整屏另经 `R.distort`（DistortShader：热浪/波纹/碎镜/时间波纹/洇开）做屏幕空间扭曲。竖排标题按 4 字一列分栏，立绘 3/4 级优先用 `views` 抠图。验收：`node tools\cine.cjs`（含真实施放 3 组）。

## 扩展层（2026-11-17，用户要求的内容扩充，规则有意改动）

- `src/rules/expansion.js` 在 `playability` 之后、`facade` 之前加载（`index.html` 与全部测试的加载表都已加入）。它只通过包装（重新赋值全局函数）改变行为，不修改前面的文件。对外接口是 `globalThis.GC_X`，详见 `docs/engine-api.md` 的「扩展层」一节。
- 内容：72 张新卡（共 86 张，数据驱动 `ops` 解释器）、7 个关键词、6 种召唤物、12 种杂兵行为、8 种场地、首领二阶段 6 种、破障条件 6 种、敌方意图查询、11 对羁绊合击、契约条款 4 种、无尽词缀 8 条、每日挑战、成绩榜、战绩与 33 个成就、桌面道具互动与 3 个仪式。
- 表现层：`src/app/battle/x-hud.js`（敌方意图条、场地徽记、合击按钮、黑影台词、二阶段/场地/合击/亡语演出，经 `ctx.xfx` 接到 director）；`ui/screens.js` 新增 `pact` `daily` `records` `achievements`；`battle-input.js` 里香炉/魂瓮/招魂铃在路线图界面可点。
- 新增本机存储键：`gc3d-records-v1`（成绩）、`gc3d-stats-v1`（战绩与成就）。存档里新增字段 `pacts` `pendingPacts` `xProps` `xIncense` `daily` `dailySeed`，旧存档缺这些字段时按空处理。
- 测试：`node tests\expansion_test.cjs`（第 8 个规则测试）。平衡测试现在的期望输出是 `1840 seeded ... worst 8 rounds`。
- 用户明确说过：平衡、稳定性、发布形态暂不处理。

### 扩展层第二批（优先级 2 与新手引导）

- 法器 15 件（`state.relics`）、冥钱（`state.coins`，战斗胜利获得）、每幕岔路新增 `<幕>-shop`（鬼市，type `shop`）与 `<幕>-omen`（异兆，type `omen`，8 个事件轮换），`<幕>-trial` 标 `elite`（敌人更强，胜利后 `state.pendingRelic` 三选一）。岔路现在是 调查 / 精英 / 鬼市 / 异兆 四选一。主线节点数 313 → 405（`mainline_test` 的期望输出随之改变）。
- 开局馈赠 4 种（`GC_X.boons()`，按 `gc3d-stats-v1` 的累计战绩解锁，建档面板里选；无尽模式不生效）。
- 新手引导 `src/app/ui/tutorial.js`（`ctx.tutorial`）：`a01-battle` 第 1 回合且 `localStorage['gc3d-tutorial-v1']` 为空时启动，10 步；高亮圈用相机投影世界坐标。设置里「重置提示与教学」会清掉该键。`.story-bar` 常驻 DOM（`display:none`），判断剧情是否在显示要看 `style.display`。
- 首战之前 `a01-story` 的 `continueMainlineEvent` 会先契约童童；自动化脚本若跳过它，首战手里没有鬼灵牌。
- 界面：`screens.js` 新增 `shop` `omen` `relicPick`；路线图 HUD 显示冥钱与法器数；「鬼灵与卡牌」里列出法器。指南共 37 条（`playability_test` 断言的是规则侧 `PLAY_GUIDE` 的 26 条，未变）。
