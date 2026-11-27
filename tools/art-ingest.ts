/**
 * 美术素材接入脚本
 *
 *   npm run art:check   只校验 art_src/，不写任何文件
 *   npm run art:ingest  校验 + 缩放写入 assets/images/ + 更新 assets/manifest.json
 *
 * 支持的文件名（大小写不敏感）：
 *   bowl.png / bowl_body.png / 杯子.png            → bowl.body
 *   strawberry.png / layer_strawberry.png / 草莓.png → layer.strawberry
 *   bg.png / background.png / 背景.png              → bg
 *
 * 依赖：sharp（npm i -D sharp）
 */
import { readFile, readdir, writeFile, access } from 'node:fs/promises';
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

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

function normalizeName(name: string): string {
  return name
    .replace(/\.(png|jpe?g|webp)$/i, '')
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

/** 只去掉与画面边缘相连的近白底，保留内部白色高光 */
async function removeWhiteBackground(buf: Uint8Array): Promise<{ buffer: Uint8Array; removedRatio: number }> {
  const img = sharp(buf).ensureAlpha().raw();
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const px = new Uint8Array(data);

  const isBg = (i: number): boolean => {
    const o = i * channels;
    const r = px[o], g = px[o + 1], b = px[o + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return (r + g + b) / 3 > 243 && mx - mn <= 14;
  };

  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x += 1) {
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (isBg(i) && !seen[i]) { seen[i] = 1; stack.push(i); }
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (isBg(i) && !seen[i]) { seen[i] = 1; stack.push(i); }
    }
  }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % w, y = (i - x) / w;
    const neighbours: number[] = [
      x > 0 ? i - 1 : -1,
      x < w - 1 ? i + 1 : -1,
      y > 0 ? i - w : -1,
      y < h - 1 ? i + w : -1,
    ];
    for (const j of neighbours) {
      if (j >= 0 && !seen[j] && isBg(j)) { seen[j] = 1; stack.push(j); }
    }
  }

  let removed = 0;
  for (let i = 0; i < w * h; i += 1) {
    if (!seen[i]) continue;
    px[i * channels + 3] = 0;
    removed += 1;
  }

  return {
    buffer: await sharp(Buffer.from(px), { raw: { width: w, height: h, channels } })
      .png()
      .toBuffer(),
    removedRatio: removed / (w * h),
  };
}

/** 等比缩放并居中放进目标画布 */
async function placeOnCanvas(buf: Uint8Array, targetW: number, targetH: number): Promise<Uint8Array> {
  const { width: sw, height: sh } = await sharp(buf).metadata();
  const scale = Math.min(targetW / sw, targetH / sh);
  const nw = Math.max(1, Math.round(sw * scale));
  const nh = Math.max(1, Math.round(sh * scale));

  const resized = await sharp(buf)
    .resize(nw, nh, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer();

  return sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: Math.round((targetW - nw) / 2), top: Math.round((targetH - nh) / 2) }])
    .png()
    .toBuffer();
}

/** 右下角区域是否还有灰字（水印残留）
 *  水印特征：紧贴右下角的一小片「无彩色」灰色文字，周围是大片空白。
 *  只看最底部 7%、右侧 20% 的区域，避免把画面里的灰色描边误判成水印。
 */
async function detectWatermark(buf: Uint8Array): Promise<number> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const x0 = Math.floor(w * 0.8), y0 = Math.floor(h * 0.93);
  let total = 0;
  let blank = 0;
  let greyText = 0;
  for (let y = y0; y < h; y += 1) {
    for (let x = x0; x < w; x += 1) {
      const o = (y * w + x) * channels;
      total += 1;
      const r = data[o], g = data[o + 1], b = data[o + 2], alpha = data[o + 3];
      if (alpha < 8) { blank += 1; continue; }
      const mean = (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (mean > 243) { blank += 1; continue; }
      // 灰色字：偏暗且几乎无色
      if (mean < 232 && sat <= 12) greyText += 1;
    }
  }
  if (total === 0) return 0;
  // 区域大部分是空白，却有一撮灰色文字 → 判为水印
  if (blank / total < 0.75) return 0;
  return greyText;
}

async function main() {
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

  const found = new Map();
  const unknown = [];
  for (const file of files) {
    const key = resolveKey(file);
    if (!key) { unknown.push(file); continue; }
    if (found.has(key)) {
      console.warn(`⚠ 重复：${key} 同时由 ${found.get(key).file} 和 ${file} 提供，忽略后者`);
      continue;
    }
    found.set(key, { file });
  }

  const missing = Object.keys(TARGETS).filter(k => !found.has(k));
  const problems: string[] = [];
  const results: Array<{ key: string; file: string; target: { w: number; h: number; file: string } }> = [];

  console.log(`\n扫描 ${SRC_DIR}/ → 识别 ${found.size}/${Object.keys(TARGETS).length} 个 key\n`);

  for (const [key, { file }] of found) {
    const target = TARGETS[key];
    const path = join(SRC_DIR, file);
    let buf: Uint8Array = await readFile(path);
    const meta = await sharp(buf).metadata();

    const wm = await detectWatermark(buf);
    if (wm > 40) problems.push(`${file}: 右下角疑似残留水印/文字（${wm} 像素）`);

    if (key !== 'bg') {
      const { buffer, removedRatio } = await removeWhiteBackground(buf);
      if (removedRatio > 0.02) buf = buffer;
    }

    const outW = target.w * SCALE;
    const outH = target.h * SCALE;
    const final = await placeOnCanvas(buf, outW, outH);
    const finalMeta = await sharp(final).metadata();

    const srcRatio = meta.width / meta.height;
    const dstRatio = target.w / target.h;
    const ratioDrift = Math.abs(srcRatio - dstRatio) / dstRatio;
    if (ratioDrift > 0.15) {
      problems.push(
        `${file}: 宽高比 ${srcRatio.toFixed(2)} 与目标 ${dstRatio.toFixed(2)} 偏差 ${(ratioDrift * 100).toFixed(0)}%，入包后会留白`,
      );
    }

    const hasAlpha = finalMeta.hasAlpha;
    if (key !== 'bg' && !hasAlpha) problems.push(`${file}: 缺少透明通道`);

    if (write) {
      await writeFile(join(OUT_DIR, target.file), Buffer.from(final));
    }

    results.push({ key, file, target });
    console.log(
      `✓ ${key.padEnd(22)} ${file.padEnd(28)} ${String(meta.width).padStart(5)}x${String(meta.height).padEnd(5)}`
      + ` → ${outW}x${outH}${wm > 40 ? '  ⚠ 水印' : ''}`,
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
    const manifestPath = MANIFEST;
    interface ManifestImage { key: string; src: string; width: number; height: number }
    let manifest: { images: ManifestImage[]; audio: Record<string, string> } = { images: [], audio: {} };
    if (await exists(manifestPath)) {
      try {
        const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
        manifest = {
          images: Array.isArray(parsed.images) ? parsed.images : [],
          audio: parsed.audio && typeof parsed.audio === 'object' ? parsed.audio : {},
        };
      } catch {
        /* 保持默认值 */
      }
    }
    const images = manifest.images.filter(i => !results.some(r => r.key === i.key));
    for (const { key, target } of results) {
      images.push({
        key,
        src: `${OUT_DIR}/${target.file}`,
        width: target.w,
        height: target.h,
      });
    }
    manifest.images = images;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`\n已写入 ${results.length} 张图 → ${OUT_DIR}/，更新 ${MANIFEST}`);
  } else {
    console.log('\n（只检查，未写文件。加 --write 或运行 npm run art:ingest 应用）');
  }

  if (missing.length || problems.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});