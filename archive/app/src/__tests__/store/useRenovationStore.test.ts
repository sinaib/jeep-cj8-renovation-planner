/**
 * useRenovationStore tests — delta-only store (v3)
 *
 * The store no longer holds phases/tasks/dependencies — those live in plan.ts.
 * It holds: taskStatuses, taskNotes, taskActualCosts, taskSteps, taskGuides,
 * taskExtraParts, purchasedPartIds, storeOnlyTasks, decisions, agentHistory,
 * fileIndex, and UI flags.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRenovationStore } from '../../store/useRenovationStore';

vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
  maybeRunWeeklyCheck: vi.fn(),
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
describe('Task status delta', () => {

  it('setTaskStatus stores status override', () => {
    store().setTaskStatus('task-brakes', 'active');
    expect(store().taskStatuses['task-brakes']).toBe('active');
  });

  it('setTaskStatus can mark skipped', () => {
    store().setTaskStatus('task-x', 'skipped');
    expect(store().taskStatuses['task-x']).toBe('skipped');
  });

  it('completeTask sets status to done', () => {
    store().completeTask('task-engine');
    expect(store().taskStatuses['task-engine']).toBe('done');
  });

  it('completeTask stores actualCostILS when provided', () => {
    store().completeTask('task-engine', 2500);
    expect(store().taskActualCosts['task-engine']).toBe(2500);
  });

  it('completeTask does not store actualCostILS when not provided', () => {
    store().completeTask('task-engine');
    expect(store().taskActualCosts['task-engine']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Task notes delta', () => {

  it('addTaskNote appends a dated note to empty string', () => {
    store().addTaskNote('task-frame', 'Found rust at mount');
    expect(store().taskNotes['task-frame']).toContain('Found rust at mount');
  });

  it('addTaskNote appends second note with separator', () => {
    store().addTaskNote('task-frame', 'First observation');
    store().addTaskNote('task-frame', 'Second observation');
    const notes = store().taskNotes['task-frame'];
    expect(notes).toContain('First observation');
    expect(notes).toContain('Second observation');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Task cost delta', () => {

  it('updateTaskCost stores cost override', () => {
    store().updateTaskCost('task-brake', 3200);
    expect(store().taskActualCosts['task-brake']).toBe(3200);
  });

  it('updateTaskCost overwrites existing value', () => {
    store().updateTaskCost('task-brake', 1000);
    store().updateTaskCost('task-brake', 5000);
    expect(store().taskActualCosts['task-brake']).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Task steps and guide delta', () => {

  it('setTaskSteps stores steps array', () => {
    store().setTaskSteps('task-oil', ['Drain oil', 'Remove filter', 'Install new filter']);
    expect(store().taskSteps['task-oil']).toEqual(['Drain oil', 'Remove filter', 'Install new filter']);
  });

  it('setTaskGuide stores guide string', () => {
    store().setTaskGuide('task-oil', 'Use 10W-30 synthetic, torque drain plug to 20 Nm');
    expect(store().taskGuides['task-oil']).toBe('Use 10W-30 synthetic, torque drain plug to 20 Nm');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Parts — plan tasks (taskExtraParts)', () => {

  it('addPartToTask adds extra part for a plan task', () => {
    // A task not in storeOnlyTasks → goes to taskExtraParts
    store().addPartToTask('task-brakes', 'Wheel cylinder', 180, 'WC-123');
    const parts = store().taskExtraParts['task-brakes'];
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe('Wheel cylinder');
    expect(parts[0].estimatedCostILS).toBe(180);
    expect(parts[0].partNumber).toBe('WC-123');
    expect(parts[0].purchased).toBe(false);
  });

  it('addPartToTask stores url field when provided', () => {
    store().addPartToTask('task-brakes', 'Rotor', 220, undefined, 'https://jeepland.co.il/rotor');
    expect(store().taskExtraParts['task-brakes'][0].url).toBe('https://jeepland.co.il/rotor');
  });

  it('addPartToTask stores addedBy field', () => {
    store().addPartToTask('task-brakes', 'Gasket', 50, undefined, undefined, 'user');
    expect(store().taskExtraParts['task-brakes'][0].addedBy).toBe('user');
  });

  it('markPartPurchased adds partId to purchasedPartIds', () => {
    store().addPartToTask('task-brakes', 'Wheel cylinder', 180);
    const partId = store().taskExtraParts['task-brakes'][0].id;
    store().markPartPurchased(partId);
    expect(store().purchasedPartIds).toContain(partId);
  });

  it('markPartPurchased is idempotent', () => {
    store().addPartToTask('task-brakes', 'Rotor', 220);
    const partId = store().taskExtraParts['task-brakes'][0].id;
    store().markPartPurchased(partId);
    store().markPartPurchased(partId);
    expect(store().purchasedPartIds.filter((id) => id === partId)).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('storeOnly tasks', () => {

  function makeTask() {
    return store().addStoreOnlyTask({
      name: 'Check AMC 20 axle shafts',
      systemId: 'drivetrain',
      phaseId: 'phase-drivetrain',
      status: 'todo',
      priority: 'critical',
      addedBy: 'agent',
      estimatedCostILS: 3500,
      dependsOnTaskIds: [],
    });
  }

  it('addStoreOnlyTask creates a task with generated id', () => {
    const task = makeTask();
    expect(task.id).toMatch(/^task-/);
    expect(task.name).toBe('Check AMC 20 axle shafts');
    expect(task.parts).toEqual([]);
    expect(task.notes).toBe('');
  });

  it('addStoreOnlyTask stores task in storeOnlyTasks record', () => {
    const task = makeTask();
    expect(store().storeOnlyTasks[task.id]).toBeDefined();
  });

  it('updateStoreOnlyTask merges fields', () => {
    const task = makeTask();
    store().updateStoreOnlyTask(task.id, { status: 'active', estimatedCostILS: 4000 });
    expect(store().storeOnlyTasks[task.id].status).toBe('active');
    expect(store().storeOnlyTasks[task.id].estimatedCostILS).toBe(4000);
    expect(store().storeOnlyTasks[task.id].name).toBe(task.name); // untouched
  });

  it('updateStoreOnlyTask is a no-op for unknown id', () => {
    expect(() => store().updateStoreOnlyTask('nonexistent', { status: 'done' })).not.toThrow();
  });

  it('addPartToTask adds part directly to storeOnly task', () => {
    const task = makeTask();
    store().addPartToTask(task.id, 'Axle shaft conversion kit', 2800);
    const updatedTask = store().storeOnlyTasks[task.id];
    expect(updatedTask.parts).toHaveLength(1);
    expect(updatedTask.parts[0].name).toBe('Axle shaft conversion kit');
    // Should NOT create taskExtraParts entry for this task
    expect(store().taskExtraParts[task.id]).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Decisions', () => {

  it('recordDecision creates decision with id and madeAt timestamp', () => {
    const decision = store().recordDecision({ category: 'budget', summary: 'Max ₪80k', madeBy: 'user' });
    expect(decision.id).toBeTruthy();
    expect(decision.madeAt).toBeTruthy();
    expect(decision.category).toBe('budget');
    expect(decision.summary).toBe('Max ₪80k');
  });

  it('recordDecision accumulates multiple decisions', () => {
    store().recordDecision({ category: 'priority', summary: 'Safety first', madeBy: 'user' });
    store().recordDecision({ category: 'approach', summary: 'DIY only', madeBy: 'user' });
    expect(store().decisions).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Agent history', () => {

  it('addAgentMessage appends with id and timestamp', () => {
    store().addAgentMessage({ role: 'user', content: 'Hello' });
    expect(store().agentHistory).toHaveLength(1);
    expect(store().agentHistory[0].id).toBeTruthy();
    expect(store().agentHistory[0].timestamp).toBeTruthy();
    expect(store().agentHistory[0].content).toBe('Hello');
  });

  it('updateLastAgentMessage updates content of last message', () => {
    store().addAgentMessage({ role: 'assistant', content: 'Initial' });
    store().updateLastAgentMessage('Updated');
    expect(store().agentHistory[0].content).toBe('Updated');
  });

  it('updateLastAgentMessage attaches toolCalls', () => {
    store().addAgentMessage({ role: 'assistant', content: 'initial' });
    store().updateLastAgentMessage('done', [{ name: 'add_task', input: {}, result: 'ok' }]);
    expect(store().agentHistory[0].toolCalls![0].name).toBe('add_task');
  });

  it('setAgentStreaming toggles the flag', () => {
    expect(store().agentStreaming).toBe(false);
    store().setAgentStreaming(true);
    expect(store().agentStreaming).toBe(true);
    store().setAgentStreaming(false);
    expect(store().agentStreaming).toBe(false);
  });

  it('compressAgentHistory replaces specified messages with summary', () => {
    store().addAgentMessage({ role: 'user', content: 'msg 1' });
    store().addAgentMessage({ role: 'assistant', content: 'msg 2' });
    store().addAgentMessage({ role: 'user', content: 'msg 3' });
    const idsToCompress = store().agentHistory.slice(0, 2).map((m) => m.id);
    store().compressAgentHistory('[SUMMARY]', idsToCompress);
    expect(store().agentHistory).toHaveLength(2);
    expect(store().agentHistory[0].content).toBe('[SUMMARY]');
    expect(store().agentHistory[1].content).toBe('msg 3');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Persistence: exportProgress / importProgress', () => {

  it('exportProgress returns valid JSON with delta fields', () => {
    store().setTaskStatus('task-1', 'done');
    store().addTaskNote('task-1', 'Completed successfully');
    const json = store().exportProgress();
    const data = JSON.parse(json);
    expect(data.taskStatuses['task-1']).toBe('done');
    expect(data.taskNotes['task-1']).toContain('Completed successfully');
  });

  it('exportProgress includes all delta fields', () => {
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

  it('importProgress restores delta state', () => {
    store().setTaskStatus('task-engine', 'done');
    store().updateTaskCost('task-engine', 1200);
    const json = store().exportProgress();

    store().resetAll();
    expect(store().taskStatuses['task-engine']).toBeUndefined();

    store().importProgress(json);
    expect(store().taskStatuses['task-engine']).toBe('done');
    expect(store().taskActualCosts['task-engine']).toBe(1200);
  });

  it('importProgress is safe with invalid JSON', () => {
    expect(() => store().importProgress('not json {')).not.toThrow();
  });

  it('resetAll clears all state', () => {
    store().setTaskStatus('task-1', 'done');
    store().addAgentMessage({ role: 'user', content: 'Hello' });
    store().resetAll();
    expect(store().taskStatuses).toEqual({});
    expect(store().agentHistory).toHaveLength(0);
    expect(store().storeOnlyTasks).toEqual({});
  });
});
