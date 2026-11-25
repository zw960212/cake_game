import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Level } from '../../../core/types';
import { parseLevelFile } from '../../../core/levels';
import rawLevels from '../../../../levels/levels.json';
import type { App } from '../../app';
import type { AdResult, AdService } from '../../services/ads';
import { createDefaultSave, type SaveData } from '../../services/storage';
import { GameScene } from '../game';

const levelFile = parseLevelFile(rawLevels);

interface RecordedCtx {
  ctx: CanvasRenderingContext2D;
}

function createCtx(): RecordedCtx {
  const target: Record<string | symbol, unknown> = {
    createLinearGradient: () => ({ addColorStop() {} }),
  };

  const ctx = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      return () => {};
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx };
}

interface FakeApp {
  app: App;
  save: SaveData;
  persist: ReturnType<typeof vi.fn>;
  goHome: ReturnType<typeof vi.fn>;
  goLevels: ReturnType<typeof vi.fn>;
  startLevel: ReturnType<typeof vi.fn>;
  resetProgress: ReturnType<typeof vi.fn>;
}

function createApp(options: { levels?: Level[]; ads?: AdService } = {}): FakeApp {
  const save = createDefaultSave();
  const persist = vi.fn();
  const goHome = vi.fn();
  const goLevels = vi.fn();
  const startLevel = vi.fn();
  const resetProgress = vi.fn();
  const { ctx } = createCtx();

  const app = {
    viewport: {
      canvas: {},
      ctx,
      scale: 1,
      pixelScale: 1,
      width: 750,
      height: 1334,
      safeTop: 40,
      safeBottom: 20,
    },
    assets: { image: () => undefined },
    save,
    levels: {
      version: 1 as const,
      capacity: 4 as const,
      levels: options.levels ?? levelFile.levels,
    },
    services: {
      ads:
        options.ads ??
        ({
          isReady: () => true,
          showRewarded: () => Promise.resolve('rewarded' as AdResult),
        } satisfies AdService),
      audio: {
        playMusic: vi.fn(),
        playSfx: vi.fn(),
        setSoundEnabled: vi.fn(),
        setMusicEnabled: vi.fn(),
      },
      haptics: { light: vi.fn(), setEnabled: vi.fn() },
      analytics: { track: vi.fn() },
    },
    persist,
    applySettings: vi.fn(),
    resetProgress,
    goHome,
    goLevels,
    startLevel,
  } as unknown as App;

  return { app, save, persist, goHome, goLevels, startLevel, resetProgress };
}

function center(rect: { x: number; y: number; w: number; h: number }) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function tap(scene: GameScene, point: { x: number; y: number }): void {
  scene.onTouchStart(point.x, point.y);
  scene.onTouchEnd(point.x, point.y);
}

let testClock = 0;

