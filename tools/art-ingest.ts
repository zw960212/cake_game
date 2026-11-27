/**
 * 美术素材接入脚本
 *
 *   npm run art:check   只校验 art_src/，不写任何文件
 *   npm run art:ingest  校验 + 擦水印 + 去背景 + 缩放，写入 assets/images/ 并更新 manifest
 *
 * 支持的文件名（大小写、横线、下划线、空格都无所谓）：
 *   bowl.png / bowl_body.png / 杯子.png                 → bowl.body
 *   strawberry.png / layer_strawberry.png / 草莓.png    → layer.strawberry
 *   bg.png / background.png / 背景.png                  → bg
 *
 * 为了兼容 AI 出图，脚本会自动：
 *   - 擦掉右下角的「豆包 AI 生成」类水印（只在空白区域生效）
 *   - 去掉背景（支持纯色和渐变，保留层块内部的白色高光）
 *   - 按内容裁切，等比缩放居中放进目标画布
 */
import { readFile, readdir, writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC_DIR = 'art_src';
const OUT_DIR = 'assets/images';
const MANIFEST = 'assets/manifest.json';

const FLAVORS = [
  'strawberry', 'mango', 'cocoa', 'matcha', 'blueberry', 'vanilla',
  'caramel', 'cherry', 'lemon', 'taro', 'peach',
];

const FLAVOR_ZH: Record<string, string> = {
  strawberry: '草莓', mango: '芒果', cocoa: '可可', matcha: '抹茶',
  blueberry: '蓝莓', vanilla: '香草', caramel: '焦糖', cherry: '樱桃',
  lemon: '柠檬', taro: '紫薯', peach: '蜜桃',
};

interface Target { w: number; h: number; file: string }

/** 逻辑尺寸（750 设计宽的 1 倍） */
const TARGETS: Record<string, Target> = {
  'bowl.body': { w: 132, h: 240, file: 'bowl_body.png' },
  bg: { w: 750, h: 1400, file: 'bg.png' },
  ...Object.fromEntries(
    FLAVORS.map(f => [`layer.${f}`, { w: 114, h: 47, file: `layer_${f}.png` }]),
  ),
};

/** 源图导出倍数：2 倍逻辑尺寸 */
const SCALE = 2;

interface ManifestImage {
  key: string;
  src: string;
  width: number;
  height: number;
  /** 杯身轮廓：按高度分带的左右内边界（0..1），供层块收窄使用 */
  profile?: Array<[number, number]>;
}
interface Manifest { images: ManifestImage[]; audio: Record<string, string> }

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

function normalizeName(name: string): string {
  return name
    .replace(/\.(png|jpe?g|webp)$/i, '')
    .replace(/\(\d+\)$/, '')          // 去掉 "1 (1)" 这类重复下载后缀
    .replace(/^layer[_-]?/i, '')
    .replace(/[_\-\s]/g, '')
    .toLowerCase();
}

/** 文件名 → 逻辑 key */
function resolveKey(file: string): string | null {
  const base = normalizeName(file);
  if (!base) return null;
  if (['bowl', 'bowlbody', 'cup', '杯子', '空杯', '杯身'].includes(base)) return 'bowl.body';
  if (['bg', 'background', '背景', '背景图'].includes(base)) return 'bg';
  for (const flavor of FLAVORS) {
    if (base === flavor) return `layer.${flavor}`;
    if (base === FLAVOR_ZH[flavor]) return `layer.${flavor}`;
  }
  return null;
}

interface Pixels { data: Buffer; width: number; height: number; channels: number }

/**
 * 计算杯身轮廓的左右内边界（按高度分带）。
 * 结果写进 manifest，绘制层块时按所在高度收窄，层块就不会戳出杯壁。
 * 返回归一化坐标 [[left, right], ...]，0..1，从左到右。
 */
async function measureCupProfile(input: Uint8Array, bands = 24): Promise<Array<[number, number]>> {
  const p = await readPixels(input);
  const { data, width: w, height: h, channels: c } = p;

  // 逐行取不透明像素的左右边界
  const rowL = new Int32Array(h).fill(-1);
  const rowR = new Int32Array(h).fill(-1);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * c + 3] > 40) { rowL[y] = x; break; }
    }
    for (let x = w - 1; x >= 0; x -= 1) {
      if (data[(y * w + x) * c + 3] > 40) { rowR[y] = x; break; }
    }
  }

  // 分带取中位数，抗噪
  const raw: Array<[number, number] | null> = [];
  for (let b = 0; b < bands; b += 1) {
    const y0 = Math.floor((b * h) / bands);
    const y1 = Math.max(y0 + 1, Math.floor(((b + 1) * h) / bands));
    const ls: number[] = [], rs: number[] = [];
    for (let y = y0; y < y1; y += 1) {
      if (rowL[y] >= 0) { ls.push(rowL[y]); rs.push(rowR[y]); }
    }
    raw.push(ls.length ? [median(ls) / w, (median(rs) + 1) / w] : null);
  }

  // 空带用最近的有效带线性插值补齐（杯口/杯底常有全透明行）
  const result: Array<[number, number]> = [];
  for (let b = 0; b < bands; b += 1) {
    if (raw[b]) { result.push(raw[b] as [number, number]); continue; }
    let prev = b - 1, next = b + 1;
    while (prev >= 0 && !raw[prev]) prev -= 1;
    while (next < bands && !raw[next]) next += 1;
    if (prev >= 0 && next < bands) {
      const a = raw[prev] as [number, number];
      const z = raw[next] as [number, number];
      const t = (b - prev) / (next - prev);
      result.push([a[0] + (z[0] - a[0]) * t, a[1] + (z[1] - a[1]) * t]);
    } else if (prev >= 0) {
      result.push(raw[prev] as [number, number]);
    } else if (next < bands) {
      result.push(raw[next] as [number, number]);
    } else {
      result.push([0, 1]);
    }
  }
  return result;
}

