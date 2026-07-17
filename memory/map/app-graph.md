# App architecture graph

Status: [ ] planned | [~] in progress | [✓] built | [✓✓] reviewed | [⚠] issue

Last updated: 2026-07-17 11:50
Phase: Build (Phase 1 — MVP core loop)

## Architecture

```mermaid
graph TD
    subgraph Shell["🖥 React Shell (app/, components/)"]
        Landing["[✓] / landing page"]
        Editor["[✓] /editor (dynamic, ssr:false)"]
        TopBar["[✓] TopBar (import/open/save/export/undo/redo)"]
        Toolbar["[✓] Toolbar (Move/Transform/Pan/Zoom)"]
        Canvas["[✓] CanvasViewport (Pixi mount)"]
        Layers["[✓] LayersPanel"]
        Settings["[✓] SettingsPanel (tooltip toggle)"]
    end
    subgraph State["🔗 State bridge (state/)"]
        EStore["[✓] editor-store (Zustand)"]
        SStore["[✓] settings-store (persisted)"]
    end
    subgraph Core["⚙️ Editor Core (core/ — framework-agnostic)"]
        Engine["[✓] EditorEngine"]
        Graph["[✓] LayerGraph (source of truth)"]
        Cmd["[✓] Command / CommandBus / History"]
        Tools["[✓] ToolManager: Move, Transform, Hand"]
        Render["[✓] Renderer (PixiJS — only pixi importer)"]
        IO["[✓] file-io: import, export, .cpe save/load"]
    end

    Editor --> EStore
    TopBar --> EStore
    Toolbar --> EStore
    Canvas --> EStore
    Layers --> EStore
    Settings --> SStore
    EStore --> Engine
    Engine --> Graph
    Engine --> Cmd
    Engine --> Tools
    Engine --> Render
    Engine --> IO
    Cmd --> Graph
    Tools --> Cmd
    Render --> Graph
```

## Component changelog
| Date/Time | Component | Status | By |
|-----------|-----------|--------|-----|
| 2026-07-17 11:50 | Editor Core (all modules) | [✓] built | builder |
| 2026-07-17 11:50 | React shell + stores | [✓] built | builder |
| 2026-07-17 11:50 | Landing + editor pages | [✓] built | builder |

## Open issues
| Date/Time | Issue | Status | Owner |
|-----------|-------|--------|-------|
| 2026-07-17 11:50 | Transform tool mutates graph transiently during drag (rewound + committed as one Command on release) — acceptable for MVP, revisit for a preview-only channel | open | builder |
| 2026-07-17 11:50 | Layer thumbnails not yet shown in LayersPanel | open | builder |
| 2026-07-17 11:50 | Cut/Copy/Paste + Selection tool not yet implemented (Phase 1 remainder) | open | builder |
