"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import type { NewProject } from "@/lib/types/project";

const sampleSweater: NewProject = {
  kind: "garment",
  name: "Cozy drop-shoulder sweater",
  style: "drop-shoulder-sweater",
  gauge: { stitchesPerInch: 4.5, rowsPerInch: 6 },
  measurements: {
    chestWidth: 22,
    bodyLength: 24,
    sleeveLength: 18,
    upperArmCircumference: 14,
  },
  pieces: [
    { name: "Back", role: "back", quantity: 1 },
    { name: "Front", role: "front", quantity: 1 },
    { name: "Sleeve", role: "sleeve", quantity: 2 },
  ],
};

const sampleAmigurumi: NewProject = {
  kind: "amigurumi",
  name: "Little bear",
  gauge: { stitchesPerInch: 5, rowsPerInch: 5 },
  pieces: [
    {
      name: "Head",
      primitive: "sphere",
      dimensions: { diameter: 3 },
      quantity: 1,
    },
    {
      name: "Body",
      primitive: "cylinder",
      dimensions: { diameter: 2.5, height: 3 },
      quantity: 1,
    },
    {
      name: "Leg",
      primitive: "cylinder",
      dimensions: { diameter: 1, height: 1.5 },
      quantity: 4,
    },
    {
      name: "Ear",
      primitive: "cone",
      dimensions: { diameter: 1, height: 0.75 },
      quantity: 2,
    },
  ],
};

export default function Home() {
  const hasHydrated = useProjectStore((s) => s.hasHydrated);
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const list = Object.values(projects).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Your projects</h1>
        <p className="mt-1 text-sm text-muted">
          Saved on this device and available offline.
        </p>
      </section>

      {!hasHydrated ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
          No projects yet. Start one below.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{project.name}</p>
                <p className="text-xs text-muted">
                  {project.kind === "garment" ? "Garment" : "Amigurumi"} ·{" "}
                  {project.pieces.length} pieces
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteProject(project.id)}
                className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted active:bg-border"
                aria-label={`Delete ${project.name}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3">
        <button
          type="button"
          disabled={!hasHydrated}
          onClick={() => createProject(sampleSweater)}
          className="min-h-14 rounded-xl bg-accent px-4 text-base font-semibold text-accent-foreground disabled:opacity-50"
        >
          Add sample sweater
        </button>
        <button
          type="button"
          disabled={!hasHydrated}
          onClick={() => createProject(sampleAmigurumi)}
          className="min-h-14 rounded-xl border border-border bg-card px-4 text-base font-semibold disabled:opacity-50"
        >
          Add sample amigurumi
        </button>
        <p className="text-center text-xs text-muted">
          Garment and amigurumi builders arrive in a later phase.
        </p>
      </section>
    </div>
  );
}
