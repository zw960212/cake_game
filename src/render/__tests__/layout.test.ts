import { describe, expect, it } from 'vitest';
import { computeGridLayout } from '../layout';

const area = { x: 32, y: 200, w: 686, h: 700 };

describe('computeGridLayout', () => {
  it('uses 4 columns for up to 8 bowls', () => {
    const layout = computeGridLayout(7, area);
    expect(layout.cols).toBe(4);
    expect(layout.rows).toBe(2);
    expect(layout.positions).toHaveLength(7);
  });

  it('uses 5 columns for 9 or more bowls', () => {
    const layout = computeGridLayout(14, area);
    expect(layout.cols).toBe(5);
    expect(layout.rows).toBe(3);
  });

  it('keeps the bowl aspect ratio and fits inside the area', () => {
    for (const count of [4, 7, 10, 14, 16]) {
      const layout = computeGridLayout(count, area);
      expect(layout.cellW / layout.cellH).toBeCloseTo(0.55, 2);
      for (const position of layout.positions) {
        expect(position.x).toBeGreaterThanOrEqual(area.x - 0.001);
        expect(position.y).toBeGreaterThanOrEqual(area.y - 0.001);
        expect(position.x + layout.cellW).toBeLessThanOrEqual(area.x + area.w + 0.001);
        expect(position.y + layout.cellH).toBeLessThanOrEqual(area.y + area.h + 0.001);
      }
    }
  });

  it('shrinks cells when the area is small', () => {
    const layout = computeGridLayout(16, { x: 0, y: 0, w: 400, h: 300 });
    expect(layout.cellW).toBeLessThan(100);
  });
});
