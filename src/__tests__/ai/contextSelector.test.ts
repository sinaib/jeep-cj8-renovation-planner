/**
 * contextSelector tests
 *
 * Tests every detection mode and every plan section builder.
 * We set up store state directly (using importProgress) and then call
 * the exported functions to verify the output contains expected strings.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectRelevantSystems, buildDynamicContext } from '../../ai/contextSelector';
import { useRenovationStore } from '../../store/useRenovationStore';

// Suppress background analysis and changelog side effects
vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
}));
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));

const store = () => useRenovationStore.getState();

beforeEach(() => {
  store().resetAll();
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

  it('detects suspension from lift kit', () => {
    expect(detectRelevantSystems('install a 3-inch lift')).toContain('suspension');
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

  it('is case insensitive: BRAKE → brakes', () => {
    expect(detectRelevantSystems('BRAKE FLUID CHECK')).toContain('brakes');
  });

  it('detects body system from paint keyword', () => {
    expect(detectRelevantSystems('paint the body panels')).toContain('body');
  });

  it('detects transfer from dana 300', () => {
    expect(detectRelevantSystems('dana 300 rebuild')).toContain('transfer');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('buildDynamicContext — structure', () => {

  it('always includes APP STATE header', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## APP STATE:');
  });

  it('always includes CAR PROFILE section', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## CAR PROFILE');
  });

  it('shows "No facts recorded yet" when carFacts empty', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('No facts recorded yet');
  });

  it('always includes RECENT DECISIONS section', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## RECENT DECISIONS');
  });

  it('shows "None recorded" when no decisions', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('None recorded');
  });

  it('always includes ACTIVE GAPS section', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## ACTIVE GAPS');
  });

  it('always includes PHASE & TASK IDs section', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('## PHASE & TASK IDs');
  });

  it('includes car facts in CAR PROFILE when set', () => {
    store().setCarFact('mileage', '180,000 km', 'user');
    store().setCarFact('engine_condition', 'runs rough', 'user');
    const ctx = buildDynamicContext('what should I do?');
    expect(ctx).toContain('mileage: 180,000 km');
    expect(ctx).toContain('engine_condition: runs rough');
  });

  it('includes recent decisions in RECENT DECISIONS when set', () => {
    store().recordDecision({ category: 'budget', summary: 'Max ₪80,000', madeBy: 'user' });
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('Max ₪80,000');
    expect(ctx).toContain('[BUDGET]');
  });

  it('includes only last 5 decisions', () => {
    for (let i = 0; i < 7; i++) {
      store().recordDecision({ category: 'other', summary: `Decision ${i}`, madeBy: 'user' });
    }
    const ctx = buildDynamicContext('hello');
    // Last 5 decisions shown (2, 3, 4, 5, 6)
    expect(ctx).toContain('Decision 6');
    expect(ctx).toContain('Decision 2');
    expect(ctx).not.toContain('Decision 0'); // too old
    expect(ctx).not.toContain('Decision 1'); // too old
  });

  it('includes active (non-dismissed) gaps', () => {
    store().addGap('engine', 'Missing oil filter', 'critical');
    const gap2 = store().addGap('brakes', 'Worn pads', 'warning');
    store().dismissGap(gap2.id);
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('Missing oil filter');
    expect(ctx).not.toContain('Worn pads'); // dismissed
  });

  it('shows [CRITICAL] label for critical gaps', () => {
    store().addGap('engine', 'No oil pressure', 'critical');
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('[CRITICAL]');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('buildDynamicContext — plan selection modes', () => {

  function seedFullPlan() {
    const phase = store().addPhase({ name: 'Safety First', subtitle: 'safety', systemIds: ['brakes'], order: 0, color: '#D00' });
    const t1 = store().addTask({ name: 'Replace brake drums', systemId: 'brakes', phaseId: phase.id, priority: 'critical', estimatedCostILS: 800, addedBy: 'agent' });
    const t2 = store().addTask({ name: 'New tires', systemId: 'suspension', phaseId: phase.id, priority: 'high', estimatedCostILS: 2000, addedBy: 'agent' });
    store().updateTask(t1.id, { steps: ['Remove wheel', 'Pull drum', 'Install new drum'] });
    store().addTaskNote(t1.id, 'Drum diameter: 10 inches');
    return { phase, t1, t2 };
  }

  it('FOCUSED MODE: contains FOCUSED TASK section when taskId provided', () => {
    const { t1 } = seedFullPlan();
    const ctx = buildDynamicContext('tell me about this task', { taskId: t1.id });
    expect(ctx).toContain('FOCUSED TASK:');
    expect(ctx).toContain('Replace brake drums');
  });

  it('FOCUSED MODE: includes task steps', () => {
    const { t1 } = seedFullPlan();
    const ctx = buildDynamicContext('how do I do this?', { taskId: t1.id });
    expect(ctx).toContain('Remove wheel');
    expect(ctx).toContain('STEPS:');
  });

  it('FOCUSED MODE: includes sibling tasks', () => {
    const { t1 } = seedFullPlan();
    const ctx = buildDynamicContext('what else is in this phase?', { taskId: t1.id });
    expect(ctx).toContain('SIBLING TASKS');
    expect(ctx).toContain('New tires');
  });

  it('FOCUSED MODE: includes task notes', () => {
    const { t1 } = seedFullPlan();
    const ctx = buildDynamicContext('what did we note?', { taskId: t1.id });
    expect(ctx).toContain('Drum diameter');
  });

  it('FOCUSED MODE: includes blocked-by info when dependency exists', () => {
    const phase = store().addPhase({ name: 'P', subtitle: '', systemIds: ['engine'], order: 0, color: '#000' });
    const t1 = store().addTask({ name: 'Fix leak', systemId: 'engine', phaseId: phase.id, priority: 'high', addedBy: 'agent' });
    const t2 = store().addTask({ name: 'Tune engine', systemId: 'engine', phaseId: phase.id, priority: 'medium', addedBy: 'agent' });
    store().addTaskDependency(t2.id, t1.id, 'must fix before tune');
    const ctx = buildDynamicContext('what blocks this?', { taskId: t2.id });
    expect(ctx).toContain('BLOCKED BY');
    expect(ctx).toContain('Fix leak');
  });

  it('PHASE MODE: contains PHASE section when phaseId provided', () => {
    const { phase } = seedFullPlan();
    const ctx = buildDynamicContext('show phase details', { phaseId: phase.id });
    expect(ctx).toContain('PHASE: Safety First');
    expect(ctx).toContain('Replace brake drums');
    expect(ctx).toContain('New tires');
  });

  it('PHASE MODE: shows done/total count', () => {
    const { phase, t1 } = seedFullPlan();
    store().completeTask(t1.id);
    const ctx = buildDynamicContext('phase progress', { phaseId: phase.id });
    expect(ctx).toContain('1/2 done');
  });

  it('SYSTEM MODE: contains matching tasks when engine keyword in query', () => {
    store().addPhase({ name: 'Engine', subtitle: '', systemIds: ['engine'], order: 0, color: '#000' });
    const phase = store().phases[0];
    store().addTask({ name: 'AMC 258 head gasket', systemId: 'engine', phaseId: phase.id, priority: 'high', addedBy: 'agent' });
    store().addTask({ name: 'Brake replacement', systemId: 'brakes', phaseId: phase.id, priority: 'medium', addedBy: 'agent' });
    const ctx = buildDynamicContext('engine is running rough');
    expect(ctx).toContain('TASKS MATCHING');
    expect(ctx).toContain('AMC 258 head gasket');
  });

  it('COST MODE: contains COST SUMMARY when budget keyword in query', () => {
    seedFullPlan();
    const ctx = buildDynamicContext('what is my total budget?');
    expect(ctx).toContain('COST SUMMARY');
    expect(ctx).toContain('₪');
  });

  it('COST MODE: triggered by ₪ symbol', () => {
    seedFullPlan();
    const ctx = buildDynamicContext('how much is ₪ estimate');
    expect(ctx).toContain('COST SUMMARY');
  });

  it('COST MODE: shows total estimated and spent', () => {
    seedFullPlan();
    const ctx = buildDynamicContext('cost breakdown please');
    expect(ctx).toContain('₪2800'); // 800 + 2000
  });

  it('DEFAULT MODE: shows compressed plan when no keywords', () => {
    seedFullPlan();
    const ctx = buildDynamicContext('what should I do?');
    // Should contain phase summary, not full task detail
    expect(ctx).toContain('Safety First');
  });

  it('DEFAULT MODE: shows No phases defined yet when store is empty', () => {
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain('No phases defined yet');
  });

  it('research notes are included when matching taskId', () => {
    const { t1 } = seedFullPlan();
    store().addResearchNote({
      topic: 'CJ8 brake drum specs',
      finding: 'Stock drum is 10.00"',
      source: 'forum post',
      relevantTaskIds: [t1.id],
    });
    const ctx = buildDynamicContext('tell me about brakes', { taskId: t1.id });
    expect(ctx).toContain('RELEVANT RESEARCH');
    expect(ctx).toContain('CJ8 brake drum specs');
  });

  it('research notes are not included when not relevant', () => {
    seedFullPlan();
    store().addResearchNote({
      topic: 'Transfer case rebuild',
      finding: 'Dana 300 weak point is...',
      source: 'wiki',
    });
    const ctx = buildDynamicContext('what should I do?');
    // Research note about transfer case shouldn't appear for a generic query
    // unless keywords match
    expect(ctx).not.toContain('RELEVANT RESEARCH');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('buildDynamicContext — ID reference section', () => {

  it('includes phase IDs for tool call reference', () => {
    const phase = store().addPhase({ id: 'phase-safety', name: 'Safety', subtitle: '', systemIds: [], order: 0, color: '#000' });
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain(phase.id);
    expect(ctx).toContain('"Safety"');
  });

  it('includes task IDs for tool call reference', () => {
    const phase = store().addPhase({ name: 'P', subtitle: '', systemIds: [], order: 0, color: '#000' });
    const task = store().addTask({ name: 'Fix brakes', systemId: 'brakes', phaseId: phase.id, priority: 'high', addedBy: 'agent' });
    const ctx = buildDynamicContext('hello');
    expect(ctx).toContain(task.id);
    expect(ctx).toContain('"Fix brakes"');
  });
});
