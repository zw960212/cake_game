import { describe, expect, it, vi } from 'vitest';
import { createAdService, MockAdService } from '../ads';

describe('MockAdService', () => {
  it('is always ready and returns the configured result', async () => {
    const rewarded = new MockAdService(0);
    expect(rewarded.isReady()).toBe(true);
    await expect(rewarded.showRewarded()).resolves.toBe('rewarded');
    await expect(new MockAdService(0, 'closed').showRewarded()).resolves.toBe('closed');
    await expect(new MockAdService(0, 'error').showRewarded()).resolves.toBe('error');
  });
});

describe('createAdService', () => {
  it('falls back to MockAdService when no rewarded unit id is configured', () => {
    const service = createAdService({ mock: false, rewardedAdUnitId: '' });
    expect(service).toBeInstanceOf(MockAdService);
    expect(service.isReady()).toBe(true);
  });

  it('rejects a concurrent rewarded call and keeps the first pending', async () => {
    let closeHandler:
      | ((result: { isEnded?: boolean } | undefined) => void)
      | undefined;
    const fakeAd = {
      show: vi.fn(() => Promise.resolve()),
      load: vi.fn(() => Promise.resolve()),
      onClose: vi.fn(
        (handler: (result: { isEnded?: boolean } | undefined) => void) => {
          closeHandler = handler;
        },
      ),
      onError: vi.fn(),
    };
    vi.stubGlobal('wx', { createRewardedVideoAd: () => fakeAd });

    try {
      const service = createAdService({ mock: false, rewardedAdUnitId: 'unit' });
      const first = service.showRewarded();
      await expect(service.showRewarded()).resolves.toBe('error');

      closeHandler?.({ isEnded: true });
      await expect(first).resolves.toBe('rewarded');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
