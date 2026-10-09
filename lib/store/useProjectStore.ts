import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { NewProject, Project, ProjectUpdate } from "@/lib/types/project";
import { idbStorage } from "./idbStorage";

interface ProjectState {
  projects: Record<string, Project>;
  hasHydrated: boolean;

  addProject: (input: NewProject) => string;
  updateProject: (id: string, update: ProjectUpdate) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  setCurrentStepIndex: (id: string, index: number) => void;
}

const now = () => new Date().toISOString();

const clampStep = (index: number, project: Project) =>
  Math.min(
    Math.max(0, Math.round(index)),
    Math.max(0, project.instructions.length - 1),
  );

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: {},
      hasHydrated: false,

      addProject: (input) => {
        const timestamp = now();
        const project: Project = {
          ...input,
          id: crypto.randomUUID(),
          currentStepIndex: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
        }));
        return project.id;
      },

      updateProject: (id, update) =>
        set((state) => {
          const project = state.projects[id];
          if (!project) return state;
          const merged = { ...project, ...update };
          return {
            projects: {
              ...state.projects,
              [id]: {
                ...merged,
                currentStepIndex: clampStep(merged.currentStepIndex, merged),
                updatedAt: now(),
              },
            },
          };
        }),

      deleteProject: (id) =>
        set((state) => {
          const projects = { ...state.projects };
          delete projects[id];
          return { projects };
        }),

      getProject: (id) => get().projects[id],

      setCurrentStepIndex: (id, index) =>
        set((state) => {
          const project = state.projects[id];
          if (!project) return state;
          return {
            projects: {
              ...state.projects,
              [id]: {
                ...project,
                currentStepIndex: clampStep(index, project),
                updatedAt: now(),
              },
            },
          };
        }),
    }),
    {
      name: "fiber-craft-projects",
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      partialize: ({ projects }) => ({ projects }),
      // Phase 1 drafts used a different shape; start fresh rather than migrate.
      migrate: () => ({ projects: {} }),
      // IndexedDB only exists in the browser; StoreHydrator rehydrates on mount.
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useProjectStore.setState({ hasHydrated: true });
      },
    },
  ),
);
