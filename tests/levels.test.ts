import { describe, expect, it } from 'vitest';
import raw from '../levels/levels.json';
import { parseLevelFile } from '../src/core/levels';
import { findSolution } from '../src/core/solver';

const file = parseLevelFile(raw);

describe('levels.json', () => {
  it('contains 30 levels with sequential ids', () => {
    expect(file.levels).toHaveLength(30);
    expect(file.levels.map(level => level.id)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
  });

  it(
    'all levels are solvable',
    () => {
      for (const level of file.levels) {
        const result = findSolution(level.bowls, level.capacity, {
          maxNodes: 1_000_000,
          timeMs: 5000,
        });
        expect(result.status, `level ${level.id}`).toBe('solved');
      }
    },
    60_000,
  );
});
