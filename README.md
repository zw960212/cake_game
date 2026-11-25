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
npm run verify:levels # 校验 30 关可解且参考步数一致
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
5. 没有登记或加载失败的 key 会自动使用 `src/render/painters/bowl.ts` 与 `src/render/background.ts` 的程序化占位（配色来自 `src/render/theme.ts`）；清空图片目录也能完整游玩。

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
