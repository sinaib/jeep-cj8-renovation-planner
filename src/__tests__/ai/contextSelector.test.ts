/**
 * contextSelector tests
 *
 * New architecture: context reads from plan.ts (mocked), car.ts (mocked),
 * decisions.ts (mocked), and store delta. No more carFacts/gaps/researchNotes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectRelevantSystems, buildDynamicContext } from '../../ai/contextSelector';
import { useRenovationStore } from '../../store/useRenovationStore';

vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
}));
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));

// Mock car.ts — provides the car profile section
vi.mock('../../data/car', () => ({
  car: {
    vehicle: {
      year: 1989,
      make: 'Jeep',
      model: 'CJ8 Scrambler',
      engine: 'AMC 258 4.2L inline-6',
      transmission: 'T4',
      transferCase: 'Dana 300',
      frontAxle: 'Dana 30',
      rearAxle: 'AMC 20',
    },
    overallStatus: 'Partially disassembled',
  },
}));

// Mock decisions.ts — strategic build decisions
vi.mock('../../data/decisions', () => ({
  decisions: [
    { category: 'engine', title: 'Keep AMC 258', decision: 'Rebuild original engine' },
  ],
}));

// Mock plan.ts — plan structure
let mockPhases: unknown[] = [];
let mockTasks: Record<string, unknown> = {};
let mockDeps: unknown[] = [];

vi.mock('../../data/plan', () => ({
  get phases() { return mockPhases; },
  get tasks() { return mockTasks; },
  get taskDependencies() { return mockDeps; },
}));

function seedPlan() {
  mockPhases = [
    { id: 'phase-safety', name: 'Safety First', subtitle: 'safety items', systemIds: ['brakes'], order: 0, taskIds: ['t-brakes', 't-tires'] },
  ];
  mockTasks = {
    't-brakes': {
      id: 't-brakes', name: 'Replace brake drums', systemId: 'brakes',
      phaseId: 'phase-safety', priority: 'critical', status: 'todo',
      estimatedCostILS: 800, parts: [], notes: 'Drum diameter: 10 inches',
      steps: ['Remove wheel', 'Pull drum', 'Install new drum'],
      dependsOn: [], addedBy: 'agent', phaseOrder: 0, manualRefs: [],
    },
    't-tires': {
      id: 't-tires', name: 'New tires', systemId: 'suspension',
      phaseId: 'phase-safety', priority: 'high', status: 'todo',
      estimatedCostILS: 2000, parts: [], notes: '',
      dependsOn: [], addedBy: 'agent', phaseOrder: 1, manualRefs: [],
    },
  };
  mockDeps = [];
}

function clearPlan() {
  mockPhases = [];
  mockTasks = {};
  mockDeps = [];
}

const store = () => useRenovationStore.getState();

beforeEach(() => {
  store().resetAll();
  clearPlan();
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('detectRelevantSystems', () => {

  it('detects engine from "engine oil change"', () => {
    expect(detectRelevantSystems('engine oil change')).toContain('engine');
  });

  it('detects engine from carburetor keyword', () => {
    expect(detectRelevantSystems('rebuild the carburetor')).toContain('engine');
  });

  it('detects brakes from "brake drum replacement"', () => {
    expect(detectRelevantSystems('brake drum replacement')).toContain('brakes');
  });

  it('detects brakes from master cylinder keyword', () => {
    expect(detectRelevantSystems('master cylinder is leaking')).toContain('brakes');
  });

  it('detects suspension from "leaf spring"', () => {
    expect(detectRelevantSystems('replace the leaf spring')).toContain('suspension');
  });

  it('detects electrical from "wire harness"', () => {
    expect(detectRelevantSystems('replace wire harness')).toContain('electrical');
  });

  it('detects electrical from battery', () => {
    expect(detectRelevantSystems('dead battery')).toContain('electrical');
  });

  it('detects frame from "rust"', () => {
    expect(detectRelevantSystems('frame rust treatment')).toContain('frame');
  });

  it('detects transmission from clutch', () => {
    expect(detectRelevantSystems('clutch slipping')).toContain('transmission');
  });

  it('detects axle from "differential"', () => {
    expect(detectRelevantSystems('front differential rebuild')).toContain('axle');
  });

  it('detects cooling from radiator', () => {
    expect(detectRelevantSystems('radiator leaking coolant')).toContain('cooling');
  });

  it('detects fuel from fuel pump', () => {
    expect(detectRelevantSystems('fuel pump replacement')).toContain('fuel');
  });

  it('detects steering from tie rod', () => {
    expect(detectRelevantSystems('worn tie rod ends')).toContain('steering');
  });

  it('detects multiple systems in one query', () => {
    const systems = detectRelevantSystems('engine oil and brake pads both need attention');
    expect(systems).toContain('engine');
    expect(systems).toContain('brakes');
  });

  it('returns empty array for generic query with no system keywords', () => {
    expect(detectRelevantSystems("what's next on my list")).toHaveLength(0);
  });

  it('is case insensitive: ENGINE → engine', () => {
    expect(detectRelevantSystems('ENGINE REBUILD')).toContain('engine');
  });

  it('detects transfer from dana 300', () => {
    expect(detectRelevantSystems('dana 300 rebuild')).toContain('transfer');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('buildDynamicContext — structure', () => {

  it('always includes CAR PROFILE section', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## CAR PROFILE');
  });

  it('includes vehicle make/model in car profile', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('Jeep');
    expect(ctx).toContain('CJ8 Scrambler');
  });

  it('always includes BUILD DECISIONS section', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## BUILD DECISIONS');
  });

  it('includes build decisions from decisions.ts', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('Keep AMC 258');
  });

  it('always includes RUNTIME DECISIONS section', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## RUNTIME DECISIONS');
  });

  it('shows "None recorded this session" when no runtime decisions', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('None recorded this session');
  });

  it('includes runtime decisions when present', () => {
    store().recordDecision({ category: 'budget', summary: 'Max ₪80,000', madeBy: 'user' });
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('Max ₪80,000');
    expect(ctx).toContain('[BUDGET]');
  });

  it('includes only last 5 runtime decisions', () => {
    for (let i = 0; i < 7; i++) {
      store().recordDecision({ category: 'other', summary: `Decision ${i}`, madeBy: 'user' });
    }
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('Decision 6');
    expect(ctx).not.toContain('Decision 0');
    expect(ctx).not.toContain('Decision 1');
  });

  it('always includes PLAN section', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## PLAN');
  });

  it('always includes PHASE & TASK IDs section', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## PHASE & TASK IDs');
  });

  it('shows "No phases defined yet" when plan is empty', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('No phases defined yet');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('buildDynamicContext — plan selection modes', () => {

  it('FOCUSED MODE: contains FOCUSED TASK section when taskId provided', () => {
    seedPlan();
    const ctx = buildDynamicContext('tell me about this task', { taskId: 't-brakes' });
    expect(ctx).toContain('FOCUSED TASK:');
    expect(ctx).toContain('Replace brake drums');
  });

  it('FOCUSED MODE: includes task steps', () => {
    seedPlan();
    const ctx = buildDynamicContext('how do I do this?', { taskId: 't-brakes' });
    expect(ctx).toContain('Remove wheel');
    expect(ctx).toContain('STEPS:');
  });

  it('FOCUSED MODE: includes sibling tasks', () => {
    seedPlan();
    const ctx = buildDynamicContext('what else is in this phase?', { taskId: 't-brakes' });
    expect(ctx).toContain('SIBLING TASKS');
    expect(ctx).toContain('New tires');
  });

  it('FOCUSED MODE: includes task notes', () => {
    seedPlan();
    const ctx = buildDynamicContext('what did we note?', { taskId: 't-brakes' });
    expect(ctx).toContain('Drum diameter');
  });

  it('FOCUSED MODE: includes delta notes from store', () => {
    seedPlan();
    store().addTaskNote('t-brakes', 'Checked the adjuster — needs replacement');
    const ctx = buildDynamicContext('what did we note?', { taskId: 't-brakes' });
    expect(ctx).toContain('Checked the adjuster');
  });

  it('FOCUSED MODE: includes BLOCKED BY info when dependency exists', () => {
    seedPlan();
    mockDeps = [{ taskId: 't-tires', dependsOnTaskId: 't-brakes', reason: 'brakes first' }];
    const ctx = buildDynamicContext('what blocks this?', { taskId: 't-tires' });
    expect(ctx).toContain('BLOCKED BY');
    expect(ctx).toContain('Replace brake drums');
  });

  it('PHASE MODE: contains PHASE section when phaseId provided', () => {
    seedPlan();
    const ctx = buildDynamicContext('show phase details', { phaseId: 'phase-safety' });
    expect(ctx).toContain('PHASE: Safety First');
    expect(ctx).toContain('Replace brake drums');
    expect(ctx).toContain('New tires');
  });

  it('PHASE MODE: shows done/total count', () => {
    seedPlan();
    store().setTaskStatus('t-brakes', 'done');
    const ctx = buildDynamicContext('phase progress', { phaseId: 'phase-safety' });
    expect(ctx).toContain('1/2 done');
  });

  it('SYSTEM MODE: contains matching tasks when engine keyword in query', () => {
    mockPhases = [{ id: 'phase-engine', name: 'Engine', order: 0, taskIds: ['t-gasket', 't-brakes2'], subtitle: '', systemIds: [] }];
    mockTasks = {
      't-gasket': { id: 't-gasket', name: 'AMC 258 head gasket', systemId: 'engine', phaseId: 'phase-engine', priority: 'high', status: 'todo', estimatedCostILS: 500, parts: [], dependsOn: [], addedBy: 'agent', phaseOrder: 0, manualRefs: [] },
      't-brakes2': { id: 't-brakes2', name: 'Brake replacement', systemId: 'brakes', phaseId: 'phase-engine', priority: 'medium', status: 'todo', estimatedCostILS: 800, parts: [], dependsOn: [], addedBy: 'agent', phaseOrder: 1, manualRefs: [] },
    };
    const ctx = buildDynamicContext('engine is running rough');
    expect(ctx).toContain('TASKS MATCHING');
    expect(ctx).toContain('AMC 258 head gasket');
  });

  it('COST MODE: contains COST SUMMARY when budget keyword in query', () => {
    seedPlan();
    const ctx = buildDynamicContext('what is my total budget?');
    expect(ctx).toContain('COST SUMMARY');
    expect(ctx).toContain('₪');
  });

  it('COST MODE: shows correct total', () => {
    seedPlan();
    const ctx = buildDynamicContext('cost breakdown please');
    expect(ctx).toContain('₪2800'); // 800 + 2000
  });

  it('DEFAULT MODE: shows Safety First phase when query is generic', () => {
    seedPlan();
    const ctx = buildDynamicContext('what should I do?');
    expect(ctx).toContain('Safety First');
  });

  it('includes storeOnly tasks in the plan', () => {
    seedPlan();
    store().addStoreOnlyTask({
      name: 'Check AMC 20 axle shafts',
      systemId: 'axle', phaseId: 'phase-safety', status: 'todo',
      priority: 'critical', addedBy: 'agent', dependsOnTaskIds: [],
    });
    const ctx = buildDynamicContext('what is in the plan?');
    expect(ctx).toContain('Check AMC 20 axle shafts');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('buildDynamicContext — ID reference section', () => {

  it('includes phase IDs for tool call reference', () => {
    seedPlan();
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('phase-safety');
    expect(ctx).toContain('"Safety First"');
  });

  it('includes task IDs for tool call reference', () => {
    seedPlan();
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('t-brakes');
    expect(ctx).toContain('"Replace brake drums"');
  });
});
