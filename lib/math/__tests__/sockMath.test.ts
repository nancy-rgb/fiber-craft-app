import { describe, expect, it } from "vitest";
import {
  calculateSockPattern,
  calculateSockPlan,
  heelTurnRows,
  shoeSizeToFootLength,
  sockCastOn,
  TOE_ALLOWANCE_INCHES,
  toeDecreases,
} from "@/lib/math/sockMath";
import type { Gauge, SockInputs } from "@/lib/types/project";

const gauge: Gauge = { stitchesPerInch: 8, rowsPerInch: 11 };

const sock = (overrides: Partial<SockInputs> = {}): SockInputs => ({
  footCircumferenceInches: 9,
  footLengthInches: 9.5,
  cuffLengthInches: 6,
  negativeEasePercent: 10,
  ...overrides,
});

describe("cast-on", () => {
  it("applies negative ease and rounds to the nearest multiple of 4", () => {
    // 9 * 0.9 * 8 = 64.8 → 64
    expect(sockCastOn(sock(), gauge)).toBe(64);
    // 8 * 0.9 * 8 = 57.6 → 14.4 × 4 → 56
    expect(sockCastOn(sock({ footCircumferenceInches: 8 }), gauge)).toBe(56);
    // 8.5 * 0.9 * 7.5 = 57.375 → 56; 9.5 * 0.9 * 7.5 = 64.125 → 64
    const g = { stitchesPerInch: 7.5, rowsPerInch: 10 };
    expect(sockCastOn(sock({ footCircumferenceInches: 8.5 }), g)).toBe(56);
    expect(sockCastOn(sock({ footCircumferenceInches: 9.5 }), g)).toBe(64);
  });

  it("uses the ease percent", () => {
    // 9 * 1.0 * 8 = 72; 9 * 0.8 * 8 = 57.6 → 56
    expect(sockCastOn(sock({ negativeEasePercent: 0 }), gauge)).toBe(72);
    expect(sockCastOn(sock({ negativeEasePercent: 20 }), gauge)).toBe(56);
  });

  it("is always a multiple of 4 and rejects bad input", () => {
    for (let c = 5; c <= 12; c += 0.25) {
      expect(sockCastOn(sock({ footCircumferenceInches: c }), gauge) % 4).toBe(
        0,
      );
    }
    expect(() =>
      sockCastOn(sock({ footCircumferenceInches: 0 }), gauge),
    ).toThrow();
    expect(() =>
      sockCastOn(sock({ negativeEasePercent: 100 }), gauge),
    ).toThrow();
    expect(() =>
      sockCastOn(sock(), { stitchesPerInch: 0, rowsPerInch: 10 }),
    ).toThrow();
  });
});

describe("heel flap", () => {
  it("is worked over exactly half the cast-on, one pickup per 2 rows", () => {
    const plan = calculateSockPlan(sock(), gauge);
    expect(plan.heelFlapStitches).toBe(32);
    expect(plan.instepStitches).toBe(32);
    expect(plan.heelFlapRows).toBe(32);
    expect(plan.gussetPickupPerSide).toBe(16);
  });
});

describe("heel turn", () => {
  it("turns a 32-st heel down to 19 sts in 13 rows", () => {
    const rows = heelTurnRows(32);
    expect(rows).toHaveLength(13);
    expect(rows[0].text).toBe("sl1, k16, ssk, k1, turn (12 sts left unworked)");
    expect(rows[1].text).toBe("sl1, p5, p2tog, p1, turn");
    expect(rows[2].text).toBe("sl1, k6, ssk, k1, turn");
    expect(rows.at(-1)?.stitches).toBe(19);
  });

  it("drops one stitch per row and alternates RS/WS", () => {
    for (const heel of [12, 14, 28, 30, 32, 36, 40]) {
      const rows = heelTurnRows(heel);
      rows.forEach((r, i) => {
        expect(r.stitches).toBe(heel - (i + 1));
        expect(r.side).toBe(i % 2 === 0 ? "RS" : "WS");
      });
      // Cups the heel: a bit more than half the flap remains.
      const final = rows.at(-1)!.stitches;
      expect(final).toBeGreaterThan(heel / 2);
      expect(final).toBeLessThanOrEqual(heel / 2 + 3);
    }
  });

  it("omits the extra stitch on the last rows when one st is left per side", () => {
    // 30 sts: 11 unworked each side → last row each side is just the decrease.
    const rows = heelTurnRows(30);
    expect(rows.at(-1)?.text).toMatch(/p2tog, turn$|ssk, turn$/);
    expect(rows.at(-1)?.stitches).toBe(17);
  });

  it("rejects heels too small to turn", () => {
    expect(() => heelTurnRows(10)).toThrow();
    expect(() => heelTurnRows(13.5)).toThrow();
  });
});

describe("gusset", () => {
  it("decreases back to the cast-on count, 2 sts every other round", () => {
    const plan = calculateSockPlan(sock(), gauge);
    // 19 heel + 16 + 16 picked up + 32 instep
    expect(plan.stitchesAfterPickup).toBe(83);
    expect(plan.gussetDecreaseRounds).toBe(10);
    expect(plan.gussetOddFinish).toBe(true);

    const steps = calculateSockPattern(sock(), gauge);
    const decs = steps.filter((s) => /^Gusset dec \d+$/.test(s.label));
    expect(decs).toHaveLength(10);
    expect(decs.at(-1)?.stitchCount).toBe(plan.castOn);
    decs
      .slice(0, -1)
      .forEach((d, i) => expect(d.stitchCount).toBe(83 - 2 * (i + 1)));
    expect(
      steps.filter((s) => /^Gusset dec \d+ — plain$/.test(s.label)),
    ).toHaveLength(10);
  });

  it("lands on the cast-on for many sizes", () => {
    for (const c of [6, 7, 8, 8.5, 9, 10, 11]) {
      const plan = calculateSockPlan(
        sock({ footCircumferenceInches: c }),
        gauge,
      );
      const removed =
        plan.gussetDecreaseRounds * 2 - (plan.gussetOddFinish ? 1 : 0);
      expect(plan.stitchesAfterPickup - removed).toBe(plan.castOn);
    }
  });
});

