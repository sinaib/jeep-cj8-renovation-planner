// ─── CJ8 Restoration Plan ──────────────────────────────────────────────────
// Generated: 2026-03-15, setup interview session.
// Maintained by Claude Code. Do not edit manually — update via Claude session.
//
// Phases follow the correct restoration order for a stalled frame-off rebuild.
// Each task has: id, name, phase, priority, status, parts on hand, steps summary,
// estimated cost (₪), and dependencies.

export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'skipped' | 'blocked';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface PlanPart {
  name: string;
  status: 'needed' | 'on-hand' | 'ordered' | 'installed';
  estimatedCostILS?: number;
  source?: string;
  notes?: string;
}

export interface PlanTask {
  id: string;
  name: string;
  phaseId: string;
  systemId: string;
  priority: Priority;
  status: TaskStatus;
  dependsOn: string[];           // task IDs that must be done first
  steps: string[];               // key steps — not full guide, just the sequence
  parts: PlanPart[];
  estimatedCostILS: number;      // parts cost estimate (labor = 0, DIY)
  notes: string;
  completedAt?: string;
  guideRef?: string;             // link to knowledge/guides/*.md when written
}

export interface PlanPhase {
  id: string;
  order: number;
  name: string;
  description: string;
  color: string;                 // hex color for UI
  taskIds: string[];
}

// ─── PHASES ───────────────────────────────────────────────────────────────────

export const phases: PlanPhase[] = [
  {
    id: 'phase-1',
    order: 1,
    name: 'Assessment & Documentation',
    description: 'Full inspection of every system before any wrenching. Know exactly what you have before committing to anything.',
    color: '#6366f1',
    taskIds: [
      'assess-engine',
      'compression-test',
      'inspect-primary-frame',
      'inspect-spare-frame',
      'choose-frame',
      'inspect-tub',
      'inspect-bed',
      'inspect-front-axle',
      'inspect-rear-axle',
      'confirm-gear-ratio',
      'inspect-transfer-case',
      'inspect-transmission',
      'inspect-brake-lines',
      'inspect-wiring-harness',
      'inspect-tires',
    ],
  },
  {
    id: 'phase-2',
    order: 2,
    name: 'Frame',
    description: 'Choose and prepare the frame. Everything else assembles onto this foundation.',
    color: '#ef4444',
    taskIds: [
      'frame-rust-treatment',
      'frame-weld-repairs',
      'frame-body-mount-inspection',
      'strip-spare-frame',
    ],
  },
  {
    id: 'phase-3',
    order: 3,
    name: 'Drivetrain',
    description: 'Transmission, transfer case, and axles — rebuilt and ready while everything is accessible.',
    color: '#f97316',
    taskIds: [
      'rebuild-transfer-case',
      'service-front-diff',
      'service-rear-diff',
      'replace-front-ujoint',
      'replace-rear-ujoint',
      'replace-trans-mounts',
      'install-clutch',
    ],
  },
  {
    id: 'phase-4',
    order: 4,
    name: 'Engine',
    description: 'Assess engine condition, decide rebuild depth, execute. Tune for reliable running.',
    color: '#eab308',
    taskIds: [
      'engine-oil-inspection',
      'replace-engine-mounts',
      'carb-rebuild',
      'tune-up-ignition',
      'replace-exhaust-manifold',
      'engine-deep-rebuild',    // conditional — depends on compression test results
    ],
  },
  {
    id: 'phase-5',
    order: 5,
    name: 'Brakes',
    description: 'Complete brake system rebuild. Non-negotiable before the car moves under its own power.',
    color: '#dc2626',
    taskIds: [
      'replace-brake-lines',
      'replace-wheel-cylinders',
      'replace-brake-drums-shoes',
      'install-brake-booster',
      'install-proportioning-valve',
      'bleed-brakes',
    ],
  },
  {
    id: 'phase-6',
    order: 6,
    name: 'Suspension & Steering',
    description: 'Install lift kit and sort steering. Makes the car driveable and correct.',
    color: '#22c55e',
    taskIds: [
      'inspect-spring-mounts',
      'install-lift-kit',
      'replace-drag-link',
      'install-steering-damper',
      'inspect-steering-box',
      'replace-tie-rod-ends',
    ],
  },
  {
    id: 'phase-7',
    order: 7,
    name: 'Fuel System',
    description: 'Tank, lines, carb — all fresh. Must be right before any extended running.',
    color: '#06b6d4',
    taskIds: [
      'inspect-fuel-tank',
      'clean-fuel-tank',
      'replace-fuel-lines',
      'install-electric-fan',
    ],
  },
  {
    id: 'phase-8',
    order: 8,
    name: 'Cooling System',
    description: 'Pressure test, hoses, electric fan installation. Engine cannot run reliably without this.',
    color: '#3b82f6',
    taskIds: [
      'pressure-test-radiator',
      'replace-cooling-hoses',
      'replace-thermostat',
      'replace-water-pump',
    ],
  },
  {
    id: 'phase-9',
    order: 9,
    name: 'Electrical',
    description: 'Full harness inspection, fix bodge repairs, ground straps. Make all circuits trustworthy.',
    color: '#a855f7',
    taskIds: [
      'check-ground-straps',
      'test-all-circuits',
      'repair-wiring-harness',
      'test-charging-system',
    ],
  },
  {
    id: 'phase-10',
    order: 10,
    name: 'Body & Assembly',
    description: 'Tub rust treatment, bed repair, then assemble the car back together.',
    color: '#64748b',
    taskIds: [
      'tub-rust-treatment',
      'bed-rust-repair',
      'install-body-mounts',
      'mount-tires',
      'final-assembly',
    ],
  },
  {
    id: 'phase-11',
    order: 11,
    name: 'Commissioning',
    description: 'First start, break-in, systems check, initial drive. The car becomes a car again.',
    color: '#f59e0b',
    taskIds: [
      'pre-start-checklist',
      'first-start',
      'break-in-drive',
      'post-drive-inspection',
    ],
  },
];

// ─── TASKS ────────────────────────────────────────────────────────────────────

