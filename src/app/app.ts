import type { Level, LevelFile } from '../core/types';
import type { Assets } from '../render/assets';
import type { Viewport } from '../render/canvas';
import type { AdService } from './services/ads';
import type { AnalyticsService } from './services/analytics';
import type { AudioService } from './services/audio';
import type { HapticsService } from './services/haptics';
import type { SaveData, SaveStore } from './services/storage';
import type { Scene } from './scene';

export interface Services {
  ads: AdService;
  audio: AudioService;
  haptics: HapticsService;
  analytics: AnalyticsService;
}

export interface SceneFactory {
  home(app: App): Scene;
  levels(app: App): Scene;
  game(app: App, level: Level): Scene;
}

export class App {
  save: SaveData;
  scene: Scene | null = null;

  constructor(
    readonly viewport: Viewport,
    readonly assets: Assets,
    readonly store: SaveStore,
    readonly services: Services,
    readonly levels: LevelFile,
    private readonly factory: SceneFactory,
  ) {
    this.save = store.load();
    this.applySettings();
  }

  setScene(scene: Scene): void {
    this.scene?.exit();
    this.scene = scene;
    scene.enter();
  }

  update(dt: number): void {
    this.scene?.update(dt);
  }

  render(): void {
    if (!this.scene) return;
    const { ctx, pixelScale, width, height } = this.viewport;
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    this.scene.render(ctx);
  }

  touchStart(x: number, y: number): void {
    // 微信禁止无交互自动播放；每次触摸都尝试启动 BGM（playMusic 内部幂等）
    if (this.save.settings.music) this.services.audio.playMusic('bgm');
    this.scene?.onTouchStart(x, y);
  }

  touchMove(x: number, y: number): void {
    this.scene?.onTouchMove(x, y);
  }

  touchEnd(x: number, y: number): void {
    this.scene?.onTouchEnd(x, y);
  }

  persist(): void {
    this.store.save(this.save);
  }

  applySettings(): void {
    const settings = this.save.settings;
    this.services.audio.setSoundEnabled(settings.sound);
    this.services.audio.setMusicEnabled(settings.music);
    this.services.haptics.setEnabled(settings.haptic);
    if (settings.music) this.services.audio.playMusic('bgm');
  }

  resetProgress(): void {
    this.store.reset();
    this.save = this.store.load();
    this.applySettings();
  }

  goHome(): void {
    this.setScene(this.factory.home(this));
  }

  goLevels(): void {
    this.setScene(this.factory.levels(this));
  }

  startLevel(id: number): void {
    const level = this.levels.levels.find(item => item.id === id);
    if (!level) return;
    this.setScene(this.factory.game(this, level));
  }
}
