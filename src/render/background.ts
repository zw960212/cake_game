import type { ImageLookup } from './assets';
import type { Viewport } from './canvas';
import { theme } from './theme';

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  images?: ImageLookup,
): void {
  const background = images?.image('bg');
  if (background) {
    ctx.drawImage(background.source, 0, 0, viewport.width, viewport.height);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
  gradient.addColorStop(0, theme.colors.bgTop);
  gradient.addColorStop(1, theme.colors.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.beginPath();
  ctx.arc(viewport.width - 90, 180, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(70, viewport.height * 0.72, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 183, 197, 0.14)';
  ctx.beginPath();
  ctx.arc(viewport.width * 0.2, 120, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
