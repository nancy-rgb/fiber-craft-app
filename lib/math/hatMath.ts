import type {
  CalculatedInstruction,
  Gauge,
  HatInputs,
} from "@/lib/types/project";
import { assertPositive, assertValidGauge } from "./validation";

/** Negative ease per body style: snug hats subtract more from head circumference. */
const EASE_INCHES: Record<HatInputs["bodyStyle"], number> = {
  fitted: 2,
  standard: 1.5,
  slouchy: 1.5,
  balloon: 1.5,
};

/** Height to the top edge (not counting a folded brim's fold-over). */
const TOTAL_HEIGHT_INCHES: Record<HatBodyStyleKey, number> = {
  fitted: 7,
  standard: 8,
  slouchy: 9.5,
  balloon: 10,
};
type HatBodyStyleKey = HatInputs["bodyStyle"];

/** Ribbing/brim height in inches. "folded" doubles and the fold adds depth. */
const BRIM_INCHES: Record<HatInputs["brimStyle"], number> = {
  none: 0.5,
  single: 1.25,
  folded: 2.5,
};

export const HEAD_PRESETS = [
  { label: "Baby", inches: 14 },
  { label: "Child", inches: 18 },
  { label: "Adult S/M", inches: 21 },
  { label: "Adult L", inches: 23 },
];

/** Stitch multiple a ribbing type requires. Garter has no repeat constraint. */
export function ribbingMultiple(ribbing: HatInputs["ribbingType"]): number {
  switch (ribbing) {
    case "1x1":
      return 2;
    case "2x2":
      return 4;
    case "garter":
      return 1;
  }
}

/** Cast-on: head minus negative ease, in stitches, snapped to the ribbing multiple (rounding down keeps the fit snug). */
export function castOnStitches(inputs: HatInputs, gauge: Gauge): number {
  assertPositive(inputs.headCircumferenceInches, "headCircumferenceInches");
  assertValidGauge(gauge);
  const ease = EASE_INCHES[inputs.bodyStyle];
  const raw = (inputs.headCircumferenceInches - ease) * gauge.stitchesPerInch;
  const multiple = ribbingMultiple(inputs.ribbingType);
  return Math.max(multiple * 2, Math.floor(raw / multiple) * multiple);
}

export interface HatPlan {
  castOn: number;
  /** Stitch count at the widest point (balloon bumps +20% after the brim). */
  bodyStitches: number;
  brimRounds: number;
  bodyRounds: number;
  crownRounds: number;
  totalHeightInches: number;
}

/**
 * Dome decrease plan: `sections` k2tog wedges per decrease round, plain
 * rounds alternating, until ~2*sections stitches remain; a final k2tog
 * round finishes the top.
 */
export function domeDecreaseRounds(bodyStitches: number): {
  sections: number;
  /** [decreaseRound, plainRoundsAfter] pairs listed crown-down. */
  schedule: { stitches: number; plainAfter: number }[];
  finalStitches: number;
} {
  // Prefer 8 wedges, fall back to the largest divisor in {7..4}.
  let sections = 8;
  if (bodyStitches % 8 !== 0) {
    for (const c of [7, 6, 5, 4]) {
      if (bodyStitches % c === 0) {
        sections = c;
        break;
      }
    }
  }
  const schedule: { stitches: number; plainAfter: number }[] = [];
  let stitches = bodyStitches;
  // Stop when the next decrease round would leave fewer stitches than wedges.
  while (stitches - sections >= Math.max(sections, 8)) {
    stitches -= sections;
    // Plain rounds between decrease rounds: more when the wedge is wide.
    schedule.push({ stitches, plainAfter: 1 });
  }
  return { sections, schedule, finalStitches: stitches };
}

/** Long-tail: a decrease round every `interval` rounds until few sts remain. */
export function longTailDecreaseRounds(
  bodyStitches: number,
  intervalRounds: number,
): {
  everyRounds: number;
  removePerRound: number;
  decreaseCount: number;
  finalStitches: number;
} {
  const removePerRound = 8;
  const decreaseCount = Math.max(
    2,
    Math.floor((bodyStitches - 8) / removePerRound),
  );
  return {
    everyRounds: Math.max(4, Math.min(6, intervalRounds)),
    removePerRound,
    decreaseCount,
    finalStitches: bodyStitches - decreaseCount * removePerRound,
  };
}

