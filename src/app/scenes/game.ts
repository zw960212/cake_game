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
import { tapsSuppressed } from '../components/tapGuard';
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
  private adPending = false;
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
    if (tapsSuppressed()) {
      this.touchStart = null;
      return;
    }
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
    if (this.winAt > 0 || this.adPending) return;
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
    if (this.anim || this.adPending) return;

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
    if (this.anim || this.winAt > 0 || this.adPending) return;
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
    if (this.anim || this.winAt > 0 || this.adPending) return;
    if (this.session.isWin()) return;

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
    if (this.anim || this.winAt > 0 || this.adPending) return;

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
    if (this.adPending) return;
    this.adPending = true;
    this.toast.show('正在加载广告…', 4000);
    try {
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
    } finally {
      this.adPending = false;
    }
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
    this.modal.show('无路可走', '没有可倒的蛋糕了，试试撤销、加碗或重开。', [
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
