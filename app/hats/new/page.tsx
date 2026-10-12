"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GaugeFields } from "@/components/forms/GaugeFields";
import { Section } from "@/components/forms/Section";
import { Segmented } from "@/components/forms/Segmented";
import { HatPreview } from "@/components/HatPreview";
import {
  formatCount,
  parsePositive,
  toGauge,
  unitInches,
  type GaugeUnit,
} from "@/lib/gaugeUnits";
import {
  calculateHatPattern,
  calculateHatPlan,
  HEAD_PRESETS,
} from "@/lib/math/hatMath";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type {
  HatBodyStyle,
  HatBrimStyle,
  HatCrownStyle,
  HatInputs,
  HatRibbing,
} from "@/lib/types/project";

const BRIMS: { value: HatBrimStyle; label: string; hint: string }[] = [
  { value: "none", label: "No brim", hint: "Roll or plain edge" },
  { value: "single", label: "Single", hint: "Classic ribbed band" },
  { value: "folded", label: "Folded", hint: "Deep double brim" },
];

const BODIES: { value: HatBodyStyle; label: string; hint: string }[] = [
  { value: "fitted", label: "Fitted", hint: "Snug, close to the head" },
  { value: "standard", label: "Standard", hint: "Everyday beanie" },
  { value: "slouchy", label: "Slouchy", hint: "Extra room at the back" },
  { value: "balloon", label: "Balloon", hint: "Puffy silhouette" },
];

const CROWNS: { value: HatCrownStyle; label: string; hint: string }[] = [
  { value: "dome", label: "Dome", hint: "Wedge decreases, classic top" },
  { value: "long-tail", label: "Long tail", hint: "Slow tapering elf tip" },
  {
    value: "square-cat-ear",
    label: "Cat ear",
    hint: "Flat top, pointy corners",
  },
  { value: "cinch", label: "Cinch", hint: "Drawstring gathered top" },
];

const RIBBINGS: { value: HatRibbing; label: string }[] = [
  { value: "1x1", label: "1×1 rib" },
  { value: "2x2", label: "2×2 rib" },
  { value: "garter", label: "Garter" },
];

function OptionCards<T extends string>({
  legend,
  options,
  value,
  onChange,
  cols = 2,
}: {
  legend: string;
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (value: T) => void;
  cols?: 2 | 4;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div
        className={`grid gap-2 ${cols === 4 ? "grid-cols-4" : "grid-cols-2"}`}
      >
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`flex min-h-14 flex-col items-start rounded-xl border-2 px-3 py-2 text-left ${
                active
                  ? "border-accent bg-card"
                  : "border-border bg-card text-muted"
              }`}
            >
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="text-xs text-muted">{o.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function NewHatPage() {
  const router = useRouter();
  const hasHydrated = useProjectStore((s) => s.hasHydrated);
  const addProject = useProjectStore((s) => s.addProject);

  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState<GaugeUnit>("per4");
  const [stitches, setStitches] = useState("20");
  const [rows, setRows] = useState("26");
  const [inputs, setInputs] = useState<HatInputs>({
    headCircumferenceInches: 21,
    brimStyle: "single",
    ribbingType: "2x2",
    bodyStyle: "standard",
    crownStyle: "dome",
    tailLengthInches: 5,
  });

  const gauge = toGauge(unit, stitches, rows);
  const patch = (p: Partial<HatInputs>) =>
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

  const plan = gauge ? calculateHatPlan(inputs, gauge) : null;
  const canSubmit = hasHydrated && gauge !== null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !gauge) return;
    const data: HatInputs = { ...inputs };
    if (data.crownStyle !== "long-tail") delete data.tailLengthInches;
    const id = addProject({
      title:
        title.trim() ||
        `${BODIES.find((b) => b.value === data.bodyStyle)?.label ?? ""} hat`,
      craftType: "knitting",
      category: "hat",
      gauge,
      garmentData: null,
      hatData: data,
      amigurumiShapes: [],
      colorworkData: null,
      instructions: calculateHatPattern(data, gauge),
    });
    router.push(`/project/${id}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Hat</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a look, set your gauge, get row-by-row instructions.
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
          placeholder="Everyday beanie"
          className="min-h-11 rounded-lg border border-control bg-card px-3 text-base outline-none focus:border-accent"
        />
      </div>

      <Section
        title="Head circumference"
        description="Includes negative ease — cast-on comes out smaller than the head."
      >
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Around the head</span>
          <span className="tabular-nums text-muted">
            {inputs.headCircumferenceInches}&quot;
          </span>
        </div>
        <input
          type="range"
          aria-label="Head circumference in inches"
          min={12}
          max={26}
          step={0.5}
          value={inputs.headCircumferenceInches}
          onChange={(e) =>
            patch({ headCircumferenceInches: Number(e.target.value) })
          }
          className="h-8 w-full accent-[var(--accent)]"
        />
        <div className="grid grid-cols-4 gap-1.5">
          {HEAD_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => patch({ headCircumferenceInches: p.inches })}
              className={`min-h-10 rounded-lg border text-xs font-medium ${
                inputs.headCircumferenceInches === p.inches
                  ? "border-accent bg-card"
                  : "border-border bg-card text-muted"
              }`}
            >
              {p.label}
              <span className="block text-[10px]">{p.inches}&quot;</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Brim">
        <OptionCards
          legend="Brim style"
          options={BRIMS}
          value={inputs.brimStyle}
          onChange={(brimStyle) => patch({ brimStyle })}
        />
        {inputs.brimStyle !== "none" && (
          <Segmented
            label="Ribbing"
            value={inputs.ribbingType}
            options={RIBBINGS}
            onChange={(ribbingType) => patch({ ribbingType })}
          />
        )}
      </Section>

      <Section title="Body">
        <OptionCards
          legend="Body style"
          options={BODIES}
          value={inputs.bodyStyle}
          onChange={(bodyStyle) => patch({ bodyStyle })}
        />
      </Section>

      <Section title="Crown">
        <OptionCards
          legend="Crown shape"
          options={CROWNS}
          value={inputs.crownStyle}
          onChange={(crownStyle) => patch({ crownStyle })}
        />
        {inputs.crownStyle === "long-tail" && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="tail-length" className="font-medium">
                Tail length
              </label>
              <span className="tabular-nums text-muted">
                {inputs.tailLengthInches}&quot;
              </span>
            </div>
            <input
              id="tail-length"
              type="range"
              min={3}
              max={10}
              step={0.5}
              value={inputs.tailLengthInches}
              onChange={(e) =>
                patch({ tailLengthInches: Number(e.target.value) })
              }
              className="h-8 w-full accent-[var(--accent)]"
            />
          </div>
        )}
      </Section>

      <Section title="Knitting gauge" description="Stockinette in the round.">
        <GaugeFields
          unit={unit}
          stitches={stitches}
          rows={rows}
          onUnitChange={changeUnit}
          onStitchesChange={setStitches}
          onRowsChange={setRows}
        />
      </Section>

      <Section title="Preview">
        <HatPreview inputs={inputs} />
        {plan && (
          <p className="text-center text-sm text-muted">
            {plan.castOn} sts to cast on · ~{Math.round(plan.totalHeightInches)}
            &quot; tall · {plan.brimRounds + plan.bodyRounds + plan.crownRounds}{" "}
            rounds
          </p>
        )}
      </Section>

      {!gauge && (
        <p className="text-sm text-accent" role="alert">
          Enter your gauge to see the pattern.
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