async function readPixels(input: Uint8Array): Promise<Pixels> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), width: info.width, height: info.height, channels: info.channels };
}

async function writePixels(p: Pixels): Promise<Uint8Array> {
  return sharp(p.data, { raw: { width: p.width, height: p.height, channels: p.channels as 4 } })
    .png()
    .toBuffer();
}

const median = (values: number[]): number => {
  if (values.length === 0) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};

/**
 * 擦除右下角水印。
 * 只在水印区域「大部分是空白」时动手，避免破坏正常画面。
 * 用 bbox 外圈的中值色填充，所以渐变背景也能自然接上。
 */
async function eraseWatermark(input: Uint8Array): Promise<{ buffer: Uint8Array; erased: number; bbox: [number, number, number, number] | null }> {
  const p = await readPixels(input);
  const { data, width: w, height: h, channels: c } = p;
  const x0 = Math.floor(w * 0.72);
  const y0 = Math.floor(h * 0.82);

  let minX = w, minY = h, maxX = -1, maxY = -1;
  let hits = 0;
  for (let y = y0; y < h; y += 1) {
    for (let x = x0; x < w; x += 1) {
      const o = (y * w + x) * c;
      if (data[o + 3] < 8) continue;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const mean = (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      // 水印是「偏暗的无彩色文字」
      if (mean < 243 && sat <= 13) {
        hits += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const boxArea = (maxX - minX + 1) * (maxY - minY + 1);
  const looksLikeWatermark = hits >= 200 && boxArea > 0 && boxArea < w * h * 0.08;
  if (!looksLikeWatermark) return { buffer: input, erased: 0, bbox: null };

  // 不修补像素——只把范围交给去背阶段处理。
  // 水印本来就落在空白角落，让它跟背景一起变透明最干净，不会有接缝。
  return {
    buffer: input,
    erased: hits,
    bbox: [Math.max(0, minX - 10), Math.max(0, minY - 10), Math.min(w - 1, maxX + 10), Math.min(h - 1, maxY + 10)],
  };
}

/**
 * 去背景。
 * 逐行/逐列用边缘色插值估算背景（能处理渐变），再按色差生成柔和 alpha。
 * 因为是「按位置估算」而不是「按颜色匹配」，层块内部的白色高光不会被挖掉。
 */
async function removeBackground(input: Uint8Array, wmBox: [number, number, number, number] | null): Promise<{ buffer: Uint8Array; removedRatio: number }> {
  const p = await readPixels(input);
  const { data, width: w, height: h, channels: c } = p;

  const edgeSamples = (coords: Array<[number, number]>): readonly [number, number, number] | null => {
    const rs: number[] = [], gs: number[] = [], bs: number[] = [];
    for (const [x, y] of coords) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const o = (y * w + x) * c;
      if (data[o + 3] < 8) continue;
      rs.push(data[o]); gs.push(data[o + 1]); bs.push(data[o + 2]);
    }
    return rs.length ? [median(rs), median(gs), median(bs)] as const : null;
  };

  const DEPTH = 5;
  const left: Array<readonly [number, number, number] | null> = [];
  const right: Array<readonly [number, number, number] | null> = [];
  for (let y = 0; y < h; y += 1) {
    left.push(edgeSamples(Array.from({ length: DEPTH }, (_, d) => [d, y] as [number, number])));
    right.push(edgeSamples(Array.from({ length: DEPTH }, (_, d) => [w - 1 - d, y] as [number, number])));
  }
  const top: Array<readonly [number, number, number] | null> = [];
  const bottom: Array<readonly [number, number, number] | null> = [];
  for (let x = 0; x < w; x += 1) {
    top.push(edgeSamples(Array.from({ length: DEPTH }, (_, d) => [x, d] as [number, number])));
    bottom.push(edgeSamples(Array.from({ length: DEPTH }, (_, d) => [x, h - 1 - d] as [number, number])));
  }

  const nearestBg = (x: number, y: number): readonly [number, number, number] | null => {
    const l = left[y], r = right[y];
    const cands: Array<readonly [number, number, number]> = [];
    if (l && r) {
      const t = w === 1 ? 0 : x / (w - 1);
      cands.push([l[0] + (r[0] - l[0]) * t, l[1] + (r[1] - l[1]) * t, l[2] + (r[2] - l[2]) * t]);
    }
    const tp = top[x], bt = bottom[x];
    if (tp && bt) {
      const t = h === 1 ? 0 : y / (h - 1);
      cands.push([tp[0] + (bt[0] - tp[0]) * t, tp[1] + (bt[1] - tp[1]) * t, tp[2] + (bt[2] - tp[2]) * t]);
    }
    if (cands.length === 0) return null;
    const o = (y * w + x) * c;
    const pr = data[o], pg = data[o + 1], pb = data[o + 2];
    cands.sort((A, B) =>
      (Math.abs(pr - A[0]) + Math.abs(pg - A[1]) + Math.abs(pb - A[2]))
      - (Math.abs(pr - B[0]) + Math.abs(pg - B[1]) + Math.abs(pb - B[2])));
    return cands[0];
  };

  const LOW = 14;   // 色差 < LOW：判为背景（连通的才删）
  const SOFT = 40;  // 边界柔和过渡的最大色差
  const edge = 2;   // 柔和过渡只作用于边界几像素内

  // 第一遍：每像素到背景估计色的最小色差
  const dist = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const l = left[y], r = right[y];
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * c;
      const pr = data[o], pg = data[o + 1], pb = data[o + 2];
      let best = Number.POSITIVE_INFINITY;
      if (l && r) {
        const t = w === 1 ? 0 : x / (w - 1);
        best = Math.min(best,
          Math.abs(pr - (l[0] + (r[0] - l[0]) * t))
          + Math.abs(pg - (l[1] + (r[1] - l[1]) * t))
          + Math.abs(pb - (l[2] + (r[2] - l[2]) * t)));
      }
      const tp = top[x], bt = bottom[x];
      if (tp && bt) {
        const t = h === 1 ? 0 : y / (h - 1);
        best = Math.min(best,
          Math.abs(pr - (tp[0] + (bt[0] - tp[0]) * t))
          + Math.abs(pg - (tp[1] + (bt[1] - tp[1]) * t))
          + Math.abs(pb - (tp[2] + (bt[2] - tp[2]) * t)));
      }
      // 水印区域里的灰色文字直接判为背景，跟着背景一起透明
      if (wmBox && x >= wmBox[0] && x <= wmBox[2] && y >= wmBox[1] && y <= wmBox[3]) {
        const mean = (pr + pg + pb) / 3;
        const sat = Math.max(pr, pg, pb) - Math.min(pr, pg, pb);
        if (mean < 243 && sat <= 13) best = 0;
      }
      dist[y * w + x] = Number.isFinite(best) ? best : 255;
    }
  }

  // 第二遍：从边缘泛洪，只吃掉「与边缘连通」且色差小的区域
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number): void => {
    if (!outside[i] && dist[i] <= LOW) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x += 1) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y += 1) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  // 第三遍：背景 -> 透明；边界 band -> 柔和；其余（含内部浅色区域）一律不透明
  const isOutside = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && outside[y * w + x] === 1;

  let removed = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const o = i * c;
      if (outside[i]) {
        data[o + 3] = 0;
        removed += 1;
        continue;
      }
      // 边界带：与背景相邻 edge 像素以内
      let nearBg = false;
      for (let dy = -edge; dy <= edge && !nearBg; dy += 1) {
        for (let dx = -edge; dx <= edge; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          if (isOutside(x + dx, y + dy)) { nearBg = true; break; }
        }
      }
      if (!nearBg) { data[o + 3] = 255; continue; }

      const d = dist[i];
      if (d >= SOFT) { data[o + 3] = 255; continue; }

      const a = Math.max(0, Math.min(1, (d - LOW) / (SOFT - LOW)));
      data[o + 3] = Math.round(a * 255);
      // 反预乘，去掉边缘混入的背景色
      if (a > 0.05) {
        const bg = nearestBg(x, y);
        if (bg) {
          data[o] = Math.max(0, Math.min(255, Math.round((data[o] - bg[0] * (1 - a)) / a)));
          data[o + 1] = Math.max(0, Math.min(255, Math.round((data[o + 1] - bg[1] * (1 - a)) / a)));
          data[o + 2] = Math.max(0, Math.min(255, Math.round((data[o + 2] - bg[2] * (1 - a)) / a)));
        }
      }
    }
  }

  return { buffer: await writePixels(p), removedRatio: removed / (w * h) };
}

