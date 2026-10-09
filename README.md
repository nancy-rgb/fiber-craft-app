# fiber-craft-app

Mobile-first, offline-ready PWA for building drop-shoulder sweaters and amigurumi without upfront math. See [PRD.md](./PRD.md) for the full spec and delivery phases.

## Stack

- Next.js 15 (App Router, TypeScript), deployed on Vercel
- Tailwind CSS
- Zustand persisted to IndexedDB via `idb-keyval`

## Project layout

- `lib/types/project.ts` — shared project, piece, gauge, and measurement types
- `lib/store/useProjectStore.ts` — IndexedDB-backed Zustand store (hydrated client-side by `components/StoreHydrator.tsx`)
- `app/layout.tsx` + `components/MobileNav.tsx` — mobile layout shell with bottom tab navigation

## Development

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run build
```
