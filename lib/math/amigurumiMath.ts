import type {
  AmigurumiShape,
  CalculatedInstruction,
  Gauge,
  SafetyEyePlacement,
  StripeSegment,
} from "@/lib/types/project";
import { assertPositive, assertValidGauge } from "./validation";

export type SpiralRoundKind = "start" | "increase" | "straight" | "decrease";

export interface SpiralRound {
  kind: SpiralRoundKind;
  stitches: number;
}

/** Widest round's stitch count: circumference in stitches, snapped to a multiple of 6. */
export function maxStitchesForDiameter(
  diameterInches: number,
  gauge: Gauge,
): number {
  assertPositive(diameterInches, "maxDiameterInches");
  assertValidGauge(gauge);
  const circumference = Math.PI * diameterInches * gauge.stitchesPerInch;
  return Math.max(6, Math.round(circumference / 6) * 6);
}

/**
 * Round-by-round stitch counts. Every shape starts with a 6 sc magic ring,
 * grows by 6 sts per increase round to its widest round, works straight
 * rounds, then closes with mirrored 6-st decrease rounds back to 6.
 * - sphere: increases back-to-back; straight rounds fill the half-meridian arc.
 * - cylinder: flat base, straight rounds for the height, flat top.
 * - cone: increases spread evenly along the slant from the tip; flat base.
 */
export function planSpiralRounds(
  shape: AmigurumiShape,
  gauge: Gauge,
): SpiralRound[] {
  const maxStitches = maxStitchesForDiameter(shape.maxDiameterInches, gauge);
  const height =
    shape.type === "sphere" && !(shape.heightInches > 0)
      ? shape.maxDiameterInches
      : shape.heightInches;
  assertPositive(height, "heightInches");

  const rpi = gauge.rowsPerInch;
  const increaseRounds = maxStitches / 6;
  const rounds: SpiralRound[] = [{ kind: "start", stitches: 6 }];

  if (shape.type === "cone") {
    const slant = Math.hypot(height, shape.maxDiameterInches / 2);
    const growthRounds = Math.max(increaseRounds, Math.round(slant * rpi));
    const span = growthRounds - 1;
    const increasesNeeded = increaseRounds - 1;
    let stitches = 6;
    for (let j = 1; j <= span; j++) {
      const due =
        Math.floor((j * increasesNeeded) / span) >
        Math.floor(((j - 1) * increasesNeeded) / span);
      if (due) stitches += 6;
      rounds.push({ kind: due ? "increase" : "straight", stitches });
    }
  } else {
    for (let k = 2; k <= increaseRounds; k++) {
      rounds.push({ kind: "increase", stitches: 6 * k });
    }
    const shapedRounds = 2 * increaseRounds - 1;
    const straightRounds =
      shape.type === "sphere"
        ? Math.max(0, Math.round(((Math.PI * height) / 2) * rpi) - shapedRounds)
        : shape.type === "teardrop"
          ? // Pointed ends with a fuller midsection than a sphere.
            Math.max(0, Math.round(height * rpi))
          : Math.max(0, Math.round(height * rpi));
    for (let i = 0; i < straightRounds; i++) {
      rounds.push({ kind: "straight", stitches: maxStitches });
    }
  }

  for (let k = increaseRounds - 1; k >= 1; k--) {
    rounds.push({ kind: "decrease", stitches: 6 * k });
  }
  return rounds;
}

function roundText(round: SpiralRound, previous: number): string {
  const { kind, stitches } = round;
  switch (kind) {
    case "start":
      return `Magic ring, 6 sc into ring (${stitches})`;
    case "straight":
      return `sc in each st around (${stitches})`;
    case "increase": {
      const between = previous / 6 - 1;
      return between === 0
        ? `inc in each st around (${stitches})`
        : `[sc ${between}, inc] x6 (${stitches})`;
    }
    case "decrease": {
      const between = previous / 6 - 2;
      return between === 0
        ? `dec around (${stitches})`
        : `[sc ${between}, dec] x6 (${stitches})`;
    }
  }
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(n)));

/** Rounds whose first stitch is a plain sc can start with a jogless sl st. */
function startsWithSc(round: SpiralRound, previous: number): boolean {
  switch (round.kind) {
    case "start":
      return false;
    case "straight":
      return true;
    case "increase":
      return previous / 6 - 1 > 0;
    case "decrease":
      return previous / 6 - 2 > 0;
  }
}

