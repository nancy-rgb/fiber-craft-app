import type {
  CalculatedInstruction,
  Gauge,
  YarnColor,
} from "@/lib/types/project";
import { assertValidGauge } from "./validation";

/** The parts of `ImageData` the quantizer reads (lets tests skip the DOM). */
export type PixelSource = Pick<ImageData, "data" | "width" | "height">;

export interface ColorRun {
  colorId: string;
  count: number;
}

type Triple = [number, number, number];

function hexToRgb(hex: string): Triple {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new RangeError(`Invalid color hex: ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLinear = (channel: number) => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

// CIELAB (D65): Euclidean distance there tracks perceived color difference
// far better than raw RGB, so photos map to the yarn a person would pick.
function rgbToLab([r, g, b]: Triple): Triple {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f((lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047);
  const fy = f(lr * 0.2126 + lg * 0.7152 + lb * 0.0722);
  const fz = f((lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function assertGridDimension(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer (got ${value})`);
  }
}

function assertPalette(palette: YarnColor[]): void {
  if (palette.length === 0) {
    throw new RangeError("palette must contain at least one color");
  }
}

/**
 * Box-averages the image into targetWidth × targetHeight cells (transparent
 * pixels count as white) and maps each cell to the nearest palette color.
 * Returns rows top to bottom.
 */
export function quantizeImageToGrid(
  imageData: PixelSource,
  targetWidth: number,
  targetHeight: number,
  palette: YarnColor[],
): string[][] {
  assertGridDimension(targetWidth, "targetWidth");
  assertGridDimension(targetHeight, "targetHeight");
  assertPalette(palette);
  const { data, width, height } = imageData;
  assertGridDimension(width, "imageData.width");
  assertGridDimension(height, "imageData.height");

  const labs = palette.map((color) => rgbToLab(hexToRgb(color.hex)));
  const span = (index: number, cells: number, pixels: number) => {
    const start = Math.floor((index * pixels) / cells);
    const end = Math.max(start + 1, Math.floor(((index + 1) * pixels) / cells));
    return [start, end] as const;
  };

  const grid: string[][] = [];
  for (let row = 0; row < targetHeight; row++) {
    const [y0, y1] = span(row, targetHeight, height);
    const cells: string[] = [];
    for (let col = 0; col < targetWidth; col++) {
      const [x0, x1] = span(col, targetWidth, width);
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          const alpha = data[i + 3] / 255;
          const white = 255 * (1 - alpha);
          r += data[i] * alpha + white;
          g += data[i + 1] * alpha + white;
          b += data[i + 2] * alpha + white;
          n++;
        }
      }
      const [L, A, B] = rgbToLab([r / n, g / n, b / n]);
      let best = 0;
      let bestDistance = Infinity;
      labs.forEach(([pl, pa, pb], index) => {
        const distance = (L - pl) ** 2 + (A - pa) ** 2 + (B - pb) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      cells.push(palette[best].id);
    }
    grid.push(cells);
  }
  return grid;
}

/** MC for the first color; CC (two colors) or CC1, CC2… for the rest. */
export function colorAbbreviations(palette: YarnColor[]): Map<string, string> {
  return new Map(
    palette.map((color, i) => [
      color.id,
      i === 0 ? "MC" : palette.length === 2 ? "CC" : `CC${i}`,
    ]),
  );
}

/** RS rows and every round are read right to left; WS rows left to right. */
export const readsRightToLeft = (rowNumber: number, workedInRound: boolean) =>
  workedInRound || rowNumber % 2 === 1;

export const rowLabel = (rowNumber: number, workedInRound: boolean) =>
  workedInRound
    ? `Rnd ${rowNumber}`
    : `Row ${rowNumber} (${rowNumber % 2 === 1 ? "RS" : "WS"})`;

