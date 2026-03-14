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
 * Car facts, recent decisions, and active gaps are always included
 * (they're small and always relevant).
 *
 * Research notes are included only when they match the query topic
 * or the focused task.
 *
 * This typically reduces dynamic context by 50–80% vs. sending the
 * full plan on every request.
 */

import { useRenovationStore } from '../store/useRenovationStore';
import type { Phase, Task, TaskDependency } from '../types';

// ─── System keyword map ────────────────────────────────────────────────────────
// Maps logical system names → keywords that might appear in a query.
// Used to detect which vehicle systems a query is about.

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

/**
 * Build the dynamic part of the system prompt, selecting only what's
 * relevant to this specific query.
 *
 * @param query       The user's message text
 * @param opts.taskId If the user is viewing a specific task
 * @param opts.phaseId If the user is viewing a specific phase
 */
export function buildDynamicContext(
  query: string,
  opts?: { taskId?: string; phaseId?: string },
): string {
  const store = useRenovationStore.getState();
  const { phases, tasks, gaps, appState, decisions, carFacts, researchNotes, taskDependencies } = store;

  const q = query.toLowerCase();
  const relevantSystems = detectRelevantSystems(query);
  const isCostQuery = /cost|budget|price|₪|money|spend|expensive|cheap|afford/.test(q);

  // ── Car profile (always — small, always relevant) ────────────────────────
  const carProfile = carFacts.length === 0
    ? '  No facts recorded yet.'
    : carFacts
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((f) => `  ${f.key}: ${f.value} [by: ${f.confirmedBy}]`)
        .join('\n');

  // ── Recent decisions (last 5, always) ────────────────────────────────────
  const recentDecisions = decisions.length === 0
    ? '  None recorded.'
    : decisions
        .slice(-5)
        .map((d) => `  [${d.category.toUpperCase()}] ${d.summary}${d.rationale ? ` — ${d.rationale}` : ''}`)
        .join('\n');

  // ── Research notes (only if relevant to query or focused task) ───────────
  const relevantNotes = researchNotes.filter((n) => {
    if (opts?.taskId && n.relevantTaskIds?.includes(opts.taskId)) return true;
    if (relevantSystems.some((s) => n.topic.toLowerCase().includes(s))) return true;
    return false;
  }).slice(-6);
  const notesSection = relevantNotes.length > 0
    ? `\n## RELEVANT RESEARCH\n${relevantNotes.map((n) =>
        `  [${n.topic}] ${n.finding}${n.source ? ` (${n.source})` : ''}`
      ).join('\n')}\n`
    : '';

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

  // ── Active gaps (always — important for awareness) ────────────────────────
  const activeGaps = gaps.filter((g) => !g.dismissed);
  const gapLines = activeGaps.length === 0
    ? '  None'
    : activeGaps.map((g) => `  [${g.severity.toUpperCase()}] ${g.description}`).join('\n');

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

  return `## APP STATE: ${appState.toUpperCase()}

## CAR PROFILE
${carProfile}

## RECENT DECISIONS
${recentDecisions}
${notesSection}
## PLAN
${planSection}

## ACTIVE GAPS
${gapLines}

## PHASE & TASK IDs (for tool calls)
Phases:
${phaseIds}
Tasks:
${taskIdLines}${taskIdExtra}`;
}

// ─── Plan section builders ─────────────────────────────────────────────────────

/** Full detail for a specific task + compressed sibling view. */
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
    ? `\n  STEPS:\n${task.steps.map((s, i) => `    ${i + 1}. ${s}`).join('\n')}`
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
      .map((t) => `  [${t.id}] [${t.status}] ${t.name}`);
    if (siblings.length > 0) {
      result += `\n\nSIBLING TASKS IN ${phase.name.toUpperCase()}:\n${siblings.join('\n')}`;
    }
  }

  return result;
}

/** Full task list for a specific phase with dependencies. */
function buildPhaseContext(
  phase: Phase,
  tasks: Record<string, Task>,
  taskDependencies: TaskDependency[],
): string {
  const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
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

/** Compressed plan: names + statuses + priorities only, no notes/steps/parts. */
function buildCompressedPlan(
  phases: Phase[],
  tasks: Record<string, Task>,
): string {
  if (phases.length === 0) return '  No phases defined yet.';
  return phases
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const phaseTasks = p.taskIds.map((id) => tasks[id]).filter(Boolean);
      const done = phaseTasks.filter((t) => t.status === 'done').length;
      const active = phaseTasks.filter((t) => t.status === 'active').length;
      const lines = phaseTasks.map((t) =>
        `    [${t.id}] [${t.status}] ${t.name} (${t.priority})${t.estimatedCostILS ? ` ₪${t.estimatedCostILS}` : ''}`
      );
      return `  Phase ${p.order}: ${p.name} (${done}/${phaseTasks.length} done${active > 0 ? `, ${active} active` : ''})\n${lines.join('\n') || '    (no tasks)'}`;
    })
    .join('\n\n');
}

/** Cost-focused summary: totals per phase with individual task costs. */
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
      const pts = p.taskIds.map((id) => tasks[id]).filter(Boolean);
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
