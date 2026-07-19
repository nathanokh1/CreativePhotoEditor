# Project changelog

Project decisions and skill usage for this project.
Global Forge changes go in ~/.forge/memory/forge-changelog.md instead.

Types: USED | DECISION | SETUP | PROMOTED
Related: [[capability-map]] | [[backlog]]

---

### 2026-07-18 16:30
- TYPE: DECISION
  target: Layers panel — group cascades, single-layer grouping, drag-reorder, context-menu clamp
  by: builder
  project: CreativePhotoEditor
  reason: Group eye/lock now cascade to children via new atomic SetLayersPropsCommand (single undo). Right-click "Group into folder" works on a single layer and preserves an active multi-selection. Rewrote layer drag-reorder with a live insertion-line indicator and correct drop-index math (kept HTML5 DnD so it works with real mice + is browser-testable). Fixed ContextMenu clipping near screen edges: clamp effect now re-runs after portal mount (added `mounted` dep) + max-height/scroll fallback. Verified all in-browser.

### 2026-07-18 15:10
- TYPE: DECISION
  target: Export options, full-fidelity .cpe, multi-tab documents + autosave
  by: builder
  project: CreativePhotoEditor
  reason: (1) New Export dialog — flatten vs per-layer(.zip), format/scale/quality, transparent-or-solid background, and per-layer "trim to content size" + "visible only". (2) .cpe upgraded to v2: persists layer type, text metadata, groups (parentId/childIds), masks + maskEnabled + clip (v1 still loads). Undo history intentionally NOT persisted (heavy, session-scoped). (3) Multiple document tabs: store now manages many EditorEngines over ONE shared PixiJS renderer (attachGraph swap on tab switch); TabBar UI (new/switch/close). Autosave each doc's .cpe to IndexedDB (debounced) + session record; restored on load. Key fix: closeTab must NOT call engine.destroy() since the renderer is shared. Verified in-browser: create/switch/close tabs, autosave-restore across reload, export dialog.

### 2026-07-18 11:05
- TYPE: DECISION
  target: Copy/paste preserves current transform + right-click context menus
  by: builder
  project: CreativePhotoEditor
  reason: Clipboard now carries scaleX/scaleY/rotation/opacity/blend so paste reproduces the layer exactly as it looks (whole-layer keeps original pixels + transform; rect/mask selections bake the rendered pixels). Added reusable ContextMenu used by the Layers panel (per-layer actions: duplicate/copy/cut/paste/reorder/group/mask/visibility/lock/delete) and the canvas (copy/cut/paste/duplicate/delete), replacing the browser's native menu with its grayed-out entries.

### 2026-07-18 10:45
- TYPE: DECISION
  target: Auto-slicer — median-cell subdivision to recover merged cards
  by: builder
  project: CreativePhotoEditor
  reason: Piano-stickers test: base connected-component detection is good (each white card = its own blob), but a few cells merge where text bridges neighbours — the gutter number labels (e.g. "38") and the vertical "Adobe Stock 352535619" watermark down the left edge (near cell 45) join blobs into oversized regions, so <52 layers. The old "empty-gutter" splitter failed because those gutters aren't empty (labels/watermark). Replaced it with median-cell subdivision: measure median blob W/H across all cards (robust to outliers), and split any blob whose bbox is ~N×M median cells into that grid, snapping each cut to the lowest-density line within ±0.35·cell so cuts land in the true gutter (through labels). Single-card blobs round to 1×1 → unchanged, so it's safe; defaulted the "Separate merged cells" checkbox ON. Note: a large title box may fragment into a couple pieces (deletable). Typecheck + lint green. Next: if arbitrary images still fall short, add in-browser ML region/segment (free, on-device).

### 2026-07-18 10:30
- TYPE: DECISION
  target: Advanced feature set — batch 4 (layer masks + clipping, real lasso, pen tool)
  by: builder
  project: CreativePhotoEditor
  reason: Approver priorities delivered. (1) Lasso upgraded from bbox to a real freeform pixel selection: even-odd scanline polygon fill → SelectionMask, with Shift-add / Alt-subtract; selection action bar (All/Invert/Deselect/Delete/Fill) now shows for lasso too. (2) Layer masks: non-destructive per-layer mask (RGBA, alpha=coverage, source dims), composited in the renderer via a per-layer masked-canvas texture (destination-in), tracked alongside source bitmap so mask edits rebuild the texture; live mask-editing via a renderer setMaskPreview channel. Paint tool gains a mask mode (routed by ToolManager.maskEditTarget): Brush reveals, Eraser hides. Layers panel MASK section: Add mask (reveal), From selection, Paint (toggle target), enable/disable (eye), Apply (bake), Delete; SetLayerMaskCommand for undo. (3) Clipping mask: clip a layer to the alpha of the layer below via a mirror mask-sprite in a dedicated clipLayer container (keeps z-order clean; Pixi excludes .mask objects from normal render). (4) Pen tool (N): click anchors, drag for symmetric bezier handles, click first anchor / Enter to close, Esc/Clear to cancel; live overlay drawn with Pixi bezierCurveTo + rubber-band; PenOptionsBar to Rasterize (stroke/fill → new layer) or convert To selection (penPathToMask). New files: core/file-io/pen.ts, core/tools/pen-tool.ts, components/editor/PenOptionsBar.tsx. Typecheck + lint green; browser smoke test confirmed pen draw→rasterize→layer and mask add/composite render with no Pixi crash. In-browser ML answer to Approver: no per-use/API cost (open models via WASM/WebGPU, one-time ~5–45MB model download + on-device compute); paid cloud AI → roadmap. Queued next: in-browser ML (bg removal / select subject), AI analytical tools (roadmap), persist text/layer metadata in .cpe.

