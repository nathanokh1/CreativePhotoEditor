# Backlog

Prioritized work queue for this project.

Priority: P1 (do next) | P2 (soon) | P3 (nice to have) | HOLD
Status: todo | in-progress | in-review | done | blocked

## Active
| Priority | Feature / Task | Status | Added | Notes |
|----------|---------------|--------|-------|-------|
| P1 | Cut / Copy / Paste (internal Clipboard, layer + selection level) | todo | 2026-07-17 | Phase 1 remainder |
| P1 | Selection-Rectangle tool | todo | 2026-07-17 | Phase 1; feeds cut/paste |
| P1 | Layer thumbnails in LayersPanel | todo | 2026-07-17 | Render small preview per layer |
| P2 | Drag-to-reorder layers (currently up/down buttons) | todo | 2026-07-17 | HTML5 DnD or pointer-based |
| P2 | Transform: rotation + corner handles | todo | 2026-07-17 | Phase 2 tooling |
| P2 | Vercel prod + dev deployment wired to GitHub | in-progress | 2026-07-17 | main → prod, dev → preview |
| P3 | PWA/offline (Phase 3) | todo | 2026-07-17 | |
| P3 | Tauri Windows wrap (Phase 4) | HOLD | 2026-07-17 | after web MVP solid |

## Done
| Feature / Task | Completed | Notes |
|---------------|-----------|-------|
| Phase 0 scaffold (Next.js 14 + TS + Tailwind + PixiJS + Zustand) | 2026-07-17 | Build passes |
| Editor Core (LayerGraph, Commands/History, Renderer, Tools, file-io) | 2026-07-17 | Framework-agnostic |
| MVP loop: import → move/scale → layers panel → undo/redo → export → save/load .cpe | 2026-07-17 | Verified in browser |
| Toggleable hover info tooltips + Settings | 2026-07-17 | Master toggle + delay |

Related: [[forge-changelog]] | [[app-graph]]
