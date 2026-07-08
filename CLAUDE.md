# CJ8 Restoration — Claude Session Bootstrap

Read this at the start of every session. Architecture v3 (2026-07-08): **Notion is the tracker, Claude Code is the only brain, the local `knowledge/` folder is its library.** The old React app is archived — do not develop it.

---

## The Project

Restoring a **1989 Jeep CJ8 Scrambler** — partially disassembled, stalled since ~2018, plan built 2026-03, restart attempt began 2026-07. Goal: reliable daily driver + light off-road. Full DIY including welding (dec-005). Based in Israel; costs in ₪; primary supplier Jeepland (jeepland.co.il), US import possible (+3–6 weeks, ~35–40% customs/VAT overhead).

**Quick spec:** AMC 258 4.2L i6 · T4 4-speed · Dana 300 t-case · Dana 30 front · **Dana 44 rear (PO upgrade, not AMC 20)** · 103.5" wheelbase. Full state: `knowledge/car.md`.

---

## Where Everything Lives

| What | Where |
|---|---|
| **The plan** (11 phases, ~66 tasks, status, ₪) | Notion DB **"🔧 CJ8 Restoration Plan"** — https://app.notion.com/p/276a9f52fbe543a3ba46d90363c960ac · data source `collection://7121b07d-2304-4b6a-8cda-ac8b30620852` |
| **Garage Inbox** (raw notes/photos from Sinai) | Notion page — https://app.notion.com/p/397c634fa4e981f1a766eec43a98912e |
| **Garage Quick Reference** (fluids/torques/specs card — keep in sync with cj8-technical.md) | https://app.notion.com/p/397c634fa4e98119b5e5fee0eed1b956 |
| **Parts On Hand** (inventory of already-bought parts — tick when installed) | https://app.notion.com/p/397c634fa4e98162a7fcde71c256b194 |
| Parent Notion page ("The Jeep", also has manual PDFs) | https://app.notion.com/p/5a35b3c476f744aa99dfed4fe5311e7a |
| **Car dossier** (per-system condition + history) | `knowledge/car.md` |
| **Decisions** (append-only, with rationale) | `knowledge/decisions.md` |
| Lessons learned about THIS car | `knowledge/lessons-learned.md` |
| CJ8/AMC technical reference | `knowledge/cj8-technical.md` |
| Israel sourcing/import knowledge | `knowledge/israel-context.md` |
| Parts library (part numbers, cross-refs) | `knowledge/parts-library.md` |
| PDF manuals (Battlefield Repairs, JEEPOLOG Hebrew ×2) | `manuals/` |
| Git repo (version system — commit every session; root = this folder) | github.com/sinaib/jeep-cj8-renovation-planner |
| Archived app + retired plan.ts (historical reference only) | `archive/app/` — `archive/app/src/data/plan.ts` was the plan until 2026-07-08; old Notion export + app runtime data also under `archive/` |

Notion DB schema: Task (title) · Phase (select, zero-padded: `01 · Assess`, `02 · Frame`, `03 · Drivetrain`, `04 · Engine`, `05 · Brakes`, `06 · Susp & Steering`, `07 · Fuel`, `08 · Cooling`, `09 · Electrical`, `10 · Body`, `11 · Commission`) · Step (order within phase) · Status (To Do / In Progress / Blocked / Done) · Priority (Critical/High/Medium/Low) · Est ₪ / Actual ₪ · Blocked by (text, task names) · Notes. Task pages contain `## Steps` (checkboxes) and `## Parts`. ⚠️ Renaming select options via schema ALTER recreates them and orphans existing page values — never rename options that way again; add new options and migrate values instead.

---

## Session Ritual

1. Read this file (done).
2. **Fetch the Garage Inbox.** If it has content, process every line: route to plan tasks (create/update in Notion), `car.md` history, `decisions.md`, or lessons-learned. Then empty the inbox (leave the instructions header).
3. **Query the plan DB** for recently edited tasks (Sinai ticks things directly in Notion — that's expected and needs no announcement). Reconcile: completions → add `car.md` history entries; a completion that implies new information → ask about it (e.g. compression test done → ask for the numbers).
4. Ask what this session is for, or continue obvious pending work.
5. Work. Update Notion + local files together so they never drift.
6. **Refresh the cockpit** on The Jeep page: update the 📍 NOW callout (current phase, next garage move, date); when the active phase changes, replace the "Work Now" linked view on the page with a new one filtered to the new phase (views can't be edited via the connector — create a new view with parent_page_id, then swap the block via update_content; current block: `397c634fa4e98176b495c57ef302c448`).
7. **Commit** with a meaningful message. Every session ends with a commit.

## Workflow Rules

- **NEVER delete anything without Sinai's explicit approval** — no files, folders, Notion pages/blocks, git content, DB options — no matter how safe or recreatable it seems. Itemize what would be deleted and ask first. Prefer archiving/moving over deleting. Approval of a task does NOT include deletions inside it.
- **Route by thinking.** Status/costs/checkboxes: Sinai edits Notion directly, no ceremony. Anything requiring judgment — discoveries, decisions, replanning, technical Q&A — goes through Claude Code, which updates all homes at once.
- **The inbox is a buffer, not a record.** Nothing lives there; things pass through. The record is the plan DB + `car.md` + `decisions.md`.
- **decisions.md is append-only.** Supersede, never delete. Don't relitigate settled decisions (engine stays, Dana 44 stays, RE 2.5" lift) unless Sinai reopens them.
- **car.md grows.** Every real-world event (inspection, repair, install, discovery) appends to the relevant system's history.
- **No bookkeeping for its own sake.** If an update doesn't change garage work or future advice, don't record it. No logs-of-logs — git history is the audit trail.
- Read the relevant knowledge file before technical/sourcing answers; read the manuals (PDFs) when a question needs factory specs.

## Owner Context

Sinai — product-minded, prefers minimal ceremony and quality UX, no gamification. Has a full workshop incl. welding. Also runs a motorcycle recommissioning tracker in Notion (same pattern, under his Dashboard). Speaks English; source materials partly Hebrew — inbox notes may be in either language.
