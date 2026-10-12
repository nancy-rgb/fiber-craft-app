import type { AmigurumiShape } from "@/lib/types/project";
import { planSpiralRounds } from "@/lib/math/amigurumiMath";

const WIDTH = 240;
const GAP = 6;

const heightOf = (s: AmigurumiShape) =>
  s.type === "sphere" ? s.maxDiameterInches : s.heightInches;

interface Box {
  shape: AmigurumiShape;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Piece drawn behind its target (tail etc.) */
  behind?: boolean;
}

/**
 * Stacked silhouette preview. Pieces marked "Attach to" are drawn around
 * their target (ears on top, arms on the sides, legs below, tail behind)
 * instead of joining the vertical stack. Safety eyes show as two dots.
 */
export function ShapeStackPreview({
  shapes,
  activeIndex,
}: {
  shapes: AmigurumiShape[];
  /** Highlights the piece being worked; others are dimmed. */
  activeIndex?: number;
}) {
  if (shapes.length === 0) return null;
  const maxWidth = Math.max(...shapes.map((s) => s.maxDiameterInches));
  const roots = shapes.filter((s) => !s.attachment);
  const totalHeight =
    roots.length > 0
      ? roots.reduce((sum, s) => sum + heightOf(s), 0)
      : Math.max(...shapes.map(heightOf));
  const scale = Math.min((WIDTH * 0.7) / maxWidth, 250 / totalHeight);
  const cx = WIDTH / 2;

  // First pass: lay out root pieces vertically, record their boxes.
  const byId = new Map<string, Box>();
  const boxes: Box[] = [];
  let y = GAP;
  roots.forEach((shape) => {
    const w = shape.maxDiameterInches * scale;
    const h = heightOf(shape) * scale;
    const box: Box = {
      shape,
      index: shapes.indexOf(shape),
      x: cx - w / 2,
      y,
      w,
      h,
    };
    y += h + GAP;
    boxes.push(box);
    byId.set(shape.id, box);
  });

  // Second pass: attached pieces positioned relative to their target.
  const sideCount = new Map<string, number>();
  shapes.forEach((shape, index) => {
    const att = shape.attachment;
    if (!att) return;
    const target = byId.get(att.targetPieceId);
    if (!target) return;
    const w = shape.maxDiameterInches * scale;
    const h = heightOf(shape) * scale;
    const tx = target.x + target.w / 2;
    const ty = target.y;
    const th = target.h;
    // Attachment round → vertical fraction on the target (top=0, bottom=1).
    const targetShape = target.shape;
    let rounds = 1;
    try {
      rounds = planSpiralRounds(targetShape, {
        stitchesPerInch: 1,
        rowsPerInch: 1,
      }).length;
    } catch {
      rounds = 1;
    }
    const frac =
      att.position === "top"
        ? 0
        : att.position === "bottom"
          ? 1
          : Math.min(0.9, Math.max(0.1, att.round / rounds));
    const cy = ty + frac * th;

    const seen = (sideCount.get(att.targetPieceId) ?? 0) + 1;
    sideCount.set(att.targetPieceId, seen);
    const left = seen % 2 === 1;

    let x = tx - w / 2;
    let yPos = cy - h / 2;
    let behind = false;
    switch (att.position) {
      case "top":
        // Paired "ears" spread left/right of the crown.
        yPos = ty - h + GAP;
        x = tx - w / 2 + (seen === 2 ? w * 0.55 : -w * 0.25);
        break;
      case "bottom":
        yPos = ty + th - GAP;
        x = tx - w / 2 + (left ? -w * 0.35 : w * 0.35);
        break;
      case "side":
        x = left ? target.x - w * 0.75 : target.x + target.w - w * 0.25;
        yPos = cy - h / 2;
        break;
      case "front":
        // Snout etc.: drawn smaller, overlapping the lower front.
        yPos = ty + th * 0.55 - h / 2;
        x = tx - w / 2;
        break;
      case "back":
        // Tail: peeks out from behind the right edge.
        x = target.x + target.w - w * 0.35;
        yPos = cy - h / 2;
        behind = true;
        break;
    }
    boxes.push({ shape, index, x, y: yPos, w, h, behind });
  });

  // Third pass: normalize so nothing draws outside the viewBox.
  const minY = Math.min(...boxes.map((b) => b.y));
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const pad = GAP;
  const viewW = Math.max(WIDTH, maxX - minX + pad * 2);
  const viewH = maxY - minY + pad * 2;
  const dx = viewW / 2 - (minX + maxX) / 2;
  const dy = pad - minY;

  const shapeEl = (b: Box) => {
    const { shape } = b;
    const bx = b.x + dx;
    const by = b.y + dy;
    const dimmed = activeIndex !== undefined && activeIndex !== b.index;
    const common = {
      className: dimmed
        ? "fill-border/40 stroke-muted"
        : "fill-rose/40 stroke-accent",
      strokeWidth: activeIndex === b.index ? 3 : 2,
    };
    const bcx = bx + b.w / 2;
    switch (shape.type) {
      case "sphere":
        return (
          <ellipse
            cx={bcx}
            cy={by + b.h / 2}
            rx={b.w / 2}
            ry={b.h / 2}
            {...common}
          />
        );
      case "cylinder":
        return (
          <rect
            x={bx}
            y={by}
            width={b.w}
            height={b.h}
            rx={Math.min(b.w, b.h) * 0.25}
            {...common}
          />
        );
      case "cone":
        return (
          <path
            d={`M ${bcx} ${by} L ${bx + b.w} ${by + b.h} L ${bx} ${by + b.h} Z`}
            strokeLinejoin="round"
            {...common}
          />
        );
    }
  };

  const eyes = (b: Box) => {
    if (!b.shape.eyes) return null;
    // Eye dots on the face, at the eye round's height, roughly the
    // requested distance apart (clamped so they stay on the face).
    const rounds = Math.max(
      1,
      planSpiralRounds(b.shape, { stitchesPerInch: 1, rowsPerInch: 1 }).length,
    );
    const frac = Math.min(
      0.85,
      Math.max(0.1, b.shape.eyes.eyePlacementRound / rounds),
    );
    const ey = b.y + dy + frac * b.h;
    const gap = Math.min(
      (b.shape.eyes.eyeDistanceStitches / 6) * (b.w / 6),
      b.w * 0.3,
    );
    const r = Math.max(1.5, (b.shape.eyes.eyeSizeMm / 9) * 1.6);
    const ex = b.x + dx + b.w / 2;
    const dimmed = activeIndex !== undefined && activeIndex !== b.index;
    return (
      <g className={dimmed ? "fill-muted/50" : "fill-foreground"}>
        <circle cx={ex - gap} cy={ey} r={r} />
        <circle cx={ex + gap} cy={ey} r={r} />
      </g>
    );
  };

  const ordered = [...boxes].sort((a, b) =>
    a.behind === b.behind ? 0 : a.behind ? -1 : 1,
  );

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="mx-auto w-full max-w-60"
      role="img"
      aria-label={`Preview of ${shapes.map((s) => s.name).join(", ")}`}
    >
      {ordered.map((b) => (
        <g key={b.shape.id}>
          {shapeEl(b)}
          {eyes(b)}
          <text
            x={b.x + dx + b.w / 2}
            y={b.y + dy + b.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`text-[11px] ${
              activeIndex !== undefined && activeIndex !== b.index
                ? "fill-muted"
                : "fill-foreground"
            }`}
          >
            {b.shape.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
