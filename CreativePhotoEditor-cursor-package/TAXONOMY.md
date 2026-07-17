# TAXONOMY — CreativePhotoEditor

Canonical terms. If a new concept needs a name, add it here — don't let synonyms drift across code, docs, and UI copy.

| Term | Definition |
|---|---|
| **Document** | The top-level editable unit. Has canvas dimensions, a `LayerGraph`, and metadata (name, created/modified). One Document = one open tab/window. |
| **Project File (`.cpe`)** | The saved, reopenable representation of a Document on disk — zip container with `manifest.json` + layer raster data. |
| **LayerGraph** | Our in-house scene-graph abstraction sitting on top of the Pixi renderer. Owns layer order, grouping, and transform state. This is the thing Cursor agents build — not a third-party dependency. |
| **Layer** | A single stacked visual unit within a Document — raster image data (MVP), text or vector shape (later). Has: name, visibility, opacity, blend mode, transform (position/scale/rotation), lock state. |
| **Group** | A collection of Layers treated as one unit for transform/visibility purposes. Nested LayerGraph node. |
| **Canvas** | The rendered composite output area the user sees/edits — the visual result of compositing all visible Layers through Pixi. |
| **Selection** | A user-defined region (rectangular, later freeform) constraining where edit operations (cut, paste, fill, adjustments) apply. Not the same as "selecting a layer" — use **Active Layer** for that. |
| **Active Layer** | The currently targeted Layer for edit operations that aren't selection-scoped (e.g. transform). |
| **Tool** | A user-selectable mode that changes what click/drag does on the Canvas (Move, Selection-Rectangle, Crop, etc.). Exactly one Tool is active at a time. |
| **Command** | An undoable unit of work (e.g. `MoveLayerCommand`, `ResizeLayerCommand`). All mutating operations go through the Command system — see ARCHITECTURE.md §History. Never mutate LayerGraph state directly from UI handlers. |
| **History Stack** | The ordered list of executed Commands enabling undo/redo. In-memory only for MVP. |
| **Clipboard** | Internal cut/copy/paste buffer. Distinct from the OS system clipboard (stretch goal: bridge to system clipboard for image paste-in). |
| **Export** | A one-way, non-reopenable flattened output (PNG/JPEG/WebP) of the current Canvas state. Contrast with **Save**, which writes a reopenable `.cpe` Project File. |
| **Save** | Writes the current Document to a `.cpe` Project File, preserving Layers/edit state. |
| **Import** | Bringing an external image file in as a new Layer on the active Document. |
