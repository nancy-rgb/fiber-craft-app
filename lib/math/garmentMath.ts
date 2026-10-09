import type {
  CalculatedInstruction,
  GarmentInputs,
  Gauge,
} from "@/lib/types/project";
import { assertPositive, assertValidGauge, formatInches } from "./validation";

/** Cuff circumference as a fraction of the sleeve top circumference. */
export const SLEEVE_CUFF_RATIO = 0.6;
/** Fraction of sleeve length worked straight at the cuff and again at the top. */
export const SLEEVE_STRAIGHT_FRACTION = 0.1;

export interface SleeveIncreaseSchedule {
  /** Number of increase rows; each adds 1 stitch at each edge. */
  increaseRows: number;
  /** Increase every `interval` rows `count` times... */
  interval: number;
  count: number;
  /** ...then every `interval + 1` rows `extraCount` times. */
  extraCount: number;
}

export interface GarmentPlan {
  panelWidthInches: number;
  panelStitches: number;
  neckStitches: number;
  shoulderStitches: number;
  bodyRows: number;
  /** Rows worked before placing armhole markers. */
  armholeMarkerRow: number;
  armholeDepthRows: number;
  sleeveTopInches: number;
  sleeveTopStitches: number;
  sleeveCuffStitches: number;
  sleeveRows: number;
  cuffRows: number;
  taperRows: number;
  topStraightRows: number;
  sleeveIncreases: SleeveIncreaseSchedule;
}

/**
 * Recalculate gauge from a mid-project measurement:
 * "my panel measures `measuredInches` at `currentStitches` stitches".
 * Row gauge is kept from `previousGauge` when given, otherwise assumed square.
 */
export function recalculateGaugeMidProject(
  currentStitches: number,
  measuredInches: number,
  previousGauge?: Gauge,
): Gauge {
  assertPositive(currentStitches, "currentStitches");
  assertPositive(measuredInches, "measuredInches");
  const stitchesPerInch = currentStitches / measuredInches;
  return {
    stitchesPerInch,
    rowsPerInch: previousGauge?.rowsPerInch ?? stitchesPerInch,
  };
}

/**
 * Spread `increaseRows` evenly across `taperRows` rows, with the last
 * increase landing on the final taper row.
 */
export function scheduleIncreases(
  increaseRows: number,
  taperRows: number,
): SleeveIncreaseSchedule {
  if (increaseRows <= 0 || taperRows <= 0) {
    return { increaseRows: 0, interval: 0, count: 0, extraCount: 0 };
  }
  if (increaseRows > taperRows) {
    throw new RangeError(
      `Cannot fit ${increaseRows} increase rows into ${taperRows} rows`,
    );
  }
  const interval = Math.floor(taperRows / increaseRows);
  const extraCount = taperRows % increaseRows;
  return {
    increaseRows,
    interval,
    count: increaseRows - extraCount,
    extraCount,
  };
}

/**
 * Drop-shoulder sweater numbers. `chestWidthInches` is the flat (half
 * circumference) chest width; `easeInches` is total ease around the body,
 * split between front and back. `sleeveUpperArmInches` is a circumference.
 */
export function calculateGarmentPlan(
  inputs: GarmentInputs,
  gauge: Gauge,
): GarmentPlan {
  assertValidGauge(gauge);
  assertPositive(inputs.chestWidthInches, "chestWidthInches");
  assertPositive(inputs.bodyLengthInches, "bodyLengthInches");
  assertPositive(inputs.sleeveLengthInches, "sleeveLengthInches");
  assertPositive(inputs.sleeveUpperArmInches, "sleeveUpperArmInches");
  assertPositive(inputs.neckWidthInches, "neckWidthInches");
  if (!Number.isFinite(inputs.easeInches)) {
    throw new RangeError("easeInches must be a finite number");
  }

  const { stitchesPerInch: spi, rowsPerInch: rpi } = gauge;

  const panelWidthInches = inputs.chestWidthInches + inputs.easeInches / 2;
  assertPositive(panelWidthInches, "chest width plus ease");
  const panelStitches = Math.round(panelWidthInches * spi);
  if (panelStitches < 3) {
    throw new RangeError(
      `Panel is only ${panelStitches} stitches wide; check gauge and chest width`,
    );
  }

  // Neck and two equal shoulders must add up exactly, so (panel - neck) is even.
  let neckStitches = Math.min(
    Math.max(1, Math.round(inputs.neckWidthInches * spi)),
    panelStitches - 2,
  );
  if ((panelStitches - neckStitches) % 2 !== 0) {
    neckStitches += neckStitches + 1 <= panelStitches - 2 ? 1 : -1;
  }
  const shoulderStitches = (panelStitches - neckStitches) / 2;

  const bodyRows = Math.max(1, Math.round(inputs.bodyLengthInches * rpi));

  const sleeveTopInches = inputs.sleeveUpperArmInches + inputs.easeInches / 2;
  assertPositive(sleeveTopInches, "upper arm plus ease");
  const armholeDepthRows = Math.min(
    bodyRows,
    Math.round((sleeveTopInches / 2) * rpi),
  );
  const armholeMarkerRow = bodyRows - armholeDepthRows;

  const sleeveTopStitches = Math.max(1, Math.round(sleeveTopInches * spi));
  const sleeveRows = Math.max(1, Math.round(inputs.sleeveLengthInches * rpi));
  const cuffRows = Math.round(sleeveRows * SLEEVE_STRAIGHT_FRACTION);
  const topStraightRows = Math.round(sleeveRows * SLEEVE_STRAIGHT_FRACTION);
  const taperRows = sleeveRows - cuffRows - topStraightRows;

  let sleeveCuffStitches = Math.max(
    1,
    Math.round(sleeveTopStitches * SLEEVE_CUFF_RATIO),
  );
  if ((sleeveTopStitches - sleeveCuffStitches) % 2 !== 0) {
    sleeveCuffStitches += 1;
  }
  // Short sleeves / few rows: widen the cuff so at most one increase row per row.
  const maxIncreaseRows = Math.max(0, taperRows);
  if ((sleeveTopStitches - sleeveCuffStitches) / 2 > maxIncreaseRows) {
    sleeveCuffStitches = sleeveTopStitches - 2 * maxIncreaseRows;
  }
  const sleeveIncreases = scheduleIncreases(
    (sleeveTopStitches - sleeveCuffStitches) / 2,
    taperRows,
  );

  return {
    panelWidthInches,
    panelStitches,
    neckStitches,
    shoulderStitches,
    bodyRows,
    armholeMarkerRow,
    armholeDepthRows,
    sleeveTopInches,
    sleeveTopStitches,
    sleeveCuffStitches,
    sleeveRows,
    cuffRows,
    taperRows,
    topStraightRows,
    sleeveIncreases,
  };
}

