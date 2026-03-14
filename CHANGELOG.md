# Changelog

All notable changes to the Jeep CJ8 1989 Renovation Planner are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [0.1.0] — 2026-03-14

### Added
- **Agent-driven onboarding**: AI mechanic advisor (Claude claude-sonnet-4-6) interviews the user system by system to build the renovation plan from scratch — no pre-baked task list
- **12 CJ8 vehicle systems** with known 1989 failure points and inspection checklists: Engine, Fuel, Cooling, Transmission, Driveshafts, Brakes, Steering, Suspension, Electrical, Body, Interior, Upgrades
- **Live plan preview** during onboarding — tasks appear in real-time as the agent adds them
- **AI Agent drawer** — always accessible from any screen, persists full conversation history
- **Agent tools**: add_task, add_phase, update_task_status, add_task_note, update_task_cost, add_part_to_task, flag_gap, remove_task, move_task, get_full_plan
- **Gap detection** — agent flags missing items (e.g. clutch slave cylinder when only clutch is mentioned)
- **Per-task AI briefings** — on-demand: tools needed, difficulty rating, CJ8-specific tips, common mistakes, safety warnings, part suggestions
- **Always-visible plan sidebar** — collapsible phase tree with inline task list and completion dots
- **Full plan view** (`/plan`) — scrollable living document with all phases, tasks, status, costs, gap alerts
- **Journey Map** — visual phase path with animated nodes (completed/active/locked states)
- **Phase detail view** — numbered step-by-step layout per phase
- **Task detail panel** — slides in from right: status selector, complete button, cost input, notes, parts checklist, manual refs
- **Parts tracking** — per-task parts list with purchase toggle
- **Cost tracking** — estimated (₪) and actual costs, totals in home view
- **PDF Manual library** — all three CJ8 manuals served as static assets, viewable inline via iframe
- **Progress persistence** — Zustand persist middleware writes to localStorage on every change
- **Export progress** — download timestamped JSON backup
- **Import progress** — restore from a previously exported JSON file
- **Settings panel** — save/load progress, API key info, full reset
- **Dark military theme** — olive green, Jeep amber, near-black background
- **Framer Motion animations** — completion ripple, phase glow, spring-physics panels, streaming message reveal
