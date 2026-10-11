"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GaugeFields } from "@/components/forms/GaugeFields";
import { Section } from "@/components/forms/Section";
import { Segmented } from "@/components/forms/Segmented";
import { ShapeStackPreview } from "@/components/ShapeStackPreview";
import {
  formatCount,
  parsePositive,
  toGauge,
  unitInches,
  type GaugeUnit,
} from "@/lib/gaugeUnits";
import {
  calculateSpiralShape,
  maxStitchesForDiameter,
  planSpiralRounds,
} from "@/lib/math/amigurumiMath";
import { PIECE_SEPARATOR } from "@/lib/projectProgress";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type {
  AmigurumiShape,
  AmigurumiShapeType,
  CalculatedInstruction,
  Gauge,
} from "@/lib/types/project";

const SHAPE_TYPES: { value: AmigurumiShapeType; label: string }[] = [
  { value: "sphere", label: "Sphere" },
  { value: "cylinder", label: "Cylinder" },
  { value: "cone", label: "Cone" },
];

const newShape = (
  type: AmigurumiShapeType,
  name: string,
  maxDiameterInches = 2,
  heightInches = 2,
): AmigurumiShape => ({
  id: crypto.randomUUID(),
  type,
  name,
  maxDiameterInches,
  heightInches,
});

const pieceName = (shape: AmigurumiShape, index: number) =>
  shape.name.trim() || `Piece ${index + 1}`;

function buildInstructions(
  shapes: AmigurumiShape[],
  gauge: Gauge,
): CalculatedInstruction[] {
  return shapes
    .flatMap((shape, i) =>
      calculateSpiralShape(shape, gauge).map((step) => ({
        ...step,
        label: `${pieceName(shape, i)}${PIECE_SEPARATOR}${step.label}`,
      })),
    )
    .map((step, i) => ({ ...step, stepNumber: i + 1 }));
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="tabular-nums text-muted">{value}&quot;</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={0.25}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-[var(--accent)]"
      />
    </div>
  );
}

export default function NewAmigurumiPage() {
  const router = useRouter();
  const hasHydrated = useProjectStore((s) => s.hasHydrated);
  const addProject = useProjectStore((s) => s.addProject);

  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState<GaugeUnit>("per4");
  const [stitches, setStitches] = useState("20");
  const [rows, setRows] = useState("20");
  const [shapes, setShapes] = useState<AmigurumiShape[]>(() => [
    newShape("sphere", "Head", 3, 3),
    newShape("cylinder", "Body", 2.5, 3),
  ]);

  const gauge = toGauge(unit, stitches, rows);

  const update = (id: string, patch: Partial<AmigurumiShape>) =>
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        // Spheres have no height control; keep it in sync with the diameter.
        return next.type === "sphere"
          ? { ...next, heightInches: next.maxDiameterInches }
          : next;
      }),
    );

  const move = (index: number, delta: number) =>
    setShapes((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  const duplicate = (index: number) =>
    setShapes((prev) => {
      const copy = { ...prev[index], id: crypto.randomUUID() };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });

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

  const canSubmit = hasHydrated && gauge !== null && shapes.length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !gauge) return;
    const named = shapes.map((s, i) => ({ ...s, name: pieceName(s, i) }));
    const id = addProject({
      title: title.trim() || "Amigurumi friend",
      craftType: "crochet",
      category: "amigurumi",
      gauge,
      garmentData: null,
      amigurumiShapes: named,
      instructions: buildInstructions(named, gauge),
    });
    router.push(`/project/${id}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Amigurumi</h1>
        <p className="mt-1 text-sm text-muted">
          Stack spheres, cylinders and cones. Each piece becomes 6 × N spiral
          rounds.
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
          placeholder="Amigurumi friend"
          className="min-h-11 rounded-lg border border-control bg-card px-3 text-base outline-none focus:border-accent"
        />
      </div>

      <Section title="Crochet gauge" description="Single crochet in the round.">
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

      <Section title="Preview">
        <ShapeStackPreview shapes={shapes} />
        {shapes.length === 0 && (
          <p className="text-center text-sm text-muted">Add a piece below.</p>
        )}
      </Section>

      <ol className="flex flex-col gap-3">
        {shapes.map((shape, index) => {
          const summary = gauge
            ? `${maxStitchesForDiameter(shape.maxDiameterInches, gauge)} sts max · ${
                planSpiralRounds(shape, gauge).length
              } rounds`
            : null;
          return (
            <li
              key={shape.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2">
                <input
                  aria-label={`Piece ${index + 1} name`}
                  value={shape.name}
                  onChange={(e) => update(shape.id, { name: e.target.value })}
                  placeholder={`Piece ${index + 1}`}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-control bg-card px-3 text-base font-medium outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${pieceName(shape, index)} up`}
                  className="min-h-11 min-w-11 rounded-lg text-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === shapes.length - 1}
                  aria-label={`Move ${pieceName(shape, index)} down`}
                  className="min-h-11 min-w-11 rounded-lg text-muted disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              <Segmented
                label={`${pieceName(shape, index)} shape`}
                value={shape.type}
                options={SHAPE_TYPES}
                onChange={(type) => update(shape.id, { type })}
              />
              <Slider
                id={`${shape.id}-diameter`}
                label="Widest diameter"
                value={shape.maxDiameterInches}
                min={0.5}
                max={8}
                onChange={(maxDiameterInches) =>
                  update(shape.id, { maxDiameterInches })
                }
              />
              {shape.type !== "sphere" && (
                <Slider
                  id={`${shape.id}-height`}
                  label="Height"
                  value={shape.heightInches}
                  min={0.5}
                  max={10}
                  onChange={(heightInches) =>
                    update(shape.id, { heightInches })
                  }
                />
              )}
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted">{summary}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => duplicate(index)}
                    className="min-h-11 rounded-lg px-3 text-muted active:bg-border"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setShapes((prev) => prev.filter((s) => s.id !== shape.id))
                    }
                    className="min-h-11 rounded-lg px-3 text-muted active:bg-border"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-3 gap-2">
        {SHAPE_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setShapes((prev) => [...prev, newShape(value, "")])}
            className="min-h-11 rounded-lg border border-dashed border-border text-sm font-medium"
          >
            + {label}
          </button>
        ))}
      </div>

      {!gauge && (
        <p className="text-sm text-accent" role="alert">
          Enter your gauge to see the rounds.
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
