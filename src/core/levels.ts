import { isRecord } from '../utils/validate';
import type { Difficulty, FlavorId, Level, LevelFile } from './types';

const DIFFICULTIES: Difficulty[] = ['easy', 'mid', 'hard'];

export function parseLevelFile(raw: unknown): LevelFile {
  if (!isRecord(raw)) throw new Error('关卡文件必须是对象');
  if (raw.version !== 1) throw new Error('不支持的关卡版本');
  if (raw.capacity !== 4) throw new Error('关卡容量必须为 4');
  if (!Array.isArray(raw.levels) || raw.levels.length === 0) {
    throw new Error('关卡列表为空');
  }

  const levels = raw.levels.map((item, index) => parseLevel(item, index));
  const seen = new Set<number>();
  for (const level of levels) {
    if (seen.has(level.id)) throw new Error(`关卡 ID 重复: ${level.id}`);
    seen.add(level.id);
  }

  return { version: 1, capacity: 4, levels };
}

function parseLevel(raw: unknown, index: number): Level {
  const where = `第 ${index + 1} 个关卡`;
  if (!isRecord(raw)) throw new Error(`${where} 必须是对象`);

  const { id, difficulty, minMoves, bowls } = raw;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    throw new Error(`${where} id 非法`);
  }
  if (
    typeof difficulty !== 'string' ||
    !DIFFICULTIES.includes(difficulty as Difficulty)
  ) {
    throw new Error(`${where} difficulty 非法`);
  }
  if (typeof minMoves !== 'number' || !Number.isInteger(minMoves) || minMoves < 0) {
    throw new Error(`${where} minMoves 非法`);
  }
  if (!Array.isArray(bowls) || bowls.length < 2) {
    throw new Error(`${where} bowls 非法`);
  }

  const parsedBowls: FlavorId[][] = [];
  const counts = new Map<FlavorId, number>();

  for (const bowl of bowls) {
    if (!Array.isArray(bowl) || bowl.length > 4) {
      throw new Error(`${where} 碗容量非法`);
    }
    const parsedBowl: FlavorId[] = [];
    for (const layer of bowl) {
      if (typeof layer !== 'string' || layer.length === 0) {
        throw new Error(`${where} 口味 id 非法`);
      }
      parsedBowl.push(layer);
      counts.set(layer, (counts.get(layer) ?? 0) + 1);
    }
    parsedBowls.push(parsedBowl);
  }

  for (const [flavor, count] of counts) {
    if (count !== 4) {
      throw new Error(`${where} 口味 ${flavor} 数量为 ${count}，应为 4`);
    }
  }

  return {
    id,
    difficulty: difficulty as Difficulty,
    capacity: 4,
    bowls: parsedBowls,
    minMoves,
  };
}
