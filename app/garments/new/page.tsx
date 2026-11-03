"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GaugeFields } from "@/components/forms/GaugeFields";
import { NumberField } from "@/components/forms/NumberField";
import { Section } from "@/components/forms/Section";
import { Segmented } from "@/components/forms/Segmented";
import {
  formatCount,
  parsePositive,
  toGauge,
  unitInches,
  type GaugeUnit,
} from "@/lib/gaugeUnits";
import {
  calculateGarmentPattern,
  calculateGarmentPlan,
  recalculateGaugeMidProject,
} from "@/lib/math/garmentMath";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type { CraftType, GarmentInputs } from "@/lib/types/project";

type Dimensions = Record<keyof GarmentInputs, string>;

const STANDARD: Dimensions = {
  chestWidthInches: "20",
  bodyLengthInches: "24",
  sleeveLengthInches: "18",
  sleeveUpperArmInches: "14",
  neckWidthInches: "8",
  easeInches: "4",
};

// A typical adult hoodie laid flat; ease is already built into the garment.
const HOODIE: Dimensions = {
  chestWidthInches: "22",
  bodyLengthInches: "26",
  sleeveLengthInches: "20",
  sleeveUpperArmInches: "16",
  neckWidthInches: "9",
  easeInches: "0",
};

const FIELDS: {
  key: keyof GarmentInputs;
  label: string;
  hint: string;
  hoodieHint: string;
}[] = [
  {
    key: "chestWidthInches",
    label: "Chest width",
    hint: "Across the front of the body",
    hoodieHint: "Lay flat; armpit to armpit",
  },
  {
    key: "bodyLengthInches",
    label: "Body length",
    hint: "Shoulder to hem",
    hoodieHint: "Top of shoulder seam to bottom hem",
  },
  {
    key: "sleeveLengthInches",
    label: "Sleeve length",
    hint: "Shoulder seam to cuff",
    hoodieHint: "Dropped shoulder seam to cuff edge",
  },
  {
    key: "sleeveUpperArmInches",
    label: "Upper arm",
    hint: "All the way around",
    hoodieHint: "Sleeve width just below the armpit × 2",
  },
  {
    key: "neckWidthInches",
    label: "Neck width",
    hint: "Opening across the top",
    hoodieHint: "Seam to seam where the hood attaches",
  },
  {
    key: "easeInches",
    label: "Ease",
    hint: "Extra room around the body",
    hoodieHint: "Already included in the hoodie",
  },
];

function parseDimensions(dims: Dimensions): GarmentInputs | null {
  const result = {} as GarmentInputs;
  for (const { key } of FIELDS) {
    const n = Number.parseFloat(dims[key]);
    if (!Number.isFinite(n) || n < 0 || (key !== "easeInches" && n === 0)) {
      return null;
    }
    result[key] = n;
  }
  return result;
}

function tryPlan(
  inputs: GarmentInputs | null,
  gauge: ReturnType<typeof toGauge>,
) {
  if (!inputs || !gauge) {
    return { plan: null, error: "Fill in every measurement and your gauge." };
  }
  try {
    return { plan: calculateGarmentPlan(inputs, gauge), error: null };
  } catch (e) {
    return { plan: null, error: (e as Error).message };
  }
}

