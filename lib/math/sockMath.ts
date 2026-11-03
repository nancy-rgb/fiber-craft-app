import type {
  CalculatedInstruction,
  Gauge,
  SockInputs,
} from "@/lib/types/project";
import { assertPositive, assertValidGauge, formatInches } from "./validation";

/** Foot length left unknit before the toe decreases begin. */
export const TOE_ALLOWANCE_INCHES = 2;
export const DEFAULT_NEGATIVE_EASE_PERCENT = 10;
/** Smallest cast-on whose heel turn still has stitches on both sides of the center. */
export const MIN_CAST_ON = 24;
/** Ribbing at the top of the leg; shorter cuffs are ribbed all the way. */
const MAX_RIB_INCHES = 1.5;

export const CUFF_PRESETS = [
  { label: "Ankle", inches: 1 },
  { label: "Mid", inches: 3.5 },
  { label: "Crew", inches: 6 },
  { label: "Tall", inches: 8 },
];

export const FOOT_CIRCUMFERENCE_PRESETS = [
  { label: "Child", inches: 6.5 },
  { label: "Women", inches: 8.5 },
  { label: "Men", inches: 9.5 },
];

export type ShoeSizeSystem = "women" | "men";

/** US shoe size → foot length in inches (Brannock scale), to the nearest 1/4". */
export function shoeSizeToFootLength(
  size: number,
  system: ShoeSizeSystem,
): number {
  assertPositive(size, "size");
  const offset = system === "men" ? 22 : 20.5;
  return Math.round(((size + offset) / 3) * 4) / 4;
}

export const SHOE_SIZES: Record<ShoeSizeSystem, number[]> = {
  women: [5, 6, 7, 8, 9, 10, 11, 12],
  men: [6, 7, 8, 9, 10, 11, 12, 13, 14],
};

/** Foot circumference minus negative ease, in stitches, rounded to the nearest multiple of 4. */
export function sockCastOn(inputs: SockInputs, gauge: Gauge): number {
  assertPositive(inputs.footCircumferenceInches, "footCircumferenceInches");
  assertValidGauge(gauge);
  const ease = inputs.negativeEasePercent / 100;
  if (!Number.isFinite(ease) || ease < 0 || ease >= 1) {
    throw new RangeError(
      `negativeEasePercent must be 0–99 (got ${inputs.negativeEasePercent})`,
    );
  }
  const raw =
    inputs.footCircumferenceInches * (1 - ease) * gauge.stitchesPerInch;
  return Math.max(MIN_CAST_ON, Math.round(raw / 4) * 4);
}

export interface HeelTurnRow {
  row: number;
  side: "RS" | "WS";
  text: string;
  /** Stitches on the heel needle after this row. */
  stitches: number;
}

/**
 * French (round) heel turn over `heelStitches`: work past center, decrease
 * across the gap and turn; each later row slips the first st, works to 1
 * before the gap, closes it with a decrease, works 1 more and turns. Rows
 * continue until no unworked stitches remain on either side.
 */
export function heelTurnRows(heelStitches: number): HeelTurnRow[] {
  if (!Number.isInteger(heelStitches) || heelStitches < MIN_CAST_ON / 2) {
    throw new RangeError(
      `heelStitches must be an integer ≥ ${MIN_CAST_ON / 2} (got ${heelStitches})`,
    );
  }
  const half = heelStitches / 2;
  const rows: HeelTurnRow[] = [];
  let stitches = heelStitches - 1;
  // Row 1 leaves half - 4 unworked on the left; row 2's turn mirrors that on the right.
  const unworked = { RS: Math.floor(half) - 4, WS: Math.ceil(half) - 4 };
  rows.push({
    row: 1,
    side: "RS",
    text: `sl1, k${Math.ceil(half)}, ssk, k1, turn (${unworked.RS} sts left unworked)`,
    stitches,
  });
  // Stitches between the gaps once row 1 is turned: k1 + ssk + 5 knit sts.
  let center = 7;
  let side: "RS" | "WS" = "WS";
  while (unworked[side] > 0) {
    const [work, dec] = side === "RS" ? ["k", "ssk"] : ["p", "p2tog"];
    const closesWithExtra = unworked[side] >= 2;
    unworked[side] -= closesWithExtra ? 2 : 1;
    stitches -= 1;
    rows.push({
      row: rows.length + 1,
      side,
      text: `sl1, ${work}${center - 2}, ${dec}${closesWithExtra ? `, ${work}1` : ""}, turn`,
      stitches,
    });
    center += closesWithExtra ? 1 : 0;
    side = side === "RS" ? "WS" : "RS";
  }
  return rows;
}

