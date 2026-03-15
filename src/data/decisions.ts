import type { DecisionEntry } from '../types/knowledge';

export const decisions: DecisionEntry[] = [

  {
    id: 'dec-001',
    date: '2026-03-15',
    category: 'build-direction',
    title: 'Keep AMC 258 — no engine swap',
    decision: 'Rebuild and retain the factory AMC 258 4.2L inline-6. No engine swap.',
    rationale: 'Owner preference for stock-ish build focused on mechanical reliability. The 258 is a strong, proven unit when properly rebuilt. Swapping adds complexity, cost, and fabrication work inconsistent with the build goals.',
    alternativesConsidered: ['4.0L HO swap (common Jeep swap, better power)', 'Diesel conversion'],
    affectsSystemIds: ['engine', 'fuel', 'cooling'],
    revisable: false,
  },

  {
    id: 'dec-002',
    date: '2026-03-15',
    category: 'build-direction',
    title: 'Stock-ish look, mechanical reliability focus',
    decision: 'Build for reliability and usability, not performance or show. Stock-ish appearance. No extreme modifications.',
    rationale: 'Owner wants a reliable daily driver with light off-road capability. Not a rock crawler or show build. This keeps the scope manageable and the budget focused on mechanical integrity.',
    alternativesConsidered: ['Full restomod', 'Show-quality restoration'],
    affectsSystemIds: ['body', 'suspension', 'electrical'],
    revisable: true,
  },

  {
    id: 'dec-003',
    date: '2026-03-15',
    category: 'build-direction',
    title: '2.5" lift — Rubicon Express kit',
    decision: 'Install the Rubicon Express 2.5" lift kit (leaf springs + shocks) already purchased.',
    rationale: 'Kit is already on hand. 2.5" is appropriate for mild off-road use — good clearance without requiring driveline angle correction. No SYE needed at this lift height.',
    alternativesConsidered: ['Stay stock height', '3.5"+ lift'],
    affectsSystemIds: ['suspension'],
    revisable: false,
  },

  {
    id: 'dec-004',
    date: '2026-03-15',
    category: 'build-direction',
    title: 'Two frames — choose the better one',
    decision: 'Inspect both the primary frame and the spare matching CJ8 frame. Use whichever is structurally sounder. Cannibalize the other.',
    rationale: 'Primary frame has concerning rust. A matching spare CJ8 frame (with brake and fuel lines) is available. This is unusual luck — use it. The better frame becomes the build foundation.',
    alternativesConsidered: ['Repair primary frame regardless', 'Buy a third frame'],
    affectsSystemIds: ['frame'],
    revisable: false,
  },

  {
    id: 'dec-005',
    date: '2026-03-15',
    category: 'approach',
    title: 'Full DIY — owner has welding equipment and workshop',
    decision: 'All work done by owner including welding. Full workshop with tools and welding equipment available.',
    rationale: 'Owner confirmed: has tools, workshop, equipment, and welding knowledge. Nothing goes to a shop unless specifically chosen to.',
    alternativesConsidered: ['Use shop for welding', 'More shop work overall'],
    affectsSystemIds: ['frame', 'body', 'bed'],
    revisable: false,
  },

  {
    id: 'dec-006',
    date: '2026-03-15',
    category: 'build-direction',
    title: 'Retain Dana 44 rear axle',
    decision: 'Keep the Dana 44 rear axle upgrade from the previous owner. Do not swap back to AMC 20.',
    rationale: 'Dana 44 is significantly stronger than the AMC 20. No axle shaft cracking risk. No reason to downgrade. Only action: confirm gear ratio matches Dana 30 front, service the diff.',
    alternativesConsidered: ['Swap back to AMC 20', 'Upgrade front axle to match'],
    affectsSystemIds: ['rearAxle'],
    revisable: false,
  },

];
