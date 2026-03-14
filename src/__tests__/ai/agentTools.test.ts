/**
 * agentTools tests
 *
 * Tests `executeToolCall` for every tool by:
 *  1. Calling it with valid inputs
 *  2. Checking the store state changed as expected
 *  3. Checking the returned result string is informative
 *  4. Verifying graceful handling of bad inputs
 *
 * The store is real (not mocked) so we get full mutation coverage.
 * We seed a phase and task in beforeEach for tools that need existing IDs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeToolCall } from '../../ai/agentTools';
import { useRenovationStore } from '../../store/useRenovationStore';

// Suppress background analysis and changelog
vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
}));
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));

const store = () => useRenovationStore.getState();

let phaseId: string;
let taskId: string;

beforeEach(() => {
  store().resetAll();
  const phase = store().addPhase({ name: 'Test Phase', subtitle: 'testing', systemIds: ['engine'], order: 0, color: '#D4832A' });
  phaseId = phase.id;
  const task = store().addTask({ name: 'Test Task', systemId: 'engine', phaseId, status: 'todo', priority: 'medium', addedBy: 'agent', estimatedCostILS: 500 });
  taskId = task.id;
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('add_phase', () => {

  it('creates a new phase in the store', async () => {
    const before = store().phases.length;
    await executeToolCall('add_phase', {
      name: 'Engine Rebuild', subtitle: 'Complete engine overhaul',
      systemIds: ['engine'], order: 1, color: '#2D7A3A',
    });
    expect(store().phases.length).toBe(before + 1);
    expect(store().phases.find((p) => p.name === 'Engine Rebuild')).toBeDefined();
  });

  it('returns a confirmation string', async () => {
    const result = await executeToolCall('add_phase', {
      name: 'Body Work', subtitle: 'Rust and paint',
      systemIds: ['body', 'frame'], order: 2,
    });
    expect(result).toContain('Body Work');
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('add_task', () => {

  it('creates a task in the specified phase', async () => {
    const before = Object.keys(store().tasks).length;
    await executeToolCall('add_task', {
      name: 'Replace head gasket',
      systemId: 'engine',
      phaseId,
      priority: 'high',
      estimatedCostILS: 1200,
      agentRationale: 'Known failure point on AMC 258',
    });
    expect(Object.keys(store().tasks).length).toBe(before + 1);
    const newTask = Object.values(store().tasks).find((t) => t.name === 'Replace head gasket');
    expect(newTask).toBeDefined();
    expect(newTask?.priority).toBe('high');
    expect(newTask?.estimatedCostILS).toBe(1200);
  });

  it('registers task id in phase.taskIds', async () => {
    await executeToolCall('add_task', {
      name: 'Valve adjustment', systemId: 'engine', phaseId, priority: 'medium',
    });
    const newTask = Object.values(store().tasks).find((t) => t.name === 'Valve adjustment')!;
    const phase = store().phases.find((p) => p.id === phaseId)!;
    expect(phase.taskIds).toContain(newTask.id);
  });

  it('returns a confirmation string with the task name', async () => {
    const result = await executeToolCall('add_task', {
      name: 'Spark plug replacement', systemId: 'engine', phaseId, priority: 'low',
    });
    expect(result).toContain('Spark plug replacement');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('update_task_status', () => {

  it('sets task status to active', async () => {
    await executeToolCall('update_task_status', { taskId, status: 'active' });
    expect(store().tasks[taskId].status).toBe('active');
  });

  it('sets task status to done via completeTask', async () => {
    await executeToolCall('update_task_status', { taskId, status: 'done' });
    expect(store().tasks[taskId].status).toBe('done');
    expect(store().tasks[taskId].completedAt).toBeTruthy();
  });

  it('sets task status to skipped', async () => {
    await executeToolCall('update_task_status', { taskId, status: 'skipped' });
    expect(store().tasks[taskId].status).toBe('skipped');
  });

  it('adds a note when note is provided with status update', async () => {
    await executeToolCall('update_task_status', {
      taskId, status: 'active', note: 'Started working on this today',
    });
    expect(store().tasks[taskId].notes).toContain('Started working on this today');
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
    expect(store().tasks[taskId].notes).toContain('Torque spec: 65 ft-lbs');
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('add_task_note', { taskId, note: 'test note' });
    expect(typeof result).toBe('string');
  });

  it('handles note on nonexistent task gracefully', async () => {
    const result = await executeToolCall('add_task_note', { taskId: 'nonexistent', note: 'test' });
    expect(typeof result).toBe('string');
    expect(() => result).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('update_task_cost', () => {

  it('sets the estimated cost in ILS', async () => {
    await executeToolCall('update_task_cost', { taskId, costILS: 1800 });
    expect(store().tasks[taskId].estimatedCostILS).toBe(1800);
  });

  it('returns confirmation with cost', async () => {
    const result = await executeToolCall('update_task_cost', { taskId, costILS: 1800 });
    expect(result).toContain('1800');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('add_part_to_task', () => {

  it('adds a part to the task parts list', async () => {
    await executeToolCall('add_part_to_task', {
      taskId, partName: 'Brake drum', estimatedCostILS: 450, partNumber: 'BD-83',
    });
    const parts = store().tasks[taskId].parts;
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe('Brake drum');
    expect(parts[0].estimatedCostILS).toBe(450);
    expect(parts[0].partNumber).toBe('BD-83');
    expect(parts[0].purchased).toBe(false);
  });

  it('adds multiple parts independently', async () => {
    await executeToolCall('add_part_to_task', { taskId, partName: 'Part A', estimatedCostILS: 100 });
    await executeToolCall('add_part_to_task', { taskId, partName: 'Part B', estimatedCostILS: 200 });
    expect(store().tasks[taskId].parts).toHaveLength(2);
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('add_part_to_task', { taskId, partName: 'Test Part' });
    expect(result).toContain('Test Part');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('set_task_steps', () => {

  it('saves steps array to task', async () => {
    const steps = ['Remove wheel', 'Unbolt drum', 'Install new drum', 'Torque to 85 ft-lbs'];
    await executeToolCall('set_task_steps', { taskId, steps });
    expect(store().tasks[taskId].steps).toEqual(steps);
  });

  it('saves optional guide text to task', async () => {
    await executeToolCall('set_task_steps', {
      taskId,
      steps: ['Step 1'],
      guide: 'Technical overview for CJ8 drum brakes',
    });
    expect(store().tasks[taskId].guide).toBe('Technical overview for CJ8 drum brakes');
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('set_task_steps', { taskId, steps: ['Step 1'] });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('set_task_dependency', () => {

  it('creates a dependency record', async () => {
    const phase2 = store().addPhase({ name: 'Phase 2', subtitle: '', systemIds: [], order: 1, color: '#000' });
    const taskB = store().addTask({ name: 'Task B', systemId: 'engine', phaseId: phase2.id, priority: 'medium', addedBy: 'agent' });
    await executeToolCall('set_task_dependency', {
      taskId: taskB.id,
      dependsOnTaskId: taskId,
      reason: 'Must fix leak before tune',
    });
    expect(store().taskDependencies).toHaveLength(1);
    expect(store().taskDependencies[0].taskId).toBe(taskB.id);
    expect(store().taskDependencies[0].dependsOnTaskId).toBe(taskId);
  });

  it('returns confirmation string', async () => {
    const phase2 = store().addPhase({ name: 'Phase 2', subtitle: '', systemIds: [], order: 1, color: '#000' });
    const taskB = store().addTask({ name: 'Task B', systemId: 'engine', phaseId: phase2.id, priority: 'medium', addedBy: 'agent' });
    const result = await executeToolCall('set_task_dependency', {
      taskId: taskB.id, dependsOnTaskId: taskId, reason: 'test',
    });
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('flag_gap', () => {

  it('creates a gap in the store', async () => {
    await executeToolCall('flag_gap', {
      systemId: 'engine',
      description: 'No oil cooler task found',
      severity: 'warning',
    });
    expect(store().gaps).toHaveLength(1);
    expect(store().gaps[0].description).toBe('No oil cooler task found');
    expect(store().gaps[0].severity).toBe('warning');
    expect(store().gaps[0].dismissed).toBe(false);
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
    expect(result).toContain('Decision recorded');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('set_car_fact', () => {

  it('creates new car fact', async () => {
    await executeToolCall('set_car_fact', {
      key: 'engine_condition', value: 'runs but smokes', confirmedBy: 'user',
    });
    expect(store().carFacts).toHaveLength(1);
    expect(store().carFacts[0].key).toBe('engine_condition');
    expect(store().carFacts[0].value).toBe('runs but smokes');
  });

  it('updates existing car fact with same key', async () => {
    await executeToolCall('set_car_fact', { key: 'mileage', value: '180k', confirmedBy: 'user' });
    await executeToolCall('set_car_fact', { key: 'mileage', value: '182k', confirmedBy: 'agent' });
    expect(store().carFacts).toHaveLength(1);
    expect(store().carFacts[0].value).toBe('182k');
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('set_car_fact', {
      key: 'goals', value: 'offroad daily driver', confirmedBy: 'user',
    });
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('add_research_note', () => {

  it('creates a research note', async () => {
    await executeToolCall('add_research_note', {
      topic: 'AMC 258 head gasket',
      finding: 'Fails at high mileage. Use Felpro replacement.',
      source: 'jeepforum.com',
    });
    expect(store().researchNotes).toHaveLength(1);
    expect(store().researchNotes[0].topic).toBe('AMC 258 head gasket');
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('add_research_note', {
      topic: 'Test', finding: 'Test finding',
    });
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('remove_task', () => {

  it('removes task from store', async () => {
    expect(store().tasks[taskId]).toBeDefined();
    await executeToolCall('remove_task', { taskId });
    expect(store().tasks[taskId]).toBeUndefined();
  });

  it('removes taskId from phase', async () => {
    await executeToolCall('remove_task', { taskId });
    const phase = store().phases.find((p) => p.id === phaseId)!;
    expect(phase.taskIds).not.toContain(taskId);
  });

  it('returns confirmation string', async () => {
    const result = await executeToolCall('remove_task', { taskId });
    expect(typeof result).toBe('string');
  });

  it('handles unknown task gracefully', async () => {
    const result = await executeToolCall('remove_task', { taskId: 'nonexistent' });
    expect(typeof result).toBe('string');
    expect(() => result).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('move_task', () => {

  it('moves task to new phase', async () => {
    const phase2 = store().addPhase({ name: 'Phase 2', subtitle: '', systemIds: [], order: 1, color: '#000' });
    await executeToolCall('move_task', { taskId, newPhaseId: phase2.id });
    expect(store().tasks[taskId].phaseId).toBe(phase2.id);
    expect(store().phases.find((p) => p.id === phase2.id)!.taskIds).toContain(taskId);
    expect(store().phases.find((p) => p.id === phaseId)!.taskIds).not.toContain(taskId);
  });

  it('returns confirmation string', async () => {
    const phase2 = store().addPhase({ name: 'Phase 2', subtitle: '', systemIds: [], order: 1, color: '#000' });
    const result = await executeToolCall('move_task', { taskId, newPhaseId: phase2.id });
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('get_full_plan', () => {

  it('returns a string containing phase names', async () => {
    const result = await executeToolCall('get_full_plan', {});
    expect(result).toContain('Test Phase');
  });

  it('returns a string containing task names', async () => {
    const result = await executeToolCall('get_full_plan', {});
    expect(result).toContain('Test Task');
  });

  it('returns string mentioning task status', async () => {
    const result = await executeToolCall('get_full_plan', {});
    expect(result).toContain('todo');
  });

  it('returns empty plan message when no phases', async () => {
    store().resetAll();
    const result = await executeToolCall('get_full_plan', {});
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('search_web', () => {

  it('calls /api/search with correct query parameter', async () => {
    await executeToolCall('search_web', { query: 'AMC 258 head gasket torque specs' });
    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const searchCall = fetchCalls.find((call) =>
      (call[0] as string).includes('/api/search')
    );
    expect(searchCall).toBeDefined();
    // encodeURIComponent uses %20 for spaces (not +)
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
    expect(typeof result).toBe('string');
  });

  it('handles HTTP error response gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('', { status: 500 })
    );
    const result = await executeToolCall('search_web', { query: 'test' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
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