### 2026-07-17 18:05
- TYPE: DECISION
  target: Advanced feature set — batch 3 (slicer regression fix + magic-wand selections)
  by: builder
  project: CreativePhotoEditor
  reason: Batch-2 slicer changes (default erosion + gutter-split) regressed "detect regions". Fixed by making the base detector identical to the original known-good algorithm and making separation-erosion + gutter-split strictly opt-in (dialog defaults 0/off). Shipped magic wand / select-by-color: flood-fill (contiguous) or whole-image (by color) on the active layer's doc-space render, with tolerance + feather (separable box blur) and Shift-add / Alt-subtract; pixel SelectionMask (0..255 coverage) stored on the renderer with a tinted+outlined overlay sprite (skipCache texture in viewport, not docLayers, so export ignores it). Copy/Cut/Delete/Fill now honour the mask (Copy uses extractLayerCanvas → mask alpha → bbox crop; Delete/Fill map doc-mask → layer-local pixels). Added Select All (Ctrl+A), Deselect (Ctrl+D/Esc), Invert (Ctrl+Shift+I), Delete-contents (Del when a mask is active), Fill (color). New MagicWandTool (W), WandOptionsBar, store actions. Typecheck + lint green; dev server hot-reloads clean. Queued next: layer masks + clipping, pen/vector, in-browser ML.

### 2026-07-17 16:55
- TYPE: DECISION
  target: Advanced feature set — batch 2 (fixes + text types + batch export)
  by: builder
  project: CreativePhotoEditor
  reason: Fixed a hard PixiJS crash on crop ("Cannot read properties of null (reading 'addressModeU')") — root cause was Pixi's Texture.from global cache letting two layers share one TextureSource; destroying one layer's texture orphaned the other. Fix: skipCache=true so every layer owns its source, plus destroyed-texture guards + texture cleanup on layer removal. Clone tool now shows an amber source-anchor marker, a moving sample ring, a link line, and a two-tone brush ring (via new renderer setToolCursor overlay). Heal tool rewritten from neighbour-averaging (which just blurred) to exemplar/patch-based content-aware fill (onion-peel + local best-match patch copy) that reproduces real texture; added a brush-size ring. Auto-slicer over-grouping fixed via foreground erosion (breaks thin borders/bridges between touching cells) + recursive projection-profile splitting along empty gutters; exposed "Separation strength" + "Split merged cells" in the dialog. Added batch export: each layer rendered on a doc-sized transparent canvas and zipped (PNG/WebP) via new Renderer.extractLayerCanvas + EditorEngine.exportLayersBatch. Text types shipped: font family, bold/italic, alignment, outline (color+width), drop shadow (color+blur) — new TextStyle in renderTextSource, threaded through UpdateTextLayerCommand/undo, store, and a rebuilt TextOptionsBar. Typecheck + lint green; dev server hot-reloads clean. Queued next: layer masks + clipping, mask-based selections (magic wand/feather), pen/vector, in-browser ML. Note: .cpe still flattens text to raster on save (pre-existing) — text metadata not yet persisted.

### 2026-07-17 16:10
- TYPE: DECISION
  target: Advanced feature set — batch 1 (client-side, no AI backend)
  by: builder
  project: CreativePhotoEditor
  reason: Approver direction: client-side first (images stay on device, free), no gating until accounts, build the full advanced list. Shipped: expanded color/tone (exposure/levels/hue/temperature/tint/gamma), one-shot filters (B&W/sepia/invert/blur/sharpen/vignette), Auto-Layers/Slice tool (deterministic region detection + even grid → per-region layers; the piano-cards use case), upgraded brush engine (hardness/flow/spacing + stroke-buffer compositing + presets), Clone stamp (Alt-set source), and Cleanup/Heal "magic eraser" (mask + diffusion inpaint). Typecheck + prod build green. Queued next: layer masks, mask-based selections (magic wand/feather), text types, pen/vector, in-browser ML (bg removal/select subject). Credits/unlock deferred to accounts track.

### 2026-07-17 15:45
- TYPE: DECISION
  target: Paint + text UX polish
  by: builder
  project: CreativePhotoEditor
  reason: Approver reported buggy/choppy brush/pencil/eraser and text not editable / hard to delete. Live canvas paint preview, soft brush, Delete/Backspace + toolbar delete, Text options bar for fill/size/color.

### 2026-07-17 15:30
- TYPE: DECISION
  target: Ship remaining basic FEATURES.md batch
  by: builder
  project: CreativePhotoEditor
  reason: Approver asked to implement all remaining in-scope features then retest. Shipped paint (brush/pencil/eraser), rotate, crop, lasso, adjustments, new-doc presets + bg, lock/duplicate/group, nudge, OS clipboard paste, export scale/quality, onboarding, text/shape layers, expanded blends, guides. Deferred AI/accounts/native/PWA/masks/non-destructive adj.

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
