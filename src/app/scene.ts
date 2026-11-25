export interface Scene {
  enter(): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onTouchStart(x: number, y: number): void;
  onTouchMove(x: number, y: number): void;
  onTouchEnd(x: number, y: number): void;
}
