import { describe, expect, it } from 'vitest';
import { MockAdService } from '../ads';

describe('MockAdService', () => {
  it('is always ready and returns the configured result', async () => {
    const rewarded = new MockAdService(0);
    expect(rewarded.isReady()).toBe(true);
    await expect(rewarded.showRewarded()).resolves.toBe('rewarded');
    await expect(new MockAdService(0, 'closed').showRewarded()).resolves.toBe('closed');
    await expect(new MockAdService(0, 'error').showRewarded()).resolves.toBe('error');
  });
});
