import { drawBackground } from '../../render/background';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';
import { contains, type Rect } from '../../utils/geometry';
import type { App } from '../app';
import { drawButton, hitButton, type ButtonSpec } from '../components/button';
import { Modal } from '../components/modal';
import { SettingsModal } from '../components/settings';
import type { Scene } from '../scene';

export class HomeScene implements Scene {
  private readonly modal = new Modal();
  private readonly settings: SettingsModal;
  private buttons: ButtonSpec[] = [];
  private gearRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private touchStart: { x: number; y: number } | null = null;

  constructor(private readonly app: App) {
    this.settings = new SettingsModal(
      () => this.app.save.settings,
      patch => {
        this.app.save.settings = { ...this.app.save.settings, ...patch };
        this.app.applySettings();
        this.app.persist();
      },
      () => this.confirmReset(),
    );
  }

  enter(): void {
    this.app.services.audio.playMusic('bgm');
  }

  exit(): void {}

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const viewport = this.app.viewport;
    drawBackground(ctx, viewport, this.app.assets);

    drawText(
      ctx,
      '🍰',
      viewport.width / 2,
      viewport.height * 0.2,
      110,
      theme.colors.text,
    );
    drawText(
      ctx,
      '蛋糕排序派对',
      viewport.width / 2,
      viewport.height * 0.32,
      theme.fontSize.title,
      theme.colors.text,
      'center',
      'middle',
      true,
    );
    drawText(
      ctx,
      '把蛋糕层整理成同口味吧',
      viewport.width / 2,
      viewport.height * 0.39,
      theme.fontSize.body,
      theme.colors.textLight,
    );

    const current = Math.min(
      this.app.save.unlockedLevel,
      this.app.levels.levels.length,
    );

    this.buttons = [
      {
        id: 'continue',
        rect: { x: 125, y: viewport.height * 0.52, w: 500, h: 112 },
        label: '继续游戏',
        variant: 'primary',
      },
      {
        id: 'levels',
        rect: { x: 125, y: viewport.height * 0.52 + 140, w: 500, h: 104 },
        label: '关卡选择',
        variant: 'ghost',
      },
    ];
    for (const button of this.buttons) drawButton(ctx, button);

    drawText(
      ctx,
      `当前进度：第 ${current} 关`,
      viewport.width / 2,
      viewport.height * 0.52 + 290,
      theme.fontSize.small,
      theme.colors.textLight,
    );

    this.gearRect = {
      x: viewport.width - 104,
      y: viewport.safeTop + 16,
      w: 68,
      h: 68,
    };
    fillRoundRect(
      ctx,
      this.gearRect.x,
      this.gearRect.y,
      this.gearRect.w,
      this.gearRect.h,
      20,
      'rgba(255,255,255,0.78)',
    );
    drawText(
      ctx,
      '⚙',
      this.gearRect.x + this.gearRect.w / 2,
      this.gearRect.y + this.gearRect.h / 2,
      34,
      theme.colors.text,
    );

    this.settings.render(ctx, viewport);
    this.modal.render(ctx, viewport);
  }

  onTouchStart(x: number, y: number): void {
    this.touchStart = { x, y };
  }

  onTouchMove(): void {}

  onTouchEnd(x: number, y: number): void {
    if (this.settings.visible) {
      this.settings.tap(x, y);
      return;
    }
    if (this.modal.visible) {
      this.modal.tap(x, y);
      return;
    }
    if (!this.touchStart) return;

    const dx = x - this.touchStart.x;
    const dy = y - this.touchStart.y;
    this.touchStart = null;
    if (Math.hypot(dx, dy) > 24) return;

    if (contains(this.gearRect, x, y)) {
      this.settings.open();
      return;
    }

    for (const button of this.buttons) {
      if (!hitButton(button, x, y)) continue;
      if (button.id === 'continue') {
        const allDone = this.app.levels.levels.every(level =>
          this.app.save.completedLevelIds.includes(level.id),
        );
        if (allDone) {
          this.app.goLevels();
        } else {
          const current = Math.min(
            this.app.save.unlockedLevel,
            this.app.levels.levels.length,
          );
          this.app.startLevel(current);
        }
      } else {
        this.app.goLevels();
      }
      return;
    }
  }

  private confirmReset(): void {
    this.modal.show('重置进度', '所有关卡进度将被清除，确定吗？', [
      { label: '取消', onPress: () => {} },
      {
        label: '重置',
        primary: true,
        onPress: () => {
          this.app.resetProgress();
          this.app.persist();
          this.app.goHome();
        },
      },
    ]);
  }
}
