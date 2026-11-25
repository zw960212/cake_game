import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canPour,
  hasLegalMove,
  isStuck,
  isWin,
  pourCount,
  topRunLength,
  undoMove,
} from '../rules';

const CAP = 4;

describe('topRunLength', () => {
  it('counts contiguous same flavor at the top', () => {
    expect(topRunLength(['a', 'b', 'b'])).toBe(2);
    expect(topRunLength(['a', 'a', 'a', 'a'])).toBe(4);
    expect(topRunLength([])).toBe(0);
  });
});

describe('canPour', () => {
  it('allows pouring into an empty bowl', () => {
    expect(canPour([['a', 'b'], []], CAP, 0, 1)).toBe(true);
  });

  it('allows pouring onto the same top flavor', () => {
    expect(canPour([['a', 'b'], ['b']], CAP, 0, 1)).toBe(true);
  });

  it('rejects a different top flavor', () => {
    expect(canPour([['a', 'b'], ['a']], CAP, 0, 1)).toBe(false);
  });

  it('rejects full destinations, empty sources and identical bowls', () => {
    expect(canPour([['a'], ['a', 'a', 'a', 'a']], CAP, 0, 1)).toBe(false);
    expect(canPour([['a'], ['b']], CAP, 0, 0)).toBe(false);
    expect(canPour([[], ['b']], CAP, 0, 1)).toBe(false);
  });
});

describe('pourCount', () => {
  it('is limited by destination space', () => {
    expect(pourCount([['a', 'a', 'a'], ['a', 'a']], CAP, 0, 1)).toBe(2);
  });

  it('moves the full top run when space allows', () => {
    expect(pourCount([['b', 'a', 'a'], []], CAP, 0, 1)).toBe(2);
  });

  it('returns 0 for illegal moves', () => {
    expect(pourCount([['a', 'b'], ['a']], CAP, 0, 1)).toBe(0);
  });
});

describe('applyMove / undoMove', () => {
  it('moves the layer batch and restores it exactly', () => {
    const bowls = [['b', 'a', 'a'], []];
    const move = { from: 0, to: 1, flavor: 'a', count: 2 };
    applyMove(bowls, move);
    expect(bowls).toEqual([['b'], ['a', 'a']]);
    undoMove(bowls, move);
    expect(bowls).toEqual([['b', 'a', 'a'], []]);
  });
});

describe('win / stuck', () => {
  it('detects a win only when every non-empty bowl is full and uniform', () => {
    expect(isWin([['a', 'a', 'a', 'a'], []], CAP)).toBe(true);
    expect(isWin([['a', 'a', 'a'], []], CAP)).toBe(false);
    expect(isWin([['a', 'a', 'a', 'a'], ['b', 'a']], CAP)).toBe(false);
    expect(isWin([[], []], CAP)).toBe(false);
  });

  it('detects no legal moves as stuck', () => {
    const bowls = [
      ['a', 'b', 'a', 'b'],
      ['a', 'b', 'a', 'b'],
    ];
    expect(hasLegalMove(bowls, CAP)).toBe(false);
    expect(isStuck(bowls, CAP)).toBe(true);
  });
});
