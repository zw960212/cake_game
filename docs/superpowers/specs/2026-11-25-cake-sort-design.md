# 蛋糕排序派对 · 设计文档

- 日期：2026-11-25
- 状态：设计已确认，待实现
- 平台：微信小游戏（竖屏）
- 玩法：水排序（颜色分层）规则，蛋糕/布丁主题

## 1. 产品概述

### 1.1 目标

做一款可直接上线的单机闯关休闲小游戏：玩家把打乱在布丁杯里的蛋糕层倒来倒去，最终让每个非空杯都装满 4 层同口味蛋糕。

首版要求：

- 玩法完整：倒层、撤销、提示、加碗、胜利/卡死处理
- 内容可上线：30 关，由离线工具生成并校验可解
- 结构清晰：玩法逻辑纯 TypeScript、可单测；微信 API 隔离
- 美术可替换：占位美术可完整游玩，正式资源整包替换不改逻辑
- 商业化预留：激励视频接口（Mock / 真实可切）

### 1.2 MVP 范围

**包含**：主页、关卡选择、30 关、局内玩法、撤销/提示/加碗、本地进度存档、设置（音效/音乐/震动）、激励广告接口、程序化占位美术、iOS/Android 适配。

**不包含**：金币、体力、排行榜、社交分享、后端/云开发、云存档、皮肤系统、多语言、关卡编辑器 GUI、埋点统计（仅留空接口）。

### 1.3 成功标准

- 30 关全部可解，且通过自动校验（口味数量、容量、最短步数）
- 真机稳定 60fps，常见机型布局不越界、不遮挡安全区
- 删除全部图片资源后，游戏仍可完整游玩
- 替换一套美术只改 `assets/manifest.json` 与尺寸参数，不改 `core/` 代码

## 2. 技术选型

| 项目 | 选择 | 理由 |
| --- | --- | --- |
| 引擎 | 无引擎，原生 Canvas 2D | 包体最小、启动快、结构完全可控 |
| 语言 | TypeScript | 玩法逻辑可测试、类型约束清晰 |
| 打包 | esbuild → `game.js`（IIFE） | 快、配置少、产物小 |
| 测试 | Vitest | 纯逻辑单测，不依赖微信环境 |
| 工具运行 | tsx | 直接运行关卡生成/校验脚本 |
| 方向 | 竖屏 | 单手操作，符合休闲解谜习惯 |
| 设计分辨率 | 宽 750 逻辑像素，高度动态 | 主流小游戏做法；按屏幕与安全区计算 |
| 微信基础库 | ≥ 2.0.4 | 激励视频广告要求 |

`wx.*` 只允许出现在平台适配点：`src/main.ts`、`src/render/canvas.ts`、`src/render/assets.ts`、`src/app/services/`；`src/core/` 不得引用任何微信 API。

## 3. 架构

### 3.1 分层

依赖单向向下，禁止反向引用：

```
① 入口层  src/main.ts → game.js
   启动、Canvas 初始化、DPR/安全区计算、主循环、创建场景栈

② 表现层  src/app/scenes + src/app/components + src/render
   场景、弹窗、按钮、命中测试、布丁杯与蛋糕层绘制、动画、主题

③ 领域层  src/core
   规则、关卡会话、撤销栈、求解提示、类型定义（纯 TS，零微信 API）

④ 服务层  src/app/services
   存档、激励广告、音频、震动、统计空实现（平台服务；canvas/image 适配见入口与 render）

数据（只读）：levels/levels.json、assets/manifest.json、src/config/gameConfig.ts、src/render/theme.ts
```

- 场景通过 `GameSession` 的只读视图拿到状态后绘制，不直接改玩法状态。
- 动画只影响表现，不改变逻辑状态；逻辑落层在动画开始时立即生效。
- `services` 通过接口注入，开发态可用 Mock 替换（广告尤其如此）。

### 3.2 目录结构