/** Color runs for chart row `rowNumber` (1 = bottom), in working order. */
export function rowRuns(
  grid: string[][],
  rowNumber: number,
  workedInRound: boolean,
): ColorRun[] {
  const cells = grid[grid.length - rowNumber];
  if (!Number.isInteger(rowNumber) || !cells) {
    throw new RangeError(`row ${rowNumber} is outside the chart`);
  }
  const ordered = readsRightToLeft(rowNumber, workedInRound)
    ? [...cells].reverse()
    : cells;
  const runs: ColorRun[] = [];
  for (const colorId of ordered) {
    const last = runs[runs.length - 1];
    if (last?.colorId === colorId) last.count++;
    else runs.push({ colorId, count: 1 });
  }
  return runs;
}

function assertValidGrid(grid: string[][], palette: YarnColor[]): void {
  assertPalette(palette);
  if (grid.length === 0 || grid[0].length === 0) {
    throw new RangeError("grid must have at least one row and one stitch");
  }
  const ids = new Set(palette.map((color) => color.id));
  const width = grid[0].length;
  grid.forEach((row, i) => {
    if (row.length !== width) {
      throw new RangeError(
        `grid row ${i} has ${row.length} cells; expected ${width}`,
      );
    }
    const unknown = row.find((id) => !ids.has(id));
    if (unknown !== undefined) {
      throw new RangeError(`grid row ${i} uses unknown color "${unknown}"`);
    }
  });
}

/**
 * One instruction per chart row, starting from the bottom row (Row 1).
 * Example: { label: "Row 1 (RS)", instructionText: "4 MC, 2 CC, 8 MC" }.
 */
export function generateColorworkInstructions(
  grid: string[][],
  palette: YarnColor[],
  workedInRound: boolean,
): CalculatedInstruction[] {
  assertValidGrid(grid, palette);
  const abbreviations = colorAbbreviations(palette);
  return grid.map((_, i) => {
    const rowNumber = i + 1;
    return {
      stepNumber: rowNumber,
      label: rowLabel(rowNumber, workedInRound),
      instructionText: rowRuns(grid, rowNumber, workedInRound)
        .map((run) => `${run.count} ${abbreviations.get(run.colorId)}`)
        .join(", "),
      stitchCount: grid[0].length,
    };
  });
}

export const createGrid = (width: number, height: number, fillId: string) =>
  Array.from({ length: height }, () => Array<string>(width).fill(fillId));

export function paintCell(
  grid: string[][],
  row: number,
  col: number,
  colorId: string,
): string[][] {
  const current = grid[row]?.[col];
  if (current === undefined || current === colorId) return grid;
  return grid.map((cells, r) =>
    r === row ? cells.map((id, c) => (c === col ? colorId : id)) : cells,
  );
}

/** Paint-bucket fill of the 4-connected region containing (row, col). */
export function floodFill(
  grid: string[][],
  row: number,
  col: number,
  colorId: string,
): string[][] {
  const target = grid[row]?.[col];
  if (target === undefined || target === colorId) return grid;
  const next = grid.map((cells) => [...cells]);
  const stack: [number, number][] = [[row, col]];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    if (next[r]?.[c] !== target) continue;
    next[r][c] = colorId;
    stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  return next;
}

export const replaceColor = (grid: string[][], fromId: string, toId: string) =>
  grid.map((cells) => cells.map((id) => (id === fromId ? toId : id)));

/**
 * Resizes anchored at the bottom-left, so Row 1 and the first stitches stay
 * put; new cells use `fillId`.
 */
export function resizeGrid(
  grid: string[][],
  width: number,
  height: number,
  fillId: string,
): string[][] {
  assertGridDimension(width, "width");
  assertGridDimension(height, "height");
  return Array.from({ length: height }, (_, r) => {
    const source = grid[grid.length - height + r];
    return Array.from({ length: width }, (_, c) => source?.[c] ?? fillId);
  });
}

/** Width ÷ height of one stitch cell, so charts match the knitted fabric. */
export function cellAspect(gauge: Gauge): number {
  assertValidGauge(gauge);
  return gauge.rowsPerInch / gauge.stitchesPerInch;
}

/** Rows needed so a `stitches`-wide chart keeps the image's proportions. */
export function proportionalRows(
  stitches: number,
  imageWidth: number,
  imageHeight: number,
  gauge: Gauge,
): number {
  return Math.max(
    1,
    Math.round(stitches * (imageHeight / imageWidth) * cellAspect(gauge)),
  );
}
