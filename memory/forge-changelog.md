# Project changelog

Project decisions and skill usage for this project.
Global Forge changes go in ~/.forge/memory/forge-changelog.md instead.

Types: USED | DECISION | SETUP | PROMOTED
Related: [[capability-map]] | [[backlog]]

---

### 2026-07-17 11:50
- TYPE: SETUP
  target: CreativePhotoEditor scaffold (Phase 0 → Phase 1 MVP)
  by: builder
  project: CreativePhotoEditor
  reason: Scaffolded Next.js 14 + TS strict + Tailwind + PixiJS + Zustand + JSZip per the cursor-package design docs. Built the framework-agnostic Editor Core (LayerGraph, Command/History/CommandBus, Renderer, ToolManager: Move/Transform/Hand, file-io import/export/.cpe) and a thin React shell (TopBar, Toolbar, CanvasViewport, LayersPanel, SettingsPanel). Production build passes on Next 14.2.35; verified live in browser.

### 2026-07-17 11:50
- TYPE: DECISION
  target: Deploy target + repo layout
  by: builder
  project: CreativePhotoEditor
  reason: App lives at repo root; Forge tooling in /forge is gitignored (has its own repo). Vercel for web (main → Production, dev → Preview). Bumped Next to 14.2.35 to clear the 14.2.15 security advisory.

### 2026-07-17 14:20
- TYPE: DECISION
  target: Canvas fit + Transform handles + Selection/clipboard + layers UX
  by: builder
  project: CreativePhotoEditor
  reason: Approver confirmed main=Production (correct), Forge approvals OK, Codebase URL is github.com/nathanokh1/Codebase (private, v0.1.0 empty exports). Shipped fit-canvas-to-first-import (Settings toggle, default on), Transform 8 handles + aspect lock/free, Selection rect + Cut/Copy/Paste, layer thumbnails + drag-reorder. FEATURES.md updated with Brush/Pencil planned.

### 2026-07-17 11:55
- TYPE: DECISION
  target: Vercel deployment wired to GitHub (Dev + Production lines)
  by: builder
  project: CreativePhotoEditor
  reason: Vercel project "creativephotoeditor" (team nathan-okh-s-projects) linked to github.com/nathanokh1/CreativePhotoEditor. Production = main → https://creativephotoeditor.vercel.app (READY). Dev = dev branch → Preview. Direct file-tree/CLI-from-disk deploys failed (incomplete tree / local .obsidian cruft); git-sourced builds are clean and are the standing deploy path. Railway not yet configured (no backend needed for MVP — pure client-side editor).
