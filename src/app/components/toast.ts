import type { Viewport } from '../../render/canvas';
import { drawText, fillRoundRect } from '../../render/draw';

export class Toast {
  private message = '';
  private until = 0;

  show(message: string, durationMs = 2000): void {
    this.message = message;
    this.until = Date.now() + durationMs;
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    if (Date.now() >= this.until) return;

    const width = Math.min(620, viewport.width - 80);
    const height = 80;
    const x = (viewport.width - width) / 2;
    const y = viewport.height - viewport.safeBottom - 260;

    fillRoundRect(ctx, x, y, width, height, 40, 'rgba(90,62,46,0.86)');
    drawText(
      ctx,
      this.message,
      viewport.width / 2,
      y + height / 2,
      26,
      '#FFF8F0',
    );
  }
}
