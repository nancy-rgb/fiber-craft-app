import { describe, expect, it } from "vitest";
import {
  calculateHatPattern,
  calculateHatPlan,
  castOnStitches,
  crownRoundCount,
  domeDecreaseRounds,
  longTailDecreaseRounds,
  ribbingMultiple,
} from "@/lib/math/hatMath";
import type { Gauge, HatInputs } from "@/lib/types/project";

const gauge: Gauge = { stitchesPerInch: 4, rowsPerInch: 6 };

const hat = (overrides: Partial<HatInputs> = {}): HatInputs => ({
  headCircumferenceInches: 21,
  brimStyle: "single",
  ribbingType: "2x2",
  bodyStyle: "standard",
  crownStyle: "dome",
  ...overrides,
});

describe("cast-on", () => {
  it("applies negative ease and snaps down to the ribbing multiple", () => {
    // (21 - 1.5) * 4 = 78 → nearest 4 down = 76
    expect(castOnStitches(hat(), gauge)).toBe(76);
  });

  it('fitted subtracts 2" of ease; garter allows any count', () => {
    // (21 - 2) * 4 = 76 already divisible by 4
    expect(castOnStitches(hat({ bodyStyle: "fitted" }), gauge)).toBe(76);
    // garter, multiple 1: (21 - 1.5) * 4 = 78
    expect(castOnStitches(hat({ ribbingType: "garter" }), gauge)).toBe(78);
  });

  it("respects each ribbing multiple", () => {
    expect(ribbingMultiple("1x1")).toBe(2);
    expect(ribbingMultiple("2x2")).toBe(4);
    expect(ribbingMultiple("garter")).toBe(1);
    expect(castOnStitches(hat({ ribbingType: "1x1" }), gauge) % 2).toBe(0);
  });

  it("rejects bad inputs", () => {
    expect(() =>
      castOnStitches(hat({ headCircumferenceInches: 0 }), gauge),
    ).toThrow();
  });
});

describe("balloon body", () => {
  it("adds ~20% stitches after the brim and emits an increase round", () => {
    const plan = calculateHatPlan(hat({ bodyStyle: "balloon" }), gauge);
    const inc = Math.ceil((plan.castOn * 1.2) / 2) * 2;
    expect(plan.bodyStitches).toBe(inc);
    const steps = calculateHatPattern(hat({ bodyStyle: "balloon" }), gauge);
    const increase = steps.find((s) => s.label === "Balloon increase");
    expect(increase?.stitchCount).toBe(inc);
  });
});

describe("dome crown", () => {
  it("removes `sections` stitches per decrease round, alternating plain rounds", () => {
    const { sections, schedule } = domeDecreaseRounds(80);
    expect(sections).toBe(8);
    let sts = 80;
    schedule.forEach((s) => {
      sts -= sections;
      expect(s.stitches).toBe(sts);
      expect(s.plainAfter).toBe(1);
    });
    expect(sts).toBeLessThanOrEqual(2 * sections + 8);
  });

  it("falls back to a divisor wedge count when stitches aren't divisible by 8", () => {
    expect(domeDecreaseRounds(70).sections).toBe(7);
    expect(domeDecreaseRounds(78).sections).toBe(6);
  });

  it("writes wedge instructions and a final cinch", () => {
    const steps = calculateHatPattern(hat(), gauge);
    const decs = steps.filter((s) => s.label.startsWith("Dec rnd"));
    expect(decs.length).toBeGreaterThan(4);
    expect(decs[0].instructionText).toMatch(/\[k\d+, k2tog, sm\] x/);
    expect(steps.map((s) => s.stepNumber)).toEqual(steps.map((_, i) => i + 1));
  });
});

describe("long-tail crown", () => {
  it("spaces decreases every 4th–6th round across the tail length", () => {
    const steps = calculateHatPattern(
      hat({ crownStyle: "long-tail", tailLengthInches: 6 }),
      gauge,
    );
    const decs = steps.filter((s) => s.label.startsWith("Tail dec"));
    expect(decs.length).toBeGreaterThanOrEqual(2);
    const setup = steps.find((s) => s.label === "Tail crown");
    expect(setup?.instructionText).toMatch(/every [4-6] rounds/);
    // final stitch count drops by removePerRound each decrease
    const counts = decs.map((s) => s.stitchCount);
    counts.forEach((c, i) => {
      if (i > 0) expect(counts[i - 1] - c).toBe(8);
    });
  });

  it("longTailDecreaseRounds clamps interval into [4,6]", () => {
    expect(longTailDecreaseRounds(80, 10).everyRounds).toBe(6);
    expect(longTailDecreaseRounds(80, 1).everyRounds).toBe(4);
  });
});

describe("square-cat-ear crown", () => {
  it("has zero crown rounds and a flat-top finish, no decreases", () => {
    const inputs = hat({ crownStyle: "square-cat-ear" });
    const plan = calculateHatPlan(inputs, gauge);
    expect(plan.crownRounds).toBe(0);
    const steps = calculateHatPattern(inputs, gauge);
    expect(steps.some((s) => s.label.includes("dec"))).toBe(false);
    const flat = steps.find((s) => s.label === "Flat top");
    expect(flat?.instructionText).toMatch(/graft|three-needle bind off/);
    expect(flat?.instructionText).toContain("cat ears");
  });
});

describe("cinch crown", () => {
  it("knits straight to height then draws yarn through live loops", () => {
    const inputs = hat({ crownStyle: "cinch" });
    const steps = calculateHatPattern(inputs, gauge);
    expect(steps.some((s) => s.label.startsWith("Dec"))).toBe(false);
    const cinch = steps.find((s) => s.label === "Cinch top");
    expect(cinch?.instructionText).toMatch(
      /draw it through all \d+ live loops/,
    );
    expect(cinch?.instructionText).toMatch(/pull the tail tight/);
  });
});

describe("plan bookkeeping", () => {
  it("dome crown rounds match the schedule", () => {
    const inputs = hat();
    const plan = calculateHatPlan(inputs, gauge);
    const { schedule } = domeDecreaseRounds(plan.bodyStitches);
    expect(plan.crownRounds).toBe(
      schedule.reduce((sum, s) => sum + 1 + s.plainAfter, 0) + 1,
    );
    expect(crownRoundCount(inputs, plan.bodyStitches, gauge)).toBe(
      plan.crownRounds,
    );
  });
});
