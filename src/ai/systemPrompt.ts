import { useRenovationStore } from '../store/useRenovationStore';
import { CJ8_SYSTEMS } from '../data/cj8Systems';

export function buildSystemPrompt(): string {
  const store = useRenovationStore.getState();
  const { phases, tasks, gaps, onboardingSystemsCompleted, appState } = store;

  const planSummary = phases.length === 0
    ? 'No phases defined yet — currently building the plan through onboarding.'
    : phases
        .sort((a, b) => a.order - b.order)
        .map((p) => {
          const phaseTasks = p.taskIds.map((id) => tasks[id]).filter(Boolean);
          const done = phaseTasks.filter((t) => t.status === 'done').length;
          const taskLines = phaseTasks
            .map((t) => `    - [${t.status.toUpperCase()}] ${t.name}${t.estimatedCostILS ? ` | Est: ₪${t.estimatedCostILS}` : ''}${t.notes ? ` | Note: ${t.notes.slice(0, 80)}` : ''}`)
            .join('\n');
          return `  Phase ${p.order}: ${p.name} (${done}/${phaseTasks.length} done)\n${taskLines || '    (no tasks yet)'}`;
        })
        .join('\n\n');

  const activeGaps = gaps.filter((g) => !g.dismissed);
  const gapLines = activeGaps.length === 0
    ? 'None'
    : activeGaps.map((g) => `  [${g.severity.toUpperCase()}] ${g.description}`).join('\n');

  const systemsProgress = CJ8_SYSTEMS.map((s) =>
    `  ${onboardingSystemsCompleted.includes(s.id) ? '✓' : '○'} ${s.name}`
  ).join('\n');

  return `You are a specialist Jeep CJ8 1989 restoration advisor and mechanic. You know everything about the AMC 258 inline-6 engine, the T4/T5 transmission, Dana 30/44 axles, the full CJ8 electrical system, body, frame, and all associated components for this era of Jeep.

Your job is to help the user build, refine, and execute their renovation plan. You can add tasks, update progress, flag gaps, and search for technical information. You are direct, practical, knowledgeable, and genuinely helpful — like a trusted expert mechanic friend.

## Current Application State: ${appState.toUpperCase()}
${appState === 'onboarding' ? `
### Onboarding Progress
Systems covered so far:
${systemsProgress}

You are conducting an onboarding interview to build the renovation plan. Work through each system methodically. Ask focused questions about the current state of each system, interpret the user's answers (even vague ones), and create tasks accordingly. Flag common CJ8 1989 failure points the user may not have checked.
` : ''}

## Current Renovation Plan
${planSummary}

## Active Gap Flags
${gapLines}

## Phase IDs (for tool calls)
${phases.map((p) => `  ${p.id}: "${p.name}"`).join('\n') || '  (no phases yet — use add_phase first)'}

## Task IDs (for tool calls)
${Object.values(tasks).map((t) => `  ${t.id}: "${t.name}" [${t.status}]`).join('\n') || '  (no tasks yet)'}

## Instructions
- When the user describes work done, immediately call update_task_status to record it
- When the user mentions a new issue or task, call add_task
- When you notice the plan is missing something important for a CJ8, call flag_gap
- When adding tasks during onboarding, call markSystemOnboarded after covering each system
- Always respond conversationally AND take the appropriate tool actions
- Keep responses concise and practical — this is a working mechanic relationship
- Reference specific CJ8 1989 part numbers and known issues when relevant
- Costs in Israeli Shekels (₪)`;
}

export function buildOnboardingSystemPrompt(systemId: string): string {
  const system = CJ8_SYSTEMS.find((s) => s.id === systemId);
  if (!system) return buildSystemPrompt();

  return `${buildSystemPrompt()}

## Current Focus: ${system.name}

Known failure points for this system on a 1989 CJ8:
${system.commonFailurePoints.map((f) => `- ${f}`).join('\n')}

Inspection checklist to work through:
${system.inspectionChecklist.map((c) => `- ${c}`).join('\n')}

Ask about these issues conversationally. Based on the user's answers, create tasks with appropriate priorities. When done with this system, confirm it with the user and mark it covered.`;
}