/** Estimated crown rounds so the body length can be computed. */
export function crownRoundCount(
  inputs: HatInputs,
  bodyStitches: number,
  gauge: Gauge,
): number {
  const rpi = gauge.rowsPerInch;
  switch (inputs.crownStyle) {
    case "dome": {
      const { schedule } = domeDecreaseRounds(bodyStitches);
      return (
        schedule.reduce((sum, s) => sum + 1 + s.plainAfter, 0) + 1 // final k2tog round
      );
    }
    case "long-tail":
      return Math.round((inputs.tailLengthInches ?? 5) * rpi);
    case "square-cat-ear":
      return 0;
    case "cinch":
      return 0;
  }
}

function ribbingLabel(ribbing: HatInputs["ribbingType"]): string {
  switch (ribbing) {
    case "1x1":
      return "(k1, p1)";
    case "2x2":
      return "(k2, p2)";
    case "garter":
      return "garter in the round (k one round, p the next)";
  }
}
function brimInstructions(inputs: HatInputs, brimRounds: number): string {
  switch (inputs.brimStyle) {
    case "none":
      return `Work ${brimRounds} round${brimRounds === 1 ? "" : "s"} even to stop rolling (~0.5").`;
    case "single":
      return `Rib ${ribbingLabel(inputs.ribbingType)} for ${brimRounds} rounds (~1.25").`;
    case "folded":
      return `Rib ${ribbingLabel(inputs.ribbingType)} for ${brimRounds} rounds (~2.5"), then fold the brim up — this depth is doubled when worn.`;
  }
}

export function calculateHatPlan(inputs: HatInputs, gauge: Gauge): HatPlan {
  const castOn = castOnStitches(inputs, gauge);
  const bodyStitches =
    inputs.bodyStyle === "balloon" ? Math.ceil((castOn * 1.2) / 2) * 2 : castOn;
  const rpi = gauge.rowsPerInch;
  const brimRounds = Math.max(
    1,
    Math.round(BRIM_INCHES[inputs.brimStyle] * rpi),
  );
  const crownRounds = crownRoundCount(inputs, bodyStitches, gauge);
  const totalHeight = TOTAL_HEIGHT_INCHES[inputs.bodyStyle];
  const bodyRounds = Math.max(
    4,
    Math.round(totalHeight * rpi) - brimRounds - crownRounds,
  );
  return {
    castOn,
    bodyStitches,
    brimRounds,
    bodyRounds,
    crownRounds,
    totalHeightInches: totalHeight,
  };
}