export default function NewGarmentPage() {
  const router = useRouter();
  const hasHydrated = useProjectStore((s) => s.hasHydrated);
  const addProject = useProjectStore((s) => s.addProject);

  const [title, setTitle] = useState("");
  const [craftType, setCraftType] = useState<CraftType>("knitting");
  const [unit, setUnit] = useState<GaugeUnit>("per4");
  const [stitches, setStitches] = useState("20");
  const [rows, setRows] = useState("28");
  const [hoodieMode, setHoodieMode] = useState(false);
  const [dims, setDims] = useState<Dimensions>(STANDARD);
  const [savedDims, setSavedDims] = useState<Dimensions>(STANDARD);
  const [measuredStitches, setMeasuredStitches] = useState("");
  const [measuredInches, setMeasuredInches] = useState("");

  const gauge = toGauge(unit, stitches, rows);
  const inputs = parseDimensions(dims);
  const { plan, error } = tryPlan(inputs, gauge);

  const recalculated = (() => {
    const sts = parsePositive(measuredStitches);
    const inches = parsePositive(measuredInches);
    if (sts === null || inches === null) return null;
    const newGauge = recalculateGaugeMidProject(
      sts,
      inches,
      gauge ?? undefined,
    );
    return { gauge: newGauge, ...tryPlan(inputs, newGauge) };
  })();

  const changeUnit = (next: GaugeUnit) => {
    if (next === unit) return;
    const factor = unitInches(next) / unitInches(unit);
    const convert = (v: string) => {
      const n = parsePositive(v);
      return n === null ? v : formatCount(n * factor);
    };
    setStitches(convert(stitches));
    setRows(convert(rows));
    setUnit(next);
  };

  const toggleHoodie = () => {
    if (hoodieMode) {
      setDims(savedDims);
    } else {
      setSavedDims(dims);
      setDims(HOODIE);
    }
    setHoodieMode(!hoodieMode);
  };

  const applyRecalculated = () => {
    if (!recalculated) return;
    setStitches(
      formatCount(recalculated.gauge.stitchesPerInch * unitInches(unit)),
    );
    setMeasuredStitches("");
    setMeasuredInches("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputs || !gauge || !plan || !hasHydrated) return;
    const id = addProject({
      title: title.trim() || "Drop-shoulder sweater",
      craftType,
      category: "garment",
      gauge,
      garmentData: inputs,
      amigurumiShapes: [],
      colorworkData: null,
      hatData: null,
      sockData: null,
      instructions: calculateGarmentPattern(inputs, gauge),
    });
    router.push(`/project/${id}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Garment</h1>
        <p className="mt-1 text-sm text-muted">
          Drop-shoulder sweater: two rectangles and two tapered sleeves.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Project name
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Drop-shoulder sweater"
          className="min-h-11 rounded-lg border border-control bg-card px-3 text-base outline-none focus:border-accent"
        />
      </div>

      <Segmented
        label="Craft"
        value={craftType}
        onChange={setCraftType}
        options={[
          { value: "knitting", label: "Knitting" },
          { value: "crochet", label: "Crochet" },
        ]}
      />

      <Section
        title="Yarn gauge"
        description="Measured on your swatch or panel."
      >
        <GaugeFields
          unit={unit}
          stitches={stitches}
          rows={rows}
          onUnitChange={changeUnit}
          onStitchesChange={setStitches}
          onRowsChange={setRows}
        />
      </Section>

      <Section
        title="Sweater dimensions"
        description="All measurements in inches."
      >
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3">
          <span className="text-sm font-medium">Measure a favorite hoodie</span>
          <input
            type="checkbox"
            role="switch"
            checked={hoodieMode}
            onChange={toggleHoodie}
            className="h-5 w-5 accent-[var(--accent)]"
          />
        </label>
        {hoodieMode && (
          <p className="rounded-lg bg-apricot/35 p-3 text-xs">
            Lay your hoodie flat on a table and measure it as shown under each
            field. We filled in typical sizes to start.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((field) => (
            <NumberField
              key={field.key}
              id={field.key}
              label={field.label}
              value={dims[field.key]}
              onChange={(value) =>
                setDims((prev) => ({ ...prev, [field.key]: value }))
              }
              suffix="in"
              hint={hoodieMode ? field.hoodieHint : field.hint}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Mid-project gauge check"
        description="Knitting already? Measure your panel and we'll redo the numbers."
      >
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="measured-inches"
            label="Panel measures"
            value={measuredInches}
            onChange={setMeasuredInches}
            suffix="in"
          />
          <NumberField
            id="measured-stitches"
            label="Across"
            value={measuredStitches}
            onChange={setMeasuredStitches}
            suffix="sts"
          />
        </div>
        {recalculated && (
          <div className="flex flex-col gap-2 text-sm" aria-live="polite">
            <p>
              Your real gauge is{" "}
              <strong>
                {formatCount(
                  recalculated.gauge.stitchesPerInch * unitInches(unit),
                )}{" "}
                sts {unit === "per4" ? 'per 4"' : "per inch"}
              </strong>
              .
            </p>
            {plan && recalculated.plan && (
              <p className="text-muted">
                Panel: {plan.panelStitches} → {recalculated.plan.panelStitches}{" "}
                sts · Sleeve top: {plan.sleeveTopStitches} →{" "}
                {recalculated.plan.sleeveTopStitches} sts
              </p>
            )}
            <button
              type="button"
              onClick={applyRecalculated}
              className="min-h-11 rounded-lg border border-accent px-3 font-semibold text-accent"
            >
              Use this gauge
            </button>
          </div>
        )}
      </Section>

      <Section title="Your numbers">
        {plan ? (
          <dl
            className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm"
            aria-live="polite"
          >
            <dt className="text-muted">Front & back</dt>
            <dd className="text-right font-medium">
              {plan.panelStitches} sts each
            </dd>
            <dt className="text-muted">Body</dt>
            <dd className="text-right font-medium">{plan.bodyRows} rows</dd>
            <dt className="text-muted">Armhole marker</dt>
            <dd className="text-right font-medium">
              row {plan.armholeMarkerRow}
            </dd>
            <dt className="text-muted">Sleeve</dt>
            <dd className="text-right font-medium">
              {plan.sleeveCuffStitches} → {plan.sleeveTopStitches} sts
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        )}
      </Section>

      <button
        type="submit"
        disabled={!plan || !hasHydrated}
        className="min-h-12 rounded-xl bg-accent font-semibold text-accent-foreground disabled:opacity-40"
      >
        Create pattern
      </button>
    </form>
  );
}
