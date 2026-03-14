/**
 * Integration tests: end-to-end store flows
 *
 * These tests exercise multi-step workflows the way a real user (or agent) would —
 * adding a phase → adding tasks → progressing statuses → checking costs/gaps/deps.
 * No mocking of the store itself; the real Zustand store is used throughout.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRenovationStore } from '../../store/useRenovationStore';

// Prevent agentBackground from making API calls
vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
  maybeRunWeeklyCheck: vi.fn(),
}));

// Prevent changelog from making API calls
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn(),
}));

const store = () => useRenovationStore.getState();

beforeEach(() => {
  store().resetAll();
});

// ─── Helper: build a full phase + tasks scenario ─────────────────────────────

function buildSafetyPhase() {
  const phase = store().addPhase({
    name: 'Safety First',
    subtitle: 'Critical safety items before anything else',
    systemIds: ['brakes', 'steering', 'suspension'],
    order: 1,
    color: '#E74C3C',
  });

  const brakes = store().addTask({
    name: 'Inspect and replace brake pads',
    systemId: 'brakes',
    phaseId: phase.id,
    status: 'todo',
    priority: 'critical',
    estimatedCostILS: 1800,
    addedBy: 'agent',
    agentRationale: 'Safety critical',
    dependsOnTaskIds: [],
  });

  const rotors = store().addTask({
    name: 'Resurface or replace brake rotors',
    systemId: 'brakes',
    phaseId: phase.id,
    status: 'todo',
    priority: 'critical',
    estimatedCostILS: 2400,
    addedBy: 'agent',
    agentRationale: 'Must do with pads',
    dependsOnTaskIds: [],
  });

  const lines = store().addTask({
    name: 'Inspect brake lines for rust',
    systemId: 'brakes',
    phaseId: phase.id,
    status: 'flagged',
    priority: 'critical',
    addedBy: 'agent',
    agentRationale: 'CJ8 brake lines corrode',
    dependsOnTaskIds: [],
  });

  return { phase, brakes, rotors, lines };
}

// ─── Flow 1: Add phase and tasks, verify state ────────────────────────────────

describe('Flow 1: Phase and task creation', () => {
  it('creates a phase with correct initial state', () => {
    const phase = store().addPhase({ name: 'Engine Rebuild', order: 2, color: '#3498DB' });
    expect(phase.id).toMatch(/^phase-/);
    expect(phase.taskIds).toHaveLength(0);
    expect(store().phases).toHaveLength(1);
    expect(store().phases[0].name).toBe('Engine Rebuild');
  });

  it('adds tasks to a phase and links them bidirectionally', () => {
    const { phase, brakes, rotors } = buildSafetyPhase();
    const s = store();
    // Phase knows about both tasks
    const phaseInStore = s.phases.find((p) => p.id === phase.id)!;
    expect(phaseInStore.taskIds).toContain(brakes.id);
    expect(phaseInStore.taskIds).toContain(rotors.id);
    // Tasks know about their phase
    expect(s.tasks[brakes.id].phaseId).toBe(phase.id);
    expect(s.tasks[rotors.id].phaseId).toBe(phase.id);
  });

  it('assigns correct phaseOrder to sequential tasks', () => {
    const { brakes, rotors, lines } = buildSafetyPhase();
    expect(store().tasks[brakes.id].phaseOrder).toBe(0);
    expect(store().tasks[rotors.id].phaseOrder).toBe(1);
    expect(store().tasks[lines.id].phaseOrder).toBe(2);
  });

  it('getTasksForPhase returns tasks sorted by phaseOrder', () => {
    const { phase, brakes, rotors, lines } = buildSafetyPhase();
    const tasks = store().getTasksForPhase(phase.id);
    expect(tasks[0].id).toBe(brakes.id);
    expect(tasks[1].id).toBe(rotors.id);
    expect(tasks[2].id).toBe(lines.id);
  });

  it('adding multiple phases preserves their order', () => {
    store().addPhase({ name: 'Phase A', order: 1 });
    store().addPhase({ name: 'Phase B', order: 2 });
    store().addPhase({ name: 'Phase C', order: 3 });
    expect(store().phases).toHaveLength(3);
    expect(store().phases.map((p) => p.name)).toEqual(['Phase A', 'Phase B', 'Phase C']);
  });
});

// ─── Flow 2: Task status progression ─────────────────────────────────────────

describe('Flow 2: Task status lifecycle', () => {
  it('transitions task from flagged → todo → active → done', () => {
    const { lines } = buildSafetyPhase();
    const s = store();
    expect(s.tasks[lines.id].status).toBe('flagged');

    s.setTaskStatus(lines.id, 'todo');
    expect(store().tasks[lines.id].status).toBe('todo');

    store().setTaskStatus(lines.id, 'active');
    expect(store().tasks[lines.id].status).toBe('active');

    store().completeTask(lines.id, 1200);
    expect(store().tasks[lines.id].status).toBe('done');
    expect(store().tasks[lines.id].completedAt).toBeTruthy();
    expect(store().tasks[lines.id].actualCostILS).toBe(1200);
  });

  it('completeTask sets completedAt timestamp', () => {
    const { brakes } = buildSafetyPhase();
    const before = new Date().toISOString();
    store().completeTask(brakes.id);
    const after = new Date().toISOString();
    const ts = store().tasks[brakes.id].completedAt!;
    expect(ts >= before).toBe(true);
    expect(ts <= after).toBe(true);
  });

  it('skipping a task counts toward completion', () => {
    const { phase, brakes, rotors } = buildSafetyPhase();
    store().setTaskStatus(brakes.id, 'done');
    store().setTaskStatus(rotors.id, 'skipped');
    const pct = store().getPhaseCompletionPercent(phase.id);
    // 2 of 3 tasks done/skipped = Math.round(66.666...) = 67%
    expect(pct).toBe(67);
  });

  it('getNextTask returns the first non-done, non-skipped task in the earliest phase', () => {
    buildSafetyPhase();
    const next = store().getNextTask();
    expect(next).toBeDefined();
    expect(next!.name).toBe('Inspect and replace brake pads');
  });

  it('getNextTask returns undefined when all tasks are done', () => {
    const { brakes, rotors, lines } = buildSafetyPhase();
    store().setTaskStatus(brakes.id, 'done');
    store().setTaskStatus(rotors.id, 'done');
    store().setTaskStatus(lines.id, 'done');
    expect(store().getNextTask()).toBeUndefined();
  });

  it('getOverallCompletionPercent reflects cross-phase completion', () => {
    const { brakes } = buildSafetyPhase();
    const phase2 = store().addPhase({ name: 'Engine', order: 2 });
    const engineTask = store().addTask({
      name: 'Oil change', systemId: 'engine', phaseId: phase2.id,
      status: 'todo', priority: 'normal', addedBy: 'agent',
      agentRationale: 'First step', dependsOnTaskIds: [],
    });
    // Complete 2 of 4 tasks
    store().setTaskStatus(brakes.id, 'done');
    store().setTaskStatus(engineTask.id, 'done');
    expect(store().getOverallCompletionPercent()).toBe(50);
  });
});

// ─── Flow 3: Cost tracking ───────────────────────────────────────────────────

describe('Flow 3: Cost tracking and calculations', () => {
  it('getTotalCostEstimated sums all task estimates', () => {
    buildSafetyPhase(); // brakes=1800, rotors=2400, lines=no cost
    expect(store().getTotalCostEstimated()).toBe(4200);
  });

  it('updateTaskCost changes the estimate and affects total', () => {
    const { lines } = buildSafetyPhase();
    store().updateTaskCost(lines.id, 900);
    expect(store().tasks[lines.id].estimatedCostILS).toBe(900);
    expect(store().getTotalCostEstimated()).toBe(5100); // 1800 + 2400 + 900
  });

  it('getTotalCostSpent includes actualCostILS of done tasks', () => {
    const { brakes, rotors } = buildSafetyPhase();
    store().completeTask(brakes.id, 1750); // actual less than estimate
    store().completeTask(rotors.id, 2600); // actual more than estimate
    expect(store().getTotalCostSpent()).toBe(4350);
  });

  it('adding parts to a task does not auto-update estimatedCostILS', () => {
    const { brakes } = buildSafetyPhase();
    store().addPartToTask(brakes.id, 'Brake pads set', 600, 'BP-1234');
    store().addPartToTask(brakes.id, 'Brake fluid', 80);
    // parts don't auto-sum into estimatedCostILS — that's done separately
    expect(store().tasks[brakes.id].estimatedCostILS).toBe(1800);
    expect(store().tasks[brakes.id].parts).toHaveLength(2);
  });

  it('markPartPurchased flips the purchased flag', () => {
    const { brakes } = buildSafetyPhase();
    store().addPartToTask(brakes.id, 'Brake pads', 600);
    const partId = store().tasks[brakes.id].parts[0].id;
    expect(store().tasks[brakes.id].parts[0].purchased).toBe(false);
    store().markPartPurchased(brakes.id, partId);
    expect(store().tasks[brakes.id].parts[0].purchased).toBe(true);
  });

  it('budget check: sets car fact and computes over-budget state', () => {
    buildSafetyPhase(); // 4200 total
    store().setCarFact('budget', '₪3000', 'user');
    const budgetFact = store().carFacts.find((f) => f.key === 'budget');
    expect(budgetFact?.value).toBe('₪3000');
    // The CostDashboard will parse this and show over-budget
    const estimated = store().getTotalCostEstimated();
    const budget = parseInt('3000', 10);
    expect(estimated).toBeGreaterThan(budget);
  });
});

// ─── Flow 4: Gap lifecycle ───────────────────────────────────────────────────

describe('Flow 4: Gap detection and dismissal', () => {
  it('addGap creates a non-dismissed gap', () => {
    const gap = store().addGap('Brakes', 'No parking brake', 'critical');
    expect(gap.dismissed).toBe(false);
    expect(store().getActiveGaps()).toHaveLength(1);
  });

  it('dismissGap removes it from active gaps', () => {
    const gap = store().addGap('Engine', 'Coolant leak suspected', 'warning');
    store().dismissGap(gap.id);
    expect(store().getActiveGaps()).toHaveLength(0);
    // But it's still in gaps array
    expect(store().gaps).toHaveLength(1);
    expect(store().gaps[0].dismissed).toBe(true);
  });

  it('convertGapToTask marks gap as dismissed with converted task id', () => {
    const gap = store().addGap('Suspension', 'Ball joints worn', 'warning');
    const { phase } = buildSafetyPhase();
    const task = store().addTask({
      name: 'Replace ball joints', systemId: 'suspension',
      phaseId: phase.id, status: 'todo', priority: 'high',
      addedBy: 'agent', agentRationale: 'From gap', dependsOnTaskIds: [],
    });
    store().convertGapToTask(gap.id, task.id);
    const g = store().gaps.find((g) => g.id === gap.id)!;
    expect(g.dismissed).toBe(true);
    expect(g.convertedToTaskId).toBe(task.id);
    expect(store().getActiveGaps()).toHaveLength(0);
  });

  it('multiple gaps with different severities are all tracked', () => {
    store().addGap('Brakes', 'Brake fade risk', 'critical');
    store().addGap('Electrical', 'Frayed wiring', 'warning');
    store().addGap('Body', 'Surface rust on door', 'suggestion');
    expect(store().getActiveGaps()).toHaveLength(3);
    const severities = store().getActiveGaps().map((g) => g.severity);
    expect(severities).toContain('critical');
    expect(severities).toContain('warning');
    expect(severities).toContain('suggestion');
  });
});

// ─── Flow 5: Dependency management ──────────────────────────────────────────

describe('Flow 5: Task dependencies', () => {
  it('adds a dependency and retrieves blocking/dependent tasks', () => {
    const { phase } = buildSafetyPhase();
    const taskA = store().addTask({
      name: 'Drain old brake fluid', systemId: 'brakes',
      phaseId: phase.id, status: 'todo', priority: 'critical',
      addedBy: 'agent', agentRationale: 'Step 1', dependsOnTaskIds: [],
    });
    const taskB = store().addTask({
      name: 'Bleed brake lines', systemId: 'brakes',
      phaseId: phase.id, status: 'todo', priority: 'critical',
      addedBy: 'agent', agentRationale: 'Step 2', dependsOnTaskIds: [],
    });
    store().addTaskDependency(taskB.id, taskA.id, 'Must drain before bleeding');

    const blocking = store().getBlockingTasks(taskB.id);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].id).toBe(taskA.id);

    const dependents = store().getDependentTasks(taskA.id);
    expect(dependents).toHaveLength(1);
    expect(dependents[0].id).toBe(taskB.id);
  });

  it('ignores duplicate dependencies', () => {
    const { phase } = buildSafetyPhase();
    const t1 = store().addTask({
      name: 'T1', systemId: 'engine', phaseId: phase.id, status: 'todo',
      priority: 'normal', addedBy: 'agent', agentRationale: '', dependsOnTaskIds: [],
    });
    const t2 = store().addTask({
      name: 'T2', systemId: 'engine', phaseId: phase.id, status: 'todo',
      priority: 'normal', addedBy: 'agent', agentRationale: '', dependsOnTaskIds: [],
    });
    store().addTaskDependency(t2.id, t1.id, 'reason');
    store().addTaskDependency(t2.id, t1.id, 'reason again');
    expect(store().taskDependencies).toHaveLength(1);
  });

  it('removeTaskDependency clears the link', () => {
    const { phase } = buildSafetyPhase();
    const t1 = store().addTask({
      name: 'T1', systemId: 'engine', phaseId: phase.id, status: 'todo',
      priority: 'normal', addedBy: 'agent', agentRationale: '', dependsOnTaskIds: [],
    });
    const t2 = store().addTask({
      name: 'T2', systemId: 'engine', phaseId: phase.id, status: 'todo',
      priority: 'normal', addedBy: 'agent', agentRationale: '', dependsOnTaskIds: [],
    });
    store().addTaskDependency(t2.id, t1.id, 'reason');
    store().removeTaskDependency(t2.id, t1.id);
    expect(store().taskDependencies).toHaveLength(0);
    expect(store().getBlockingTasks(t2.id)).toHaveLength(0);
  });

  it('removing a task cleans up its dependencies from both sides', () => {
    const { phase, brakes, rotors } = buildSafetyPhase();
    const t3 = store().addTask({
      name: 'T3', systemId: 'brakes', phaseId: phase.id, status: 'todo',
      priority: 'normal', addedBy: 'agent', agentRationale: '', dependsOnTaskIds: [],
    });
    store().addTaskDependency(rotors.id, brakes.id, 'brakes first');
    store().addTaskDependency(t3.id, rotors.id, 'rotors first');

    // Remove the middle task
    store().removeTask(rotors.id);

    // Both dependencies involving rotors should be gone
    expect(store().taskDependencies).toHaveLength(0);
    expect(store().getBlockingTasks(t3.id)).toHaveLength(0);
  });
});

// ─── Flow 6: Move and remove tasks ───────────────────────────────────────────

describe('Flow 6: Task relocation and deletion', () => {
  it('moveTask transfers task between phases', () => {
    const { phase, brakes } = buildSafetyPhase();
    const phase2 = store().addPhase({ name: 'Engine', order: 2 });

    store().moveTask(brakes.id, phase2.id);

    // Old phase no longer has it
    const oldPhase = store().phases.find((p) => p.id === phase.id)!;
    expect(oldPhase.taskIds).not.toContain(brakes.id);

    // New phase has it
    const newPhase = store().phases.find((p) => p.id === phase2.id)!;
    expect(newPhase.taskIds).toContain(brakes.id);

    // Task's phaseId updated
    expect(store().tasks[brakes.id].phaseId).toBe(phase2.id);
  });

  it('removeTask deletes task and removes from phase taskIds', () => {
    const { phase, brakes } = buildSafetyPhase();
    store().removeTask(brakes.id);
    expect(store().tasks[brakes.id]).toBeUndefined();
    const phaseInStore = store().phases.find((p) => p.id === phase.id)!;
    expect(phaseInStore.taskIds).not.toContain(brakes.id);
  });

  it('removeTask does not affect other tasks in the phase', () => {
    const { phase, brakes, rotors } = buildSafetyPhase();
    store().removeTask(brakes.id);
    expect(store().tasks[rotors.id]).toBeDefined();
    const phaseInStore = store().phases.find((p) => p.id === phase.id)!;
    expect(phaseInStore.taskIds).toContain(rotors.id);
  });
});

// ─── Flow 7: Intelligence layer (decisions + car facts) ──────────────────────

describe('Flow 7: Decision and car fact management', () => {
  it('records a decision and retrieves it', () => {
    const decision = store().recordDecision({
      category: 'budget',
      summary: 'Cap total spend at ₪70,000',
      details: 'Family agreed on max budget before project start',
    });
    expect(decision.id).toBeTruthy();
    expect(store().decisions).toHaveLength(1);
    expect(store().decisions[0].category).toBe('budget');
  });

  it('setCarFact creates a new fact', () => {
    store().setCarFact('engine_condition', 'Runs rough, smokes on cold start', 'user');
    expect(store().carFacts).toHaveLength(1);
    expect(store().carFacts[0].key).toBe('engine_condition');
  });

  it('setCarFact updates an existing fact by key', () => {
    store().setCarFact('mileage', '180,000 km', 'user');
    store().setCarFact('mileage', '182,000 km', 'agent'); // correction
    expect(store().carFacts).toHaveLength(1);
    expect(store().carFacts[0].value).toBe('182,000 km');
    expect(store().carFacts[0].confirmedBy).toBe('agent');
  });

  it('getCarProfile returns a key-value map', () => {
    store().setCarFact('diy_skills', 'Intermediate', 'user');
    store().setCarFact('goals', 'Daily driver + weekend trail', 'user');
    const profile = store().getCarProfile();
    expect(profile).toEqual({
      diy_skills: 'Intermediate',
      goals: 'Daily driver + weekend trail',
    });
  });
});

// ─── Flow 8: Agent message history ───────────────────────────────────────────

describe('Flow 8: Agent history and compression', () => {
  it('adds messages and compression summary correctly', () => {
    store().addAgentMessage({ role: 'user', content: 'What should I fix first?' });
    store().addAgentMessage({ role: 'assistant', content: 'Start with brakes — safety first.' });
    store().addAgentMessage({ role: 'user', content: 'How much will it cost?' });
    store().addAgentMessage({ role: 'assistant', content: 'About ₪4,200 for the full brake system.' });
    expect(store().agentHistory).toHaveLength(4);

    const ids = store().agentHistory.slice(0, 2).map((m) => m.id);
    store().compressAgentHistory('Summary: discussed safety and brake costs', ids);

    // 1 summary + 2 remaining = 3
    expect(store().agentHistory).toHaveLength(3);
    expect(store().agentHistory[0].content).toBe('Summary: discussed safety and brake costs');
    expect(store().agentHistory[0].role).toBe('assistant');
  });

  it('updateLastAgentMessage updates the content of the last message', () => {
    store().addAgentMessage({ role: 'assistant', content: 'Thinking...' });
    store().updateLastAgentMessage('Brake inspection costs ₪4,200 total.');
    const last = store().agentHistory[store().agentHistory.length - 1];
    expect(last.content).toBe('Brake inspection costs ₪4,200 total.');
  });

  it('streaming flag toggles correctly', () => {
    expect(store().agentStreaming).toBe(false);
    store().setAgentStreaming(true);
    expect(store().agentStreaming).toBe(true);
    store().setAgentStreaming(false);
    expect(store().agentStreaming).toBe(false);
  });
});

// ─── Flow 9: Export / import round-trip ──────────────────────────────────────

describe('Flow 9: Export and import', () => {
  it('exports the full state as valid JSON', () => {
    buildSafetyPhase();
    store().recordDecision({ category: 'safety', summary: 'Safety always first' });
    const json = store().exportProgress();
    expect(() => JSON.parse(json)).not.toThrow();
    const data = JSON.parse(json);
    expect(data.phases).toHaveLength(1);
    expect(Object.keys(data.tasks)).toHaveLength(3);
    expect(data.decisions).toHaveLength(1);
  });

  it('imports exported state and restores all fields', () => {
    buildSafetyPhase();
    store().setCarFact('budget', '₪50,000', 'user');
    const json = store().exportProgress();

    // Reset and re-import
    store().resetAll();
    expect(store().phases).toHaveLength(0);

    store().importProgress(json);
    expect(store().phases).toHaveLength(1);
    expect(store().phases[0].name).toBe('Safety First');
    expect(Object.keys(store().tasks)).toHaveLength(3);
    expect(store().carFacts.find((f) => f.key === 'budget')?.value).toBe('₪50,000');
  });

  it('importProgress with invalid JSON does not crash', () => {
    expect(() => store().importProgress('not json at all')).not.toThrow();
    // State should remain unchanged after a failed import
    expect(store().phases).toHaveLength(0);
  });

  it('resetAll clears everything back to initial state', () => {
    buildSafetyPhase();
    store().recordDecision({ category: 'budget', summary: 'Test decision' });
    store().addGap('Engine', 'Oil leak', 'warning');
    store().setCarFact('mileage', '180,000 km', 'user');

    store().resetAll();
    expect(store().phases).toHaveLength(0);
    expect(store().tasks).toEqual({});
    expect(store().decisions).toHaveLength(0);
    expect(store().gaps).toHaveLength(0);
    expect(store().carFacts).toHaveLength(0);
    expect(store().agentHistory).toHaveLength(0);
    expect(store().appState).toBe('onboarding');
  });
});

// ─── Flow 10: Onboarding lifecycle ───────────────────────────────────────────

describe('Flow 10: Onboarding', () => {
  it('starts in onboarding state', () => {
    expect(store().appState).toBe('onboarding');
  });

  it('markSystemOnboarded adds system id once', () => {
    store().markSystemOnboarded('engine');
    store().markSystemOnboarded('brakes');
    store().markSystemOnboarded('engine'); // duplicate
    expect(store().onboardingSystemsCompleted).toHaveLength(2);
    expect(store().onboardingSystemsCompleted).toContain('engine');
    expect(store().onboardingSystemsCompleted).toContain('brakes');
  });

  it('finishOnboarding transitions to plan_built', () => {
    store().finishOnboarding();
    expect(store().appState).toBe('plan_built');
  });
});

// ─── Flow 11: Research notes ──────────────────────────────────────────────────

describe('Flow 11: Research notes', () => {
  it('adds and retrieves research notes', () => {
    store().addResearchNote({
      topic: 'CJ8 brake booster',
      finding: 'Stock vacuum booster often fails on 1989 models after 30 years',
      source: 'jeepforum.com',
    });
    store().addResearchNote({
      topic: 'Israeli brake part suppliers',
      finding: 'AutoMatic in TLV stocks Raybestos pads for CJ series',
      source: 'Local inquiry',
      relatedTaskId: 'task-abc123',
    });
    expect(store().researchNotes).toHaveLength(2);
    expect(store().researchNotes[0].topic).toBe('CJ8 brake booster');
    expect(store().researchNotes[1].relatedTaskId).toBe('task-abc123');
  });

  it('research notes have auto-generated id and addedAt', () => {
    const note = store().addResearchNote({
      topic: 'Torque specs', finding: 'Lug nuts: 85 ft-lbs', source: 'Manual',
    });
    expect(note.id).toBeTruthy();
    expect(note.addedAt).toBeTruthy();
    expect(new Date(note.addedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// ─── Flow 12: Notes on tasks ──────────────────────────────────────────────────

describe('Flow 12: Task notes', () => {
  it('adds a first note with date prefix', () => {
    const { brakes } = buildSafetyPhase();
    store().addTaskNote(brakes.id, 'Found scoring on rotor surface');
    const notes = store().tasks[brakes.id].notes;
    expect(notes).toContain('Found scoring on rotor surface');
    expect(notes).toMatch(/^\[/); // starts with date prefix
  });

  it('appends subsequent notes with separator', () => {
    const { brakes } = buildSafetyPhase();
    store().addTaskNote(brakes.id, 'First note');
    store().addTaskNote(brakes.id, 'Second note');
    const notes = store().tasks[brakes.id].notes;
    expect(notes).toContain('First note');
    expect(notes).toContain('Second note');
    expect(notes).toContain('\n\n');
  });

  it('addTaskNote on non-existent task is a no-op', () => {
    expect(() => store().addTaskNote('does-not-exist', 'anything')).not.toThrow();
  });
});
