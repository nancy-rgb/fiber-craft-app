import { planSpiralRounds } from "@/lib/math/amigurumiMath";
import type {
  AmigurumiShape,
  Gauge,
  LimbAttachment,
} from "@/lib/types/project";

export type Vec3 = [number, number, number];

/** Flat pieces (ears, fins) are drawn at this fraction of their width deep. */
export const FLAT_DEPTH = 0.3;
/** How far a sewn-on piece sinks into its target, as a fraction of its height. */
const EMBED = 0.25;
/** Stacked root pieces overlap by this fraction of the smaller height. */
const STACK_OVERLAP = 0.12;
/** Arms point out and down from the body (radians from straight up). */
const ARM_ANGLE = 2.3;
const EAR_TILT = 0.3;
const TAIL_LIFT = 0.35;
const CURVE_BEND = { slight: 0.25, medium: 0.45, sharp: 0.7 } as const;

export interface PiecePlacement {
  shape: AmigurumiShape;
  /** Index into the original shapes array. */
  index: number;
  position: Vec3;
  /** Euler XYZ. Local +Y is the magic-ring end (tip of a limb). */
  rotation: Vec3;
}

export interface Layout3D {
  pieces: PiecePlacement[];
  center: Vec3;
  /** Bounding-sphere radius around `center`, in inches. */
  radius: number;
}

/** Used while the builder's gauge fields are empty or invalid. */
export const FALLBACK_GAUGE: Gauge = { stitchesPerInch: 5, rowsPerInch: 5 };

/** Round count with the project's gauge, matching the builder's round fields. */
export const roundsOf = (s: AmigurumiShape, gauge: Gauge | null) => {
  try {
    return Math.max(1, planSpiralRounds(s, gauge ?? FALLBACK_GAUGE).length);
  } catch {
    return 1;
  }
};

/** Drawn height along the piece's local Y axis, in inches. */
export function pieceHeight(s: AmigurumiShape): number {
  if (s.type === "sphere") return s.maxDiameterInches;
  if (s.type === "oval")
    return Math.min(s.heightInches, s.maxDiameterInches * 0.6);
  return s.heightInches;
}

export const curveBend = (s: AmigurumiShape) =>
  CURVE_BEND[s.curvatureIntensity ?? "medium"];

export const isFlat = (s: AmigurumiShape) =>
  !!s.isFlat || s.type === "flat-triangle";

/**
 * Radius of a lathe-style piece at `f` (0 = top / magic ring, 1 = bottom),
 * as a fraction of the max radius.
 */
export function profileRadius(s: AmigurumiShape, f: number): number {
  const t = Math.min(1, Math.max(0, f));
  switch (s.type) {
    case "sphere":
    case "oval":
      return Math.sqrt(Math.max(0.1, 1 - (2 * t - 1) ** 2));
    case "cone":
    case "flat-triangle":
      return Math.max(0.15, t);
    case "teardrop":
      // Pointed top, round bottom.
      return t < 0.6
        ? Math.max(0.02, Math.sin((Math.PI / 2) * (t / 0.6)))
        : Math.sqrt(Math.max(0.02, 1 - ((t - 0.6) / 0.4) ** 2));
    case "trumpet":
      // Bell flare at the top narrowing to a stem.
      return t < 0.35
        ? 1 - (t / 0.35) * 0.44
        : 0.56 - ((t - 0.35) / 0.65) * 0.16;
    default:
      return 1;
  }
}

/** Half-width (x) and half-depth (z) of a piece at height fraction `f`. */
export function halfExtent(s: AmigurumiShape, f: number) {
  const R = s.maxDiameterInches / 2;
  const r = R * profileRadius(s, f);
  const depth =
    s.type === "oval" ? (pieceHeight(s) / 2) * profileRadius(s, f) : r;
  return { x: r, z: isFlat(s) ? depth * FLAT_DEPTH : depth };
}

export function attachFraction(att: LimbAttachment, targetRounds: number) {
  if (att.position === "top") return 0;
  if (att.position === "bottom") return 1;
  return Math.min(0.9, Math.max(0.1, att.round / targetRounds));
}

/**
 * 3D layout in inches, Y up, viewer looking down -Z at the front.
 * Root pieces stack top to bottom in list order; pieces with an attachment
 * sit on their target: ears on top, arms on the sides, legs underneath,
 * snouts in front and tails behind. Pairs mirror left/right.
 */
