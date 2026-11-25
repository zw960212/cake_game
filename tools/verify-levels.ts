import { readFileSync } from 'node:fs';
import { parseLevelFile } from '../src/core/levels';
import { findSolution } from '../src/core/solver';

const SOLUTION_BUDGET = { maxNodes: 500_000, timeMs: 30_000 };

const raw = JSON.parse(readFileSync('levels/levels.json', 'utf8')) as unknown;
const file = parseLevelFile(raw);

let failures = 0;
for (const level of file.levels) {
  const result = findSolution(level.bowls, level.capacity, SOLUTION_BUDGET);

  if (result.status !== 'solved') {
    console.error(`level ${level.id}: ${result.status}`);
    failures += 1;
    continue;
  }

  if (result.moves.length !== level.minMoves) {
    console.error(
      `level ${level.id}: minMoves=${level.minMoves} but reference solution has ${result.moves.length} moves`,
    );
    failures += 1;
    continue;
  }

  console.log(`level ${level.id}: ok (${result.moves.length} moves)`);
}

if (failures > 0) {
  console.error(`${failures} level(s) failed verification`);
  process.exit(1);
}
console.log(`all ${file.levels.length} levels verified`);
