# 蛋糕排序派对 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可运行的微信小游戏 MVP：30 关蛋糕分层排序，含撤销/提示/加碗、本地存档、激励广告 Mock，美术可通过 manifest 整包替换。

**Architecture:** 四层单向依赖：`core` 纯 TypeScript 玩法逻辑（可单测）、`app` 场景与服务装配、`render` Canvas 绘制与动画；平台 API 集中在 `main`/`render` 适配点与 `services`。esbuild 将 `src/main.ts` 打包为根目录 `game.js`。

**Tech Stack:** TypeScript 5、esbuild、Vitest、tsx、微信小游戏 Canvas 2D（无游戏引擎）。

**Spec:** [docs/superpowers/specs/2026-11-25-cake-sort-design.md](../specs/2026-11-25-cake-sort-design.md)

---

## 通用约定

- 所有命令在仓库根目录 `d:\cake_game` 执行（Git Bash）。
- 每个任务结束时提交；提交信息末尾统一带 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。
- 测试命令：`npx vitest run <文件路径>`；全量测试：`npm test`。
- 类型检查：`npm run typecheck`。
- 构建：`npm run build`，产物为根目录 `game.js`。
- UI 任务无法单测的部分，用 `npm run typecheck` + `npm run build` + 微信开发者工具手动验收。

## 文件地图

| 文件 | 职责 |
| --- | --- |
| `package.json` / `tsconfig.json` / `vitest.config.ts` | 工程与测试配置 |
| `scripts/build.mjs` | esbuild 打包 `src/main.ts` → `game.js` |
| `game.json` / `project.config.json` | 小游戏运行与开发者工具配置 |
| `src/types/wechat.d.ts` | `wx` / `requestAnimationFrame` 的最小声明 |
| `src/main.ts` | 启动、Canvas、触摸事件、主循环、场景工厂 |
| `src/core/types.ts` | 领域类型 |
| `src/core/flavors.ts` | 11 种口味 id 列表 |
| `src/core/rules.ts` | 倒层规则、执行/回滚、胜负/卡死 |
| `src/core/solver.ts` | 提示（任意解）与离线最优解（IDA*） |
| `src/core/game.ts` | `GameSession`：状态、撤销、加碗、道具额度 |
| `src/core/levels.ts` | `levels.json` 解析与校验 |
| `src/config/gameConfig.ts` | 道具额度、广告、动画、求解预算 |
| `src/app/app.ts` | `App`：场景、存档、服务、导航、场景工厂接口 |
| `src/app/scene.ts` | `Scene` 接口 |
| `src/app/scenes/boot.ts` | 资源加载页 |
| `src/app/scenes/home.ts` | 主页 |
| `src/app/scenes/levelSelect.ts` | 关卡选择 |
| `src/app/scenes/game.ts` | 局内玩法与动画 |
| `src/app/components/button.ts` | 按钮绘制与命中 |
| `src/app/components/modal.ts` | 模态弹窗 |
| `src/app/components/toast.ts` | 轻提示 |
| `src/app/components/settings.ts` | 设置面板 |
| `src/app/services/storage.ts` | 存档读写与容错 |
| `src/app/services/ads.ts` | 激励视频接口 + Mock + 微信实现 |
| `src/app/services/audio.ts` | 音频播放 |
| `src/app/services/haptics.ts` | 轻震动 |
| `src/app/services/analytics.ts` | 埋点空实现 |
| `src/render/theme.ts` | 色板、口味占位色、尺寸 token |
| `src/render/canvas.ts` | Canvas 与视口/安全区 |
| `src/render/assets.ts` | manifest 解析、图片加载、缺图回退 |
| `src/render/draw.ts` | 圆角矩形、文字等绘制原语 |
| `src/render/background.ts` | 奶油风背景 |
| `src/render/layout.ts` | 碗网格布局计算 |
| `src/render/painters/bowl.ts` | 布丁杯与蛋糕层绘制 |
| `src/utils/geometry.ts` | `Rect` / `contains` / `clamp` / `lerp` |
| `src/utils/validate.ts` | `isRecord` |
| `src/utils/rand.ts` | 可复现随机数 |
| `tools/gen-levels.ts` | 离线生成并验证 30 关 |
| `tools/verify-levels.ts` | 全量校验关卡表 |
| `tests/levels.test.ts` | 关卡数据自动测试 |
| `assets/manifest.json` | 美术/音频资源清单（初始为空） |
| `levels/levels.json` | 生成后的 30 关数据 |
| `README.md` | 运行、构建、换美术、广告配置说明 |

---

### Task 1: 工程脚手架与基础工具

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/utils/geometry.ts`
- Create: `src/utils/validate.ts`
- Test: `src/utils/__tests__/geometry.test.ts`
- Test: `src/utils/__tests__/validate.test.ts`

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "cake-sort-party",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "dev": "node scripts/build.mjs --watch",
    "build": "node scripts/build.mjs",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "gen:levels": "tsx tools/gen-levels.ts",
    "verify:levels": "tsx tools/verify-levels.ts"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "esbuild": "^0.24.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 写 `tsconfig.json` 与 `vitest.config.ts`**

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM"],
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "tools", "tests"]
}
```

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: 写失败的测试**

`src/utils/__tests__/geometry.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { clamp, contains, lerp } from '../geometry';

describe('geometry', () => {
  it('contains uses inclusive bounds', () => {
    const rect = { x: 10, y: 20, w: 100, h: 50 };
    expect(contains(rect, 10, 20)).toBe(true);
    expect(contains(rect, 110, 70)).toBe(true);
    expect(contains(rect, 111, 70)).toBe(false);
    expect(contains(rect, 50, 71)).toBe(false);
  });

  it('clamps values into range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('lerps between two numbers', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(lerp(10, 0, 1)).toBe(0);
  });
});
```

`src/utils/__tests__/validate.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { isRecord } from '../validate';

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(3)).toBe(false);
  });
});
```

- [ ] **Step 4: 安装依赖并确认测试失败**

Run: `npm install`
Run: `npx vitest run src/utils/__tests__`
Expected: FAIL，提示无法解析 `../geometry` / `../validate`

- [ ] **Step 5: 实现工具函数**

`src/utils/geometry.ts`：

```ts
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function contains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
```

`src/utils/validate.ts`：

```ts
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 6: 运行测试与类型检查**

Run: `npx vitest run src/utils/__tests__`
Expected: PASS，5 个测试通过

Run: `npm run typecheck`
Expected: 无输出，退出码 0

- [ ] **Step 7: 提交**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/utils
git commit -m "chore: scaffold TypeScript project with vitest

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 小游戏入口与构建管线

**Files:**
- Create: `scripts/build.mjs`
- Create: `game.json`
- Create: `project.config.json`
- Create: `src/types/wechat.d.ts`
- Create: `src/main.ts`（本任务为临时可视验证入口，Task 15 会整体替换）

- [ ] **Step 1: 写构建脚本**

`scripts/build.mjs`：

```js
import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'game.js',
  format: 'iife',
  target: 'es2017',
  sourcemap: watch,
  minify: !watch,
  logLevel: 'info',
  loader: { '.json': 'json' },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching src/ → game.js');
} else {
  await esbuild.build(options);
}
```

- [ ] **Step 2: 写小游戏配置与微信类型声明**

`game.json`：

```json
{
  "deviceOrientation": "portrait",
  "showStatusBar": false
}
```

`project.config.json`：

```json
{
  "compileType": "game",
  "libVersion": "3.5.0",
  "appid": "touristappid",
  "projectname": "cake-sort-party",
  "setting": {
    "es6": true,
    "minified": false,
    "urlCheck": false
  },
  "condition": {}
}
```

`src/types/wechat.d.ts`：

```ts
declare const wx: any;
declare function requestAnimationFrame(callback: (time: number) => void): number;
declare function cancelAnimationFrame(handle: number): void;
```

- [ ] **Step 3: 写临时入口 `src/main.ts`**

```ts
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync();

canvas.width = info.windowWidth;
canvas.height = info.windowHeight;
ctx.fillStyle = '#FFF8F0';
ctx.fillRect(0, 0, info.windowWidth, info.windowHeight);
ctx.fillStyle = '#7A5C46';
ctx.font = 'bold 36px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('蛋糕排序派对', info.windowWidth / 2, info.windowHeight / 2);
```

- [ ] **Step 4: 构建并确认产物**

Run: `npm run build`
Expected: esbuild 输出 `game.js`，退出码 0

Run: `ls -la game.js`
Expected: 文件存在，大小大于 0

- [ ] **Step 5: 微信开发者工具手动验证**

打开微信开发者工具 → 导入项目 → 目录选择 `d:\cake_game` → 确认 `game.js` 被加载，屏幕显示「蛋糕排序派对」。
Expected: 无报错，文字居中显示。

- [ ] **Step 6: 提交**

```bash
git add scripts/build.mjs game.json project.config.json src/types/wechat.d.ts src/main.ts
git commit -m "feat: add WeChat mini-game shell and esbuild pipeline

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 领域类型与倒层规则（TDD）

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/rules.ts`
- Test: `src/core/__tests__/rules.test.ts`

- [ ] **Step 1: 写失败的测试**

`src/core/__tests__/rules.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/__tests__/rules.test.ts`
Expected: FAIL，提示无法解析 `../rules`

- [ ] **Step 3: 写领域类型**

`src/core/types.ts`：

```ts
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
```

- [ ] **Step 4: 实现规则**

`src/core/rules.ts`：

```ts
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
```

- [ ] **Step 5: 运行测试与类型检查**

Run: `npx vitest run src/core/__tests__/rules.test.ts`
Expected: PASS，全部用例通过

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 6: 提交**

```bash
git add src/core/types.ts src/core/rules.ts src/core/__tests__/rules.test.ts
git commit -m "feat(core): add pour rules and win/stuck detection

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 4: 提示与最优解求解器（TDD）

**Files:**
- Create: `src/core/solver.ts`
- Test: `src/core/__tests__/solver.test.ts`

- [ ] **Step 1: 写失败的测试**

`src/core/__tests__/solver.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/__tests__/solver.test.ts`
Expected: FAIL，提示无法解析 `../solver`

- [ ] **Step 3: 实现求解器**

`src/core/solver.ts`：

```ts
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
```

- [ ] **Step 4: 运行测试与类型检查**

Run: `npx vitest run src/core/__tests__/solver.test.ts`
Expected: PASS，4 个测试通过

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 5: 提交**

```bash
git add src/core/solver.ts src/core/__tests__/solver.test.ts
git commit -m "feat(core): add hint and optimal water-sort solver

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: GameSession 会话与道具额度（TDD）

**Files:**
- Create: `src/core/game.ts`
- Test: `src/core/__tests__/game.test.ts`

- [ ] **Step 1: 写失败的测试**

`src/core/__tests__/game.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/core/__tests__/game.test.ts`
Expected: FAIL，提示无法解析 `../game`

- [ ] **Step 3: 实现 GameSession**

`src/core/game.ts`：

```ts
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
```

- [ ] **Step 4: 运行测试与类型检查**

Run: `npx vitest run src/core/__tests__/game.test.ts`
Expected: PASS，7 个测试通过

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 5: 提交**

```bash
git add src/core/game.ts src/core/__tests__/game.test.ts
git commit -m "feat(core): add game session with undo and item allowances

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 6: 关卡解析、生成与校验

**Files:**
- Create: `src/core/flavors.ts`
- Create: `src/utils/rand.ts`
- Create: `src/core/levels.ts`
- Test: `src/utils/__tests__/rand.test.ts`
- Test: `src/core/__tests__/levels.test.ts`
- Create: `tools/gen-levels.ts`
- Create: `tools/verify-levels.ts`
- Create: `tests/levels.test.ts`
- Generated: `levels/levels.json`

- [ ] **Step 1: 写随机数失败的测试**

`src/utils/__tests__/rand.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rand';

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(20261125);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: 实现随机数与口味列表**

`src/utils/rand.ts`：

```ts
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`src/core/flavors.ts`：

```ts
import type { FlavorId } from './types';

export const ALL_FLAVORS: FlavorId[] = [
  'strawberry',
  'mango',
  'cocoa',
  'matcha',
  'blueberry',
  'vanilla',
  'caramel',
  'cherry',
  'lemon',
  'taro',
  'peach',
];
```

