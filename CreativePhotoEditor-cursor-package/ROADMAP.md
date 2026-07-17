# ROADMAP — CreativePhotoEditor

Phases are sequential gates, not sprints. Don't start Phase 2 tooling while Phase 1's core loop (import → edit → export) is shaky.

## Phase 0 — Scaffold (this package)
- Repo init, Next.js + TypeScript + PixiJS wired up.
- Editor Core module skeleton (`/core/layer-graph`, `/core/render`, `/core/commands`, `/core/tools`, `/core/file-io`) with types defined, even before logic is complete.
- Empty React shell that renders a Pixi canvas.

## Phase 1 — MVP Core Loop
Goal: import an image, put it on a layer, move/resize it, add a second layer, export a flattened PNG.
- LayerGraph: add/remove/reorder layers, groups
- Render Engine: composite N layers correctly (opacity, basic blend modes: Normal, Multiply, Screen, Overlay)
- Tools: Move, Transform (resize/scale/rotate handles)
- Cut / Copy / Paste (internal clipboard, layer-level and selection-level)
- Command system + Undo/Redo (in-memory)
- Import (drag-drop or file picker → new layer)
- Export (PNG/JPEG/WebP flatten)
- Save/Load `.cpe` project files
- Layers Panel UI: reorder (drag), visibility toggle, opacity slider, rename, delete

**Exit criteria:** you can open the app, bring in two photos, cut a piece out of one, paste it onto the other, resize it, and export a clean PNG — without touching devtools.

## Phase 2 — Real Editing Tools
- Selection: rectangle → lasso (freeform)
- Crop tool (document-level, not just layer-level)
- Basic adjustments: brightness, contrast, saturation (non-destructive if feasible, destructive is fine for v1)
- Text layer type
- Expand blend mode list as needed

## Phase 3 — Performance & Polish
- Large image handling (tiling/downsampling strategy — don't let a 40MP photo tank the browser)
- Undo/redo depth tuning, possibly persist history within a session
- Keyboard shortcuts (Photoshop-familiar where sensible: Ctrl+Z, Ctrl+C/V, etc.)
- PWA/offline capability

## Phase 4 — Windows Desktop
- Wrap the browser app (Tauri, per PROJECT_BRAIN.md decision) — only after Phase 1–3 are solid.
- Native file system integration for Save/Load/Export (replacing browser download/upload flow).
- Native menus.

## Phase 5 — Mac / Mobile
- Not scoped yet. Revisit once Windows wrap proves the "browser core + native shell" pattern works.

---

## Explicitly Deferred / Out of Scope (until re-opened)
- RAW file processing
- CMYK / print color workflows
- Plugin/extension system
- 3D layers
- Video/timeline editing
- AI generative fill or any AI-assisted editing (separate conversation if you want this later — cost/complexity tradeoffs are real)
