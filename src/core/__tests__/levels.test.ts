import { describe, expect, it } from 'vitest';
import { parseLevelFile } from '../levels';

const goodLevel = {
  id: 1,
  difficulty: 'easy',
  minMoves: 3,
  bowls: [
    ['a', 'a', 'b', 'b'],
    ['b', 'b', 'a', 'a'],
    [],
    [],
  ],
};

const goodFile = { version: 1, capacity: 4, levels: [goodLevel] };

describe('parseLevelFile', () => {
  it('accepts a valid file', () => {
    const file = parseLevelFile(goodFile);
    expect(file.levels).toHaveLength(1);
    expect(file.levels[0]).toMatchObject({
      id: 1,
      difficulty: 'easy',
      minMoves: 3,
      capacity: 4,
    });
  });

  it('rejects wrong version and capacity', () => {
    expect(() => parseLevelFile({ ...goodFile, version: 2 })).toThrow();
    expect(() => parseLevelFile({ ...goodFile, capacity: 5 })).toThrow();
  });

  it('rejects wrong flavor counts', () => {
    expect(() =>
      parseLevelFile({
        ...goodFile,
        levels: [
          { ...goodLevel, bowls: [['a', 'a', 'b'], ['b', 'b', 'a', 'a'], [], []] },
        ],
      }),
    ).toThrow(/口味/);
  });

  it('rejects bowls over capacity and duplicate ids', () => {
    expect(() =>
      parseLevelFile({
        ...goodFile,
        levels: [
          { ...goodLevel, bowls: [['a', 'a', 'a', 'a', 'b'], ['b', 'b', 'b'], [], []] },
        ],
      }),
    ).toThrow();

    expect(() =>
      parseLevelFile({ ...goodFile, levels: [goodLevel, { ...goodLevel }] }),
    ).toThrow(/重复/);
  });
});
