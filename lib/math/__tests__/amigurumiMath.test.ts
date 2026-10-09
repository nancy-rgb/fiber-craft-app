import { describe, expect, it } from "vitest";
import {
  calculateSpiralShape,
  maxStitchesForDiameter,
  planSpiralRounds,
} from "@/lib/math/amigurumiMath";
import type { AmigurumiShape, Gauge } from "@/lib/types/project";

const gauge: Gauge = { stitchesPerInch: 5, rowsPerInch: 5 };

const shape = (overrides: Partial<AmigurumiShape>): AmigurumiShape => ({
  id: "s",
  name: "Shape",
  type: "sphere",
  maxDiameterInches: 2,
  heightInches: 2,
  ...overrides,
});

function expectValidSpiral(counts: number[]) {
  expect(counts[0]).toBe(6);
  expect(counts.at(-1)).toBe(6);
  for (let i = 1; i < counts.length; i++) {
    expect(counts[i] % 6).toBe(0);
    expect([0, 6]).toContain(Math.abs(counts[i] - counts[i - 1]));
  }
}

describe("maxStitchesForDiameter", () => {
  it("snaps the circumference to a multiple of 6", () => {
    expect(maxStitchesForDiameter(2, gauge)).toBe(30); // 31.4
    expect(
      maxStitchesForDiameter(1.3, { stitchesPerInch: 4.7, rowsPerInch: 5 }),
    ).toBe(18); // 19.2
  });

  it("never drops below the 6-stitch magic ring", () => {
    expect(maxStitchesForDiameter(0.2, gauge)).toBe(6);
  });
});

describe("planSpiralRounds", () => {
  it("builds a sphere with mirrored increases and decreases", () => {
    const rounds = planSpiralRounds(shape({}), gauge);
    const counts = rounds.map((r) => r.stitches);
    expect(counts.slice(0, 5)).toEqual([6, 12, 18, 24, 30]);
    expect(counts.slice(-5)).toEqual([30, 24, 18, 12, 6]);
    // Half-meridian: round(pi * 2 / 2 * 5) = 16 rounds; 9 shaped -> 7 straight.
    expect(rounds.filter((r) => r.kind === "straight")).toHaveLength(7);
    expect(rounds).toHaveLength(16);
    expectValidSpiral(counts);
  });

  it("uses the diameter for a sphere without a height", () => {
    const withHeight = planSpiralRounds(shape({}), gauge);
    const without = planSpiralRounds(shape({ heightInches: 0 }), gauge);
    expect(without).toEqual(withHeight);
  });

  it("builds a cylinder with straight rounds for its height", () => {
    const rounds = planSpiralRounds(
      shape({ type: "cylinder", maxDiameterInches: 1.2, heightInches: 2.5 }),
      gauge,
    );
    // pi * 1.2 * 5 = 18.8 -> 18 sts; 2.5" * 5 = 12.5 -> 13 straight rounds.
    expect(rounds.filter((r) => r.kind === "straight")).toHaveLength(13);
    expect(rounds.filter((r) => r.kind === "increase")).toHaveLength(2);
    expect(rounds.filter((r) => r.kind === "decrease")).toHaveLength(2);
    expectValidSpiral(rounds.map((r) => r.stitches));
  });

  it("spreads cone increases along the slant", () => {
    const rounds = planSpiralRounds(
      shape({ type: "cone", maxDiameterInches: 1.5, heightInches: 3 }),
      gauge,
    );
    const counts = rounds.map((r) => r.stitches);
    // pi * 1.5 * 5 = 23.6 -> 24 sts; slant hypot(3, 0.75) * 5 = 15.5 -> 15 growth rounds.
    const peak = counts.indexOf(24);
    expect(peak).toBe(14);
    expect(
      rounds.slice(0, peak + 1).filter((r) => r.kind === "straight").length,
    ).toBe(11);
    expect(rounds.slice(peak + 1).every((r) => r.kind === "decrease")).toBe(
      true,
    );
    expectValidSpiral(counts);
  });

  it("uses back-to-back increases when a cone is too short to spread them", () => {
    const rounds = planSpiralRounds(
      shape({ type: "cone", maxDiameterInches: 3, heightInches: 0.25 }),
      gauge,
    );
    // 48 sts needs 8 growth rounds but the slant only gives 8 -> every round increases.
    const growth = rounds.slice(1, 8);
    expect(growth.every((r) => r.kind === "increase")).toBe(true);
    expectValidSpiral(rounds.map((r) => r.stitches));
  });

  it("handles very thick yarn with a single 6-stitch round", () => {
    const thick = { stitchesPerInch: 1, rowsPerInch: 1 };
    const sphere = planSpiralRounds(shape({ maxDiameterInches: 2 }), thick);
    expect(sphere.every((r) => r.stitches === 6)).toBe(true);
    expect(
      sphere.some((r) => r.kind === "increase" || r.kind === "decrease"),
    ).toBe(false);
    const cone = planSpiralRounds(
      shape({ type: "cone", maxDiameterInches: 1.5, heightInches: 3 }),
      thick,
    );
    expect(cone.every((r) => r.stitches === 6)).toBe(true);
  });

  it("rejects invalid dimensions and gauge", () => {
    expect(() =>
      planSpiralRounds(shape({ maxDiameterInches: 0 }), gauge),
    ).toThrow(RangeError);
    expect(() =>
      planSpiralRounds(shape({ type: "cylinder", heightInches: -1 }), gauge),
    ).toThrow(RangeError);
    expect(() =>
      planSpiralRounds(shape({}), { stitchesPerInch: 5, rowsPerInch: 0 }),
    ).toThrow(RangeError);
  });
});

describe("calculateSpiralShape", () => {
  it("writes standard [sc N, inc] x6 and mirrored decrease rounds", () => {
    const steps = calculateSpiralShape(shape({}), gauge);
    expect(steps.slice(0, 5).map((s) => s.instructionText)).toEqual([
      "Magic ring, 6 sc into ring (6)",
      "inc in each st around (12)",
      "[sc 1, inc] x6 (18)",
      "[sc 2, inc] x6 (24)",
      "[sc 3, inc] x6 (30)",
    ]);
    expect(steps[5].instructionText).toBe("sc in each st around (30)");
    const decreases = steps.slice(-5, -1).map((s) => s.instructionText);
    expect(decreases).toEqual([
      "[sc 3, dec] x6 (24)",
      "[sc 2, dec] x6 (18)",
      "[sc 1, dec] x6 (12)",
      "dec around (6)",
    ]);
  });

  it("numbers rounds sequentially and ends with a finishing step", () => {
    const steps = calculateSpiralShape(shape({ type: "cylinder" }), gauge);
    expect(steps.map((s) => s.stepNumber)).toEqual(steps.map((_, i) => i + 1));
    expect(steps[0].label).toBe("Rnd 1");
    expect(steps.at(-1)).toMatchObject({ label: "Finish", stitchCount: 6 });
  });
});