- [ ] **Step 3: 运行随机数测试**

Run: `npx vitest run src/utils/__tests__/rand.test.ts`
Expected: PASS，2 个测试通过

- [ ] **Step 4: 写关卡解析失败的测试**

`src/core/__tests__/levels.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { parseLevelFile } from '../levels';

const goodLevel = {
  id: 1,
  difficulty: 'easy',
  minMoves: 3,
  bowls: [
    ['a', 'a', 'b', 'b'],
    ['b', 'b', 'a', 'a'],
    [],
    [],
  ],
};

const goodFile = { version: 1, capacity: 4, levels: [goodLevel] };

describe('parseLevelFile', () => {
  it('accepts a valid file', () => {
    const file = parseLevelFile(goodFile);
    expect(file.levels).toHaveLength(1);
    expect(file.levels[0]).toMatchObject({
      id: 1,
      difficulty: 'easy',
      minMoves: 3,
      capacity: 4,
    });
  });

  it('rejects wrong version and capacity', () => {
    expect(() => parseLevelFile({ ...goodFile, version: 2 })).toThrow();
    expect(() => parseLevelFile({ ...goodFile, capacity: 5 })).toThrow();
  });

  it('rejects wrong flavor counts', () => {
    expect(() =>
      parseLevelFile({
        ...goodFile,
        levels: [
          { ...goodLevel, bowls: [['a', 'a', 'b'], ['b', 'b', 'a', 'a'], [], []] },
        ],
      }),
    ).toThrow(/口味/);
  });

  it('rejects bowls over capacity and duplicate ids', () => {
    expect(() =>
      parseLevelFile({
        ...goodFile,
        levels: [
          { ...goodLevel, bowls: [['a', 'a', 'a', 'a', 'b'], ['b', 'b', 'b'], [], []] },
        ],
      }),
    ).toThrow();

    expect(() =>
      parseLevelFile({ ...goodFile, levels: [goodLevel, { ...goodLevel }] }),
    ).toThrow(/重复/);
  });
});
```

- [ ] **Step 5: 实现关卡解析**

`src/core/levels.ts`：

```ts
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
```

- [ ] **Step 6: 运行解析测试**

Run: `npx vitest run src/core/__tests__/levels.test.ts`
Expected: PASS，4 个测试通过

- [ ] **Step 7: 写生成器与校验脚本**