```
cake_game/
├─ game.js                  # 构建产物（git 忽略）
├─ game.json                # 小游戏配置：竖屏、隐藏状态栏
├─ project.config.json      # 微信开发者工具配置（AppID 由使用者填写）
├─ assets/
│  ├─ manifest.json         # 逻辑名 → 图片/音频 + 尺寸/九宫格
│  ├─ images/               # 美术资源（可整个删除，使用占位绘制）
│  └─ audio/
├─ levels/
│  └─ levels.json           # 30 关固化数据
├─ src/
│  ├─ main.ts
│  ├─ core/
│  │  ├─ types.ts           # Level / Bowl / Move / HintResult 等
│  │  ├─ rules.ts           # 可倒判断、倒层计算、胜负/卡死判定
│  │  ├─ game.ts            # GameSession：状态、撤销、加碗、道具额度
│  │  ├─ solver.ts          # 求解器（提示 + 离线校验）
│  │  └─ __tests__/
│  ├─ app/
│  │  ├─ app.ts             # 应用上下文、场景栈、服务装配
│  │  ├─ scene.ts           # Scene 接口
│  │  ├─ scenes/            # boot / home / level-select / game
│  │  ├─ components/        # button / dialog / toast / hud
│  │  └─ services/          # storage / ads / audio / haptics / analytics
│  ├─ render/
│  │  ├─ canvas.ts          # Canvas 创建、DPR、尺寸与安全区
│  │  ├─ assets.ts          # 图片/音频加载、缓存、占位回退
│  │  ├─ painters/          # bowl / layer / background / ui
│  │  ├─ tween.ts           # 缓动与动画时间线
│  │  └─ theme.ts           # 色板、圆角、字号、间距、口味占位色
│  ├─ config/
│  │  └─ gameConfig.ts      # 道具额度、广告位 ID、动画时长、存档键
│  └─ utils/                # 几何、断言、随机数（种子）
├─ tools/
│  ├─ gen-levels.ts         # 离线生成并验证关卡，输出 levels.json
│  └─ verify-levels.ts      # 全量校验关卡表
├─ tests/                   # 关卡数据校验等跨模块测试（core 单测就近放置）
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
└─ docs/
   └─ superpowers/specs/2026-11-25-cake-sort-design.md
```

## 4. 核心玩法

### 4.1 数据模型

```ts
type FlavorId = string; // 'strawberry' | 'mango' | ...

interface Level {
  id: number;
  difficulty: 'easy' | 'mid' | 'hard';
  capacity: 4;
  bowls: FlavorId[][]; // 每杯从下到上；空杯 = []
  minMoves: number;    // 求解器算出的最少步数
}

interface Move {
  from: number;
  to: number;
  flavor: FlavorId;
  count: number;
}

type HintResult =
  | { status: 'found'; move: Move }
  | { status: 'unsolvable' }
  | { status: 'timeout' };

// 给表现层的只读快照
interface GameView {
  levelId: number;
  bowls: ReadonlyArray<ReadonlyArray<FlavorId>>;
  historyLength: number;
  hintsAvailable: number;   // 免费 + 广告获得，尚未消耗
  bowlsAvailable: number;   // 本局还可加碗次数
  extraBowlsUsed: number;
  maxExtraBowls: number;
}
```

口味占位色（正式美术可替换，逻辑只存 id）：

| id | 名称 | 占位色 |
| --- | --- | --- |
| strawberry | 草莓 | #FF9DB5 |
| mango | 芒果 | #FFC46B |
| cocoa | 可可 | #B98A65 |
| matcha | 抹茶 | #9FD58F |
| blueberry | 蓝莓 | #8FA8E8 |
| vanilla | 香草 | #F2DFAF |
| caramel | 焦糖 | #E0A05C |
| cherry | 樱桃 | #E86A7A |
| lemon | 柠檬 | #F3E06E |
| taro | 紫薯 | #B79BD8 |
| peach | 蜜桃 | #FFB59B |

### 4.2 倒层规则

一次操作必须同时满足：