function crownInstructions(
  inputs: HatInputs,
  plan: HatPlan,
  gauge: Gauge,
): CalculatedInstruction[] {
  const out: CalculatedInstruction[] = [];
  const push = (label: string, instructionText: string, stitchCount: number) =>
    out.push({
      stepNumber: out.length + 1,
      label,
      instructionText,
      stitchCount,
    });

  let stitches = plan.bodyStitches;
  switch (inputs.crownStyle) {
    case "dome": {
      const { sections, schedule } = domeDecreaseRounds(stitches);
      push(
        "Crown",
        `Set up ${sections} decrease wedges, spaced as evenly as possible (they don't have to be exact). Each decrease round works [k to 2 before marker, k2tog, sm] around and removes ${sections} sts.`,
        stitches,
      );
      schedule.forEach(({ stitches: next, plainAfter }, i) => {
        const total = next + sections;
        const wedge = Math.floor(total / sections) - 2;
        const remainder = total - sections * (wedge + 2);
        push(
          `Dec rnd ${i + 1}`,
          `[k${wedge}, k2tog, sm] x${sections}${remainder ? `, k${remainder}` : ""} (${next})`,
          next,
        );
        if (plainAfter > 0) {
          push(`Dec rnd ${i + 1} — plain`, `k around (${next})`, next);
        }
        stitches = next;
      });
      push(
        "Crown finish",
        `k2tog around (${Math.max(4, Math.ceil(stitches / 2))}), break yarn leaving a 10" tail, thread through the remaining sts and pull tight to close.`,
        Math.max(4, Math.ceil(stitches / 2)),
      );
      break;
    }
    case "long-tail": {
      // Pick an interval so the decrease rounds spread across the tail length.
      const est = Math.max(2, Math.floor((stitches - 8) / 8));
      const interval = Math.max(
        4,
        Math.min(
          6,
          Math.round(
            ((inputs.tailLengthInches ?? 5) * gauge.rowsPerInch) / est,
          ),
        ),
      );
      const d = longTailDecreaseRounds(stitches, interval);
      push(
        "Tail crown",
        `The tail tapers slowly: work a decrease round every ${d.everyRounds} rounds for ${d.decreaseCount} decreases, stretching the shaping across ~${inputs.tailLengthInches ?? 5}".`,
        stitches,
      );
      for (let i = 1; i <= d.decreaseCount; i++) {
        const next = stitches - d.removePerRound;
        for (let r = 1; r < d.everyRounds; r++) {
          push(`Tail ${i}.${r}`, `k around (${stitches})`, stitches);
        }
        push(
          `Tail dec ${i}`,
          `[k${Math.max(1, Math.floor(stitches / d.removePerRound) - 2)}, k2tog] x${d.removePerRound} (${next})`,
          next,
        );
        stitches = next;
      }
      push(
        "Tail finish",
        `Thread the yarn tail through the last ${stitches} sts, pull snug, and knot. Braid, tassel, or stuff the tail as you like.`,
        stitches,
      );
      break;
    }
    case "square-cat-ear": {
      push(
        "Knit straight",
        `Knit every round with no decreases until the tube measures ${plan.totalHeightInches}" from cast-on edge (${plan.bodyRounds} body rounds total).`,
        stitches,
      );
      push(
        "Flat top",
        `Lay the tube flat and graft the top edge closed (Kitchener stitch) or bind off through both layers (three-needle bind off): ${stitches / 2} sts on each side. The corners left at the fold become the cat ears.`,
        stitches,
      );
      push(
        "Ears",
        'Whiskers optional: tack each corner down ~0.5" for pointier ears, or leave them tall.',
        stitches,
      );
      break;
    }
    case "cinch": {
      push(
        "Knit straight",
        `Knit every round with no decreases until the hat measures ${plan.totalHeightInches}" from cast-on edge (${plan.bodyRounds} body rounds total).`,
        stitches,
      );
      push(
        "Cinch top",
        `Cut yarn leaving a 12" tail, thread it onto a tapestry needle and draw it through all ${stitches} live loops twice. Remove the needle, pull the tail tight to cinch the top closed, knot inside.`,
        stitches,
      );
      break;
    }
  }
  return out;
}

export function calculateHatPattern(
  inputs: HatInputs,
  gauge: Gauge,
): CalculatedInstruction[] {
  const plan = calculateHatPlan(inputs, gauge);
  const steps: CalculatedInstruction[] = [];
  const push = (label: string, text: string, stitchCount: number) =>
    steps.push({
      stepNumber: steps.length + 1,
      label,
      instructionText: text,
      stitchCount,
    });

  push(
    "Cast on",
    `Cast on ${plan.castOn} sts (long-tail or tubular cast-on recommended for stretch). Join to work in the round, pm for round start.`,
    plan.castOn,
  );
  push("Brim", brimInstructions(inputs, plan.brimRounds), plan.castOn);
  if (inputs.bodyStyle === "balloon") {
    const added = plan.bodyStitches - plan.castOn;
    push(
      "Balloon increase",
      `Increase round: [k2, m1] ~evenly, adding ${added} sts for the balloon silhouette (${plan.bodyStitches}).`,
      plan.bodyStitches,
    );
  }
  if (inputs.crownStyle === "square-cat-ear" || inputs.crownStyle === "cinch") {
    // These crowns knit straight to the top; the crown step carries the count.
    crownInstructions(inputs, plan, gauge).forEach((s) =>
      steps.push({ ...s, stepNumber: steps.length + 1 }),
    );
  } else {
    push(
      "Body",
      `Knit every round for ${plan.bodyRounds} rounds (~${(
        plan.bodyRounds / gauge.rowsPerInch
      ).toFixed(1)}"), until ${(
        plan.totalHeightInches -
        (inputs.crownStyle === "long-tail"
          ? (inputs.tailLengthInches ?? 5)
          : plan.crownRounds / gauge.rowsPerInch)
      ).toFixed(1)}" from the brim edge.`,
      plan.bodyStitches,
    );
    crownInstructions(inputs, plan, gauge).forEach((s) =>
      steps.push({ ...s, stepNumber: steps.length + 1 }),
    );
  }
  push(
    "Finish",
    "Weave in ends. Wet-block gently — a balloon or slouchy body likes a bowl of steam to set its shape.",
    plan.bodyStitches,
  );
  return steps;
}
