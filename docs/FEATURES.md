# CreativePhotoEditor — Feature List

A living catalog of what we're building, from basics to advanced. This is the
menu we pick from each cycle. It complements (does not replace) the phase gates
in `CreativePhotoEditor-cursor-package/ROADMAP.md`.

**Status legend:** ✅ shipped · 🔜 next up · 📋 planned · 🧪 experimental/later · ⛔ out of scope (for now)

---

## 1. Basic features (core editor)

### Documents & canvas
| Feature | Status | Notes |
|---|---|---|
| Create a Document (canvas) | ✅ | Default 1280×720; source of truth is the LayerGraph |
| Custom canvas size / presets (1:1, 16:9, A4…) | 📋 | New-document dialog |
| Canvas background (transparent / color) | 📋 | Transparent checkerboard shipped |
| Pan / zoom / fit-to-view | ✅ | Wheel zoom, Hand tool, Fit button |

### Import & layers
| Feature | Status | Notes |
|---|---|---|
| Import image (file picker) | ✅ | PNG/JPG/WebP/GIF/BMP |
| Drag & drop import onto canvas | ✅ | |
| Layers panel (list, select, active highlight) | ✅ | |
| Show/hide layer | ✅ | |
| Rename layer | ✅ | Double-click |
| Delete layer | ✅ | |
| Opacity per layer | ✅ | Live slider |
| Blend modes | ✅ | Normal, Multiply, Screen, Overlay |
| Reorder layers | ✅ | Up/down buttons |
| Drag-to-reorder layers | 🔜 | Nicer than up/down |
| Layer thumbnails | 🔜 | Small preview per row |
| Lock layer | 📋 | Data model + hit-test already respect `locked` |
| Duplicate layer | 📋 | |
| Group layers | 📋 | Data model has a Group concept |

### Tools
| Feature | Status | Notes |
|---|---|---|
| Move tool (drag layers, Shift = axis lock) | ✅ | |
| Transform — scale from center | ✅ | Basic |
| Transform — corner handles + rotation | 🔜 | Phase 2 tooling |
| Hand (pan) tool | ✅ | |
| Selection — rectangle | 🔜 | Prereq for cut/paste |
| Selection — lasso (freeform) | 📋 | |
| Crop (document-level) | 📋 | |

### Editing operations
| Feature | Status | Notes |
|---|---|---|
| Undo / redo (full history) | ✅ | Every mutation is a Command |
| Cut / Copy / Paste (internal clipboard) | 🔜 | Layer- and selection-level |
| Paste image from OS clipboard | 📋 | Bridge to system clipboard |
| Nudge with arrow keys | 📋 | |
| Basic adjustments: brightness / contrast / saturation | 📋 | Phase 2 |

### Output
| Feature | Status | Notes |
|---|---|---|
| Export flattened PNG / JPG / WebP | ✅ | 1:1 resolution |
| Save `.cpe` project (zip: manifest + WebP layers) | ✅ | Reopenable |
| Open `.cpe` project | ✅ | |
| Export scale / quality options | 📋 | e.g. 2×, JPEG quality |

### UX & polish
| Feature | Status | Notes |
|---|---|---|
| Modern dark UI, hover effects | ✅ | |
| Toggleable info tooltips (+ delay) | ✅ | Settings |
| Keyboard shortcuts (V/T/H, Ctrl+Z/Y/S, +/-/0) | ✅ | |
| Landing page | ✅ | |
| Onboarding / first-run hints | 📋 | |
| Empty-state guidance | ✅ | "Drop an image to start" |

---

## 2. Advanced features

| Feature | Status | Notes |
|---|---|---|
| Text layers | 📋 | New layer type; extend `.cpe` schema |
| Vector/shape layers | 📋 | |
| Non-destructive adjustment layers | 🧪 | Bigger architectural lift |
| Filters (blur, sharpen, etc.) | 🧪 | GPU shaders via Pixi filters |
| Masks (layer + clipping) | 🧪 | |
| More blend modes | 📋 | Expand as needed |
| Large-image handling (tiling/downsample) | 📋 | Phase 3 perf |
| History persistence within a session | 📋 | |
| PWA / offline support | 📋 | Phase 3 |
| Custom brushes / painting | 🧪 | |
| Guides, rulers, snapping | 📋 | |
| Multiple documents / tabs | 📋 | |

---

## 3. Platform roadmap

| Target | Status | Notes |
|---|---|---|
| Web app (browser) | ✅ MVP live | The product for v1 |
| Windows desktop (Tauri wrap) | 📋 | Phase 4 — after web is solid |
| macOS desktop | 🧪 | Phase 5 |
| iOS / Android | 🧪 | Phase 5 — wrap the browser core |

---

## 4. AI features (later — separate track)

Deliberately deferred until the core editor is solid. Candidates, roughly in
order of value/effort:

| Feature | Status | Notes |
|---|---|---|
| Background removal | 🧪 | High value, self-contained |
| Generative fill / inpainting | 🧪 | Cost + infra (this is where a backend/Railway could come in) |
| Upscaling / enhance | 🧪 | |
| Auto-adjust (one-click enhance) | 🧪 | Could be non-AI heuristics first |
| Smart selection ("select subject") | 🧪 | |

> When we start AI, that's when a backend (e.g. Railway) and the Vercel AI SDK
> come into play. Until then the app stays 100% client-side — images never leave
> the device.

---

## 5. Accounts / cloud (future)

| Feature | Status | Notes |
|---|---|---|
| User accounts / auth | ⛔ (not yet) | Needs backend |
| Cloud project storage & sync | ⛔ (not yet) | |
| Sharing / collaboration | ⛔ (not yet) | |

---

_How to use this doc: pick items, move them to 🔜, then into a build cycle. When
shipped, mark ✅ and log it in `memory/forge-changelog.md`. Keep it current._
