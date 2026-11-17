// 浏览器没有用显卡（软件渲染）时的提示：说明原因、怎么打开硬件加速、以及方块版入口。
import { gpu, quality } from '../core/quality.js';

const KEY = 'gc3d-gpu-note';
export function showGpuNote(host = document.getElementById('ui') || document.body) {
  if (!gpu.software || localStorage.getItem(KEY) === 'off' || sessionStorage.getItem(KEY)) return null;
  const el = document.createElement('div'); el.className = 'gpu-note';
  const edge = /Edg\//.test(navigator.userAgent), scheme = edge ? 'edge' : 'chrome';
  el.innerHTML = `<b>浏览器没有使用显卡</b>
<p>现在由处理器模拟 3D 画面（${(gpu.renderer || '未知').replace(/[<>&]/g, '').slice(0, 70)}），任何画质都只有几帧。${quality().plain ? '已自动切到「极简」画质：分辨率很低、没有光影特效，牌面文字也比较糊（右键看详情）。只想顺畅地玩，建议先用下面的方块版。' : ''}</p>
<ol><li>地址栏输入 <code>${scheme}://settings/system</code>，打开「使用图形加速」，重启浏览器。</li>
<li>仍然不行：<code>${scheme}://flags/#ignore-gpu-blocklist</code> 改成 Enabled，重启浏览器。</li>
<li>设备管理器 → 显示适配器里如果是「Microsoft 基本显示适配器」，需要安装显卡驱动；远程桌面和虚拟机里通常没有显卡。</li></ol>
<div class="gpu-note-row"><a class="ink-btn primary" href="simple.html">改玩方块版（不用显卡，推荐）</a><button class="ink-btn" data-k="off">不再提示</button><button class="ink-btn" data-k="ok">继续用极简 3D</button></div>`;
  el.addEventListener('click', ev => {
    const k = ev.target.closest('[data-k]')?.dataset.k; if (!k) return;
    if (k === 'off') localStorage.setItem(KEY, 'off'); else sessionStorage.setItem(KEY, '1');
    el.remove();
  });
  host.append(el);
  return el;
}