/** 填补内部空洞：透明但「不与画面边缘连通」的区域恢复为不透明。
 *  透明玻璃杯的高光与纯白背景同色，去背景时会被误挖，这里补回来。
 *  RGB 数据没有被破坏，只是 alpha 被清零，所以直接恢复 alpha 即可。
 */
async function fillInteriorHoles(input: Uint8Array): Promise<{ buffer: Uint8Array; filled: number }> {
  const p = await readPixels(input);
  const { data, width: w, height: h, channels: c } = p;
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number): void => {
    if (data[i * c + 3] < 8 && !outside[i]) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x += 1) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y += 1) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  let filled = 0;
  for (let i = 0; i < w * h; i += 1) {
    if (data[i * c + 3] < 8 && !outside[i]) {
      data[i * c + 3] = 255;
      filled += 1;
    }
  }
  return { buffer: await writePixels(p), filled };
}

/** 按 alpha 裁掉四周空白 */
async function cropToContent(input: Uint8Array, pad = 4): Promise<Uint8Array> {
  const p = await readPixels(input);
  const { data, width: w, height: h, channels: c } = p;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * c + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return input;
  const left = Math.max(0, x0 - pad);
  const top = Math.max(0, y0 - pad);
  const width = Math.min(w - left, x1 - x0 + 1 + pad * 2);
  const height = Math.min(h - top, y1 - y0 + 1 + pad * 2);
  return sharp(input).extract({ left, top, width, height }).png().toBuffer();
}

