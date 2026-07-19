# CreativePhotoEditor — Manual Test Cases

A checklist for you to walk through the app by hand. Each case has **steps** and
an **expected result**. Check the box if it passes; note anything odd in the
"Notes" space.

**Where to test:**
- Production: https://creativephotoeditor.vercel.app
- Dev (preview): https://creativephotoeditor-git-dev-nathan-okh-s-projects.vercel.app
- Local: `npm run dev` → http://localhost:3000

**Prep:** have 2–3 test images handy (PNG with transparency + a couple of JPGs).

> Automation plan: cases tagged **[E2E]** will become Playwright end-to-end tests;
> cases tagged **[UNIT]** will become unit tests on the `core/` modules. Tags are
> suggestions for what we'll wire into CI later.

---

## A. Landing page
- [ ] **A1** [E2E] Visit the site root. → Hero, "Start editing" button, and 4 feature cards render; no console errors.
- [ ] **A2** [E2E] Click "Start editing". → Navigates to `/editor` and the editor loads.
- [ ] **A3** Resize the browser / open on mobile width. → Layout stays readable (no broken overflow).

## B. Editor loads
- [ ] **B1** [E2E] Open `/editor`. → Top bar, left tool rail, dark canvas with "Drop an image to start", and right Layers panel all appear.
- [ ] **B2** Open dev tools console. → No red errors (a hydration note about `data-cursor-ref` from the browser extension is fine).

## C. Import
- [ ] **C1** [E2E] Click Import → choose a PNG. → Image appears centered on canvas as a new layer; a row shows in Layers.
- [ ] **C2** Drag an image file onto the canvas. → Dashed drop outline shows, then the image imports as a layer.
- [ ] **C3** Import a 2nd and 3rd image. → Each becomes its own layer, stacked on top; newest is active.
- [ ] **C4** Try importing a non-image (e.g. .txt). → It's ignored / no crash.

## D. Move & Transform
- [ ] **D1** [E2E] Select Move (V), drag a layer. → Layer follows the cursor; releasing keeps it there.
- [ ] **D2** Hold Shift while dragging. → Movement locks to horizontal OR vertical.
- [ ] **D3** Click an overlapping area. → The top-most layer under the cursor becomes active (blue outline).
- [ ] **D4** Select Transform (T), drag a corner handle. → Active layer resizes (aspect locked by default).
- [ ] **D4b** Drag the circle above the transform box. → Layer rotates.
- [ ] **D5** Select Hand (H) or use the wheel. → Canvas pans/zooms; layers are not moved.
- [ ] **D6** Press `0` (Fit). → Whole document fits centered in view.

## E. Layers panel
- [ ] **E1** [E2E] Toggle a layer's eye icon. → Layer hides/shows on canvas; name shows strikethrough when hidden.
- [ ] **E2** Drag the Opacity slider. → Layer fades in real time; release commits the value.
- [ ] **E3** Change Blend mode (Multiply/Screen/Overlay). → Compositing changes visibly against layers below.
- [ ] **E4** Double-click a layer name, type a new name, Enter. → Name updates.
- [ ] **E5** Drag a layer row to reorder. → Stacking order changes on canvas.
- [ ] **E6** Delete a layer (trash icon). → Layer removed; another becomes active.
- [ ] **E7** Lock icon → layer cannot be moved until unlocked.
- [ ] **E8** Duplicate button → copy of active layer appears.

## F. Undo / Redo  [UNIT + E2E]
- [ ] **F1** Move a layer, then Ctrl+Z. → Layer returns to its previous position.
- [ ] **F2** Ctrl+Y (or Ctrl+Shift+Z). → Move re-applies.
- [ ] **F3** Do several edits (import, move, opacity, delete), then undo repeatedly. → Each step reverses in order; no visual glitches.
- [ ] **F4** Undo buttons disable correctly when there's nothing to undo/redo.

