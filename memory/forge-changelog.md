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

### 2026-07-17 12:05
- TYPE: DECISION
  target: Branding + planning docs + Forge hub fix
  by: builder
  project: CreativePhotoEditor
  reason: Removed all "Photoshop" references across app/docs/project folder (Approver request; use neutral "photo editor" phrasing). Added docs/FEATURES.md (basic + advanced roadmap) and docs/TEST-CASES.md (manual checklist + automation plan). Fixed forge/forge-go.cmd path bug — Hub now live (agentmemory :8765, Hub :8766, orchestrator running). Next cycle after Approver review/testing: Selection-rect + Cut/Copy/Paste, layer thumbnails + drag-reorder, Transform handles/rotation.

### 2026-07-17 11:55
- TYPE: DECISION
  target: Vercel deployment wired to GitHub (Dev + Production lines)
  by: builder
  project: CreativePhotoEditor
  reason: Vercel project "creativephotoeditor" (team nathan-okh-s-projects) linked to github.com/nathanokh1/CreativePhotoEditor. Production = main → https://creativephotoeditor.vercel.app (READY). Dev = dev branch → Preview. Direct file-tree/CLI-from-disk deploys failed (incomplete tree / local .obsidian cruft); git-sourced builds are clean and are the standing deploy path. Railway not yet configured (no backend needed for MVP — pure client-side editor).
