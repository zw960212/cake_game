import { drawBackground } from '../../render/background';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';
import { clamp, contains, type Rect } from '../../utils/geometry';
import type { App } from '../app';
import type { Scene } from '../scene';

interface LevelCell {
  rect: Rect;
  id: number;
  unlocked: boolean;
}

export class LevelSelectScene implements Scene {
  private scrollY = 0;
  private maxScroll = 0;
  private cells: LevelCell[] = [];
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private tapStart: { x: number; y: number } | null = null;
  private lastY = 0;
  private moved = false;

  constructor(private readonly app: App) {}

  enter(): void {
    this.app.services.audio.playMusic('bgm');
  }

  exit(): void {}

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const viewport = this.app.viewport;
    drawBackground(ctx, viewport, this.app.assets);

    this.backRect = { x: 32, y: viewport.safeTop + 16, w: 68, h: 68 };
    fillRoundRect(
      ctx,
      this.backRect.x,
      this.backRect.y,
      this.backRect.w,
      this.backRect.h,
      20,
      'rgba(255,255,255,0.78)',
    );
    drawText(
      ctx,
      '‹',
      this.backRect.x + this.backRect.w / 2,
      this.backRect.y + 28,
      46,
      theme.colors.text,
    );
    drawText(
      ctx,
      '选择关卡',
      viewport.width / 2,
      viewport.safeTop + 50,
      theme.fontSize.heading,
      theme.colors.text,
      'center',
      'middle',
      true,
    );

    const cols = 5;
    const gap = 16;
    const margin = 32;
    const cellW = (viewport.width - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = 148;
    const levels = this.app.levels.levels;
    const rows = Math.ceil(levels.length / cols);
    const contentH = rows * cellH + (rows - 1) * gap;
    const contentTop = viewport.safeTop + 120;
    const availableH = viewport.height - viewport.safeBottom - contentTop - 24;
    this.maxScroll = Math.max(0, contentH - availableH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const completed = new Set(this.app.save.completedLevelIds);
    this.cells = [];

    for (const level of levels) {
      const index = level.id - 1;
      const row = Math.floor(index / cols);
      const col = index % cols;
      const rect = {
        x: margin + col * (cellW + gap),
        y: contentTop + row * (cellH + gap) - this.scrollY,
        w: cellW,
        h: cellH,
      };
      const unlocked = level.id <= this.app.save.unlockedLevel;
      this.cells.push({ rect, id: level.id, unlocked });

      if (rect.y + rect.h < contentTop || rect.y > viewport.height - viewport.safeBottom) {
        continue;
      }

      fillRoundRect(
        ctx,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        20,
        unlocked ? theme.colors.panel : '#EFE4D8',
      );
      drawText(
        ctx,
        String(level.id),
        rect.x + rect.w / 2,
        rect.y + rect.h / 2 - 8,
        38,
        unlocked ? theme.colors.text : theme.colors.locked,
        'center',
        'middle',
        true,
      );
      if (completed.has(level.id)) {
        drawText(
          ctx,
          '✓',
          rect.x + rect.w - 26,
          rect.y + 30,
          26,
          theme.colors.success,
        );
      }
      if (!unlocked) {
        drawText(
          ctx,
          '未解锁',
          rect.x + rect.w / 2,
          rect.y + rect.h / 2 + 34,
          20,
          theme.colors.locked,
        );
      }
    }
  }

  onTouchStart(x: number, y: number): void {
    this.tapStart = { x, y };
    this.lastY = y;
    this.moved = false;
  }

  onTouchMove(x: number, y: number): void {
    if (!this.tapStart) return;

    const delta = y - this.lastY;
    if (Math.abs(y - this.tapStart.y) > 10) this.moved = true;
    this.scrollY = clamp(this.scrollY - delta, 0, this.maxScroll);
    this.lastY = y;
  }

  onTouchEnd(x: number, y: number): void {
    if (!this.tapStart) return;
    this.tapStart = null;
    if (this.moved) return;

    if (contains(this.backRect, x, y)) {
      this.app.goHome();
      return;
    }

    for (const cell of this.cells) {
      if (cell.unlocked && contains(cell.rect, x, y)) {
        this.app.startLevel(cell.id);
        return;
      }
    }
  }
}
