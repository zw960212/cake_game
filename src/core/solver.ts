import type { FlavorId, Move } from './types';
import { applyMove, isWin, legalMoves, undoMove } from './rules';

export interface SolveOptions {
  maxNodes?: number;
  timeMs?: number;
}

export type SolveResult =
  | { status: 'solved'; moves: Move[] }
  | { status: 'unsolvable' }
  | { status: 'timeout' };

interface Budget {
  nodes: number;
  maxNodes: number;
  deadline: number;
  timedOut: boolean;
}

const FOUND = -1;

function makeBudget(opts: SolveOptions, defaultNodes: number, defaultTimeMs: number): Budget {
  return {
    nodes: 0,
    maxNodes: opts.maxNodes ?? defaultNodes,
    deadline: Date.now() + (opts.timeMs ?? defaultTimeMs),
    timedOut: false,
  };
}

function spendNode(budget: Budget): boolean {
  budget.nodes += 1;
  if (budget.nodes > budget.maxNodes || Date.now() > budget.deadline) {
    budget.timedOut = true;
    return false;
  }
  return true;
}

function canonical(state: ReadonlyArray<ReadonlyArray<FlavorId>>): string {
  return state.map(bowl => bowl.join('.')).sort().join('/');
}

/**
 * 可采纳启发式：每出现一段连续同口味就算一个 run，
 * 一次倒层最多把两个 run 合并成一个，所以每个口味至少需要 runs-1 步。
 */
function heuristic(state: ReadonlyArray<ReadonlyArray<FlavorId>>): number {
  const runs = new Map<FlavorId, number>();
  for (const bowl of state) {
    let previous: FlavorId | null = null;
    for (const flavor of bowl) {
      if (flavor !== previous) {
        runs.set(flavor, (runs.get(flavor) ?? 0) + 1);
        previous = flavor;
      }
    }
  }
  let total = 0;
  for (const count of runs.values()) total += Math.max(0, count - 1);
  return total;
}

function orderedMoves(
  state: ReadonlyArray<ReadonlyArray<FlavorId>>,
  capacity: number,
): Move[] {
  const score = (move: Move): number => {
    let value = move.count;
    const dst = state[move.to];
    const src = state[move.from];
    if (dst.length + move.count === capacity) value += 1000;
    if (move.count === src.length) value += 100;
    return value;
  };
  return legalMoves(state, capacity).sort((a, b) => score(b) - score(a));
}

export function findSolution(
  bowls: FlavorId[][],
  capacity: number,
  opts: SolveOptions = {},
): SolveResult {
  const budget = makeBudget(opts, 200_000, 300);
  const state = bowls.map(bowl => bowl.slice());
  const visited = new Set<string>();
  const path: Move[] = [];

  const dfs = (): boolean => {
    if (isWin(state, capacity)) return true;
    const key = canonical(state);
    if (visited.has(key)) return false;
    if (!spendNode(budget)) return false;
    visited.add(key);

    for (const move of orderedMoves(state, capacity)) {
      applyMove(state, move);
      path.push(move);
      if (dfs()) return true;
      path.pop();
      undoMove(state, move);
      if (budget.timedOut) return false;
    }
    return false;
  };

  if (dfs()) return { status: 'solved', moves: path.slice() };
  return budget.timedOut ? { status: 'timeout' } : { status: 'unsolvable' };
}

export function solveOptimal(
  bowls: FlavorId[][],
  capacity: number,
  opts: SolveOptions = {},
): SolveResult {
  const budget = makeBudget(opts, 2_000_000, 8000);
  const state = bowls.map(bowl => bowl.slice());
  const path: Move[] = [];

  if (isWin(state, capacity)) return { status: 'solved', moves: [] };

  let bound = heuristic(state);
  for (;;) {
    const onPath = new Set<string>();
    const next = search(state, capacity, 0, bound, onPath, path, budget);
    if (next === FOUND) return { status: 'solved', moves: path.slice() };
    if (budget.timedOut) return { status: 'timeout' };
    if (next === Infinity) return { status: 'unsolvable' };
    bound = next;
  }
}

function search(
  state: FlavorId[][],
  capacity: number,
  depth: number,
  bound: number,
  onPath: Set<string>,
  path: Move[],
  budget: Budget,
): number {
  if (isWin(state, capacity)) return FOUND;

  const estimate = depth + heuristic(state);
  if (estimate > bound) return estimate;
  if (!spendNode(budget)) return Infinity;

  const key = canonical(state);
  if (onPath.has(key)) return Infinity;
  onPath.add(key);

  let smallest = Infinity;
  for (const move of orderedMoves(state, capacity)) {
    applyMove(state, move);
    path.push(move);
    const result = search(state, capacity, depth + 1, bound, onPath, path, budget);
    if (result === FOUND) return FOUND;
    path.pop();
    undoMove(state, move);
    if (result < smallest) smallest = result;
    if (budget.timedOut) return Infinity;
  }

  onPath.delete(key);
  return smallest;
}
