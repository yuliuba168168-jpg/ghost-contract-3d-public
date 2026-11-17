// 桌面鬼火路线图验收截图：map_act1 / map_act5 / map_hover / map_move_0..2 / map_lit
const { open, sleep } = require('./play.cjs');
(async () => {
  const g = await open('');
  await sleep(1800);
  await g.clickText('建立新旅途'); await sleep(400); await g.clickText('确认开始'); await sleep(3200);
  await g.page.screenshot({ path: 'shots/map_act1.png' }); console.log('map_act1');
  const nodes = await g.ev(() => __gc.mapView.debugNodes());
  const open1 = nodes.find(n => n.status === 'open');
  await g.page.mouse.move(open1.x, open1.y); await sleep(700);
  await g.page.screenshot({ path: 'shots/map_hover.png' }); console.log('map_hover');
  await g.page.mouse.move(40, 500);
  // 近景：鬼火照亮木纹和焦痕
  await g.page.screenshot({ path: 'shots/map_lit.png', clip: { x: Math.max(0, open1.x - 400), y: Math.max(0, open1.y - 420), width: 800, height: 600 } }); console.log('map_lit');
  // 玩家火焰移动：完成当前节点，推进到下一个
  await g.ev(() => {
    const st = GC.state, cur = st.available[0]; st.completed.push(cur); st.available = (GC.NODES[cur].next || []).slice(0, 1); GC.actions.renderMap();
  });
  for (let i = 0; i < 3; i++) { await sleep(i ? 170 : 120); await g.page.screenshot({ path: `shots/map_move_${i}.png` }); console.log('map_move_' + i); }
  await sleep(1500);
  // 第 5 幕（分叉多）
  await g.ev(() => {
    const st = GC.state, rows5 = GC.ACT_ROWS[5];
    for (let a = 1; a < 5; a++) for (const row of GC.ACT_ROWS[a]) for (const id of row) if (!st.completed.includes(id)) st.completed.push(id);
    const forkRow = rows5.find(r => r.length > 1) || rows5[0];
    st.completed.push(rows5[0][0]); st.available = [...forkRow]; st.current = rows5[0][0]; GC.actions.renderMap();
  });
  await sleep(3500);
  await g.page.screenshot({ path: 'shots/map_act5.png' }); console.log('map_act5');
  await g.done();
})().catch(e => { console.error(e); process.exit(1); });
