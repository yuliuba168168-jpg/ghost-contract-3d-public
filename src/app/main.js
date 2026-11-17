import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { onFrame, setRender, start, stats } from './core/loop.js';
import { initQuality, quality, setQuality, view, LITE } from './core/quality.js';
import { initInput } from './core/input.js';
import { loadAssets } from './core/assets.js';
import { unlockAudio } from './core/audio.js';
import { createCameraRig } from './scene/camera-rig.js';
import { createLights } from './scene/lights.js';
import { createTable } from './scene/table.js';
import { createProps } from './scene/props.js';
import { createRoom } from './scene/room.js';
import { createOpponent } from './scene/opponent.js';
import { createAtmosphere } from './scene/atmosphere.js';
import { updateCards, backTexture } from './cards/card-mesh.js';
import { updateApparitions } from './cards/apparition.js';
import { createBattleView } from './battle/battle-view.js';
import { updateFlames } from './fx/flame.js';
import { createWard } from './fx/ward.js';
import { createCinematic } from './fx/cinematic.js';
import { installBridge } from './bridge-impl.js';

const params = new URLSearchParams(location.search);

async function boot() {
  const bootEl = document.getElementById('boot'), bootText = document.getElementById('bootText');
  initQuality();
  const canvas = document.getElementById('stage');
  const R = createRenderer(canvas);
  const rig = createCameraRig();
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0b0b0c', .03);
  scene.add(rig.camera);

  await Promise.all([loadAssets(p => { bootText.textContent = `点灯中… ${Math.round(p * 100)}%`; }), document.fonts?.ready]);

  const lights = createLights(scene, R.renderer);
  const table = createTable(scene);
  const props = createProps(scene, lights);
  const room = createRoom(scene);
  const opponent = createOpponent(scene);
  const atmosphere = createAtmosphere(scene);
  props.deck.setBack(backTexture());
  lights.bakeEnvironment();
  rig.camera.add(lights.hand);
  lights.hand.position.set(0, -.25, -1.3);

  initInput(canvas, rig.camera);
  R.attach(scene, rig.camera);
  R.renderer.compile(scene, rig.camera);

  const listeners = new Map();
  const ctx = {
    R, rig, scene, lights, table, props, room, opponent, atmosphere, params,
    on(name, fn) { (listeners.get(name) || listeners.set(name, []).get(name)).push(fn); },
    emit(name, ...args) { for (const fn of listeners.get(name) || []) { try { fn(...args); } catch (e) { console.error('[hook]', name, e); } } }
  };
  ctx.battle = createBattleView(ctx);
  ctx.ward = createWard(ctx);
  ctx.cine = createCinematic(ctx);

  const dev = params.get('dev');
  if (!dev || dev === 'battle' || dev === 'play') {
    const [{ createDirector }, { createStatusView }, { createBattleInput }, { createScreens }] = await Promise.all([
      import('./battle/director.js'), import('./battle/status-view.js'), import('./battle/battle-input.js'), import('./ui/screens.js')
    ]);
    ctx.director = createDirector(ctx);
    ctx.status = createStatusView(ctx);
    ctx.xhud = (await import('./battle/x-hud.js')).createXHud(ctx);
    ctx.input = createBattleInput(ctx);
    ctx.screens = createScreens(ctx);
    ctx.tutorial = (await import('./ui/tutorial.js')).createTutorial(ctx);
    ctx.music = (await import('./core/music.js')).createMusic(ctx);
    ctx.video = (await import('./fx/skill-video.js')).createSkillVideo(ctx);
    { const basePlay = ctx.cine.play.bind(ctx.cine); ctx.cine.play = async req => (await ctx.video.tryPlay(req)) ? undefined : basePlay(req); }
    ctx.mapView?.warm?.(); ctx.storyStage?.warm?.();
  }
  installBridge(ctx);

  onFrame((dt, t) => {
    rig.update(dt, t); lights.update(dt, t); table.update(dt, t); props.update(dt, t); room.update(dt, t);
    opponent.update(dt, t, rig.camera); atmosphere.update(dt, t);
    updateCards(dt, t); updateApparitions(dt, t, rig.camera); updateFlames(dt, t, rig.camera); ctx.ward?.update(dt, t, rig.camera); ctx.cine?.update(dt, t);
    ctx.battle.update(dt, t); ctx.director?.update?.(dt, t); ctx.status?.update?.(dt, t); ctx.input?.update?.(dt, t); ctx.screens?.update?.(dt, t);
    R.tune(stats.samples[stats.samples.length - 1]);
  });
  let skipped = 0;
  setRender((dt, t) => {
    if (ctx.screens?.modalOpen && !(ctx.director?.running > 0) && ++skipped % 3) return;
    R.render(dt, t);
  });
  start();

  // 预热要把相机扫过所有机位并把每种特效各放一次；软件渲染下这要几分钟，极简档直接跳过（代价是技能首次施放时各卡一下）
  if (LITE) document.body.classList.add('lite');
  else if (quality().plain) document.body.classList.add('plain-gfx');
  else { R.busy = true; await ctx.director?.warmup?.().catch(e => console.warn('[warmup]', e)); R.busy = false; }

  if (!params.get('dev') && !params.get('nonote')) import('./ui/gpu-note.js').then(m => m.showGpuNote());
  addEventListener('pointerdown', unlockAudio, { once: true });
  addEventListener('keydown', unlockAudio, { once: true });

  globalThis.__gc = ctx;
  globalThis.__gcStats = () => {
    const s = stats.samples.slice(-300), avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
    return { avgMs: avg, fps: 1000 / avg, quality: quality().name, scale: view.scale, pr: +view.pr.toFixed(3), updateMs: +stats.updateMs.toFixed(2), renderMs: +stats.renderMs.toFixed(2), calls: R.renderer.info.render.calls, tris: R.renderer.info.render.triangles };
  };
  globalThis.__gcQuality = setQuality;
  globalThis.__gcLoopStats = stats;

  if (dev) {
    const { runDev } = await import('./dev.js');
    if (dev !== 'battle' && dev !== 'play') ctx.rig.set(dev === 'title' ? 'title' : 'battle');
    await runDev(dev, ctx);
    if (dev === 'battle') { rig.set('battle'); ctx.battle.sync(); }
  } else if (ctx.screens) {
    globalThis.GC.boot();
  } else {
    rig.set('title');
  }
  bootEl.classList.add('done');
  setTimeout(() => bootEl.remove(), 900);
  globalThis.__ready = true;
}

boot().catch(err => {
  console.error(err);
  const t = document.getElementById('bootText');
  if (t) {   // 3D 起不来（WebGL 被禁用 / 驱动不支持）时给出能玩的出路，而不是只有一行报错
    t.textContent = '启动失败：' + (err?.message || err);
    const tip = document.createElement('div'); tip.style.cssText = 'margin-top:14px;font-size:13px;line-height:1.9;letter-spacing:1px;pointer-events:auto';
    tip.innerHTML = '可以改玩不需要显卡的<a href="simple.html" style="color:#ffd98a">方块版</a>。<br>想玩完整版：在浏览器设置里打开「使用图形加速（硬件加速）」，重启浏览器后再试。';
    t.after(tip);
  }
});
