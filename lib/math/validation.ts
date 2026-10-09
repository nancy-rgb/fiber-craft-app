import type { Gauge } from "@/lib/types/project";

export function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number (got ${value})`);
  }
}

export function assertValidGauge(gauge: Gauge): void {
  assertPositive(gauge.stitchesPerInch, "gauge.stitchesPerInch");
  assertPositive(gauge.rowsPerInch, "gauge.rowsPerInch");
}

export const formatInches = (inches: number) => `${Number(inches.toFixed(1))}"`;
