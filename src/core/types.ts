export type FlavorId = string;

export type Difficulty = 'easy' | 'mid' | 'hard';

export interface Level {
  id: number;
  difficulty: Difficulty;
  capacity: 4;
  bowls: FlavorId[][];
  minMoves: number;
}

export interface LevelFile {
  version: 1;
  capacity: 4;
  levels: Level[];
}

export interface Move {
  from: number;
  to: number;
  flavor: FlavorId;
  count: number;
}

export type HintResult =
  | { status: 'found'; move: Move }
  | { status: 'unsolvable' }
  | { status: 'timeout' };

export interface ItemConfig {
  freeHintsPerAttempt: number;
  freeBowlsPerAttempt: number;
  rewardAmount: number;
  maxExtraBowls: number;
}

export interface GameView {
  levelId: number;
  bowls: ReadonlyArray<ReadonlyArray<FlavorId>>;
  historyLength: number;
  hintsAvailable: number;
  bowlsAvailable: number;
  extraBowlsUsed: number;
  maxExtraBowls: number;
}
