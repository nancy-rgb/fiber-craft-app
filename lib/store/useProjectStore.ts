import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  Gauge,
  GaugeAdjustment,
  NewProject,
  PieceInput,
  Project,
  ProjectPiece,
} from "@/lib/types/project";
import { idbStorage } from "./idbStorage";

type AdjustmentInput = Omit<
  GaugeAdjustment,
  "id" | "createdAt" | "previousGauge"
>;

interface ProjectState {
  projects: Record<string, Project>;
  activeProjectId?: string;
  hasHydrated: boolean;

  createProject: (input: NewProject) => string;
  renameProject: (projectId: string, name: string) => void;
  deleteProject: (projectId: string) => void;
  setActiveProject: (projectId?: string) => void;
  setActivePiece: (projectId: string, pieceId: string) => void;

  incrementRow: (projectId: string, pieceId: string) => void;
  decrementRow: (projectId: string, pieceId: string) => void;
  resetRow: (projectId: string, pieceId: string) => void;
  setPieceCompletedCount: (
    projectId: string,
    pieceId: string,
    completedCount: number,
  ) => void;

  updateGauge: (projectId: string, gauge: Gauge) => void;
  addGaugeAdjustment: (projectId: string, adjustment: AdjustmentInput) => void;
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

function buildPiece<P extends ProjectPiece>(input: PieceInput<P>): P {
  const { totalRows, ...rest } = input;
  return {
    ...rest,
    id: newId(),
    completedCount: 0,
    counter: { currentRow: 0, totalRows, updatedAt: now() },
  } as unknown as P;
}

function buildProject(input: NewProject): Project {
  const timestamp = now();
  const base = {
    id: newId(),
    name: input.name,
    gauge: input.gauge,
    notes: input.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if (input.kind === "garment") {
    const pieces = input.pieces.map(buildPiece);
    return {
      ...base,
      kind: "garment",
      style: input.style,
      measurements: input.measurements,
      gaugeAdjustments: [],
      pieces,
      activePieceId: pieces[0]?.id,
    };
  }
  const pieces = input.pieces.map(buildPiece);
  return { ...base, kind: "amigurumi", pieces, activePieceId: pieces[0]?.id };
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => {
      const updateProject = (
        projectId: string,
        update: (project: Project) => Project,
      ) =>
        set((state) => {
          const project = state.projects[projectId];
          if (!project) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: { ...update(project), updatedAt: now() },
            },
          };
        });

      const updatePiece = (
        projectId: string,
        pieceId: string,
        update: (piece: ProjectPiece) => Partial<ProjectPiece>,
      ) =>
        updateProject(
          projectId,
          (project) =>
            ({
              ...project,
              pieces: project.pieces.map((piece) =>
                piece.id === pieceId ? { ...piece, ...update(piece) } : piece,
              ),
            }) as Project,
        );

      const setRow = (
        projectId: string,
        pieceId: string,
        next: (currentRow: number) => number,
      ) =>
        updatePiece(projectId, pieceId, (piece) => ({
          counter: {
            ...piece.counter,
            currentRow: Math.max(0, next(piece.counter.currentRow)),
            updatedAt: now(),
          },
        }));

      return {
        projects: {},
        activeProjectId: undefined,
        hasHydrated: false,

        createProject: (input) => {
          const project = buildProject(input);
          set((state) => ({
            projects: { ...state.projects, [project.id]: project },
            activeProjectId: project.id,
          }));
          return project.id;
        },

        renameProject: (projectId, name) =>
          updateProject(projectId, (project) => ({ ...project, name })),

        deleteProject: (projectId) =>
          set((state) => {
            const projects = { ...state.projects };
            delete projects[projectId];
            return {
              projects,
              activeProjectId:
                state.activeProjectId === projectId
                  ? undefined
                  : state.activeProjectId,
            };
          }),

        setActiveProject: (projectId) => set({ activeProjectId: projectId }),

        setActivePiece: (projectId, pieceId) =>
          updateProject(projectId, (project) => ({
            ...project,
            activePieceId: pieceId,
          })),

        incrementRow: (projectId, pieceId) =>
          setRow(projectId, pieceId, (row) => row + 1),
        decrementRow: (projectId, pieceId) =>
          setRow(projectId, pieceId, (row) => row - 1),
        resetRow: (projectId, pieceId) => setRow(projectId, pieceId, () => 0),

        setPieceCompletedCount: (projectId, pieceId, completedCount) =>
          updatePiece(projectId, pieceId, (piece) => ({
            completedCount: Math.min(
              piece.quantity,
              Math.max(0, Math.round(completedCount)),
            ),
          })),

        updateGauge: (projectId, gauge) =>
          updateProject(projectId, (project) => ({ ...project, gauge })),

        addGaugeAdjustment: (projectId, adjustment) => {
          const project = get().projects[projectId];
          if (!project || project.kind !== "garment") return;
          updateProject(projectId, (current) => {
            if (current.kind !== "garment") return current;
            const entry: GaugeAdjustment = {
              ...adjustment,
              id: newId(),
              createdAt: now(),
              previousGauge: current.gauge,
            };
            return {
              ...current,
              gauge: adjustment.resultingGauge,
              gaugeAdjustments: [...current.gaugeAdjustments, entry],
            };
          });
        },
      };
    },
    {
      name: "fiber-craft-projects",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ projects, activeProjectId }) => ({
        projects,
        activeProjectId,
      }),
      // IndexedDB only exists in the browser; StoreHydrator rehydrates on mount.
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useProjectStore.setState({ hasHydrated: true });
      },
    },
  ),
);