## G. Export  [E2E]
- [ ] **G1** With 2+ layers, Export → PNG. → A flattened PNG downloads; opening it shows the composite (transparency preserved).
- [ ] **G2** Export → JPG. → Downloads as `.jpg` (no transparency, white/!=  as expected).
- [ ] **G3** Export → WebP. → Downloads as `.webp`.
- [ ] **G4** Hide a layer, then export. → Hidden layer is NOT in the output.

## H. Save / Load `.cpe`  [SAFETY-FLOOR — data integrity]
- [ ] **H1** Build a 2–3 layer composition. Save project (Ctrl+S). → A `.cpe` file downloads.
- [ ] **H2** Refresh the page, then Open project → pick that `.cpe`. → All layers, positions, opacity, blend modes, and names restore exactly.
- [ ] **H3** Save, reopen, and Export. → Output matches what it looked like before saving (round-trip integrity).

## I. Settings & tooltips
- [ ] **I1** [E2E] Hover a toolbar button ~1s. → Info tooltip appears describing the button.
- [ ] **I2** Open Settings → turn OFF "Show info tooltips". → Hovering no longer shows tooltips.
- [ ] **I3** Turn tooltips back ON, change the delay slider. → Tooltip appears faster/slower accordingly.
- [ ] **I4** Toggle "Snap to pixels". → Setting persists after refresh (stored locally).

## J. Deployment / pipeline
- [ ] **J1** Production URL loads the current app.
- [ ] **J2** Push a trivial change to `dev`. → A new Preview deployment builds and reflects the change.
- [ ] **J3** Merge `dev` → `main` and push. → Production updates automatically.

## K. Paint tools
- [ ] **K1** Select Brush (B), paint on a layer. → Soft stroke appears; Undo removes it.
- [ ] **K2** Change size/color/opacity in the paint options bar, paint again. → New stroke uses those settings.
- [ ] **K3** Pencil (P) paints hard edges; Eraser (E) removes pixels.

## L. Transform rotation & crop / lasso
- [ ] **L1** Transform (T) → drag the circle above the box. → Layer rotates; Undo restores.
- [ ] **L2** Crop (C) → drag a rect, release. → Canvas resizes to that region; layers shift.
- [ ] **L3** Lasso (L) → draw a freeform path. → Selection appears; Cut clears that region’s bbox.

## M. Document / layers extras
- [ ] **M1** New document (File+) → pick a preset + background color → Create. → Fresh canvas with chosen size/bg.
- [ ] **M2** Lock a layer → try Move. → Layer does not move.
- [ ] **M3** Duplicate a layer. → Copy appears offset.
- [ ] **M4** Ctrl/Cmd+click two layers → Group. → Group folder appears; children indent.
- [ ] **M5** Apply Brightness/Contrast/Saturation → Apply to layer. → Image changes; Undo works.
- [ ] **M6** Arrow keys nudge 1px; Shift+arrows nudge 10px.

## N. Export options & clipboard
- [ ] **N1** Export menu → set 2× scale → PNG. → Downloaded image is ~2× document size.
- [ ] **N2** Export JPG with low quality. → Smaller / more compressed file.
- [ ] **N3** Copy an image in another app, focus editor, Ctrl+V. → Image imports as a layer (browser permission may prompt).

## O. Onboarding & guides
- [ ] **O1** First visit to editor shows Quick start card; dismiss persists after refresh.
- [ ] **O2** Settings → Show guides ON. → Grid appears on the canvas.

---

## Known limitations (expected, not bugs)
- Lasso Cut/Copy uses the path’s bounding box (not a true freeform mask).
- Text/shape layers are rasterized bitmaps (not live editable vectors).
- Groups are organizational folders (children still paint in the flat stack).
- Adjustments are destructive (no adjustment layers yet).
- Crop creates multiple undo steps (per-layer shift + canvas resize).

---

## Automation backlog (to build next round)
- [ ] Add Playwright + a CI workflow; implement all **[E2E]** cases above.
- [ ] Add a unit test runner (Vitest) for **[UNIT]** cases on `core/` (LayerGraph, Command/History, .cpe round-trip).
- [ ] Wire tests into GitHub Actions so `dev`/`main` pushes run them before Vercel deploys.
