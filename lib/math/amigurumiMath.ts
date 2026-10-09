import type {
  AmigurumiShape,
  CalculatedInstruction,
  Gauge,
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

export function calculateSpiralShape(
  shape: AmigurumiShape,
  gauge: Gauge,
): CalculatedInstruction[] {
  const rounds = planSpiralRounds(shape, gauge);
  const instructions: CalculatedInstruction[] = rounds.map((round, i) => ({
    stepNumber: i + 1,
    label: `Rnd ${i + 1}`,
    instructionText: roundText(round, i > 0 ? rounds[i - 1].stitches : 0),
    stitchCount: round.stitches,
  }));
  instructions.push({
    stepNumber: rounds.length + 1,
    label: "Finish",
    instructionText:
      "Stuff firmly before the opening gets small. Fasten off and weave the tail through the front loops of the last 6 sts; pull closed.",
    stitchCount: rounds[rounds.length - 1].stitches,
  });
  return instructions;
}