export function layoutPieces(
  shapes: AmigurumiShape[],
  gauge: Gauge | null,
): Layout3D {
  const pieces: PiecePlacement[] = [];
  const roots = new Map<string, { shape: AmigurumiShape; cy: number }>();

  let top = 0;
  let prevH = 0;
  shapes.forEach((shape, index) => {
    if (shape.attachment) return;
    const h = pieceHeight(shape);
    if (roots.size > 0) top += STACK_OVERLAP * Math.min(h, prevH);
    const cy = top - h / 2;
    top -= h;
    prevH = h;
    roots.set(shape.id, { shape, cy });
    pieces.push({
      shape,
      index,
      position: [0, cy, 0],
      rotation: [0, 0, 0],
    });
  });

  const siblings = new Map<string, number>();
  shapes.forEach((shape, index) => {
    const att = shape.attachment;
    if (!att) return;
    const target = roots.get(att.targetPieceId);
    if (!target) return;
    const th = pieceHeight(target.shape);
    const ttop = target.cy + th / 2;
    const h = pieceHeight(shape);
    const targetRounds = roundsOf(target.shape, gauge);
    const frac = attachFraction(att, targetRounds);
    const key = `${att.targetPieceId}:${att.position}`;
    const seen = (siblings.get(key) ?? 0) + 1;
    siblings.set(key, seen);
    const pair = Math.floor((seen - 1) / 2);
    const side = seen % 2 === 1 ? -1 : 1;

    let point: Vec3;
    let rotation: Vec3;
    let dir: Vec3;
    switch (att.position) {
      case "side": {
        const ext = halfExtent(target.shape, frac);
        const rz = side === -1 ? ARM_ANGLE : -ARM_ANGLE;
        point = [side * ext.x * 0.92, ttop - frac * th - pair * h * 0.55, 0];
        rotation = [0, 0, rz];
        dir = [-Math.sin(rz), Math.cos(rz), 0];
        break;
      }
      case "top": {
        const f = 0.15;
        const ext = halfExtent(target.shape, f);
        const rz = -side * EAR_TILT;
        point = [side * ext.x * 0.75, ttop - f * th, -pair * h * 0.4];
        rotation = [0, 0, rz];
        dir = [-Math.sin(rz), Math.cos(rz), 0];
        break;
      }
      case "bottom": {
        const f = 0.9;
        const ext = halfExtent(target.shape, f);
        const spread =
          Math.max(ext.x, target.shape.maxDiameterInches / 4) * 0.6;
        point = [
          side * spread,
          ttop - f * th,
          -pair * shape.maxDiameterInches * 1.1,
        ];
        rotation = [0, 0, Math.PI];
        dir = [0, -1, 0];
        break;
      }
      case "front": {
        const ext = halfExtent(target.shape, frac);
        point = [0, ttop - frac * th - (seen - 1) * h * 0.3, ext.z * 0.9];
        rotation = [Math.PI / 2, 0, 0];
        dir = [0, 0, 1];
        break;
      }
      case "back": {
        const ext = halfExtent(target.shape, frac);
        const rx = -(Math.PI / 2 - TAIL_LIFT);
        point = [0, ttop - frac * th - (seen - 1) * h * 0.3, -ext.z * 0.9];
        rotation = [rx, 0, 0];
        dir = [0, Math.cos(rx), Math.sin(rx)];
        break;
      }
    }
    const reach = (h / 2) * (1 - EMBED);
    pieces.push({
      shape,
      index,
      position: [
        point[0] + dir[0] * reach,
        point[1] + dir[1] * reach,
        point[2] + dir[2] * reach,
      ],
      rotation,
    });
  });

  if (pieces.length === 0) return { pieces, center: [0, 0, 0], radius: 1 };
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces) {
    const r = Math.max(pieceHeight(p.shape), p.shape.maxDiameterInches) / 2;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p.position[i] - r);
      max[i] = Math.max(max[i], p.position[i] + r);
    }
  }
  const center: Vec3 = [0, 1, 2].map((i) => (min[i] + max[i]) / 2) as Vec3;
  const radius = Math.max(
    0.5,
    Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2,
  );
  return { pieces, center, radius };
}
