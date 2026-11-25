import { describe, expect, it } from 'vitest';
import { clamp, contains, lerp } from '../geometry';

describe('geometry', () => {
  it('contains uses inclusive bounds', () => {
    const rect = { x: 10, y: 20, w: 100, h: 50 };
    expect(contains(rect, 10, 20)).toBe(true);
    expect(contains(rect, 110, 70)).toBe(true);
    expect(contains(rect, 111, 70)).toBe(false);
    expect(contains(rect, 50, 71)).toBe(false);
  });

  it('clamps values into range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('lerps between two numbers', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(lerp(10, 0, 1)).toBe(0);
  });
});