function usableStripes(stripes: StripeSegment[] | null | undefined) {
  return (stripes ?? [])
    .filter((s) => s.rounds >= 1)
    .map((s) => ({ ...s, rounds: Math.floor(s.rounds) }));
}

/** Stripe for a 1-based round; the sequence repeats from Rnd 1. */
export function stripeForRound(
  stripes: StripeSegment[],
  roundNumber: number,
): StripeSegment {
  const cycle = stripes.reduce((sum, s) => sum + s.rounds, 0);
  let offset = (roundNumber - 1) % cycle;
  for (const stripe of stripes) {
    if (offset < stripe.rounds) return stripe;
    offset -= stripe.rounds;
  }
  return stripes[stripes.length - 1];
}

const sameYarn = (a: StripeSegment, b: StripeSegment) =>
  a.colorName === b.colorName && a.hex.toLowerCase() === b.hex.toLowerCase();

export interface EyePositions {
  round: number;
  roundStitches: number;
  /** Front-center stitch, opposite a round start kept at center back. */
  center: number;
  first: number;
  second: number;
  sizeMm: number;
}

/** Clamps eye inputs to the piece and centers the pair on the front. */
export function placeEyes(
  eyes: SafetyEyePlacement,
  rounds: SpiralRound[],
): EyePositions {
  const round = clamp(eyes.eyePlacementRound, 1, rounds.length);
  const roundStitches = rounds[round - 1].stitches;
  const distance = clamp(
    eyes.eyeDistanceStitches,
    1,
    Math.max(1, roundStitches - 2),
  );
  const center = roundStitches / 2;
  const first = center - Math.floor(distance / 2);
  return {
    round,
    roundStitches,
    center,
    first,
    second: first + distance,
    sizeMm: eyes.eyeSizeMm > 0 ? eyes.eyeSizeMm : 9,
  };
}

type Step = Omit<CalculatedInstruction, "stepNumber">;

function faceSteps(
  shape: AmigurumiShape,
  eyes: EyePositions,
  rounds: SpiralRound[],
  stitchCount: number,
): Step[] {
  const rnd = (offset: number) => Math.min(rounds.length, eyes.round + offset);
  const { first, second, center } = eyes;
  const steps: Step[] = [
    {
      label: "Eyes",
      instructionText: `Push ${eyes.sizeMm} mm safety eyes through the markers on Rnd ${eyes.round} (sts ${first} and ${second}). Check the spacing, then snap the washers on from the inside before stuffing.`,
      stitchCount,
    },
  ];
  const features = shape.facialFeatures ?? [];
  if (features.includes("nose")) {
    steps.push({
      label: "Nose",
      instructionText: `Embroider the nose over sts ${center - 1}–${center + 1} on Rnd ${rnd(1)}, centered between the eyes.`,
      stitchCount,
    });
  }
  if (features.includes("mouth")) {
    steps.push({
      label: "Mouth",
      instructionText: `Embroider a small V mouth centered on st ${center}, from Rnd ${rnd(2)} to Rnd ${rnd(3)}.`,
      stitchCount,
    });
  }
  if (features.includes("cheeks")) {
    steps.push({
      label: "Cheeks",
      instructionText: `Add blush or pink stitches on Rnd ${rnd(1)}, just outside each eye (around st ${Math.max(1, first - 2)} and st ${Math.min(eyes.roundStitches, second + 2)}).`,
      stitchCount,
    });
  }
  return steps;
}

