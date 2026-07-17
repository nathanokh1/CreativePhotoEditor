# Session Kickoff — CreativePhotoEditor

Paste this at the start of a new Cursor Agent session to re-orient without manual re-explaining.

---

You're working on **CreativePhotoEditor** — a browser-first, simplified Photoshop alternative (layers, cut/paste, resize/scale, export/save). Before doing anything:

1. Read `/PROJECT_BRAIN.md` — decisions log, principles, current open questions.
2. Read `/TAXONOMY.md` — canonical terms, use them exactly.
3. Read `/ARCHITECTURE.md` — module boundaries and the `.cpe` file format spec.
4. Check `/ROADMAP.md` for the current phase — don't build ahead of it.
5. Rules in `.cursor/rules/` are already loaded automatically — but if anything here conflicts with what you're about to do, the rules win; flag the conflict rather than picking one silently.

**Current phase:** [update this line each session — e.g. "Phase 0: scaffold" or "Phase 1: LayerGraph + Move tool"]

**What I want this session:** [fill in]

Standing reminders:
- Every LayerGraph mutation goes through a Command (undo/redo is not optional, not a later add-on).
- `pixi.js` only gets imported inside `/core/render`.
- Check `@nathanokh/codebase` before building a UI primitive from scratch.
- Approval-by-exception: don't stop for confirmation on routine work. Do stop for new-module kickoff, material architecture changes, direction decisions not already in PROJECT_BRAIN.md, or anything touching `.cpe` save/load (data loss risk).
