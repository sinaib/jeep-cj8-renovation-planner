// ─── Seed Store from Plan Data ───────────────────────────────────────────────
// Converts the Claude-Code-maintained plan.ts / decisions.ts data into the
// format expected by useRenovationStore. Called once on first load when the
// store has no phases (empty localStorage or fresh install).

import { nanoid } from 'nanoid';
import { phases as planPhases, tasks as planTasks } from './plan';
import { decisions as planDecisions } from './decisions';
import type { Phase, Task, Decision, TaskDependency } from '../types';

function mapStatus(s: string): Task['status'] {
  if (s === 'in-progress') return 'active';
  if (s === 'blocked') return 'todo';      // dependency system handles blocking
  if (s === 'done') return 'done';
  if (s === 'skipped') return 'skipped';
  return 'todo';
}

export function buildSeedData(): {
  phases: Phase[];
  tasks: Record<string, Task>;
  taskDependencies: TaskDependency[];
  decisions: Decision[];
} {
  const phases: Phase[] = planPhases.map((pp) => {
    // Collect unique systemIds from all tasks in this phase
    const systemIds = [...new Set(
      pp.taskIds.map((id) => planTasks[id]?.systemId).filter(Boolean) as string[]
    )];

    return {
      id: pp.id,
      order: pp.order,
      name: pp.name,
      subtitle: pp.description,
      systemIds,
      color: pp.color,
      taskIds: pp.taskIds,
    };
  });

  const tasks: Record<string, Task> = {};
  const taskDependencies: TaskDependency[] = [];

  Object.values(planTasks).forEach((pt, idx) => {
    // Find phase order (index in the phase's taskIds array)
    const phase = planPhases.find((p) => p.id === pt.phaseId);
    const phaseOrder = phase ? phase.taskIds.indexOf(pt.id) : idx;

    // Convert parts
    const parts = pt.parts.map((pp) => ({
      id: nanoid(6),
      name: pp.name,
      estimatedCostILS: pp.status === 'on-hand' ? 0 : pp.estimatedCostILS,
      partNumber: undefined as string | undefined,
      supplier: pp.source,
      purchased: pp.status === 'on-hand' || pp.status === 'installed',
      url: undefined as string | undefined,
      addedBy: 'agent' as const,
    }));

    // Calculate cost: if all parts are on-hand, cost is 0
    const allOnHand = pt.parts.length > 0 && pt.parts.every((p) => p.status === 'on-hand');

    tasks[pt.id] = {
      id: pt.id,
      name: pt.name,
      systemId: pt.systemId,
      phaseId: pt.phaseId,
      phaseOrder,
      status: mapStatus(pt.status),
      priority: pt.priority,
      estimatedCostILS: allOnHand ? 0 : pt.estimatedCostILS,
      parts,
      notes: pt.notes ?? '',
      manualRefs: [],
      addedBy: 'agent',
      agentRationale: undefined,
      completedAt: pt.completedAt,
      dependsOnTaskIds: pt.dependsOn ?? [],
      steps: pt.steps?.length ? pt.steps : undefined,
      guide: pt.guideRef,
    };

    // Build explicit dependency entries
    for (const depId of (pt.dependsOn ?? [])) {
      taskDependencies.push({
        taskId: pt.id,
        dependsOnTaskId: depId,
        reason: 'required sequence',
      });
    }
  });

  // Map DecisionEntry category → store Decision category
  const catMap: Record<string, Decision['category']> = {
    'build-direction': 'scope',
    'part-selection':  'other',
    'deferred':        'other',
    'approach':        'approach',
    'budget':          'budget',
  };

  // Convert DecisionEntry → Decision (store format)
  const decisions: Decision[] = planDecisions.map((d) => ({
    id: d.id,
    category: catMap[d.category] ?? 'other',
    summary: d.title,
    rationale: d.rationale,
    madeAt: new Date(d.date).toISOString(),
    madeBy: 'user' as const,
  }));

  return { phases, tasks, taskDependencies, decisions };
}
