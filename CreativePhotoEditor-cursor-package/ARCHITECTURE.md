# ARCHITECTURE — CreativePhotoEditor

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App Shell                    │
│   (routing, project list, top-level UI chrome)           │
└───────────────────────┬───────────────────────────────────┘
                         │
┌───────────────────────▼───────────────────────────────────┐
│                    Editor Workspace (React)                │
│  ┌──────────┐  ┌────────────────────────┐  ┌────────────┐ │
│  │ Toolbar  │  │      Canvas Viewport     │  │ Layers     │ │
│  │ (Tools)  │  │   (Pixi <canvas> mount)  │  │ Panel      │ │
│  └────┬─────┘  └────────────┬─────────────┘  └─────┬──────┘ │
│       │                     │                       │        │
└───────┼─────────────────────┼───────────────────────┼────────┘
        │                     │                       │
        ▼                     ▼                       ▼
┌────────────────────────────────────────────────────────────┐
│                      Editor Core (framework-agnostic)        │
│                                                                │
│  ToolManager ──────┐                                          │
│                     ▼                                         │
│  CommandBus ───► History Stack (undo/redo)                    │
│                     │                                         │
│                     ▼                                         │
│  LayerGraph ───► Pixi Renderer (WebGL compositor)              │
│                     │                                         │
│                     ▼                                         │
│  FileIO (Import / Export / Save / Load .cpe)                  │
└────────────────────────────────────────────────────────────┘
```

**Why "Editor Core (framework-agnostic)" is its own layer:** this is the piece that has to survive a future Tauri wrap and, eventually, a mobile shell. It must not import React, Next.js routing, or any browser-only API it doesn't have to. Treat it as a package that *could* be published standalone (and likely should move into `@nathanokh/codebase` once stable — see PROJECT_BRAIN.md decision log).

## Module Breakdown

### 1. LayerGraph (`/core/layer-graph`)
- Owns the tree of Layers/Groups, z-order, and per-layer transform/opacity/blendMode/visibility state.
- Pure data + methods — no rendering logic in here.
- Serializes directly to/from the `.cpe` manifest schema.

### 2. Render Engine (`/core/render`)
- Wraps PixiJS. Subscribes to LayerGraph changes, re-composites the WebGL scene.
- Owns viewport pan/zoom.
- Exposes `renderer.extract()` for flatten-to-image (used by Export).
- This is the only module allowed to import `pixi.js` directly. Keep Pixi contained here so a future engine swap doesn't ripple through the app.

### 3. Command System (`/core/commands`)
- Every mutation (move, resize, add layer, delete layer, paste) is a `Command` object with `execute()` / `undo()`.
- `CommandBus` pushes to the History Stack.
- **Rule for Cursor agents: never mutate LayerGraph state directly from a React event handler.** Always dispatch a Command. This is what makes undo/redo not an afterthought.

### 4. Tool System (`/core/tools`)
- `ToolManager` holds the active Tool and routes pointer events to it.
- MVP tools: `MoveTool`, `SelectionRectTool`, `TransformTool` (resize/scale/rotate handles).
- Each Tool translates raw pointer events into Commands — it doesn't touch LayerGraph directly either.

### 5. File I/O (`/core/file-io`)
- `importImage(file)` → creates a new Layer.
- `exportFlattened(format)` → PNG/JPEG/WebP via Render Engine's `extract()`.
- `saveProject()` / `loadProject()` → zip manifest + layer WebP data, per `.cpe` spec (see below).

### 6. React Shell (`/app`, `/components`)
- Thin. Renders panels, wires user interaction to ToolManager/CommandBus, subscribes to LayerGraph for the Layers Panel list.
- State bridge: LayerGraph emits change events → a lightweight store (Zustand) mirrors just what the UI needs to re-render. Zustand is not the source of truth — LayerGraph is. Don't let this invert.

## `.cpe` Project File Spec (v1, minimal)

```
project.cpe (zip)
├── manifest.json
│   {
│     "version": 1,
│     "name": "string",
│     "canvas": { "width": number, "height": number },
│     "layers": [
│       {
│         "id": "string",
│         "name": "string",
│         "type": "raster",
│         "dataFile": "layers/{id}.webp",
│         "transform": { "x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0 },
│         "opacity": 1,
│         "blendMode": "normal",
│         "visible": true
│       }
│     ]
│   }
└── layers/
    ├── {id}.webp
    └── ...
```

Extend this schema when new Layer types (text, vector) land — don't build a second format.

## Codebase Sharing Notes

Before building any of the following, check `@nathanokh/codebase` first — likely already exists or belongs there:
- Toolbar/panel shell primitives
- Color picker
- Modal/dialog system
- Generic drag-to-resize handle component

Likely candidates to **push up** to `@nathanokh/codebase` once proven here (don't push prematurely — prove it in this repo first):
- Panel shell primitives (if not already shared)
- Command/History Stack pattern itself, if it turns out generically useful beyond this project
