# Jeep CJ8 1989 Renovation Planner

An AI-powered, interactive renovation tracker for a Jeep CJ8 1989 restoration — built to keep a multi-year project organized, motivated, and technically informed.

## What it does

- **Agent-built plan**: On first launch, an AI mechanic advisor interviews you system by system (engine, brakes, suspension, electrical, body…) and builds a custom renovation plan from your answers — not from a template
- **Living plan**: Always-visible plan document showing all phases and tasks. Talk to the agent at any time to update progress, add discoveries, reorganize priorities
- **Gap detection**: The agent knows common CJ8 1989 failure points and flags things you might have missed
- **Per-task AI briefings**: On-demand technical briefing per task — tools needed, common mistakes, CJ8-specific tips, part suggestions
- **Parts tracking**: Parts list per task with purchase status
- **Cost tracking**: Estimated and actual costs in ILS (₪)
- **PDF manuals**: All three CJ8 reference manuals available inline
- **Progress persistence**: Auto-saves to localStorage + export/import JSON

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Create `.env.local` and add your Anthropic API key:
   ```
   VITE_ANTHROPIC_API_KEY=your_key_here
   ```
4. Run: `npm run dev`
5. Open `http://localhost:5173`

## Tech stack

- React + Vite + TypeScript
- Zustand (state + localStorage persistence)
- Framer Motion (animations)
- Anthropic Claude API (`claude-sonnet-4-6`) with streaming + tool use

## PDF Manuals included

- `Battlefield_Repairs_Manual.pdf` — English field repair guide (8 pages)
- `CJ8_Hebrew_Manual_(JEEPOLOG).pdf` — Comprehensive Hebrew reference
- `CJ8_Manual_-_Gimel_(JEEPOLOG).pdf` — Hebrew supplementary manual