beforeEach(() => {
  // Advance the base clock per test so tapGuard's module-level suppression
  // window from a previous test can never leak into this one.
  testClock += 1000;
  vi.useFakeTimers();
  vi.setSystemTime(testClock);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GameScene', () => {
  it('allows selecting a full bowl so level 1 is playable from the start', () => {
    const { app } = createApp();
    const level = levelFile.levels[0];
    const emptyIndex = level.bowls.findIndex(bowl => bowl.length === 0);
    expect(emptyIndex).toBeGreaterThanOrEqual(0);

    const scene = new GameScene(app, level);
    const { ctx } = createCtx();
    scene.render(ctx);

    const layout = (scene as unknown as {
      layoutFor(): { bowls: Array<{ x: number; y: number; w: number; h: number }> };
    }).layoutFor();

    tap(scene, center(layout.bowls[0]));
    expect((scene as unknown as { selected: number | null }).selected).toBe(0);

    tap(scene, center(layout.bowls[emptyIndex]));

    expect(
      (scene as unknown as { session: { view(): { historyLength: number } } })
        .session.view().historyLength,
    ).toBe(1);
    expect((scene as unknown as { anim: unknown }).anim).not.toBeNull();
  });

  it('locks input while the pour animation is running', () => {
    const { app } = createApp();
    const level = levelFile.levels[0];
    const emptyIndex = level.bowls.findIndex(bowl => bowl.length === 0);
    const scene = new GameScene(app, level);

    const layout = (scene as unknown as {
      layoutFor(): {
        bowls: Array<{ x: number; y: number; w: number; h: number }>;
        settings: { x: number; y: number; w: number; h: number };
      };
    }).layoutFor();

    tap(scene, center(layout.bowls[0]));
    tap(scene, center(layout.bowls[emptyIndex]));
    expect((scene as unknown as { anim: unknown }).anim).not.toBeNull();

    tap(scene, center(layout.settings));

    expect((scene as unknown as { settings: { visible: boolean } }).settings.visible).toBe(
      false,
    );
  });

  it('locks input while a rewarded-ad promise is pending', async () => {
    let resolveAd!: (result: AdResult) => void;
    const adPromise = new Promise<AdResult>(resolve => {
      resolveAd = resolve;
    });
    const showRewarded = vi.fn(() => adPromise);
    const { app } = createApp({
      ads: { isReady: () => true, showRewarded },
    });

    // Minimal solvable level so hint() is fast and deterministic.
    const level: Level = {
      id: 1,
      difficulty: 'easy',
      capacity: 4,
      bowls: [['a', 'a'], ['a', 'a'], []],
      minMoves: 2,
    };
    const scene = new GameScene(app, level);
    const priv = scene as unknown as {
      session: {
        view(): { historyLength: number; hintsAvailable: number };
      };
      doHint(): void;
      watchAd(kind: 'hint' | 'bowl', move?: unknown): Promise<void>;
      tapBowl(index: number): void;
      handleTap(x: number, y: number): void;
      layoutFor(): { settings: { x: number; y: number; w: number; h: number } };
      adPending: boolean;
      hint: unknown;
      selected: number | null;
      settings: { visible: boolean };
      modal: { visible: boolean };
    };

    priv.doHint();
    expect(priv.session.view().hintsAvailable).toBe(0);
    priv.doHint();
    expect(priv.modal.visible).toBe(true);

    const pending = priv.watchAd('hint', {
      from: 0,
      to: 2,
      flavor: 'a',
      count: 2,
    });
    expect(priv.adPending).toBe(true);

    const before = priv.session.view();
    priv.tapBowl(0);
    // Without the adPending guard this would select bowl 0 (a non-empty bowl).
    expect(priv.selected).toBeNull();
    expect(priv.session.view().historyLength).toBe(before.historyLength);

    const gear = center(priv.layoutFor().settings);
    priv.handleTap(gear.x, gear.y);
    expect(priv.settings.visible).toBe(false);

    resolveAd('rewarded');
    await pending;

    expect(priv.adPending).toBe(false);
    expect(showRewarded).toHaveBeenCalledTimes(1);
    expect(priv.session.view().hintsAvailable).toBe(0);
    expect(priv.hint).not.toBeNull();
  });

  it('persists completion and unlocks the next level on a win', () => {
    const winLevel: Level = {
      id: 1,
      difficulty: 'easy',
      capacity: 4,
      bowls: [['a', 'a', 'a'], ['a'], []],
      minMoves: 1,
    };
    const nextLevel: Level = {
      id: 2,
      difficulty: 'easy',
      capacity: 4,
      bowls: [['b'], ['b'], ['b'], ['b']],
      minMoves: 0,
    };
    const { app, save, persist } = createApp({ levels: [winLevel, nextLevel] });
    const scene = new GameScene(app, winLevel);

    const layout = (scene as unknown as {
      layoutFor(): { bowls: Array<{ x: number; y: number; w: number; h: number }> };
    }).layoutFor();

    tap(scene, center(layout.bowls[1]));
    tap(scene, center(layout.bowls[0]));

    vi.advanceTimersByTime(250);
    scene.update(0);

    expect((scene as unknown as { winAt: number }).winAt).toBeGreaterThan(0);
    expect(persist).toHaveBeenCalled();
    expect(save.completedLevelIds).toContain(1);
    expect(save.unlockedLevel).toBe(2);

    vi.advanceTimersByTime(700);
    scene.update(0);

    expect((scene as unknown as { modal: { visible: boolean } }).modal.visible).toBe(
      true,
    );
  });

  it('routes taps to the topmost modal and suppresses pass-through', () => {
    const { app } = createApp();
    const level = levelFile.levels[0];
    const scene = new GameScene(app, level);
    const { ctx } = createCtx();
    const onPress = vi.fn();

    const priv = scene as unknown as {
      settings: { visible: boolean; open(): void; close(): void };
      modal: {
        visible: boolean;
        show(title: string, message: string, actions: unknown[]): void;
        hitAreas: Array<{ rect: { x: number; y: number; w: number; h: number } }>;
      };
      session: { view(): { historyLength: number } };
      selected: number | null;
      layoutFor(): { bowls: Array<{ x: number; y: number; w: number; h: number }> };
    };

    priv.settings.open();
    priv.modal.show('测试', '内容', [{ label: '确定', primary: true, onPress }]);
    scene.render(ctx);

    // The modal is rendered above settings; its action must win the tap even
    // though settings is also visible underneath it.
    tap(scene, center(priv.modal.hitAreas[0].rect));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(priv.settings.visible).toBe(true);

    // Modal.tap() suppresses the next gesture, so the pass-through tap must be
    // swallowed even after the settings panel is closed.
    priv.settings.close();
    tap(scene, center(priv.layoutFor().bowls[0]));
    // If the pass-through tap were not swallowed, tapBowl would select bowl 0.
    expect(priv.selected).toBeNull();
    expect(priv.session.view().historyLength).toBe(0);
    expect(priv.settings.visible).toBe(false);
  });
});