export function calculateSpiralShape(
  shape: AmigurumiShape,
  gauge: Gauge,
): CalculatedInstruction[] {
  const rounds = planSpiralRounds(shape, gauge);
  const stripes = usableStripes(shape.stripes);
  const colorAt = (n: number) =>
    stripes.length > 0 ? stripeForRound(stripes, n) : null;
  const eyes = shape.eyes ? placeEyes(shape.eyes, rounds) : null;
  const firstDecrease = rounds.findIndex((r) => r.kind === "decrease");
  // Eyes go in after their round is worked but before the opening closes.
  const insertEyesAfter = eyes
    ? Math.max(eyes.round, firstDecrease === -1 ? rounds.length : firstDecrease)
    : -1;

  const steps: Step[] = [];
  rounds.forEach((round, i) => {
    const n = i + 1;
    const previous = i > 0 ? rounds[i - 1].stitches : 0;
    let text = roundText(round, previous);
    const color = colorAt(n);
    if (color) {
      const before = n > 1 ? colorAt(n - 1) : null;
      if (!before) {
        text = `With ${color.colorName}: ${text}`;
      } else if (!sameYarn(before, color)) {
        text = `Switch to ${color.colorName}: ${text}. Jogless: ${
          startsWithSc(round, previous)
            ? "sl st in the first st instead of sc (it counts as a st; work into it normally next round)"
            : "tug the old color's tail snug after the first st"
        }`;
      }
      const after = n < rounds.length ? colorAt(n + 1) : null;
      if (after && !sameYarn(color, after)) {
        text += `. Finish the last st with ${after.colorName} (pull it through the final 2 loops)`;
      }
    }
    steps.push({
      label: `Rnd ${n}`,
      instructionText: text,
      stitchCount: round.stitches,
      ...(color && { yarnColor: { name: color.colorName, hex: color.hex } }),
    });

    if (eyes && n === eyes.round && n !== insertEyesAfter) {
      steps.push({
        label: "Eye markers",
        instructionText: `Mark the eye spots on Rnd ${n} (${round.stitches} sts): markers in st ${eyes.first} and st ${eyes.second}, ${eyes.second - eyes.first} sts apart, centered on st ${eyes.center} at the front (opposite the round start).`,
        stitchCount: round.stitches,
      });
    }
    if (eyes && n === insertEyesAfter) {
      steps.push(...faceSteps(shape, eyes, rounds, round.stitches));
    }
  });

  steps.push({
    label: "Finish",
    instructionText: shape.attachment
      ? "Stuff lightly (small limbs can stay unstuffed). Fasten off, leaving a long tail for sewing; leave the end open."
      : "Stuff firmly before the opening gets small. Fasten off and weave the tail through the front loops of the last 6 sts; pull closed.",
    stitchCount: rounds[rounds.length - 1].stitches,
  });
  return steps.map((step, i) => ({ ...step, stepNumber: i + 1 }));
}

const openFinish = (shape: AmigurumiShape) =>
  shape.attachment
    ? "Stuff lightly (small limbs can stay unstuffed). Fasten off, leaving a long tail for sewing; leave the end open."
    : "Stuff firmly before the opening gets small. Fasten off and weave the tail through the front loops of the last 6 sts; pull closed.";

/**
 * Oval worked around a foundation chain: 3-sc end caps grow the piece while
 * the two long sides stay straight — the classic snout/paw/sole shape.
 */
export function calculateOvalShape(
  shape: AmigurumiShape,
  gauge: Gauge,
): CalculatedInstruction[] {
  assertValidGauge(gauge);
  const maxStitches = maxStitchesForDiameter(shape.maxDiameterInches, gauge);
  const chain = clamp(
    shape.chainLength ??
      Math.round(shape.maxDiameterInches * gauge.stitchesPerInch * 0.5),
    4,
    48,
  );

  const steps: Step[] = [];
  let stitches = 2 * chain + 4;
  steps.push({
    label: "Rnd 1",
    instructionText: `Ch ${chain + 1}. Sc in the 2nd ch from hook and the next ${chain - 1} chs, 3 sc in the last ch; rotate and work down the free loops of the chain: sc ${chain - 1}, inc in the last st (${stitches})`,
    stitchCount: stitches,
  });

  let n = 1;
  while (stitches + 6 <= maxStitches) {
    n += 1;
    const half = (stitches - 6) / 2;
    stitches += 6;
    steps.push({
      label: `Rnd ${n}`,
      instructionText: `sc ${half}, inc in each of the next 3 sts, sc ${half}, inc in each of the last 3 sts (${stitches})`,
      stitchCount: stitches,
    });
  }

  const straightRounds = Math.max(
    1,
    Math.round(shape.heightInches * gauge.rowsPerInch) - n,
  );
  for (let i = 0; i < straightRounds; i++) {
    n += 1;
    steps.push({
      label: `Rnd ${n}`,
      instructionText: `sc in each st around (${stitches})`,
      stitchCount: stitches,
    });
  }

  steps.push({
    label: "Finish",
    instructionText: shape.attachment
      ? openFinish(shape)
      : "Sl st to the first st. Fasten off, leaving a long tail; stuff lightly and whipstitch the opening closed, or leave flat for soles and snouts.",
    stitchCount: stitches,
  });
  return steps.map((step, i) => ({ ...step, stepNumber: i + 1 }));
}

const CURVE_EVERY = { slight: 4, medium: 3, sharp: 2 } as const;

/**
 * Curved tail/horn: a tube that bends because increase and decrease pairs in
 * the same round cancel out stitch-wise but pull the fabric to one side.
 */
