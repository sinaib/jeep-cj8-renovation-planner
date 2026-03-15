import type { CarFile } from '../types/car';

export const car: CarFile = {
  vehicle: {
    make: 'Jeep',
    model: 'CJ8 Scrambler',
    year: 1989,
    engine: 'AMC 258 4.2L inline-6',
    transmission: 'T4 4-speed',
    transferCase: 'Dana 300',
    frontAxle: 'Dana 30',
    rearAxle: 'Dana 44 (upgraded — not factory AMC 20)',
    wheelbase: '103.5"',
  },

  overallStatus: 'Partially disassembled, on stands, no wheels. Outdoors uncovered 8 years. Engine in car. Multiple new parts on hand awaiting installation. Two frames available.',
  lastSessionDate: '2026-03-15',

  systems: {

    engine: {
      id: 'engine',
      name: 'Engine — AMC 258 4.2L',
      currentCondition: 'unknown',
      assemblyStatus: 'on-car',
      notes: 'Engine is in the car. Last ran under its own power — drove to current location. Had rough idle and some smoke at time of last use. Color of smoke unknown. Needs full assessment: compression test, leak-down, oil inspection. Engine mounts (new) on hand ready to install.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['assess-engine', 'compression-test', 'replace-engine-mounts', 'tune-up-ignition'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Setup interview. Engine in car, last ran ~8 years ago. Rough idle and smoke noted at time of last use. Smoke color unknown. Engine drove itself to current location.',
          condition: 'unknown',
          by: 'claude',
        },
      ],
    },

    fuel: {
      id: 'fuel',
      name: 'Fuel System — Carter YF Carb',
      currentCondition: 'poor',
      assemblyStatus: 'on-car',
      notes: 'Carter YF carburetor almost certainly gummed after 8 years. Rebuild kit on hand. New seal and cap for Carter also on hand. Tank condition unknown — needs inspection for rust and sediment. All rubber fuel lines must be replaced after 8 years (ethanol degradation + age).',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['carb-rebuild', 'inspect-fuel-tank', 'replace-fuel-lines'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Carb rebuild kit on hand. New seal and cap for Carter on hand. Tank unknown. 8 years sitting = gummed carb and degraded fuel lines assumed.',
          condition: 'poor',
          by: 'claude',
        },
      ],
    },

    cooling: {
      id: 'cooling',
      name: 'Cooling System',
      currentCondition: 'fair',
      assemblyStatus: 'on-car',
      notes: 'Upgraded aluminum radiator (larger than stock). Radiator was cracked and repaired at some point — repair integrity unknown after 8 years. Electric fan came with radiator but was never installed — waiting. Hoses condition unknown but must be assumed degraded after 8 years. System worked well before parking.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['pressure-test-radiator', 'install-electric-fan', 'replace-cooling-hoses'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Aluminum radiator upgrade in place. Cracked + repaired history. Electric fan never installed (have it). Hoses unknown after 8 years.',
          condition: 'fair',
          by: 'claude',
        },
      ],
    },

    transmission: {
      id: 'transmission',
      name: 'Transmission — T4 4-speed',
      currentCondition: 'unknown',
      assemblyStatus: 'on-car',
      notes: 'T4 4-speed confirmed. In the car. New transmission mounts on hand. Clutch is new (reason for purchase unclear — could be preemptive or known issue). Condition of transmission internals unknown — needs inspection.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-transmission', 'replace-trans-mounts', 'install-clutch'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'T4 in car. New trans mounts on hand. New clutch on hand (unknown reason). Internal condition unknown.',
          condition: 'unknown',
          by: 'claude',
        },
      ],
    },

    transferCase: {
      id: 'transferCase',
      name: 'Transfer Case — Dana 300',
      currentCondition: 'poor',
      assemblyStatus: 'on-car',
      notes: 'Dana 300 had noise and difficulty shifting between ranges before parking. This is a significant issue — likely input shaft bearing wear and/or shift fork wear. Will require inspection and likely rebuild.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-transfer-case', 'rebuild-transfer-case'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Noise and hard shifting between 2H/4H/4L reported when last used. Classic Dana 300 bearing/shift fork wear symptoms.',
          condition: 'poor',
          by: 'claude',
        },
      ],
    },

    frontAxle: {
      id: 'frontAxle',
      name: 'Front Axle — Dana 30',
      currentCondition: 'unknown',
      assemblyStatus: 'on-car',
      notes: 'Dana 30 confirmed. Car on stands, no wheels. Condition unknown — needs full inspection: U-joints, wheel bearings, seals, diff fluid.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-front-axle', 'service-front-diff'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Dana 30 confirmed. Car on stands. Condition uninspected.',
          condition: 'unknown',
          by: 'claude',
        },
      ],
    },

    rearAxle: {
      id: 'rearAxle',
      name: 'Rear Axle — Dana 44 (upgraded)',
      currentCondition: 'unknown',
      assemblyStatus: 'on-car',
      notes: 'Previous owner installed Dana 44 in place of factory AMC 20. This is a significant upgrade — Dana 44 is much stronger and lacks the AMC 20 axle shaft cracking issue. Ratio must be confirmed to match front Dana 30. Condition unknown — inspect U-joints, wheel bearings, seals, diff fluid.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-rear-axle', 'service-rear-diff', 'confirm-gear-ratio'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Dana 44 confirmed (upgraded from AMC 20 by previous owner). Car on stands. Condition uninspected. Gear ratio unconfirmed.',
          condition: 'unknown',
          by: 'claude',
        },
      ],
    },

    brakes: {
      id: 'brakes',
      name: 'Brakes',
      currentCondition: 'poor',
      assemblyStatus: 'on-car',
      notes: 'Known issues — soft pedal or leaks when last used. New proportioning valve on hand. New brake booster on hand. After 8 years sitting, wheel cylinders are seized or leaking, brake fluid is hygroscopically contaminated, and brake lines may have internal corrosion. Complete brake system rebuild required.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-brake-lines', 'replace-wheel-cylinders', 'install-brake-booster', 'install-proportioning-valve', 'bleed-brakes'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Known brake issues (soft pedal/leaks). New proportioning valve and brake booster on hand. 8 years sitting = full system rebuild required.',
          condition: 'poor',
          by: 'claude',
        },
      ],
    },

    steering: {
      id: 'steering',
      name: 'Steering',
      currentCondition: 'fair',
      assemblyStatus: 'on-car',
      notes: 'Drag link needs replacement (known). New steering damper on hand. Rest of steering system condition unknown — needs inspection for play in box, tie rod ends, steering shaft U-joint.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['replace-drag-link', 'install-steering-damper', 'inspect-steering-box'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Drag link known bad. New steering damper on hand. Steering box and tie rods uninspected.',
          condition: 'fair',
          by: 'claude',
        },
      ],
    },

    suspension: {
      id: 'suspension',
      name: 'Suspension',
      currentCondition: 'fair',
      assemblyStatus: 'on-car',
      notes: 'Old factory leaf springs and shocks currently on car (stock height). Brand new Rubicon Express 2.5" lift kit on hand — includes leaf springs and matching shocks. Will install during reassembly. Spring mounts and shackles need inspection for rust before installing new kit.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-spring-mounts', 'install-lift-kit'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Factory springs + shocks on car. New Rubicon Express 2.5" kit (leafs + shocks) on hand ready to install.',
          condition: 'fair',
          by: 'claude',
        },
      ],
    },

    electrical: {
      id: 'electrical',
      name: 'Electrical',
      currentCondition: 'fair',
      assemblyStatus: 'on-car',
      notes: 'Visible bodge repairs in wiring but car ran with electrics functional. After 8 years outdoors, insulation is brittle, connectors corroded, and ground straps deteriorated. Not safe to assume anything works — full systematic inspection required before first start attempt.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-wiring-harness', 'check-ground-straps', 'test-all-circuits'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Visible bodge repairs but worked when running. 8 years outdoors = harness inspection mandatory before any startup attempt.',
          condition: 'fair',
          by: 'claude',
        },
      ],
    },

    frame: {
      id: 'frame',
      name: 'Frame',
      currentCondition: 'unknown',
      assemblyStatus: 'on-car',
      notes: 'Primary frame has some concerning rust, extent not fully assessed. CJ8-specific rust locations: body mount cups, rear frame extension welds, spring perch welds. IMPORTANT: A second matching CJ8 frame is available — detached, with brake and fuel lines still attached, similar condition. Must compare both frames before committing to either. Decision: use whichever is structurally sounder.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-primary-frame', 'inspect-spare-frame', 'choose-frame', 'frame-rust-treatment'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Concerning rust on primary frame, extent unknown. Spare matching CJ8 frame available (detached, has brake + fuel lines). Both need comparison inspection.',
          condition: 'unknown',
          by: 'claude',
        },
      ],
    },

    body: {
      id: 'body',
      name: 'Body — Tub',
      currentCondition: 'unknown',
      assemblyStatus: 'on-car',
      notes: 'Tub not carefully inspected. After 8 years outdoors uncovered in Israel, floor rust-through and lower tub rust is likely. CJ8 tub floor is a common rust location. Needs full inspection — floor, lower sides, firewall, body mount plates.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-tub', 'tub-rust-treatment'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Not inspected. 8 years outdoors = rust likely in floor and lower sides.',
          condition: 'unknown',
          by: 'claude',
        },
      ],
    },

    bed: {
      id: 'bed',
      name: 'Pickup Bed (CJ8-specific)',
      currentCondition: 'poor',
      assemblyStatus: 'on-car',
      notes: 'Rusty floor and sides — confirmed. The CJ8 pickup bed is a known rust trap. Floor needs assessment for rust-through. May require patch panels or replacement floor. Bed walls and tailgate also need inspection.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-bed', 'bed-rust-repair'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Rusty floor and sides confirmed by owner. Extent unknown — full inspection needed.',
          condition: 'poor',
          by: 'claude',
        },
      ],
    },

    tires: {
      id: 'tires',
      name: 'Tires & Wheels',
      currentCondition: 'unknown',
      assemblyStatus: 'removed',
      notes: 'Brand new tires purchased, never mounted, 8 years old. Rubber degrades with age regardless of use — in Israel\'s UV and heat, sidewall cracking likely. Must inspect manufacture date (DOT code) and sidewall condition before mounting. Wheels condition unknown. If tires fail inspection, replacement needed before car can move.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: ['inspect-tires', 'mount-tires'],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'New tires never mounted, now 8 years old. Sidewall integrity suspect after Israeli sun exposure.',
          condition: 'unknown',
          by: 'claude',
        },
      ],
    },

    interior: {
      id: 'interior',
      name: 'Interior',
      currentCondition: 'unknown',
      assemblyStatus: 'on-car',
      notes: 'Not discussed. Low priority until mechanical systems are sorted. Likely deteriorated after 8 years outdoors — seats, dash, any soft materials.',
      lastUpdated: '2026-03-15',
      linkedTaskIds: [],
      history: [
        {
          date: '2026-03-15',
          event: 'noted',
          description: 'Not assessed. Low priority.',
          condition: 'unknown',
          by: 'claude',
        },
      ],
    },
  },
};
