# CreativePhotoEditor

A **free**, browser-first, simplified Photoshop alternative. Import images, stack
them on layers, move / resize, blend, and export a clean flattened image — with
full undo/redo. Nothing to install and your images never leave your device.

> Browser is the MVP. Windows, macOS and mobile shells come later by wrapping the
> same browser core (see `CreativePhotoEditor-cursor-package/ROADMAP.md`).

## Tech stack

| Concern        | Choice                                          |
| -------------- | ----------------------------------------------- |
| Framework      | Next.js 14 (App Router) · TypeScript strict     |
| Rendering      | PixiJS (WebGL) — contained in `core/render`     |
| UI state       | Zustand (mirrors the LayerGraph for React)      |
| Styling        | Tailwind CSS                                     |
| File I/O       | JSZip for the `.cpe` project container          |

## Architecture

The editor is split into a **framework-agnostic core** (`/core`) and a thin React
shell (`/app`, `/components`). The core must survive a future Tauri / mobile wrap,
so it never imports React or Next.

```
core/
  layer-graph/   # LayerGraph — source of truth for a Document
  render/        # Renderer — the ONLY module that imports pixi.js
  commands/      # Command + CommandBus + History (undo/redo)
  tools/         # ToolManager, Move / Transform / Hand tools
  file-io/       # import, export, .cpe save/load
  editor-engine.ts  # orchestrates all of the above
```

**Golden rule:** every mutation to the `LayerGraph` goes through a `Command` so
undo/redo is never an afterthought. UI handlers dispatch Commands — they never
mutate the graph directly.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000  (landing) → /editor
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

## Using the editor

- **Import** an image (top bar) or drag & drop onto the canvas.
- **Move** (V) to drag layers, **Transform** (T) to scale, **Pan** (H) to move the view.
- Adjust **opacity** and **blend mode** per layer in the Layers panel.
- **Undo/Redo** with Ctrl+Z / Ctrl+Y.
- **Save** a re-openable `.cpe` project (Ctrl+S) or **Export** a flattened PNG/JPG/WebP.
- Toggle the **hover info tooltips** in Settings.

## Deployment

The web app deploys to **Vercel** (`vercel.json` sets the Next.js framework).
`main` → Production, `dev` → Preview/Development.

## License

Free and open source.
