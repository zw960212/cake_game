import { mkdirSync, writeFileSync } from 'node:fs';
import { ALL_FLAVORS } from '../src/core/flavors';
import { findSolution } from '../src/core/solver';
import { isStuck, isWin } from '../src/core/rules';
import type { Difficulty, FlavorId, Level } from '../src/core/types';
import { mulberry32 } from '../src/utils/rand';

interface Spec {
  id: number;
  difficulty: Difficulty;
  colors: number;
  empty: number;
  minMoves: number;
}

const CAPACITY = 4;
const ATTEMPTS = 400;
// 用提示求解器找到的第一条解作为参考步数；固定节点上限保证可复现。
// 11 色局面的全局最优搜索不可行，难度主要由颜色数与空杯数决定。
const SOLUTION_BUDGET = { maxNodes: 500_000, timeMs: 30_000 };

function buildSpecs(): Spec[] {
  const specs: Spec[] = [];
  for (let id = 1; id <= 10; id += 1) {
    specs.push({
      id,
      difficulty: 'easy',
      colors: 3 + ((id - 1) % 3),
      empty: 2,
      minMoves: 8,
    });
  }
  for (let id = 11; id <= 20; id += 1) {
    specs.push({
      id,
      difficulty: 'mid',
      colors: 6 + ((id - 11) % 3),
      empty: 2,
      minMoves: 16,
    });
  }
  for (let id = 21; id <= 25; id += 1) {
    specs.push({
      id,
      difficulty: 'hard',
      colors: 9 + ((id - 21) % 2),
      empty: 2,
      minMoves: 24,
    });
  }
  for (let id = 26; id <= 30; id += 1) {
    specs.push({ id, difficulty: 'hard', colors: 11, empty: 3, minMoves: 24 });
  }
  return specs;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function randomBoard(colors: number, empty: number, rng: () => number): FlavorId[][] {
  const layers = ALL_FLAVORS.slice(0, colors).flatMap(flavor => [
    flavor,
    flavor,
    flavor,
    flavor,
  ]);
  shuffle(layers, rng);

  const bowls: FlavorId[][] = [];
  for (let i = 0; i < colors; i += 1) {
    bowls.push(layers.slice(i * CAPACITY, (i + 1) * CAPACITY));
  }
  for (let i = 0; i < empty; i += 1) bowls.push([]);
  return bowls;
}

function generateLevel(spec: Spec): Level {
  const rng = mulberry32(20261125 + spec.id * 7919);

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const bowls = randomBoard(spec.colors, spec.empty, rng);
    if (isWin(bowls, CAPACITY) || isStuck(bowls, CAPACITY)) continue;

    const solution = findSolution(bowls, CAPACITY, SOLUTION_BUDGET);
    if (solution.status !== 'solved') continue;
    if (solution.moves.length < spec.minMoves) continue;

    return {
      id: spec.id,
      difficulty: spec.difficulty,
      capacity: 4,
      bowls,
      minMoves: solution.moves.length,
    };
  }

  throw new Error(
    `第 ${spec.id} 关生成失败：${ATTEMPTS} 次尝试内没有找到满足难度的可解局面`,
  );
}

function main(): void {
  const levels = buildSpecs().map(generateLevel);
  mkdirSync('levels', { recursive: true });
  writeFileSync(
    'levels/levels.json',
    `${JSON.stringify({ version: 1, capacity: 4, levels }, null, 2)}\n`,
    'utf8',
  );
  for (const level of levels) {
    console.log(
      `level ${level.id}: ${level.difficulty}, ${level.minMoves} moves, ${level.bowls.length} bowls`,
    );
  }
  console.log(`generated ${levels.length} levels -> levels/levels.json`);
}

main();
