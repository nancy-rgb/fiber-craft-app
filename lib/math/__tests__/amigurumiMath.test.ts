import { describe, expect, it } from "vitest";
import {
  calculateAmigurumiShape,
  calculateAssembly,
  calculateCurvedTube,
  calculateFlatTriangle,
  calculateOvalShape,
  calculateSpiralShape,
  calculateTrumpetShape,
  maxStitchesForDiameter,
  placeEyes,
  planSpiralRounds,
  stripeForRound,
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

describe("safety eyes and face details", () => {
  const head = shape({ type: "sphere", maxDiameterInches: 3 });
  const eyes = { eyeSizeMm: 9, eyePlacementRound: 9, eyeDistanceStitches: 7 };

  it("centers the eye pair on the front of the placement round", () => {
    const rounds = planSpiralRounds(head, gauge);
    const pos = placeEyes(eyes, rounds);
    const sts = rounds[8].stitches;
    expect(pos.roundStitches).toBe(sts);
    expect(pos.center).toBe(sts / 2);
    expect(pos.second - pos.first).toBe(7);
    expect(pos.first).toBe(sts / 2 - 3);
  });

  it("clamps out-of-range rounds and spacing", () => {
    const rounds = planSpiralRounds(head, gauge);
    const pos = placeEyes(
      { eyeSizeMm: 0, eyePlacementRound: 999, eyeDistanceStitches: 999 },
      rounds,
    );
    expect(pos.round).toBe(rounds.length);
    expect(pos.first).toBeGreaterThanOrEqual(1);
    expect(pos.second).toBeLessThanOrEqual(pos.roundStitches);
    expect(pos.sizeMm).toBe(9);
  });

  it("marks eyes after their round and inserts them before the first decrease", () => {
    const early = { ...eyes, eyePlacementRound: 5 };
    const steps = calculateSpiralShape(
      { ...head, eyes: early, facialFeatures: ["nose", "mouth", "cheeks"] },
      gauge,
    );
    const labels = steps.map((s) => s.label);
    expect(labels[labels.indexOf("Rnd 5") + 1]).toBe("Eye markers");
    const firstDecrease = planSpiralRounds(head, gauge).findIndex(
      (r) => r.kind === "decrease",
    );
    const eyeStep = labels.indexOf("Eyes");
    expect(labels[eyeStep - 1]).toBe(`Rnd ${firstDecrease}`);
    expect(labels.slice(eyeStep, eyeStep + 4)).toEqual([
      "Eyes",
      "Nose",
      "Mouth",
      "Cheeks",
    ]);
    expect(steps[eyeStep].instructionText).toContain("9 mm safety eyes");
    expect(steps.map((s) => s.stepNumber)).toEqual(steps.map((_, i) => i + 1));
  });

  it("skips the separate marker step when eyes go in right after their round", () => {
    const rounds = planSpiralRounds(head, gauge);
    const late = { ...eyes, eyePlacementRound: rounds.length - 1 };
    const labels = calculateSpiralShape({ ...head, eyes: late }, gauge).map(
      (s) => s.label,
    );
    expect(labels).not.toContain("Eye markers");
    expect(labels[labels.indexOf("Eyes") - 1]).toBe(`Rnd ${rounds.length - 1}`);
  });
});

describe("stripes", () => {
  const stripes = [
    { colorName: "Cream", hex: "#ffffff", rounds: 2 },
    { colorName: "Rose", hex: "#d7a6a0", rounds: 1 },
  ];

  it("repeats the sequence from round 1", () => {
    expect(
      [1, 2, 3, 4, 5, 6].map((n) => stripeForRound(stripes, n).colorName),
    ).toEqual(["Cream", "Cream", "Rose", "Cream", "Cream", "Rose"]);
  });

  it("writes jogless changes and tags each round with its yarn", () => {
    const steps = calculateSpiralShape(
      shape({
        type: "cylinder",
        maxDiameterInches: 2,
        heightInches: 2,
        stripes,
      }),
      gauge,
    );
    const rounds = steps.filter((s) => s.label.startsWith("Rnd"));
    expect(rounds[0].instructionText).toMatch(/^With Cream: /);
    expect(rounds[1].instructionText).toContain("Finish the last st with Rose");
    expect(rounds[2].instructionText).toMatch(/^Switch to Rose: /);
    expect(rounds[2].instructionText).toContain("Jogless");
    expect(rounds[3].instructionText).toMatch(/^Switch to Cream: /);
    expect(rounds.map((r) => r.yarnColor?.name).slice(0, 4)).toEqual([
      "Cream",
      "Cream",
      "Rose",
      "Cream",
    ]);
    expect(steps.at(-1)?.yarnColor).toBeUndefined();
  });

  it("uses a sl st start only when the round begins with a plain sc", () => {
    const steps = calculateSpiralShape(
      shape({
        type: "cylinder",
        stripes: [
          { colorName: "A", hex: "#000000", rounds: 1 },
          { colorName: "B", hex: "#ffffff", rounds: 1 },
        ],
      }),
      gauge,
    );
    // Rnd 2 is "inc in each st around"; Rnd 3 is "[sc 1, inc] x6".
    expect(steps[1].instructionText).not.toContain("sl st");
    expect(steps[2].instructionText).toContain("sl st in the first st");
  });

  it("ignores empty sequences", () => {
    const plain = calculateSpiralShape(shape({}), gauge);
    const empty = calculateSpiralShape(shape({ stripes: [] }), gauge);
    expect(empty).toEqual(plain);
  });
});

describe("limb attachment", () => {
  const body = shape({
    id: "body",
    name: "Body",
    type: "cylinder",
    maxDiameterInches: 2.5,
    heightInches: 3,
  });
  const arm = (id: string, name: string) =>
    shape({
      id,
      name,
      type: "cylinder",
      maxDiameterInches: 0.75,
      heightInches: 2,
      attachment: { targetPieceId: "body", round: 8, position: "side" },
    });

  it("places paired side limbs on opposite sides of the same round", () => {
    const steps = calculateAssembly(
      [body, arm("l", "Left Arm"), arm("r", "Right Arm")],
      gauge,
    );
    const sts = planSpiralRounds(body, gauge)[7].stitches;
    expect(steps.map((s) => s.label)).toEqual([
      "Attach Left Arm",
      "Attach Right Arm",
    ]);
    expect(steps[0].instructionText).toContain(
      `Rnd 8 (${sts} sts), centered on st ${sts / 4}`,
    );
    expect(steps[1].instructionText).toContain(
      `centered on st ${(3 * sts) / 4}`,
    );
    expect(steps[0].stitchCount).toBe(sts);
  });

  it("handles top/bottom positions and skips missing or self targets", () => {
    const ear = shape({
      id: "ear",
      name: "Ear",
      attachment: { targetPieceId: "body", round: 99, position: "top" },
    });
    const lost = shape({
      id: "lost",
      attachment: { targetPieceId: "gone", round: 1, position: "side" },
    });
    const self = shape({
      id: "self",
      attachment: { targetPieceId: "self", round: 1, position: "side" },
    });
    const steps = calculateAssembly([body, ear, lost, self], gauge);
    expect(steps).toHaveLength(1);
    expect(steps[0].instructionText).toContain("magic ring of Body (Rnd 1)");
  });

  it("leaves attached pieces open for sewing", () => {
    const finish = calculateSpiralShape(arm("l", "Left Arm"), gauge).at(-1);
    expect(finish?.instructionText).toContain("leave the end open");
  });
});

describe("calculateOvalShape", () => {
  const oval = shape({
    type: "oval",
    maxDiameterInches: 2,
    heightInches: 1,
    chainLength: 8,
  });

  it("starts on a foundation chain worked around both sides", () => {
    const steps = calculateOvalShape(oval, gauge);
    expect(steps[0].instructionText).toContain("Ch 9");
    expect(steps[0].instructionText).toContain("free loops of the chain");
    expect(steps[0].stitchCount).toBe(20); // 2*8+4
  });

  it("grows +6 per round with increases only at the ends", () => {
    const steps = calculateOvalShape(oval, gauge);
    const incs = steps.filter((s) =>
      s.instructionText.includes("inc in each of the next 3"),
    );
    expect(incs.length).toBeGreaterThan(0);
    incs.forEach((s, i) => {
      expect(s.stitchCount).toBe(20 + 6 * (i + 1));
      expect(s.stitchCount % 6).not.toBe(0); // ovals aren't 6-multiples
    });
  });

  it("leaves attached ovals open for sewing", () => {
    const attached = shape({
      type: "oval",
      attachment: { targetPieceId: "b", round: 3, position: "front" },
    });
    expect(
      calculateOvalShape(attached, gauge).at(-1)?.instructionText,
    ).toContain("leave the end open");
  });
});

describe("calculateCurvedTube", () => {
  const tube = (curvatureIntensity?: "slight" | "medium" | "sharp") =>
    shape({
      type: "curved-tube",
      maxDiameterInches: 1,
      heightInches: 2,
      curvatureIntensity,
    });

  it("emits matched inc/dec curve rounds that keep the stitch count flat", () => {
    const steps = calculateCurvedTube(tube("medium"), gauge);
    const curves = steps.filter((s) =>
      s.instructionText.startsWith("Curve round"),
    );
    expect(curves.length).toBeGreaterThan(0);
    curves.forEach((s) => {
      expect(s.instructionText).toContain("inc] x2");
      expect(s.instructionText).toContain("dec, sc");
      expect(s.stitchCount).toBe(maxStitchesForDiameter(1, gauge));
    });
  });

  it("curves more often at sharp intensity and less at slight", () => {
    const count = (c?: "slight" | "medium" | "sharp") =>
      calculateCurvedTube(tube(c), gauge).filter((s) =>
        s.instructionText.startsWith("Curve round"),
      ).length;
    expect(count("sharp")).toBeGreaterThan(count("medium"));
    expect(count("medium")).toBeGreaterThan(count("slight"));
  });
});

describe("calculateFlatTriangle", () => {
  const tri = shape({
    type: "flat-triangle",
    maxDiameterInches: 1.5,
    isFlat: true,
  });

  it("works turned rows that decrease at both edges to a point", () => {
    const steps = calculateFlatTriangle(tri, gauge);
    expect(steps[0].instructionText).toContain("Ch ");
    const body = steps.slice(1, -1);
    body.forEach((s, i) => {
      expect(s.instructionText).toContain("Ch 1, turn");
      expect(s.stitchCount).toBe(steps[0].stitchCount - 2 * (i + 1));
    });
    expect(steps.at(-1)?.stitchCount).toBe(1);
  });
});

describe("calculateTrumpetShape", () => {
  const trumpet = shape({
    type: "trumpet",
    maxDiameterInches: 2.5,
    heightInches: 2,
  });

  it("builds a slim body then flares to the rim in burst increase rounds", () => {
    const steps = calculateTrumpetShape(trumpet, gauge);
    const flares = steps.filter((s) => s.instructionText.startsWith("Flare"));
    expect(flares.length).toBeGreaterThanOrEqual(1);
    expect(steps.at(-1)?.instructionText).toContain("Sl st loosely");
    // Rim reaches the full diameter stitch count.
    expect(flares.at(-1)?.stitchCount).toBe(maxStitchesForDiameter(2.5, gauge));
    // Body stays at ~60% before the flare.
    const firstFlare = steps.indexOf(flares[0]);
    expect(steps[firstFlare - 1].stitchCount).toBe(
      maxStitchesForDiameter(1.5, gauge),
    );
  });
});

describe("calculateAmigurumiShape dispatch", () => {
  it("routes each new type to its calculator and keeps spiral types", () => {
    expect(
      calculateAmigurumiShape(shape({ type: "oval" }), gauge)[0]
        .instructionText,
    ).toContain("Ch ");
    expect(
      calculateAmigurumiShape(shape({ type: "trumpet" }), gauge)[0]
        .instructionText,
    ).toContain("Magic ring");
    expect(
      calculateAmigurumiShape(shape({ type: "teardrop" }), gauge)[0]
        .instructionText,
    ).toContain("Magic ring");
  });

  it("gives a teardrop a longer straight section than a sphere of the same size", () => {
    const straight = (type: AmigurumiShape["type"]) =>
      planSpiralRounds(shape({ type, heightInches: 2 }), gauge).filter(
        (r) => r.kind === "straight",
      ).length;
    expect(straight("teardrop")).toBeGreaterThan(straight("sphere"));
  });
});
