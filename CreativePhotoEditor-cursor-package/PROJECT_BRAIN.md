# PROJECT_BRAIN — CreativePhotoEditor

> Living memory document. Cursor agents read this at session start (via CURSOR_PROJECT_PROMPT.md) to re-orient without manual re-explaining. Keep this updated as decisions land — stale brain docs are worse than none.

---

## 1. What This Is

A super-simple, web-first photo editor. Not trying to be a full pro suite. Trying to be the 20% of a pro editor that covers 80% of what people actually do: bring in images, stack them on layers, cut/paste/resize/move things around, and export a clean flattened image.

**Not building (yet, maybe never):** RAW processing, CMYK/print workflows, plugin ecosystem, 3D, video timeline, AI generative fill. If a feature request smells like "full pro-suite parity," it's out of scope until explicitly re-opened.

## 2. Platform Sequence

1. **Browser (MVP)** — this is the actual product for v1. Everything is designed browser-first.
2. **Windows** — deferred. When we get there, the plan is to wrap the browser app (Tauri, most likely) rather than build a second app. This is *why* the web app must stay UI-framework-agnostic at the rendering core — see ARCHITECTURE.md.
3. **Mac / Mobile** — not scoped. Don't design against these yet; don't design against them being impossible either.

## 3. Core Decisions Log

| Date | Decision | Why |
|---|---|---|
| 2026-07-17 | Rendering engine: **PixiJS (WebGL) core + custom `LayerGraph` abstraction** | Photo editing is GPU-bound (filters, blend modes, large rasters) once you go past toy examples. Konva/Fabric give nice layer ergonomics but their 2D canvas renderer becomes the bottleneck. Decision: keep the ergonomics (named layers, groups, transforms, hit-testing) but build them ourselves on top of Pixi's GPU pipeline instead of inheriting a 2D-canvas performance ceiling. |
| 2026-07-17 | Desktop strategy: **defer, browser-only MVP** | Don't fork effort into packaging before the core editing experience is solid. Revisit once web MVP + performance on large images is proven. |
| 2026-07-17 | Repo relationship: **standalone repo, bidirectional with `@nathanokh/codebase`** | Pulls existing shared UI/utils where they fit (check before building). Also expected to *push* reusable pieces back up — panel primitives, color picker, toolbar shell, modal system are likely candidates once built once here. |
| 2026-07-17 | File format: **`.cpe` project file** — zip container, `manifest.json` + per-layer raster data (WebP) | Keeps project files portable, human-inspectable at the manifest level, and avoids inventing a binary format we have to maintain a parser for. |
| 2026-07-17 | Framework: **Next.js 14 + TypeScript**, matches existing stack (nathanokh.com, Luma) | Consistency across projects; team (you + Cursor agents) already fluent in this stack. |

## 4. Principles (inherited from Forge + your standing preferences)

- **KISS.** Simple, reusable, short purposeful comments. No over-engineering a layers panel before layers work.
- **Check `@nathanokh/codebase` before building anything new.** Don't rebuild a color picker if one exists.
- **Architecture before code.** This package exists so Cursor isn't guessing at structure mid-build.
- **Approval-by-exception**, per Forge's four triggers (kickoff, material change, direction decision, safety floor) — not approval-by-default. Don't gate every commit on a check-in.
- **Self-documentation first-class.** This file gets updated as decisions land, not after the fact.

## 5. Open Questions (resolve as they come up, don't block on them now)

- Exact blend-mode list for MVP vs later (start with Normal, Multiply, Screen, Overlay — expand if needed).
- Selection tool order: rectangle first, then lasso — magic wand is a stretch goal, not MVP.
- Undo/redo depth limit and whether history persists across sessions (probably not for MVP — in-memory only).
- Whether `.cpe` files get thumbnail previews embedded in the manifest for a future "recent projects" screen.

## 6. Terminology

See TAXONOMY.md — don't invent new terms for these concepts once defined there.
