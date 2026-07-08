import type { DiscoveryEntry } from '../types/knowledge';

// Append-only. Never delete entries. Add date, system, description, severity.

export const discoveries: DiscoveryEntry[] = [

  {
    id: 'disc-001',
    date: '2026-03-15',
    system: 'engine',
    description: 'Engine had rough idle and smoke when last driven ~8 years ago. Smoke color not remembered. Could indicate carburetor running rich (black smoke), burning oil (blue), or head gasket (white). Needs compression test and oil inspection before any start attempt.',
    severity: 'concern',
    processedAt: '2026-03-15',
    resultedIn: {
      carUpdate: true,
      newTaskIds: ['assess-engine', 'compression-test'],
    },
  },

  {
    id: 'disc-002',
    date: '2026-03-15',
    system: 'transferCase',
    description: 'Dana 300 had noise and difficulty shifting between ranges (2H/4H/4L) when last used. Classic symptoms of input shaft bearing wear and/or shift fork wear. Rebuild likely required.',
    severity: 'concern',
    processedAt: '2026-03-15',
    resultedIn: {
      carUpdate: true,
      newTaskIds: ['inspect-transfer-case', 'rebuild-transfer-case'],
    },
  },

  {
    id: 'disc-003',
    date: '2026-03-15',
    system: 'brakes',
    description: 'Soft pedal or leaks noted when car was last driven. After 8 years sitting, wheel cylinders are likely seized or leaking, brake fluid is contaminated, and internal brake line corrosion is possible. Full system rebuild required — not negotiable.',
    severity: 'critical',
    processedAt: '2026-03-15',
    resultedIn: {
      carUpdate: true,
      newTaskIds: ['inspect-brake-lines', 'replace-wheel-cylinders', 'install-brake-booster', 'install-proportioning-valve', 'bleed-brakes'],
    },
  },

  {
    id: 'disc-004',
    date: '2026-03-15',
    system: 'frame',
    description: 'Primary frame has concerning rust — extent not fully assessed. CJ8 frames rust most at body mount cups, rear extension welds, and spring perch welds. A second matching 1989 CJ8 frame is available (detached, with brake and fuel lines intact). Both must be fully inspected before committing to either.',
    severity: 'critical',
    processedAt: '2026-03-15',
    resultedIn: {
      carUpdate: true,
      newTaskIds: ['inspect-primary-frame', 'inspect-spare-frame', 'choose-frame'],
      decisionId: 'dec-004',
    },
  },

  {
    id: 'disc-005',
    date: '2026-03-15',
    system: 'cooling',
    description: 'Aluminum radiator was cracked at some point and repaired. Repair integrity unknown after 8 years of sitting. Must pressure test before any startup attempt — a failed repair under load could cause rapid overheating.',
    severity: 'concern',
    processedAt: '2026-03-15',
    resultedIn: {
      carUpdate: true,
      newTaskIds: ['pressure-test-radiator'],
    },
  },

  {
    id: 'disc-006',
    date: '2026-03-15',
    system: 'electrical',
    description: 'Visible bodge/hack wiring repairs noted. Car functioned when last used, but after 8 years outdoors, brittle insulation and corroded connectors are certain. No circuit should be trusted without testing. Ground straps are likely corroded at attach points.',
    severity: 'concern',
    processedAt: '2026-03-15',
    resultedIn: {
      carUpdate: true,
      newTaskIds: ['inspect-wiring-harness', 'check-ground-straps'],
    },
  },

  {
    id: 'disc-007',
    date: '2026-03-15',
    system: 'tires',
    description: 'Brand new tires purchased but never mounted, now 8 years old. Stored outdoors in Israel (high UV, heat). Rubber sidewalls likely show ozone cracking. DOT date code must be checked. Tires may be unsafe despite zero tread wear.',
    severity: 'concern',
    processedAt: '2026-03-15',
    resultedIn: {
      carUpdate: true,
      newTaskIds: ['inspect-tires'],
    },
  },

  {
    id: 'disc-008',
    date: '2026-03-15',
    system: 'bed',
    description: 'Pickup bed has rusty floor and sides — confirmed by owner. CJ8 beds are notorious rust traps. Floor rust-through possible. Patch panels or floor replacement may be required.',
    severity: 'concern',
    processedAt: '2026-03-15',
    resultedIn: {
      carUpdate: true,
      newTaskIds: ['inspect-bed', 'bed-rust-repair'],
    },
  },

  {
    id: 'disc-009',
    date: '2026-03-15',
    system: 'rearAxle',
    description: 'Rear axle is a Dana 44 — not the factory AMC 20. Previous owner swap. Gear ratio not confirmed — must match Dana 30 front for proper 4WD operation. If ratio mismatch exists, it must be corrected.',
    severity: 'info',
    processedAt: '2026-03-15',
    resultedIn: {
      carUpdate: true,
      newTaskIds: ['confirm-gear-ratio'],
    },
  },

];
