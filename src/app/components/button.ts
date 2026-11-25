import type { Rect } from '../../utils/geometry';
import { contains } from '../../utils/geometry';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';

export interface ButtonSpec {
  id: string;
  rect: Rect;
  label: string;
  variant?: 'primary' | 'ghost';
  enabled?: boolean;
  badge?: number;
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  button: ButtonSpec,
): void {
  const enabled = button.enabled !== false;
  const primary = button.variant === 'primary';
  const fill = !enabled
    ? '#E9DED3'
    : primary
      ? theme.colors.primary
      : theme.colors.panel;
  const color = !enabled
    ? '#B9A897'
    : primary
      ? '#FFFFFF'
      : theme.colors.text;

  ctx.save();
  ctx.shadowColor = 'rgba(196,140,100,0.22)';
  ctx.shadowBlur = primary ? 18 : 10;
  ctx.shadowOffsetY = 6;
  fillRoundRect(
    ctx,
    button.rect.x,
    button.rect.y,
    button.rect.w,
    button.rect.h,
    theme.radius.button,
    fill,
  );
  ctx.restore();

  drawText(
    ctx,
    button.label,
    button.rect.x + button.rect.w / 2,
    button.rect.y + button.rect.h / 2,
    32,
    color,
    'center',
    'middle',
    true,
  );

  if (button.badge && button.badge > 0) {
    const bx = button.rect.x + button.rect.w - 12;
    const by = button.rect.y + 8;
    ctx.beginPath();
    ctx.arc(bx, by, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#FF6B6B';
    ctx.fill();
    drawText(ctx, String(button.badge), bx, by + 1, 22, '#FFFFFF', 'center', 'middle', true);
  }
}

export function hitButton(button: ButtonSpec, x: number, y: number): boolean {
  return button.enabled !== false && contains(button.rect, x, y);
}
