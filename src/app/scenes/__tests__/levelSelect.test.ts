import { describe, expect, it, vi } from 'vitest';
import type { Level } from '../../../core/types';
import type { App } from '../../app';
import { LevelSelectScene } from '../levelSelect';

interface RecordedCtx {
  ctx: CanvasRenderingContext2D;
  counts: Record<string, number>;
  fillTextCalls: unknown[][];
}

function createCtx(): RecordedCtx {
  const counts: Record<string, number> = {};
  const fillTextCalls: unknown[][] = [];
  const target: Record<string | symbol, unknown> = {
    createLinearGradient: () => ({ addColorStop() {} }),
  };

  const ctx = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];

      return (...args: unknown[]) => {
        if (typeof prop === 'string') {
          counts[prop] = (counts[prop] ?? 0) + 1;
          if (prop === 'fillText') fillTextCalls.push(args);
        }
      };
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, counts, fillTextCalls };
}

interface FakeApp {
  app: App;
  save: {
    version: 1;
    unlockedLevel: number;
    completedLevelIds: number[];
    settings: { sound: boolean; music: boolean; haptic: boolean };
  };
  startLevel: ReturnType<typeof vi.fn>;
  goHome: ReturnType<typeof vi.fn>;
}

function createApp(options: {
  width?: number;
  height?: number;
  unlockedLevel?: number;
  completedLevelIds?: number[];
} = {}): FakeApp {
  const width = options.width ?? 750;
  const height = options.height ?? 900;
  const levels: Level[] = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    difficulty: 'easy' as const,
    capacity: 4 as const,
    bowls: [],
    minMoves: 0,
  }));

  const save = {
    version: 1 as const,
    unlockedLevel: options.unlockedLevel ?? 30,
    completedLevelIds: options.completedLevelIds ?? [1],
    settings: { sound: true, music: true, haptic: true },
  };

  const startLevel = vi.fn();
  const goHome = vi.fn();

  const app = {
    viewport: {
      canvas: null,
      ctx: null,
      scale: 1,
      pixelScale: 1,
      width,
      height,
      safeTop: 40,
      safeBottom: 20,
    },
    assets: { image: () => null },
    save,
    levels: { version: 1 as const, capacity: 4 as const, levels },
    services: { audio: { playMusic: vi.fn() } },
    startLevel,
    goHome,
  } as unknown as App;

  return { app, save, startLevel, goHome };
}

describe('LevelSelectScene', () => {
  it('clips the grid to the scroll viewport and clamps scroll range', () => {
    const { app } = createApp();
    const scene = new LevelSelectScene(app);
    const { ctx, counts } = createCtx();

    scene.render(ctx);

    expect((scene as unknown as { maxScroll: number }).maxScroll).toBeGreaterThan(0);
    expect((scene as unknown as { cells: unknown[] }).cells).toHaveLength(30);
    expect(counts.clip ?? 0).toBeGreaterThan(0);
  });

  it('does not start a hidden level when tapping the header after scrolling', () => {
    const { app, startLevel } = createApp();
    const scene = new LevelSelectScene(app);
    const { ctx } = createCtx();

    scene.render(ctx);

    scene.onTouchStart(200, 700);
    scene.onTouchMove(200, 500);
    scene.onTouchEnd(200, 500);
    expect((scene as unknown as { scrollY: number }).scrollY).toBe(200);

    // Re-render so cell rects reflect the scrolled position.
    scene.render(ctx);

    // (375, 50) is inside the header, outside the grid viewport, and would
    // have matched a scrolled-away row-0 cell before hit clipping was added.
    scene.onTouchStart(375, 50);
    scene.onTouchEnd(375, 50);

    expect(startLevel).not.toHaveBeenCalled();
  });

  it('returns home when the back button is tapped', () => {
    const { app, goHome, startLevel } = createApp();
    const scene = new LevelSelectScene(app);
    const { ctx } = createCtx();

    scene.render(ctx);
    const back = (scene as unknown as { backRect: { x: number; y: number; w: number; h: number } })
      .backRect;

    scene.onTouchStart(back.x + back.w / 2, back.y + back.h / 2);
    scene.onTouchEnd(back.x + back.w / 2, back.y + back.h / 2);

    expect(goHome).toHaveBeenCalledTimes(1);
    expect(startLevel).not.toHaveBeenCalled();
  });

  it('ignores locked cells and starts an unlocked cell after unlock', () => {
    const { app, save, startLevel } = createApp({ unlockedLevel: 1 });
    const scene = new LevelSelectScene(app);
    const { ctx } = createCtx();

    scene.render(ctx);

    // Second cell center at scrollY 0: x = 32 + 1 * (124.4 + 16) + 62.2,
    // y = (safeTop + 120) + 148 / 2.
    scene.onTouchStart(234.6, 234);
    scene.onTouchEnd(234.6, 234);
    expect(startLevel).not.toHaveBeenCalled();

    save.unlockedLevel = 30;
    scene.render(ctx);

    scene.onTouchStart(234.6, 234);
    scene.onTouchEnd(234.6, 234);
    expect(startLevel).toHaveBeenCalledWith(2);
  });

  it('does not scroll when the content fits the viewport', () => {
    const { app } = createApp({ height: 1334 });
    const scene = new LevelSelectScene(app);
    const { ctx } = createCtx();

    scene.render(ctx);

    expect((scene as unknown as { maxScroll: number }).maxScroll).toBe(0);
  });

  it('draws the completion check only for unlocked cells', () => {
    const { app } = createApp({ unlockedLevel: 1, completedLevelIds: [1, 2] });
    const scene = new LevelSelectScene(app);
    const { ctx, fillTextCalls } = createCtx();

    scene.render(ctx);

    const checks = fillTextCalls.filter(args => args[0] === '✓');
    expect(checks).toHaveLength(1);
  });
});
