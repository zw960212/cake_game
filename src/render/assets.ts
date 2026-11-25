import { isRecord } from '../utils/validate';

export interface ManifestImage {
  key: string;
  src: string;
  width: number;
  height: number;
  slice?: [number, number, number, number];
}

export interface Manifest {
  images: ManifestImage[];
  audio: Record<string, string>;
}

export interface LoadedImage {
  source: any;
  width: number;
  height: number;
}

export interface ImageLookup {
  image(key: string): LoadedImage | undefined;
}

export type ImageLoader = (src: string) => Promise<any>;

function isSlice(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(item => typeof item === 'number')
  );
}

export function parseManifest(raw: unknown): Manifest {
  const manifest: Manifest = { images: [], audio: {} };
  if (!isRecord(raw)) return manifest;

  if (Array.isArray(raw.images)) {
    for (const item of raw.images) {
      if (!isRecord(item)) continue;
      const { key, src, width, height } = item;
      if (
        typeof key !== 'string' ||
        typeof src !== 'string' ||
        typeof width !== 'number' ||
        typeof height !== 'number'
      ) {
        continue;
      }
      const image: ManifestImage = { key, src, width, height };
      if (isSlice(item.slice)) image.slice = item.slice;
      manifest.images.push(image);
    }
  }

  if (isRecord(raw.audio)) {
    for (const [key, src] of Object.entries(raw.audio)) {
      if (typeof src === 'string') manifest.audio[key] = src;
    }
  }

  return manifest;
}

function wxImageLoader(src: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const image = wx.createImage();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    image.src = src;
  });
}

export class Assets {
  private readonly images = new Map<string, LoadedImage>();
  private readonly audioPaths = new Map<string, string>();

  constructor(private readonly loadImage: ImageLoader = wxImageLoader) {}

  async load(manifest: Manifest): Promise<void> {
    for (const [key, src] of Object.entries(manifest.audio)) {
      this.audioPaths.set(key, src);
    }

    await Promise.all(
      manifest.images.map(async item => {
        try {
          const source = await this.loadImage(item.src);
          this.images.set(item.key, {
            source,
            width: item.width,
            height: item.height,
          });
        } catch (error) {
          console.warn(`[assets] ${item.key} 加载失败，使用占位绘制`, error);
        }
      }),
    );
  }

  image(key: string): LoadedImage | undefined {
    return this.images.get(key);
  }

  audio(key: string): string | undefined {
    return this.audioPaths.get(key);
  }
}
