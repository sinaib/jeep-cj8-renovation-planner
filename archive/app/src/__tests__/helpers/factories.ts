/**
 * Test data factories — build minimal valid objects for every type.
 * Use these in all tests so we don't repeat the same fixture boilerplate.
 * Each factory accepts optional overrides; only required fields are filled
 * by default so tests only declare what they actually care about.
 */
import type {
  Task, Phase, Gap, AgentMessage, Decision,
  CarFact, ResearchNote, TaskDependency,
} from '../../types';

let _counter = 0;
const uid = () => `test-${++_counter}`;

// Reset counter between test files if needed
export function resetFactoryCounter() { _counter = 0; }

// ── Phase ─────────────────────────────────────────────────────────────────────
export function makePhase(overrides: Partial<Phase> = {}): Phase {
  const id = overrides.id ?? `phase-${uid()}`;
  return {
    id,
    order: 0,
    name: 'Test Phase',
    subtitle: 'A test phase',
    systemIds: ['engine'],
    color: '#D4832A',
    taskIds: [],
    ...overrides,
  };
}

// ── Task ──────────────────────────────────────────────────────────────────────
export function makeTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id ?? `task-${uid()}`;
  return {
    id,
    name: 'Test Task',
    systemId: 'engine',
    phaseId: 'phase-1',
    phaseOrder: 0,
    status: 'todo',
    priority: 'medium',
    parts: [],
    notes: '',
    manualRefs: [],
    addedBy: 'agent',
    dependsOnTaskIds: [],
    ...overrides,
  };
}

// ── Gap ───────────────────────────────────────────────────────────────────────
export function makeGap(overrides: Partial<Gap> = {}): Gap {
  return {
    id: `gap-${uid()}`,
    systemId: 'engine',
    description: 'Test gap description',
    severity: 'warning',
    dismissed: false,
    ...overrides,
  };
}

// ── AgentMessage ──────────────────────────────────────────────────────────────
export function makeAgentMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: `msg-${uid()}`,
    role: 'user',
    content: 'Test message content',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ── Decision ──────────────────────────────────────────────────────────────────
export function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: `decision-${uid()}`,
    category: 'approach',
    summary: 'Test decision summary',
    madeBy: 'user',
    madeAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── CarFact ───────────────────────────────────────────────────────────────────
export function makeCarFact(overrides: Partial<CarFact> = {}): CarFact {
  return {
    id: `fact-${uid()}`,
    key: 'engine_condition',
    value: 'runs well',
    confirmedBy: 'user',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── ResearchNote ──────────────────────────────────────────────────────────────
export function makeResearchNote(overrides: Partial<ResearchNote> = {}): ResearchNote {
  return {
    id: `note-${uid()}`,
    topic: 'AMC 258 head gasket',
    finding: 'Known to fail at high mileage on the CJ8',
    source: 'agent knowledge',
    addedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── TaskDependency ────────────────────────────────────────────────────────────
export function makeTaskDependency(overrides: Partial<TaskDependency> = {}): TaskDependency {
  return {
    taskId: 'task-a',
    dependsOnTaskId: 'task-b',
    reason: 'Must fix oil leak before tuning engine',
    ...overrides,
  };
}

// ── Full plan scenario: 2 phases, 4 tasks ─────────────────────────────────────
export function makeFullPlanScenario() {
  const phase1 = makePhase({ id: 'phase-safety', order: 0, name: 'Safety First', taskIds: [] });
  const phase2 = makePhase({ id: 'phase-engine', order: 1, name: 'Engine Work', taskIds: [] });

  const task1 = makeTask({ id: 'task-brakes', name: 'Replace brake drums', phaseId: 'phase-safety', systemId: 'brakes', priority: 'critical', estimatedCostILS: 800 });
  const task2 = makeTask({ id: 'task-tires', name: 'New tires', phaseId: 'phase-safety', systemId: 'suspension', priority: 'high', estimatedCostILS: 2000 });
  const task3 = makeTask({ id: 'task-carburetor', name: 'Rebuild carburetor', phaseId: 'phase-engine', systemId: 'engine', priority: 'high', estimatedCostILS: 600 });
  const task4 = makeTask({ id: 'task-timing', name: 'Set ignition timing', phaseId: 'phase-engine', systemId: 'engine', priority: 'medium', estimatedCostILS: 0 });

  phase1.taskIds = [task1.id, task2.id];
  phase2.taskIds = [task3.id, task4.id];

  return {
    phases: [phase1, phase2],
    tasks: {
      [task1.id]: task1,
      [task2.id]: task2,
      [task3.id]: task3,
      [task4.id]: task4,
    },
  };
}
