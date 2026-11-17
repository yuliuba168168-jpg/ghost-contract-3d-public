# 素材放置说明（音乐 / 技能视频 / 卡面）

把文件按下面的名字放进对应文件夹，刷新游戏页面即可生效，不需要改代码。缺的文件不会报错。
清单由 `serve.cjs` 的 `/__list?dir=assets/<目录>` 提供，所以必须用 `启动游戏.cmd`（或 `node serve.cjs`）运行。

| 素材 | 文件夹 | 文件名 | 格式 | 代码 |
|---|---|---|---|---|
| 音乐（提示词文档 03） | `assets/music/` | `title` `map` `camp` `story_calm` `story_dread` `story_sorrow` `story_resolve` `battle_1` `battle_2` `battle_3` `elite` `boss_ghost` `boss_god` `boss_taboo` `boss_final` `crisis` `contract` `event` `endless` `victory` `defeat` `ending` | mp3 / wav / ogg / m4a | `src/app/core/music.js` |
| 技能视频（文档 04） | `assets/video/` | `<鬼灵id>_<序号>`，如 `tong_1`；升级版 `tong_1p` `tong_1pp`；御鬼者 `player_1..3` | mp4 / webm | `src/app/fx/skill-video.js`、`video-map.js` |
| 卡面（文档 02） | `assets/cards/` | `<鬼灵id>`，如 `tong`、`tong_evil`、`tong_valkyrie` | png / webp / jpg | `src/app/core/assets.js` |

- 音乐：每 0.4 秒按当前界面选曲（标题、路线图、篝火类面板、剧情、契约、战斗按幕分三段、精英、首领四类、无尽、鬼市与异兆、残灯、终幕），缺曲按 `music.js` 的 `FALLBACK` 表找替代；循环靠同一首的首尾交叉淡化；`victory` / `defeat` 是一次性短曲。音量在设置里的「音乐音量」（`localStorage['gc3d-music-vol']`）。
- 技能视频：有视频的技能用视频代替程序化全屏演出（`main.js` 包了一层 `ctx.cine.play`）。3–4 级全屏，1–2 级斜切画幅。点击、空格、回车跳过。演出模式「仅牌桌」不播；「精简」每场每条只播一次；被动技能每场只播一次。`video-map.js` 由提示词文档 04 的标题生成。
- 卡面：注册为 `art:<id>`，覆盖 `assets/gen` 里的同名卡面，目前画在卡牌上半部的画框里。
- 立绘三视图（文档 01）不能直接放：要先用 `tools/build_assets.py` 抠图生成 `assets/gen/views`。
