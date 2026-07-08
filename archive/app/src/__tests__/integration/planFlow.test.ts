/**
 * Integration tests: end-to-end store flows (delta-only store, v3)
 *
 * plan.ts is the structural source of truth (phases, tasks, steps, parts).
 * The store persists only the runtime delta: statuses, notes, actual costs,
 * agent history, storeOnly tasks, decisions, etc.
 *
 * These tests exercise multi-step workflows the way a real user (or agent) would —
 * adding storeOnly tasks → progressing statuses → tracking costs → exporting.
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
  logChange: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));

const store = () => useRenovationStore.getState();

beforeEach(() => {
  store().resetAll();
});

// ─── Helper: build storeOnly tasks scenario ───────────────────────────────────

function buildBrakesTasks() {
  const brakes = store().addStoreOnlyTask({
    name: 'Inspect and replace brake pads',
    systemId: 'brakes',
    phaseId: 'phase-safety',
    status: 'todo',
    priority: 'critical',
    estimatedCostILS: 1800,
    addedBy: 'agent',
    dependsOnTaskIds: [],
  });

  const rotors = store().addStoreOnlyTask({
    name: 'Resurface or replace brake rotors',
    systemId: 'brakes',
    phaseId: 'phase-safety',
    status: 'todo',
    priority: 'critical',
    estimatedCostILS: 2400,
    addedBy: 'agent',
    dependsOnTaskIds: [],
  });

  const lines = store().addStoreOnlyTask({
    name: 'Inspect brake lines for rust',
    systemId: 'brakes',
    phaseId: 'phase-safety',
    status: 'todo',
    priority: 'critical',
    addedBy: 'agent',
    dependsOnTaskIds: [],
  });

  return { brakes, rotors, lines };
}

// ─── Flow 1: storeOnly task creation ─────────────────────────────────────────

describe('Flow 1: storeOnly task creation', () => {
  it('creates a task with generated id and correct fields', () => {
    const task = store().addStoreOnlyTask({
      name: 'Engine oil change',
      systemId: 'engine',
      phaseId: 'phase-engine',
      status: 'todo',
      priority: 'high',
      estimatedCostILS: 300,
      addedBy: 'agent',
      dependsOnTaskIds: [],
    });
    expect(task.id).toMatch(/^task-/);
    expect(task.name).toBe('Engine oil change');
    expect(task.systemId).toBe('engine');
    expect(task.priority).toBe('high');
    expect(task.estimatedCostILS).toBe(300);
    expect(task.parts).toEqual([]);
    expect(task.notes).toBe('');
  });

  it('stores task in storeOnlyTasks record', () => {
    const task = store().addStoreOnlyTask({
      name: 'Test Task', systemId: 'engine', phaseId: 'phase-engine',
      status: 'todo', priority: 'medium', addedBy: 'agent', dependsOnTaskIds: [],
    });
    expect(store().storeOnlyTasks[task.id]).toBeDefined();
    expect(store().storeOnlyTasks[task.id].name).toBe('Test Task');
  });

  it('multiple tasks accumulate independently', () => {
    buildBrakesTasks();
    expect(Object.keys(store().storeOnlyTasks)).toHaveLength(3);
  });

  it('updateStoreOnlyTask merges fields without touching others', () => {
    const task = store().addStoreOnlyTask({
      name: 'Check fluid', systemId: 'engine', phaseId: 'phase-engine',
      status: 'todo', priority: 'low', estimatedCostILS: 100,
      addedBy: 'agent', dependsOnTaskIds: [],
    });
    store().updateStoreOnlyTask(task.id, { status: 'active', estimatedCostILS: 150 });
    expect(store().storeOnlyTasks[task.id].status).toBe('active');
    expect(store().storeOnlyTasks[task.id].estimatedCostILS).toBe(150);
    expect(store().storeOnlyTasks[task.id].name).toBe('Check fluid'); // untouched
  });

  it('updateStoreOnlyTask on unknown id does not throw', () => {
    expect(() => store().updateStoreOnlyTask('nonexistent', { status: 'done' })).not.toThrow();
  });
});

// ─── Flow 2: Task status progression ─────────────────────────────────────────

describe('Flow 2: Task status lifecycle', () => {
  it('setTaskStatus stores override in taskStatuses', () => {
    const { brakes } = buildBrakesTasks();
    store().setTaskStatus(brakes.id, 'active');
    expect(store().taskStatuses[brakes.id]).toBe('active');
  });

  it('completeTask sets status to done', () => {
    const { brakes } = buildBrakesTasks();
    store().completeTask(brakes.id);
    expect(store().taskStatuses[brakes.id]).toBe('done');
  });

  it('completeTask stores actualCostILS when provided', () => {
    const { brakes } = buildBrakesTasks();
    store().completeTask(brakes.id, 1750);
    expect(store().taskActualCosts[brakes.id]).toBe(1750);
  });

  it('completeTask does not store actualCostILS when omitted', () => {
    const { brakes } = buildBrakesTasks();
    store().completeTask(brakes.id);
    expect(store().taskActualCosts[brakes.id]).toBeUndefined();
  });

  it('task can transition todo → active → done', () => {
    const { lines } = buildBrakesTasks();
    store().setTaskStatus(lines.id, 'active');
    expect(store().taskStatuses[lines.id]).toBe('active');
    store().completeTask(lines.id, 800);
    expect(store().taskStatuses[lines.id]).toBe('done');
    expect(store().taskActualCosts[lines.id]).toBe(800);
  });

  it('can skip a task', () => {
    const { rotors } = buildBrakesTasks();
    store().setTaskStatus(rotors.id, 'skipped');
    expect(store().taskStatuses[rotors.id]).toBe('skipped');
  });

  it('status overrides are task-isolated — other tasks unaffected', () => {
    const { brakes, rotors } = buildBrakesTasks();
    store().setTaskStatus(brakes.id, 'done');
    expect(store().taskStatuses[rotors.id]).toBeUndefined();
  });
});

// ─── Flow 3: Cost tracking ───────────────────────────────────────────────────

describe('Flow 3: Cost tracking', () => {
  it('updateTaskCost records actual cost', () => {
    const { brakes } = buildBrakesTasks();
    store().updateTaskCost(brakes.id, 1950);
    expect(store().taskActualCosts[brakes.id]).toBe(1950);
  });

  it('updateTaskCost overwrites previous value', () => {
    const { brakes } = buildBrakesTasks();
    store().updateTaskCost(brakes.id, 1000);
    store().updateTaskCost(brakes.id, 2200);
    expect(store().taskActualCosts[brakes.id]).toBe(2200);
  });

  it('actual costs accumulate per-task independently', () => {
    const { brakes, rotors } = buildBrakesTasks();
    store().updateTaskCost(brakes.id, 1750);
    store().completeTask(rotors.id, 2600);
    expect(store().taskActualCosts[brakes.id]).toBe(1750);
    expect(store().taskActualCosts[rotors.id]).toBe(2600);
  });
});

// ─── Flow 4: Notes ───────────────────────────────────────────────────────────

describe('Flow 4: Task notes', () => {
  it('addTaskNote stores first note with date prefix', () => {
    const { brakes } = buildBrakesTasks();
    store().addTaskNote(brakes.id, 'Found scoring on rotor surface');
    const notes = store().taskNotes[brakes.id];
    expect(notes).toContain('Found scoring on rotor surface');
    expect(notes).toMatch(/^\[/); // starts with date prefix
  });

  it('addTaskNote appends subsequent notes with separator', () => {
    const { brakes } = buildBrakesTasks();
    store().addTaskNote(brakes.id, 'First observation');
    store().addTaskNote(brakes.id, 'Second observation');
    const notes = store().taskNotes[brakes.id];
    expect(notes).toContain('First observation');
    expect(notes).toContain('Second observation');
    expect(notes).toContain('\n\n');
  });

  it('notes are per-task and do not bleed into other tasks', () => {
    const { brakes, rotors } = buildBrakesTasks();
    store().addTaskNote(brakes.id, 'Note for brakes only');
    expect(store().taskNotes[rotors.id]).toBeUndefined();
  });

  it('addTaskNote on non-existent task does not throw', () => {
    expect(() => store().addTaskNote('does-not-exist', 'anything')).not.toThrow();
  });
});

// ─── Flow 5: Steps and guides ─────────────────────────────────────────────────

describe('Flow 5: Task steps and guides', () => {
  it('setTaskSteps stores steps array', () => {
    const { brakes } = buildBrakesTasks();
    const steps = ['Remove wheel', 'Pull drum', 'Install new pads', 'Torque to 85 ft-lbs'];
    store().setTaskSteps(brakes.id, steps);
    expect(store().taskSteps[brakes.id]).toEqual(steps);
  });

  it('setTaskGuide stores guide string', () => {
    const { brakes } = buildBrakesTasks();
    store().setTaskGuide(brakes.id, 'Use DOT 3 brake fluid. Torque caliper bolts to 25 Nm.');
    expect(store().taskGuides[brakes.id]).toBe('Use DOT 3 brake fluid. Torque caliper bolts to 25 Nm.');
  });

  it('steps and guide are per-task', () => {
    const { brakes, rotors } = buildBrakesTasks();
    store().setTaskSteps(brakes.id, ['Step 1', 'Step 2']);
    expect(store().taskSteps[rotors.id]).toBeUndefined();
  });
});

// ─── Flow 6: Parts management ─────────────────────────────────────────────────

describe('Flow 6: Parts — plan tasks vs storeOnly tasks', () => {
  it('addPartToTask adds extra part for a plan task (goes to taskExtraParts)', () => {
    // 'plan-task-brakes' is not in storeOnlyTasks → extra parts
    store().addPartToTask('plan-task-brakes', 'Brake pads set', 600, 'BP-1234');
    const parts = store().taskExtraParts['plan-task-brakes'];
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe('Brake pads set');
    expect(parts[0].estimatedCostILS).toBe(600);
    expect(parts[0].partNumber).toBe('BP-1234');
    expect(parts[0].purchased).toBe(false);
  });

  it('addPartToTask adds part directly to storeOnly task', () => {
    const { brakes } = buildBrakesTasks();
    store().addPartToTask(brakes.id, 'Axle shaft conversion kit', 2800);
    expect(store().storeOnlyTasks[brakes.id].parts).toHaveLength(1);
    expect(store().storeOnlyTasks[brakes.id].parts[0].name).toBe('Axle shaft conversion kit');
    // Should NOT create taskExtraParts entry for storeOnly tasks
    expect(store().taskExtraParts[brakes.id]).toBeUndefined();
  });

  it('multiple parts accumulate on the same task', () => {
    const { brakes } = buildBrakesTasks();
    store().addPartToTask(brakes.id, 'Part A', 100);
    store().addPartToTask(brakes.id, 'Part B', 200);
    expect(store().storeOnlyTasks[brakes.id].parts).toHaveLength(2);
  });

  it('markPartPurchased adds partId to purchasedPartIds', () => {
    store().addPartToTask('plan-task-123', 'Brake fluid', 80);
    const partId = store().taskExtraParts['plan-task-123'][0].id;
    store().markPartPurchased(partId);
    expect(store().purchasedPartIds).toContain(partId);
  });

  it('markPartPurchased is idempotent', () => {
    store().addPartToTask('plan-task-456', 'Rotor', 220);
    const partId = store().taskExtraParts['plan-task-456'][0].id;
    store().markPartPurchased(partId);
    store().markPartPurchased(partId);
    expect(store().purchasedPartIds.filter((id) => id === partId)).toHaveLength(1);
  });

  it('parts for plan tasks do not affect storeOnly task.parts', () => {
    const { brakes } = buildBrakesTasks();
    store().addPartToTask('some-plan-task', 'Oil filter', 50);
    expect(store().storeOnlyTasks[brakes.id].parts).toHaveLength(0);
  });
});

// ─── Flow 7: Decisions ───────────────────────────────────────────────────────

describe('Flow 7: Runtime decisions', () => {
  it('recordDecision creates decision with id and timestamp', () => {
    const decision = store().recordDecision({
      category: 'budget',
      summary: 'Cap total spend at ₪70,000',
      madeBy: 'user',
    });
    expect(decision.id).toBeTruthy();
    expect(decision.madeAt).toBeTruthy();
    expect(store().decisions).toHaveLength(1);
    expect(store().decisions[0].category).toBe('budget');
    expect(store().decisions[0].summary).toBe('Cap total spend at ₪70,000');
  });

  it('decisions accumulate across multiple calls', () => {
    store().recordDecision({ category: 'priority', summary: 'Safety first', madeBy: 'user' });
    store().recordDecision({ category: 'approach', summary: 'DIY only', madeBy: 'user' });
    store().recordDecision({ category: 'budget', summary: 'Max ₪80k', madeBy: 'user' });
    expect(store().decisions).toHaveLength(3);
  });

  it('includes rationale when provided', () => {
    store().recordDecision({
      category: 'engine',
      summary: 'Keep AMC 258',
      rationale: 'Sentimental and cost reasons',
      madeBy: 'user',
    });
    expect(store().decisions[0].rationale).toBe('Sentimental and cost reasons');
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

  it('updateLastAgentMessage attaches toolCalls', () => {
    store().addAgentMessage({ role: 'assistant', content: 'initial' });
    store().updateLastAgentMessage('done', [{ name: 'add_task', input: {}, result: 'ok' }]);
    expect(store().agentHistory[0].toolCalls![0].name).toBe('add_task');
  });

  it('streaming flag toggles correctly', () => {
    expect(store().agentStreaming).toBe(false);
    store().setAgentStreaming(true);
    expect(store().agentStreaming).toBe(true);
    store().setAgentStreaming(false);
    expect(store().agentStreaming).toBe(false);
  });

  it('messages have auto-generated id and timestamp', () => {
    store().addAgentMessage({ role: 'user', content: 'Hello' });
    expect(store().agentHistory[0].id).toBeTruthy();
    expect(store().agentHistory[0].timestamp).toBeTruthy();
  });
});

// ─── Flow 9: Export / import round-trip ──────────────────────────────────────

describe('Flow 9: Export and import', () => {
  it('exports the delta state as valid JSON', () => {
    const { brakes } = buildBrakesTasks();
    store().setTaskStatus(brakes.id, 'done');
    store().updateTaskCost(brakes.id, 1750);
    store().recordDecision({ category: 'safety', summary: 'Safety always first', madeBy: 'user' });

    const json = store().exportProgress();
    expect(() => JSON.parse(json)).not.toThrow();
    const data = JSON.parse(json);
    expect(data.taskStatuses[brakes.id]).toBe('done');
    expect(data.taskActualCosts[brakes.id]).toBe(1750);
    expect(data.decisions).toHaveLength(1);
  });

  it('exportProgress includes all required delta fields', () => {
    const data = JSON.parse(store().exportProgress());
    expect(data).toHaveProperty('taskStatuses');
    expect(data).toHaveProperty('taskNotes');
    expect(data).toHaveProperty('taskActualCosts');
    expect(data).toHaveProperty('taskSteps');
    expect(data).toHaveProperty('taskGuides');
    expect(data).toHaveProperty('taskExtraParts');
    expect(data).toHaveProperty('purchasedPartIds');
    expect(data).toHaveProperty('storeOnlyTasks');
    expect(data).toHaveProperty('decisions');
    expect(data).toHaveProperty('agentHistory');
  });

  it('imports exported state and restores all delta fields', () => {
    const { brakes } = buildBrakesTasks();
    store().setTaskStatus(brakes.id, 'done');
    store().updateTaskCost(brakes.id, 1750);
    store().addTaskNote(brakes.id, 'Completed with new Raybestos pads');
    const json = store().exportProgress();

    store().resetAll();
    expect(store().taskStatuses[brakes.id]).toBeUndefined();

    store().importProgress(json);
    expect(store().taskStatuses[brakes.id]).toBe('done');
    expect(store().taskActualCosts[brakes.id]).toBe(1750);
    expect(store().taskNotes[brakes.id]).toContain('Completed with new Raybestos pads');
  });

  it('importProgress restores storeOnlyTasks', () => {
    buildBrakesTasks();
    const json = store().exportProgress();

    store().resetAll();
    expect(Object.keys(store().storeOnlyTasks)).toHaveLength(0);

    store().importProgress(json);
    expect(Object.keys(store().storeOnlyTasks)).toHaveLength(3);
  });

  it('importProgress with invalid JSON does not crash', () => {
    expect(() => store().importProgress('not json at all')).not.toThrow();
    // State should remain valid after a failed import
    expect(store().taskStatuses).toEqual({});
  });

  it('resetAll clears all delta state', () => {
    buildBrakesTasks();
    store().recordDecision({ category: 'budget', summary: 'Test decision', madeBy: 'user' });
    store().addAgentMessage({ role: 'user', content: 'Hello' });
    const { brakes } = buildBrakesTasks();
    store().setTaskStatus(brakes.id, 'done');

    store().resetAll();
    expect(store().taskStatuses).toEqual({});
    expect(store().taskNotes).toEqual({});
    expect(store().taskActualCosts).toEqual({});
    expect(store().storeOnlyTasks).toEqual({});
    expect(store().decisions).toHaveLength(0);
    expect(store().agentHistory).toHaveLength(0);
    expect(store().purchasedPartIds).toHaveLength(0);
  });
});

// ─── Flow 10: Full agent workflow simulation ──────────────────────────────────

describe('Flow 10: Full agent workflow simulation', () => {
  it('agent adds task, user marks it active, user completes it with cost', () => {
    const task = store().addStoreOnlyTask({
      name: 'Bleed brake lines',
      systemId: 'brakes',
      phaseId: 'phase-safety',
      status: 'todo',
      priority: 'high',
      estimatedCostILS: 400,
      addedBy: 'agent',
      dependsOnTaskIds: [],
    });

    // User starts working
    store().setTaskStatus(task.id, 'active');
    store().addTaskNote(task.id, 'Started bleeding — found rear caliper sticky');
    expect(store().taskStatuses[task.id]).toBe('active');
    expect(store().taskNotes[task.id]).toContain('rear caliper sticky');

    // Agent adds a part
    store().addPartToTask(task.id, 'Brake bleeder kit', 120, 'BLK-77');
    expect(store().storeOnlyTasks[task.id].parts).toHaveLength(1);

    // User completes task
    store().completeTask(task.id, 520); // more than estimated
    expect(store().taskStatuses[task.id]).toBe('done');
    expect(store().taskActualCosts[task.id]).toBe(520);

    // Agent records decision based on finding
    store().recordDecision({
      category: 'safety',
      summary: 'Rear calipers need replacement — bleeding not enough',
      madeBy: 'agent',
    });
    expect(store().decisions[0].summary).toContain('Rear calipers');
  });

  it('multi-task phase simulation with notes and steps', () => {
    const task1 = store().addStoreOnlyTask({
      name: 'Drain old brake fluid',
      systemId: 'brakes', phaseId: 'phase-safety', status: 'todo',
      priority: 'critical', estimatedCostILS: 50, addedBy: 'agent', dependsOnTaskIds: [],
    });
    const task2 = store().addStoreOnlyTask({
      name: 'Bleed brake lines',
      systemId: 'brakes', phaseId: 'phase-safety', status: 'todo',
      priority: 'critical', estimatedCostILS: 400, addedBy: 'agent', dependsOnTaskIds: [],
    });

    store().setTaskSteps(task1.id, ['Jack up car', 'Open bleeder', 'Drain fluid', 'Close bleeder']);
    store().setTaskSteps(task2.id, ['Fill reservoir', 'Bleed all four corners', 'Check pedal feel']);

    store().completeTask(task1.id, 60);
    store().setTaskStatus(task2.id, 'active');

    expect(store().taskStatuses[task1.id]).toBe('done');
    expect(store().taskStatuses[task2.id]).toBe('active');
    expect(store().taskSteps[task1.id]).toHaveLength(4);
    expect(store().taskSteps[task2.id]).toHaveLength(3);

    // Round-trip the whole state
    const json = store().exportProgress();
    store().resetAll();
    store().importProgress(json);

    expect(store().taskStatuses[task1.id]).toBe('done');
    expect(store().taskStatuses[task2.id]).toBe('active');
    expect(store().taskSteps[task1.id]).toHaveLength(4);
  });
});
