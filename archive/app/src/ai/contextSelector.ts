/**
 * contextSelector.ts
 *
 * Smart context selection for the AI agent system prompt.
 * Instead of dumping the entire plan into every request, this module
 * analyzes the query and selects only the relevant context:
 *
 *   - Viewing a specific task? → full detail for that task only
 *   - Asking about engine/brakes/etc? → tasks for those systems only
 *   - Cost question? → cost summary, no notes or steps
 *   - General question? → compressed plan (names + statuses, no notes)
 *
 * Build decisions (decisions.ts) and recent runtime decisions are always
 * included — they're small and always relevant.
 *
 * This typically reduces dynamic context by 50–80% vs. sending the
 * full plan on every request.
 */

import { useRenovationStore } from '../store/useRenovationStore';
import { phases as planPhases, tasks as planTasks, taskDependencies as planDeps } from '../data/plan';
import { decisions as buildDecisions } from '../data/decisions';
import { car } from '../data/car';
import type { Phase, Task, TaskDependency, TaskStatus, Part } from '../types';

// ─── Non-hook snapshot merge ──────────────────────────────────────────────────
// Used in non-React contexts (agentTools, agentBackground, contextSelector).

export function getResolvedTasksSnapshot(): Record<string, Task> {
  const store = useRenovationStore.getState();
  const { taskStatuses, taskNotes, taskActualCosts, taskSteps, taskGuides, taskExtraParts, purchasedPartIds, storeOnlyTasks } = store;
  const purchasedSet = new Set(purchasedPartIds);
  const resolved: Record<string, Task> = {};

  for (const [id, pt] of Object.entries(planTasks)) {
    const phase = planPhases.find((p) => p.id === pt.phaseId);
    const phaseOrder = phase ? phase.taskIds.indexOf(id) : 0;
    const baseParts: Part[] = pt.parts.map((pp) => {
      const partId = `${id}:${pp.name}`;
      return {
        id: partId,
        name: pp.name,
        estimatedCostILS: pp.status === 'on-hand' ? 0 : (pp.estimatedCostILS ?? 0),
        supplier: pp.source,
        purchased: purchasedSet.has(partId) || pp.status === 'on-hand' || pp.status === 'installed',
        addedBy: 'agent' as const,
      };
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
      status: (taskStatuses[id] ?? pt.status ?? 'todo') as TaskStatus,
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

  for (const [id, t] of Object.entries(storeOnlyTasks)) {
    resolved[id] = t;
  }

  return resolved;
}

export function getResolvedPhasesSnapshot(): Phase[] {
  const storeOnlyTasks = useRenovationStore.getState().storeOnlyTasks;
  return planPhases.map((phase) => {
    const extraTaskIds = Object.values(storeOnlyTasks)
      .filter((t) => t.phaseId === phase.id)
      .map((t) => t.id);
    return extraTaskIds.length > 0
      ? { ...phase, taskIds: [...phase.taskIds, ...extraTaskIds] }
      : phase;
  });
}

export function getTaskDependenciesSnapshot(): TaskDependency[] {
  const storeOnlyTasks = useRenovationStore.getState().storeOnlyTasks;
  const storeOnlyDeps: TaskDependency[] = Object.values(storeOnlyTasks).flatMap((t) =>
    (t.dependsOnTaskIds ?? []).map((depId) => ({
      taskId: t.id,
      dependsOnTaskId: depId,
      reason: 'required sequence' as const,
    }))
  );
  return [...planDeps, ...storeOnlyDeps];
}

// ─── System keyword map ────────────────────────────────────────────────────────

const SYSTEM_KEYWORDS: Record<string, string[]> = {
  engine:       ['engine', 'motor', 'amc', 'iron duke', '2.5', '4.2', 'carb', 'carburetor',
                  'compression', 'cylinder', 'oil', 'timing', 'valve', 'head gasket', 'piston',
                  'crankshaft', 'camshaft', 'starter', 'ignition', 'spark', 'intake', 'exhaust manifold'],
  brakes:       ['brake', 'braking', 'drum', 'master cylinder', 'wheel cylinder', 'stopping', 'pedal', 'handbrake'],
  suspension:   ['suspension', 'spring', 'leaf spring', 'shock', 'absorber', 'lift', 'ride height',
                  'sway bar', 'anti-roll', 'coil', 'control arm'],
  electrical:   ['electrical', 'wiring', 'wire', 'harness', 'battery', 'alternator', 'switch',
                  'fuse', 'ground', 'volt', 'amp', 'relay', 'circuit', 'light', 'lamp', 'gauges'],
  frame:        ['frame', 'chassis', 'crossmember', 'rail', 'body mount', 'weld', 'rust'],
  body:         ['body', 'tub', 'door', 'paint', 'panel', 'floor', 'firewall', 'windshield', 'roll bar'],
  transmission: ['transmission', 'gearbox', 'clutch', 'gear', 'synchro', 't4', 't5', 'manual', 'shift'],
  transfer:     ['transfer case', 'dana 300', '4wd', '4x4', 'four wheel drive', 'transfer'],
  axle:         ['axle', 'dana 30', 'amc 20', 'differential', 'diff', 'shaft', 'u-joint', 'ujoint',
                  'driveshaft', 'cv joint'],
  cooling:      ['cooling', 'radiator', 'coolant', 'thermostat', 'water pump', 'overheating', 'temperature', 'hose'],
  fuel:         ['fuel', 'gas', 'petrol', 'tank', 'fuel pump', 'fuel line', 'filter'],
  steering:     ['steering', 'steering box', 'tie rod', 'drag link', 'steering wheel', 'power steering',
                  'track bar', 'steering column'],
};

/** Returns system keys whose keywords appear in the query. */
export function detectRelevantSystems(query: string): string[] {
  const q = query.toLowerCase();
  return Object.entries(SYSTEM_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => q.includes(k)))
    .map(([system]) => system);
}

// ─── Main context builder ──────────────────────────────────────────────────────

export function buildDynamicContext(
  query: string,
  opts?: { taskId?: string; phaseId?: string },
): string {
  const tasks = getResolvedTasksSnapshot();
  const phases = getResolvedPhasesSnapshot();
  const taskDependencies = getTaskDependenciesSnapshot();
  const decisions = useRenovationStore.getState().decisions;

  const q = query.toLowerCase();
  const relevantSystems = detectRelevantSystems(query);
  const isCostQuery = /cost|budget|price|₪|money|spend|expensive|cheap|afford/.test(q);

  // ── Car profile (from car.ts — always relevant) ──────────────────────────
  const v = car.vehicle;
  const carProfile = [
    `  ${v.year} ${v.make} ${v.model}`,
    `  Engine: ${v.engine}`,
    `  Transmission: ${v.transmission} | Transfer: ${v.transferCase}`,
    `  Axles: front ${v.frontAxle} / rear ${v.rearAxle}`,
    `  Status: ${car.overallStatus}`,
  ].join('\n');

  // ── Build decisions (strategic, from decisions.ts — always included) ──────
  const buildDecisionLines = buildDecisions
    .slice(-8)
    .map((d) => `  [${d.category.toUpperCase()}] ${d.title} — ${d.decision}`)
    .join('\n') || '  None.';

  // ── Runtime decisions (from store — agent-recorded during session) ────────
  const runtimeDecisionLines = decisions.length === 0
    ? '  None recorded this session.'
    : decisions
        .slice(-5)
        .map((d) => `  [${d.category.toUpperCase()}] ${d.summary}${d.rationale ? ` — ${d.rationale}` : ''}`)
        .join('\n');

  // ── Plan section (smart selection) ───────────────────────────────────────
  let planSection: string;

  if (opts?.taskId && tasks[opts.taskId]) {
    planSection = buildFocusedTaskContext(opts.taskId, tasks, phases, taskDependencies);
  } else if (opts?.phaseId) {
    const phase = phases.find((p) => p.id === opts.phaseId);
    planSection = phase
      ? buildPhaseContext(phase, tasks, taskDependencies)
      : buildCompressedPlan(phases, tasks);
  } else if (relevantSystems.length > 0) {
    const systemTasks = Object.values(tasks).filter((t) =>
      relevantSystems.some(
        (s) =>
          (t.systemId ?? '').includes(s) ||
          (SYSTEM_KEYWORDS[s] ?? []).some((k) => t.name.toLowerCase().includes(k)),
      ),
    );
    if (systemTasks.length > 0) {
      const taskLines = systemTasks.map((t) => {
        const phase = phases.find((p) => p.taskIds.includes(t.id));
        const deps = taskDependencies
          .filter((d) => d.taskId === t.id)
          .map((d) => tasks[d.dependsOnTaskId]?.name)
          .filter(Boolean);
        return `  [${t.id}] [${t.status}] ${t.name} (${t.priority}) | ${phase?.name ?? '?'}${deps.length ? ` ← ${deps.join(', ')}` : ''}`;
      });
      planSection = `TASKS MATCHING (${relevantSystems.join(', ')}):\n${taskLines.join('\n')}\n\n${buildCompressedPlan(phases, tasks)}`;
    } else {
      planSection = buildCompressedPlan(phases, tasks);
    }
  } else if (isCostQuery) {
    planSection = buildCostSummary(phases, tasks);
  } else {
    planSection = buildCompressedPlan(phases, tasks);
  }

  // ── Phase & task IDs (always — needed for tool calls) ─────────────────────
  const phaseIds = phases
    .sort((a, b) => a.order - b.order)
    .map((p) => `  ${p.id}: "${p.name}" (order ${p.order})`)
    .join('\n') || '  (none)';

  const allTasks = Object.values(tasks);
  const taskIdLines = allTasks
    .slice(0, 50)
    .map((t) => `  ${t.id}: "${t.name}" [${t.status}] phase:${t.phaseId}`)
    .join('\n') || '  (none)';
  const taskIdExtra = allTasks.length > 50 ? `\n  ...and ${allTasks.length - 50} more` : '';

  return `## CAR PROFILE
${carProfile}

## BUILD DECISIONS (strategic — set by Claude Code)
${buildDecisionLines}

## RUNTIME DECISIONS (this session)
${runtimeDecisionLines}

## PLAN
${planSection}

## PHASE & TASK IDs (for tool calls)
Phases:
${phaseIds}
Tasks:
${taskIdLines}${taskIdExtra}`;
}

// ─── Plan section builders ─────────────────────────────────────────────────────

function buildFocusedTaskContext(
  taskId: string,
  tasks: Record<string, Task>,
  phases: Phase[],
  taskDependencies: TaskDependency[],
): string {
  const task = tasks[taskId];
  if (!task) return 'Task not found.';

  const deps = taskDependencies
    .filter((d) => d.taskId === task.id)
    .map((d) => `${tasks[d.dependsOnTaskId]?.name ?? d.dependsOnTaskId} (${d.reason})`);
  const blockedBy = deps.length > 0 ? `\n  BLOCKED BY: ${deps.join(', ')}` : '';

  const parts = (task.parts ?? []).length > 0
    ? `\n  PARTS:\n${task.parts.map((p) =>
        `    - ${p.name}${p.estimatedCostILS ? ` ₪${p.estimatedCostILS}` : ''}${p.partNumber ? ` (${p.partNumber})` : ''}${p.purchased ? ' ✓bought' : ''}`
      ).join('\n')}`
    : '';

  const steps = (task.steps ?? []).length > 0
    ? `\n  STEPS:\n${task.steps!.map((s, i) => `    ${i + 1}. ${s}`).join('\n')}`
    : '';

  const notes = task.notes ? `\n  NOTES: ${task.notes.slice(-300)}` : '';
  const phase = phases.find((p) => p.taskIds.includes(task.id));
  const phaseInfo = phase ? `\n  Phase: ${phase.name} — ${phase.subtitle}` : '';

  let result =
    `FOCUSED TASK:\n` +
    `  [${task.id}] ${task.name}\n` +
    `  Status: ${task.status} | Priority: ${task.priority} | Est: ₪${task.estimatedCostILS ?? 0} | Actual: ₪${task.actualCostILS ?? 0}` +
    `${phaseInfo}${blockedBy}${parts}${steps}${notes}`;

  if (phase) {
    const siblings = phase.taskIds
      .filter((id) => id !== task.id)
      .map((id) => tasks[id])
      .filter(Boolean)
      .map((t) => `  [${t!.id}] [${t!.status}] ${t!.name}`);
    if (siblings.length > 0) {
      result += `\n\nSIBLING TASKS IN ${phase.name.toUpperCase()}:\n${siblings.join('\n')}`;
    }
  }

  return result;
}

function buildPhaseContext(
  phase: Phase,
  tasks: Record<string, Task>,
  taskDependencies: TaskDependency[],
): string {
  const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean) as Task[];
  const done = phaseTasks.filter((t) => t.status === 'done').length;

  const lines = phaseTasks.map((t) => {
    const deps = taskDependencies
      .filter((d) => d.taskId === t.id)
      .map((d) => tasks[d.dependsOnTaskId]?.name)
      .filter(Boolean);
    return `  [${t.id}] [${t.status}] ${t.name} (${t.priority})${t.estimatedCostILS ? ` ₪${t.estimatedCostILS}` : ''}${deps.length ? ` ← ${deps.join(', ')}` : ''}`;
  });

  return `PHASE: ${phase.name} — ${phase.subtitle}\n${done}/${phaseTasks.length} done\n\n${lines.join('\n') || '  (no tasks)'}`;
}

function buildCompressedPlan(
  phases: Phase[],
  tasks: Record<string, Task>,
): string {
  if (phases.length === 0) return '  No phases defined yet.';
  return phases
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const phaseTasks = p.taskIds.map((id) => tasks[id]).filter(Boolean) as Task[];
      const done = phaseTasks.filter((t) => t.status === 'done').length;
      const active = phaseTasks.filter((t) => t.status === 'active').length;
      const lines = phaseTasks.map((t) =>
        `    [${t.id}] [${t.status}] ${t.name} (${t.priority})${t.estimatedCostILS ? ` ₪${t.estimatedCostILS}` : ''}`
      );
      return `  Phase ${p.order}: ${p.name} (${done}/${phaseTasks.length} done${active > 0 ? `, ${active} active` : ''})\n${lines.join('\n') || '    (no tasks)'}`;
    })
    .join('\n\n');
}

function buildCostSummary(
  phases: Phase[],
  tasks: Record<string, Task>,
): string {
  const allTasks = Object.values(tasks);
  const totalEst = allTasks.reduce((s, t) => s + (t.estimatedCostILS ?? 0), 0);
  const totalSpent = allTasks.reduce((s, t) => s + (t.actualCostILS ?? 0), 0);

  const phaseLines = phases
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const pts = p.taskIds.map((id) => tasks[id]).filter(Boolean) as Task[];
      const phaseEst = pts.reduce((s, t) => s + (t.estimatedCostILS ?? 0), 0);
      const phaseSpent = pts.reduce((s, t) => s + (t.actualCostILS ?? 0), 0);
      const taskCosts = pts
        .map((t) =>
          `    [${t.id}] ${t.name}: ₪${t.estimatedCostILS ?? 0} est${t.actualCostILS ? ` / ₪${t.actualCostILS} actual` : ''}`
        )
        .join('\n');
      return `  ${p.name}: ₪${phaseEst} est | ₪${phaseSpent} spent\n${taskCosts}`;
    })
    .join('\n\n');

  return `COST SUMMARY: ₪${totalEst} total estimated | ₪${totalSpent} total spent\n\n${phaseLines}`;
}
