import { describe, expect, it } from "vitest";
import {
  calculateGarmentPattern,
  calculateGarmentPlan,
  recalculateGaugeMidProject,
  scheduleIncreases,
} from "@/lib/math/garmentMath";
import type { GarmentInputs, Gauge } from "@/lib/types/project";

const inputs: GarmentInputs = {
  chestWidthInches: 20,
  bodyLengthInches: 24,
  sleeveLengthInches: 18,
  sleeveUpperArmInches: 14,
  neckWidthInches: 8,
  easeInches: 4,
};
const worsted: Gauge = { stitchesPerInch: 5, rowsPerInch: 7 };

function expectConsistent(plan: ReturnType<typeof calculateGarmentPlan>) {
  expect(plan.shoulderStitches * 2 + plan.neckStitches).toBe(
    plan.panelStitches,
  );
  expect(plan.shoulderStitches).toBeGreaterThanOrEqual(1);
  expect(plan.armholeMarkerRow + plan.armholeDepthRows).toBe(plan.bodyRows);
  expect(plan.cuffRows + plan.taperRows + plan.topStraightRows).toBe(
    plan.sleeveRows,
  );
  const { increaseRows, interval, count, extraCount } = plan.sleeveIncreases;
  expect(plan.sleeveCuffStitches + 2 * increaseRows).toBe(
    plan.sleeveTopStitches,
  );
  if (increaseRows > 0) {
    expect(count + extraCount).toBe(increaseRows);
    expect(count * interval + extraCount * (interval + 1)).toBe(plan.taperRows);
  }
  for (const value of Object.values(plan)) {
    if (typeof value === "number") expect(value).toBeGreaterThanOrEqual(0);
  }
}

describe("calculateGarmentPlan", () => {
  it("computes drop-shoulder panel and sleeve numbers", () => {
    const plan = calculateGarmentPlan(inputs, worsted);
    expect(plan.panelWidthInches).toBe(22);
    expect(plan.panelStitches).toBe(110);
    expect(plan.neckStitches).toBe(40);
    expect(plan.shoulderStitches).toBe(35);
    expect(plan.bodyRows).toBe(168);
    // Sleeve top = 14" + 2" ease = 16" -> 80 sts; armhole depth 8" = 56 rows.
    expect(plan.sleeveTopStitches).toBe(80);
    expect(plan.armholeDepthRows).toBe(56);
    expect(plan.armholeMarkerRow).toBe(112);
    expect(plan.sleeveCuffStitches).toBe(48);
    expect(plan.sleeveRows).toBe(126);
    expectConsistent(plan);
  });

  it("handles fractional inches and keeps shoulders symmetric with odd counts", () => {
    const plan = calculateGarmentPlan(
      {
        ...inputs,
        chestWidthInches: 19.75,
        neckWidthInches: 7.25,
        easeInches: 3.5,
        sleeveLengthInches: 17.3,
      },
      { stitchesPerInch: 4.5, rowsPerInch: 6.25 },
    );
    // (19.75 + 1.75) * 4.5 = 96.75 -> 97 sts (odd panel).
    expect(plan.panelStitches).toBe(97);
    // 7.25 * 4.5 = 32.6 -> 33; 97 - 33 = 64 is even, so no adjustment.
    expect(plan.neckStitches).toBe(33);
    expect(plan.shoulderStitches).toBe(32);
    expectConsistent(plan);
  });

  it("nudges the neck by one stitch when shoulders would be uneven", () => {
    // 7.8 * 5 = 39 sts leaves 71 for shoulders, so the neck widens to 40.
    const plan = calculateGarmentPlan(
      { ...inputs, neckWidthInches: 7.8 },
      worsted,
    );
    expect(plan.neckStitches).toBe(40);
    expect(plan.shoulderStitches).toBe(35);
    expectConsistent(plan);
  });

  it("works with very thick yarn", () => {
    const plan = calculateGarmentPlan(inputs, {
      stitchesPerInch: 1.25,
      rowsPerInch: 1.5,
    });
    expect(plan.panelStitches).toBe(28); // 22 * 1.25 = 27.5
    expect(Number.isInteger(plan.neckStitches)).toBe(true);
    expectConsistent(plan);
  });

  it("falls back to single-row increases and widens the cuff for short sleeves", () => {
    const plan = calculateGarmentPlan(
      { ...inputs, sleeveLengthInches: 3, sleeveUpperArmInches: 18 },
      { stitchesPerInch: 6, rowsPerInch: 4 },
    );
    // 3" * 4 = 12 rows; 1 cuff + 1 top straight leaves 10 taper rows.
    expect(plan.sleeveRows).toBe(12);
    expect(plan.taperRows).toBe(10);
    expect(plan.sleeveIncreases.interval).toBe(1);
    expect(plan.sleeveIncreases.increaseRows).toBe(10);
    expect(plan.sleeveCuffStitches).toBe(plan.sleeveTopStitches - 20);
    expectConsistent(plan);
  });

  it("clamps a neck wider than the panel so each shoulder keeps a stitch", () => {
    const plan = calculateGarmentPlan(
      { ...inputs, chestWidthInches: 6, easeInches: 0, neckWidthInches: 10 },
      worsted,
    );
    expect(plan.panelStitches).toBe(30);
    expect(plan.neckStitches).toBe(28);
    expect(plan.shoulderStitches).toBe(1);
  });

  it("rejects invalid inputs", () => {
    expect(() =>
      calculateGarmentPlan(inputs, { stitchesPerInch: 0, rowsPerInch: 5 }),
    ).toThrow(RangeError);
    expect(() =>
      calculateGarmentPlan({ ...inputs, bodyLengthInches: -1 }, worsted),
    ).toThrow(RangeError);
    expect(() =>
      calculateGarmentPlan({ ...inputs, easeInches: Number.NaN }, worsted),
    ).toThrow(RangeError);
    expect(() =>
      calculateGarmentPlan(
        { ...inputs, chestWidthInches: 0.5, easeInches: 0 },
        { stitchesPerInch: 2, rowsPerInch: 2 },
      ),
    ).toThrow(/Panel is only/);
  });
});

