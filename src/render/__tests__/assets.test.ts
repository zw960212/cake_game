import { describe, expect, it } from 'vitest';
import { Assets, parseManifest } from '../assets';

describe('parseManifest', () => {
  it('keeps valid image and audio entries', () => {
    const manifest = parseManifest({
      images: [
        {
          key: 'bowl.body',
          src: 'assets/images/bowl_body.png',
          width: 100,
          height: 200,
          slice: [1, 2, 3, 4],
        },
      ],
      audio: { bgm: 'assets/audio/bgm.mp3', bad: 3 },
    });
    expect(manifest.images).toHaveLength(1);
    expect(manifest.images[0]).toEqual({
      key: 'bowl.body',
      src: 'assets/images/bowl_body.png',
      width: 100,
      height: 200,
      slice: [1, 2, 3, 4],
    });
    expect(manifest.audio).toEqual({ bgm: 'assets/audio/bgm.mp3' });
  });

  it('ignores malformed input', () => {
    expect(parseManifest(null)).toEqual({ images: [], audio: {} });
    expect(parseManifest({ images: [{ key: 1 }], audio: [] })).toEqual({
      images: [],
      audio: {},
    });
  });
});

describe('Assets', () => {
  it('loads images and reports missing keys', async () => {
    const assets = new Assets(async src => ({ src }));
    await assets.load({
      images: [{ key: 'x', src: 'x.png', width: 10, height: 20 }],
      audio: {},
    });
    expect(assets.image('x')?.width).toBe(10);
    expect(assets.image('missing')).toBeUndefined();
  });

  it('keeps running when an image fails to load', async () => {
    const assets = new Assets(async () => {
      throw new Error('load fail');
    });
    await assets.load({
      images: [{ key: 'x', src: 'x.png', width: 10, height: 20 }],
      audio: {},
    });
    expect(assets.image('x')).toBeUndefined();
  });
});