/** 等比缩放并居中放进目标画布 */
async function placeOnCanvas(input: Uint8Array, targetW: number, targetH: number): Promise<Uint8Array> {
  const meta = await sharp(input).metadata();
  const sw = meta.width ?? targetW;
  const sh = meta.height ?? targetH;
  const scale = Math.min(targetW / sw, targetH / sh);
  const nw = Math.max(1, Math.round(sw * scale));
  const nh = Math.max(1, Math.round(sh * scale));
  const resized = await sharp(input).resize(nw, nh, { fit: 'fill', kernel: 'lanczos3' }).toBuffer();
  return sharp({
    create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left: Math.round((targetW - nw) / 2), top: Math.round((targetH - nh) / 2) }])
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');

  if (!(await exists(SRC_DIR))) {
    console.error(`找不到 ${SRC_DIR}/ 目录。请先创建它并把美术图放进去。`);
    process.exit(1);
  }

  const files = (await readdir(SRC_DIR)).filter(f => /\.(png|jpe?g|webp)$/i.test(f));
  if (files.length === 0) {
    console.error(`${SRC_DIR}/ 里没有图片文件。`);
    process.exit(1);
  }

  const found = new Map<string, string>();
  const unknown: string[] = [];
  for (const file of files) {
    const key = resolveKey(file);
    if (!key) { unknown.push(file); continue; }
    if (found.has(key)) {
      console.warn(`⚠ 重复：${key} 同时由 ${found.get(key)} 和 ${file} 提供，忽略后者`);
      continue;
    }
    found.set(key, file);
  }

  const missing = Object.keys(TARGETS).filter(k => !found.has(k));
  const problems: string[] = [];
  const results: Array<{ key: string; target: Target; profile?: Array<[number, number]> }> = [];

  console.log(`\n扫描 ${SRC_DIR}/ → 识别 ${found.size}/${Object.keys(TARGETS).length} 个 key\n`);

  for (const [key, file] of found) {
    const target = TARGETS[key];
    const path = join(SRC_DIR, file);
    const original = await readFile(path);
    const meta = await sharp(original).metadata();
    const srcRatio = (meta.width ?? 1) / (meta.height ?? 1);
    const dstRatio = target.w / target.h;
    const ratioDrift = Math.abs(srcRatio - dstRatio) / dstRatio;

    let buffer: Uint8Array = original;
    let erased = 0;
    let profile: Array<[number, number]> | undefined;

    if (key === 'bg') {
      // 背景不擦水印、不去背景，直接缩放到目标尺寸。
      // 背景没有透明需求，用 JPEG 压缩，体积能小一个数量级。
      buffer = await sharp(original)
        .resize(target.w * SCALE, target.h * SCALE, { fit: 'cover' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    } else {
      const wm = await eraseWatermark(buffer);
      buffer = wm.buffer;
      erased = wm.erased;

      const cut = await removeBackground(buffer, wm.bbox);
      buffer = cut.buffer;
      if (cut.removedRatio < 0.02) {
        problems.push(`${file}: 几乎没去掉背景（${(cut.removedRatio * 100).toFixed(1)}%），检查是否本来就是透明 PNG`);
      }
    }

    if (key === 'bowl.body') {
      profile = await measureCupProfile(buffer);
      const widest = Math.max(...profile.map(([l, r]) => r - l));
      const narrowest = Math.min(...profile.map(([l, r]) => r - l));
      console.log(`    ↳ 杯身轮廓: 最窄 ${(narrowest * 100).toFixed(0)}% 最宽 ${(widest * 100).toFixed(0)}%（层块会按此收窄）`);
    }

    if (key !== 'bg') {
      const holes = await fillInteriorHoles(buffer);
      buffer = holes.buffer;
      if (holes.filled > 0) console.log(`    ↳ ${key} 补回内部空洞 ${holes.filled}px`);
    }

    // 层块贴图必须严格裁到内容边界，去掉波浪外缘的投影和空隙，
    // 否则进游戏后画在杯壁边界上会溢出。
    const cropped = key === 'bg'
      ? buffer
      : key.startsWith('layer.')
        ? await cropToContent(buffer, 0)
        : await cropToContent(buffer);
    const placed = await placeOnCanvas(cropped, target.w * SCALE, target.h * SCALE);
    const final = key === 'bg'
      ? placed
      : await sharp(placed).png({ compressionLevel: 9, palette: false }).toBuffer();
    const finalMeta = await sharp(final).metadata();

    if (ratioDrift > 0.15) {
      problems.push(
        `${file}: 宽高比 ${srcRatio.toFixed(2)} 与目标 ${dstRatio.toFixed(2)} 偏差 ${(ratioDrift * 100).toFixed(0)}%，会留白`,
      );
    }
    if (key !== 'bg' && !finalMeta.hasAlpha) problems.push(`${file}: 缺少透明通道`);

    if (write) {
      await mkdir(OUT_DIR, { recursive: true });
      const outName = key === 'bg' ? target.file.replace(/\.png$/, '.jpg') : target.file;
      await writeFile(join(OUT_DIR, outName), Buffer.from(final));
    }

    results.push({ key, target, profile });
    console.log(
      `✓ ${key.padEnd(22)} ${file.padEnd(24)}`
      + `${String(meta.width).padStart(5)}x${String(meta.height).padEnd(5)}`
      + ` → ${target.w * SCALE}x${target.h * SCALE}`
      + (erased > 0 ? `  擦水印${erased}px` : '')
      + (ratioDrift > 0.15 ? '  ⚠ 比例偏差' : ''),
    );
  }

  if (unknown.length) {
    console.log(`\n跳过 ${unknown.length} 个无法识别的文件：`);
    for (const f of unknown) console.log(`  - ${f}`);
  }
  if (missing.length) {
    console.log(`\n缺少 ${missing.length} 个素材：`);
    for (const key of missing) console.log(`  - ${key}（${TARGETS[key].file}）`);
  }
  if (problems.length) {
    console.log('\n需要处理的问题：');
    for (const p of problems) console.log(`  ⚠ ${p}`);
  }

  if (write) {
    let manifest: Manifest = { images: [], audio: {} };
    if (await exists(MANIFEST)) {
      try {
        const parsed = JSON.parse(await readFile(MANIFEST, 'utf8'));
        manifest = {
          images: Array.isArray(parsed.images) ? parsed.images : [],
          audio: parsed.audio && typeof parsed.audio === 'object' ? parsed.audio : {},
        };
      } catch {
        /* 保持默认值 */
      }
    }
    const keys = new Set(results.map(r => r.key));
    manifest.images = manifest.images.filter(i => !keys.has(i.key));
    for (const { key, target, profile } of results) {
      const entry: ManifestImage = {
        key,
        src: `${OUT_DIR}/${key === 'bg' ? target.file.replace(/\.png$/, '.jpg') : target.file}`,
        width: target.w,
        height: target.h,
      };
      if (profile) entry.profile = profile;
      manifest.images.push(entry);
    }
    await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`\n已写入 ${results.length} 张图 → ${OUT_DIR}/，更新 ${MANIFEST}`);
  } else {
    console.log('\n（只检查，未写文件。运行 npm run art:ingest 应用）');
  }

  if (missing.length || problems.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});