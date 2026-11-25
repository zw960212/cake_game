import type { Rect } from '../../utils/geometry';
import { contains } from '../../utils/geometry';
import type { Viewport } from '../../render/canvas';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';
import { suppressTaps } from './tapGuard';

export interface ModalAction {
  label: string;
  primary?: boolean;
  onPress: () => void | Promise<void>;
}

export class Modal {
  visible = false;
  private title = '';
  private message = '';
  private actions: ModalAction[] = [];
  private hitAreas: Array<{ rect: Rect; action: ModalAction }> = [];

  show(title: string, message: string, actions: ModalAction[]): void {
    this.title = title;
    this.message = message;
    this.actions = actions;
    this.hitAreas = [];
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    if (!this.visible) return;

    ctx.fillStyle = 'rgba(60,40,30,0.38)';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    const width = 580;
    const height = 380;
    const x = (viewport.width - width) / 2;
    const y = (viewport.height - height) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(120,80,50,0.25)';
    ctx.shadowBlur = 30;
    fillRoundRect(ctx, x, y, width, height, theme.radius.panel, theme.colors.panel);
    ctx.restore();

    drawText(
      ctx,
      this.title,
      viewport.width / 2,
      y + 64,
      38,
      theme.colors.text,
      'center',
      'middle',
      true,
    );

    this.message.split('\n').forEach((line, index) => {
      drawText(
        ctx,
        line,
        viewport.width / 2,
        y + 130 + index * 40,
        26,
        theme.colors.textLight,
      );
    });

    const count = this.actions.length;
    const gap = 20;
    const buttonWidth = (width - 80 - gap * (count - 1)) / count;

    this.hitAreas = this.actions.map((action, index) => {
      const rect = {
        x: x + 40 + index * (buttonWidth + gap),
        y: y + height - 108,
        w: buttonWidth,
        h: 76,
      };
      fillRoundRect(
        ctx,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        theme.radius.button,
        action.primary ? theme.colors.primary : '#FFF2E4',
      );
      drawText(
        ctx,
        action.label,
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
        28,
        action.primary ? '#FFFFFF' : theme.colors.text,
        'center',
        'middle',
        true,
      );
      return { rect, action };
    });
  }

  tap(x: number, y: number): boolean {
    if (!this.visible) return false;
    suppressTaps();
    for (const area of this.hitAreas) {
      if (contains(area.rect, x, y)) {
        this.visible = false;
        void area.action.onPress();
        return true;
      }
    }
    return true;
  }
}
