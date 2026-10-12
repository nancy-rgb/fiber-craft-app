"use client";

import { Camera } from "lucide-react";
import Link from "next/link";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type { NewProject } from "@/lib/types/project";

const sampleProject: NewProject = {
  title: "Sample amigurumi ball",
  craftType: "crochet",
  category: "amigurumi",
  gauge: { stitchesPerInch: 5, rowsPerInch: 5 },
  garmentData: null,
  amigurumiShapes: [
    {
      id: "sample-ball",
      type: "sphere",
      name: "Ball",
      maxDiameterInches: 2,
      heightInches: 2,
    },
  ],
  colorworkData: null,
  instructions: [
    {
      stepNumber: 1,
      label: "Rnd 1",
      instructionText: "6 sc in magic ring",
      stitchCount: 6,
    },
    {
      stepNumber: 2,
      label: "Rnd 2",
      instructionText: "inc in each st",
      stitchCount: 12,
    },
    {
      stepNumber: 3,
      label: "Rnd 3",
      instructionText: "(sc, inc) x6",
      stitchCount: 18,
    },
    {
      stepNumber: 4,
      label: "Rnd 4",
      instructionText: "(sc 2, inc) x6",
      stitchCount: 24,
    },
  ],
};

export default function Dashboard() {
  const hasHydrated = useProjectStore((s) => s.hasHydrated);
  const projects = useProjectStore((s) => s.projects);
  const addProject = useProjectStore((s) => s.addProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const setCurrentStepIndex = useProjectStore((s) => s.setCurrentStepIndex);

  const list = Object.values(projects).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Your projects are saved on this device and work offline.
        </p>
      </section>

      <Link
        href="/colorwork/new"
        className="flex items-center gap-4 rounded-2xl bg-apricot/60 p-4 active:bg-apricot"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Camera className="size-6" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold">Turn Photo into Chart</span>
          <span className="block text-sm">Take a photo or upload an image</span>
        </span>
      </Link>

      {!hasHydrated ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          <p>No projects yet.</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/garments/new"
              className="rounded-lg bg-accent px-3 py-3 font-semibold text-accent-foreground"
            >
              New Garment
            </Link>
            <Link
              href="/amigurumi/new"
              className="rounded-lg border-2 border-moss px-3 py-3 font-semibold text-moss"
            >
              New Amigurumi
            </Link>
            <Link
              href="/colorwork/new"
              className="col-span-2 rounded-lg border-2 border-moss px-3 py-3 font-semibold text-moss"
            >
              New Colorwork
            </Link>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((project) => {
            const total = project.instructions.length;
            const step = project.instructions[project.currentStepIndex];
            return (
              <li
                key={project.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/project/${project.id}`}
                      className="block truncate font-medium underline-offset-4 hover:underline"
                    >
                      {project.title}
                    </Link>
                    <p className="text-xs capitalize text-muted">
                      {project.craftType} · {project.category}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteProject(project.id)}
                    className="shrink-0 rounded-lg px-2 py-1 text-sm text-muted active:bg-border"
                    aria-label={`Delete ${project.title}`}
                  >
                    Delete
                  </button>
                </div>
                {step && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-sm">
                        <span className="font-semibold">
                          Step {project.currentStepIndex + 1}/{total}
                        </span>{" "}
                        <span className="text-muted">
                          {step.label}: {step.instructionText}
                        </span>
                      </p>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-oat"
                        aria-hidden
                      >
                        <div
                          className="h-full rounded-full bg-moss"
                          style={{
                            width: `${((project.currentStepIndex + 1) / total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/project/${project.id}`}
                        className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground"
                      >
                        {project.craftType === "knitting"
                          ? "Continue knitting"
                          : "Continue crocheting"}
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentStepIndex(
                            project.id,
                            project.currentStepIndex + 1,
                          )
                        }
                        disabled={project.currentStepIndex >= total - 1}
                        aria-label={`Next step of ${project.title}`}
                        className="min-h-11 shrink-0 rounded-lg border-2 border-moss px-4 text-sm font-semibold text-moss disabled:opacity-40"
                      >
                        +1 step
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasHydrated && (
        <button
          type="button"
          onClick={() => addProject(sampleProject)}
          className="self-center text-sm text-muted underline underline-offset-4"
        >
          Add a sample project
        </button>
      )}
    </div>
  );
}
