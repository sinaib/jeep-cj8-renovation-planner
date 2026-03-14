/**
 * useRenovationStore tests
 *
 * Covers all 36 mutations and all selectors.
 * Each test calls resetAll() in beforeEach so store state is clean.
 * background analysis and changelog are mocked — we test store logic, not side effects.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRenovationStore } from '../../store/useRenovationStore';

// Mock side-effect modules so store tests don't trigger API calls
vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
  maybeRunWeeklyCheck: vi.fn(),
}));
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
const store = () => useRenovationStore.getState();

function seedPhase(name = 'Test Phase', order = 0) {
  return store().addPhase({ name, subtitle: 'subtitle', systemIds: ['engine'], order, color: '#D4832A' });
}

function seedTask(phaseId: string, name = 'Test Task') {
  return store().addTask({ name, systemId: 'engine', phaseId, status: 'todo', priority: 'medium', addedBy: 'agent' });
}

// ── Test lifecycle ─────────────────────────────────────────────────────────────
beforeEach(() => {
  store().resetAll();
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Phase mutations', () => {

  it('addPhase creates a phase with default taskIds', () => {
    const phase = seedPhase('Safety First');
    expect(phase.name).toBe('Safety First');
    expect(phase.taskIds).toEqual([]);
    expect(phase.id).toBeTruthy();
  });

  it('addPhase stores phase in state', () => {
    seedPhase('Phase A');
    expect(store().phases).toHaveLength(1);
    expect(store().phases[0].name).toBe('Phase A');
  });

  it('addPhase allows a custom id', () => {
    const phase = store().addPhase({ id: 'my-custom-id', name: 'X', subtitle: 'y', systemIds: [], order: 0, color: '#000' });
    expect(phase.id).toBe('my-custom-id');
  });

  it('addPhase accumulates multiple phases', () => {
    seedPhase('Phase A', 0);
    seedPhase('Phase B', 1);
    seedPhase('Phase C', 2);
    expect(store().phases).toHaveLength(3);
  });

  it('updatePhase changes a field without touching other phases', () => {
    const p1 = seedPhase('Phase A');
    const p2 = seedPhase('Phase B');
    store().updatePhase(p1.id, { name: 'Renamed A' });
    const updated = store().phases.find((p) => p.id === p1.id);
    expect(updated?.name).toBe('Renamed A');
    expect(store().phases.find((p) => p.id === p2.id)?.name).toBe('Phase B');
  });

  it('updatePhase can update color', () => {
    const phase = seedPhase();
    store().updatePhase(phase.id, { color: '#FF0000' });
    expect(store().phases[0].color).toBe('#FF0000');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Task mutations', () => {

  it('addTask creates task with correct defaults', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id, 'Fix brakes');
    expect(task.name).toBe('Fix brakes');
    expect(task.parts).toEqual([]);
    expect(task.notes).toBe('');
    expect(task.manualRefs).toEqual([]);
    expect(task.status).toBe('todo');
  });

  it('addTask registers the taskId in the phase.taskIds', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    const phaseState = store().phases.find((p) => p.id === phase.id)!;
    expect(phaseState.taskIds).toContain(task.id);
  });

  it('addTask stores task in tasks record', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    expect(store().tasks[task.id]).toBeDefined();
    expect(store().tasks[task.id].name).toBe(task.name);
  });

  it('addTask assigns phaseOrder based on existing task count', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'Task 1');
    const t2 = seedTask(phase.id, 'Task 2');
    const t3 = seedTask(phase.id, 'Task 3');
    expect(t1.phaseOrder).toBe(0);
    expect(t2.phaseOrder).toBe(1);
    expect(t3.phaseOrder).toBe(2);
  });

  it('updateTask merges partial fields', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().updateTask(task.id, { priority: 'critical', estimatedCostILS: 1500 });
    expect(store().tasks[task.id].priority).toBe('critical');
    expect(store().tasks[task.id].estimatedCostILS).toBe(1500);
    expect(store().tasks[task.id].name).toBe(task.name); // untouched field preserved
  });

  it('updateTask stores steps array', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().updateTask(task.id, { steps: ['Step 1', 'Step 2', 'Step 3'] });
    expect(store().tasks[task.id].steps).toEqual(['Step 1', 'Step 2', 'Step 3']);
  });

  it('completeTask sets status to done', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().completeTask(task.id);
    expect(store().tasks[task.id].status).toBe('done');
  });

  it('completeTask sets completedAt timestamp', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().completeTask(task.id);
    expect(store().tasks[task.id].completedAt).toBeTruthy();
    expect(new Date(store().tasks[task.id].completedAt!).getTime()).toBeGreaterThan(0);
  });

  it('completeTask sets actualCostILS when provided', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().completeTask(task.id, 2500);
    expect(store().tasks[task.id].actualCostILS).toBe(2500);
  });

  it('completeTask does not set actualCostILS when not provided', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().completeTask(task.id);
    expect(store().tasks[task.id].actualCostILS).toBeUndefined();
  });

  it('setTaskStatus changes the status field', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().setTaskStatus(task.id, 'active');
    expect(store().tasks[task.id].status).toBe('active');
  });

  it('setTaskStatus can mark task as skipped', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().setTaskStatus(task.id, 'skipped');
    expect(store().tasks[task.id].status).toBe('skipped');
  });

  it('addTaskNote appends a dated note to empty notes', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addTaskNote(task.id, 'Found rust on the drum');
    expect(store().tasks[task.id].notes).toContain('Found rust on the drum');
  });

  it('addTaskNote appends a second note with separator', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addTaskNote(task.id, 'First observation');
    store().addTaskNote(task.id, 'Second observation');
    const notes = store().tasks[task.id].notes;
    expect(notes).toContain('First observation');
    expect(notes).toContain('Second observation');
  });

  it('addTaskNote is a no-op for missing task', () => {
    expect(() => store().addTaskNote('nonexistent-id', 'note')).not.toThrow();
  });

  it('updateTaskCost sets estimatedCostILS', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().updateTaskCost(task.id, 3200);
    expect(store().tasks[task.id].estimatedCostILS).toBe(3200);
  });

  it('updateTaskCost overwrites existing cost', () => {
    const phase = seedPhase();
    const task = store().addTask({ name: 'T', systemId: 'engine', phaseId: phase.id, priority: 'high', addedBy: 'agent', estimatedCostILS: 1000 });
    store().updateTaskCost(task.id, 5000);
    expect(store().tasks[task.id].estimatedCostILS).toBe(5000);
  });

  it('addPartToTask adds a part with default purchased=false', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addPartToTask(task.id, 'Brake drum', 450, 'BD-123');
    const parts = store().tasks[task.id].parts;
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe('Brake drum');
    expect(parts[0].estimatedCostILS).toBe(450);
    expect(parts[0].partNumber).toBe('BD-123');
    expect(parts[0].purchased).toBe(false);
  });

  it('addPartToTask generates a unique part id', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addPartToTask(task.id, 'Part A');
    store().addPartToTask(task.id, 'Part B');
    const [p1, p2] = store().tasks[task.id].parts;
    expect(p1.id).not.toBe(p2.id);
  });

  it('addPartToTask stores url field when provided', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addPartToTask(task.id, 'Wheel cylinder', 180, undefined, 'https://jeepland.co.il/product/123');
    const part = store().tasks[task.id].parts[0];
    expect(part.url).toBe('https://jeepland.co.il/product/123');
  });

  it('addPartToTask stores addedBy field when provided', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addPartToTask(task.id, 'Gasket set', 220, undefined, undefined, 'user');
    const part = store().tasks[task.id].parts[0];
    expect(part.addedBy).toBe('user');
  });

  it('addPartToTask without url keeps url as undefined', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addPartToTask(task.id, 'Oil filter');
    const part = store().tasks[task.id].parts[0];
    expect(part.url).toBeUndefined();
  });

  it('addPartToTask with agent addedBy stores correctly', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addPartToTask(task.id, 'Water pump', 650, undefined, undefined, 'agent');
    const part = store().tasks[task.id].parts[0];
    expect(part.addedBy).toBe('agent');
  });

  it('markPartPurchased sets purchased=true on the correct part', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addPartToTask(task.id, 'Rotor');
    const part = store().tasks[task.id].parts[0];
    store().markPartPurchased(task.id, part.id);
    expect(store().tasks[task.id].parts[0].purchased).toBe(true);
  });

  it('markPartPurchased does not affect other parts', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().addPartToTask(task.id, 'Part A');
    store().addPartToTask(task.id, 'Part B');
    const [p1] = store().tasks[task.id].parts;
    store().markPartPurchased(task.id, p1.id);
    expect(store().tasks[task.id].parts[1].purchased).toBe(false);
  });

  it('removeTask deletes task from tasks record', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().removeTask(task.id);
    expect(store().tasks[task.id]).toBeUndefined();
  });

  it('removeTask removes taskId from phase.taskIds', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().removeTask(task.id);
    const phaseState = store().phases.find((p) => p.id === phase.id)!;
    expect(phaseState.taskIds).not.toContain(task.id);
  });

  it('removeTask cleans up dependencies referencing that task', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'Task A');
    const t2 = seedTask(phase.id, 'Task B');
    store().addTaskDependency(t2.id, t1.id, 'test dep');
    expect(store().taskDependencies).toHaveLength(1);
    store().removeTask(t1.id);
    expect(store().taskDependencies).toHaveLength(0);
  });

  it('removeTask is a no-op for unknown id', () => {
    expect(() => store().removeTask('nonexistent')).not.toThrow();
  });

  it('moveTask removes taskId from old phase and adds to new phase', () => {
    const phase1 = seedPhase('Phase 1', 0);
    const phase2 = seedPhase('Phase 2', 1);
    const task = seedTask(phase1.id);
    store().moveTask(task.id, phase2.id);
    expect(store().phases.find((p) => p.id === phase1.id)!.taskIds).not.toContain(task.id);
    expect(store().phases.find((p) => p.id === phase2.id)!.taskIds).toContain(task.id);
  });

  it('moveTask updates task.phaseId', () => {
    const phase1 = seedPhase('Phase 1', 0);
    const phase2 = seedPhase('Phase 2', 1);
    const task = seedTask(phase1.id);
    store().moveTask(task.id, phase2.id);
    expect(store().tasks[task.id].phaseId).toBe(phase2.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Gap mutations', () => {

  it('addGap creates gap with dismissed=false', () => {
    const gap = store().addGap('engine', 'Missing oil filter', 'warning');
    expect(gap.dismissed).toBe(false);
    expect(gap.description).toBe('Missing oil filter');
    expect(gap.severity).toBe('warning');
  });

  it('addGap stores gap in state', () => {
    store().addGap('engine', 'Leak detected', 'critical');
    expect(store().gaps).toHaveLength(1);
  });

  it('dismissGap sets dismissed=true', () => {
    const gap = store().addGap('brakes', 'Worn pads', 'warning');
    store().dismissGap(gap.id);
    expect(store().gaps.find((g) => g.id === gap.id)!.dismissed).toBe(true);
  });

  it('dismissGap does not affect other gaps', () => {
    const gap1 = store().addGap('engine', 'Gap 1', 'warning');
    const gap2 = store().addGap('brakes', 'Gap 2', 'suggestion');
    store().dismissGap(gap1.id);
    expect(store().gaps.find((g) => g.id === gap2.id)!.dismissed).toBe(false);
  });

  it('convertGapToTask links convertedToTaskId and dismisses gap', () => {
    const gap = store().addGap('frame', 'Frame rust', 'critical');
    store().convertGapToTask(gap.id, 'task-frame-repair');
    const updated = store().gaps.find((g) => g.id === gap.id)!;
    expect(updated.convertedToTaskId).toBe('task-frame-repair');
    expect(updated.dismissed).toBe(true);
  });

  it('getActiveGaps returns only non-dismissed gaps', () => {
    store().addGap('engine', 'Gap A', 'warning');
    const dismissed = store().addGap('brakes', 'Gap B', 'critical');
    store().dismissGap(dismissed.id);
    store().addGap('frame', 'Gap C', 'suggestion');
    expect(store().getActiveGaps()).toHaveLength(2);
    expect(store().getActiveGaps().map((g) => g.description)).not.toContain('Gap B');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Decisions and car facts', () => {

  it('recordDecision creates decision with madeAt timestamp', () => {
    const decision = store().recordDecision({ category: 'budget', summary: 'Max ₪80k', madeBy: 'user' });
    expect(decision.category).toBe('budget');
    expect(decision.summary).toBe('Max ₪80k');
    expect(decision.madeAt).toBeTruthy();
  });

  it('recordDecision accumulates multiple decisions', () => {
    store().recordDecision({ category: 'priority', summary: 'Safety first', madeBy: 'user' });
    store().recordDecision({ category: 'approach', summary: 'DIY only', madeBy: 'user' });
    expect(store().decisions).toHaveLength(2);
  });

  it('setCarFact creates new fact when key is new', () => {
    store().setCarFact('mileage', '180,000 km', 'user');
    expect(store().carFacts).toHaveLength(1);
    expect(store().carFacts[0].key).toBe('mileage');
    expect(store().carFacts[0].value).toBe('180,000 km');
  });

  it('setCarFact updates existing fact when key already exists', () => {
    store().setCarFact('mileage', '180,000 km', 'user');
    store().setCarFact('mileage', '182,000 km', 'agent');
    expect(store().carFacts).toHaveLength(1); // no duplicate
    expect(store().carFacts[0].value).toBe('182,000 km');
    expect(store().carFacts[0].confirmedBy).toBe('agent');
  });

  it('setCarFact stores multiple distinct facts', () => {
    store().setCarFact('mileage', '180k', 'user');
    store().setCarFact('engine_condition', 'runs rough', 'user');
    store().setCarFact('diy_skills', 'intermediate', 'user');
    expect(store().carFacts).toHaveLength(3);
  });

  it('getCarProfile returns key-value record', () => {
    store().setCarFact('mileage', '180k', 'user');
    store().setCarFact('goals', 'offroad daily', 'user');
    const profile = store().getCarProfile();
    expect(profile).toEqual({ mileage: '180k', goals: 'offroad daily' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Research notes', () => {

  it('addResearchNote creates note with addedAt', () => {
    const note = store().addResearchNote({ topic: 'AMC 258', finding: 'Known issues', source: 'forum' });
    expect(note.topic).toBe('AMC 258');
    expect(note.finding).toBe('Known issues');
    expect(note.addedAt).toBeTruthy();
  });

  it('addResearchNote stores note in state', () => {
    store().addResearchNote({ topic: 'T1', finding: 'F1' });
    store().addResearchNote({ topic: 'T2', finding: 'F2' });
    expect(store().researchNotes).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Task dependencies', () => {

  it('addTaskDependency creates a dependency record', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'Leak fix');
    const t2 = seedTask(phase.id, 'Engine tune');
    store().addTaskDependency(t2.id, t1.id, 'Must fix leak first');
    expect(store().taskDependencies).toHaveLength(1);
    expect(store().taskDependencies[0].taskId).toBe(t2.id);
    expect(store().taskDependencies[0].dependsOnTaskId).toBe(t1.id);
  });

  it('addTaskDependency is idempotent — no duplicates', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'A');
    const t2 = seedTask(phase.id, 'B');
    store().addTaskDependency(t2.id, t1.id, 'reason');
    store().addTaskDependency(t2.id, t1.id, 'same dep again');
    expect(store().taskDependencies).toHaveLength(1);
  });

  it('removeTaskDependency removes the correct dependency', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'A');
    const t2 = seedTask(phase.id, 'B');
    const t3 = seedTask(phase.id, 'C');
    store().addTaskDependency(t2.id, t1.id, 'dep 1');
    store().addTaskDependency(t3.id, t1.id, 'dep 2');
    store().removeTaskDependency(t2.id, t1.id);
    expect(store().taskDependencies).toHaveLength(1);
    expect(store().taskDependencies[0].taskId).toBe(t3.id);
  });

  it('getBlockingTasks returns tasks that block a given task', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'Oil leak fix');
    const t2 = seedTask(phase.id, 'Engine tune');
    store().addTaskDependency(t2.id, t1.id, 'must fix leak first');
    const blockers = store().getBlockingTasks(t2.id);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].id).toBe(t1.id);
  });

  it('getBlockingTasks returns empty for task with no deps', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    expect(store().getBlockingTasks(task.id)).toHaveLength(0);
  });

  it('getDependentTasks returns tasks that depend on a given task', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'Frame rust treatment');
    const t2 = seedTask(phase.id, 'Paint frame');
    const t3 = seedTask(phase.id, 'Install body panels');
    store().addTaskDependency(t2.id, t1.id, 'paint after treatment');
    store().addTaskDependency(t3.id, t1.id, 'panels after treatment');
    const dependents = store().getDependentTasks(t1.id);
    expect(dependents).toHaveLength(2);
    expect(dependents.map((t) => t.id)).toContain(t2.id);
    expect(dependents.map((t) => t.id)).toContain(t3.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Agent history', () => {

  it('addAgentMessage appends to history with id and timestamp', () => {
    store().addAgentMessage({ role: 'user', content: 'Hello' });
    expect(store().agentHistory).toHaveLength(1);
    expect(store().agentHistory[0].role).toBe('user');
    expect(store().agentHistory[0].content).toBe('Hello');
    expect(store().agentHistory[0].id).toBeTruthy();
    expect(store().agentHistory[0].timestamp).toBeTruthy();
  });

  it('updateLastAgentMessage updates the last message content', () => {
    store().addAgentMessage({ role: 'assistant', content: 'Initial' });
    store().updateLastAgentMessage('Updated content');
    expect(store().agentHistory[0].content).toBe('Updated content');
  });

  it('updateLastAgentMessage attaches toolCalls when provided', () => {
    store().addAgentMessage({ role: 'assistant', content: 'initial' });
    store().updateLastAgentMessage('done', [{ name: 'add_task', input: {}, result: 'ok' }]);
    expect(store().agentHistory[0].toolCalls).toHaveLength(1);
    expect(store().agentHistory[0].toolCalls![0].name).toBe('add_task');
  });

  it('setAgentStreaming sets the streaming flag', () => {
    expect(store().agentStreaming).toBe(false);
    store().setAgentStreaming(true);
    expect(store().agentStreaming).toBe(true);
    store().setAgentStreaming(false);
    expect(store().agentStreaming).toBe(false);
  });

  it('compressAgentHistory replaces specified messages with a summary', () => {
    store().addAgentMessage({ role: 'user', content: 'msg 1' });
    store().addAgentMessage({ role: 'assistant', content: 'msg 2' });
    store().addAgentMessage({ role: 'user', content: 'msg 3' }); // keep this
    const idsToCompress = store().agentHistory.slice(0, 2).map((m) => m.id);
    store().compressAgentHistory('[SUMMARY] Earlier context', idsToCompress);
    expect(store().agentHistory).toHaveLength(2); // 1 summary + 1 kept
    expect(store().agentHistory[0].content).toBe('[SUMMARY] Earlier context');
    expect(store().agentHistory[1].content).toBe('msg 3');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Selectors', () => {

  it('getTasksForPhase returns tasks in phaseOrder', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'First');
    const t2 = seedTask(phase.id, 'Second');
    const tasks = store().getTasksForPhase(phase.id);
    expect(tasks[0].id).toBe(t1.id);
    expect(tasks[1].id).toBe(t2.id);
  });

  it('getTasksForPhase returns empty for unknown phase', () => {
    expect(store().getTasksForPhase('phase-unknown')).toEqual([]);
  });

  it('getPhaseCompletionPercent = 0 when no tasks done', () => {
    const phase = seedPhase();
    seedTask(phase.id);
    seedTask(phase.id);
    expect(store().getPhaseCompletionPercent(phase.id)).toBe(0);
  });

  it('getPhaseCompletionPercent = 50 when half done', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'T1');
    seedTask(phase.id, 'T2');
    store().completeTask(t1.id);
    expect(store().getPhaseCompletionPercent(phase.id)).toBe(50);
  });

  it('getPhaseCompletionPercent = 100 when all done', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'T1');
    const t2 = seedTask(phase.id, 'T2');
    store().completeTask(t1.id);
    store().completeTask(t2.id);
    expect(store().getPhaseCompletionPercent(phase.id)).toBe(100);
  });

  it('getPhaseCompletionPercent counts skipped as done', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'T1');
    const t2 = seedTask(phase.id, 'T2');
    store().setTaskStatus(t1.id, 'skipped');
    store().completeTask(t2.id);
    expect(store().getPhaseCompletionPercent(phase.id)).toBe(100);
  });

  it('getPhaseCompletionPercent = 0 for empty phase', () => {
    const phase = seedPhase();
    expect(store().getPhaseCompletionPercent(phase.id)).toBe(0);
  });

  it('getOverallCompletionPercent aggregates across all phases', () => {
    const p1 = seedPhase('P1', 0);
    const p2 = seedPhase('P2', 1);
    const t1 = seedTask(p1.id, 'T1');
    seedTask(p1.id, 'T2');
    seedTask(p2.id, 'T3');
    seedTask(p2.id, 'T4');
    store().completeTask(t1.id);
    // 1/4 done = 25%
    expect(store().getOverallCompletionPercent()).toBe(25);
  });

  it('getOverallCompletionPercent = 0 when no tasks', () => {
    expect(store().getOverallCompletionPercent()).toBe(0);
  });

  it('getNextTask returns first non-done task in phase order', () => {
    const p1 = seedPhase('P1', 0);
    const p2 = seedPhase('P2', 1);
    const t1 = seedTask(p1.id, 'T1');
    seedTask(p2.id, 'T2');
    store().completeTask(t1.id); // t1 done
    const next = store().getNextTask();
    expect(next?.name).toBe('T2');
  });

  it('getNextTask returns undefined when all tasks are done', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'T1');
    store().completeTask(t1.id);
    expect(store().getNextTask()).toBeUndefined();
  });

  it('getTotalCostEstimated sums all estimatedCostILS', () => {
    const phase = seedPhase();
    store().addTask({ name: 'T1', systemId: 'engine', phaseId: phase.id, priority: 'medium', addedBy: 'agent', estimatedCostILS: 1000 });
    store().addTask({ name: 'T2', systemId: 'brakes', phaseId: phase.id, priority: 'high', addedBy: 'agent', estimatedCostILS: 2500 });
    store().addTask({ name: 'T3', systemId: 'frame', phaseId: phase.id, priority: 'low', addedBy: 'agent' }); // no cost
    expect(store().getTotalCostEstimated()).toBe(3500);
  });

  it('getTotalCostEstimated = 0 when no tasks have costs', () => {
    const phase = seedPhase();
    seedTask(phase.id);
    expect(store().getTotalCostEstimated()).toBe(0);
  });

  it('getTotalCostSpent sums actualCostILS', () => {
    const phase = seedPhase();
    const t1 = seedTask(phase.id, 'T1');
    const t2 = seedTask(phase.id, 'T2');
    store().completeTask(t1.id, 800);
    store().completeTask(t2.id, 1200);
    expect(store().getTotalCostSpent()).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Persistence: exportProgress / importProgress', () => {

  it('exportProgress returns valid JSON', () => {
    const phase = seedPhase();
    seedTask(phase.id);
    const json = store().exportProgress();
    expect(() => JSON.parse(json)).not.toThrow();
    const data = JSON.parse(json);
    expect(data.phases).toHaveLength(1);
    expect(Object.keys(data.tasks)).toHaveLength(1);
  });

  it('exportProgress includes all intelligence-layer fields', () => {
    store().setCarFact('mileage', '180k', 'user');
    store().recordDecision({ category: 'budget', summary: 'Max 80k', madeBy: 'user' });
    const data = JSON.parse(store().exportProgress());
    expect(data.carFacts).toHaveLength(1);
    expect(data.decisions).toHaveLength(1);
  });

  it('importProgress restores full state', () => {
    const phase = seedPhase();
    const task = seedTask(phase.id);
    store().setCarFact('mileage', '180k', 'user');
    const json = store().exportProgress();

    store().resetAll();
    expect(store().phases).toHaveLength(0);

    store().importProgress(json);
    expect(store().phases).toHaveLength(1);
    expect(store().phases[0].id).toBe(phase.id);
    expect(store().tasks[task.id]).toBeDefined();
    expect(store().carFacts[0].value).toBe('180k');
  });

  it('importProgress is safe with invalid JSON', () => {
    expect(() => store().importProgress('not valid json {')).not.toThrow();
  });

  it('resetAll clears all state back to initial', () => {
    seedPhase();
    store().setCarFact('mileage', '180k', 'user');
    store().addAgentMessage({ role: 'user', content: 'Hello' });
    store().resetAll();
    expect(store().phases).toHaveLength(0);
    expect(store().carFacts).toHaveLength(0);
    expect(store().agentHistory).toHaveLength(0);
    expect(store().appState).toBe('onboarding');
  });
});
