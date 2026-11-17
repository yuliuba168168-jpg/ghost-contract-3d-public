// 素材空位总表：游戏会用到、但需要外部制作的全部文件（技能视频 / 音乐 / 卡面 / 立绘）。
// 游戏内「设置 → 素材清单」和 tools/asset_doc.cjs（生成 docs/素材导入说明.md）都读这里，新增空位只改这一处。
import { VIDEO_MAP } from '../fx/video-map.js';

// [文件名(不含扩展名), 游戏里什么时候播, 缺失时用哪首代替]
export const MUSIC = [
  ['title', '标题页', 'map'], ['map', '路线图（每幕选择去处的界面）', 'title'], ['camp', '篝火、鬼灵与卡牌、修行、图鉴、成就等整备界面', 'map'],
  ['story_calm', '剧情：平静、日常段落', 'map'], ['story_dread', '剧情：恐怖、诡异段落，以及战斗前的战书', 'story_calm'], ['story_sorrow', '剧情：离别、牺牲段落', 'story_calm'], ['story_resolve', '剧情：决意、迎战段落', 'story_calm'],
  ['battle_1', '普通战斗，第 1–15 幕', '（无，缺它则战斗无音乐）'], ['battle_2', '普通战斗，第 16–30 幕', 'battle_1'], ['battle_3', '普通战斗，第 31–46 幕', 'battle_2'],
  ['elite', '精英战（岔路里的精英节点）', 'boss_ghost'], ['boss_ghost', '首领战：鬼灵类首领', 'battle_3'], ['boss_god', '首领战：神级首领', 'boss_ghost'], ['boss_taboo', '首领战：禁忌类首领', 'boss_ghost'], ['boss_final', '终幕首领战', 'boss_god'],
  ['crisis', '任何战斗中我方命灯降到 25% 以下时切入', '（不切换）'], ['contract', '契约鬼灵的剧情与选择契约条款时', 'story_calm'], ['event', '鬼市与异兆', 'camp'], ['endless', '无尽模式与每日挑战', 'battle_2'],
  ['victory', '战斗胜利时播一次（不循环）', '（不播）'], ['defeat', '战斗失败时播一次（不循环）', '（不播）'], ['ending', '结局与阶段性尾声', 'story_sorrow']
];
export const CARD_EXTRA = [['tong_evil', '童童 · 邪灵形态'], ['tong_valkyrie', '童童 · 女武神形态']];
export const VIDEO_EXT = ['mp4', 'webm'], MUSIC_EXT = ['mp3', 'wav', 'ogg', 'm4a'], IMAGE_EXT = ['png', 'webp', 'jpg', 'jpeg'];

// 生成四类空位。GD = GC.GD（规则数据），tierOf(name) 可选。
export function slotList(GD, tierOf = () => 0) {
  const nameOf = id => id === 'player' ? '御鬼者' : GD.spirits.find(s => s.id === id)?.name || id;
  const video = [];
  for (const [id, list] of Object.entries(VIDEO_MAP)) for (const [names, n, passive] of list) {
    const def = id === 'player' ? GD.playerSkills[n - 1] : GD.skillDefs[names[0]] || {};
    video.push({ key: `${id}_${n}`, dir: 'assets/video', ext: VIDEO_EXT, owner: nameOf(id), skill: names.join(' / '), passive: !!passive, tier: id === 'player' ? 3 : tierOf(names[0]), desc: def?.desc || '' });
  }
  const music = MUSIC.map(([key, where, fallback]) => ({ key, dir: 'assets/music', ext: MUSIC_EXT, where, fallback }));
  const cards = [...GD.spirits.map(s => [s.id, s.name]), ...CARD_EXTRA].map(([key, owner]) => ({ key, dir: 'assets/cards', ext: IMAGE_EXT, owner }));
  const views = GD.spirits.flatMap(s => [['front', '正面'], ['side', '侧面'], ['back', '背面']].map(([pose, label]) => ({ key: `${s.id}_${pose}`, dir: 'assets/views', ext: ['png', 'webp'], owner: s.name, pose: label })));
  return { video, music, cards, views };
}