1. `from ≠ to`
2. 源杯非空
3. 目标杯为空，或目标杯顶层口味与源杯顶层口味相同
4. 目标杯未满（层数 < capacity）

可倒数量 = `min(源杯顶部连续同口味层数, 目标杯剩余空间)`。倒层从源杯顶部移走，追加到目标杯顶部。

### 4.3 胜利与卡死

- 胜利：所有非空杯都满足「层数 = capacity 且 4 层同口味」。每次落层后判定。
- 卡死：未胜利且不存在任何合法倒层。局内弹窗提供「撤销 / 加碗 / 重开」，不扣任何资源，不强制失败。
- 存在解但当前局面无解（非卡死）时，不主动提示；玩家点提示时告知“当前已无解，建议撤销或重开”。

### 4.4 会话与撤销

`GameSession` 是唯一的玩法状态持有者：

```ts
class GameSession {
  readonly level: Level;
  readonly bowls: FlavorId[][];        // 内部可变，对外只读视图
  readonly history: Move[];
  pour(from: number, to: number): Move | null;
  undo(): Move | null;
  addBowl(): boolean;
  hint(): HintResult;
  isWin(): boolean;
  isStuck(): boolean;
  restart(): void;
  view(): GameView;                    // 给表现层的只读快照
}
```

- 撤销：`history` 栈，每次倒层记录 `from / to / flavor / count`；撤销精确还原并弹出记录。无限次。
- 撤销不回退「加碗」，加碗只在 `restart()` 时随整局重置。
- 提示、加碗的免费/广告额度按“每局尝试”计数，`restart()` 重置。
- 动画播放期间（约 250ms）忽略新的倒层输入，避免状态错位。

### 4.5 提示

- 求解器从当前局面搜索一条解，返回第一步。
- 表现：高亮源杯与目标杯（描边 + 呼吸动画），约 2 秒后消失；不自动执行。
- 求解策略：带访问集的迭代加深 DFS，启发式优先“能填满一杯 / 能清空一杯”的走法；节点上限 200,000、时间上限 300ms。
- 结果区分 `found / unsolvable / timeout`：`unsolvable` 提示撤销或重开；`timeout` 提示“提示暂不可用”，**不消耗额度**。
- 点击提示时**先求解、再决定是否看广告**：无解或超时直接提示，不进入广告流程；只有拿到走法后，才按“有免费次数则扣 1 次，否则看广告”处理。
- 提示只在成功给出走法时消耗 1 次额度。求解器离线校验使用更大的节点预算。

### 4.6 加碗

- 在碗网格末尾追加一个空杯，布局自动重排。
- 默认每局最多额外加 2 个空杯（`gameConfig.maxExtraBowls = 2`）。
- 每局免费 1 个；用完看激励视频，每次成功 +1 个（可重复）。
- 达到上限后按钮置灰，点击 toast 提示“本局加碗已达上限”。
- 加碗后立即重布局并播放出现动画（缩放 + 淡入）。

### 4.7 道具额度与广告

| 道具 | 免费额度（每局） | 用完后 |
| --- | --- | --- |
| 撤销 | 无限 | — |
| 提示 | 1 次 | 看激励视频，成功 +1 次 |
| 加碗 | 1 个 | 看激励视频，成功 +1 个 |

- 配置项：`freeHintsPerAttempt = 1`、`freeBowlsPerAttempt = 1`、`rewardAmount = 1`、`maxExtraBowls = 2`。
- 免费额度用完且选择了广告 → 先弹确认框 → 调 `ads.showRewarded()`。
- 返回 `rewarded`：立即发奖并执行本次操作（提示：走法已在弹广告前算好，直接高亮；加碗：直接添加）。
- 返回 `closed` / `error`：toast 提示“未看完广告，未获得奖励” / “广告暂不可用”，不消耗免费次数、不添加碗。
- 开发态与未配置广告位 ID 时使用 Mock：短暂加载后返回 `rewarded`。

### 4.8 存档

存档键：`cake_sort_save_v1`，使用 `wx.setStorageSync` / `wx.getStorageSync`。

