// ─── usePlanData — Central Plan Merge Hook ───────────────────────────────────
// Imports plan.ts directly as an ESM module (Vite HMR watches it).
// When Claude Code edits plan.ts while the app is open, React Refresh
// re-mounts components automatically (~1s). No sync button needed.
//
// The hook merges static plan structure with runtime store delta:
//   { ...planTask, status: taskStatuses[id] ?? task.status ?? 'todo', ... }

import { useMemo } from 'react';
import { phases as planPhases, tasks as planTasks, taskDependencies as planDeps } from '../data/plan';
import { useRenovationStore } from '../store/useRenovationStore';
import type { Task, Phase, TaskDependency, Part } from '../types';
import type { PlanPart } from '../data/plan';

// Stable ID for parts from plan.ts — derived from taskId + part name so it
// never changes across re-renders (unlike nanoid which generates fresh IDs).
function planPartId(taskId: string, partName: string): string {
  return `${taskId}:${partName}`;
}

function planPartToPart(taskId: string, pp: PlanPart): Part {
  return {
    id: planPartId(taskId, pp.name),
    name: pp.name,
    estimatedCostILS: pp.status === 'on-hand' ? 0 : (pp.estimatedCostILS ?? 0),
    supplier: pp.source,
    purchased: pp.status === 'on-hand' || pp.status === 'installed',
    addedBy: 'agent' as const,
  };
}

export function useResolvedTasks(): Record<string, Task> {
  const taskStatuses = useRenovationStore((s) => s.taskStatuses);
  const taskNotes = useRenovationStore((s) => s.taskNotes);
  const taskActualCosts = useRenovationStore((s) => s.taskActualCosts);
  const taskSteps = useRenovationStore((s) => s.taskSteps);
  const taskGuides = useRenovationStore((s) => s.taskGuides);
  const taskExtraParts = useRenovationStore((s) => s.taskExtraParts);
  const purchasedPartIds = useRenovationStore((s) => s.purchasedPartIds);
  const storeOnlyTasks = useRenovationStore((s) => s.storeOnlyTasks);

  return useMemo(() => {
    const purchasedSet = new Set(purchasedPartIds);
    const resolved: Record<string, Task> = {};

    // Merge plan tasks with store delta
    for (const [id, pt] of Object.entries(planTasks)) {
      const phase = planPhases.find((p) => p.id === pt.phaseId);
      const phaseOrder = phase ? phase.taskIds.indexOf(id) : 0;

      const baseParts = pt.parts.map((pp) => {
        const part = planPartToPart(id, pp);
        return purchasedSet.has(part.id) ? { ...part, purchased: true } : part;
      });
      const extraParts = (taskExtraParts[id] ?? []).map((p) =>
        purchasedSet.has(p.id) ? { ...p, purchased: true } : p
      );

      resolved[id] = {
        id,
        name: pt.name,
        systemId: pt.systemId,
        phaseId: pt.phaseId,
        phaseOrder,
        status: taskStatuses[id] ?? pt.status ?? 'todo',
        priority: pt.priority,
        estimatedCostILS: pt.estimatedCostILS,
        actualCostILS: taskActualCosts[id],
        parts: [...baseParts, ...extraParts],
        notes: taskNotes[id] ?? pt.notes ?? '',
        manualRefs: [],
        addedBy: 'agent',
        completedAt: pt.completedAt,
        dependsOnTaskIds: pt.dependsOn ?? [],
        steps: taskSteps[id] ?? pt.steps,
        guide: taskGuides[id] ?? pt.guide,
      };
    }

    // Add agent-created tasks from store
    for (const [id, t] of Object.entries(storeOnlyTasks)) {
      const parts = t.parts.map((p) =>
        purchasedSet.has(p.id) ? { ...p, purchased: true } : p
      );
      resolved[id] = { ...t, parts };
    }

    return resolved;
    // planTasks is a module-level import — not React state. HMR replaces the
    // module and React Refresh re-mounts, so useMemo re-runs automatically.
  }, [taskStatuses, taskNotes, taskActualCosts, taskSteps, taskGuides, taskExtraParts, purchasedPartIds, storeOnlyTasks]);
}

export function useResolvedPhases(): Phase[] {
  const storeOnlyTasks = useRenovationStore((s) => s.storeOnlyTasks);

  return useMemo(() => {
    return planPhases.map((phase) => {
      const extraTaskIds = Object.values(storeOnlyTasks)
        .filter((t) => t.phaseId === phase.id)
        .map((t) => t.id);
      return extraTaskIds.length > 0
        ? { ...phase, taskIds: [...phase.taskIds, ...extraTaskIds] }
        : phase;
    });
  }, [storeOnlyTasks]);
}

export function useTaskDependencies(): TaskDependency[] {
  const storeOnlyTasks = useRenovationStore((s) => s.storeOnlyTasks);

  return useMemo(() => {
    const storeOnlyDeps: TaskDependency[] = Object.values(storeOnlyTasks).flatMap((t) =>
      (t.dependsOnTaskIds ?? []).map((depId) => ({
        taskId: t.id,
        dependsOnTaskId: depId,
        reason: 'required sequence' as const,
      }))
    );
    return [...planDeps, ...storeOnlyDeps];
  }, [storeOnlyTasks]);
}

// Utility: get blocking tasks for a given taskId (non-hook, for use in event handlers)
// Takes the resolved tasks and dependencies so it can be called from components
// that already have these via the hooks.
export function getBlockingTasksFor(
  taskId: string,
  deps: TaskDependency[],
  tasks: Record<string, Task>
): Task[] {
  return deps
    .filter((d) => d.taskId === taskId)
    .map((d) => tasks[d.dependsOnTaskId])
    .filter((t): t is Task => !!t && t.status !== 'done' && t.status !== 'skipped');
}

export function getDependentTasksFor(
  taskId: string,
  deps: TaskDependency[],
  tasks: Record<string, Task>
): Task[] {
  return deps
    .filter((d) => d.dependsOnTaskId === taskId)
    .map((d) => tasks[d.taskId])
    .filter((t): t is Task => !!t);
}