describe("foot length", () => {
  it("knits to foot length minus the toe allowance", () => {
    const plan = calculateSockPlan(sock(), gauge);
    expect(TOE_ALLOWANCE_INCHES).toBe(2);
    expect(plan.footLengthBeforeToeInches).toBe(7.5);
    // 7.5" * 11 rpi = 83 rounds, minus 20 gusset rounds
    expect(plan.footPlainRounds).toBe(63);
  });
});

describe("toe", () => {
  it("decreases 4 sts every other round to half, then every round to 16–20", () => {
    const { everyOther, everyRound, final } = toeDecreases(64);
    expect(everyOther).toEqual([60, 56, 52, 48, 44, 40, 36, 32]);
    expect(everyRound).toEqual([28, 24, 20]);
    expect(final).toBe(20);
  });

  it("finishes at 16–20 sts for all sock sizes", () => {
    for (let castOn = 24; castOn <= 96; castOn += 4) {
      const { everyOther, everyRound, final } = toeDecreases(castOn);
      expect(final).toBeGreaterThanOrEqual(16);
      expect(final).toBeLessThanOrEqual(20);
      expect(final % 4).toBe(0);
      [...everyOther, ...everyRound].reduce((prev, n) => {
        expect(prev - n).toBe(4);
        return n;
      }, castOn);
    }
  });

  it("ends with a Kitchener step splitting the stitches in half", () => {
    const steps = calculateSockPattern(sock(), gauge);
    const last = steps.at(-1)!;
    expect(last.label).toBe("Kitchener");
    expect(last.stitchCount).toBe(20);
    expect(last.instructionText).toMatch(/10 sts on each needle/);
  });
});

describe("cuff and leg", () => {
  it('ribs the whole cuff for an ankle sock, ~1.5" rib then plain for crew', () => {
    const ankle = calculateSockPlan(sock({ cuffLengthInches: 1 }), gauge);
    expect(ankle.legRibRounds).toBe(11);
    expect(ankle.legPlainRounds).toBe(0);
    const crew = calculateSockPlan(sock(), gauge);
    expect(crew.legRibRounds).toBe(17);
    expect(crew.legRibRounds + crew.legPlainRounds).toBe(66);
  });
});

describe("pattern", () => {
  it("numbers steps sequentially and starts with the cast-on", () => {
    const steps = calculateSockPattern(sock(), gauge);
    expect(steps[0].label).toBe("Cast on");
    expect(steps[0].stitchCount).toBe(64);
    expect(steps.map((s) => s.stepNumber)).toEqual(steps.map((_, i) => i + 1));
    expect(steps.some((s) => s.label === "Heel flap")).toBe(true);
  });
});

describe("shoe size mapper", () => {
  it("converts US sizes to foot length", () => {
    expect(shoeSizeToFootLength(7, "women")).toBe(9.25);
    expect(shoeSizeToFootLength(10, "men")).toBe(10.75);
  });
});

describe("contrasting heel and toe", () => {
  const labels = (overrides: Partial<SockInputs>) =>
    calculateSockPattern(sock(overrides), gauge).map((s) => s.label);

  it("adds no color changes by default", () => {
    const steps = calculateSockPattern(sock(), gauge);
    expect(
      steps.filter((s) => /Main Color|Contrast Color/.test(s.instructionText)),
    ).toHaveLength(0);
  });

  it("switches to CC right before the heel flap and back to MC before the gusset pick-up", () => {
    const steps = calculateSockPattern(sock({ contrastingHeel: true }), gauge);
    const l = steps.map((s) => s.label);
    const cc = l.indexOf("Contrast heel");
    expect(l[cc + 1]).toBe("Heel flap");
    expect(steps[cc].instructionText).toMatch(
      /^Break Main Color and join Contrast Color/,
    );
    const mc = l.indexOf("Main color");
    expect(l[mc - 1]).toMatch(/^Heel turn row \d+/);
    expect(l[mc + 1]).toBe("Gusset pick-up");
    expect(steps[mc].instructionText).toMatch(
      /^Break Contrast Color and rejoin Main Color/,
    );
    expect(steps[mc].stitchCount).toBe(19); // 64-st sock: 19-st heel turn
    expect(l).not.toContain("Contrast toe");
    expect(steps.map((s) => s.stepNumber)).toEqual(steps.map((_, i) => i + 1));
  });

  it("switches to CC exactly where the toe decreases begin", () => {
    const steps = calculateSockPattern(sock({ contrastingToe: true }), gauge);
    const l = steps.map((s) => s.label);
    const cc = l.indexOf("Contrast toe");
    expect(l[cc + 1]).toBe("Toe dec 1");
    expect(steps[cc].instructionText).toMatch(
      /^Break Main Color and join Contrast Color/,
    );
    expect(l).not.toContain("Contrast heel");
    expect(l).not.toContain("Main color");
  });

  it("supports both together, adding exactly 3 steps", () => {
    expect(
      labels({ contrastingHeel: true, contrastingToe: true }),
    ).toHaveLength(labels({}).length + 3);
  });
});