describe("scheduleIncreases", () => {
  it("spreads increases with a remainder", () => {
    expect(scheduleIncreases(16, 100)).toEqual({
      increaseRows: 16,
      interval: 6,
      count: 12,
      extraCount: 4,
    });
  });

  it("returns an empty schedule when there is nothing to increase", () => {
    expect(scheduleIncreases(0, 50).increaseRows).toBe(0);
  });

  it("refuses more increase rows than rows available", () => {
    expect(() => scheduleIncreases(11, 10)).toThrow(RangeError);
  });
});

describe("calculateGarmentPattern", () => {
  it("returns numbered steps for front, back, sleeves and finishing", () => {
    const steps = calculateGarmentPattern(inputs, worsted);
    expect(steps.map((s) => s.stepNumber)).toEqual(steps.map((_, i) => i + 1));
    expect(steps[0]).toMatchObject({
      label: "Back: cast on",
      stitchCount: 110,
    });
    expect(steps.some((s) => s.label === "Front: shoulders")).toBe(true);
    const increases = steps.find((s) => s.label === "Sleeve: increases");
    expect(increases?.stitchCount).toBe(80);
    // 126 sleeve rows - 13 cuff - 13 top = 100 taper rows for 16 increase rows.
    expect(increases?.instructionText).toBe(
      "Increase 1 st at each edge every 6 rows 12 times, then every 7 rows 4 times (100 rows).",
    );
    expect(steps.at(-1)?.label).toBe("Finishing");
  });

  it("uses 'every row' wording for single-row increases", () => {
    const steps = calculateGarmentPattern(
      { ...inputs, sleeveLengthInches: 3, sleeveUpperArmInches: 18 },
      { stitchesPerInch: 6, rowsPerInch: 4 },
    );
    const increases = steps.find((s) => s.label === "Sleeve: increases");
    expect(increases?.instructionText).toMatch(/every row 10 times/);
  });
});

describe("recalculateGaugeMidProject", () => {
  it("derives stitch gauge from a measured panel and keeps row gauge", () => {
    expect(recalculateGaugeMidProject(18, 4, worsted)).toEqual({
      stitchesPerInch: 4.5,
      rowsPerInch: 7,
    });
  });

  it("assumes square gauge without a previous gauge", () => {
    expect(recalculateGaugeMidProject(22, 5.5)).toEqual({
      stitchesPerInch: 4,
      rowsPerInch: 4,
    });
  });

  it("updates remaining counts when the gauge changes mid-project", () => {
    const tighter = recalculateGaugeMidProject(55, 10, worsted); // 5.5 spi
    const before = calculateGarmentPlan(inputs, worsted);
    const after = calculateGarmentPlan(inputs, tighter);
    expect(after.panelStitches).toBe(121);
    expect(after.panelStitches).toBeGreaterThan(before.panelStitches);
    expect(after.bodyRows).toBe(before.bodyRows);
    expectConsistent(after);
  });

  it("rejects zero or negative measurements", () => {
    expect(() => recalculateGaugeMidProject(0, 4)).toThrow(RangeError);
    expect(() => recalculateGaugeMidProject(20, 0)).toThrow(RangeError);
    expect(() => recalculateGaugeMidProject(20, -3)).toThrow(RangeError);
  });
});