```ts
interface SaveData {
  version: 1;
  unlockedLevel: number;       // 已解锁的最大关卡号，初始 1
  completedLevelIds: number[]; // 已通关关卡
  settings: { sound: boolean; music: boolean; haptic: boolean };
}
```

- 通关时标记完成、解锁下一关并立即保存。
- 存档缺失或损坏时回退默认值；版本号用于未来迁移。
- 设置项变更即时保存。
- 提供“重置进度”入口（设置页内，二次确认）。

## 5. 表现层

### 5.1 场景流

```
Boot（加载 manifest / levels / 存档）
  → Home（标题、继续游戏、关卡选择、设置）
  → LevelSelect（30 关 5 列网格，可上下滚动，按进度解锁）
  → Game（局内）
```

- Boot 显示加载状态；图片加载失败自动走占位绘制，不阻塞启动。manifest 与关卡数据在构建期打包，解析失败视为开发期错误。
- 主页“继续游戏”跳到 `unlockedLevel` 对应的关卡；已全部通关时跳关卡选择。
- 关卡格显示关卡号；已通关显示对勾；未解锁显示锁并置灰。
- 所有场景共用 `Scene` 接口：`enter / exit / update(dt) / render(ctx) / onTouchStart / onTouchEnd`。

### 5.2 局内界面

- 顶栏：返回、第 N 关、重开、设置。
- 中间：碗网格。列数按杯数自适应：≤8 杯 4 列，9–12 杯 5 列，>12 杯 5 列并缩小杯体；优先保证 2 行以内，最多 4 行，杯体不小于 88×160（设计像素）。
- 底栏：撤销 / 提示 / 加碗，首版为文字按钮（后续可换图标）；提示与加碗带剩余次数徽标（免费次数 + 广告获得的次数合计）。
- 弹窗：胜利、卡死、广告确认、重开确认、设置。弹窗为模态，阻断下层输入。
- Toast：轻提示（额度用尽、广告未完成等），2 秒自动消失。
- 安全区：顶部留出 `safeArea.top`，底部留出屏幕底部安全距离。

### 5.3 动画

统一 tween 体系（0.15–0.4s，`easeOutCubic` / `easeInOutQuad`）：

- 倒层：源杯顶部层块分离 → 沿二次贝塞尔弧线飞向目标杯 → 目标杯落位挤压回弹（scaleY 0.85→1）。源杯轻微左右晃动，目标杯轻微放大。
- 撤销：反向弧线飞回，同时恢复源杯层。
- 加碗：新杯缩放 0.6→1、透明度 0→1。
- 胜利：落层完成后撒糖粒粒子（24–36 个，1.2 秒消散），随后弹出胜利弹窗。
- 非法操作：源杯左右抖动 200ms + 轻震动（若开启）+ 短音效。
- 动画期间逻辑已更新，输入被锁定至动画结束。

### 5.4 美术资源与替换流程

**资源清单** `assets/manifest.json`：

```json
{
  "images": [
    { "key": "bowl.body", "src": "assets/images/bowl_body.png", "width": 120, "height": 210 },
    { "key": "layer.strawberry", "src": "assets/images/layer_strawberry.png", "width": 112, "height": 48 }
  ],
  "audio": {
    "bgm": "assets/audio/bgm.mp3",
    "sfx.pour": "assets/audio/pour.mp3",
    "sfx.drop": "assets/audio/drop.mp3",
    "sfx.win": "assets/audio/win.mp3",
    "sfx.tap": "assets/audio/tap.mp3",
    "sfx.error": "assets/audio/error.mp3"
  }
}
```

