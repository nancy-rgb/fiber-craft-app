"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ColorworkChart } from "@/components/ColorworkChart";
import { Segmented } from "@/components/forms/Segmented";
import { GarmentPreview } from "@/components/GarmentPreview";
import { ShapeStackPreview } from "@/components/ShapeStackPreview";
import {
  cellAspect,
  colorAbbreviations,
  readsRightToLeft,
  rowRuns,
} from "@/lib/math/colorworkMath";
import { calculateGarmentPlan } from "@/lib/math/garmentMath";
import { activePieceIndex, garmentSection } from "@/lib/projectProgress";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type { Project } from "@/lib/types/project";

function buzz() {
  if ("vibrate" in navigator) navigator.vibrate(50);
}

function Preview({ project }: { project: Project }) {
  const index = project.currentStepIndex;
  if (project.category === "amigurumi") {
    if (project.amigurumiShapes.length === 0) return null;
    return (
      <ShapeStackPreview
        shapes={project.amigurumiShapes}
        activeIndex={activePieceIndex(project.instructions, index)}
      />
    );
  }
  if (!project.garmentData) return null;
  try {
    const plan = calculateGarmentPlan(project.garmentData, project.gauge);
    const step = project.instructions[index];
    return (
      <GarmentPreview
        inputs={project.garmentData}
        gauge={project.gauge}
        plan={plan}
        active={step ? garmentSection(step.label) : null}
      />
    );
  } catch {
    return null;
  }
}

