"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/lib/store/useProjectStore";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const hasHydrated = useProjectStore((s) => s.hasHydrated);
  const project = useProjectStore((s) => s.projects[id]);
  const setCurrentStepIndex = useProjectStore((s) => s.setCurrentStepIndex);

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
  const current = project.currentStepIndex;
  const step = project.instructions[current];
  const go = (index: number) => setCurrentStepIndex(project.id, index);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
        <p className="text-xs capitalize text-muted">
          {project.craftType} · {project.category} · step {current + 1}/{total}
        </p>
      </div>

      {step && (
        <section className="flex flex-col gap-3 rounded-xl border border-accent bg-card p-4">
          <p className="text-sm font-semibold">{step.label}</p>
          <p className="text-lg">{step.instructionText}</p>
          <p className="text-sm text-muted">{step.stitchCount} sts</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => go(current - 1)}
              disabled={current === 0}
              className="min-h-12 rounded-lg border border-border font-semibold disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => go(current + 1)}
              disabled={current >= total - 1}
              className="min-h-12 rounded-lg bg-accent font-semibold text-accent-foreground disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </section>
      )}

      <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {project.instructions.map((instruction, index) => (
          <li key={instruction.stepNumber}>
            <button
              type="button"
              onClick={() => go(index)}
              aria-current={index === current ? "step" : undefined}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm ${
                index === current ? "bg-accent/10" : ""
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  index < current
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border"
                }`}
              >
                {index < current ? "✓" : ""}
              </span>
              <span
                className={index < current ? "text-muted line-through" : ""}
              >
                <span className="font-medium">{instruction.label}:</span>{" "}
                {instruction.instructionText}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
