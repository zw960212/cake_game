import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rand';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(20261125);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