- 图片条目可选 `slice: [left, top, right, bottom]`，预留给后续九宫格 UI 贴图；首版解析并保存，不参与绘制。
- 首版绘制层实际读取的 key：`bg`（全屏背景）、`bowl.body`（杯身）、`layer.<flavor>`（口味层，如 `layer.strawberry`）；`ui.*` 等 key 预留给后续皮肤。
- 缺图或加载失败时使用 `theme.ts` 的程序化占位（纯色层 + 圆角杯身），游戏完整可玩。
- 正式资源按 750 设计宽的 2 倍像素导出（例：逻辑尺寸 80×120 的杯身，导出 160×240 像素的图），绘制时按 manifest 里记录的逻辑尺寸缩放。
- manifest 的 `width` / `height` 一律填逻辑尺寸（设计像素），不是图片像素。
- 文件命名：`bowl_body.png`、`layer_strawberry.png`、`bg.png`；格式为透明 PNG 或 WebP。
- 换美术流程：替换图片 → 更新 manifest 的路径与尺寸 → 必要时调 `theme.ts`。`core/`、关卡数据不动。

**主题 token**（`theme.ts`）：奶油底色、粉/黄/棕/绿主色、圆角（杯 18 / 按钮 24）、字号（标题 56 / 次级标题 40 / 正文 28 / 小字 22）、间距 8/12/16/24、阴影参数。

### 5.5 适配

- 设计宽 750；`scale = windowWidth / 750`；逻辑高度 = `windowHeight / scale`。
- 所有布局坐标基于设计像素，绘制时统一缩放；DPR 通过 canvas 物理像素缩放保证清晰。
- 顶部使用 `safeArea.top`，底部使用 `windowHeight - safeArea.bottom`。
- 碗网格按可用高度动态计算杯体尺寸与间距，保证不越界。

## 6. 服务层

```ts
interface AdService {
  isReady(): boolean;
  showRewarded(): Promise<'rewarded' | 'closed' | 'error'>;
}

interface StorageService {
  load(): SaveData;
  save(data: SaveData): void;
  reset(): void;
}

interface AudioService {
  playMusic(key: string): void;
  stopMusic(): void;
  playSfx(key: string): void;
  setSoundEnabled(v: boolean): void;
  setMusicEnabled(v: boolean): void;
}

interface HapticsService { light(): void; setEnabled(v: boolean): void; }
interface AnalyticsService { track(event: string, payload?: Record<string, unknown>): void; }
```

- `ads`：`MockAdService`（开发/无广告位 ID）与 `WechatAdService`（`wx.createRewardedVideoAd`）。真实实现需处理加载失败、重复 show、关闭回调只触发一次、基础库过低时降级。
- `audio`：`wx.createInnerAudioContext`；BGM 循环、首次用户点击后启动（规避自动播放限制）；音效按需创建上下文并在播放结束后销毁。
- `haptics`：`wx.vibrateShort({ type: 'light' })`，失败静默。
- `analytics`：空实现，便于后续接入。
- 所有服务通过 `App` 注入场景；单测时使用 Mock。

## 7. 关卡生产

### 7.1 生成器

`tools/gen-levels.ts`：

1. 输入：颜色数 C、空杯数 E、容量 4、随机种子、目标最少步数下限。
2. 随机分配：把 C×4 层洗牌后按容量 4 装入 C 个杯，再追加 E 个空杯；若恰好是完成态或卡死态则重试。
3. 求解器校验：先用快速求解确认可解，再用最优求解器计算最少步数；不满足下限则重新随机（同种子可复现）。
4. 输出 `levels/levels.json`。

`levels.json` 结构：

```json
{
  "version": 1,
  "capacity": 4,
  "levels": [
    {
      "id": 1,
      "difficulty": "easy",
      "minMoves": 9,
      "bowls": [["strawberry", "mango", "strawberry"], ["..."], []]
    }
  ]
}
```

校验规则：每关每种口味恰好 4 层；总层数 = C×4；空杯数符合难度配置；可解；`minMoves` 与实际求解一致。

### 7.2 难度配置（初值，试玩后校准）

| 难度 | 关卡 | 颜色数 | 空杯 | 最少步数下限 |
| --- | --- | --- | --- | --- |
| easy | 1–10 | 3–5 | 2 | 8 |
| mid | 11–20 | 6–8 | 2 | 16 |
| hard | 21–30 | 9–11 | 2–3 | 24 |

