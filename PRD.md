# Product Requirement Document (PRD): Fiber Craft PWA

## 1. Project Overview & Target Audience

- **Product Name:** Fiber Craft Pattern Engine (Working Title)
- **Objective:** A mobile-first, offline-ready Progressive Web App (PWA) designed for "vibes-first" crafters who want to spontaneously build garments and amigurumi stuffed animals without complex upfront math.
- **Target Platforms:** iOS Safari & Android Chrome (Installed to Home Screen via PWA).
- **Core Philosophy:** Low friction. Crafters can jump straight into projects, measure garments they already own, or adjust gauge mid-project without restarting.

## 2. Core Functional Requirements

### A. Garment Generator ("Drop-Shoulder Sweater")

- **Inputs:** Chest width, body length, sleeve length, upper arm circumference, and yarn gauge (stitches and rows per inch).
- **Mid-Project Gauge Adjustment:** A dynamic calculator allowing users to type "My panel measures X inches at Y stitches" to automatically update all remaining row and stitch counts mid-project.
- **Math Engine Output:** Calculates stitch counts for Front/Back rectangular panels and tapered sleeve increase intervals.

### B. Amigurumi Generator ("Spiral Shape Engine")

- **Primitives:** Support for basic 3D shape primitives (Spheres, Cylinders, Cones).
- **Spiral Crochet Engine:** Auto-generates continuous 6 × N spiral increase and decrease rounds based on target shape dimensions (6 → 12 → 18 → 24 …).
- **Assembly Tracker:** Interactive checklist for tracking completion of identical limbs and multi-piece construction.

### C. Active Working View & Row Counter

- **Interactive Counter:** Large, high-contrast tap-to-count button optimized for mobile screen use.
- **Haptic Feedback:** Triggers device vibration (`navigator.vibrate`) on row advance.
- **Visual Preview:** Dynamic SVG rendering of panel silhouettes or stacked amigurumi shapes.
- **Offline Persistence:** State auto-saves to browser storage instantly on every tap.

### D. Colorwork & Pixel Chart Engine

- **Chart Builder:** Pixel grid with paintbrush, paint bucket (flood fill), eraser and color picker; 2–6 yarn colors.
- **Image to Chart:** Upload a photo and quantize it to the chosen yarn palette at a target stitch/row size.
- **Gauge-Aware Cells:** Cells are drawn at the stitch-to-row ratio from the gauge so charts don't distort.
- **Written Rows:** Row-by-row run-length instructions ("Row 1 (RS): 4 MC, 2 CC, 8 MC"), reading right-to-left on RS rows and left-to-right on WS rows when worked flat; every round reads right-to-left in the round.
- **Working View:** Chart view with the active row highlighted in sync with the row counter, toggleable with written instructions.

## 3. Technical Stack & Architecture

| Layer                 | Technology                                              |
| --------------------- | ------------------------------------------------------- |
| Framework             | Next.js 15 (App Router, TypeScript)                     |
| Hosting               | Vercel (Automatic GitHub PR Preview Deployments)        |
| State Management      | Zustand with `idb-keyval` (IndexedDB persistence)       |
| Styling & UI          | Tailwind CSS + `shadcn/ui`                              |
| PWA / Service Worker  | `@ducanh2912/next-pwa` or Serwist                       |
| Type Definitions      | Centralized in `lib/types/project.ts`                   |

## 4. Delivery Phases

Work is delivered one phase per pull request; verify each Vercel preview before starting the next phase.

1. **Scaffolding & Data Architecture** — Next.js 15 App Router project (TypeScript, Tailwind CSS, Zustand, `idb-keyval`), `lib/types/project.ts`, IndexedDB-backed Zustand store in `lib/store/useProjectStore.ts`, mobile layout in `app/layout.tsx`.
2. **Mathematical Engines** — `lib/math/garmentMath.ts` (drop-shoulder panel math) and `lib/math/amigurumiMath.ts` (6 × N spiral rounds), with Jest or Vitest unit tests covering edge cases such as odd stitch counts and mid-project gauge adjustments.
3. **UI Builders & Row Counter** — Forms at `/garments/new` and `/amigurumi/new`, active working view at `/project/[id]` with the large haptic row counter and SVG preview; counter taps update the store and persist across reloads.
4. **PWA Configuration** — `@ducanh2912/next-pwa` or Serwist for full offline support, `app/manifest.ts` with mobile standalone settings for iOS/Android home-screen install, offline asset caching verified.
