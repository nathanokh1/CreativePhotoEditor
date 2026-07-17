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