export function calculateCurvedTube(
  shape: AmigurumiShape,
  gauge: Gauge,
): CalculatedInstruction[] {
  const every = CURVE_EVERY[shape.curvatureIntensity ?? "medium"];
  const rounds = planSpiralRounds({ ...shape, type: "cylinder" }, gauge);
  const steps: Step[] = [];
  const maxStitches = rounds[rounds.length - 1]?.stitches ?? 6;
  // Cylinder plan: start + increases + straight + decreases. The body
  // (straight) rounds get the bend; keep the tapered tip rounds plain.
  const firstDecrease = rounds.findIndex((r) => r.kind === "decrease");
  const bodyEnd = firstDecrease === -1 ? rounds.length : firstDecrease;
  const quarter = maxStitches / 4;

  rounds.forEach((round, i) => {
    const n = i + 1;
    const previous = i > 0 ? rounds[i - 1].stitches : 0;
    const bodyIndex = i - (rounds.length - bodyEnd) + 1;
    const isCurveRound =
      i > 0 &&
      i < bodyEnd &&
      round.kind === "straight" &&
      bodyIndex % every === 0;
    const instructionText = isCurveRound
      ? `Curve round: [sc ${quarter - 2}, inc] x2 across the front, sc ${maxStitches / 2 - 4}, [dec, sc ${quarter - 2}] x2 across the back — the front grows, the back pulls in (${round.stitches})`
      : roundText(round, previous);
    steps.push({
      label: `Rnd ${n}`,
      instructionText,
      stitchCount: round.stitches,
    });
  });

  steps.push({
    label: "Finish",
    instructionText: openFinish(shape),
    stitchCount: 6,
  });
  return steps.map((step, i) => ({ ...step, stepNumber: i + 1 }));
}

/**
 * Flat ear/fin worked in turned rows: decreases at both row edges taper the
 * strip to a point (cat and fox ears).
 */
export function calculateFlatTriangle(
  shape: AmigurumiShape,
  gauge: Gauge,
): CalculatedInstruction[] {
  assertValidGauge(gauge);
  let stitches = Math.max(
    8,
    Math.round((shape.maxDiameterInches * gauge.stitchesPerInch) / 2) * 2,
  );
  const steps: Step[] = [
    {
      label: "Row 1",
      instructionText: `Ch ${stitches + 1}, sc in the 2nd ch from hook and each ch across (${stitches})`,
      stitchCount: stitches,
    },
  ];
  let n = 1;
  while (stitches > 4) {
    n += 1;
    const middle = Math.max(0, stitches - 4);
    stitches -= 2;
    steps.push({
      label: `Row ${n}`,
      instructionText:
        middle === 0
          ? `Ch 1, turn. Dec twice (${stitches})`
          : `Ch 1, turn. Dec, sc ${middle}, dec (${stitches})`,
      stitchCount: stitches,
    });
  }
  steps.push({
    label: "Finish",
    instructionText: `Ch 1, turn. Dec over the last ${stitches} sts (1). Fasten off leaving a long tail for sewing. For a sturdier ear, make a second triangle and single crochet the two together around the edges.`,
    stitchCount: 1,
  });
  return steps.map((step, i) => ({ ...step, stepNumber: i + 1 }));
}

/**
 * Trumpet: a slim tube that suddenly flares into a bell — flowers, horns,
 * trumpet mushroom caps. Body ~60% of the rim diameter, then two burst
 * increase rounds open it up.
 */
