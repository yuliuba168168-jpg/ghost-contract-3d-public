// 生成 docs/素材导入说明.md：每个外部素材文件对应游戏的哪一处。用法：node tools/asset_doc.cjs
const fs = require('fs'), vm = require('vm'), path = require('path'), { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..'), RULES = path.join(ROOT, 'src', 'rules');
const ctx = { console, setTimeout, clearTimeout, queueMicrotask, __HEADLESS__: true, localStorage: { getItem: () => null, setItem: () => { } } };
vm.createContext(ctx);
for (const n of ['bridge', 'codex', 'vfx', 'app', 'polish', 'mainline-data', 'mainline-data-2', 'mainline', 'playability', 'expansion', 'facade']) vm.runInContext(fs.readFileSync(path.join(RULES, n + '.js'), 'utf8'), ctx, { filename: n + '.js' });
(async () => {
  // src/app 下是浏览器 ES 模块（.js），Node 不能直接 import，拼成一个临时 .mjs 再载入
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^import .*$/gm, '');
  const tmp = path.join(require('os').tmpdir(), 'gc3d-asset-slots.mjs');
  fs.writeFileSync(tmp, [src('src/app/fx/video-map.js'), src('src/app/core/asset-slots.js'), src('src/app/fx/skill-tier.js')].join(String.fromCharCode(10)));
  const { slotList, skillTier } = await import(pathToFileURL(tmp));
  const GD = ctx.GC.GD, S = slotList(GD, skillTier);
  const ls = d => { try { return new Set(fs.readdirSync(path.join(ROOT, d)).map(f => f.replace(/\.[^.]+$/, '').toLowerCase())); } catch { return new Set(); } };
  let manifest = { views: {}, art: {} }; try { manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/gen/manifest.json'), 'utf8')); } catch { }
  const gen = f => fs.existsSync(path.join(ROOT, 'assets/gen', f || '?'));
  const have = { video: ls('assets/video'), music: ls('assets/music'), cards: ls('assets/cards'), views: ls('assets/views') };
  const ok = (k, s) => have[k].has(s.key) || (k === 'cards' && gen(manifest.art?.[s.key]?.file)) || (k === 'views' && gen(manifest.views?.[s.key.replace(/_(front|side|back)$/, '')]?.[s.key.split('_').pop()]?.file));
  const mark = (k, s) => ok(k, s) ? '已有' : '空位';
  const cell = t => String(t ?? '').replace(/\|/g, '／').replace(/\n/g, ' ');
  const count = k => `${S[k].filter(s => ok(k, s)).length} / ${S[k].length}`;
  const FRAME = { 1: '中间横带', 2: '中间横带', 3: '全屏', 4: '全屏' };
  const out = [];
  out.push('# 素材导入说明', '', '> 本文件由 `node tools/asset_doc.cjs` 生成，不要手改；空位总表在 `src/app/core/asset-slots.js` 和 `src/app/fx/video-map.js`。', '',
    '游戏里所有需要外部制作的素材都留好了空位。**把文件按下表的文件名放进对应文件夹，刷新页面即生效，不需要改代码。** 游戏内「设置 → 素材清单」可以随时查看哪些已放入、哪些还是空位。', '',
    '## 总览', '', '| 类别 | 文件夹 | 文件名 | 格式 | 进度 | 缺失时的表现 |', '|---|---|---|---|---|---|',
    `| 技能视频 | \`assets/video/\` | \`<鬼灵id>_<序号>\`，升级版加 \`p\` | mp4 / webm，横幅 16:9，3–6 秒 | ${count('video')} | 纯黑画面 + 技能名（设置里可改回程序演出） |`,
    `| 音乐 | \`assets/music/\` | 见音乐表 | mp3 / wav / ogg / m4a | ${count('music')} | 用“缺失时代替”一栏的曲子；都没有则无音乐 |`,
    `| 卡面 | \`assets/cards/\` | \`<鬼灵id>\` | png / webp / jpg，竖幅 2:3 | ${count('cards')} | 印章卡面 |`,
    `| 立绘 | \`assets/views/\` | \`<鬼灵id>_front\` / \`_side\` / \`_back\` | png / webp，**透明底**抠图，高约 720 像素 | ${count('views')} | 无相灵体（一团人形雾气） |`, '',
    '提示词在四份提示词文档里：`01_立绘`、`02_卡面`、`03_音乐`、`04_技能视频`，编号和文件名与下表一致。必须通过 `启动游戏.cmd`（或 exe）运行，直接双击 html 读不到文件夹。', '',
    '## 一、技能视频', '',
    '- 触发：该鬼灵施放该技能时播放，播完（或点击 / 空格跳过）后在牌桌上结算。被动技能每场战斗只在第一次触发时播。',
    '- 画幅：「全屏」的视频铺满屏幕；「中间横带」的视频只显示画面中间约 60% 高度的一条，主体请放在画面中部。',
    '- 升级技能（如「鬼火+」）默认用基础版视频；想区分就再放一个 `<文件名>p.mp4`（两个加号用 `pp`）。',
    '- 视频自带声音会播放，音量跟随「音效音量」。演出模式为「仅牌桌」时不播任何视频。', '',
    '| 文件名 | 鬼灵 | 技能 | 画幅 | 被动 | 状态 | 技能效果（供对照画面） |', '|---|---|---|---|---|---|---|');
  for (const s of S.video) out.push(`| \`${s.key}.mp4\` | ${cell(s.owner)} | ${cell(s.skill)} | ${FRAME[s.tier] || '全屏'} | ${s.passive ? '是' : ''} | ${mark('video', s)} | ${cell(s.desc)} |`);
  out.push('', '## 二、音乐', '', '- 全部循环播放，循环点和曲目切换由游戏做交叉淡化，不需要自己剪循环。`victory` / `defeat` 只播一次。', '- 音量由「设置 → 音乐音量」控制。', '',
    '| 文件名 | 游戏里什么时候播 | 缺失时代替 | 状态 |', '|---|---|---|---|');
  for (const s of S.music) out.push(`| \`${s.key}.mp3\` | ${cell(s.where)} | ${cell(s.fallback)} | ${mark('music', s)} |`);
  out.push('', '## 三、卡面', '', '- 用在：手牌与场上的鬼灵卡、图鉴、契约界面、战前选人。会覆盖旧卡面。', '- 人物放在上三分之二，下方留暗部（卡名和数值叠在下方）。', '',
    '| 文件名 | 鬼灵 | 状态 |', '|---|---|---|');
  for (const s of S.cards) out.push(`| \`${s.key}.png\` | ${cell(s.owner)} | ${mark('cards', s)} |`);
  out.push('', '## 四、立绘（透明底抠图）', '', '- 用在：场上鬼灵的灵体、全屏技能演出里的人物等处。至少需要正面（`_front`）。',
    '- 生图得到的是三视图整张图，需要先切成三张并抠掉背景再放入；把整张三视图发给 AI 处理即可（`tools/build_assets.py` 是原有的切图脚本）。', '',
    '| 文件名 | 鬼灵 | 角度 | 状态 |', '|---|---|---|---|');
  for (const s of S.views) out.push(`| \`${s.key}.png\` | ${cell(s.owner)} | ${s.pose} | ${mark('views', s)} |`);
  out.push('', '## 五、目前没有留空位的部分', '', '- 卡牌（86 张技能牌）和首领技能的演出仍是程序生成，没有对应视频；需要的话在 `video-map.js` 里加条目即可扩展。', '- 敌人没有专属形象（都是黑雾人影）。', '- 音效是程序合成的，没有外部文件。', '');
  fs.writeFileSync(path.join(ROOT, 'docs', '素材导入说明.md'), out.join('\n'));
  console.log('video', count('video'), '| music', count('music'), '| cards', count('cards'), '| views', count('views'));
})();
