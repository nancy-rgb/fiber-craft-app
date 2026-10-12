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
  calculateAssembly,
  calculateSpiralShape,
  maxStitchesForDiameter,
  planSpiralRounds,
} from "@/lib/math/amigurumiMath";
import { PIECE_SEPARATOR } from "@/lib/projectProgress";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type {
  AmigurumiShape,
  AmigurumiShapeType,
  AttachmentPosition,
  CalculatedInstruction,
  FacialFeature,
  Gauge,
  StripeSegment,
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
    .concat(
      calculateAssembly(shapes, gauge, pieceName).map((step) => ({
        ...step,
        label: `Assembly${PIECE_SEPARATOR}${step.label}`,
      })),
    )
    .map((step, i) => ({ ...step, stepNumber: i + 1 }));
}

const DEFAULT_STRIPES: StripeSegment[] = [
  { colorName: "Cream", hex: "#f7f3eb", rounds: 2 },
  { colorName: "Rose", hex: "#d7a6a0", rounds: 2 },
];
const EXTRA_STRIPE_HEXES = ["#526147", "#f0be98", "#302a26", "#963f2d"];
const MAX_STRIPES = 6;

const FEATURES: { value: FacialFeature; label: string }[] = [
  { value: "nose", label: "Nose" },
  { value: "mouth", label: "Mouth" },
  { value: "cheeks", label: "Cheeks" },
];

const POSITIONS: { value: AttachmentPosition; label: string }[] = [
  { value: "side", label: "Side (arms)" },
  { value: "top", label: "Top (ears)" },
  { value: "bottom", label: "Bottom (legs)" },
  { value: "front", label: "Front (snout)" },
  { value: "back", label: "Back (tail)" },
];

function safeRounds(shape: AmigurumiShape, gauge: Gauge | null) {
  if (!gauge) return null;
  try {
    return planSpiralRounds(shape, gauge);
  } catch {
    return null;
  }
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
      {label}
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-[var(--accent)]"
      />
    </label>
  );
}

