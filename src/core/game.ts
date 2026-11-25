import type { FlavorId, GameView, HintResult, ItemConfig, Level, Move } from './types';
import { applyMove, isStuck, isWin, pourCount, topFlavor, undoMove } from './rules';
import { findSolution, type SolveOptions } from './solver';

export class GameSession {
  private bowls: FlavorId[][];
  private history: Move[] = [];
  private hintsAvailable: number;
  private bowlsAvailable: number;
  private extraBowlsUsed = 0;

  constructor(
    readonly level: Level,
    private readonly items: ItemConfig,
    private readonly hintBudget: SolveOptions = { maxNodes: 200_000, timeMs: 300 },
  ) {
    this.bowls = level.bowls.map(bowl => bowl.slice());
    this.hintsAvailable = items.freeHintsPerAttempt;
    this.bowlsAvailable = items.freeBowlsPerAttempt;
  }

  pour(from: number, to: number): Move | null {
    const count = pourCount(this.bowls, this.level.capacity, from, to);
    if (count === 0) return null;
    const move: Move = {
      from,
      to,
      flavor: topFlavor(this.bowls[from]) as FlavorId,
      count,
    };
    applyMove(this.bowls, move);
    this.history.push(move);
    return move;
  }

  undo(): Move | null {
    const move = this.history.pop();
    if (!move) return null;
    undoMove(this.bowls, move);
    return move;
  }

  hint(): HintResult {
    const result = findSolution(this.bowls, this.level.capacity, this.hintBudget);
    if (result.status === 'solved') return { status: 'found', move: result.moves[0] };
    if (result.status === 'timeout') return { status: 'timeout' };
    return { status: 'unsolvable' };
  }

  canAddBowl(): boolean {
    return (
      this.bowlsAvailable > 0 &&
      this.extraBowlsUsed < this.items.maxExtraBowls
    );
  }

  addBowl(): boolean {
    if (!this.canAddBowl()) return false;
    this.bowls.push([]);
    this.bowlsAvailable -= 1;
    this.extraBowlsUsed += 1;
    return true;
  }

  consumeHint(): boolean {
    if (this.hintsAvailable <= 0) return false;
    this.hintsAvailable -= 1;
    return true;
  }

  grantHints(amount: number): void {
    this.hintsAvailable += Math.max(0, amount);
  }

  grantBowls(amount: number): void {
    this.bowlsAvailable += Math.max(0, amount);
  }

  restart(): void {
    this.bowls = this.level.bowls.map(bowl => bowl.slice());
    this.history = [];
    this.hintsAvailable = this.items.freeHintsPerAttempt;
    this.bowlsAvailable = this.items.freeBowlsPerAttempt;
    this.extraBowlsUsed = 0;
  }

  isWin(): boolean {
    return isWin(this.bowls, this.level.capacity);
  }

  isStuck(): boolean {
    return isStuck(this.bowls, this.level.capacity);
  }

  view(): GameView {
    return {
      levelId: this.level.id,
      bowls: this.bowls,
      historyLength: this.history.length,
      hintsAvailable: this.hintsAvailable,
      bowlsAvailable: this.bowlsAvailable,
      extraBowlsUsed: this.extraBowlsUsed,
      maxExtraBowls: this.items.maxExtraBowls,
    };
  }
}
