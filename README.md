# The Jeep — 1989 CJ8 Scrambler Restoration

The knowledge base and archive for restoring my 1989 Jeep CJ8 Scrambler (AMC 258 · T4 · Dana 300 · Dana 30/44), stalled since ~2018, restarted July 2026. Goal: reliable daily driver + light off-road. Full DIY, in Israel, costs in ₪.

## How this project runs

- **The plan lives in Notion** — a 66-task, 11-phase restoration database with steps, parts, and costs, plus a Garage Inbox for raw field notes. That's the day-to-day surface (phone in the garage).
- **Claude Code is the planning and technical brain.** Sessions start from [CLAUDE.md](CLAUDE.md), process the inbox, update the plan and the files here, and commit.
- **This repo is the memory**: the car's documented state, decisions with rationale, technical references, and version history of all of it.

## What's here

| Path | What it is |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Session bootstrap — architecture, locations, workflow rules |
| [knowledge/car.md](knowledge/car.md) | The living vehicle dossier — every system's condition + history |
| [knowledge/decisions.md](knowledge/decisions.md) | Build decisions, append-only, with rationale |
| [knowledge/lessons-learned.md](knowledge/lessons-learned.md) | What we've confirmed about *this specific car* |
| [knowledge/cj8-technical.md](knowledge/cj8-technical.md) | CJ8 / AMC 258 / Dana 300 technical reference |
| [knowledge/israel-context.md](knowledge/israel-context.md) | Local sourcing: Jeepland, imports, customs math |
| [knowledge/parts-library.md](knowledge/parts-library.md) | Part numbers, cross-refs, ₪ estimates |
| [manuals/](manuals/) | Three CJ8 PDF manuals (Battlefield Repairs EN, JEEPOLOG Hebrew ×2) |
| [archive/](archive/) | Retired history — see below |

## The archive

This project's first incarnation (March 2026) was an AI-powered React app — in-app Claude advisor, streaming chat, plan-editing tools, three persistence layers, a jeepland.co.il scraper. It produced an excellent 65-task plan in four days of use, then went quiet; the plan outlived the software. In July 2026 the plan migrated to Notion and the app was retired.

- `archive/app/` — the complete React app, kept for reference (its `src/data/plan.ts` was the original plan source)
- `archive/app-data/` — the app's runtime data and snapshots
- `archive/notion-export-2018/` — the original pre-app Notion to-do list, where it all started
