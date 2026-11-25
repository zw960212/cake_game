import type { Manifest } from '../../render/assets';
import { drawBackground } from '../../render/background';
import { drawText } from '../../render/draw';
import { theme } from '../../render/theme';
import type { App } from '../app';
import type { Scene } from '../scene';

export class BootScene implements Scene {
  private ready = false;
  private started = false;

  constructor(
    private readonly app: App,
    private readonly manifest: Manifest,
  ) {}

  enter(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.app.assets.load(this.manifest),
        new Promise<void>(resolve => {
          timeoutHandle = setTimeout(resolve, 8000);
        }),
      ]);
    } catch (error) {
      console.warn('[boot] 资源加载失败，使用占位绘制', error);
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      this.ready = true;
    }
  }

  exit(): void {}

  update(): void {
    if (this.ready && !this.started) {
      this.started = true;
      this.app.goHome();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const viewport = this.app.viewport;
    drawBackground(ctx, viewport, this.app.assets);
    drawText(
      ctx,
      '🍰',
      viewport.width / 2,
      viewport.height * 0.38,
      110,
      theme.colors.text,
    );
    drawText(
      ctx,
      '蛋糕排序派对',
      viewport.width / 2,
      viewport.height * 0.5,
      theme.fontSize.title,
      theme.colors.text,
      'center',
      'middle',
      true,
    );
    drawText(
      ctx,
      '加载中…',
      viewport.width / 2,
      viewport.height * 0.58,
      theme.fontSize.body,
      theme.colors.textLight,
    );
  }

  onTouchStart(): void {}
  onTouchMove(): void {}
  onTouchEnd(): void {}
}
