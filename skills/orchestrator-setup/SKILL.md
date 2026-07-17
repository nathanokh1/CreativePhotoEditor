---
name: orchestrator-setup
description: Sets up the Forge orchestrator and Ops UI for a project — memory/ops layer, local dashboard server, and handoff rules engine. Run after forge-setup when you want background agent coordination and a control-room view of agent activity. Invoke when enabling forge-orchestrator, forge-ops, or the Ops dashboard for the first time.
---

# Orchestrator Setup

Wires the orchestrator runtime and observability layer into a Forge project.

---

## Prerequisites

- `forge-setup` completed (or equivalent: `memory/`, `docs/`, agents linked)
- Node.js 18+ installed
- Forge global install at `~/.forge` (or dev: `forge-global/` in repo)

---

## Step 1: Create memory/ops

If `memory/ops/` does not exist, copy from templates:

```bash
# macOS/Linux
mkdir -p memory/ops
cp ~/.forge/forge-global/templates/ops/* memory/ops/
```

```powershell
# Windows
New-Item -ItemType Directory -Force -Path memory\ops
Copy-Item -Force $env:USERPROFILE\.forge\forge-global\templates\ops\* memory\ops\
```

Files created:
| File | Purpose |
|------|---------|
| `state.json` | Agent roster + live status |
| `config.json` | Poll interval, caps, night mode |
| `feed.md` | Chat-style activity timeline |
| `dashboard.html` | Browser control room |
| `.ops-server.mjs` | Local HTTP server (fixes browser CORS) |
| `OPS.md` | Obsidian hub note |

Do not commit secrets to `memory/ops/`.

---

## Step 2: Open the Ops dashboard

**Do not open `dashboard.html` via file://** — browsers block live data loading.

```bash
forge-ops          # macOS/Linux
```

```powershell
forge-ops          # Windows (from project root)
```

Or manually:
```bash
node memory/ops/.ops-server.mjs
# Open http://127.0.0.1:8766/dashboard.html
```

Dashboard auto-refreshes every 5 seconds when served over HTTP.

---

## Step 3: Run the orchestrator (once)

Test a single poll cycle:

```bash
forge-orchestrator --once
```

```powershell
.\forge-global\scripts\windows\forge-orchestrator.ps1 -Once
```

Expected:
- `memory/ops/events.jsonl` gains a `poll` event
- If a handoff rule matches, `memory/ops/next-prompt.md` is written
- `memory/ops/feed.md` gets a queue entry
- Matching agent card in dashboard shows active status (e.g. Researching)

---

## Step 4: Act on next-prompt (Phase 1)

Until Cursor SDK spawn is enabled (Phase 2), the orchestrator writes prompts to
`memory/ops/next-prompt.md`. To run the queued job:

1. Open Cursor in the project
2. Paste the contents of `next-prompt.md` into chat
3. When done, agent sets status back to idle in `state.json` or orchestrator resets on next poll

Phase 2 adds automatic SDK spawn when `CURSOR_API_KEY` is set.

---

## Step 5: Optional — continuous polling

Run orchestrator as a background loop (default 60s interval):

```bash
forge-orchestrator
```

Configure in `memory/ops/config.json`:
- `poll_interval_seconds`
- `max_runs_per_hour`
- `night_mode` (pauses overnight)
- `roles_enabled`

---

## Handoff rules (summary)

| Trigger | Role | Output |
|---------|------|--------|
| P1 backlog todo, no brief | Ideation | `docs/brief.md` |
| brief exists, no research | Researcher | `docs/research.md` |
| research exists, no plan | Architect | `docs/plan.md` |
| plan exists, no handoff | Builder | `docs/handoff.md` |
| handoff newer than review | Code Reviewer | `docs/review.md` |
| review has blocking issues | Builder | fixes |

Full rules: `docs/plan.md`

---

## Obsidian integration

Open `memory/ops/OPS.md` in Obsidian. Link to dashboard, feed, and backlog Kanban.

---

## Log setup

Append to `memory/forge-changelog.md`:
```
[date] | SETUP | orchestrator-setup | ops layer + dashboard ready |
```

---

## Escalation

Routine setup — proceed without approval. Escalate if:
- `config.json` spawn_mode requests cloud SDK and credentials are missing
- Safety floor blocks appear in feed without clear cause
