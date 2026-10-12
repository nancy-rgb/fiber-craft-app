"use client";

import { Camera, Images } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ColorworkChart } from "@/components/ColorworkChart";
import { GaugeFields } from "@/components/forms/GaugeFields";
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
  cellAspect,
  colorAbbreviations,
  createGrid,
  floodFill,
  generateColorworkInstructions,
  paintCell,
  proportionalRows,
  quantizeImageToGrid,
  replaceColor,
  resizeGrid,
} from "@/lib/math/colorworkMath";
import { formatInches } from "@/lib/math/validation";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type { CraftType, YarnColor } from "@/lib/types/project";

type Tab = "draw" | "image";
type Tool = "brush" | "fill" | "eraser" | "picker";

const MIN_COLORS = 2;
const MAX_COLORS = 6;
const MIN_SIZE = 4;
const MAX_WIDTH = 80;
const MAX_HEIGHT = 100;
const COLOR_IDS = ["a", "b", "c", "d", "e", "f"];
const PRESET_COLORS = [
  { name: "Cream", hex: "#f4ede1" },
  { name: "Navy", hex: "#2f3e5c" },
  { name: "Brick", hex: "#b5523b" },
  { name: "Sage", hex: "#7a8b5a" },
  { name: "Mustard", hex: "#e3b04b" },
  { name: "Plum", hex: "#6b4e71" },
];
const TOOLS: { value: Tool; label: string }[] = [
  { value: "brush", label: "Brush" },
  { value: "fill", label: "Fill" },
  { value: "eraser", label: "Eraser" },
  { value: "picker", label: "Picker" },
];

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

// Downscale first: quantizing averages blocks anyway, and big phone photos
// would otherwise make every slider drag slow.
async function readImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return {
    data: ctx.getImageData(0, 0, canvas.width, canvas.height),
    url: URL.createObjectURL(file),
  };
}

function SizeSlider({
  id,
  label,
  value,
  max,
  unit,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  unit: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="tabular-nums text-muted">
          {value} {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_SIZE}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full accent-[var(--accent)] disabled:opacity-40"
      />
    </div>
  );
}

