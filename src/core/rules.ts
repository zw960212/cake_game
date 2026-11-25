import type { FlavorId, Move } from './types';

export function topFlavor(bowl: ReadonlyArray<FlavorId>): FlavorId | undefined {
  return bowl.length === 0 ? undefined : bowl[bowl.length - 1];
}

export function topRunLength(bowl: ReadonlyArray<FlavorId>): number {
  if (bowl.length === 0) return 0;
  const flavor = bowl[bowl.length - 1];
  let n = 1;
  while (n < bowl.length && bowl[bowl.length - 1 - n] === flavor) n += 1;
  return n;
}

export function canPour(
  bowls: ReadonlyArray<ReadonlyArray<FlavorId>>,
  capacity: number,
  from: number,
  to: number,
): boolean {
  if (from === to) return false;
  const src = bowls[from];
  const dst = bowls[to];
  if (!src || !dst) return false;
  if (src.length === 0) return false;
  if (dst.length >= capacity) return false;
  return dst.length === 0 || dst[dst.length - 1] === src[src.length - 1];
}

export function pourCount(
  bowls: ReadonlyArray<ReadonlyArray<FlavorId>>,
  capacity: number,
  from: number,
  to: number,
): number {
  if (!canPour(bowls, capacity, from, to)) return 0;
  return Math.min(topRunLength(bowls[from]), capacity - bowls[to].length);
}

export function legalMoves(
  bowls: ReadonlyArray<ReadonlyArray<FlavorId>>,
  capacity: number,
): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < bowls.length; from += 1) {
    for (let to = 0; to < bowls.length; to += 1) {
      const count = pourCount(bowls, capacity, from, to);
      if (count > 0) {
        moves.push({ from, to, flavor: topFlavor(bowls[from]) as FlavorId, count });
      }
    }
  }
  return moves;
}

export function applyMove(bowls: FlavorId[][], move: Move): void {
  const moved = bowls[move.from].splice(bowls[move.from].length - move.count, move.count);
  bowls[move.to].push(...moved);
}

export function undoMove(bowls: FlavorId[][], move: Move): void {
  const back = bowls[move.to].splice(bowls[move.to].length - move.count, move.count);
  bowls[move.from].push(...back);
}

export function isWin(
  bowls: ReadonlyArray<ReadonlyArray<FlavorId>>,
  capacity: number,
): boolean {
  let nonEmpty = 0;
  for (const bowl of bowls) {
    if (bowl.length === 0) continue;
    nonEmpty += 1;
    if (bowl.length !== capacity) return false;
    const flavor = bowl[0];
    for (const layer of bowl) {
      if (layer !== flavor) return false;
    }
  }
  return nonEmpty > 0;
}

export function hasLegalMove(
  bowls: ReadonlyArray<ReadonlyArray<FlavorId>>,
  capacity: number,
): boolean {
  for (let from = 0; from < bowls.length; from += 1) {
    for (let to = 0; to < bowls.length; to += 1) {
      if (canPour(bowls, capacity, from, to)) return true;
    }
  }
  return false;
}

export function isStuck(
  bowls: ReadonlyArray<ReadonlyArray<FlavorId>>,
  capacity: number,
): boolean {
  return !isWin(bowls, capacity) && !hasLegalMove(bowls, capacity);
}
