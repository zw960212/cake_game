import type { FlavorId } from '../../core/types';
import type { Rect } from '../../utils/geometry';
import type { ImageLookup } from '../assets';
import { fillRoundRect, strokeRoundRect } from '../draw';
import { FLAVORS, theme } from '../theme';

export interface BowlMetrics {
  pad: number;
  innerW: number;
  innerH: number;
  layerH: number;
  bottomY: number;
}

export interface BowlOptions {
  selected?: boolean;
  highlight?: boolean;
  hiddenTop?: number;
  pop?: number;
  alpha?: number;
}

export function bowlMetrics(rect: Rect): BowlMetrics {
  const pad = Math.max(4, rect.w * 0.07);
  const rim = Math.max(10, rect.h * 0.07);
  const innerW = rect.w - pad * 2;
  const innerH = rect.h - pad * 2 - rim;
  const layerH = innerH / 4;
  const bottomY = rect.y + rect.h - pad;
  return { pad, innerW, innerH, layerH, bottomY };
}

export function drawFlavorLayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flavor: FlavorId,
): void {
  const style = FLAVORS[flavor] ?? {
    name: flavor,
    base: '#CFC0B2',
    dark: '#B0A08F',
    light: '#E6DCD2',
  };
  fillRoundRect(ctx, x, y, w, h, theme.radius.layer, style.base);

  ctx.save();
  ctx.globalAlpha = 0.45;
  fillRoundRect(ctx, x + 3, y + 3, w - 6, Math.max(2, h * 0.28), theme.radius.layer - 2, style.light);
  ctx.restore();
}

export function drawFlavorBlock(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  w: number,
  h: number,
  flavor: FlavorId,
  images?: ImageLookup,
): void {
  const x = centerX - w / 2;
  const y = centerY - h / 2;

  const image = images?.image(`layer.${flavor}`);
  if (image) {
    ctx.drawImage(image.source, x, y, w, h);
    return;
  }

  const style = FLAVORS[flavor] ?? {
    name: flavor,
    base: '#CFC0B2',
    dark: '#B0A08F',
    light: '#E6DCD2',
  };

  ctx.save();
  ctx.shadowColor = style.dark;
  ctx.shadowBlur = 12;
  fillRoundRect(ctx, x, y, w, h, theme.radius.layer, style.base);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.4;
  fillRoundRect(ctx, x + 4, y + 4, w - 8, Math.max(3, h * 0.2), theme.radius.layer, style.light);
  ctx.restore();
}

export function drawBowl(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  layers: ReadonlyArray<FlavorId>,
  options: BowlOptions = {},
  images?: ImageLookup,
): void {
  const metrics = bowlMetrics(rect);
  const body = images?.image('bowl.body');

  ctx.save();
  if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
  if (options.pop && options.pop !== 1) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h;
    ctx.translate(cx, cy);
    ctx.scale(1, options.pop);
    ctx.translate(-cx, -cy);
  }

  if (body) {
    ctx.save();
    ctx.shadowColor = 'rgba(196,140,100,0.18)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(body.source, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.shadowColor = 'rgba(196,140,100,0.18)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, theme.radius.bowl, '#FFFDF8');
    ctx.restore();
  }

  const visible = Math.max(0, layers.length - (options.hiddenTop ?? 0));
  for (let index = 0; index < visible; index += 1) {
    const y = metrics.bottomY - (index + 1) * metrics.layerH + 2;
    const layerImage = images?.image(`layer.${layers[index]}`);
    if (layerImage) {
      ctx.drawImage(
        layerImage.source,
        rect.x + metrics.pad,
        y,
        metrics.innerW,
        metrics.layerH - 4,
      );
    } else {
      drawFlavorLayer(
        ctx,
        rect.x + metrics.pad,
        y,
        metrics.innerW,
        metrics.layerH - 4,
        layers[index],
      );
    }
  }

  if (!body) {
    fillRoundRect(
      ctx,
      rect.x,
      rect.y,
      rect.w,
      Math.max(10, rect.h * 0.07),
      8,
      '#FFF1E4',
    );
  }

  const stroke = options.highlight
    ? theme.colors.highlight
    : options.selected
      ? theme.colors.primaryDark
      : 'rgba(214,180,150,0.6)';
  const width = options.highlight ? 6 : options.selected ? 4 : 2;

  ctx.save();
  if (options.highlight) {
    ctx.shadowColor = theme.colors.highlight;
    ctx.shadowBlur = 18;
  }
  strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, theme.radius.bowl, stroke, width);
  ctx.restore();

  ctx.restore();
}
