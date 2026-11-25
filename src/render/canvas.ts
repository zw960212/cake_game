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
