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

const roundsOf = (s: AmigurumiShape) => {
  try {
    return Math.max(
      1,
      planSpiralRounds(s, { stitchesPerInch: 1, rowsPerInch: 1 }).length,
    );
  } catch {
    return 1;
  }
};

/**
 * Stacked silhouette preview. Pieces marked "Attach to" are drawn around
 * their target (ears on top, arms on the sides, legs below, tail behind)
 * instead of joining the vertical stack. Safety eyes show as two dots.
 * When `onAttachmentRound` is given, attached pieces can be dragged
 * vertically along their target to change the attach round.
 */
export function ShapeStackPreview({
  shapes,
  activeIndex,
  onAttachmentRound,
}: {
  shapes: AmigurumiShape[];
  /** Highlights the piece being worked; others are dimmed. */
  activeIndex?: number;
  /** Drag callback: (attached shape id, new round on its target). */
  onAttachmentRound?: (shapeId: string, round: number) => void;
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
  // Count per target+position so siblings spread instead of overlapping.
  const siblings = new Map<string, number>();
  // For drag: attached piece → target box + target's round count.
  const dragInfo = new Map<
    string,
    { targetBox: Box; targetRounds: number; position: string }
  >();
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
    const targetRounds = roundsOf(target.shape);
    const frac =
      att.position === "top"
        ? 0
        : att.position === "bottom"
          ? 1
          : Math.min(0.9, Math.max(0.1, att.round / targetRounds));
    const cy = ty + frac * th;

    const key = `${att.targetPieceId}:${att.position}`;
    const seen = (siblings.get(key) ?? 0) + 1;
    siblings.set(key, seen);

    let x = tx - w / 2;
    let yPos = cy - h / 2;
    let behind = false;
    switch (att.position) {
      case "top":
        // Ears: first slightly left of crown, second right, extras wider.
        yPos = ty - h + GAP;
        x = tx - w / 2 + (seen % 2 === 0 ? w * 0.55 : -w * 0.3);
        if (seen > 2) yPos += h * 0.15 * Math.floor(seen / 2);
        break;
      case "bottom":
        // Legs: tuck under the target's left/right sides so a pair
        // doesn't overlap itself, extras stagger upward.
        yPos = ty + th - GAP;
        x = tx - w / 2 + (seen % 2 === 1 ? -target.w * 0.28 : target.w * 0.28);
        if (seen > 2) yPos -= h * 0.4;
        break;
      case "side":
        // Arms: alternate left/right at the attach round; a second pair
        // drops below so it never hides behind the first.
        x =
          seen % 2 === 1 ? target.x - w * 0.75 : target.x + target.w - w * 0.25;
        yPos = cy - h / 2 + Math.floor((seen - 1) / 2) * h * 0.55;
        break;
      case "front":
        // Snout etc.: overlapping the lower front.
        yPos = ty + th * 0.55 - h / 2;
        x = tx - w / 2;
        break;
      case "back":
        // Tail: peeks out from behind the right edge.
        x = target.x + target.w - w * 0.35;
        yPos = cy - h / 2 + (seen - 1) * h * 0.3;
        behind = true;
        break;
    }
    boxes.push({ shape, index, x, y: yPos, w, h, behind });
    dragInfo.set(shape.id, {
      targetBox: target,
      targetRounds,
      position: att.position,
    });
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
    const rounds = roundsOf(b.shape);
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

  const startDrag = (e: React.PointerEvent, b: Box) => {
    const info = dragInfo.get(b.shape.id);
    const att = b.shape.attachment;
    if (!onAttachmentRound || !info || !att) return;
    e.preventDefault();
    const target = info.targetBox;
    const startY = e.clientY;
    const startRound = att.round;
    const roundsToPixels = info.targetRounds / target.h;
    const move = (ev: PointerEvent) => {
      // SVG units ≈ CSS pixels here (viewBox width ≈ rendered width).
      const deltaRounds = Math.round((ev.clientY - startY) * roundsToPixels);
      const next = Math.min(
        info.targetRounds,
        Math.max(1, startRound + deltaRounds),
      );
      if (next !== startRound) onAttachmentRound(b.shape.id, next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="mx-auto w-full max-w-60"
      role="img"
      aria-label={`Preview of ${shapes.map((s) => s.name).join(", ")}`}
    >
      {ordered.map((b) => {
        // Top/bottom attach at fixed points (crown/base), so only
        // side/front/back pieces respond to a vertical drag.
        const draggable =
          !!onAttachmentRound &&
          !!b.shape.attachment &&
          b.shape.attachment.position !== "top" &&
          b.shape.attachment.position !== "bottom";
        return (
          <g
            key={b.shape.id}
            className={draggable ? "cursor-grab" : undefined}
            style={draggable ? { touchAction: "none" } : undefined}
            onPointerDown={draggable ? (e) => startDrag(e, b) : undefined}
          >
            {shapeEl(b)}
            {eyes(b)}
            <text
              x={b.x + dx + b.w / 2}
              y={b.y + dy + b.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`pointer-events-none text-[11px] ${
                activeIndex !== undefined && activeIndex !== b.index
                  ? "fill-muted"
                  : "fill-foreground"
              }`}
            >
              {b.shape.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