export interface SockPlan {
  castOn: number;
  legRibRounds: number;
  legPlainRounds: number;
  heelFlapStitches: number;
  instepStitches: number;
  /** Flap rows; slipped edge sts give one pickup per 2 rows. */
  heelFlapRows: number;
  heelTurn: HeelTurnRow[];
  heelTurnStitches: number;
  gussetPickupPerSide: number;
  stitchesAfterPickup: number;
  /** Decrease rounds (2 sts each, alternating with plain rounds) back to the cast-on. */
  gussetDecreaseRounds: number;
  /** True when the last gusset round removes only one stitch to land on the cast-on. */
  gussetOddFinish: boolean;
  footLengthBeforeToeInches: number;
  footPlainRounds: number;
  /** Toe stitch counts after each every-other-round decrease. */
  toeEveryOtherRound: number[];
  /** Toe stitch counts after each every-round decrease. */
  toeEveryRound: number[];
  finalToeStitches: number;
}

/** Stitches left for Kitchener: 20 for wide socks, 16 otherwise. */
export function toeTargetStitches(castOn: number): number {
  return castOn >= 64 ? 20 : 16;
}

/** 4 wedge decreases per round: every other round down to half, then every round to the target. */
export function toeDecreases(castOn: number): {
  everyOther: number[];
  everyRound: number[];
  final: number;
} {
  const target = toeTargetStitches(castOn);
  const everyOther: number[] = [];
  const everyRound: number[] = [];
  let sts = castOn;
  while (sts - 4 >= castOn / 2 && sts - 4 >= target) {
    sts -= 4;
    everyOther.push(sts);
  }
  while (sts - 4 >= target) {
    sts -= 4;
    everyRound.push(sts);
  }
  return { everyOther, everyRound, final: sts };
}

export function calculateSockPlan(inputs: SockInputs, gauge: Gauge): SockPlan {
  assertPositive(inputs.footLengthInches, "footLengthInches");
  assertPositive(inputs.cuffLengthInches, "cuffLengthInches");
  const castOn = sockCastOn(inputs, gauge);
  const rpi = gauge.rowsPerInch;

  const legRounds = Math.max(1, Math.round(inputs.cuffLengthInches * rpi));
  const legRibRounds = Math.min(
    legRounds,
    Math.max(1, Math.round(MAX_RIB_INCHES * rpi)),
  );

  const heelFlapStitches = castOn / 2;
  const instepStitches = castOn - heelFlapStitches;
  const heelFlapRows = heelFlapStitches;
  const heelTurn = heelTurnRows(heelFlapStitches);
  const heelTurnStitches = heelTurn[heelTurn.length - 1].stitches;

  const gussetPickupPerSide = heelFlapRows / 2;
  const stitchesAfterPickup =
    heelTurnStitches + 2 * gussetPickupPerSide + instepStitches;
  const extra = stitchesAfterPickup - castOn;
  const gussetDecreaseRounds = Math.ceil(extra / 2);

  const footLengthBeforeToeInches = Math.max(
    0,
    inputs.footLengthInches - TOE_ALLOWANCE_INCHES,
  );
  // Gusset rounds (each decrease + its plain round) count toward the foot.
  const footPlainRounds = Math.max(
    0,
    Math.round(footLengthBeforeToeInches * rpi) - gussetDecreaseRounds * 2,
  );

  const toe = toeDecreases(castOn);
  return {
    castOn,
    legRibRounds,
    legPlainRounds: legRounds - legRibRounds,
    heelFlapStitches,
    instepStitches,
    heelFlapRows,
    heelTurn,
    heelTurnStitches,
    gussetPickupPerSide,
    stitchesAfterPickup,
    gussetDecreaseRounds,
    gussetOddFinish: extra % 2 === 1,
    footLengthBeforeToeInches,
    footPlainRounds,
    toeEveryOtherRound: toe.everyOther,
    toeEveryRound: toe.everyRound,
    finalToeStitches: toe.final,
  };
}