export function calculateTrumpetShape(
  shape: AmigurumiShape,
  gauge: Gauge,
): CalculatedInstruction[] {
  const rimStitches = maxStitchesForDiameter(shape.maxDiameterInches, gauge);
  const bodyStitches = maxStitchesForDiameter(
    shape.maxDiameterInches * 0.6,
    gauge,
  );
  const steps: Step[] = [
    {
      label: "Rnd 1",
      instructionText: "Magic ring, 6 sc into ring (6)",
      stitchCount: 6,
    },
  ];
  let stitches = 6;
  let n = 1;
  while (stitches < bodyStitches) {
    n += 1;
    const between = stitches / 6 - 1;
    stitches += 6;
    steps.push({
      label: `Rnd ${n}`,
      instructionText:
        between === 0
          ? `inc in each st around (${stitches})`
          : `[sc ${between}, inc] x6 (${stitches})`,
      stitchCount: stitches,
    });
  }
  const bodyRounds = Math.max(
    1,
    Math.round(shape.heightInches * 0.75 * gauge.rowsPerInch),
  );
  for (let i = 0; i < bodyRounds; i++) {
    n += 1;
    steps.push({
      label: `Rnd ${n}`,
      instructionText: `sc in each st around (${stitches})`,
      stitchCount: stitches,
    });
  }
  // Rapid flare: double, then fill to the rim circumference.
  n += 1;
  stitches = Math.min(rimStitches, stitches * 2);
  steps.push({
    label: `Rnd ${n}`,
    instructionText: `Flare: inc in each st around (${stitches})`,
    stitchCount: stitches,
  });
  if (stitches < rimStitches) {
    n += 1;
    const add = rimStitches - stitches;
    stitches = rimStitches;
    steps.push({
      label: `Rnd ${n}`,
      instructionText: `Flare: [sc ${Math.max(1, Math.floor(stitches / add) - 1)}, inc] x${add} (${stitches})`,
      stitchCount: stitches,
    });
  }
  steps.push({
    label: "Finish",
    instructionText: shape.attachment
      ? "Sl st loosely in each st around for a crisp bell edge; keep it loose so the rim stays open. Fasten off leaving a long tail for sewing."
      : "Sl st loosely in each st around for a crisp bell edge; keep it loose so the rim stays open. Fasten off and weave in the end.",
    stitchCount: stitches,
  });
  return steps.map((step, i) => ({ ...step, stepNumber: i + 1 }));
}

/** Per-piece instruction calculator: dispatches on the shape type. */
export function calculateAmigurumiShape(
  shape: AmigurumiShape,
  gauge: Gauge,
): CalculatedInstruction[] {
  switch (shape.type) {
    case "oval":
      return calculateOvalShape(shape, gauge);
    case "curved-tube":
      return calculateCurvedTube(shape, gauge);
    case "flat-triangle":
      return calculateFlatTriangle(shape, gauge);
    case "trumpet":
      return calculateTrumpetShape(shape, gauge);
    default:
      return calculateSpiralShape(shape, gauge);
  }
}

/**
 * Sewing steps for pieces attached to other pieces. Stitch positions count
 * from a round start kept at center back. Side pieces on the same target
 * alternate between opposite sides.
 */
export function calculateAssembly(
  shapes: AmigurumiShape[],
  gauge: Gauge,
  nameOf: (shape: AmigurumiShape, index: number) => string = (s) => s.name,
): CalculatedInstruction[] {
  const sideCounts = new Map<string, number>();
  const steps: Step[] = [];
  shapes.forEach((shape, index) => {
    const attachment = shape.attachment;
    if (!attachment || attachment.targetPieceId === shape.id) return;
    const targetIndex = shapes.findIndex(
      (s) => s.id === attachment.targetPieceId,
    );
    if (targetIndex === -1) return;
    const target = shapes[targetIndex];
    const name = nameOf(shape, index);
    const targetName = nameOf(target, targetIndex);
    const rounds = planSpiralRounds(target, gauge);
    const round = clamp(attachment.round, 1, rounds.length);
    const sts = rounds[round - 1].stitches;
    let where: string;
    switch (attachment.position) {
      case "top":
        where = `centered over the magic ring of ${targetName} (Rnd 1)`;
        break;
      case "bottom":
        where = `centered on the last round of ${targetName} (Rnd ${rounds.length})`;
        break;
      case "front":
        where = `on the front of ${targetName}, Rnd ${round} (${sts} sts), centered on st ${sts / 2}`;
        break;
      case "back":
        where = `on the back of ${targetName}, Rnd ${round} (${sts} sts), centered on st 1 (the round start)`;
        break;
      case "side": {
        const key = `${target.id}:${round}`;
        const count = sideCounts.get(key) ?? 0;
        sideCounts.set(key, count + 1);
        const st = count % 2 === 0 ? sts / 4 : (3 * sts) / 4;
        const other = count % 2 === 0 ? (3 * sts) / 4 : sts / 4;
        where = `on the side of ${targetName}, Rnd ${round} (${sts} sts), centered on st ${st} (the opposite side is st ${other})`;
        break;
      }
    }
    steps.push({
      label: `Attach ${name}`,
      instructionText: `Pin ${name} ${where}. Sew around its open edge with the yarn tail.`,
      stitchCount: sts,
    });
  });
  return steps.map((step, i) => ({ ...step, stepNumber: i + 1 }));
}
