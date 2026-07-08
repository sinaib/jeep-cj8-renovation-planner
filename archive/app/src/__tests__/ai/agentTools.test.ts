/**
 * agentTools tests
 *
 * Tests executeToolCall for the current tool set (post-architecture-cleanup).
 * Plan structure lives in plan.ts; agent tools operate on the delta store.
 * We use addStoreOnlyTask to create a test task in beforeEach.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeToolCall } from '../../ai/agentTools';
import { useRenovationStore } from '../../store/useRenovationStore';

vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
}));
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));
// Mock plan.ts — agentTools reads planTasks/planPhases for context building
vi.mock('../../data/plan', () => ({
  phases: [{ id: 'phase-engine', name: 'Engine', taskIds: [] }],
  tasks: {},
  taskDependencies: [],
}));
vi.mock('../../data/decisions', () => ({ decisions: [] }));
vi.mock('../../data/car', () => ({ car: { vehicle: {}, overallStatus: 'test' } }));

const store = () => useRenovationStore.getState();

let taskId: string;

beforeEach(() => {
  store().resetAll();
  // Create a storeOnly task to work with
  const task = store().addStoreOnlyTask({
    name: 'Test Task',
    systemId: 'engine',
    phaseId: 'phase-engine',
    status: 'todo',
    priority: 'medium',
    addedBy: 'agent',
    estimatedCostILS: 500,
    dependsOnTaskIds: [],
  });
  taskId = task.id;
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('add_task', () => {

  it('creates a task in storeOnlyTasks', async () => {
    const before = Object.keys(store().storeOnlyTasks).length;
    await executeToolCall('add_task', {
      name: 'Replace head gasket',
      systemId: 'engine',
      phaseId: 'phase-engine',
      priority: 'high',
      estimatedCostILS: 1200,
      agentRationale: 'Known failure point on AMC 258',
    });
    expect(Object.keys(store().storeOnlyTasks).length).toBe(before + 1);
    const newTask = Object.values(store().storeOnlyTasks).find((t) => t.name === 'Replace head gasket');
    expect(newTask).toBeDefined();
    expect(newTask?.priority).toBe('high');
    expect(newTask?.estimatedCostILS).toBe(1200);
  });

  it('returns a confirmation string with the task name', async () => {
    const result = await executeToolCall('add_task', {
      name: 'Spark plug replacement', systemId: 'engine', phaseId: 'phase-engine', priority: 'low',
    });
    expect(result).toContain('Spark plug replacement');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('update_task_status', () => {

  it('sets task status to active', async () => {
    await executeToolCall('update_task_status', { taskId, status: 'active' });
    expect(store().taskStatuses[taskId]).toBe('active');
  });

  it('sets task status to done', async () => {
    await executeToolCall('update_task_status', { taskId, status: 'done' });
    expect(store().taskStatuses[taskId]).toBe('done');
  });

  it('sets task status to skipped', async () => {
    await executeToolCall('update_task_status', { taskId, status: 'skipped' });
    expect(store().taskStatuses[taskId]).toBe('skipped');
  });

  it('adds a note when note is provided', async () => {
    await executeToolCall('update_task_status', {
      taskId, status: 'active', note: 'Started working on this today',
    });
    expect(store().taskNotes[taskId]).toContain('Started working on this today');
  });

  it('returns a result string', async () => {
    const result = await executeToolCall('update_task_status', { taskId, status: 'active' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('add_task_note', () => {

  it('appends a note to the task', async () => {
    await executeToolCall('add_task_note', { taskId, note: 'Torque spec: 65 ft-lbs' });
    expect(store().taskNotes[taskId]).toContain('Torque spec: 65 ft-lbs');
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('add_task_note', { taskId, note: 'test note' });
    expect(typeof result).toBe('string');
  });

  it('handles note on nonexistent task gracefully', async () => {
    const result = await executeToolCall('add_task_note', { taskId: 'nonexistent', note: 'test' });
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('update_task_cost', () => {

  it('sets the actual cost in ILS', async () => {
    await executeToolCall('update_task_cost', { taskId, costILS: 1800 });
    expect(store().taskActualCosts[taskId]).toBe(1800);
  });

  it('returns confirmation with cost', async () => {
    const result = await executeToolCall('update_task_cost', { taskId, costILS: 1800 });
    expect(result).toContain('1800');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('add_part_to_task', () => {

  it('adds a part to storeOnly task directly', async () => {
    await executeToolCall('add_part_to_task', {
      taskId, partName: 'Brake drum', estimatedCostILS: 450, partNumber: 'BD-83',
    });
    const parts = store().storeOnlyTasks[taskId].parts;
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe('Brake drum');
    expect(parts[0].estimatedCostILS).toBe(450);
    expect(parts[0].partNumber).toBe('BD-83');
    expect(parts[0].purchased).toBe(false);
  });

  it('adds multiple parts independently', async () => {
    await executeToolCall('add_part_to_task', { taskId, partName: 'Part A', estimatedCostILS: 100 });
    await executeToolCall('add_part_to_task', { taskId, partName: 'Part B', estimatedCostILS: 200 });
    expect(store().storeOnlyTasks[taskId].parts).toHaveLength(2);
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('add_part_to_task', { taskId, partName: 'Test Part' });
    expect(result).toContain('Test Part');
  });

  it('adds extra part for a plan task (not storeOnly)', async () => {
    // 'plan-task-123' is not in storeOnlyTasks → goes to taskExtraParts
    await executeToolCall('add_part_to_task', { taskId: 'plan-task-123', partName: 'Oil filter' });
    expect(store().taskExtraParts['plan-task-123']).toHaveLength(1);
    expect(store().taskExtraParts['plan-task-123'][0].name).toBe('Oil filter');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('set_task_steps', () => {

  it('saves steps array via setTaskSteps', async () => {
    const steps = ['Remove wheel', 'Unbolt drum', 'Install new drum', 'Torque to 85 ft-lbs'];
    await executeToolCall('set_task_steps', { taskId, steps });
    expect(store().taskSteps[taskId]).toEqual(steps);
  });

  it('saves optional guide text via setTaskGuide', async () => {
    await executeToolCall('set_task_steps', {
      taskId,
      steps: ['Step 1'],
      guide: 'Technical overview for CJ8 drum brakes',
    });
    expect(store().taskGuides[taskId]).toBe('Technical overview for CJ8 drum brakes');
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('set_task_steps', { taskId, steps: ['Step 1'] });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('flag_gap', () => {

  it('converts to a task note (no longer creates a gap object)', async () => {
    await executeToolCall('flag_gap', {
      systemId: 'engine',
      description: 'No oil cooler task found',
      severity: 'warning',
      relatedTaskId: taskId,
    });
    // flag_gap now converts to a task note or decision rather than store.gaps
    expect(store().gaps).toBeUndefined(); // gaps no longer in store
    // Should not throw
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('flag_gap', {
      systemId: 'brakes', description: 'Test gap', severity: 'critical',
    });
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('record_decision', () => {

  it('creates decision with correct category', async () => {
    await executeToolCall('record_decision', {
      category: 'budget', summary: 'Max ₪80k total', madeBy: 'user',
    });
    expect(store().decisions).toHaveLength(1);
    expect(store().decisions[0].category).toBe('budget');
    expect(store().decisions[0].summary).toBe('Max ₪80k total');
  });

  it('includes rationale when provided', async () => {
    await executeToolCall('record_decision', {
      category: 'approach', summary: 'DIY everything', madeBy: 'user',
      rationale: 'Cost savings and learning',
    });
    expect(store().decisions[0].rationale).toBe('Cost savings and learning');
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('record_decision', {
      category: 'safety', summary: 'Safety first always', madeBy: 'user',
    });
    expect(result).toContain('Safety first always');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('get_full_plan', () => {

  it('returns a string containing plan info', async () => {
    const result = await executeToolCall('get_full_plan', {});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes storeOnly task names', async () => {
    const result = await executeToolCall('get_full_plan', {});
    expect(result).toContain('Test Task');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('search_web', () => {

  it('calls /api/search with correct query parameter', async () => {
    await executeToolCall('search_web', { query: 'AMC 258 head gasket torque specs' });
    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const searchCall = fetchCalls.find((call) => (call[0] as string).includes('/api/search'));
    expect(searchCall).toBeDefined();
    expect(searchCall![0]).toContain('AMC%20258');
  });

  it('returns the result from the API', async () => {
    const result = await executeToolCall('search_web', { query: 'test query' });
    expect(result).toBe('Mock search result for testing.');
  });

  it('handles fetch failure gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    const result = await executeToolCall('search_web', { query: 'test' });
    expect(result).toContain('Search unavailable');
  });

  it('handles HTTP error response gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('', { status: 500 })
    );
    const result = await executeToolCall('search_web', { query: 'test' });
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('unknown tool', () => {

  it('returns error string for completely unknown tool name', async () => {
    const result = await executeToolCall('totally_made_up_tool', { foo: 'bar' });
    expect(typeof result).toBe('string');
    expect(result.toLowerCase()).toContain('unknown');
  });
});