export function calculateSockPattern(
  inputs: SockInputs,
  gauge: Gauge,
): CalculatedInstruction[] {
  const plan = calculateSockPlan(inputs, gauge);
  const steps: CalculatedInstruction[] = [];
  const push = (label: string, instructionText: string, stitchCount: number) =>
    steps.push({
      stepNumber: steps.length + 1,
      label,
      instructionText,
      stitchCount,
    });
  const rounds = (n: number) => `${n} round${n === 1 ? "" : "s"}`;
  const { castOn, heelFlapStitches: heel, instepStitches: instep } = plan;

  push(
    "Cast on",
    `Cast on ${castOn} sts loosely (long-tail or German twisted so the cuff stretches over the heel). Join to work in the round, pm for start of round.`,
    castOn,
  );
  push(
    "Cuff",
    `Rib (k2, p2) for ${rounds(plan.legRibRounds)} (~${formatInches(plan.legRibRounds / gauge.rowsPerInch)}).`,
    castOn,
  );
  if (plan.legPlainRounds > 0) {
    push(
      "Leg",
      `Knit ${rounds(plan.legPlainRounds)}, until the leg measures ${formatInches(inputs.cuffLengthInches)} from the cast-on edge.`,
      castOn,
    );
  }

  push(
    "Heel flap",
    `Work back and forth over the first ${heel} sts only; leave the other ${instep} instep sts on hold. Row 1 (RS): [sl1, k1] to end. Row 2 (WS): sl1, p to end. Repeat these 2 rows ${plan.heelFlapRows / 2} times (${plan.heelFlapRows} rows), ending after a WS row — ${plan.gussetPickupPerSide} slipped sts along each edge.`,
    heel,
  );

  plan.heelTurn.forEach((r) =>
    push(
      `Heel turn row ${r.row} (${r.side})`,
      `${r.text} (${r.stitches} heel sts)`,
      r.stitches,
    ),
  );

  push(
    "Gusset pick-up",
    `Knit across the ${plan.heelTurnStitches} heel sts. Pick up and knit ${plan.gussetPickupPerSide} sts along the flap edge (one in each slipped st), knit across the ${instep} instep sts, then pick up and knit ${plan.gussetPickupPerSide} sts along the other flap edge. Knit to the start of the instep — this is the new start of round (${plan.stitchesAfterPickup}).`,
    plan.stitchesAfterPickup,
  );

  let sts = plan.stitchesAfterPickup;
  for (let i = 1; i <= plan.gussetDecreaseRounds; i++) {
    const single = plan.gussetOddFinish && i === plan.gussetDecreaseRounds;
    sts -= single ? 1 : 2;
    push(
      `Gusset dec ${i}`,
      single
        ? `k${instep} instep, k to last 3 sole sts, k2tog, k1 (${sts})`
        : `k${instep} instep; sole: k1, ssk, k to last 3, k2tog, k1 (${sts})`,
      sts,
    );
    push(`Gusset dec ${i} — plain`, `k around (${sts})`, sts);
  }

  push(
    "Foot",
    `Knit even for about ${rounds(plan.footPlainRounds)}, until the foot measures ${formatInches(plan.footLengthBeforeToeInches)} from the back of the heel — ${formatInches(TOE_ALLOWANCE_INCHES)} shorter than the full ${formatInches(inputs.footLengthInches)} foot. Try it on: the cast-on edge of the toe should reach the base of the little toe.`,
    castOn,
  );

  const wedge = `instep: k1, ssk, k to last 3, k2tog, k1; sole: k1, ssk, k to last 3, k2tog, k1`;
  push(
    "Toe",
    `The toe decreases 4 sts per decrease round at the sides of the foot (${instep} instep sts / ${castOn - instep} sole sts).`,
    castOn,
  );
  plan.toeEveryOtherRound.forEach((n, i) => {
    push(`Toe dec ${i + 1}`, `${wedge} (${n})`, n);
    push(`Toe dec ${i + 1} — plain`, `k around (${n})`, n);
  });
  const offset = plan.toeEveryOtherRound.length;
  plan.toeEveryRound.forEach((n, i) =>
    push(`Toe dec ${offset + i + 1}`, `${wedge} — every round now (${n})`, n),
  );

  push(
    "Kitchener",
    `Knit across the instep so the yarn is at the side. ${plan.finalToeStitches / 2} sts on each needle: break yarn leaving a 12" tail and graft the toe closed with Kitchener stitch. Weave in ends and make the second sock.`,
    plan.finalToeStitches,
  );
  return steps;
}
