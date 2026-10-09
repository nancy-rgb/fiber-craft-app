import type { Gauge } from "@/lib/types/project";

export type GaugeUnit = "per4" | "perInch";

export const unitInches = (unit: GaugeUnit) => (unit === "per4" ? 4 : 1);

export function parsePositive(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function toGauge(
  unit: GaugeUnit,
  stitches: string,
  rows: string,
): Gauge | null {
  const sts = parsePositive(stitches);
  const rws = parsePositive(rows);
  if (sts === null || rws === null) return null;
  return {
    stitchesPerInch: sts / unitInches(unit),
    rowsPerInch: rws / unitInches(unit),
  };
}

export const formatCount = (n: number) => String(Number(n.toFixed(2)));