export function ProjectWorkingView() {
  // Read the id from the URL, not route params: offline, the prerendered
  // shell's params hold OFFLINE_SHELL_ID instead of the real id.
  const id = decodeURIComponent(usePathname().split("/")[2] ?? "");
  const hasHydrated = useProjectStore((s) => s.hasHydrated);
  const project = useProjectStore((s) => s.projects[id]);
  const setCurrentStepIndex = useProjectStore((s) => s.setCurrentStepIndex);
  const [resetArmed, setResetArmed] = useState(false);
  const [view, setView] = useState<"chart" | "written">("chart");
  const listRef = useRef<HTMLOListElement>(null);
  const current = project?.currentStepIndex ?? 0;

  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !item) return;
    list.scrollTo({
      top: item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2,
      behavior: "smooth",
    });
  }, [current, hasHydrated, view]);

  useEffect(() => {
    if (!resetArmed) return;
    const timer = setTimeout(() => setResetArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [resetArmed]);

  if (!hasHydrated) return <p className="text-sm text-muted">Loading…</p>;
  if (!project) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Project not found</h1>
        <Link href="/" className="text-sm text-accent underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const total = project.instructions.length;
  const step = project.instructions[current];
  const atStart = current === 0;
  const atEnd = current >= total - 1;
  const colorwork =
    project.category === "colorwork" ? project.colorworkData : null;
  const abbreviations = colorwork
    ? colorAbbreviations(colorwork.palette)
    : null;
  const colorHex = new Map(colorwork?.palette.map((c) => [c.id, c.hex]));
  const go = (index: number) => setCurrentStepIndex(project.id, index);

  const tap = () => {
    if (atEnd) return;
    buzz();
    go(current + 1);
  };

  const reset = () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setResetArmed(false);
    go(0);
  };

  const stepList = (
    <ol
      ref={listRef}
      className="relative flex max-h-80 flex-col overflow-y-auto rounded-xl border border-border bg-card"
    >
      {project.instructions.map((instruction, index) => {
        const isCurrent = index === current;
        const isDone = index < current;
        return (
          <li key={instruction.stepNumber}>
            <button
              type="button"
              onClick={() => go(index)}
              aria-current={isCurrent ? "step" : undefined}
              className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 ${
                isCurrent
                  ? "bg-apricot/45 text-base font-semibold"
                  : "text-sm opacity-50"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  isDone
                    ? "border-moss bg-moss text-moss-foreground"
                    : isCurrent
                      ? "border-accent"
                      : "border-border"
                }`}
              >
                {isDone ? "✓" : ""}
              </span>
              <span className={isDone ? "line-through" : ""}>
                {instruction.yarnColor && (
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block size-3 rounded-full border border-border align-middle"
                    style={{ backgroundColor: instruction.yarnColor.hex }}
                  />
                )}
                <span className="font-medium">{instruction.label}:</span>{" "}
                {instruction.instructionText}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
        <p className="text-xs capitalize text-muted">
          {project.craftType} · {project.category}
        </p>
      </div>

      {step && (
        <section
          aria-live="polite"
          className="rounded-2xl border-2 border-accent bg-card p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Now · {step.label}
          </p>
          <p className="mt-1 text-xl font-semibold leading-snug">
            {step.instructionText}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            {step.stitchCount} sts
            {step.yarnColor && (
              <>
                {" · "}
                <span
                  aria-hidden
                  className="inline-block size-3.5 rounded-full border border-border"
                  style={{ backgroundColor: step.yarnColor.hex }}
                />
                {step.yarnColor.name}
              </>
            )}
          </p>
          {colorwork && abbreviations && (
            <>
              <ul
                aria-label="Stitches in working order"
                className="mt-2 flex flex-wrap gap-1.5"
              >
                {rowRuns(
                  colorwork.cells,
                  current + 1,
                  colorwork.workedInRound,
                ).map((run, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-sm tabular-nums"
                  >
                    <span
                      aria-hidden
                      className="size-3 rounded-sm border border-foreground/20"
                      style={{ backgroundColor: colorHex.get(run.colorId) }}
                    />
                    {run.count} {abbreviations.get(run.colorId)}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">
                {readsRightToLeft(current + 1, colorwork.workedInRound)
                  ? "Read the chart row right to left ←"
                  : "Read the chart row left to right →"}
              </p>
            </>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={tap}
        disabled={atEnd}
        aria-label={
          atEnd
            ? "Pattern complete"
            : `Done with step ${current + 1}, go to step ${current + 2}`
        }
        className="flex min-h-[36vh] w-full touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-3xl border-2 border-foreground/15 bg-oat text-foreground shadow-sm transition-transform active:scale-[0.97] disabled:opacity-70"
      >
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          Step
        </span>
        <span className="text-8xl font-bold tabular-nums leading-none">
          {current + 1}
        </span>
        <span className="text-sm text-muted">
          {atEnd ? `of ${total} · all done!` : `of ${total} · tap when done`}
        </span>
      </button>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={atStart}
          aria-label="Previous step"
          className="min-h-12 rounded-xl border border-border bg-card font-semibold disabled:opacity-40"
        >
          ‹ Back
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={atStart && !resetArmed}
          className={`min-h-12 rounded-xl border font-semibold disabled:opacity-40 ${
            resetArmed
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-card"
          }`}
        >
          {resetArmed ? "Tap to confirm" : "Reset"}
        </button>
        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={atEnd}
          aria-label="Next step"
          className="min-h-12 rounded-xl border border-border bg-card font-semibold disabled:opacity-40"
        >
          Skip ›
        </button>
      </div>

      {colorwork ? (
        <>
          <Segmented
            label="Instructions view"
            value={view}
            onChange={setView}
            options={[
              { value: "chart", label: "Chart view" },
              { value: "written", label: "Written view" },
            ]}
          />
          {view === "chart" ? (
            <section className="rounded-xl border border-border bg-card py-2">
              <ColorworkChart
                grid={colorwork.cells}
                palette={colorwork.palette}
                cellAspect={cellAspect(project.gauge)}
                workedInRound={colorwork.workedInRound}
                activeRow={colorwork.cells.length - 1 - current}
                label={`Colorwork chart with row ${current + 1} highlighted`}
                className="max-h-[60vh]"
              />
            </section>
          ) : (
            stepList
          )}
        </>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-3">
            <Preview project={project} />
          </section>
          {stepList}
        </>
      )}
    </div>
  );
}
