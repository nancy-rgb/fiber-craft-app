"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GaugeFields } from "@/components/forms/GaugeFields";
import { NumberField } from "@/components/forms/NumberField";
import { Section } from "@/components/forms/Section";
import { Segmented } from "@/components/forms/Segmented";
import { Switch } from "@/components/ui/switch";
import {
  formatCount,
  parsePositive,
  toGauge,
  unitInches,
  type GaugeUnit,
} from "@/lib/gaugeUnits";
import {
  calculateSockPattern,
  calculateSockPlan,
  CUFF_PRESETS,
  DEFAULT_NEGATIVE_EASE_PERCENT,
  FOOT_CIRCUMFERENCE_PRESETS,
  SHOE_SIZES,
  shoeSizeToFootLength,
  type ShoeSizeSystem,
} from "@/lib/math/sockMath";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type { SockInputs } from "@/lib/types/project";

function Slider({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="tabular-nums text-muted">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-[var(--accent)]"
      />
    </div>
  );
}

function Presets({
  presets,
  value,
  onPick,
}: {
  presets: { label: string; inches: number }[];
  value: number;
  onPick: (inches: number) => void;
}) {
  return (
    <div
      className={`grid gap-1.5 ${presets.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}
    >
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          aria-pressed={value === p.inches}
          onClick={() => onPick(p.inches)}
          className={`min-h-10 rounded-lg border text-xs font-medium ${
            value === p.inches
              ? "border-accent bg-card"
              : "border-border bg-card text-muted"
          }`}
        >
          {p.label}
          <span className="block text-[10px]">{p.inches}&quot;</span>
        </button>
      ))}
    </div>
  );
}

export default function NewSockPage() {
  const router = useRouter();
  const hasHydrated = useProjectStore((s) => s.hasHydrated);
  const addProject = useProjectStore((s) => s.addProject);

  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState<GaugeUnit>("per4");
  const [stitches, setStitches] = useState("32");
  const [rows, setRows] = useState("44");
  const [footLength, setFootLength] = useState("9.25");
  const [shoeSystem, setShoeSystem] = useState<ShoeSizeSystem>("women");
  const [shoeSize, setShoeSize] = useState("");
  const [inputs, setInputs] = useState<Omit<SockInputs, "footLengthInches">>({
    footCircumferenceInches: 8.5,
    cuffLengthInches: 6,
    negativeEasePercent: DEFAULT_NEGATIVE_EASE_PERCENT,
    contrastingHeel: false,
    contrastingToe: false,
  });

  const gauge = toGauge(unit, stitches, rows);
  const footLengthInches = parsePositive(footLength);
  const patch = (p: Partial<SockInputs>) =>
    setInputs((prev) => ({ ...prev, ...p }));

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

  const pickShoeSize = (size: string, system = shoeSystem) => {
    setShoeSize(size);
    if (size) {
      setFootLength(formatCount(shoeSizeToFootLength(Number(size), system)));
    }
  };

  const data: SockInputs | null =
    footLengthInches === null ? null : { ...inputs, footLengthInches };
  let plan = null;
  try {
    plan = gauge && data ? calculateSockPlan(data, gauge) : null;
  } catch {
    plan = null;
  }
  const canSubmit = hasHydrated && plan !== null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !gauge || !data) return;
    const id = addProject({
      title: title.trim() || "Top-down socks",
      craftType: "knitting",
      category: "sock",
      gauge,
      garmentData: null,
      hatData: null,
      sockData: data,
      amigurumiShapes: [],
      colorworkData: null,
      instructions: calculateSockPattern(data, gauge),
    });
    router.push(`/project/${id}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Socks</h1>
        <p className="mt-1 text-sm text-muted">
          Top-down with a heel flap, gusset and wedge toe — sized to your foot.
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
          placeholder="Everyday socks"
          className="min-h-11 rounded-lg border border-control bg-card px-3 text-base outline-none focus:border-accent"
        />
      </div>

      <Section
        title="Foot circumference"
        description="Measure around the ball of the foot."
      >
        <Slider
          id="foot-circumference"
          label="Around the foot"
          value={inputs.footCircumferenceInches}
          display={`${inputs.footCircumferenceInches}"`}
          min={5}
          max={12}
          step={0.25}
          onChange={(footCircumferenceInches) =>
            patch({ footCircumferenceInches })
          }
        />
        <Presets
          presets={FOOT_CIRCUMFERENCE_PRESETS}
          value={inputs.footCircumferenceInches}
          onPick={(footCircumferenceInches) =>
            patch({ footCircumferenceInches })
          }
        />
        <Slider
          id="negative-ease"
          label="Negative ease"
          value={inputs.negativeEasePercent}
          display={`${inputs.negativeEasePercent}%`}
          min={0}
          max={20}
          step={1}
          onChange={(negativeEasePercent) => patch({ negativeEasePercent })}
        />
      </Section>

      <Section
        title="Foot length"
        description="Heel to the tip of the longest toe, or pick a US shoe size."
      >
        <NumberField
          id="foot-length"
          label="Foot length"
          value={footLength}
          onChange={(v) => {
            setFootLength(v);
            setShoeSize("");
          }}
          suffix="in"
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="shoe-size" className="text-sm font-medium">
              US shoe size
            </label>
            <select
              id="shoe-size"
              value={shoeSize}
              onChange={(e) => pickShoeSize(e.target.value)}
              className="min-h-11 rounded-lg border border-control bg-card px-3 text-base outline-none focus:border-accent"
            >
              <option value="">—</option>
              {SHOE_SIZES[shoeSystem].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Segmented
            label="Shoe size system"
            value={shoeSystem}
            options={[
              { value: "women", label: "Women" },
              { value: "men", label: "Men" },
            ]}
            onChange={(system) => {
              setShoeSystem(system);
              if (shoeSize && SHOE_SIZES[system].includes(Number(shoeSize))) {
                pickShoeSize(shoeSize, system);
              } else {
                setShoeSize("");
              }
            }}
          />
        </div>
      </Section>

      <Section
        title="Leg"
        description="From the cast-on edge to the top of the heel."
      >
        <Slider
          id="cuff-length"
          label="Leg length"
          value={inputs.cuffLengthInches}
          display={`${inputs.cuffLengthInches}"`}
          min={1}
          max={10}
          step={0.5}
          onChange={(cuffLengthInches) => patch({ cuffLengthInches })}
        />
        <Presets
          presets={CUFF_PRESETS}
          value={inputs.cuffLengthInches}
          onPick={(cuffLengthInches) => patch({ cuffLengthInches })}
        />
      </Section>

      <Section
        title="Colors"
        description="Knit the heel and/or toe in a contrast color (CC)."
      >
        {(
          [
            ["contrastingHeel", "Use Contrasting Heel"],
            ["contrastingToe", "Use Contrasting Toe"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <label htmlFor={key} className="text-sm font-medium">
              {label}
            </label>
            <Switch
              id={key}
              checked={inputs[key] ?? false}
              onCheckedChange={(checked) => patch({ [key]: checked })}
            />
          </div>
        ))}
      </Section>

      <Section title="Knitting gauge" description="Stockinette in the round.">
        <GaugeFields
          unit={unit}
          stitches={stitches}
          rows={rows}
          rowLabel="Rounds"
          onUnitChange={changeUnit}
          onStitchesChange={setStitches}
          onRowsChange={setRows}
        />
      </Section>

      {plan && (
        <Section title="Your sock">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Cast on", `${plan.castOn} sts`],
              [
                "Heel flap",
                `${plan.heelFlapStitches} sts × ${plan.heelFlapRows} rows`,
              ],
              ["Heel turn", `${plan.heelTurnStitches} sts left`],
              [
                "Gusset",
                `+${plan.gussetPickupPerSide} each side, ${plan.gussetDecreaseRounds} decs`,
              ],
              ["Foot to toe", `${plan.footLengthBeforeToeInches}"`],
              ["Kitchener", `${plan.finalToeStitches} sts`],
            ].map(([term, value]) => (
              <div key={term} className="rounded-lg bg-card px-3 py-2">
                <dt className="text-xs text-muted">{term}</dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {!plan && (
        <p className="text-sm text-accent" role="alert">
          Enter your gauge and foot length to see the pattern.
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-12 rounded-xl bg-accent font-semibold text-accent-foreground disabled:opacity-40"
      >
        Create pattern
      </button>
    </form>
  );
}