`tools/gen-levels.ts`：

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { ALL_FLAVORS } from '../src/core/flavors';
import { findSolution, solveOptimal } from '../src/core/solver';
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
const ATTEMPTS = 300;
const QUICK_BUDGET = { maxNodes: 200_000, timeMs: 400 };
const OPTIMAL_BUDGET = { maxNodes: 1_500_000, timeMs: 5000 };

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

    const quick = findSolution(bowls, CAPACITY, QUICK_BUDGET);
    if (quick.status !== 'solved') continue;

    const optimal = solveOptimal(bowls, CAPACITY, OPTIMAL_BUDGET);
    if (optimal.status !== 'solved') continue;
    if (optimal.moves.length < spec.minMoves) continue;

    return {
      id: spec.id,
      difficulty: spec.difficulty,
      capacity: 4,
      bowls,
      minMoves: optimal.moves.length,
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
```

`tools/verify-levels.ts`：

```ts
import { readFileSync } from 'node:fs';
import { parseLevelFile } from '../src/core/levels';
import { solveOptimal } from '../src/core/solver';

const raw = JSON.parse(readFileSync('levels/levels.json', 'utf8')) as unknown;
const file = parseLevelFile(raw);

let failures = 0;
for (const level of file.levels) {
  const result = solveOptimal(level.bowls, level.capacity, {
    maxNodes: 3_000_000,
    timeMs: 30_000,
  });

  if (result.status !== 'solved') {
    console.error(`level ${level.id}: ${result.status}`);
    failures += 1;
    continue;
  }

  if (result.moves.length !== level.minMoves) {
    console.error(
      `level ${level.id}: minMoves=${level.minMoves} but solver found ${result.moves.length}`,
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
```

- [ ] **Step 8: 生成 30 关并校验**

Run: `npm run gen:levels`
Expected: 逐行输出 `level 1: ...` 到 `level 30: ...`，最后输出 `generated 30 levels -> levels/levels.json`；预计数分钟，11 色关卡可能更久。若单次命令超时，可放到后台运行并在完成后继续。

Run: `npm run verify:levels`
Expected: 30 行 `level N: ok (...)`，最后输出 `all 30 levels verified`

- [ ] **Step 9: 写关卡数据自动测试**

`tests/levels.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import raw from '../levels/levels.json';
import { parseLevelFile } from '../src/core/levels';
import { findSolution } from '../src/core/solver';

const file = parseLevelFile(raw);

describe('levels.json', () => {
  it('contains 30 levels with sequential ids', () => {
    expect(file.levels).toHaveLength(30);
    expect(file.levels.map(level => level.id)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
  });

  it(
    'all levels are solvable',
    () => {
      for (const level of file.levels) {
        const result = findSolution(level.bowls, level.capacity, {
          maxNodes: 1_000_000,
          timeMs: 5000,
        });
        expect(result.status, `level ${level.id}`).toBe('solved');
      }
    },
    60_000,
  );
});
```

- [ ] **Step 10: 运行全量测试与类型检查**

Run: `npm test`
Expected: 所有测试通过

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 11: 提交**

```bash
git add src/core/flavors.ts src/core/levels.ts src/utils/rand.ts src/utils/__tests__/rand.test.ts src/core/__tests__/levels.test.ts tools/gen-levels.ts tools/verify-levels.ts tests/levels.test.ts levels/levels.json
git commit -m "feat(levels): generate and verify 30 solvable levels

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 7: 全局配置与本地服务

**Files:**
- Create: `src/config/gameConfig.ts`
- Create: `assets/manifest.json`
- Create: `src/app/services/storage.ts`
- Create: `src/app/services/ads.ts`
- Create: `src/app/services/audio.ts`
- Create: `src/app/services/haptics.ts`
- Create: `src/app/services/analytics.ts`
- Test: `src/app/services/__tests__/storage.test.ts`
- Test: `src/app/services/__tests__/ads.test.ts`

- [ ] **Step 1: 写配置与空资源清单**

`src/config/gameConfig.ts`：

```ts
import type { ItemConfig } from '../core/types';

export const gameConfig = {
  designWidth: 750,
  saveKey: 'cake_sort_save_v1',
  items: {
    freeHintsPerAttempt: 1,
    freeBowlsPerAttempt: 1,
    rewardAmount: 1,
    maxExtraBowls: 2,
  } satisfies ItemConfig,
  ads: {
    mock: true,
    rewardedAdUnitId: '',
  },
  solver: {
    hintMaxNodes: 200_000,
    hintTimeMs: 300,
  },
  animation: {
    pourMs: 250,
    undoMs: 200,
  },
};
```

`assets/manifest.json`：

```json
{
  "images": [],
  "audio": {}
}
```

- [ ] **Step 2: 写存档失败的测试**

`src/app/services/__tests__/storage.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  createDefaultSave,
  normalizeSave,
  SaveStore,
  type KVStore,
} from '../storage';

class MemoryStore implements KVStore {
  private readonly data = new Map<string, string>();

  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}

describe('normalizeSave', () => {
  it('returns defaults for invalid data', () => {
    expect(normalizeSave(null)).toEqual(createDefaultSave());
    expect(normalizeSave('nope')).toEqual(createDefaultSave());
    expect(normalizeSave({ version: 2 })).toEqual(createDefaultSave());
  });

  it('keeps valid progress and fills missing settings', () => {
    const save = normalizeSave({
      version: 1,
      unlockedLevel: 7,
      completedLevelIds: [1, 2, 3, 3],
      settings: { sound: false },
    });
    expect(save.unlockedLevel).toBe(7);
    expect(save.completedLevelIds).toEqual([1, 2, 3]);
    expect(save.settings).toEqual({ sound: false, music: true, haptic: true });
  });

  it('drops invalid entries', () => {
    const save = normalizeSave({
      version: 1,
      unlockedLevel: -3,
      completedLevelIds: [1, 'x', 2.5, 0],
      settings: { sound: 'yes', music: null, haptic: false },
    });
    expect(save.unlockedLevel).toBe(1);
    expect(save.completedLevelIds).toEqual([1]);
    expect(save.settings).toEqual({ sound: true, music: true, haptic: false });
  });
});

describe('SaveStore', () => {
  it('round-trips through the key-value store', () => {
    const kv = new MemoryStore();
    const store = new SaveStore(kv, 'test');
    const data = { ...createDefaultSave(), unlockedLevel: 5 };
    store.save(data);
    expect(store.load()).toEqual(data);
  });

  it('falls back to defaults when the stored value is corrupt', () => {
    const kv = new MemoryStore();
    kv.set('test', '{not json');
    const store = new SaveStore(kv, 'test');
    expect(store.load()).toEqual(createDefaultSave());
  });

  it('resets to defaults', () => {
    const kv = new MemoryStore();
    const store = new SaveStore(kv, 'test');
    store.save({ ...createDefaultSave(), unlockedLevel: 9 });
    store.reset();
    expect(store.load()).toEqual(createDefaultSave());
  });
});
```

- [ ] **Step 3: 写广告失败的测试**

`src/app/services/__tests__/ads.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { MockAdService } from '../ads';

describe('MockAdService', () => {
  it('is always ready and returns the configured result', async () => {
    const rewarded = new MockAdService(0);
    expect(rewarded.isReady()).toBe(true);
    await expect(rewarded.showRewarded()).resolves.toBe('rewarded');
    await expect(new MockAdService(0, 'closed').showRewarded()).resolves.toBe('closed');
    await expect(new MockAdService(0, 'error').showRewarded()).resolves.toBe('error');
  });
});
```

- [ ] **Step 4: 实现存档服务**

`src/app/services/storage.ts`：

```ts
import { isRecord } from '../../utils/validate';

export interface SaveSettings {
  sound: boolean;
  music: boolean;
  haptic: boolean;
}

export interface SaveData {
  version: 1;
  unlockedLevel: number;
  completedLevelIds: number[];
  settings: SaveSettings;
}

export interface KVStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createDefaultSave(): SaveData {
  return {
    version: 1,
    unlockedLevel: 1,
    completedLevelIds: [],
    settings: { sound: true, music: true, haptic: true },
  };
}

export function normalizeSave(raw: unknown): SaveData {
  const save = createDefaultSave();
  if (!isRecord(raw) || raw.version !== 1) return save;

  if (
    typeof raw.unlockedLevel === 'number' &&
    Number.isInteger(raw.unlockedLevel) &&
    raw.unlockedLevel >= 1
  ) {
    save.unlockedLevel = raw.unlockedLevel;
  }

  if (Array.isArray(raw.completedLevelIds)) {
    const ids = raw.completedLevelIds.filter(
      (value): value is number =>
        typeof value === 'number' && Number.isInteger(value) && value >= 1,
    );
    save.completedLevelIds = [...new Set(ids)].sort((a, b) => a - b);
  }

  if (isRecord(raw.settings)) {
    const settings = raw.settings;
    if (typeof settings.sound === 'boolean') save.settings.sound = settings.sound;
    if (typeof settings.music === 'boolean') save.settings.music = settings.music;
    if (typeof settings.haptic === 'boolean') save.settings.haptic = settings.haptic;
  }

  return save;
}

export class SaveStore {
  constructor(
    private readonly kv: KVStore,
    private readonly key: string,
  ) {}

  load(): SaveData {
    try {
      const raw = this.kv.get(this.key);
      if (typeof raw !== 'string' || raw === '') return createDefaultSave();
      return normalizeSave(JSON.parse(raw));
    } catch {
      return createDefaultSave();
    }
  }

  save(data: SaveData): void {
    this.kv.set(this.key, JSON.stringify(data));
  }

  reset(): void {
    this.kv.remove(this.key);
  }
}

export function createWxStore(): KVStore {
  return {
    get: key => {
      const value = wx.getStorageSync(key);
      return typeof value === 'string' && value.length > 0 ? value : null;
    },
    set: (key, value) => wx.setStorageSync(key, value),
    remove: key => wx.removeStorageSync(key),
  };
}
```

- [ ] **Step 5: 实现广告服务**

`src/app/services/ads.ts`：

```ts
export type AdResult = 'rewarded' | 'closed' | 'error';

export interface AdService {
  isReady(): boolean;
  showRewarded(): Promise<AdResult>;
}

export interface AdsConfig {
  mock: boolean;
  rewardedAdUnitId: string;
}

export class MockAdService implements AdService {
  constructor(
    private readonly delayMs = 300,
    private readonly result: AdResult = 'rewarded',
  ) {}

  isReady(): boolean {
    return true;
  }

  showRewarded(): Promise<AdResult> {
    return new Promise(resolve => {
      setTimeout(() => resolve(this.result), this.delayMs);
    });
  }
}

class WechatAdService implements AdService {
  private readonly ad: any;
  private pending: ((result: AdResult) => void) | null = null;

  constructor(unitId: string) {
    this.ad = wx.createRewardedVideoAd({ adUnitId: unitId });
    this.ad.onClose((result: { isEnded?: boolean } | undefined) => {
      this.finish(!result || result.isEnded ? 'rewarded' : 'closed');
    });
    this.ad.onError(() => this.finish('error'));
  }

  isReady(): boolean {
    return true;
  }

  showRewarded(): Promise<AdResult> {
    return new Promise(resolve => {
      this.pending = resolve;
      this.ad.show().catch(() => {
        this.ad
          .load()
          .then(() => this.ad.show())
          .catch(() => this.finish('error'));
      });
    });
  }

  private finish(result: AdResult): void {
    const pending = this.pending;
    this.pending = null;
    if (pending) pending(result);
  }
}

export function createAdService(config: AdsConfig): AdService {
  if (
    config.mock ||
    !config.rewardedAdUnitId ||
    typeof wx === 'undefined' ||
    typeof wx.createRewardedVideoAd !== 'function'
  ) {
    return new MockAdService();
  }
  return new WechatAdService(config.rewardedAdUnitId);
}
```

- [ ] **Step 6: 实现音频、震动、埋点服务**

`src/app/services/audio.ts`：

```ts
export type AudioSource = (key: string) => string | undefined;

export class AudioService {
  private music: any = null;
  private musicKey: string | null = null;
  private soundEnabled = true;
  private musicEnabled = true;

  constructor(private readonly source: AudioSource) {}

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!enabled) this.stopMusic();
  }

  playMusic(key: string): void {
    if (!this.musicEnabled || this.musicKey === key) return;
    const src = this.source(key);
    if (!src) return;

    this.stopMusic();
    const audio = wx.createInnerAudioContext();
    audio.src = src;
    audio.loop = true;
    audio.onError(() => this.stopMusic());
    audio.play();
    this.music = audio;
    this.musicKey = key;
  }

  stopMusic(): void {
    if (this.music) {
      this.music.stop();
      this.music.destroy();
    }
    this.music = null;
    this.musicKey = null;
  }

  playSfx(key: string): void {
    if (!this.soundEnabled) return;
    const src = this.source(key);
    if (!src) return;

    const audio = wx.createInnerAudioContext();
    audio.src = src;
    audio.onEnded(() => audio.destroy());
    audio.onError(() => audio.destroy());
    audio.play();
  }
}
```

`src/app/services/haptics.ts`：

```ts
export class HapticsService {
  constructor(private enabled = true) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  light(): void {
    if (
      !this.enabled ||
      typeof wx === 'undefined' ||
      typeof wx.vibrateShort !== 'function'
    ) {
      return;
    }
    try {
      wx.vibrateShort({ type: 'light' });
    } catch {
      // 部分机型不支持轻震动，忽略即可
    }
  }
}
```

`src/app/services/analytics.ts`：

```ts
export class AnalyticsService {
  track(_event: string, _payload?: Record<string, unknown>): void {
    // MVP 不接埋点，保留接口供后续接入
  }
}
```

- [ ] **Step 7: 运行测试与类型检查**

Run: `npx vitest run src/app/services/__tests__`
Expected: PASS，7 个测试通过（存档 6 + 广告 1）

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 8: 提交**

```bash
git add src/config/gameConfig.ts assets/manifest.json src/app/services src/app/services/__tests__
git commit -m "feat(services): add save, rewarded ad, audio and haptics services

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 8: 渲染基础（主题、Canvas、资源、绘制原语）

**Files:**
- Create: `src/render/theme.ts`
- Create: `src/render/canvas.ts`
- Create: `src/render/assets.ts`
- Create: `src/render/draw.ts`
- Create: `src/render/background.ts`
- Test: `src/render/__tests__/assets.test.ts`

- [ ] **Step 1: 写资源清单解析失败的测试**

`src/render/__tests__/assets.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { Assets, parseManifest } from '../assets';

describe('parseManifest', () => {
  it('keeps valid image and audio entries', () => {
    const manifest = parseManifest({
      images: [
        {
          key: 'bowl.body',
          src: 'assets/images/bowl_body.png',
          width: 100,
          height: 200,
          slice: [1, 2, 3, 4],
        },
      ],
      audio: { bgm: 'assets/audio/bgm.mp3', bad: 3 },
    });
    expect(manifest.images).toHaveLength(1);
    expect(manifest.images[0]).toEqual({
      key: 'bowl.body',
      src: 'assets/images/bowl_body.png',
      width: 100,
      height: 200,
      slice: [1, 2, 3, 4],
    });
    expect(manifest.audio).toEqual({ bgm: 'assets/audio/bgm.mp3' });
  });

  it('ignores malformed input', () => {
    expect(parseManifest(null)).toEqual({ images: [], audio: {} });
    expect(parseManifest({ images: [{ key: 1 }], audio: [] })).toEqual({
      images: [],
      audio: {},
    });
  });
});

describe('Assets', () => {
  it('loads images and reports missing keys', async () => {
    const assets = new Assets(async src => ({ src }));
    await assets.load({
      images: [{ key: 'x', src: 'x.png', width: 10, height: 20 }],
      audio: {},
    });
    expect(assets.image('x')?.width).toBe(10);
    expect(assets.image('missing')).toBeUndefined();
  });

  it('keeps running when an image fails to load', async () => {
    const assets = new Assets(async () => {
      throw new Error('load fail');
    });
    await assets.load({
      images: [{ key: 'x', src: 'x.png', width: 10, height: 20 }],
      audio: {},
    });
    expect(assets.image('x')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/render/__tests__/assets.test.ts`
Expected: FAIL，提示无法解析 `../assets`

- [ ] **Step 3: 写主题**

`src/render/theme.ts`：

```ts
import type { FlavorId } from '../core/types';

export interface FlavorStyle {
  name: string;
  base: string;
  dark: string;
  light: string;
}

export const FLAVORS: Record<FlavorId, FlavorStyle> = {
  strawberry: { name: '草莓', base: '#FF9DB5', dark: '#E87896', light: '#FFC6D5' },
  mango: { name: '芒果', base: '#FFC46B', dark: '#E8A445', light: '#FFDCA4' },
  cocoa: { name: '可可', base: '#B98A65', dark: '#9A6C48', light: '#D3AC8D' },
  matcha: { name: '抹茶', base: '#9FD58F', dark: '#7CB86A', light: '#C4E6B8' },
  blueberry: { name: '蓝莓', base: '#8FA8E8', dark: '#6B85CC', light: '#B9CAF2' },
  vanilla: { name: '香草', base: '#F2DFAF', dark: '#D8BF85', light: '#F8ECCB' },
  caramel: { name: '焦糖', base: '#E0A05C', dark: '#C4823E', light: '#F0C08C' },
  cherry: { name: '樱桃', base: '#E86A7A', dark: '#CC4E5F', light: '#F49AA6' },
  lemon: { name: '柠檬', base: '#F3E06E', dark: '#D8C34C', light: '#F8EDA2' },
  taro: { name: '紫薯', base: '#B79BD8', dark: '#9777C0', light: '#D3C0EA' },
  peach: { name: '蜜桃', base: '#FFB59B', dark: '#E89474', light: '#FFD0BE' },
};

export const theme = {
  colors: {
    bgTop: '#FFF8F0',
    bgBottom: '#FFEEDF',
    text: '#7A5C46',
    textLight: '#A98A72',
    primary: '#FF9DB5',
    primaryDark: '#E87896',
    panel: '#FFFDF9',
    panelBorder: '#F0DCC8',
    highlight: '#FFB020',
    locked: '#D9C9BA',
    danger: '#D9534F',
    success: '#7CB86A',
  },
  font: '"PingFang SC", "Microsoft YaHei", sans-serif',
  fontSize: {
    title: 56,
    heading: 40,
    body: 28,
    small: 22,
  },
  radius: {
    bowl: 18,
    button: 24,
    panel: 24,
    layer: 8,
  },
  spacing: {
    xxs: 8,
    xs: 12,
    sm: 16,
    md: 24,
  },
};
```

- [ ] **Step 4: 写 Canvas 视口**

`src/render/canvas.ts`：

```ts
export interface Viewport {
  canvas: any;
  ctx: CanvasRenderingContext2D;
  scale: number;
  pixelScale: number;
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
}

export function createViewport(designWidth = 750): Viewport {
  const info =
    typeof wx.getWindowInfo === 'function'
      ? wx.getWindowInfo()
      : wx.getSystemInfoSync();

  const canvas = wx.createCanvas();
  const dpr = info.pixelRatio || 1;
  canvas.width = info.windowWidth * dpr;
  canvas.height = info.windowHeight * dpr;

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const scale = info.windowWidth / designWidth;
  const safe = info.safeArea || { top: 0, bottom: info.windowHeight };

  return {
    canvas,
    ctx,
    scale,
    pixelScale: dpr * scale,
    width: designWidth,
    height: info.windowHeight / scale,
    safeTop: safe.top / scale,
    safeBottom: (info.windowHeight - safe.bottom) / scale,
  };
}
```

- [ ] **Step 5: 写资源管理（解析 + 缺图回退）**

`src/render/assets.ts`：

```ts
import { isRecord } from '../utils/validate';

export interface ManifestImage {
  key: string;
  src: string;
  width: number;
  height: number;
  slice?: [number, number, number, number];
}

export interface Manifest {
  images: ManifestImage[];
  audio: Record<string, string>;
}

export interface LoadedImage {
  source: any;
  width: number;
  height: number;
}

export interface ImageLookup {
  image(key: string): LoadedImage | undefined;
}

export type ImageLoader = (src: string) => Promise<any>;

function isSlice(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every(item => typeof item === 'number')
  );
}

export function parseManifest(raw: unknown): Manifest {
  const manifest: Manifest = { images: [], audio: {} };
  if (!isRecord(raw)) return manifest;

  if (Array.isArray(raw.images)) {
    for (const item of raw.images) {
      if (!isRecord(item)) continue;
      const { key, src, width, height } = item;
      if (
        typeof key !== 'string' ||
        typeof src !== 'string' ||
        typeof width !== 'number' ||
        typeof height !== 'number'
      ) {
        continue;
      }
      const image: ManifestImage = { key, src, width, height };
      if (isSlice(item.slice)) image.slice = item.slice;
      manifest.images.push(image);
    }
  }

  if (isRecord(raw.audio)) {
    for (const [key, src] of Object.entries(raw.audio)) {
      if (typeof src === 'string') manifest.audio[key] = src;
    }
  }

  return manifest;
}

function wxImageLoader(src: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const image = wx.createImage();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    image.src = src;
  });
}

export class Assets {
  private readonly images = new Map<string, LoadedImage>();
  private readonly audioPaths = new Map<string, string>();

  constructor(private readonly loadImage: ImageLoader = wxImageLoader) {}

  async load(manifest: Manifest): Promise<void> {
    for (const [key, src] of Object.entries(manifest.audio)) {
      this.audioPaths.set(key, src);
    }

    await Promise.all(
      manifest.images.map(async item => {
        try {
          const source = await this.loadImage(item.src);
          this.images.set(item.key, {
            source,
            width: item.width,
            height: item.height,
          });
        } catch (error) {
          console.warn(`[assets] ${item.key} 加载失败，使用占位绘制`, error);
        }
      }),
    );
  }

  image(key: string): LoadedImage | undefined {
    return this.images.get(key);
  }

  audio(key: string): string | undefined {
    return this.audioPaths.get(key);
  }
}
```

- [ ] **Step 6: 写绘制原语**

`src/render/draw.ts`：

```ts
import { theme } from './theme';

export type TextAlign = 'left' | 'center' | 'right';
export type TextBaseline = 'top' | 'middle' | 'bottom';

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: string,
): void {
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  stroke: string,
  lineWidth = 2,
): void {
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: TextAlign = 'center',
  baseline: TextBaseline = 'middle',
  bold = false,
): void {
  ctx.save();
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${theme.font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align as CanvasTextAlign;
  ctx.textBaseline = baseline as CanvasTextBaseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}
```

- [ ] **Step 7: 写背景绘制**

`src/render/background.ts`：

```ts
import type { ImageLookup } from './assets';
import type { Viewport } from './canvas';
import { theme } from './theme';

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  images?: ImageLookup,
): void {
  const background = images?.image('bg');
  if (background) {
    ctx.drawImage(background.source, 0, 0, viewport.width, viewport.height);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
  gradient.addColorStop(0, theme.colors.bgTop);
  gradient.addColorStop(1, theme.colors.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.beginPath();
  ctx.arc(viewport.width - 90, 180, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(70, viewport.height * 0.72, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 183, 197, 0.14)';
  ctx.beginPath();
  ctx.arc(viewport.width * 0.2, 120, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 8: 运行测试与类型检查**

Run: `npx vitest run src/render/__tests__/assets.test.ts`
Expected: PASS，4 个测试通过

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 9: 提交**

```bash
git add src/render/theme.ts src/render/canvas.ts src/render/assets.ts src/render/draw.ts src/render/background.ts src/render/__tests__/assets.test.ts
git commit -m "feat(render): add theme, viewport, asset manifest and drawing primitives

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: 布局算法、布丁杯绘制与通用组件

**Files:**
- Create: `src/render/layout.ts`
- Test: `src/render/__tests__/layout.test.ts`
- Create: `src/render/painters/bowl.ts`
- Create: `src/app/components/button.ts`
- Create: `src/app/components/modal.ts`
- Create: `src/app/components/toast.ts`
- Create: `src/app/components/settings.ts`

- [ ] **Step 1: 写布局失败的测试**

`src/render/__tests__/layout.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { computeGridLayout } from '../layout';

const area = { x: 32, y: 200, w: 686, h: 700 };

describe('computeGridLayout', () => {
  it('uses 4 columns for up to 8 bowls', () => {
    const layout = computeGridLayout(7, area);
    expect(layout.cols).toBe(4);
    expect(layout.rows).toBe(2);
    expect(layout.positions).toHaveLength(7);
  });

  it('uses 5 columns for 9 or more bowls', () => {
    const layout = computeGridLayout(14, area);
    expect(layout.cols).toBe(5);
    expect(layout.rows).toBe(3);
  });

  it('keeps the bowl aspect ratio and fits inside the area', () => {
    for (const count of [4, 7, 10, 14, 16]) {
      const layout = computeGridLayout(count, area);
      expect(layout.cellW / layout.cellH).toBeCloseTo(0.55, 2);
      for (const position of layout.positions) {
        expect(position.x).toBeGreaterThanOrEqual(area.x - 0.001);
        expect(position.y).toBeGreaterThanOrEqual(area.y - 0.001);
        expect(position.x + layout.cellW).toBeLessThanOrEqual(area.x + area.w + 0.001);
        expect(position.y + layout.cellH).toBeLessThanOrEqual(area.y + area.h + 0.001);
      }
    }
  });

  it('shrinks cells when the area is small', () => {
    const layout = computeGridLayout(16, { x: 0, y: 0, w: 400, h: 300 });
    expect(layout.cellW).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/render/__tests__/layout.test.ts`
Expected: FAIL，提示无法解析 `../layout`

- [ ] **Step 3: 实现布局**

`src/render/layout.ts`：

```ts
import type { Point, Rect } from '../utils/geometry';

export interface GridLayout {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  positions: Point[];
}

export function computeGridLayout(count: number, area: Rect): GridLayout {
  const safeCount = Math.max(1, count);
  const cols = safeCount <= 8 ? 4 : 5;
  const rows = Math.ceil(safeCount / cols);
  const gapX = 24;
  const gapY = 20;
  const aspect = 0.55;
  const maxCellH = 240;

  let cellH = Math.min(maxCellH, (area.h - gapY * (rows - 1)) / rows);
  let cellW = cellH * aspect;

  const maxCellW = (area.w - gapX * (cols - 1)) / cols;
  if (cellW > maxCellW) {
    cellW = maxCellW;
    cellH = cellW / aspect;
  }

  const totalH = rows * cellH + (rows - 1) * gapY;
  const startY = area.y + (area.h - totalH) / 2;
  const positions: Point[] = [];

  for (let row = 0; row < rows; row += 1) {
    const inRow = Math.min(cols, safeCount - row * cols);
    const rowW = inRow * cellW + (inRow - 1) * gapX;
    const startX = area.x + (area.w - rowW) / 2;
    for (let col = 0; col < inRow; col += 1) {
      positions.push({
        x: startX + col * (cellW + gapX),
        y: startY + row * (cellH + gapY),
      });
    }
  }

  return { cols, rows, cellW, cellH, positions };
}
```

- [ ] **Step 4: 运行布局测试**

Run: `npx vitest run src/render/__tests__/layout.test.ts`
Expected: PASS，4 个测试通过

- [ ] **Step 5: 写布丁杯绘制**

`src/render/painters/bowl.ts`：

```ts
import type { FlavorId } from '../../core/types';
import type { Rect } from '../../utils/geometry';
import type { ImageLookup } from '../assets';
import { fillRoundRect, strokeRoundRect } from '../draw';
import { FLAVORS, theme } from '../theme';

export interface BowlMetrics {
  pad: number;
  innerW: number;
  innerH: number;
  layerH: number;
  bottomY: number;
}

export interface BowlOptions {
  selected?: boolean;
  highlight?: boolean;
  hiddenTop?: number;
  pop?: number;
  alpha?: number;
}

export function bowlMetrics(rect: Rect): BowlMetrics {
  const pad = Math.max(4, rect.w * 0.07);
  const rim = Math.max(10, rect.h * 0.07);
  const innerW = rect.w - pad * 2;
  const innerH = rect.h - pad * 2 - rim;
  const layerH = innerH / 4;
  const bottomY = rect.y + rect.h - pad;
  return { pad, innerW, innerH, layerH, bottomY };
}

export function drawFlavorLayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  flavor: FlavorId,
): void {
  const style = FLAVORS[flavor] ?? {
    name: flavor,
    base: '#CFC0B2',
    dark: '#B0A08F',
    light: '#E6DCD2',
  };
  fillRoundRect(ctx, x, y, w, h, theme.radius.layer, style.base);

  ctx.save();
  ctx.globalAlpha = 0.45;
  fillRoundRect(ctx, x + 3, y + 3, w - 6, Math.max(2, h * 0.28), theme.radius.layer - 2, style.light);
  ctx.restore();
}

export function drawFlavorBlock(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  w: number,
  h: number,
  flavor: FlavorId,
  images?: ImageLookup,
): void {
  const x = centerX - w / 2;
  const y = centerY - h / 2;

  const image = images?.image(`layer.${flavor}`);
  if (image) {
    ctx.drawImage(image.source, x, y, w, h);
    return;
  }

  const style = FLAVORS[flavor] ?? {
    name: flavor,
    base: '#CFC0B2',
    dark: '#B0A08F',
    light: '#E6DCD2',
  };

  ctx.save();
  ctx.shadowColor = style.dark;
  ctx.shadowBlur = 12;
  fillRoundRect(ctx, x, y, w, h, theme.radius.layer, style.base);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.4;
  fillRoundRect(ctx, x + 4, y + 4, w - 8, Math.max(3, h * 0.2), theme.radius.layer, style.light);
  ctx.restore();
}

export function drawBowl(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  layers: ReadonlyArray<FlavorId>,
  options: BowlOptions = {},
  images?: ImageLookup,
): void {
  const metrics = bowlMetrics(rect);
  const body = images?.image('bowl.body');

  ctx.save();
  if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
  if (options.pop && options.pop !== 1) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h;
    ctx.translate(cx, cy);
    ctx.scale(1, options.pop);
    ctx.translate(-cx, -cy);
  }

  if (body) {
    ctx.save();
    ctx.shadowColor = 'rgba(196,140,100,0.18)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(body.source, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.shadowColor = 'rgba(196,140,100,0.18)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, theme.radius.bowl, '#FFFDF8');
    ctx.restore();
  }

  const visible = Math.max(0, layers.length - (options.hiddenTop ?? 0));
  for (let index = 0; index < visible; index += 1) {
    const y = metrics.bottomY - (index + 1) * metrics.layerH + 2;
    const layerImage = images?.image(`layer.${layers[index]}`);
    if (layerImage) {
      ctx.drawImage(
        layerImage.source,
        rect.x + metrics.pad,
        y,
        metrics.innerW,
        metrics.layerH - 4,
      );
    } else {
      drawFlavorLayer(
        ctx,
        rect.x + metrics.pad,
        y,
        metrics.innerW,
        metrics.layerH - 4,
        layers[index],
      );
    }
  }

  if (!body) {
    fillRoundRect(
      ctx,
      rect.x,
      rect.y,
      rect.w,
      Math.max(10, rect.h * 0.07),
      8,
      '#FFF1E4',
    );
  }

  const stroke = options.highlight
    ? theme.colors.highlight
    : options.selected
      ? theme.colors.primaryDark
      : 'rgba(214,180,150,0.6)';
  const width = options.highlight ? 6 : options.selected ? 4 : 2;

  ctx.save();
  if (options.highlight) {
    ctx.shadowColor = theme.colors.highlight;
    ctx.shadowBlur = 18;
  }
  strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, theme.radius.bowl, stroke, width);
  ctx.restore();

  ctx.restore();
}
```

- [ ] **Step 6: 写按钮组件**

`src/app/components/button.ts`：

```ts
import type { Rect } from '../../utils/geometry';
import { contains } from '../../utils/geometry';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';

export interface ButtonSpec {
  id: string;
  rect: Rect;
  label: string;
  variant?: 'primary' | 'ghost';
  enabled?: boolean;
  badge?: number;
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  button: ButtonSpec,
): void {
  const enabled = button.enabled !== false;
  const primary = button.variant === 'primary';
  const fill = !enabled
    ? '#E9DED3'
    : primary
      ? theme.colors.primary
      : theme.colors.panel;
  const color = !enabled
    ? '#B9A897'
    : primary
      ? '#FFFFFF'
      : theme.colors.text;

  ctx.save();
  ctx.shadowColor = 'rgba(196,140,100,0.22)';
  ctx.shadowBlur = primary ? 18 : 10;
  ctx.shadowOffsetY = 6;
  fillRoundRect(
    ctx,
    button.rect.x,
    button.rect.y,
    button.rect.w,
    button.rect.h,
    theme.radius.button,
    fill,
  );
  ctx.restore();

  drawText(
    ctx,
    button.label,
    button.rect.x + button.rect.w / 2,
    button.rect.y + button.rect.h / 2,
    32,
    color,
    'center',
    'middle',
    true,
  );

  if (button.badge && button.badge > 0) {
    const bx = button.rect.x + button.rect.w - 12;
    const by = button.rect.y + 8;
    ctx.beginPath();
    ctx.arc(bx, by, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#FF6B6B';
    ctx.fill();
    drawText(ctx, String(button.badge), bx, by + 1, 22, '#FFFFFF', 'center', 'middle', true);
  }
}

export function hitButton(button: ButtonSpec, x: number, y: number): boolean {
  return button.enabled !== false && contains(button.rect, x, y);
}
```

- [ ] **Step 7: 写模态弹窗与 Toast**

`src/app/components/modal.ts`：

```ts
import type { Rect } from '../../utils/geometry';
import { contains } from '../../utils/geometry';
import type { Viewport } from '../../render/canvas';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';

export interface ModalAction {
  label: string;
  primary?: boolean;
  onPress: () => void | Promise<void>;
}

export class Modal {
  visible = false;
  private title = '';
  private message = '';
  private actions: ModalAction[] = [];
  private hitAreas: Array<{ rect: Rect; action: ModalAction }> = [];

  show(title: string, message: string, actions: ModalAction[]): void {
    this.title = title;
    this.message = message;
    this.actions = actions;
    this.hitAreas = [];
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    if (!this.visible) return;

    ctx.fillStyle = 'rgba(60,40,30,0.38)';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    const width = 580;
    const height = 380;
    const x = (viewport.width - width) / 2;
    const y = (viewport.height - height) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(120,80,50,0.25)';
    ctx.shadowBlur = 30;
    fillRoundRect(ctx, x, y, width, height, theme.radius.panel, theme.colors.panel);
    ctx.restore();

    drawText(
      ctx,
      this.title,
      viewport.width / 2,
      y + 64,
      38,
      theme.colors.text,
      'center',
      'middle',
      true,
    );

    this.message.split('\n').forEach((line, index) => {
      drawText(
        ctx,
        line,
        viewport.width / 2,
        y + 130 + index * 40,
        26,
        theme.colors.textLight,
      );
    });

    const count = this.actions.length;
    const gap = 20;
    const buttonWidth = (width - 80 - gap * (count - 1)) / count;

    this.hitAreas = this.actions.map((action, index) => {
      const rect = {
        x: x + 40 + index * (buttonWidth + gap),
        y: y + height - 108,
        w: buttonWidth,
        h: 76,
      };
      fillRoundRect(
        ctx,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        theme.radius.button,
        action.primary ? theme.colors.primary : '#FFF2E4',
      );
      drawText(
        ctx,
        action.label,
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
        28,
        action.primary ? '#FFFFFF' : theme.colors.text,
        'center',
        'middle',
        true,
      );
      return { rect, action };
    });
  }

  tap(x: number, y: number): boolean {
    if (!this.visible) return false;
    for (const area of this.hitAreas) {
      if (contains(area.rect, x, y)) {
        this.visible = false;
        void area.action.onPress();
        return true;
      }
    }
    return true;
  }
}
```

`src/app/components/toast.ts`：

```ts
import type { Viewport } from '../../render/canvas';
import { drawText, fillRoundRect } from '../../render/draw';

export class Toast {
  private message = '';
  private until = 0;

  show(message: string, durationMs = 2000): void {
    this.message = message;
    this.until = Date.now() + durationMs;
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    if (Date.now() >= this.until) return;

    const width = Math.min(620, viewport.width - 80);
    const height = 80;
    const x = (viewport.width - width) / 2;
    const y = viewport.height - viewport.safeBottom - 260;

    fillRoundRect(ctx, x, y, width, height, 40, 'rgba(90,62,46,0.86)');
    drawText(
      ctx,
      this.message,
      viewport.width / 2,
      y + height / 2,
      26,
      '#FFF8F0',
    );
  }
}
```

- [ ] **Step 8: 写设置面板**

`src/app/components/settings.ts`：

```ts
import type { Rect } from '../../utils/geometry';
import { contains } from '../../utils/geometry';
import type { Viewport } from '../../render/canvas';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';

export interface SettingsValues {
  sound: boolean;
  music: boolean;
  haptic: boolean;
}

export class SettingsModal {
  visible = false;
  private hitAreas: Array<{ rect: Rect; onPress: () => void }> = [];

  constructor(
    private readonly getValues: () => SettingsValues,
    private readonly patch: (values: Partial<SettingsValues>) => void,
    private readonly onReset: () => void,
  ) {}

  open(): void {
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    if (!this.visible) return;

    ctx.fillStyle = 'rgba(60,40,30,0.38)';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    const width = 620;
    const height = 560;
    const x = (viewport.width - width) / 2;
    const y = (viewport.height - height) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(120,80,50,0.25)';
    ctx.shadowBlur = 30;
    fillRoundRect(ctx, x, y, width, height, theme.radius.panel, theme.colors.panel);
    ctx.restore();

    drawText(
      ctx,
      '设置',
      viewport.width / 2,
      y + 62,
      38,
      theme.colors.text,
      'center',
      'middle',
      true,
    );

    const values = this.getValues();
    const rows: Array<{ label: string; value: string; onPress: () => void }> = [
      {
        label: '音效',
        value: values.sound ? '开' : '关',
        onPress: () => this.patch({ sound: !values.sound }),
      },
      {
        label: '音乐',
        value: values.music ? '开' : '关',
        onPress: () => this.patch({ music: !values.music }),
      },
      {
        label: '震动',
        value: values.haptic ? '开' : '关',
        onPress: () => this.patch({ haptic: !values.haptic }),
      },
    ];

    this.hitAreas = [];
    rows.forEach((row, index) => {
      const rect = { x: x + 40, y: y + 120 + index * 84, w: width - 80, h: 68 };
      fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, '#FFF6EC');
      drawText(ctx, row.label, rect.x + 32, rect.y + rect.h / 2, 28, theme.colors.text, 'left');
      drawText(
        ctx,
        row.value,
        rect.x + rect.w - 32,
        rect.y + rect.h / 2,
        28,
        theme.colors.textLight,
        'right',
      );
      this.hitAreas.push({ rect, onPress: row.onPress });
    });

    const resetRect = {
      x: x + 40,
      y: y + 120 + rows.length * 84 + 12,
      w: width - 80,
      h: 62,
    };
    drawText(
      ctx,
      '重置进度',
      x + width / 2,
      resetRect.y + resetRect.h / 2,
      26,
      theme.colors.danger,
    );
    this.hitAreas.push({
      rect: resetRect,
      onPress: () => {
        this.close();
        this.onReset();
      },
    });

    const closeRect = {
      x: x + 40,
      y: y + height - 108,
      w: width - 80,
      h: 76,
    };
    fillRoundRect(
      ctx,
      closeRect.x,
      closeRect.y,
      closeRect.w,
      closeRect.h,
      theme.radius.button,
      theme.colors.primary,
    );
    drawText(
      ctx,
      '关闭',
      x + width / 2,
      closeRect.y + closeRect.h / 2,
      30,
      '#FFFFFF',
      'center',
      'middle',
      true,
    );
    this.hitAreas.push({ rect: closeRect, onPress: () => this.close() });
  }

  tap(x: number, y: number): boolean {
    if (!this.visible) return false;
    for (const area of this.hitAreas) {
      if (contains(area.rect, x, y)) {
        area.onPress();
        return true;
      }
    }
    return true;
  }
}
```

- [ ] **Step 9: 运行测试与类型检查**

Run: `npx vitest run src/render/__tests__/layout.test.ts`
Expected: PASS，4 个测试通过

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 10: 提交**

```bash
git add src/render/layout.ts src/render/painters/bowl.ts src/render/__tests__/layout.test.ts src/app/components
git commit -m "feat(render): add grid layout, pudding bowl painter and UI components

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 10: 应用外壳与启动场景

**Files:**
- Create: `src/app/scene.ts`
- Create: `src/app/app.ts`
- Create: `src/app/scenes/boot.ts`

- [ ] **Step 1: 写 Scene 接口**

`src/app/scene.ts`：

```ts
export interface Scene {
  enter(): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onTouchStart(x: number, y: number): void;
  onTouchMove(x: number, y: number): void;
  onTouchEnd(x: number, y: number): void;
}
```

- [ ] **Step 2: 写 App 外壳**

`src/app/app.ts`：

```ts
import type { Level, LevelFile } from '../core/types';
import type { Assets } from '../render/assets';
import type { Viewport } from '../render/canvas';
import type { AdService } from './services/ads';
import type { AnalyticsService } from './services/analytics';
import type { AudioService } from './services/audio';
import type { HapticsService } from './services/haptics';
import type { SaveData, SaveStore } from './services/storage';
import type { Scene } from './scene';

export interface Services {
  ads: AdService;
  audio: AudioService;
  haptics: HapticsService;
  analytics: AnalyticsService;
}

export interface SceneFactory {
  home(app: App): Scene;
  levels(app: App): Scene;
  game(app: App, level: Level): Scene;
}

export class App {
  save: SaveData;
  scene: Scene | null = null;

  constructor(
    readonly viewport: Viewport,
    readonly assets: Assets,
    readonly store: SaveStore,
    readonly services: Services,
    readonly levels: LevelFile,
    private readonly factory: SceneFactory,
  ) {
    this.save = store.load();
    this.applySettings();
  }

  setScene(scene: Scene): void {
    this.scene?.exit();
    this.scene = scene;
    scene.enter();
  }

  update(dt: number): void {
    this.scene?.update(dt);
  }

  render(): void {
    if (!this.scene) return;
    const { ctx, pixelScale, width, height } = this.viewport;
    ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    this.scene.render(ctx);
  }

  touchStart(x: number, y: number): void {
    // 微信禁止无交互自动播放；每次触摸都尝试启动 BGM（playMusic 内部幂等）
    if (this.save.settings.music) this.services.audio.playMusic('bgm');
    this.scene?.onTouchStart(x, y);
  }

  touchMove(x: number, y: number): void {
    this.scene?.onTouchMove(x, y);
  }

  touchEnd(x: number, y: number): void {
    this.scene?.onTouchEnd(x, y);
  }

  persist(): void {
    this.store.save(this.save);
  }

  applySettings(): void {
    const settings = this.save.settings;
    this.services.audio.setSoundEnabled(settings.sound);
    this.services.audio.setMusicEnabled(settings.music);
    this.services.haptics.setEnabled(settings.haptic);
    if (settings.music) this.services.audio.playMusic('bgm');
  }

  resetProgress(): void {
    this.store.reset();
    this.save = this.store.load();
    this.applySettings();
  }

  goHome(): void {
    this.setScene(this.factory.home(this));
  }

  goLevels(): void {
    this.setScene(this.factory.levels(this));
  }

  startLevel(id: number): void {
    const level = this.levels.levels.find(item => item.id === id);
    if (!level) return;
    this.setScene(this.factory.game(this, level));
  }
}
```

- [ ] **Step 3: 写启动场景**

`src/app/scenes/boot.ts`：

```ts
import type { Manifest } from '../../render/assets';
import { drawBackground } from '../../render/background';
import { drawText } from '../../render/draw';
import { theme } from '../../render/theme';
import type { App } from '../app';
import type { Scene } from '../scene';

export class BootScene implements Scene {
  private ready = false;
  private started = false;

  constructor(
    private readonly app: App,
    private readonly manifest: Manifest,
  ) {}

  enter(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    await this.app.assets.load(this.manifest);
    this.ready = true;
  }

  exit(): void {}

  update(): void {
    if (this.ready && !this.started) {
      this.started = true;
      this.app.goHome();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const viewport = this.app.viewport;
    drawBackground(ctx, viewport, this.app.assets);
    drawText(
      ctx,
      '🍰',
      viewport.width / 2,
      viewport.height * 0.38,
      110,
      theme.colors.text,
    );
    drawText(
      ctx,
      '蛋糕排序派对',
      viewport.width / 2,
      viewport.height * 0.5,
      theme.fontSize.title,
      theme.colors.text,
      'center',
      'middle',
      true,
    );
    drawText(
      ctx,
      '加载中…',
      viewport.width / 2,
      viewport.height * 0.58,
      theme.fontSize.body,
      theme.colors.textLight,
    );
  }

  onTouchStart(): void {}
  onTouchMove(): void {}
  onTouchEnd(): void {}
}
```

- [ ] **Step 4: 类型检查**

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 5: 提交**

```bash
git add src/app/scene.ts src/app/app.ts src/app/scenes/boot.ts
git commit -m "feat(app): add app shell, scene interface and boot scene

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 11: 主页场景

**Files:**
- Create: `src/app/scenes/home.ts`

- [ ] **Step 1: 实现主页**

`src/app/scenes/home.ts`：

```ts
import { drawBackground } from '../../render/background';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';
import { contains, type Rect } from '../../utils/geometry';
import type { App } from '../app';
import { drawButton, hitButton, type ButtonSpec } from '../components/button';
import { Modal } from '../components/modal';
import { SettingsModal } from '../components/settings';
import type { Scene } from '../scene';

export class HomeScene implements Scene {
  private readonly modal = new Modal();
  private readonly settings: SettingsModal;
  private buttons: ButtonSpec[] = [];
  private gearRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private touchStart: { x: number; y: number } | null = null;

  constructor(private readonly app: App) {
    this.settings = new SettingsModal(
      () => this.app.save.settings,
      patch => {
        this.app.save.settings = { ...this.app.save.settings, ...patch };
        this.app.applySettings();
        this.app.persist();
      },
      () => this.confirmReset(),
    );
  }

  enter(): void {
    this.app.services.audio.playMusic('bgm');
  }

  exit(): void {}

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const viewport = this.app.viewport;
    drawBackground(ctx, viewport, this.app.assets);

    drawText(
      ctx,
      '🍰',
      viewport.width / 2,
      viewport.height * 0.2,
      110,
      theme.colors.text,
    );
    drawText(
      ctx,
      '蛋糕排序派对',
      viewport.width / 2,
      viewport.height * 0.32,
      theme.fontSize.title,
      theme.colors.text,
      'center',
      'middle',
      true,
    );
    drawText(
      ctx,
      '把蛋糕层整理成同口味吧',
      viewport.width / 2,
      viewport.height * 0.39,
      theme.fontSize.body,
      theme.colors.textLight,
    );

    const current = Math.min(
      this.app.save.unlockedLevel,
      this.app.levels.levels.length,
    );

    this.buttons = [
      {
        id: 'continue',
        rect: { x: 125, y: viewport.height * 0.52, w: 500, h: 112 },
        label: '继续游戏',
        variant: 'primary',
      },
      {
        id: 'levels',
        rect: { x: 125, y: viewport.height * 0.52 + 140, w: 500, h: 104 },
        label: '关卡选择',
        variant: 'ghost',
      },
    ];
    for (const button of this.buttons) drawButton(ctx, button);

    drawText(
      ctx,
      `当前进度：第 ${current} 关`,
      viewport.width / 2,
      viewport.height * 0.52 + 290,
      theme.fontSize.small,
      theme.colors.textLight,
    );

    this.gearRect = {
      x: viewport.width - 104,
      y: viewport.safeTop + 16,
      w: 68,
      h: 68,
    };
    fillRoundRect(
      ctx,
      this.gearRect.x,
      this.gearRect.y,
      this.gearRect.w,
      this.gearRect.h,
      20,
      'rgba(255,255,255,0.78)',
    );
    drawText(
      ctx,
      '⚙',
      this.gearRect.x + this.gearRect.w / 2,
      this.gearRect.y + this.gearRect.h / 2,
      34,
      theme.colors.text,
    );

    this.settings.render(ctx, viewport);
    this.modal.render(ctx, viewport);
  }

  onTouchStart(x: number, y: number): void {
    this.touchStart = { x, y };
  }

  onTouchMove(): void {}

  onTouchEnd(x: number, y: number): void {
    if (this.settings.visible) {
      this.settings.tap(x, y);
      return;
    }
    if (this.modal.visible) {
      this.modal.tap(x, y);
      return;
    }
    if (!this.touchStart) return;

    const dx = x - this.touchStart.x;
    const dy = y - this.touchStart.y;
    this.touchStart = null;
    if (Math.hypot(dx, dy) > 24) return;

    if (contains(this.gearRect, x, y)) {
      this.settings.open();
      return;
    }

    for (const button of this.buttons) {
      if (!hitButton(button, x, y)) continue;
      if (button.id === 'continue') {
        const allDone = this.app.levels.levels.every(level =>
          this.app.save.completedLevelIds.includes(level.id),
        );
        if (allDone) {
          this.app.goLevels();
        } else {
          const current = Math.min(
            this.app.save.unlockedLevel,
            this.app.levels.levels.length,
          );
          this.app.startLevel(current);
        }
      } else {
        this.app.goLevels();
      }
      return;
    }
  }

  private confirmReset(): void {
    this.modal.show('重置进度', '所有关卡进度将被清除，确定吗？', [
      { label: '取消', onPress: () => {} },
      {
        label: '重置',
        primary: true,
        onPress: () => {
          this.app.resetProgress();
          this.app.persist();
          this.app.goHome();
        },
      },
    ]);
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 3: 提交**

```bash
git add src/app/scenes/home.ts
git commit -m "feat(app): add home scene with settings and reset flow

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 12: 关卡选择场景

**Files:**
- Create: `src/app/scenes/levelSelect.ts`

- [ ] **Step 1: 实现关卡选择**

`src/app/scenes/levelSelect.ts`：

```ts
import { drawBackground } from '../../render/background';
import { drawText, fillRoundRect } from '../../render/draw';
import { theme } from '../../render/theme';
import { clamp, contains, type Rect } from '../../utils/geometry';
import type { App } from '../app';
import type { Scene } from '../scene';

interface LevelCell {
  rect: Rect;
  id: number;
  unlocked: boolean;
}

export class LevelSelectScene implements Scene {
  private scrollY = 0;
  private maxScroll = 0;
  private cells: LevelCell[] = [];
  private backRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private tapStart: { x: number; y: number } | null = null;
  private lastY = 0;
  private moved = false;

  constructor(private readonly app: App) {}

  enter(): void {
    this.app.services.audio.playMusic('bgm');
  }

  exit(): void {}

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const viewport = this.app.viewport;
    drawBackground(ctx, viewport, this.app.assets);

    this.backRect = { x: 32, y: viewport.safeTop + 16, w: 68, h: 68 };
    fillRoundRect(
      ctx,
      this.backRect.x,
      this.backRect.y,
      this.backRect.w,
      this.backRect.h,
      20,
      'rgba(255,255,255,0.78)',
    );
    drawText(
      ctx,
      '‹',
      this.backRect.x + this.backRect.w / 2,
      this.backRect.y + 28,
      46,
      theme.colors.text,
    );
    drawText(
      ctx,
      '选择关卡',
      viewport.width / 2,
      viewport.safeTop + 50,
      theme.fontSize.heading,
      theme.colors.text,
      'center',
      'middle',
      true,
    );

    const cols = 5;
    const gap = 16;
    const margin = 32;
    const cellW = (viewport.width - margin * 2 - gap * (cols - 1)) / cols;
    const cellH = 148;
    const levels = this.app.levels.levels;
    const rows = Math.ceil(levels.length / cols);
    const contentH = rows * cellH + (rows - 1) * gap;
    const contentTop = viewport.safeTop + 120;
    const availableH = viewport.height - viewport.safeBottom - contentTop - 24;
    this.maxScroll = Math.max(0, contentH - availableH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    const completed = new Set(this.app.save.completedLevelIds);
    this.cells = [];

    for (const level of levels) {
      const index = level.id - 1;
      const row = Math.floor(index / cols);
      const col = index % cols;
      const rect = {
        x: margin + col * (cellW + gap),
        y: contentTop + row * (cellH + gap) - this.scrollY,
        w: cellW,
        h: cellH,
      };
      const unlocked = level.id <= this.app.save.unlockedLevel;
      this.cells.push({ rect, id: level.id, unlocked });

      if (rect.y + rect.h < contentTop || rect.y > viewport.height - viewport.safeBottom) {
        continue;
      }

      fillRoundRect(
        ctx,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        20,
        unlocked ? theme.colors.panel : '#EFE4D8',
      );
      drawText(
        ctx,
        String(level.id),
        rect.x + rect.w / 2,
        rect.y + rect.h / 2 - 8,
        38,
        unlocked ? theme.colors.text : theme.colors.locked,
        'center',
        'middle',
        true,
      );
      if (completed.has(level.id)) {
        drawText(
          ctx,
          '✓',
          rect.x + rect.w - 26,
          rect.y + 30,
          26,
          theme.colors.success,
        );
      }
      if (!unlocked) {
        drawText(
          ctx,
          '未解锁',
          rect.x + rect.w / 2,
          rect.y + rect.h / 2 + 34,
          20,
          theme.colors.locked,
        );
      }
    }
  }

  onTouchStart(x: number, y: number): void {
    this.tapStart = { x, y };
    this.lastY = y;
    this.moved = false;
  }

  onTouchMove(x: number, y: number): void {
    if (!this.tapStart) return;

    const delta = y - this.lastY;
    if (Math.abs(y - this.tapStart.y) > 10) this.moved = true;
    this.scrollY = clamp(this.scrollY - delta, 0, this.maxScroll);
    this.lastY = y;
  }

  onTouchEnd(x: number, y: number): void {
    if (!this.tapStart) return;
    this.tapStart = null;
    if (this.moved) return;

    if (contains(this.backRect, x, y)) {
      this.app.goHome();
      return;
    }

    for (const cell of this.cells) {
      if (cell.unlocked && contains(cell.rect, x, y)) {
        this.app.startLevel(cell.id);
        return;
      }
    }
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 3: 提交**

```bash
git add src/app/scenes/levelSelect.ts
git commit -m "feat(app): add scrollable level select scene

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 13: 局内玩法场景

**Files:**
- Create: `src/app/scenes/game.ts`

- [ ] **Step 1: 实现局内场景**

`src/app/scenes/game.ts`：

```ts
import { gameConfig } from '../../config/gameConfig';
import { GameSession } from '../../core/game';
import type { Level, Move } from '../../core/types';
import { drawBackground } from '../../render/background';
import type { Viewport } from '../../render/canvas';
import { drawText, fillRoundRect } from '../../render/draw';
import { computeGridLayout } from '../../render/layout';
import { bowlMetrics, drawBowl, drawFlavorBlock } from '../../render/painters/bowl';
import { FLAVORS, theme } from '../../render/theme';
import { clamp, contains, type Rect } from '../../utils/geometry';
import type { App } from '../app';
import { drawButton, hitButton, type ButtonSpec } from '../components/button';
import { Modal, type ModalAction } from '../components/modal';
import { SettingsModal } from '../components/settings';
import { Toast } from '../components/toast';
import type { Scene } from '../scene';

interface PourAnim {
  move: Move;
  reverse: boolean;
  start: number;
  duration: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface GameLayout {
  back: Rect;
  restart: Rect;
  settings: Rect;
  bowls: Rect[];
  buttons: ButtonSpec[];
  area: Rect;
}

export class GameScene implements Scene {
  private readonly viewport: Viewport;
  private readonly session: GameSession;
  private readonly modal = new Modal();
  private readonly settings: SettingsModal;
  private readonly toast = new Toast();
  private selected: number | null = null;
  private anim: PourAnim | null = null;
  private hint: { move: Move; until: number } | null = null;
  private shake: { index: number; until: number } | null = null;
  private particles: Particle[] = [];
  private winAt = 0;
  private addedBowlAt = 0;
  private layout: GameLayout | null = null;
  private touchStart: { x: number; y: number } | null = null;

  constructor(
    private readonly app: App,
    private readonly level: Level,
  ) {
    this.viewport = app.viewport;
    this.session = new GameSession(level, gameConfig.items, {
      maxNodes: gameConfig.solver.hintMaxNodes,
      timeMs: gameConfig.solver.hintTimeMs,
    });
    this.settings = new SettingsModal(
      () => app.save.settings,
      patch => {
        app.save.settings = { ...app.save.settings, ...patch };
        app.applySettings();
        app.persist();
      },
      () => this.confirmReset(),
    );
  }

  enter(): void {
    this.app.services.audio.playMusic('bgm');
  }

  exit(): void {}

  update(dt: number): void {
    const now = Date.now();

    if (this.anim && now - this.anim.start >= this.anim.duration) {
      const reverse = this.anim.reverse;
      this.anim = null;
      this.app.services.audio.playSfx('sfx.drop');
      if (!reverse) this.afterMove();
    }

    if (this.winAt > 0 && now >= this.winAt) {
      this.winAt = 0;
      this.showWin();
    }

    if (this.hint && now >= this.hint.until) this.hint = null;
    if (this.shake && now >= this.shake.until) this.shake = null;

    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 900 * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawBackground(ctx, this.viewport, this.app.assets);
    const layout = this.layoutFor();

    this.drawTopBar(ctx, layout);
    this.drawBowls(ctx, layout);
    this.drawFlying(ctx);
    this.drawParticles(ctx);

    for (const button of layout.buttons) drawButton(ctx, button);

    this.toast.render(ctx, this.viewport);
    this.settings.render(ctx, this.viewport);
    this.modal.render(ctx, this.viewport);
  }

  private layoutFor(): GameLayout {
    const viewport = this.viewport;
    const topY = viewport.safeTop + 16;
    const bottomY = viewport.height - viewport.safeBottom - 112;
    const area: Rect = {
      x: 32,
      y: topY + 88 + 16,
      w: viewport.width - 64,
      h: bottomY - 24 - (topY + 88 + 16),
    };

    const view = this.session.view();
    const grid = computeGridLayout(view.bowls.length, area);
    const bowls = grid.positions.map(position => ({
      x: position.x,
      y: position.y,
      w: grid.cellW,
      h: grid.cellH,
    }));

    const buttonW = 204;
    const gap = (viewport.width - 64 - buttonW * 3) / 2;
    const buttons: ButtonSpec[] = [
      {
        id: 'undo',
        rect: { x: 32, y: bottomY, w: buttonW, h: 88 },
        label: '撤销',
        enabled: view.historyLength > 0,
      },
      {
        id: 'hint',
        rect: { x: 32 + buttonW + gap, y: bottomY, w: buttonW, h: 88 },
        label: '提示',
        badge: view.hintsAvailable,
      },
      {
        id: 'add',
        rect: {
          x: 32 + (buttonW + gap) * 2,
          y: bottomY,
          w: buttonW,
          h: 88,
        },
        label: '加碗',
        badge: view.bowlsAvailable,
        enabled: view.extraBowlsUsed < view.maxExtraBowls,
      },
    ];

    this.layout = {
      back: { x: 32, y: topY, w: 68, h: 68 },
      restart: { x: viewport.width - 176, y: topY, w: 68, h: 68 },
      settings: { x: viewport.width - 100, y: topY, w: 68, h: 68 },
      bowls,
      buttons,
      area,
    };
    return this.layout;
  }

  private drawTopBar(ctx: CanvasRenderingContext2D, layout: GameLayout): void {
    const items: Array<{ rect: Rect; label: string }> = [
      { rect: layout.back, label: '‹' },
      { rect: layout.restart, label: '↻' },
      { rect: layout.settings, label: '⚙' },
    ];
    for (const item of items) {
      fillRoundRect(
        ctx,
        item.rect.x,
        item.rect.y,
        item.rect.w,
        item.rect.h,
        20,
        'rgba(255,255,255,0.78)',
      );
      drawText(
        ctx,
        item.label,
        item.rect.x + item.rect.w / 2,
        item.rect.y + item.rect.h / 2,
        34,
        theme.colors.text,
      );
    }
    drawText(
      ctx,
      `第 ${this.level.id} 关`,
      this.viewport.width / 2,
      layout.back.y + layout.back.h / 2,
      32,
      theme.colors.text,
      'center',
      'middle',
      true,
    );
  }

  private drawBowls(ctx: CanvasRenderingContext2D, layout: GameLayout): void {
    const now = Date.now();
    const view = this.session.view();

    layout.bowls.forEach((rect, index) => {
      const layers = view.bowls[index];
      let hiddenTop = 0;
      let pop = 1;
      let alpha = 1;

      if (this.anim) {
        const { move, reverse, start, duration } = this.anim;
        if (!reverse && index === move.to) hiddenTop = move.count;
        if (reverse && index === move.from) hiddenTop = move.count;

        const t = clamp((now - start) / duration, 0, 1);
        const target = reverse ? move.from : move.to;
        if (index === target && t > 0.6) {
          pop = 1 + 0.08 * Math.sin(((t - 0.6) / 0.4) * Math.PI);
        }
      }

      const addedAge =
        this.addedBowlAt > 0 ? now - this.addedBowlAt : Number.POSITIVE_INFINITY;
      if (index === layout.bowls.length - 1 && addedAge < 220) {
        const t = clamp(addedAge / 220, 0, 1);
        pop = 0.6 + 0.4 * (1 - Math.pow(1 - t, 3));
        alpha = Math.min(1, t * 2);
      }

      let shakeX = 0;
      if (this.anim) {
        const age = clamp((now - this.anim.start) / this.anim.duration, 0, 1);
        if (!this.anim.reverse && index === this.anim.move.from) {
          shakeX += Math.sin(age * Math.PI * 3) * 4 * (1 - age);
        }
      }
      if (this.shake && this.shake.index === index) {
        const remain = Math.max(0, this.shake.until - now);
        shakeX = Math.sin(now / 18) * 8 * (remain / 200);
      }

      const highlighted =
        !!this.hint &&
        (index === this.hint.move.from || index === this.hint.move.to);

      drawBowl(
        ctx,
        { ...rect, x: rect.x + shakeX },
        layers,
        {
          selected: this.selected === index,
          highlight: highlighted,
          hiddenTop,
          pop,
          alpha,
        },
        this.app.assets,
      );
    });
  }

  private drawFlying(ctx: CanvasRenderingContext2D): void {
    if (!this.anim || !this.layout) return;

    const now = Date.now();
    const progress = clamp((now - this.anim.start) / this.anim.duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const { move, reverse } = this.anim;
    const view = this.session.view();

    const fromRect = this.layout.bowls[move.from];
    const toRect = this.layout.bowls[move.to];
    const startRect = reverse ? toRect : fromRect;
    const endRect = reverse ? fromRect : toRect;
    const startMetrics = bowlMetrics(startRect);
    const endMetrics = bowlMetrics(endRect);

    const startBase = reverse
      ? view.bowls[move.to].length
      : view.bowls[move.from].length;
    const endBase = reverse
      ? view.bowls[move.from].length - move.count
      : view.bowls[move.to].length - move.count;

    const startX = startRect.x + startRect.w / 2;
    const startY =
      startMetrics.bottomY - (startBase + move.count / 2) * startMetrics.layerH;
    const endX = endRect.x + endRect.w / 2;
    const endY =
      endMetrics.bottomY - (endBase + move.count / 2) * endMetrics.layerH;
    const controlX = (startX + endX) / 2;
    const controlY = Math.min(startY, endY) - 120;

    const x =
      (1 - eased) * (1 - eased) * startX +
      2 * (1 - eased) * eased * controlX +
      eased * eased * endX;
    const y =
      (1 - eased) * (1 - eased) * startY +
      2 * (1 - eased) * eased * controlY +
      eased * eased * endY;

    drawFlavorBlock(
      ctx,
      x,
      y,
      startMetrics.innerW,
      move.count * startMetrics.layerH - 4,
      move.flavor,
      this.app.assets,
    );
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  onTouchStart(x: number, y: number): void {
    this.touchStart = { x, y };
  }

  onTouchMove(): void {}

  onTouchEnd(x: number, y: number): void {
    if (this.settings.visible) {
      this.settings.tap(x, y);
      return;
    }
    if (this.modal.visible) {
      this.modal.tap(x, y);
      return;
    }
    if (!this.touchStart) return;

    const dx = x - this.touchStart.x;
    const dy = y - this.touchStart.y;
    this.touchStart = null;
    if (Math.hypot(dx, dy) > 24) return;

    this.handleTap(x, y);
  }

  private handleTap(x: number, y: number): void {
    if (this.winAt > 0) return;
    const layout = this.layoutFor();

    if (contains(layout.back, x, y)) {
      this.app.goLevels();
      return;
    }
    if (contains(layout.restart, x, y)) {
      this.requestRestart();
      return;
    }
    if (contains(layout.settings, x, y)) {
      this.settings.open();
      return;
    }

    for (const button of layout.buttons) {
      if (!contains(button.rect, x, y)) continue;
      if (button.id === 'add' && button.enabled === false) {
        this.toast.show('本局加碗已达上限');
        return;
      }
      if (!hitButton(button, x, y)) return;
      if (button.id === 'undo') this.doUndo();
      else if (button.id === 'hint') this.doHint();
      else this.doAddBowl();
      return;
    }

    for (let index = 0; index < layout.bowls.length; index += 1) {
      if (contains(layout.bowls[index], x, y)) {
        this.tapBowl(index);
        return;
      }
    }

    this.selected = null;
  }

  private tapBowl(index: number): void {
    if (this.anim) return;

    const view = this.session.view();
    const bowl = view.bowls[index];

    if (this.selected === null) {
      if (bowl.length === 0 || bowl.length >= this.level.capacity) return;
      this.selected = index;
      this.app.services.audio.playSfx('sfx.tap');
      return;
    }

    if (this.selected === index) {
      this.selected = null;
      return;
    }

    const move = this.session.pour(this.selected, index);
    if (move) {
      this.selected = null;
      this.anim = {
        move,
        reverse: false,
        start: Date.now(),
        duration: gameConfig.animation.pourMs,
      };
      this.app.services.audio.playSfx('sfx.pour');
      this.app.services.haptics.light();
      return;
    }

    this.shake = { index: this.selected, until: Date.now() + 200 };
    this.app.services.audio.playSfx('sfx.error');
    this.app.services.haptics.light();
    this.selected =
      bowl.length > 0 && bowl.length < this.level.capacity ? index : null;
  }

  private doUndo(): void {
    if (this.anim || this.winAt > 0) return;
    const move = this.session.undo();
    if (!move) return;

    this.selected = null;
    this.anim = {
      move,
      reverse: true,
      start: Date.now(),
      duration: gameConfig.animation.undoMs,
    };
    this.app.services.audio.playSfx('sfx.pour');
  }

  private doHint(): void {
    if (this.anim || this.winAt > 0) return;

    const result = this.session.hint();
    if (result.status === 'timeout') {
      this.toast.show('提示暂不可用，请稍后再试');
      return;
    }
    if (result.status === 'unsolvable') {
      this.toast.show('当前已无解，建议撤销或重开');
      return;
    }

    if (this.session.view().hintsAvailable > 0) {
      this.session.consumeHint();
      this.showHint(result.move);
      return;
    }

    this.modal.show('看视频得提示', '观看完整激励视频，获得 1 次提示', [
      { label: '取消', onPress: () => {} },
      {
        label: '观看',
        primary: true,
        onPress: () => void this.watchAd('hint', result.move),
      },
    ]);
  }

  private doAddBowl(): void {
    if (this.anim || this.winAt > 0) return;

    const view = this.session.view();
    if (view.extraBowlsUsed >= view.maxExtraBowls) {
      this.toast.show('本局加碗已达上限');
      return;
    }
    if (view.bowlsAvailable > 0) {
      this.addBowlNow();
      return;
    }

    this.modal.show('看视频加碗', '观看完整激励视频，获得 1 个空碗', [
      { label: '取消', onPress: () => {} },
      {
        label: '观看',
        primary: true,
        onPress: () => void this.watchAd('bowl'),
      },
    ]);
  }

  private async watchAd(kind: 'hint' | 'bowl', move?: Move): Promise<void> {
    this.toast.show('正在加载广告…', 4000);
    const result = await this.app.services.ads.showRewarded();

    if (result === 'rewarded') {
      if (kind === 'hint') {
        if (!move) return;
        this.session.grantHints(gameConfig.items.rewardAmount);
        this.session.consumeHint();
        this.showHint(move);
      } else {
        this.session.grantBowls(gameConfig.items.rewardAmount);
        this.addBowlNow();
      }
      return;
    }

    this.toast.show(
      result === 'closed' ? '未看完广告，未获得奖励' : '广告暂不可用',
    );
  }

  private addBowlNow(): void {
    if (!this.session.addBowl()) {
      this.toast.show('本局加碗已达上限');
      return;
    }
    this.selected = null;
    this.addedBowlAt = Date.now();
    this.app.services.audio.playSfx('sfx.tap');
    this.app.services.haptics.light();
    this.toast.show('已加入一个空碗');
  }

  private showHint(move: Move): void {
    this.hint = { move, until: Date.now() + 2000 };
    this.toast.show('照着高亮的两个碗倒一次');
  }

  private requestRestart(): void {
    if (this.session.view().historyLength === 0) {
      this.restartNow();
      return;
    }
    this.modal.show('重新开始', '本局进度将清空，确定重开吗？', [
      { label: '取消', onPress: () => {} },
      { label: '重开', primary: true, onPress: () => this.restartNow() },
    ]);
  }

  private restartNow(): void {
    this.session.restart();
    this.selected = null;
    this.anim = null;
    this.hint = null;
    this.shake = null;
    this.particles = [];
    this.winAt = 0;
    this.addedBowlAt = 0;
    this.toast.show('已重开');
  }

  private afterMove(): void {
    if (this.session.isWin()) {
      this.onWin();
      return;
    }
    if (this.session.isStuck()) this.showStuck();
  }

  private onWin(): void {
    const save = this.app.save;
    const completed = new Set(save.completedLevelIds);
    completed.add(this.level.id);
    save.completedLevelIds = [...completed].sort((a, b) => a - b);

    if (this.level.id < this.app.levels.levels.length) {
      save.unlockedLevel = Math.max(save.unlockedLevel, this.level.id + 1);
    }
    this.app.persist();

    this.spawnWinParticles();
    this.winAt = Date.now() + 700;
    this.app.services.audio.playSfx('sfx.win');
  }

  private showWin(): void {
    const isLast = this.level.id >= this.app.levels.levels.length;
    const actions: ModalAction[] = [];
    if (!isLast) {
      actions.push({
        label: '下一关',
        primary: true,
        onPress: () => this.app.startLevel(this.level.id + 1),
      });
    }
    actions.push({
      label: '关卡列表',
      primary: isLast,
      onPress: () => this.app.goLevels(),
    });

    this.modal.show(
      '通关啦！',
      `第 ${this.level.id} 关完成，蛋糕杯整理得整整齐齐～`,
      actions,
    );
  }

  private showStuck(): void {
    this.modal.show('无路可走', '当前没有可倒的蛋糕层了，试试撤销、加碗或重开。', [
      { label: '撤销', onPress: () => this.doUndo() },
      { label: '加碗', primary: true, onPress: () => this.doAddBowl() },
      { label: '重开', onPress: () => this.requestRestart() },
    ]);
  }

  private spawnWinParticles(): void {
    const colors = Object.values(FLAVORS).map(style => style.base);
    const cx = this.viewport.width / 2;
    const cy = this.viewport.height * 0.45;

    for (let index = 0; index < 32; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 320;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 140,
        life: 1.2,
        maxLife: 1.2,
        color: colors[index % colors.length],
        size: 8 + Math.random() * 10,
      });
    }
  }

  private confirmReset(): void {
    this.modal.show('重置进度', '所有关卡进度将被清除，确定吗？', [
      { label: '取消', onPress: () => {} },
      {
        label: '重置',
        primary: true,
        onPress: () => {
          this.app.resetProgress();
          this.app.persist();
          this.app.goHome();
        },
      },
    ]);
  }
}
```

- [ ] **Step 2: 类型检查**

Run: `npm run typecheck`
Expected: 退出码 0

- [ ] **Step 3: 提交**

```bash
git add src/app/scenes/game.ts
git commit -m "feat(app): add game scene with pour animations, hint and rewards

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

### Task 14: 主入口接线、README 与整机验收

**Files:**
- Modify: `src/main.ts`（用完整启动逻辑替换 Task 2 的临时入口）
- Create: `README.md`

- [ ] **Step 1: 用完整启动逻辑替换 `src/main.ts`**

```ts
import levelJson from '../levels/levels.json';
import manifestJson from '../assets/manifest.json';
import { gameConfig } from './config/gameConfig';
import { parseLevelFile } from './core/levels';
import { App, type SceneFactory } from './app/app';
import { BootScene } from './app/scenes/boot';
import { GameScene } from './app/scenes/game';
import { HomeScene } from './app/scenes/home';
import { LevelSelectScene } from './app/scenes/levelSelect';
import { AnalyticsService } from './app/services/analytics';
import { createAdService } from './app/services/ads';
import { AudioService } from './app/services/audio';
import { HapticsService } from './app/services/haptics';
import { createWxStore, SaveStore } from './app/services/storage';
import { Assets, parseManifest } from './render/assets';
import { createViewport, type Viewport } from './render/canvas';

function designPoint(
  viewport: Viewport,
  event: any,
): { x: number; y: number } {
  const touch =
    (event.changedTouches && event.changedTouches[0]) ||
    (event.touches && event.touches[0]);
  return {
    x: touch.clientX / viewport.scale,
    y: touch.clientY / viewport.scale,
  };
}

function start(): void {
  const viewport = createViewport(gameConfig.designWidth);
  const assets = new Assets();
  const store = new SaveStore(createWxStore(), gameConfig.saveKey);
  const audio = new AudioService(key => assets.audio(key));

  const services = {
    ads: createAdService(gameConfig.ads),
    audio,
    haptics: new HapticsService(),
    analytics: new AnalyticsService(),
  };

  const factory: SceneFactory = {
    home: app => new HomeScene(app),
    levels: app => new LevelSelectScene(app),
    game: (app, level) => new GameScene(app, level),
  };

  const app = new App(
    viewport,
    assets,
    store,
    services,
    parseLevelFile(levelJson),
    factory,
  );
  app.setScene(new BootScene(app, parseManifest(manifestJson)));

  let last = Date.now();
  const frame = (): void => {
    const now = Date.now();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    app.update(dt);
    app.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  wx.onTouchStart((event: any) => {
    const point = designPoint(viewport, event);
    app.touchStart(point.x, point.y);
  });
  wx.onTouchMove((event: any) => {
    const point = designPoint(viewport, event);
    app.touchMove(point.x, point.y);
  });
  wx.onTouchEnd((event: any) => {
    const point = designPoint(viewport, event);
    app.touchEnd(point.x, point.y);
  });
}

start();
```

- [ ] **Step 2: 类型检查与构建**

Run: `npm run typecheck`
Expected: 退出码 0

Run: `npm run build`
Expected: esbuild 输出 `game.js`，退出码 0

- [ ] **Step 3: 全量自动测试与关卡校验**

Run: `npm test`
Expected: 所有测试通过（core 规则/求解/会话、存档、广告、资源、布局、关卡数据）

Run: `npm run verify:levels`
Expected: `all 30 levels verified`

- [ ] **Step 4: 微信开发者工具手动验收**

逐项确认：

1. 启动进入 Boot，随后自动进入主页，无控制台报错。
2. 点「继续游戏」进入第 1 关；顶栏、底栏、碗网格完整显示，不越界。
3. 点一个非空碗 → 出现选中描边；点另一个合法碗 → 层块沿弧线飞入，落位正确。
4. 点非法目标 → 源碗抖动 + toast/音效（音效缺省静默），提示与状态不变。
5. 连续倒层后点「撤销」→ 反向动画，层数与顺序精确还原；历史为空时按钮置灰。
6. 点「提示」→ 高亮源碗与目标碗，2 秒后消失；免费次数徽标从 1 变 0。
7. 再次点「提示」→ 弹出「看视频得提示」；点「观看」→ Mock 广告 300ms 后直接高亮。
8. 点「加碗」→ 免费加一个空碗，网格重排；再加 → 弹广告确认；Mock 成功后加碗；达到 2 个额外碗后提示上限。
9. 点「重开」→ 有历史时弹确认；确认后状态、历史、道具额度复位。
10. 完成第 1 关 → 撒花、胜利弹窗；点「下一关」进入第 2 关；关卡选择中第 1 关打勾、第 2 关解锁。
11. 关闭并重新打开小游戏 → 进度保留（存档键 `cake_sort_save_v1`）。
12. 主页设置：关闭音效/音乐/震动后再进入局内，行为生效；「重置进度」后进度回到第 1 关。
13. 临时把 `assets/images/` 清空（manifest 也为空）仍可完整游玩，所有蛋糕层由占位色绘制。
14. 在开发者工具切换 iPhone 刘海机型与 Android 机型，确认顶栏不被状态栏遮挡、底栏高于底部安全区。
15. （可选，需开通流量主）把 `gameConfig.ads.mock` 改为 `false` 并填入真实广告位 ID，验证看完、中途关闭、加载失败三种结果与降级提示。

- [ ] **Step 5: 写 README**

`README.md`：

````markdown
# 蛋糕排序派对

微信小游戏 MVP：水排序玩法的蛋糕/布丁主题，原生 Canvas 2D，无游戏引擎。

## 环境

- Node.js >= 18
- 微信开发者工具（小游戏项目）

## 安装与构建

```bash
npm install
npm run build
```

用微信开发者工具导入本目录（`compileType` 已设为 `game`）。
首次运行请把 `project.config.json` 的 `appid` 换成自己的小游戏 AppID（开发可先用测试号）。

开发监听：

```bash
npm run dev
```

## 测试与关卡

```bash
npm test              # 单元测试 + 关卡数据测试
npm run typecheck     # TypeScript 类型检查
npm run verify:levels # 校验 30 关可解且 minMoves 正确
npm run gen:levels    # 用固定种子重新生成关卡（会覆盖 levels/levels.json）
```

## 目录

- `src/core/`：纯玩法逻辑（规则、会话、求解、关卡解析），不依赖微信 API
- `src/app/`：场景、组件、服务（存档、广告、音频、震动）
- `src/render/`：Canvas、主题、资源、布局、绘制
- `assets/manifest.json`：美术与音频资源清单
- `levels/levels.json`：30 关数据
- `tools/`：关卡生成与校验脚本

## 换美术

1. 图片按 750 设计宽的 2 倍像素导出（例：逻辑 80×120 → 160×240 像素），透明 PNG/WebP。
2. 放到 `assets/images/`。
3. 在 `assets/manifest.json` 的 `images` 中登记：`{ "key": "bowl.body", "src": "assets/images/bowl_body.png", "width": 120, "height": 210 }`，`width/height` 填逻辑尺寸。杯身图建议内部透明，蛋糕层由 `layer.<flavor>` 叠加；背景图用 key `bg`，会覆盖整个画面。
4. 重新执行 `npm run build`。
5. 没有登记或加载失败的 key 会自动使用 `src/render/theme.ts` 的占位绘制；清空图片目录也能完整游玩。

首版绘制层实际读取的 key：`bg`（全屏背景）、`bowl.body`（杯身）、`layer.<flavor>`（每种口味一层，例如 `layer.strawberry`）。`ui.*` 等 key 预留给后续皮肤。

## 广告

`src/config/gameConfig.ts`：

- `ads.mock: true`：本地 Mock，短暂延迟后直接返回 `rewarded`，用于开发与验收。
- 上线：`mock: false`，并填写 `rewardedAdUnitId: "adunit-xxxx"`。激励视频广告位需要开通流量主。

广告失败/中途关闭会 toast 提示且不发奖；提示走法在弹广告前已算好，超时或已无解不会消耗额度。

## 音频

`assets/manifest.json` 的 `audio` 支持键：`bgm`、`sfx.pour`、`sfx.drop`、`sfx.win`、`sfx.tap`、`sfx.error`。未配置时静音，不影响玩法。

## 存档

微信 storage 键 `cake_sort_save_v1`，保存解锁进度、已通关关卡和设置；设置页可重置进度。
````

- [ ] **Step 6: 最终构建与提交**

Run: `npm run build`
Expected: 退出码 0

```bash
git add src/main.ts README.md
git commit -m "feat: wire mini-game entry and document usage

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 附录：Spec 覆盖对照

| Spec 需求 | 实现任务 |
| --- | --- |
| 原生 Canvas 2D、无引擎、竖屏 | Task 2、8、10、14 |
| 30 关、离线生成、可解校验、minMoves | Task 6 |
| 倒层规则、胜利、卡死 | Task 3 |
| 撤销无限次、精确还原 | Task 3、5、13 |
| 提示（先求解后广告、无解/超时处理） | Task 4、5、13 |
| 加碗（免费 + 广告 + 上限 + 重排） | Task 5、9、13 |
| 道具额度可配置 | Task 7 |
| 激励广告 Mock/真实切换与降级 | Task 7、13、14 |
| 主页、关卡选择、胜利/卡死/重开/设置 | Task 11、12、13 |
| 存档、解锁、重置 | Task 7、10、11、13 |
| 奶油糖果风、布丁杯、占位美术 | Task 8、9 |
| 资源 manifest、缺图回退、换图不改逻辑 | Task 8、9、14 |
| 250ms/200ms 动画、撒花、震动、音效 | Task 7、13 |
| 设计宽 750、安全区适配 | Task 8、9、10、11、12、13 |
| 单元测试与关卡测试 | Task 1、3、4、5、6、7、8、9 |
| 真机验收清单 | Task 14 |