export const tasks: Record<string, PlanTask> = {

  // ── PHASE 1: ASSESSMENT ────────────────────────────────────────────────────

  'assess-engine': {
    id: 'assess-engine',
    name: 'Engine visual inspection',
    phaseId: 'phase-1',
    systemId: 'engine',
    priority: 'critical',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Check oil level and condition — color, consistency, smell, metal flakes',
      'Look for external leaks: rear main seal, valve cover, oil pan, front seal',
      'Check coolant in radiator — level, color, any oil contamination (milky = head gasket concern)',
      'Inspect all hoses and belts visually',
      'Look for obvious damage: cracks, broken mounts, damaged wiring',
      'Note anything unusual before attempting to start',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Do this BEFORE any start attempt. What you find here determines next steps.',
  },

  'compression-test': {
    id: 'compression-test',
    name: 'Compression test — AMC 258',
    phaseId: 'phase-1',
    systemId: 'engine',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['assess-engine'],
    steps: [
      'Disable ignition (pull coil wire)',
      'Remove all 6 spark plugs',
      'Thread compression gauge into cylinder 1',
      'Crank engine 4–5 times, record reading',
      'Repeat for all 6 cylinders',
      'Expected: 150–170 PSI per cylinder. Variation >15% between cylinders = concern.',
      'Low across all = rings. Low on adjacent cylinders = head gasket. Low on one = valve issue.',
    ],
    parts: [
      { name: 'Compression gauge (tool)', status: 'needed', estimatedCostILS: 80, notes: 'Borrow or buy — keep it' },
    ],
    estimatedCostILS: 80,
    notes: 'Results determine whether engine needs full rebuild or just tuning. This is the decision gate for Phase 4 depth.',
  },

  'inspect-primary-frame': {
    id: 'inspect-primary-frame',
    name: 'Inspect primary frame — rust assessment',
    phaseId: 'phase-1',
    systemId: 'frame',
    priority: 'critical',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Clean frame rails with wire brush to reveal actual metal condition',
      'Probe suspected areas with screwdriver — soft = structural rust',
      'Check body mount cups (all 8) — top and bottom surface',
      'Inspect rear frame extension welds (CJ8-specific)',
      'Check front crossmember at spring perch welds',
      'Check frame rails at all spring hangers',
      'Measure rail wall thickness with ultrasonic thickness gauge if available',
      'Document every area of concern with photos',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Be ruthless. Do not underestimate rust. This decision determines whether to use this frame or the spare.',
  },

  'inspect-spare-frame': {
    id: 'inspect-spare-frame',
    name: 'Inspect spare CJ8 frame — rust assessment',
    phaseId: 'phase-1',
    systemId: 'frame',
    priority: 'critical',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Same inspection as primary frame — wire brush, probe, document',
      'Inventory what is attached: brake lines, fuel lines, any brackets',
      'Assess brake and fuel lines — reusable or replace?',
      'Check rear extension welds and body mount cups',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Run parallel to primary frame inspection. Both results compared in choose-frame task.',
  },

  'choose-frame': {
    id: 'choose-frame',
    name: 'Choose primary build frame',
    phaseId: 'phase-1',
    systemId: 'frame',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['inspect-primary-frame', 'inspect-spare-frame'],
    steps: [
      'Compare inspection results side by side',
      'Identify which frame has less structural rust at critical points (body mounts, spring perches, rear extension)',
      'Make the call — document in decisions.ts',
      'The rejected frame becomes a parts donor (hardware, brackets, lines)',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Bring photos to a Claude Code session to help evaluate if unsure. This is the most important decision of the project.',
  },

  'inspect-tub': {
    id: 'inspect-tub',
    name: 'Inspect tub — floor and body panels',
    phaseId: 'phase-1',
    systemId: 'body',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Remove any mats or coverings from floor',
      'Inspect floor from inside and underneath — probe soft spots',
      'Check lower sides (rocker area) for rust-through',
      'Inspect firewall — especially lower corners',
      'Check body mount plates from inside — these are load-bearing',
      'Document all rust-through areas — these are welding jobs',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Any rust-through in floor or body mounts requires welding — mark for shop.',
  },

  'inspect-bed': {
    id: 'inspect-bed',
    name: 'Inspect pickup bed — floor and sides',
    phaseId: 'phase-1',
    systemId: 'bed',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Remove any debris from bed',
      'Inspect floor from above and underneath',
      'Probe all soft areas',
      'Check bed walls, corners, and tailgate',
      'Assess whether patch panels or full floor replacement is needed',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Bed rust is confirmed — this task determines the scope of the repair.',
  },

  'inspect-front-axle': {
    id: 'inspect-front-axle',
    name: 'Inspect Dana 30 front axle',
    phaseId: 'phase-1',
    systemId: 'frontAxle',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Check diff fluid level and condition',
      'Rotate axle shaft and check for U-joint roughness or play',
      'Check outer stub axle for play (grab and rock)',
      'Inspect pinion seal for leaks',
      'Check housing for cracks or damage',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Car is on stands — good access.',
  },

  'inspect-rear-axle': {
    id: 'inspect-rear-axle',
    name: 'Inspect Dana 44 rear axle',
    phaseId: 'phase-1',
    systemId: 'rearAxle',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Check diff fluid level and condition',
      'Rotate axle shaft and check for U-joint roughness or play',
      'Check axle shaft end play (grab and pull in/out)',
      'Inspect pinion seal and axle seals for leaks',
      'Look for any housing damage',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Confirm this is a Dana 44 (look for axle tube diameter and casting number).',
  },

  'confirm-gear-ratio': {
    id: 'confirm-gear-ratio',
    name: 'Confirm front/rear gear ratio match',
    phaseId: 'phase-1',
    systemId: 'rearAxle',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['inspect-front-axle', 'inspect-rear-axle'],
    steps: [
      'Mark rear driveshaft and axle yoke',
      'Rotate rear wheel one full turn, count driveshaft rotations — that is the ratio',
      'Repeat for front axle',
      'Ratios must match within 0.1 for 4WD to work properly',
      'If mismatch: bring to Claude Code session to plan resolution',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Critical — mismatched ratios damage the transfer case in 4WD. The previous owner who swapped in the Dana 44 may or may not have matched ratios.',
  },

  'inspect-transfer-case': {
    id: 'inspect-transfer-case',
    name: 'Inspect Dana 300 transfer case',
    phaseId: 'phase-1',
    systemId: 'transferCase',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Check fluid level and condition',
      'Attempt to shift through all positions (may be stiff — do not force)',
      'Listen for noise in neutral',
      'Check output seals for leaks',
      'Note which positions are accessible and which are stuck',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Noise and hard shifting already known. This confirms the extent and guides rebuild scope.',
  },

  'inspect-transmission': {
    id: 'inspect-transmission',
    name: 'Inspect T4 transmission',
    phaseId: 'phase-1',
    systemId: 'transmission',
    priority: 'medium',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Check fluid level and condition',
      'Shift through all 4 gears — note any stiffness or skipping',
      'Check for leaks at input shaft seal, output shaft seal, shift tower',
      'Check transmission mounts (new mounts are on hand)',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'New clutch and mounts on hand. Transmission internals may be fine — inspect before assuming rebuild needed.',
  },

  'inspect-brake-lines': {
    id: 'inspect-brake-lines',
    name: 'Inspect brake lines and hoses',
    phaseId: 'phase-1',
    systemId: 'brakes',
    priority: 'critical',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Trace every brake line from master cylinder to each wheel',
      'Look for rust, kinks, soft spots, or weeping',
      'Check flexible hoses at each axle — squeeze and look for cracking',
      'Inspect master cylinder for external leaks',
      'Note: all rubber hoses are 30+ years old and should be replaced regardless',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Assume all rubber components need replacement. Steel lines: assess individually.',
  },

  'inspect-wiring-harness': {
    id: 'inspect-wiring-harness',
    name: 'Inspect wiring harness and grounds',
    phaseId: 'phase-1',
    systemId: 'electrical',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Trace main harness — look for brittle insulation, melted spots, splices',
      'Photograph all visible bodge repairs',
      'Check battery positive and negative cables — replace if corroded',
      'Locate all ground straps (body-to-frame, engine-to-firewall, battery) and inspect',
      'Do NOT power up yet — assess first',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Document all bodge repairs — each is a task. Assessment only; no power until wiring is cleared.',
  },

  'inspect-tires': {
    id: 'inspect-tires',
    name: 'Inspect tires — age and condition check',
    phaseId: 'phase-1',
    systemId: 'tires',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Find DOT date code on each tire sidewall (last 4 digits = week/year of manufacture)',
      'Inspect sidewalls for cracking, checking, or ozone deterioration',
      'Flex each sidewall — cracking under flex = unsafe',
      'If manufacture date > 6 years ago AND sidewall cracking present = replace',
      'If structurally sound despite age = inspect again after mounting and report back',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Brand new but 8 years in Israeli sun. Most likely: replace. Confirm with DOT date.',
  },

  // ── PHASE 2: FRAME ─────────────────────────────────────────────────────────

  'frame-rust-treatment': {
    id: 'frame-rust-treatment',
    name: 'Frame rust removal and treatment',
    phaseId: 'phase-2',
    systemId: 'frame',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['choose-frame'],
    steps: [
      'Wire brush or sand blast all frame surfaces',
      'Apply rust converter (POR-15 or equivalent) to any rust-pitted areas',
      'Allow to cure fully',
      'Apply chassis paint or epoxy primer to all surfaces',
      'Pay special attention to inside of frame rails (use wand applicator)',
    ],
    parts: [
      { name: 'POR-15 or Rustbullet rust converter', status: 'needed', estimatedCostILS: 300, source: 'import' },
      { name: 'Chassis black paint / epoxy primer', status: 'needed', estimatedCostILS: 200 },
      { name: 'Wire wheels / abrasive discs', status: 'needed', estimatedCostILS: 100 },
    ],
    estimatedCostILS: 600,
    notes: 'This is the most important prep step. A properly treated frame lasts another 30 years. Do not rush.',
  },

  'frame-weld-repairs': {
    id: 'frame-weld-repairs',
    name: 'Frame structural repairs (shop — welding)',
    phaseId: 'phase-2',
    systemId: 'frame',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['choose-frame', 'frame-rust-treatment'],
    steps: [
      'Identify all areas needing weld repair from inspection',
      'Take to trusted welding shop',
      'Repair cracks, re-weld body mount cups if needed, patch any rust-through',
      'Have shop confirm structural integrity before returning',
    ],
    parts: [],
    estimatedCostILS: 800,
    notes: 'Shop job — owner does not weld. Cost estimate is rough — depends on inspection findings.',
  },

  'frame-body-mount-inspection': {
    id: 'frame-body-mount-inspection',
    name: 'Replace body mount hardware',
    phaseId: 'phase-2',
    systemId: 'frame',
    priority: 'high',
    status: 'todo',
    dependsOn: ['frame-rust-treatment'],
    steps: [
      'Replace all 8 body mount rubbers (30+ years old — all cracked)',
      'Replace body mount bolts if corroded',
      'Clean and chase all mount threads',
    ],
    parts: [
      { name: 'Body mount kit (8 mounts)', status: 'needed', estimatedCostILS: 400, source: 'jeepland' },
    ],
    estimatedCostILS: 400,
    notes: 'Old rubber mounts are certain to be deteriorated. Replace as part of frame prep.',
  },

  'strip-spare-frame': {
    id: 'strip-spare-frame',
    name: 'Strip spare frame — salvage usable parts',
    phaseId: 'phase-2',
    systemId: 'frame',
    priority: 'medium',
    status: 'todo',
    dependsOn: ['choose-frame'],
    steps: [
      'Remove all usable hardware: bolts, brackets, lines',
      'Assess brake and fuel lines from spare frame — reuse if in good condition',
      'Catalogue salvaged parts',
      'Set aside unusable frame for disposal',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Only if spare frame is not chosen as primary build frame.',
  },

  // ── PHASE 3: DRIVETRAIN ────────────────────────────────────────────────────

  'rebuild-transfer-case': {
    id: 'rebuild-transfer-case',
    name: 'Rebuild Dana 300 transfer case',
    phaseId: 'phase-3',
    systemId: 'transferCase',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['inspect-transfer-case'],
    steps: [
      'Drop transfer case from vehicle',
      'Disassemble — inspect input shaft bearing, shift forks, chain, seals',
      'Replace: input shaft bearing, all seals, shift fork if worn',
      'Inspect chain — replace if stretched',
      'Reassemble with new gaskets',
      'Fill with fresh 75W-90 gear oil',
    ],
    parts: [
      { name: 'Dana 300 input shaft bearing', status: 'needed', estimatedCostILS: 150, source: 'import' },
      { name: 'Dana 300 output shaft seals (pair)', status: 'needed', estimatedCostILS: 200, source: 'jeepland' },
      { name: 'Gasket set', status: 'needed', estimatedCostILS: 150, source: 'import' },
      { name: '75W-90 GL-4 gear oil (2 pts)', status: 'needed', estimatedCostILS: 60, source: 'local' },
    ],
    estimatedCostILS: 560,
    notes: 'Noise + hard shifting = rebuild required. Do while drivetrain is accessible.',
    guideRef: 'guides/dana-300-rebuild.md',
  },

  'service-front-diff': {
    id: 'service-front-diff',
    name: 'Service Dana 30 front differential',
    phaseId: 'phase-3',
    systemId: 'frontAxle',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-front-axle'],
    steps: [
      'Drain and inspect old fluid — metal particles = bearing wear',
      'Replace pinion seal',
      'Replace axle seals',
      'Refill with fresh 75W-90 GL-5',
    ],
    parts: [
      { name: 'Pinion seal (Dana 30)', status: 'needed', estimatedCostILS: 100, source: 'jeepland' },
      { name: 'Axle seals (pair)', status: 'needed', estimatedCostILS: 120, source: 'jeepland' },
      { name: '75W-90 GL-5 gear oil (2 pts)', status: 'needed', estimatedCostILS: 60, source: 'local' },
    ],
    estimatedCostILS: 280,
    notes: 'Minimal service unless inspection reveals bearing issues.',
  },

  'service-rear-diff': {
    id: 'service-rear-diff',
    name: 'Service Dana 44 rear differential',
    phaseId: 'phase-3',
    systemId: 'rearAxle',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-rear-axle'],
    steps: [
      'Drain and inspect old fluid',
      'Replace pinion seal and axle seals',
      'Refill with fresh 75W-90 GL-5',
    ],
    parts: [
      { name: 'Pinion seal (Dana 44)', status: 'needed', estimatedCostILS: 100, source: 'jeepland' },
      { name: 'Axle seals (pair)', status: 'needed', estimatedCostILS: 120, source: 'jeepland' },
      { name: '75W-90 GL-5 gear oil (2.5 pts)', status: 'needed', estimatedCostILS: 70, source: 'local' },
    ],
    estimatedCostILS: 290,
    notes: '',
  },

  'replace-front-ujoint': {
    id: 'replace-front-ujoint',
    name: 'Replace front axle U-joints',
    phaseId: 'phase-3',
    systemId: 'frontAxle',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-front-axle'],
    steps: [
      'Remove front driveshaft',
      'Press out U-joints',
      'Install new Spicer 1310 U-joints',
      'Grease and reinstall',
    ],
    parts: [
      { name: 'Spicer 5-153X U-joint (1310, 2 needed)', status: 'needed', estimatedCostILS: 250, source: 'jeepland' },
    ],
    estimatedCostILS: 250,
    notes: 'Replace regardless of apparent condition — cheap insurance while accessible.',
  },

  'replace-rear-ujoint': {
    id: 'replace-rear-ujoint',
    name: 'Replace rear driveshaft U-joints',
    phaseId: 'phase-3',
    systemId: 'rearAxle',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-rear-axle'],
    steps: [
      'Remove rear driveshaft',
      'Press out U-joints',
      'Install new Spicer 1310 U-joints',
      'Grease and reinstall',
    ],
    parts: [
      { name: 'Spicer 5-153X U-joint (1310, 2 needed)', status: 'needed', estimatedCostILS: 250, source: 'jeepland' },
    ],
    estimatedCostILS: 250,
    notes: '',
  },

  'replace-trans-mounts': {
    id: 'replace-trans-mounts',
    name: 'Install new transmission and transfer case mounts',
    phaseId: 'phase-3',
    systemId: 'transmission',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Support trans/TC with jack',
      'Remove old mounts',
      'Install new mounts',
    ],
    parts: [
      { name: 'Transmission mount (new — on hand)', status: 'on-hand', estimatedCostILS: 0 },
      { name: 'Transfer case / gear mount (new — on hand)', status: 'on-hand', estimatedCostILS: 0 },
    ],
    estimatedCostILS: 0,
    notes: 'Parts on hand. Straightforward job.',
  },

  'install-clutch': {
    id: 'install-clutch',
    name: 'Install new clutch kit',
    phaseId: 'phase-3',
    systemId: 'transmission',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-transmission'],
    steps: [
      'Remove transmission',
      'Inspect flywheel — resurface if scored',
      'Install new clutch disc and pressure plate',
      'Install new pilot bearing and throw-out bearing',
      'Reinstall transmission',
      'Adjust clutch free play',
    ],
    parts: [
      { name: 'Clutch kit (new — on hand)', status: 'on-hand', estimatedCostILS: 0 },
      { name: 'Flywheel resurfacing (shop)', status: 'needed', estimatedCostILS: 200, notes: 'If scored' },
    ],
    estimatedCostILS: 200,
    notes: 'Clutch kit on hand. Do this while transmission is out for inspection.',
  },

  // ── PHASE 4: ENGINE ────────────────────────────────────────────────────────

  'engine-oil-inspection': {
    id: 'engine-oil-inspection',
    name: 'Engine oil inspection and change',
    phaseId: 'phase-4',
    systemId: 'engine',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['assess-engine'],
    steps: [
      'Drain old oil — inspect for metal particles, water (milky), or fuel contamination',
      'Remove and cut open old oil filter — inspect for metal debris',
      'Install new filter',
      'Fill with fresh 10W-30',
    ],
    parts: [
      { name: 'Engine oil (10W-30, 6 qts)', status: 'needed', estimatedCostILS: 100, source: 'local' },
      { name: 'Oil filter (Wix 51068)', status: 'needed', estimatedCostILS: 40, source: 'local' },
    ],
    estimatedCostILS: 140,
    notes: 'What comes out tells you a lot about engine health. Cut the filter open with a rag and look.',
  },

  'replace-engine-mounts': {
    id: 'replace-engine-mounts',
    name: 'Install new engine mounts',
    phaseId: 'phase-4',
    systemId: 'engine',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Support engine from below with jack and block of wood',
      'Remove old mounts (likely seized bolts — penetrating oil first)',
      'Install new mounts',
      'Torque to spec',
    ],
    parts: [
      { name: 'Engine mounts (new — on hand)', status: 'on-hand', estimatedCostILS: 0 },
    ],
    estimatedCostILS: 0,
    notes: 'Parts on hand. Old mounts are 30+ years old and certainly deteriorated.',
  },

  'carb-rebuild': {
    id: 'carb-rebuild',
    name: 'Rebuild Carter YF carburetor',
    phaseId: 'phase-4',
    systemId: 'fuel',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['engine-oil-inspection'],
    steps: [
      'Remove carb from engine',
      'Disassemble completely — jets, needle/seat, accelerator pump, power valve',
      'Clean all metal parts in carb cleaner',
      'Blow out all passages with compressed air',
      'Install all new rubber parts from rebuild kit',
      'Install new seal and cap (on hand)',
      'Reassemble and set float level',
      'Reinstall and adjust mixture screws and idle speed',
    ],
    parts: [
      { name: 'Carter YF rebuild kit (on hand)', status: 'on-hand', estimatedCostILS: 0 },
      { name: 'New seal and cap for Carter (on hand)', status: 'on-hand', estimatedCostILS: 0 },
      { name: 'Carb cleaner spray', status: 'needed', estimatedCostILS: 40, source: 'local' },
    ],
    estimatedCostILS: 40,
    notes: 'All parts on hand. After 8 years, a full rebuild is mandatory — gummed passages certain.',
    guideRef: 'guides/carter-yf-rebuild.md',
  },

  'tune-up-ignition': {
    id: 'tune-up-ignition',
    name: 'Ignition tune-up',
    phaseId: 'phase-4',
    systemId: 'engine',
    priority: 'high',
    status: 'todo',
    dependsOn: ['engine-oil-inspection'],
    steps: [
      'Replace all 6 spark plugs (Champion RN11YC, gap 0.035")',
      'Replace distributor cap and rotor',
      'Replace plug wires',
      'Set base timing to 8° BTDC with timing light',
      'Check and adjust vacuum advance',
    ],
    parts: [
      { name: 'Spark plugs (Champion RN11YC, set of 6)', status: 'needed', estimatedCostILS: 90, source: 'local' },
      { name: 'Distributor cap + rotor', status: 'needed', estimatedCostILS: 120, source: 'jeepland' },
      { name: 'Plug wire set', status: 'needed', estimatedCostILS: 180, source: 'jeepland' },
      { name: 'Timing light (tool)', status: 'needed', estimatedCostILS: 120, notes: 'Borrow or buy' },
    ],
    estimatedCostILS: 390,
    notes: 'All original ignition components are 30+ years old. Replace everything.',
  },

  'replace-exhaust-manifold': {
    id: 'replace-exhaust-manifold',
    name: 'Inspect / replace exhaust manifold',
    phaseId: 'phase-4',
    systemId: 'engine',
    priority: 'high',
    status: 'todo',
    dependsOn: ['assess-engine'],
    steps: [
      'Inspect manifold carefully for cracks — ports, collector, flanges',
      'If cracked: order replacement (do NOT attempt to weld cast iron)',
      'Remove old manifold (seized bolts likely — heat and penetrating oil)',
      'Install new manifold with new gaskets',
      'Torque to 23 ft-lb in sequence',
    ],
    parts: [
      { name: 'Exhaust manifold (replacement)', status: 'needed', estimatedCostILS: 650, source: 'import', notes: 'Only if cracked — inspect first' },
      { name: 'Exhaust manifold gasket set', status: 'needed', estimatedCostILS: 120, source: 'import' },
      { name: 'Manifold studs/bolts', status: 'needed', estimatedCostILS: 80, source: 'local' },
    ],
    estimatedCostILS: 850,
    notes: 'AMC 258 exhaust manifold cracks are nearly universal. Inspect first — if cracked, must replace.',
  },

  'engine-deep-rebuild': {
    id: 'engine-deep-rebuild',
    name: 'Engine internal rebuild (conditional)',
    phaseId: 'phase-4',
    systemId: 'engine',
    priority: 'high',
    status: 'blocked',
    dependsOn: ['compression-test'],
    steps: [
      'Pull engine from vehicle',
      'Send block to machine shop for boring/honing',
      'Replace: pistons, rings, bearings (mains + rods), gaskets',
      'Inspect and recondition head',
      'Rebuild and reinstall',
    ],
    parts: [
      { name: 'Engine rebuild kit (pistons, rings, bearings, gaskets)', status: 'needed', estimatedCostILS: 2500, source: 'import' },
      { name: 'Machine shop work', status: 'needed', estimatedCostILS: 1500 },
    ],
    estimatedCostILS: 4000,
    notes: 'CONDITIONAL: only if compression test shows low/uneven compression. If compression is good, skip this and do tune-up only. This is the most expensive task on the plan.',
  },

  // ── PHASE 5: BRAKES ────────────────────────────────────────────────────────

  'replace-brake-lines': {
    id: 'replace-brake-lines',
    name: 'Replace brake lines',
    phaseId: 'phase-5',
    systemId: 'brakes',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['inspect-brake-lines'],
    steps: [
      'Remove all old brake lines',
      'Install pre-bent replacement steel line kit',
      'Or: fabricate lines with brake line tube and flare tool',
      'Connect all fittings — do not over-tighten',
    ],
    parts: [
      { name: 'Pre-bent brake line kit (CJ)', status: 'needed', estimatedCostILS: 550, source: 'import' },
    ],
    estimatedCostILS: 550,
    notes: 'Lines from the spare frame may be reusable — compare condition. If spare frame lines are clean, use them.',
  },

  'replace-wheel-cylinders': {
    id: 'replace-wheel-cylinders',
    name: 'Replace all wheel cylinders',
    phaseId: 'phase-5',
    systemId: 'brakes',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['inspect-brake-lines'],
    steps: [
      'Remove all 4 drums',
      'Replace all 4 wheel cylinders',
      'Inspect drums for scoring and measure — replace if beyond spec',
      'Install new brake shoes front and rear',
      'Reinstall drums',
    ],
    parts: [
      { name: 'Wheel cylinders (set of 4)', status: 'needed', estimatedCostILS: 500, source: 'jeepland' },
      { name: 'Brake shoe sets (front + rear)', status: 'needed', estimatedCostILS: 350, source: 'jeepland' },
      { name: 'Brake hardware kits', status: 'needed', estimatedCostILS: 150, source: 'jeepland' },
    ],
    estimatedCostILS: 1000,
    notes: 'After 8 years sitting, all wheel cylinders are seized or corroded. Replace all four.',
  },

  'replace-brake-drums-shoes': {
    id: 'replace-brake-drums-shoes',
    name: 'Inspect and replace brake drums',
    phaseId: 'phase-5',
    systemId: 'brakes',
    priority: 'high',
    status: 'todo',
    dependsOn: ['replace-wheel-cylinders'],
    steps: [
      'Measure drum inside diameter with brake drum micrometer',
      'Replace any drum beyond maximum diameter stamped on drum',
      'Clean drum contact surface',
    ],
    parts: [
      { name: 'Brake drums (if needed, set of 4)', status: 'needed', estimatedCostILS: 800, source: 'jeepland', notes: 'Only if beyond spec' },
    ],
    estimatedCostILS: 800,
    notes: 'May not need replacement — measure first.',
  },

  'install-brake-booster': {
    id: 'install-brake-booster',
    name: 'Install new brake booster',
    phaseId: 'phase-5',
    systemId: 'brakes',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['replace-brake-lines'],
    steps: [
      'Remove old brake booster and master cylinder as assembly',
      'Install new brake booster',
      'Bench bleed new master cylinder',
      'Install master cylinder on booster',
      'Connect vacuum line to intake manifold',
    ],
    parts: [
      { name: 'Brake booster (new — on hand)', status: 'on-hand', estimatedCostILS: 0 },
      { name: 'Master cylinder', status: 'needed', estimatedCostILS: 350, source: 'jeepland' },
    ],
    estimatedCostILS: 350,
    notes: 'Brake booster on hand. Need new master cylinder.',
  },

  'install-proportioning-valve': {
    id: 'install-proportioning-valve',
    name: 'Install new proportioning valve',
    phaseId: 'phase-5',
    systemId: 'brakes',
    priority: 'high',
    status: 'todo',
    dependsOn: ['replace-brake-lines'],
    steps: [
      'Remove old proportioning valve',
      'Install new valve in correct orientation',
      'Connect all brake lines',
    ],
    parts: [
      { name: 'Proportioning valve (new — on hand)', status: 'on-hand', estimatedCostILS: 0 },
    ],
    estimatedCostILS: 0,
    notes: 'On hand. Straightforward installation.',
  },

  'bleed-brakes': {
    id: 'bleed-brakes',
    name: 'Bleed complete brake system',
    phaseId: 'phase-5',
    systemId: 'brakes',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['install-brake-booster', 'install-proportioning-valve', 'replace-wheel-cylinders', 'replace-brake-lines'],
    steps: [
      'Fill master cylinder with fresh DOT 4',
      'Bleed: right rear → left rear → right front → left front (furthest to closest)',
      'Use vacuum bleeder or two-person method',
      'Check for firm pedal — no sponginess',
      'Test brake booster: press pedal with engine off, start engine — pedal should drop slightly',
    ],
    parts: [
      { name: 'Brake fluid DOT 4 (1L)', status: 'needed', estimatedCostILS: 50, source: 'local' },
    ],
    estimatedCostILS: 50,
    notes: 'Last brake task. Do not move the car until pedal is firm.',
  },

  // ── PHASE 6: SUSPENSION & STEERING ────────────────────────────────────────

  'inspect-spring-mounts': {
    id: 'inspect-spring-mounts',
    name: 'Inspect spring mounts and shackles before lift install',
    phaseId: 'phase-6',
    systemId: 'suspension',
    priority: 'high',
    status: 'todo',
    dependsOn: ['choose-frame'],
    steps: [
      'Inspect front and rear spring hangers for cracks or rust',
      'Check spring shackles for wear or damage',
      'Replace any compromised hardware before installing new kit',
    ],
    parts: [
      { name: 'Spring shackles (if needed)', status: 'needed', estimatedCostILS: 200, source: 'jeepland' },
    ],
    estimatedCostILS: 200,
    notes: 'Installing new springs on compromised mounts defeats the purpose.',
  },

  'install-lift-kit': {
    id: 'install-lift-kit',
    name: 'Install Rubicon Express 2.5" lift kit',
    phaseId: 'phase-6',
    systemId: 'suspension',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-spring-mounts'],
    steps: [
      'Support vehicle — remove weight from axles',
      'Remove old leaf springs and shocks (all 4 corners)',
      'Install new Rubicon Express leaf springs front and rear',
      'Install new U-bolts',
      'Install new Rubicon Express shocks',
      'Check driveshaft angles at new ride height',
      'Check brake line length — may need extensions at new height',
    ],
    parts: [
      { name: 'Rubicon Express 2.5" lift kit — leafs + shocks (on hand)', status: 'on-hand', estimatedCostILS: 0 },
      { name: 'New U-bolts (check kit — may be included)', status: 'needed', estimatedCostILS: 150 },
    ],
    estimatedCostILS: 150,
    notes: 'Kit is on hand. At 2.5" no SYE needed, but check brake line length after install.',
  },

  'replace-drag-link': {
    id: 'replace-drag-link',
    name: 'Replace drag link',
    phaseId: 'phase-6',
    systemId: 'steering',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Remove old drag link',
      'Install new drag link',
      'Check toe — adjust at tie rod if needed',
    ],
    parts: [
      { name: 'Drag link (CJ8)', status: 'needed', estimatedCostILS: 400, source: 'jeepland' },
    ],
    estimatedCostILS: 400,
    notes: 'Known bad. Priority steering task.',
  },

  'install-steering-damper': {
    id: 'install-steering-damper',
    name: 'Install new steering damper',
    phaseId: 'phase-6',
    systemId: 'steering',
    priority: 'medium',
    status: 'todo',
    dependsOn: ['replace-drag-link'],
    steps: [
      'Remove old damper',
      'Install new damper in correct orientation',
      'Check for full steering lock-to-lock clearance',
    ],
    parts: [
      { name: 'Steering damper (new — on hand)', status: 'on-hand', estimatedCostILS: 0 },
    ],
    estimatedCostILS: 0,
    notes: 'On hand. Straightforward after drag link is installed.',
  },

  'inspect-steering-box': {
    id: 'inspect-steering-box',
    name: 'Inspect steering box and tie rod ends',
    phaseId: 'phase-6',
    systemId: 'steering',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Check steering wheel free play — more than 2" = box worn',
      'Check tie rod ends for play',
      'Inspect steering shaft U-joint',
      'Adjust steering box if play is borderline (there is an adjustment screw)',
    ],
    parts: [
      { name: 'Tie rod ends (if worn)', status: 'needed', estimatedCostILS: 350, source: 'jeepland' },
    ],
    estimatedCostILS: 350,
    notes: 'Box replacement or rebuild is a significant cost — adjust first if possible.',
  },

  'replace-tie-rod-ends': {
    id: 'replace-tie-rod-ends',
    name: 'Replace tie rod ends (if worn)',
    phaseId: 'phase-6',
    systemId: 'steering',
    priority: 'medium',
    status: 'todo',
    dependsOn: ['inspect-steering-box'],
    steps: [
      'Count turns to remove old ends (for reinstall reference)',
      'Install new ends same number of turns',
      'Set toe: 1/8" toe-in — verify with string or alignment shop',
    ],
    parts: [
      { name: 'Tie rod ends (pair)', status: 'needed', estimatedCostILS: 300, source: 'jeepland' },
    ],
    estimatedCostILS: 300,
    notes: 'After tie rod end replacement, get a proper toe alignment.',
  },

  // ── PHASE 7: FUEL SYSTEM ───────────────────────────────────────────────────

  'inspect-fuel-tank': {
    id: 'inspect-fuel-tank',
    name: 'Inspect and clean fuel tank',
    phaseId: 'phase-7',
    systemId: 'fuel',
    priority: 'critical',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Remove tank',
      'Drain any remaining fuel (8-year-old fuel — dispose properly)',
      'Inspect interior with light for rust and sediment',
      'If surface rust only: clean with tank sealer (POR-15 tank kit or similar)',
      'If heavily rusted or holed: replace tank',
    ],
    parts: [
      { name: 'Tank sealer kit (if needed)', status: 'needed', estimatedCostILS: 250, source: 'import' },
      { name: 'Replacement fuel tank (if needed)', status: 'needed', estimatedCostILS: 1200, source: 'import' },
    ],
    estimatedCostILS: 250,
    notes: 'Condition unknown — must inspect. Best case: clean and seal. Worst case: replace.',
  },

  'clean-fuel-tank': {
    id: 'clean-fuel-tank',
    name: 'Clean and seal fuel tank',
    phaseId: 'phase-7',
    systemId: 'fuel',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-fuel-tank'],
    steps: [
      'Rinse tank with fuel system cleaner',
      'Shake with gravel to loosen rust',
      'Rinse thoroughly',
      'Apply POR-15 tank sealer or equivalent',
      'Allow full cure before reinstalling',
    ],
    parts: [
      { name: 'POR-15 fuel tank sealer kit', status: 'needed', estimatedCostILS: 250 },
    ],
    estimatedCostILS: 250,
    notes: 'Only if inspection shows rust but not holes.',
  },

  'replace-fuel-lines': {
    id: 'replace-fuel-lines',
    name: 'Replace all fuel lines',
    phaseId: 'phase-7',
    systemId: 'fuel',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['inspect-fuel-tank'],
    steps: [
      'Remove all rubber fuel lines (tank to carb, return line)',
      'Install new ethanol-resistant fuel line throughout',
      'Replace fuel filter',
      'Check all fittings for leaks',
    ],
    parts: [
      { name: 'Fuel line (ethanol-resistant, per meter)', status: 'needed', estimatedCostILS: 80, source: 'local', notes: '~3m needed' },
      { name: 'Fuel filter', status: 'needed', estimatedCostILS: 50, source: 'local' },
      { name: 'Fuel line clamps', status: 'needed', estimatedCostILS: 40, source: 'local' },
    ],
    estimatedCostILS: 360,
    notes: 'All rubber fuel lines are 30+ years old and ethanol has attacked the rubber. Replace entirely.',
  },

  'install-electric-fan': {
    id: 'install-electric-fan',
    name: 'Install electric cooling fan',
    phaseId: 'phase-7',
    systemId: 'cooling',
    priority: 'medium',
    status: 'todo',
    dependsOn: ['pressure-test-radiator'],
    steps: [
      'Mount fan to radiator',
      'Wire to switched power with inline fuse',
      'Install thermostat switch in radiator (if using automatic control)',
      'Test operation',
    ],
    parts: [
      { name: 'Electric fan (on hand — came with radiator)', status: 'on-hand', estimatedCostILS: 0 },
      { name: 'Wiring, fuse, relay kit', status: 'needed', estimatedCostILS: 80, source: 'local' },
      { name: 'Thermostat switch (for auto on/off)', status: 'needed', estimatedCostILS: 60, source: 'local' },
    ],
    estimatedCostILS: 140,
    notes: 'Fan has been waiting since the radiator was upgraded. Good addition for Israeli summers.',
  },

  // ── PHASE 8: COOLING ───────────────────────────────────────────────────────

  'pressure-test-radiator': {
    id: 'pressure-test-radiator',
    name: 'Pressure test radiator and cooling system',
    phaseId: 'phase-8',
    systemId: 'cooling',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['replace-cooling-hoses'],
    steps: [
      'Install radiator pressure tester',
      'Pump to 15 PSI',
      'Hold for 10 minutes — any drop = leak',
      'Inspect radiator repair area carefully',
      'If leak: repair or replace radiator before any startup attempt',
    ],
    parts: [
      { name: 'Radiator pressure tester (tool — borrow)', status: 'needed', estimatedCostILS: 0 },
    ],
    estimatedCostILS: 0,
    notes: 'Prior crack + repair is a risk. Pressure test BEFORE attempting any start.',
  },

  'replace-cooling-hoses': {
    id: 'replace-cooling-hoses',
    name: 'Replace all cooling hoses',
    phaseId: 'phase-8',
    systemId: 'cooling',
    priority: 'critical',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Replace upper radiator hose',
      'Replace lower radiator hose',
      'Replace all heater hoses',
      'Replace bypass hose',
      'Refill with fresh 50/50 coolant',
    ],
    parts: [
      { name: 'Upper radiator hose', status: 'needed', estimatedCostILS: 80, source: 'local' },
      { name: 'Lower radiator hose', status: 'needed', estimatedCostILS: 80, source: 'local' },
      { name: 'Heater hose set', status: 'needed', estimatedCostILS: 120, source: 'local' },
      { name: 'Hose clamps (set)', status: 'needed', estimatedCostILS: 60, source: 'local' },
      { name: 'Coolant (50/50 mix, 10L)', status: 'needed', estimatedCostILS: 100, source: 'local' },
    ],
    estimatedCostILS: 440,
    notes: 'All hoses are 30+ years old. Replace entirely before any startup attempt.',
  },

  'replace-thermostat': {
    id: 'replace-thermostat',
    name: 'Replace thermostat',
    phaseId: 'phase-8',
    systemId: 'cooling',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Drain coolant below thermostat level',
      'Remove housing, extract old thermostat',
      'Install new 195°F thermostat with new gasket',
      'Torque housing bolts',
    ],
    parts: [
      { name: 'Thermostat 195°F (Stant 14583)', status: 'needed', estimatedCostILS: 70, source: 'local' },
      { name: 'Thermostat housing gasket', status: 'needed', estimatedCostILS: 30, source: 'local' },
    ],
    estimatedCostILS: 100,
    notes: '$10 part, easy job, must be done.',
  },

  'replace-water-pump': {
    id: 'replace-water-pump',
    name: 'Replace water pump',
    phaseId: 'phase-8',
    systemId: 'cooling',
    priority: 'high',
    status: 'todo',
    dependsOn: [],
    steps: [
      'Drain coolant',
      'Remove fan, fan belt, and pulley',
      'Remove old pump',
      'Install new pump with new gasket',
      'Reinstall pulley and belt',
    ],
    parts: [
      { name: 'Water pump (Airtex AW6207)', status: 'needed', estimatedCostILS: 400, source: 'local-or-jeepland' },
      { name: 'Water pump gasket', status: 'needed', estimatedCostILS: 40, source: 'local' },
      { name: 'Fan belt', status: 'needed', estimatedCostILS: 60, source: 'local' },
    ],
    estimatedCostILS: 500,
    notes: 'After 8 years sitting, impeller may have corroded off shaft. Replace as standard practice.',
  },

  // ── PHASE 9: ELECTRICAL ────────────────────────────────────────────────────

  'check-ground-straps': {
    id: 'check-ground-straps',
    name: 'Inspect and replace ground straps',
    phaseId: 'phase-9',
    systemId: 'electrical',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['inspect-wiring-harness'],
    steps: [
      'Locate all ground straps: battery(-) to chassis, engine to firewall, body to frame',
      'Inspect all attach points for corrosion — clean with wire brush',
      'Replace any strap that is corroded, frayed, or broken',
      'Ensure all attach surfaces are bare metal (remove paint at attachment)',
    ],
    parts: [
      { name: 'Ground strap set (braided cable)', status: 'needed', estimatedCostILS: 120, source: 'local' },
    ],
    estimatedCostILS: 120,
    notes: 'Bad grounds cause 80% of mysterious electrical problems. Do this first before chasing anything.',
  },

  'test-all-circuits': {
    id: 'test-all-circuits',
    name: 'Test all electrical circuits',
    phaseId: 'phase-9',
    systemId: 'electrical',
    priority: 'high',
    status: 'todo',
    dependsOn: ['check-ground-straps'],
    steps: [
      'Install charged battery',
      'Test: lights (head, tail, brake, turn)',
      'Test: horn, wipers, gauges',
      'Test: ignition circuit, starter',
      'Note any non-functioning circuits — each is a task',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Systematic circuit-by-circuit test. Document what works and what doesn\'t.',
  },

  'repair-wiring-harness': {
    id: 'repair-wiring-harness',
    name: 'Repair bodge wiring and brittle harness sections',
    phaseId: 'phase-9',
    systemId: 'electrical',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-wiring-harness', 'test-all-circuits'],
    steps: [
      'Address each bodge repair found in inspection',
      'Replace any section with brittle or cracked insulation',
      'Use proper connectors — no bare twisted splices',
      'Wrap repaired sections with self-amalgamating tape or loom',
    ],
    parts: [
      { name: 'Wiring connectors assortment', status: 'needed', estimatedCostILS: 100, source: 'local' },
      { name: 'Wire (assorted gauges)', status: 'needed', estimatedCostILS: 80, source: 'local' },
      { name: 'Heat shrink / loom / tape', status: 'needed', estimatedCostILS: 60, source: 'local' },
    ],
    estimatedCostILS: 240,
    notes: 'Repair known issues. If extensive, consider a full harness replacement (Painless Performance — major cost).',
  },

  'test-charging-system': {
    id: 'test-charging-system',
    name: 'Test alternator and charging system',
    phaseId: 'phase-9',
    systemId: 'electrical',
    priority: 'high',
    status: 'todo',
    dependsOn: ['check-ground-straps'],
    steps: [
      'With engine running: measure voltage at battery terminals',
      'Should be 13.8–14.5V — anything less = alternator or voltage regulator issue',
      'Check alternator output at the B+ terminal',
      'Replace alternator if not charging correctly',
    ],
    parts: [
      { name: 'Alternator (rebuilt, if needed)', status: 'needed', estimatedCostILS: 550, source: 'jeepland' },
    ],
    estimatedCostILS: 0,
    notes: 'Test before buying anything — may be fine.',
  },

  // ── PHASE 10: BODY & ASSEMBLY ──────────────────────────────────────────────

  'tub-rust-treatment': {
    id: 'tub-rust-treatment',
    name: 'Tub rust treatment and repair',
    phaseId: 'phase-10',
    systemId: 'body',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-tub'],
    steps: [
      'Any rust-through: weld repair (shop job)',
      'Surface rust: wire brush, rust converter, primer',
      'Paint floor and lower panels with rubberized undercoat',
      'Paint visible panels with chassis black or body color',
    ],
    parts: [
      { name: 'Rust converter', status: 'needed', estimatedCostILS: 150 },
      { name: 'Rubberized undercoat', status: 'needed', estimatedCostILS: 200 },
      { name: 'Primer + paint', status: 'needed', estimatedCostILS: 300 },
    ],
    estimatedCostILS: 650,
    notes: 'Scope unknown until inspection. Weld repairs are shop work.',
  },

  'bed-rust-repair': {
    id: 'bed-rust-repair',
    name: 'Pickup bed rust repair',
    phaseId: 'phase-10',
    systemId: 'bed',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-bed'],
    steps: [
      'Identify all rust-through areas — welding shop job',
      'Wire brush all remaining rust',
      'Apply rust converter to pitted areas',
      'Spray with bed liner or rubberized coating',
    ],
    parts: [
      { name: 'Bed liner / rubberized coating', status: 'needed', estimatedCostILS: 250 },
      { name: 'Patch panels (if needed)', status: 'needed', estimatedCostILS: 400 },
    ],
    estimatedCostILS: 650,
    notes: 'CJ8 bed floors are hard to find as replacement panels — repair in place is the usual approach.',
  },

  'install-body-mounts': {
    id: 'install-body-mounts',
    name: 'Mount tub to frame',
    phaseId: 'phase-10',
    systemId: 'body',
    priority: 'high',
    status: 'todo',
    dependsOn: ['frame-rust-treatment', 'tub-rust-treatment', 'frame-body-mount-inspection'],
    steps: [
      'Install new body mount rubbers on frame',
      'Lower tub onto frame — align all mount holes',
      'Install body mount bolts — torque to spec',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Body mount kit covered in frame-body-mount-inspection task.',
  },

  'mount-tires': {
    id: 'mount-tires',
    name: 'Mount tires and install wheels',
    phaseId: 'phase-10',
    systemId: 'tires',
    priority: 'high',
    status: 'todo',
    dependsOn: ['inspect-tires', 'install-lift-kit'],
    steps: [
      'Mount tires on wheels (tire shop)',
      'Install on vehicle — torque lug nuts to spec (90 ft-lb)',
      'Check tire pressure (32 PSI start — adjust to preference)',
    ],
    parts: [
      { name: 'New tires (if inspection fails — 4 needed)', status: 'needed', estimatedCostILS: 2000, notes: 'Only if 8-year-old tires are unsafe' },
      { name: 'Tire mounting (shop)', status: 'needed', estimatedCostILS: 150 },
    ],
    estimatedCostILS: 150,
    notes: 'If 8-year-old tires pass inspection: ₪150 for mounting. If they fail: ₪2,000+ for replacements.',
  },

  'final-assembly': {
    id: 'final-assembly',
    name: 'Final assembly and pre-start checklist',
    phaseId: 'phase-10',
    systemId: 'body',
    priority: 'high',
    status: 'todo',
    dependsOn: ['install-body-mounts', 'mount-tires'],
    steps: [
      'Reconnect all electrical connectors',
      'Reconnect fuel and brake lines',
      'Reconnect driveshafts',
      'Install hood, doors, and any body panels removed',
      'Verify all fluid levels before startup',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Checklist before first start — all fluids in, all lines connected, all grounds clean.',
  },

  // ── PHASE 11: COMMISSIONING ────────────────────────────────────────────────

  'pre-start-checklist': {
    id: 'pre-start-checklist',
    name: 'Pre-start safety checklist',
    phaseId: 'phase-11',
    systemId: 'engine',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['final-assembly', 'bleed-brakes', 'pressure-test-radiator', 'carb-rebuild'],
    steps: [
      'Oil level — full',
      'Coolant level — full',
      'All fuel lines connected, no smell of fuel',
      'All brake lines connected',
      'Battery connected, grounds clean',
      'No visible leaks from any system',
      'Fire extinguisher nearby',
      'Have someone present for first start',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Do not skip this. Check everything before cranking.',
  },

  'first-start': {
    id: 'first-start',
    name: 'First start — 8 years',
    phaseId: 'phase-11',
    systemId: 'engine',
    priority: 'critical',
    status: 'todo',
    dependsOn: ['pre-start-checklist'],
    steps: [
      'Crank without spark (pull coil wire) to build oil pressure — 5 seconds',
      'Restore ignition — start engine',
      'Immediately check: oil pressure gauge, any leaks, exhaust color',
      'Let idle — watch temperature gauge closely',
      'If temp rises quickly — shut down, investigate',
      'Target: warm up to operating temp, check for stable idle',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'The moment 8 years of work pays off. Have a camera ready.',
  },

  'break-in-drive': {
    id: 'break-in-drive',
    name: 'Initial drive and systems test',
    phaseId: 'phase-11',
    systemId: 'engine',
    priority: 'high',
    status: 'todo',
    dependsOn: ['first-start'],
    steps: [
      'Short initial drive — 5km, varied speed, no highway',
      'Test brakes: controlled stop from 30 km/h',
      'Test steering: figure-8 in parking lot',
      'Test all 4WD positions: 2H → 4H → 4L → back',
      'Return and inspect everything: leaks, noises, temperatures',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'Stay close to home for first drive.',
  },

  'post-drive-inspection': {
    id: 'post-drive-inspection',
    name: 'Post first-drive inspection',
    phaseId: 'phase-11',
    systemId: 'engine',
    priority: 'high',
    status: 'todo',
    dependsOn: ['break-in-drive'],
    steps: [
      'Check all fluid levels — oil, coolant, trans, diff (F+R), TC',
      'Look under the car for any new leaks',
      'Listen for any noises that were not present before drive',
      'Check brake pad/shoe clearance (if drums feel hot)',
      'Bring findings to Claude Code session — update plan',
    ],
    parts: [],
    estimatedCostILS: 0,
    notes: 'The first drive always reveals something. Document it all.',
  },

};
