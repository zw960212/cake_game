import levelJson from '../levels/levels.json';
import manifestJson from '../assets/manifest.json';
import { gameConfig } from './config/gameConfig';
import { parseLevelFile } from './core/levels';
import { App, type SceneFactory } from './app/app';
import { BootScene } from './app/scenes/boot';
import { GameScene } from './app/scenes/game';
import { HomeScene } from './app/scenes/home';
import { LevelSelectScene } from './app/scenes/levelSelect';
import { AnalyticsService } from './app/services/analytics';
import { createAdService } from './app/services/ads';
import { AudioService } from './app/services/audio';
import { HapticsService } from './app/services/haptics';
import { createWxStore, SaveStore } from './app/services/storage';
import { Assets, parseManifest } from './render/assets';
import { createViewport, type Viewport } from './render/canvas';

function designPoint(
  viewport: Viewport,
  event: any,
): { x: number; y: number } | null {
  const touch =
    (event.changedTouches && event.changedTouches[0]) ||
    (event.touches && event.touches[0]);
  if (!touch) return null;
  return {
    x: touch.clientX / viewport.scale,
    y: touch.clientY / viewport.scale,
  };
}

function start(): void {
  const viewport = createViewport(gameConfig.designWidth);
  const assets = new Assets();
  const store = new SaveStore(createWxStore(), gameConfig.saveKey);
  const audio = new AudioService(key => assets.audio(key));

  const services = {
    ads: createAdService(gameConfig.ads),
    audio,
    haptics: new HapticsService(),
    analytics: new AnalyticsService(),
  };

  const factory: SceneFactory = {
    home: app => new HomeScene(app),
    levels: app => new LevelSelectScene(app),
    game: (app, level) => new GameScene(app, level),
  };

  const app = new App(
    viewport,
    assets,
    store,
    services,
    parseLevelFile(levelJson),
    factory,
  );
  app.setScene(new BootScene(app, parseManifest(manifestJson)));

  let last = Date.now();
  const frame = (): void => {
    const now = Date.now();
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = now;
    try {
      app.update(dt);
      app.render();
    } catch (error) {
      console.error('[frame]', error);
    } finally {
      requestAnimationFrame(frame);
    }
  };
  requestAnimationFrame(frame);

  wx.onTouchStart((event: any) => {
    const point = designPoint(viewport, event);
    if (!point) return;
    app.touchStart(point.x, point.y);
  });
  wx.onTouchMove((event: any) => {
    const point = designPoint(viewport, event);
    if (!point) return;
    app.touchMove(point.x, point.y);
  });
  wx.onTouchEnd((event: any) => {
    const point = designPoint(viewport, event);
    if (!point) return;
    app.touchEnd(point.x, point.y);
  });

  if (typeof wx.onHide === 'function') {
    wx.onHide(() => audio.stopMusic());
  }
  if (typeof wx.onShow === 'function') {
    wx.onShow(() => {
      if (app.save.settings.music) audio.playMusic('bgm');
    });
  }
  if (typeof wx.onAudioInterruptionBegin === 'function') {
    wx.onAudioInterruptionBegin(() => audio.stopMusic());
  }
  if (typeof wx.onAudioInterruptionEnd === 'function') {
    wx.onAudioInterruptionEnd(() => {
      if (app.save.settings.music) audio.playMusic('bgm');
    });
  }
}

start();