type Step = Omit<CalculatedInstruction, "stepNumber">;

export function calculateGarmentPattern(
  inputs: GarmentInputs,
  gauge: Gauge,
): CalculatedInstruction[] {
  const plan = calculateGarmentPlan(inputs, gauge);
  const rowsToInches = (rows: number) => formatInches(rows / gauge.rowsPerInch);
  const steps: Step[] = [];

  for (const panel of ["Back", "Front"]) {
    steps.push({
      label: `${panel}: cast on`,
      instructionText: `Cast on ${plan.panelStitches} sts (${formatInches(plan.panelWidthInches)} wide).`,
      stitchCount: plan.panelStitches,
    });
    if (plan.armholeMarkerRow > 0) {
      steps.push({
        label: `${panel}: body to armhole`,
        instructionText: `Work even for ${plan.armholeMarkerRow} rows (about ${rowsToInches(plan.armholeMarkerRow)}), then place a marker at each edge for the armhole.`,
        stitchCount: plan.panelStitches,
      });
    }
    steps.push({
      label: `${panel}: armhole to shoulder`,
      instructionText: `Work even for ${plan.armholeDepthRows} more rows (${plan.bodyRows} rows total, about ${rowsToInches(plan.bodyRows)}).`,
      stitchCount: plan.panelStitches,
    });
    steps.push({
      label: `${panel}: shoulders`,
      instructionText: `Bind off ${plan.shoulderStitches} sts for the first shoulder, ${plan.neckStitches} sts for the neck, then ${plan.shoulderStitches} sts for the second shoulder.`,
      stitchCount: 0,
    });
  }

  steps.push({
    label: "Sleeve: cast on",
    instructionText: `Make 2. Cast on ${plan.sleeveCuffStitches} sts.`,
    stitchCount: plan.sleeveCuffStitches,
  });
  if (plan.cuffRows > 0) {
    steps.push({
      label: "Sleeve: cuff",
      instructionText: `Work even for ${plan.cuffRows} rows (about ${rowsToInches(plan.cuffRows)}).`,
      stitchCount: plan.sleeveCuffStitches,
    });
  }
  const { interval, count, extraCount } = plan.sleeveIncreases;
  if (plan.sleeveIncreases.increaseRows > 0) {
    const extra =
      extraCount > 0
        ? `, then every ${interval + 1} rows ${extraCount} times`
        : "";
    steps.push({
      label: "Sleeve: increases",
      instructionText: `Increase 1 st at each edge every ${interval === 1 ? "row" : `${interval} rows`} ${count} times${extra} (${plan.taperRows} rows).`,
      stitchCount: plan.sleeveTopStitches,
    });
  } else if (plan.taperRows > 0) {
    steps.push({
      label: "Sleeve: body",
      instructionText: `Work even for ${plan.taperRows} rows.`,
      stitchCount: plan.sleeveTopStitches,
    });
  }
  steps.push({
    label: "Sleeve: top",
    instructionText: `${plan.topStraightRows > 0 ? `Work even for ${plan.topStraightRows} rows (${plan.sleeveRows} rows total), then bind` : "Bind"} off all ${plan.sleeveTopStitches} sts.`,
    stitchCount: 0,
  });
  steps.push({
    label: "Finishing",
    instructionText:
      "Seam the shoulders. Sew each sleeve top between the armhole markers, then seam the sides and sleeves.",
    stitchCount: 0,
  });

  return steps.map((step, index) => ({ stepNumber: index + 1, ...step }));
}
