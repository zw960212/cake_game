import { describe, expect, it } from 'vitest';
import { findSolution, solveOptimal } from '../solver';
import { applyMove, isWin, pourCount } from '../rules';

const CAP = 4;
const threeMovePuzzle = [
  ['a', 'a', 'b', 'b'],
  ['b', 'b', 'a', 'a'],
  [],
  [],
];

describe('solveOptimal', () => {
  it('finds the minimum move count and a valid move list', () => {
    const result = solveOptimal(threeMovePuzzle, CAP, { maxNodes: 200_000, timeMs: 2000 });
    expect(result.status).toBe('solved');
    if (result.status !== 'solved') return;
    expect(result.moves.length).toBe(3);
    const state = threeMovePuzzle.map(bowl => bowl.slice());
    for (const move of result.moves) {
      expect(pourCount(state, CAP, move.from, move.to)).toBe(move.count);
      applyMove(state, move);
    }
    expect(isWin(state, CAP)).toBe(true);
  });

  it('reports unsolvable when no move exists', () => {
    const result = solveOptimal(
      [['a', 'b', 'a', 'b'], ['a', 'b', 'a', 'b']],
      CAP,
      { maxNodes: 1000, timeMs: 1000 },
    );
    expect(result).toEqual({ status: 'unsolvable' });
  });

  it('reports timeout when the node budget is exhausted', () => {
    const result = solveOptimal(threeMovePuzzle, CAP, { maxNodes: 1, timeMs: 1000 });
    expect(result.status).toBe('timeout');
  });
});

describe('findSolution', () => {
  it('returns a legal first move', () => {
    const result = findSolution(threeMovePuzzle, CAP, { maxNodes: 200_000, timeMs: 2000 });
    expect(result.status).toBe('solved');
    if (result.status !== 'solved') return;
    const state = threeMovePuzzle.map(bowl => bowl.slice());
    const first = result.moves[0];
    expect(pourCount(state, CAP, first.from, first.to)).toBe(first.count);
  });
});
