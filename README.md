# ghost-contract-3d
鬼灵契约3D：Three.js 3D 卡牌战役（完整版 + 试玩版 + 方块版）

> **这是试玩版分支（`demo`）**：只含主线第 1–2 幕，打完第 2 幕显示“试玩结束”。第 3–46 幕的剧情、战斗和小说原文都不在这个分支里；完整版在 `main` 分支。
> 由 `node tools/make_demo.cjs 2` 从完整版生成。`mainline_test`、`expansion_test`、`battle_loop_test` 断言的是 46 幕内容，在这个分支上不适用。


## 运行

需要 Node.js。Windows 下双击对应的启动脚本：

- `启动游戏.cmd`：完整版（3D）
- `启动试玩版.cmd`：简化 3D，动画 3 倍速
- `启动方块版.cmd`：不用 3D，纯方块和文字
- `流畅度诊断.cmd`：检测浏览器是否在用显卡

或者 `node serve.cjs` 后打开 http://127.0.0.1:8790/ 。不能直接双击 `index.html`。

工程说明见 `AGENTS.md`，素材导入见 `docs/assets.md`，平衡数据见 `docs/balance.md`。
