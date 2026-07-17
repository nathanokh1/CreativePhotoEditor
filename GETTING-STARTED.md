# Getting Started

Forge wires in **once per project**. After that, just talk to the agent.

---

## New or existing project

```powershell
cd path\to\your-project
```

In Cursor, say:

> **Start using Forge**

The agent runs everything. You do not need the terminal.

Prefer CLI? Run `forge-go` or `.\forge-go.cmd`.

**What happens (automatic):**

1. Agents, skills, rules, memory, **Ops Hub** wired in
2. Layer 0 RAG + orchestrator + Hub server start
3. Browser opens to Forge Hub
4. Orchestrator queues the next agent job

Then tell the agent what you're building.

---

## Every new chat?

**No setup repeat.** Same project, new chat = just work.

| Situation | What you do |
|-----------|-------------|
| First time on this project | "Start using Forge" (once) |
| New chat, same project | Describe your task |
| New project folder | "Start using Forge" (once) |
| After PC reboot | Nothing — agent runs `forge-start` silently |

---

## First time on this machine

```powershell
forge-machine-setup    # Python, agentmemory
forge-first-run        # GitHub, Brave, projects path
```

Restart Cursor after keys are set.

### Optional keys (press Enter to skip at forge-first-run)

| Key | Needed for normal Forge? |
|-----|--------------------------|
| **Anthropic API** | No — only desktop computer-use automation |
| **Cursor API** | No — only future auto-spawn; Hub works without it |

Your Hub already shows **ready** with GitHub + Brave configured.

---

## Daily rhythm

Open Cursor in your project and work. Hub stays at `memory/ops/project.json` → `hub_url`.

Run `forge-ops` to reopen the Hub anytime.

---

## Forge Hub

| Tab | Purpose |
|-----|---------|
| **Home** | Readiness, quick start |
| **Setup** | Connection checklist |
| **Control Room** | Live agents + feed |

---

## Reference

- `FORGE-EXPLAINED.md` — architecture
- `docs/plan.md` — orchestrator design
