// 全屏技能演出分级表（按强度与稀缺性）。名字去掉末尾的 + 之前先精确匹配带 + 的条目。
const T1 = '邪灵形态 鬼瞳 鬼域 鬼火 伞分身 虚化 解析 解析+ 解析++ 白虎驱邪纹 金字塔镇压';
const T2 = '寒冰右手 无解防御 女武神形态 火凤燎原 火凤燎原+ 时间梦境 水分身 水分身+ 幻影蝶翼 鬼火+ 伞分身+ 白虎驱邪纹+ 金字塔镇压+ 解析+++ 解析++++ 无象灵水躯 入梦 入梦+ 丰都鬼军 迷惑 鬼绣球 虚化+ 冰雪';
const T3 = '画卷绝杀 55开 55开+ 时间回退 时间删除 云梦泽 云梦泽+ 不完全火焰规律 寂灭蝶珠 空间规律 空间规律+ 鬼绣球+ 欺骗 无象灵水躯+ 伞域 英灵领域';
const T4 = '绝望 鬼主权杖 太阴之力 轮回 鬼门关降临 女王领域 半完全火焰规律';
const TABLE = new Map();
for (const [list, tier] of [[T1, 1], [T2, 2], [T3, 3], [T4, 4]]) for (const n of list.split(' ')) TABLE.set(n, tier);

export const TIER_DUR = { 1: .6, 2: 1.1, 3: 2.0, 4: 3.4 };
export function skillTier(name) { return TABLE.get(name) || 2; }
export function cardTier(cardId) {
  const r = globalThis.GC?.SKILLS?.[cardId]?.rarity;
  return { '普通': 1, '稀有': 2, '珍藏': 3, '传说': 4 }[r] || 1;
}
export function bossTier(kind, lead) {
  if (!lead) return 1;
  return ['execute', 'siphon', 'aoe', 'dread'].includes(kind) ? 3 : 2;
}
export const SPECIAL = { '绝望': 1, '鬼主权杖': 2, '太阴之力': 3, '轮回': 4, '鬼门关降临': 5, '女王领域': 6, '半完全火焰规律': 7 };

const MOTIF_OF = {
  fire: 'phoenix inferno divinefire ghostfire fox bloodsacrifice scarlet', ice: 'ice', water: 'water cloud', ink: 'ink memory smoke',
  clock: 'clock', space: 'space void mirror', moon: 'moon queen lotus', gate: 'gate underworld army domain despair', butterfly: 'butterfly love wedding dream umbrella',
  eye: 'eye analysis mask', gold: 'heal lifeline reincarnation shield fate pyramid royal'
};
const MOTIF_INDEX = { fire: 0, ice: 1, water: 2, ink: 3, clock: 4, space: 5, moon: 6, gate: 7, butterfly: 8, eye: 9, gold: 10 };
export function motifIndex(theme) {
  for (const [m, list] of Object.entries(MOTIF_OF)) if (list.split(' ').includes(theme)) return MOTIF_INDEX[m];
  return 10;
}
