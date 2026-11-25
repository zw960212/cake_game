import type { Rect } from '../../utils/geometry';
import { contains } from '../../utils/geometry';
import type { Viewport } from '../../render/canvas';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';
import { suppressTaps } from './tapGuard';

export interface SettingsValues {
  sound: boolean;
  music: boolean;
  haptic: boolean;
}

export class SettingsModal {
  visible = false;
  private hitAreas: Array<{ rect: Rect; onPress: () => void }> = [];

  constructor(
    private readonly getValues: () => SettingsValues,
    private readonly patch: (values: Partial<SettingsValues>) => void,
    private readonly onReset: () => void,
  ) {}

  open(): void {
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    if (!this.visible) return;

    ctx.fillStyle = 'rgba(60,40,30,0.38)';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    const width = 620;
    const height = 560;
    const x = (viewport.width - width) / 2;
    const y = (viewport.height - height) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(120,80,50,0.25)';
    ctx.shadowBlur = 30;
    fillRoundRect(ctx, x, y, width, height, theme.radius.panel, theme.colors.panel);
    ctx.restore();

    drawText(
      ctx,
      '设置',
      viewport.width / 2,
      y + 62,
      38,
      theme.colors.text,
      'center',
      'middle',
      true,
    );

    const values = this.getValues();
    const rows: Array<{ label: string; value: string; onPress: () => void }> = [
      {
        label: '音效',
        value: values.sound ? '开' : '关',
        onPress: () => this.patch({ sound: !values.sound }),
      },
      {
        label: '音乐',
        value: values.music ? '开' : '关',
        onPress: () => this.patch({ music: !values.music }),
      },
      {
        label: '震动',
        value: values.haptic ? '开' : '关',
        onPress: () => this.patch({ haptic: !values.haptic }),
      },
    ];

    this.hitAreas = [];
    rows.forEach((row, index) => {
      const rect = { x: x + 40, y: y + 120 + index * 84, w: width - 80, h: 68 };
      fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, '#FFF6EC');
      drawText(ctx, row.label, rect.x + 32, rect.y + rect.h / 2, 28, theme.colors.text, 'left');
      drawText(
        ctx,
        row.value,
        rect.x + rect.w - 32,
        rect.y + rect.h / 2,
        28,
        theme.colors.textLight,
        'right',
      );
      this.hitAreas.push({ rect, onPress: row.onPress });
    });

    const resetRect = {
      x: x + 40,
      y: y + 120 + rows.length * 84 + 12,
      w: width - 80,
      h: 62,
    };
    drawText(
      ctx,
      '重置进度',
      x + width / 2,
      resetRect.y + resetRect.h / 2,
      26,
      theme.colors.danger,
    );
    this.hitAreas.push({
      rect: resetRect,
      onPress: () => {
        this.close();
        this.onReset();
      },
    });

    const closeRect = {
      x: x + 40,
      y: y + height - 108,
      w: width - 80,
      h: 76,
    };
    fillRoundRect(
      ctx,
      closeRect.x,
      closeRect.y,
      closeRect.w,
      closeRect.h,
      theme.radius.button,
      theme.colors.primary,
    );
    drawText(
      ctx,
      '关闭',
      x + width / 2,
      closeRect.y + closeRect.h / 2,
      30,
      '#FFFFFF',
      'center',
      'middle',
      true,
    );
    this.hitAreas.push({ rect: closeRect, onPress: () => this.close() });
  }

  tap(x: number, y: number): boolean {
    if (!this.visible) return false;
    suppressTaps();
    for (const area of this.hitAreas) {
      if (contains(area.rect, x, y)) {
        area.onPress();
        return true;
      }
    }
    return true;
  }
}
