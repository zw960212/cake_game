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

export function bowlMetrics(rect: Rect, profile?: Array<[number, number]>): BowlMetrics {
  const pad = Math.max(4, rect.w * 0.07);
  const rim = Math.max(10, rect.h * 0.07);
  const innerW = rect.w - pad * 2;

  // 有杯身轮廓时，用轮廓决定堆叠的上下边界：
  // 杯底的圆弧透视和杯口都要避开，否则最底层会戳出杯底。
  let top = rect.y + pad + rim;
  let bottom = rect.y + rect.h - pad;
  if (profile && profile.length > 0) {
    const span = (b: [number, number]): number => b[1] - b[0];
    const widest = Math.max(...profile.map(span));
    const threshold = widest * 0.55;   // 明显收窄的带才算杯口/杯底
    let first = 0;
    let last = profile.length - 1;
    while (first < profile.length && span(profile[first]) < threshold) first += 1;
    while (last > first && span(profile[last]) < threshold) last -= 1;
    if (first < last) {
      top = rect.y + (first / profile.length) * rect.h;
      bottom = rect.y + ((last + 1) / profile.length) * rect.h;
    }
  }

  const innerH = Math.max(rect.h * 0.3, bottom - top);
  const layerH = innerH / 4;
  const bottomY = bottom;
  return { pad, innerW, innerH, layerH, bottomY };
}

/**
 * 在指定高度查杯身轮廓的内边界（设计像素）。
 * 杯身是酸奶瓶那种「细颈鼓腹」造型，层块如果按满宽画会戳出杯壁，
 * 所以按 profile 分带收窄。没有 profile 时回退到统一的 pad 内缩。
 */
function layerBounds(
  rect: Rect,
  metrics: BowlMetrics,
  y: number,
  h: number,
  profile?: Array<[number, number]>,
): { x: number; w: number } {
  if (!profile || profile.length === 0) {
    return { x: rect.x + metrics.pad, w: metrics.innerW };
  }
  const centerY = y + h / 2;
  const t = (centerY - rect.y) / rect.h;
  const index = Math.max(
    0,
    Math.min(profile.length - 1, Math.round(t * (profile.length - 1))),
  );
  const [left, right] = profile[index];
  // 再内缩一点点，避免贴到描边上
  const inset = rect.w * 0.012;
  const x = rect.x + left * rect.w + inset;
  const w = Math.max(4, (right - left) * rect.w - inset * 2);
  return { x, w };
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
  const body = images?.image('bowl.body');
  const metrics = bowlMetrics(rect, body?.profile);

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
    const h = metrics.layerH - 4;
    const bounds = layerBounds(rect, metrics, y, h, body?.profile);
    const layerImage = images?.image(`layer.${layers[index]}`);

    // 贴图边缘有波浪和投影，直接画会溢出杯壁；这一层单独裁切。
    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.x, rect.y, bounds.w, rect.h);
    ctx.clip();
    if (layerImage) {
      ctx.drawImage(layerImage.source, bounds.x, y, bounds.w, h);
    } else {
      drawFlavorLayer(ctx, bounds.x, y, bounds.w, h, layers[index]);
    }
    ctx.restore();
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
