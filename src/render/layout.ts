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
