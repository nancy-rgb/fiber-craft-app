"use client";

import { useEffect, useRef, useState } from "react";
import { readsRightToLeft } from "@/lib/math/colorworkMath";
import type { YarnColor } from "@/lib/types/project";

const GUTTER = 22;

interface ColorworkChartProps {
  grid: string[][];
  palette: YarnColor[];
  /** Width ÷ height of one stitch cell. */
  cellAspect: number;
  workedInRound: boolean;
  /** Grid index of the highlighted row (0 = top). */
  activeRow?: number | null;
  /** Enables drawing; `start` is true on the first cell of a stroke. */
  onPaint?: (row: number, col: number, start: boolean) => void;
  label: string;
  className?: string;
}

export function ColorworkChart({
  grid,
  palette,
  cellAspect,
  workedInRound,
  activeRow = null,
  onPaint,
  label,
  className = "",
}: ColorworkChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastCell = useRef<string | null>(null);
  const [width, setWidth] = useState(0);

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cellW = cols > 0 ? Math.max(1, (width - GUTTER * 2) / cols) : 0;
  const cellH = cellW / cellAspect;
  const height = Math.ceil(rows * cellH);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || width === 0 || cols === 0) return;

    const css = getComputedStyle(canvas);
    const token = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;
    const ink = token("--foreground", "#302a26");
    const muted = token("--muted", "#6b5f57");
    const accent = token("--accent", "#963f2d");
    const wool = token("--background", "#f7f3eb");

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const chartW = cols * cellW;
    const chartH = rows * cellH;
    const hex = new Map(palette.map((c) => [c.id, c.hex]));
    grid.forEach((cells, r) =>
      cells.forEach((id, c) => {
        ctx.fillStyle = hex.get(id) ?? "#cccccc";
        ctx.fillRect(GUTTER + c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
      }),
    );

    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    if (cellW >= 5) {
      ctx.strokeStyle = "rgba(48, 42, 38, 0.18)";
      ctx.lineWidth = 0.5;
      for (let c = 1; c < cols; c++)
        line(GUTTER + c * cellW, 0, GUTTER + c * cellW, chartH);
      for (let r = 1; r < rows; r++)
        line(GUTTER, r * cellH, GUTTER + chartW, r * cellH);
    }
    // Heavier rule every 10 stitches/rows, counted from Row 1's first stitch.
    ctx.strokeStyle = "rgba(48, 42, 38, 0.5)";
    ctx.lineWidth = 1;
    for (let c = 1; c < cols; c++) {
      if ((cols - c) % 10 === 0)
        line(GUTTER + c * cellW, 0, GUTTER + c * cellW, chartH);
    }
    for (let r = 1; r < rows; r++) {
      if ((rows - r) % 10 === 0)
        line(GUTTER, r * cellH, GUTTER + chartW, r * cellH);
    }
    ctx.strokeStyle = ink;
    ctx.strokeRect(GUTTER, 0.5, chartW, chartH - 1);

    const active = activeRow !== null && activeRow >= 0 && activeRow < rows;
    if (active) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = wool;
      ctx.fillRect(GUTTER, 0, chartW, activeRow * cellH);
      ctx.fillRect(
        GUTTER,
        (activeRow + 1) * cellH,
        chartW,
        chartH - (activeRow + 1) * cellH,
      );
      ctx.globalAlpha = 1;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(
        GUTTER - 1.5,
        activeRow * cellH - 1.5,
        chartW + 3,
        cellH + 3,
      );
    }

    const fontSize = Math.min(11, Math.max(8, cellH * 0.8));
    const every = cellH >= 9 ? 1 : cellH >= 4 ? 5 : 10;
    ctx.textBaseline = "middle";
    for (let r = 0; r < rows; r++) {
      const n = rows - r;
      const isActive = active && r === activeRow;
      if (!isActive && n !== 1 && n % every !== 0) continue;
      const rtl = readsRightToLeft(n, workedInRound);
      ctx.font = `${isActive ? "700 " : ""}${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = isActive ? accent : muted;
      ctx.textAlign = rtl ? "left" : "right";
      ctx.fillText(
        String(n),
        rtl ? GUTTER + chartW + 4 : GUTTER - 4,
        r * cellH + cellH / 2,
      );
    }
  }, [
    grid,
    palette,
    width,
    height,
    cols,
    rows,
    cellW,
    cellH,
    activeRow,
    workedInRound,
  ]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || activeRow === null || cellH === 0) return;
    wrap.scrollTo({
      top: activeRow * cellH - wrap.clientHeight / 2 + cellH / 2,
      behavior: "smooth",
    });
  }, [activeRow, cellH]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left - GUTTER) / cellW);
    const row = Math.floor((e.clientY - rect.top) / cellH);
    return row >= 0 && row < rows && col >= 0 && col < cols
      ? { row, col }
      : null;
  };

  const paintAt = (
    e: React.PointerEvent<HTMLCanvasElement>,
    start: boolean,
  ) => {
    const cell = cellAt(e);
    if (!cell || !onPaint) return;
    const key = `${cell.row}:${cell.col}`;
    if (!start && key === lastCell.current) return;
    lastCell.current = key;
    onPaint(cell.row, cell.col, start);
  };

  return (
    <div ref={wrapRef} className={`overflow-y-auto ${className}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        style={{
          width,
          height,
          display: "block",
          touchAction: onPaint ? "none" : "auto",
        }}
        onPointerDown={
          onPaint
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                paintAt(e, true);
              }
            : undefined
        }
        onPointerMove={
          onPaint
            ? (e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  paintAt(e, false);
              }
            : undefined
        }
        onPointerUp={() => (lastCell.current = null)}
        onPointerCancel={() => (lastCell.current = null)}
      />
    </div>
  );
}
