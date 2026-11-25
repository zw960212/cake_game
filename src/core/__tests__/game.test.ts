import { describe, expect, it } from 'vitest';
import { GameSession } from '../game';
import type { ItemConfig, Level } from '../types';

const level: Level = {
  id: 1,
  difficulty: 'easy',
  capacity: 4,
  minMoves: 3,
  bowls: [
    ['a', 'a', 'b', 'b'],
    ['b', 'b', 'a', 'a'],
    [],
    [],
  ],
};

const items: ItemConfig = {
  freeHintsPerAttempt: 1,
  freeBowlsPerAttempt: 1,
  rewardAmount: 1,
  maxExtraBowls: 2,
};

function createSession(): GameSession {
  return new GameSession(level, items, { maxNodes: 200_000, timeMs: 2000 });
}

describe('GameSession', () => {
  it('pours layers and records history', () => {
    const session = createSession();
    const move = session.pour(0, 2);
    expect(move).toEqual({ from: 0, to: 2, flavor: 'b', count: 2 });
    expect(session.view().bowls).toEqual([
      ['a', 'a'],
      ['b', 'b', 'a', 'a'],
      ['b', 'b'],
      [],
    ]);
    expect(session.view().historyLength).toBe(1);
  });

  it('rejects illegal pours', () => {
    const session = createSession();
    expect(session.pour(0, 1)).toBeNull();
    expect(session.pour(2, 3)).toBeNull();
    expect(session.pour(0, 0)).toBeNull();
    expect(session.view().historyLength).toBe(0);
  });

  it('undoes exactly and empties history', () => {
    const session = createSession();
    session.pour(0, 2);
    const undone = session.undo();
    expect(undone).toEqual({ from: 0, to: 2, flavor: 'b', count: 2 });
    expect(session.view().bowls).toEqual(level.bowls);
    expect(session.undo()).toBeNull();
  });

  it('adds bowls within free and ad allowances, capped by maxExtraBowls', () => {
    const session = createSession();
    expect(session.view().bowls).toHaveLength(4);
    expect(session.addBowl()).toBe(true);
    expect(session.view().bowls).toHaveLength(5);
    expect(session.view().bowlsAvailable).toBe(0);
    expect(session.addBowl()).toBe(false);

    session.grantBowls(1);
    expect(session.addBowl()).toBe(true);
    expect(session.view().extraBowlsUsed).toBe(2);

    session.grantBowls(1);
    expect(session.addBowl()).toBe(false);
    expect(session.view().extraBowlsUsed).toBe(2);
  });

  it('consumes and grants hint allowances', () => {
    const session = createSession();
    expect(session.view().hintsAvailable).toBe(1);
    expect(session.consumeHint()).toBe(true);
    expect(session.consumeHint()).toBe(false);
    session.grantHints(1);
    expect(session.consumeHint()).toBe(true);
  });

  it('finds a hint from the current state', () => {
    const session = createSession();
    const hint = session.hint();
    expect(hint.status).toBe('found');
    if (hint.status === 'found') {
      expect(session.view().bowls[hint.move.from].length).toBeGreaterThan(0);
    }
  });

  it('restarts to the initial state and allowances', () => {
    const session = createSession();
    session.pour(0, 2);
    session.addBowl();
    session.consumeHint();
    session.restart();
    expect(session.view().bowls).toEqual(level.bowls);
    expect(session.view().historyLength).toBe(0);
    expect(session.view().extraBowlsUsed).toBe(0);
    expect(session.view().hintsAvailable).toBe(1);
    expect(session.view().bowlsAvailable).toBe(1);
  });
});
