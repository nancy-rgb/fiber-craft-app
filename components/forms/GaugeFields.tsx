import type { GaugeUnit } from "@/lib/gaugeUnits";
import { NumberField } from "./NumberField";
import { Segmented } from "./Segmented";

interface GaugeFieldsProps {
  unit: GaugeUnit;
  stitches: string;
  rows: string;
  rowLabel?: string;
  onUnitChange: (unit: GaugeUnit) => void;
  onStitchesChange: (value: string) => void;
  onRowsChange: (value: string) => void;
}

export function GaugeFields({
  unit,
  stitches,
  rows,
  rowLabel = "Rows",
  onUnitChange,
  onStitchesChange,
  onRowsChange,
}: GaugeFieldsProps) {
  const suffix = unit === "per4" ? 'per 4"' : "per inch";
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label="Gauge unit"
        value={unit}
        onChange={onUnitChange}
        options={[
          { value: "per4", label: 'Per 4"' },
          { value: "perInch", label: "Per inch" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id="gauge-stitches"
          label="Stitches"
          value={stitches}
          onChange={onStitchesChange}
          suffix={suffix}
        />
        <NumberField
          id="gauge-rows"
          label={rowLabel}
          value={rows}
          onChange={onRowsChange}
          suffix={suffix}
        />
      </div>
    </div>
  );
}
