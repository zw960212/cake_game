import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as TapGuard from '../tapGuard';

let guard: typeof TapGuard;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  guard = await import('../tapGuard');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('tapGuard', () => {
  it('is not suppressed initially', () => {
    expect(guard.tapsSuppressed()).toBe(false);
  });

  it('suppresses taps for the requested duration', () => {
    guard.suppressTaps(250);
    expect(guard.tapsSuppressed()).toBe(true);

    vi.advanceTimersByTime(249);
    expect(guard.tapsSuppressed()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(guard.tapsSuppressed()).toBe(false);
  });

  it('keeps the later deadline for overlapping calls', () => {
    guard.suppressTaps(100);
    guard.suppressTaps(300);

    vi.advanceTimersByTime(200);
    expect(guard.tapsSuppressed()).toBe(true);

    vi.advanceTimersByTime(150);
    expect(guard.tapsSuppressed()).toBe(false);
  });
});