- 生成器使用固定种子表，保证每次生成结果一致、可复现。
- 加关只需扩展配置并重跑脚本，代码不变。

## 8. 工程与构建

- npm scripts：
  - `dev`：esbuild watch 输出 `game.js`（带 sourcemap）
  - `build`：minify 输出 `game.js`
  - `typecheck`：`tsc --noEmit`
  - `test`：`vitest run`
  - `verify:levels`：`tsx tools/verify-levels.ts`
  - `gen:levels`：`tsx tools/gen-levels.ts`
- `game.json`：`deviceOrientation: "portrait"`、`showStatusBar: false`。
- `project.config.json`：`compileType: "game"`；AppID 留占位，由使用者替换为自有 AppID（开发可用测试号）。
- `.gitignore`：`node_modules/`、`game.js`、`game.js.map`、`.superpowers/`、系统临时文件。
- 源码不影响小游戏运行目录结构：`assets/`、`levels/`、`game.json` 保持在项目根目录；仅 `src/` 参与打包。

## 9. 测试与验收

### 9.1 自动测试（Vitest）

- `rules`：合法/非法倒层、倒层数量受空间限制、目标同口味判定、胜负判定。
- `game`：撤销精确还原、连续撤销到初始态、加碗上限、道具额度消耗与重置、重开。
- `solver`：已知可解关卡返回走法且走法合法；无解局面返回 `unsolvable`；搜索预算超限返回 `timeout`。
- 关卡数据：30 关全部通过 `verify-levels` 校验（口味计数、容量、可解、`minMoves` 一致）。
- 服务层 Mock：广告结果分支（rewarded/closed/error）驱动额度逻辑。

### 9.2 手动验收（微信开发者工具 + 真机）

- 布局：iPhone 刘海屏、主流 Android 全面屏、小屏设备；安全区不遮挡顶栏/底栏。
- 玩法：通关第 1 关与第 30 关；卡死弹窗；撤销到底；提示（可解/无解）；加碗后布局重排。
- 存档：杀进程重进，进度与设置保留；重置进度生效。
- 广告：Mock 全流程；填入真实广告位 ID 后，看完/中途关闭/加载失败三种结果正确。
- 性能：连续快速倒层 60fps；30 关加载无明显卡顿。
- 美术替换：清空 `assets/images` 仍可玩；按规范换一套图不改代码。

## 10. 里程碑

1. **M1 工程骨架**：仓库、构建、Canvas、安全区、场景栈、资源加载与占位绘制。验收：开发者工具打开即见 Boot → Home，60fps。
2. **M2 核心玩法 + 单测**：rules / GameSession / 撤销 / 胜负 / 卡死 / 道具额度；core 单测全绿。
3. **M3 表现与页面**：局内绘制与动画、主页、关卡选择、弹窗、存档、音效。验收：第 1 关可完整游玩并保存进度。
4. **M4 关卡生产**：生成器、校验器、30 关数据、难度曲线。验收：全量校验通过，关卡选择可玩。
5. **M5 广告与收尾**：Mock/真实广告、降级处理、真机适配、美术替换验收、构建上线包。

## 11. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 激励视频需流量主资格与广告位 ID | 广告服务接口化，Mock 可全流程自测；上线前仅填配置 |
| 求解器在复杂局面超时 | 节点/时间双上限；超时不扣额度并给明确提示；离线关卡校验用更大预算 |
| 小屏 + 多杯布局拥挤 | 杯体尺寸与列数自适应，最多 4 行，最小尺寸兜底 |
| 微信广告回调重复/异常 | 广告服务内做一次性回调保护、加载失败重试与降级 |
| 真机安全区与 DPR 差异 | 统一安全区计算 + 真机验收清单 |

## 12. 后续可扩展（非 MVP）

金币与体力循环、签到、皮肤主题、每日挑战、关卡分享、排行榜与云存档、更多章节与动态难度、埋点分析、真实广告频控。
