import { describe, expect, it } from "vitest";
import { calculateGarmentPattern } from "@/lib/math/garmentMath";
import { activePieceIndex, garmentSection } from "@/lib/projectProgress";
import type { CalculatedInstruction } from "@/lib/types/project";

const step = (label: string): CalculatedInstruction => ({
  stepNumber: 0,
  label,
  instructionText: "",
  stitchCount: 6,
});

describe("activePieceIndex", () => {
  const steps = [
    step("Head · Rnd 1"),
    step("Head · Finish"),
    step("Arm · Rnd 1"),
    step("Arm · Finish"),
    step("Arm · Rnd 1"),
    step("Arm · Finish"),
  ];

  it("counts finished pieces before the current step", () => {
    expect(activePieceIndex(steps, 0)).toBe(0);
    expect(activePieceIndex(steps, 1)).toBe(0);
    expect(activePieceIndex(steps, 2)).toBe(1);
    expect(activePieceIndex(steps, 4)).toBe(2);
  });

  it("tells duplicate piece names apart", () => {
    expect(activePieceIndex(steps, 3)).toBe(1);
    expect(activePieceIndex(steps, 5)).toBe(2);
  });
});

describe("garmentSection", () => {
  it("maps garment step labels to pieces", () => {
    const labels = calculateGarmentPattern(
      {
        chestWidthInches: 20,
        bodyLengthInches: 24,
        sleeveLengthInches: 18,
        sleeveUpperArmInches: 14,
        neckWidthInches: 8,
        easeInches: 4,
      },
      { stitchesPerInch: 5, rowsPerInch: 7 },
    ).map((s) => garmentSection(s.label));
    expect(labels[0]).toBe("back");
    expect(labels).toContain("front");
    expect(labels).toContain("sleeve");
    expect(labels.at(-1)).toBeNull();
  });
});
