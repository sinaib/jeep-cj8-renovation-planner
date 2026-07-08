# Decisions — Permanent Memory

Build-direction and approach decisions for the CJ8 restoration. **Append-only, with dates and rationale.** Never delete — if a decision changes, append a new entry that supersedes the old one and links back. Converted from the app's `decisions.ts` on 2026-07-08.

---

## dec-001 · Keep AMC 258 — no engine swap
**2026-03-15 · build-direction · not revisable**
Rebuild and retain the factory AMC 258 4.2L inline-6. No engine swap.
- **Why:** Owner preference for a stock-ish build focused on mechanical reliability. The 258 is a strong, proven unit when properly rebuilt. Swapping adds complexity, cost, and fabrication inconsistent with build goals.
- **Alternatives considered:** 4.0L HO swap (common, better power); diesel conversion.
- **Affects:** engine, fuel, cooling.

## dec-002 · Stock-ish look, mechanical reliability focus
**2026-03-15 · build-direction · revisable**
Build for reliability and usability, not performance or show. Stock-ish appearance, no extreme modifications.
- **Why:** Goal is a reliable daily driver with light off-road capability — not a rock crawler or show build. Keeps scope manageable, budget focused on mechanical integrity.
- **Alternatives considered:** full restomod; show-quality restoration.
- **Affects:** body, suspension, electrical.

## dec-003 · 2.5" lift — Rubicon Express kit
**2026-03-15 · build-direction · not revisable**
Install the Rubicon Express 2.5" lift kit (leaf springs + shocks) already purchased.
- **Why:** Kit is on hand. 2.5" suits mild off-road — good clearance without driveline angle correction; no SYE needed at this height.
- **Alternatives considered:** stay stock height; 3.5"+ lift.
- **Affects:** suspension.

## dec-004 · Two frames — choose the better one
**2026-03-15 · build-direction · not revisable**
Inspect both the primary frame and the spare matching CJ8 frame; use whichever is structurally sounder, cannibalize the other.
- **Why:** Primary has concerning rust; a matching spare CJ8 frame (with brake and fuel lines) is available — unusual luck. The better frame becomes the build foundation.
- **Alternatives considered:** repair primary regardless; buy a third frame.
- **Affects:** frame.

## dec-005 · Full DIY — owner has welding equipment and workshop
**2026-03-15 · approach · not revisable**
All work done by owner, **including welding**. Full workshop with tools and welding equipment available.
- **Why:** Owner confirmed capability and equipment. Nothing goes to a shop unless specifically chosen.
- **Alternatives considered:** shop welding; more shop work overall.
- **Affects:** frame, body, bed.
- Note: this supersedes the older assumption ("DIY everything **except** welding") that appeared in early project docs.

## dec-006 · Retain Dana 44 rear axle
**2026-03-15 · build-direction · not revisable**
Keep the previous owner's Dana 44 rear axle upgrade; do not swap back to AMC 20.
- **Why:** Dana 44 is significantly stronger; no AMC 20 axle-shaft cracking risk. Only actions: confirm gear ratio matches the Dana 30 front, service the diff.
- **Alternatives considered:** swap back to AMC 20; upgrade front axle to match.
- **Affects:** rear axle.

## dec-007 · Retire the in-app AI advisor; Notion becomes the tracker
**2026-07-08 · tooling · revisable**
The jeep-planner React app is archived (repo kept, not developed). The restoration plan lives in the Notion "🔧 CJ8 Restoration Plan" database; raw garage notes go to the Notion "Garage Inbox" page; Claude Code is the single planning/technical brain, with its knowledge base in `knowledge/`.
- **Why:** The app's dual-brain design (in-app agent + Claude Code) created sync overhead; the dev-server-hosted app rotted after 4 days of use; Notion is phone-native, zero-maintenance, and already proven by the owner's motorcycle recommissioning tracker.
- **Alternatives considered:** keep app as viewer (dev-server dependency); files-only (no garage surface).
- **Affects:** tooling/workflow only.
