// 试玩版：只保留主线前 N 幕（默认 2）。在 demo 分支上运行一次：node tools/make_demo.cjs [N]
const fs = require('fs'), path = require('path');
const N = +process.argv[2] || 2, root = path.join(__dirname, '..');
const f1 = path.join(root, 'src/rules/mainline-data.js');
require(f1);
const M = globalThis.MAINLINE_DATA;
M.arcs = M.arcs.slice(0, N);
M.title = '全球诡异时代 · 试玩版';
M.demo = N;
M.chineseCount = M.arcs.reduce((a, x) => a + JSON.stringify([x.summary, x.pages]).replace(/[^\u4e00-\u9fff]/g, '').length, 0);
M.note = `试玩版：只收录主线第 1—${N} 幕。`;
fs.writeFileSync(f1, 'globalThis.MAINLINE_DATA=' + JSON.stringify(M) + ';\n');
fs.writeFileSync(path.join(root, 'src/rules/mainline-data-2.js'), '// 试玩版不含第 29—46 幕\n');
fs.rmSync(path.join(root, 'story-source'), { recursive: true, force: true });
console.log('demo data:', M.arcs.length, 'acts,', M.chineseCount, 'chars');
