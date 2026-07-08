import type { LogEvent } from '../types/knowledge';

// Append-only event log. Never delete or modify entries.
// Add new entries at the END of the array.

export const log: LogEvent[] = [

  {
    id: 'log-001',
    timestamp: '2026-03-15T00:00:00Z',
    sessionDate: '2026-03-15',
    type: 'session_start',
    summary: 'Architecture planning session. Designed full new data architecture: car.ts, plan.ts, decisions.ts, discoveries.ts, log.ts. Created CLAUDE.md session bootstrap. Created knowledge files: cj8-technical.md, israel-context.md, parts-library.md, lessons-learned.md. Created TypeScript type schemas.',
    filesChanged: ['CLAUDE.md', 'src/types/car.ts', 'src/types/knowledge.ts', 'src/knowledge/cj8-technical.md', 'src/knowledge/israel-context.md', 'src/knowledge/parts-library.md', 'src/knowledge/lessons-learned.md'],
  },

  {
    id: 'log-002',
    timestamp: '2026-03-15T01:00:00Z',
    sessionDate: '2026-03-15',
    type: 'session_start',
    summary: 'Setup interview session. Conducted system-by-system interview with owner. Key findings: car outdoors uncovered 8 years, engine in car and last ran (rough idle + smoke), T4 transmission, Dana 300 (noisy + hard shift), Dana 30 front + Dana 44 rear (upgraded, ratio unconfirmed), car on stands no wheels, spare matching CJ8 frame available with brake/fuel lines, Rubicon Express 2.5" lift kit on hand, multiple new parts on hand (brake booster, engine mounts, trans mounts, clutch, proportioning valve, steering damper, carb rebuild kit + seal + cap), bed rusty, radiator cracked+repaired, electric fan never installed. Build decisions: keep AMC 258, stock-ish reliability build, 2.5" lift, use better of 2 frames, DIY except welding.',
    filesChanged: ['src/data/car.ts', 'src/data/decisions.ts', 'src/data/discoveries.ts', 'src/data/plan.ts', 'src/data/log.ts'],
  },

];