function IntField({
  id,
  label,
  value,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center rounded-lg border border-control bg-card focus-within:border-accent">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          step={1}
          value={value}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (e.target.value !== "" && Number.isFinite(n)) {
              onChange(Math.min(max, Math.max(1, n)));
            }
          }}
          className="min-h-11 w-full min-w-0 bg-transparent px-2 text-base tabular-nums outline-none"
        />
        {suffix && (
          <span className="shrink-0 pr-2 text-xs text-muted">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function PieceExtras({
  shape,
  shapes,
  gauge,
  onChange,
}: {
  shape: AmigurumiShape;
  shapes: AmigurumiShape[];
  gauge: Gauge | null;
  onChange: (patch: Partial<AmigurumiShape>) => void;
}) {
  const rounds = safeRounds(shape, gauge);
  const others = shapes
    .map((s, i) => ({ shape: s, label: pieceName(s, i) }))
    .filter((o) => o.shape.id !== shape.id);
  const { eyes, stripes, attachment } = shape;
  const features = shape.facialFeatures ?? [];
  const eyeRound =
    eyes && rounds
      ? Math.min(rounds.length, Math.max(1, eyes.eyePlacementRound))
      : null;
  const target = attachment
    ? others.find((o) => o.shape.id === attachment.targetPieceId)
    : undefined;
  const targetRounds = target ? safeRounds(target.shape, gauge) : null;

  const toggleEyes = (on: boolean) => {
    if (!on) return onChange({ eyes: null, facialFeatures: [] });
    const round = rounds ? Math.max(1, Math.round(rounds.length * 0.45)) : 6;
    const sts = rounds?.[round - 1]?.stitches ?? 36;
    onChange({
      eyes: {
        eyeSizeMm: 9,
        eyePlacementRound: round,
        eyeDistanceStitches: Math.max(2, Math.round(sts / 6)),
      },
    });
  };

  const attachTo = (targetPieceId: string) => {
    const t = others.find((o) => o.shape.id === targetPieceId)?.shape;
    if (!t) return;
    const tr = safeRounds(t, gauge);
    onChange({
      attachment: {
        targetPieceId,
        round: tr ? Math.ceil(tr.length / 2) : 4,
        position: attachment?.position ?? "side",
      },
    });
  };

  const setStripe = (i: number, patch: Partial<StripeSegment>) =>
    stripes &&
    onChange({
      stripes: stripes.map((seg, j) => (j === i ? { ...seg, ...patch } : seg)),
    });

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2">
      <Toggle label="Safety eyes" checked={!!eyes} onChange={toggleEyes} />
      {eyes && (
        <div className="flex flex-col gap-3 rounded-lg bg-oat/50 p-3">
          <div className="grid grid-cols-3 gap-2">
            <IntField
              id={`${shape.id}-eye-size`}
              label="Size"
              suffix="mm"
              value={eyes.eyeSizeMm}
              max={30}
              onChange={(eyeSizeMm) =>
                onChange({ eyes: { ...eyes, eyeSizeMm } })
              }
            />
            <IntField
              id={`${shape.id}-eye-round`}
              label="Round"
              value={eyes.eyePlacementRound}
              max={rounds?.length ?? 99}
              onChange={(eyePlacementRound) =>
                onChange({ eyes: { ...eyes, eyePlacementRound } })
              }
            />
            <IntField
              id={`${shape.id}-eye-distance`}
              label="Apart"
              suffix="sts"
              value={eyes.eyeDistanceStitches}
              max={rounds ? Math.max(...rounds.map((r) => r.stitches)) - 2 : 99}
              onChange={(eyeDistanceStitches) =>
                onChange({ eyes: { ...eyes, eyeDistanceStitches } })
              }
            />
          </div>
          {rounds && eyeRound && (
            <p className="text-xs text-muted">
              Rnd {eyeRound} of {rounds.length} has{" "}
              {rounds[eyeRound - 1].stitches} sts. Eyes are centered on the
              front.
            </p>
          )}
          <fieldset>
            <legend className="text-sm font-medium">Face details</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {FEATURES.map((f) => (
                <label
                  key={f.value}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-control bg-card px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={features.includes(f.value)}
                    onChange={(e) =>
                      onChange({
                        facialFeatures: e.target.checked
                          ? [...features, f.value]
                          : features.filter((x) => x !== f.value),
                      })
                    }
                    className="size-4 accent-[var(--accent)]"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      <Toggle
        label="Stripes"
        checked={!!stripes}
        onChange={(on) =>
          onChange({
            stripes: on ? DEFAULT_STRIPES.map((s) => ({ ...s })) : null,
          })
        }
      />
      {stripes && (
        <div className="flex flex-col gap-2 rounded-lg bg-oat/50 p-3">
          <p className="text-xs text-muted">
            Repeats from Rnd 1. Color changes are written as jogless.
          </p>
          {stripes.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Stripe ${i + 1} color`}
                value={seg.hex}
                onChange={(e) => setStripe(i, { hex: e.target.value })}
                className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-control bg-card p-1"
              />
              <input
                aria-label={`Stripe ${i + 1} yarn name`}
                value={seg.colorName}
                onChange={(e) => setStripe(i, { colorName: e.target.value })}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-control bg-card px-2 text-base outline-none focus:border-accent"
              />
              <input
                type="number"
                inputMode="numeric"
                aria-label={`Stripe ${i + 1} rounds`}
                min={1}
                max={50}
                value={seg.rounds}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  if (e.target.value !== "" && n >= 1)
                    setStripe(i, { rounds: Math.min(50, n) });
                }}
                className="min-h-11 w-14 shrink-0 rounded-lg border border-control bg-card px-2 text-base tabular-nums outline-none focus:border-accent"
              />
              <button
                type="button"
                aria-label={`Remove stripe ${i + 1}`}
                disabled={stripes.length <= 2}
                onClick={() =>
                  onChange({ stripes: stripes.filter((_, j) => j !== i) })
                }
                className="min-h-11 min-w-8 shrink-0 text-muted disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
          {stripes.length < MAX_STRIPES && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  stripes: [
                    ...stripes,
                    {
                      colorName: `Color ${stripes.length + 1}`,
                      hex: EXTRA_STRIPE_HEXES[
                        (stripes.length - 2) % EXTRA_STRIPE_HEXES.length
                      ],
                      rounds: 2,
                    },
                  ],
                })
              }
              className="min-h-11 rounded-lg border border-dashed border-control text-sm font-medium"
            >
              + Add stripe color
            </button>
          )}
        </div>
      )}

      {others.length > 0 && (
        <>
          <Toggle
            label="Attach to another piece"
            checked={!!attachment}
            onChange={(on) =>
              on ? attachTo(others[0].shape.id) : onChange({ attachment: null })
            }
          />
          {attachment && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-oat/50 p-3">
              <label className="col-span-2 flex flex-col gap-1 text-sm font-medium">
                Attach to
                <select
                  value={attachment.targetPieceId}
                  onChange={(e) => attachTo(e.target.value)}
                  className="min-h-11 rounded-lg border border-control bg-card px-2 text-base"
                >
                  {others.map((o) => (
                    <option key={o.shape.id} value={o.shape.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm font-medium">
                Position
                <select
                  value={attachment.position}
                  onChange={(e) =>
                    onChange({
                      attachment: {
                        ...attachment,
                        position: e.target.value as AttachmentPosition,
                      },
                    })
                  }
                  className="min-h-11 min-w-0 rounded-lg border border-control bg-card px-2 text-base"
                >
                  {POSITIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {attachment.position !== "top" &&
                attachment.position !== "bottom" && (
                  <IntField
                    id={`${shape.id}-attach-round`}
                    label="On round"
                    value={attachment.round}
                    max={targetRounds?.length ?? 99}
                    onChange={(round) =>
                      onChange({ attachment: { ...attachment, round } })
                    }
                  />
                )}
              {target && targetRounds && (
                <p className="col-span-2 text-xs text-muted">
                  {target.label} has {targetRounds.length} rounds.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
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
      hatData: null,
      amigurumiShapes: named,
      colorworkData: null,
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
              <PieceExtras
                shape={shape}
                shapes={shapes}
                gauge={gauge}
                onChange={(patch) => update(shape.id, patch)}
              />
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
                      setShapes((prev) =>
                        prev
                          .filter((s) => s.id !== shape.id)
                          .map((s) =>
                            s.attachment?.targetPieceId === shape.id
                              ? { ...s, attachment: null }
                              : s,
                          ),
                      )
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