export default function NewColorworkPage() {
  const router = useRouter();
  const hasHydrated = useProjectStore((s) => s.hasHydrated);
  const addProject = useProjectStore((s) => s.addProject);

  const [title, setTitle] = useState("");
  const [craftType, setCraftType] = useState<CraftType>("knitting");
  const [unit, setUnit] = useState<GaugeUnit>("per4");
  const [stitches, setStitches] = useState("24");
  const [rows, setRows] = useState("28");
  const [workedInRound, setWorkedInRound] = useState(false);
  const [palette, setPalette] = useState<YarnColor[]>(() =>
    PRESET_COLORS.slice(0, 2).map((c, i) => ({ id: COLOR_IDS[i], ...c })),
  );
  const [activeColor, setActiveColor] = useState(COLOR_IDS[1]);
  const [tool, setTool] = useState<Tool>("brush");
  const [tab, setTab] = useState<Tab>("image");
  const [width, setWidth] = useState(24);
  const [height, setHeight] = useState(20);
  const [cells, setCells] = useState(() => createGrid(24, 20, COLOR_IDS[0]));
  const [image, setImage] = useState<{ data: ImageData; url: string } | null>(
    null,
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const [keepProportions, setKeepProportions] = useState(true);
  const [clearArmed, setClearArmed] = useState(false);

  const gauge = toGauge(unit, stitches, rows);
  const aspect = gauge ? cellAspect(gauge) : 1;
  const abbreviations = colorAbbreviations(palette);
  const background = palette[0].id;

  const lockedHeight =
    tab === "image" && image && keepProportions && gauge
      ? clamp(
          proportionalRows(width, image.data.width, image.data.height, gauge),
          MIN_SIZE,
          MAX_HEIGHT,
        )
      : null;
  const targetHeight = lockedHeight ?? height;

  const converted = useMemo(
    () =>
      tab === "image" && image
        ? quantizeImageToGrid(image.data, width, targetHeight, palette)
        : null,
    [tab, image, width, targetHeight, palette],
  );
  const grid = converted ?? cells;

  useEffect(() => {
    if (!image) return;
    return () => URL.revokeObjectURL(image.url);
  }, [image]);

  useEffect(() => {
    if (!clearArmed) return;
    const timer = setTimeout(() => setClearArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [clearArmed]);

  const resize = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
    if (!converted) setCells((prev) => resizeGrid(prev, w, h, background));
  };

  const changeTab = (next: Tab) => {
    // Leaving the image tab keeps the converted chart for touch-ups.
    if (next === "draw" && converted) {
      setCells(converted);
      setHeight(converted.length);
    }
    setTab(next);
  };

  const paint = (row: number, col: number, start: boolean) => {
    if (tool === "brush") setCells((g) => paintCell(g, row, col, activeColor));
    else if (tool === "eraser")
      setCells((g) => paintCell(g, row, col, background));
    else if (!start) return;
    else if (tool === "fill")
      setCells((g) => floodFill(g, row, col, activeColor));
    else {
      setActiveColor(cells[row][col]);
      setTool("brush");
    }
  };

  const addColor = () => {
    const id = COLOR_IDS.find((i) => !palette.some((c) => c.id === i));
    if (!id || palette.length >= MAX_COLORS) return;
    const preset =
      PRESET_COLORS.find((p) => !palette.some((c) => c.hex === p.hex)) ??
      PRESET_COLORS[palette.length % PRESET_COLORS.length];
    setPalette([...palette, { id, ...preset }]);
    setActiveColor(id);
  };

  const removeColor = (id: string) => {
    if (palette.length <= MIN_COLORS) return;
    const next = palette.filter((c) => c.id !== id);
    setCells((g) => replaceColor(g, id, next[0].id));
    if (activeColor === id) setActiveColor(next[0].id);
    setPalette(next);
  };

  const updateColor = (id: string, patch: Partial<YarnColor>) =>
    setPalette((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );

  const clear = () => {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearArmed(false);
    setCells(createGrid(width, height, background));
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    try {
      setImage(await readImage(file));
    } catch {
      setImageError("Couldn't read that image. Try a JPG or PNG.");
    }
  };

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

  const canSubmit = hasHydrated && gauge !== null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !gauge) return;
    const id = addProject({
      title: title.trim() || "Colorwork chart",
      craftType,
      category: "colorwork",
      gauge,
      garmentData: null,
      hatData: null,
      amigurumiShapes: [],
      colorworkData: {
        width: grid[0].length,
        height: grid.length,
        palette,
        cells: grid,
        workedInRound,
      },
      instructions: generateColorworkInstructions(grid, palette, workedInRound),
    });
    router.push(`/project/${id}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Colorwork</h1>
        <p className="mt-1 text-sm text-muted">
          Draw a pixel chart or turn a photo into one.
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
          placeholder="Colorwork chart"
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
        title="Gauge & shape"
        description="Chart squares are drawn at your stitch-to-row ratio so the picture doesn't stretch."
      >
        <GaugeFields
          unit={unit}
          stitches={stitches}
          rows={rows}
          onUnitChange={changeUnit}
          onStitchesChange={setStitches}
          onRowsChange={setRows}
        />
        <Segmented
          label="Worked"
          value={workedInRound ? "round" : "flat"}
          onChange={(v) => setWorkedInRound(v === "round")}
          options={[
            { value: "flat", label: "Worked flat" },
            { value: "round", label: "In the round" },
          ]}
        />
        {gauge && (
          <p className="text-xs text-muted">
            Each square is {formatCount(aspect)}× as wide as it is tall.
          </p>
        )}
      </Section>

      <Section
        title="Yarn colors"
        description="2 to 6 colors. MC is the background."
      >
        <ul className="flex flex-col gap-2">
          {palette.map((color) => {
            const abbr = abbreviations.get(color.id) ?? "";
            const selected = activeColor === color.id;
            return (
              <li key={color.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveColor(color.id)}
                  aria-pressed={selected}
                  aria-label={`Paint with ${color.name || abbr} (${abbr})`}
                  className={`size-11 shrink-0 rounded-lg border-2 ${
                    selected
                      ? "border-accent ring-2 ring-accent/40"
                      : "border-control"
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
                <span className="w-9 shrink-0 text-xs font-semibold text-muted">
                  {abbr}
                </span>
                <input
                  aria-label={`${abbr} name`}
                  value={color.name}
                  onChange={(e) =>
                    updateColor(color.id, { name: e.target.value })
                  }
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-control bg-card px-3 text-base outline-none focus:border-accent"
                />
                <input
                  type="color"
                  aria-label={`${abbr} color`}
                  value={color.hex}
                  onChange={(e) =>
                    updateColor(color.id, { hex: e.target.value })
                  }
                  className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-control bg-card p-1"
                />
                <button
                  type="button"
                  onClick={() => removeColor(color.id)}
                  disabled={palette.length <= MIN_COLORS}
                  aria-label={`Remove ${abbr}`}
                  className="min-h-11 min-w-11 shrink-0 rounded-lg text-muted disabled:opacity-30"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={addColor}
          disabled={palette.length >= MAX_COLORS}
          className="min-h-11 rounded-lg border-2 border-moss text-sm font-semibold text-moss disabled:opacity-40"
        >
          + Add color
        </button>
      </Section>

      <Segmented
        label="Chart source"
        value={tab}
        onChange={changeTab}
        options={[
          { value: "draw", label: "Draw" },
          { value: "image", label: "Image to chart" },
        ]}
      />

      {tab === "image" ? (
        <Section
          title="Image to chart"
          description="Each square becomes the closest yarn color. Switch to Draw to touch it up."
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground">
              <Camera className="size-5" aria-hidden />
              Take Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-accent px-3 text-sm font-semibold text-accent">
              <Images className="size-5" aria-hidden />
              Choose from Library
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {imageError && (
            <p role="alert" className="text-sm text-accent">
              {imageError}
            </p>
          )}
          {image && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={image.url}
                alt="Uploaded image"
                className="size-16 rounded-lg border border-border object-cover"
              />
              <label className="flex min-h-11 flex-1 items-center justify-between gap-3 rounded-lg border border-control bg-card px-3 text-sm">
                Keep photo proportions
                <input
                  type="checkbox"
                  checked={keepProportions}
                  onChange={(e) => setKeepProportions(e.target.checked)}
                  className="size-5 accent-[var(--accent)]"
                />
              </label>
            </div>
          )}
        </Section>
      ) : (
        <div className="flex flex-col gap-2">
          <Segmented
            label="Drawing tool"
            value={tool}
            onChange={setTool}
            options={TOOLS}
          />
          <div className="flex items-center justify-between gap-3 text-sm text-muted">
            <span className="flex items-center gap-2">
              {tool === "eraser"
                ? "Erasing to"
                : tool === "picker"
                  ? "Tap a square to pick"
                  : "Painting"}
              {tool !== "picker" && (
                <>
                  <span
                    aria-hidden
                    className="size-4 rounded border border-foreground/20"
                    style={{
                      backgroundColor: palette.find(
                        (c) =>
                          c.id ===
                          (tool === "eraser" ? background : activeColor),
                      )?.hex,
                    }}
                  />
                  {abbreviations.get(
                    tool === "eraser" ? background : activeColor,
                  )}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={clear}
              className={`min-h-11 rounded-lg px-3 font-semibold ${
                clearArmed ? "bg-accent text-accent-foreground" : "text-muted"
              }`}
            >
              {clearArmed ? "Tap to confirm" : "Clear"}
            </button>
          </div>
        </div>
      )}

      <Section title="Chart size">
        <SizeSlider
          id="chart-width"
          label="Width"
          value={width}
          max={MAX_WIDTH}
          unit="sts"
          onChange={(w) => resize(w, height)}
        />
        <SizeSlider
          id="chart-height"
          label="Height"
          value={targetHeight}
          max={MAX_HEIGHT}
          unit="rows"
          disabled={lockedHeight !== null}
          onChange={(h) => resize(width, h)}
        />
        {gauge && (
          <p className="text-xs text-muted">
            Finished size about{" "}
            {formatInches(grid[0].length / gauge.stitchesPerInch)} ×{" "}
            {formatInches(grid.length / gauge.rowsPerInch)}.
          </p>
        )}
      </Section>

      <div className="flex flex-col gap-1">
        <ColorworkChart
          grid={grid}
          palette={palette}
          cellAspect={aspect}
          workedInRound={workedInRound}
          onPaint={tab === "draw" ? paint : undefined}
          label={`Colorwork chart, ${grid[0].length} stitches by ${grid.length} rows`}
          className="rounded-xl border border-border bg-card py-2"
        />
        <p className="text-xs text-muted">
          Row 1 is at the bottom.{" "}
          {workedInRound
            ? "Every round reads right to left."
            : "RS rows read right to left, WS rows left to right."}
        </p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-12 rounded-xl bg-accent font-semibold text-accent-foreground disabled:opacity-40"
      >
        Create chart project
      </button>
    </form>
  );
}
