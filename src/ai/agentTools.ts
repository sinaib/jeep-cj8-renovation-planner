import { useRenovationStore } from '../store/useRenovationStore';
import { phases as planPhases, tasks as planTasks, taskDependencies as planDeps } from '../data/plan';
import {
  getResolvedTasksSnapshot,
  getResolvedPhasesSnapshot,
  getTaskDependenciesSnapshot,
} from './contextSelector';
import type { Priority, TaskStatus } from '../types';

// Tool definitions sent to Claude
export const AGENT_TOOL_DEFINITIONS = [
  // ─── Research tools ─────────────────────────────────────────────────────
  {
    name: 'search_web',
    description: 'Search the web for technical information. Use proactively to research vehicle-specific issues, part numbers, repair procedures, prices, suppliers, forum discussions, and anything else relevant to the restoration. Search in English for best results.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query. Be specific — e.g. "Jeep CJ8 AMC 258 rear main seal replacement" rather than just "oil leak"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_jeepland',
    description: 'Search jeepland.co.il — Israel\'s premier Jeep parts shop (ב. ינוביץ, Tel Aviv). Returns real Israeli-market prices in ₪ including VAT. Use this whenever you need to find a part that may be available locally: brake components, suspension, engine parts, electrical, body hardware, and more. The store carries CJ-era parts and stocks models 77-91. Use before quoting a price estimate so the number reflects actual local availability. Search in English (the product descriptions are bilingual).',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'English keyword search — e.g. "brake master cylinder", "leaf spring", "AMC 258 head gasket", "wheel cylinder". The store uses English for part descriptions.' },
      },
      required: ['query'],
    },
  },

  // ─── Task management ─────────────────────────────────────────────────────
  {
    name: 'add_task',
    description: 'Add a new task to the plan. Tasks added here go to the in-app store until the next Claude Code session integrates them into plan.ts. Be specific and actionable. Include your rationale so the user understands why this task exists.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Clear, specific, actionable task name' },
        systemId: { type: 'string', description: 'Vehicle system: engine, fuel, cooling, transmission, driveshafts, brakes, steering, suspension, electrical, body, frame, interior, or custom string' },
        phaseId: { type: 'string', description: 'Phase ID to add the task to' },
        priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        estimatedCostILS: { type: 'number', description: 'Estimated cost in Israeli Shekels if known' },
        agentRationale: { type: 'string', description: 'Why this specific task is needed for this specific car' },
        dependsOnTaskIds: { type: 'array', items: { type: 'string' }, description: 'Task IDs that must be completed before this one' },
      },
      required: ['name', 'systemId', 'phaseId', 'priority'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task. Use when user reports completing or starting a task.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        status: { type: 'string', enum: ['flagged', 'todo', 'active', 'done', 'skipped'] },
        note: { type: 'string', description: 'Optional note to add when updating status' },
      },
      required: ['taskId', 'status'],
    },
  },
  {
    name: 'add_task_note',
    description: 'Add a note to a task. Use when user shares a discovery, measurement, observation, or useful detail.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['taskId', 'note'],
    },
  },
  {
    name: 'update_task_cost',
    description: 'Set or update the actual cost of a task in ILS.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        costILS: { type: 'number' },
      },
      required: ['taskId', 'costILS'],
    },
  },
  {
    name: 'add_part_to_task',
    description: 'Add a required part or material to a task\'s parts list.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        partName: { type: 'string' },
        estimatedCostILS: { type: 'number' },
        partNumber: { type: 'string' },
      },
      required: ['taskId', 'partName'],
    },
  },
  {
    name: 'set_task_steps',
    description: 'Save a step-by-step how-to guide directly into a task. ALWAYS call this when you explain how to do a task — your explanation should live in the task, not just in chat. Also use it proactively after add_task to give every new task real content immediately.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task to enrich with steps' },
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ordered steps, each a complete sentence specific to the 1989 CJ8 Scrambler. Be specific — mention actual parts, torque specs, CJ8-specific gotchas.',
        },
        guide: { type: 'string', description: 'Optional 1-2 sentence technical overview of what this job involves on the CJ8 specifically' },
      },
      required: ['taskId', 'steps'],
    },
  },

  // ─── Decision recording ──────────────────────────────────────────────────
  {
    name: 'record_decision',
    description: 'Record an important project decision made during this session. Use whenever the user commits to an approach, priority level, budget constraint, scope choice, or any decision that should be remembered.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['priority', 'budget', 'approach', 'scope', 'timeline', 'supplier', 'safety', 'other'],
        },
        summary: { type: 'string', description: 'One-line summary of the decision' },
        rationale: { type: 'string', description: 'Brief reason why this decision was made' },
        madeBy: { type: 'string', enum: ['user', 'agent'] },
      },
      required: ['category', 'summary', 'madeBy'],
    },
  },

  // ─── File annotation ─────────────────────────────────────────────────────
  {
    name: 'annotate_file',
    description: 'Save an observation about a file or photo the user uploaded. Call this after analyzing any image to preserve your findings in the file record — so the user sees your analysis attached to the photo, not just in chat.',
    input_schema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The file ID to annotate' },
        note: { type: 'string', description: 'Your observation — what you see, condition notes, anything technically relevant' },
      },
      required: ['fileId', 'note'],
    },
  },

  // ─── Gap flagging (converts to a task note) ──────────────────────────────
  {
    name: 'flag_gap',
    description: 'Flag a potential gap, missing item, or risk in the renovation plan. This adds a note to a related task (or creates a general advisory note). Use when you notice something important that hasn\'t been addressed.',
    input_schema: {
      type: 'object',
      properties: {
        systemId: { type: 'string' },
        description: { type: 'string', description: 'Clear description of what is missing and why it matters for this car' },
        severity: { type: 'string', enum: ['critical', 'warning', 'suggestion'] },
        relatedTaskId: { type: 'string', description: 'Optional: task ID to attach this gap note to' },
      },
      required: ['systemId', 'description', 'severity'],
    },
  },

  // ─── Plan overview ────────────────────────────────────────────────────────
  {
    name: 'get_full_plan',
    description: 'Get a complete summary of the current renovation plan with all phases, tasks, and their statuses.',
    input_schema: { type: 'object', properties: {} },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────

export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  const store = useRenovationStore.getState();

  switch (toolName) {

    case 'search_web': {
      const query = toolInput.query as string;
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: AbortSignal.timeout(12000) }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as { result: string };
        return data.result || `No results found for "${query}".`;
      } catch {
        return `Search unavailable for "${query}" — drawing on built-in CJ8 knowledge.`;
      }
    }

    case 'search_jeepland': {
      const query = toolInput.query as string;
      try {
        const response = await fetch(
          `/api/jeepland?q=${encodeURIComponent(query)}`,
          { signal: AbortSignal.timeout(15000) }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as { result: string };
        return data.result || `No parts found on jeepland.co.il for "${query}".`;
      } catch {
        return `jeepland.co.il unavailable for "${query}" — try searching manually at https://www.jeepland.co.il/search?q=${encodeURIComponent(query)}`;
      }
    }

    case 'add_task': {
      const task = store.addStoreOnlyTask({
        name: toolInput.name as string,
        systemId: toolInput.systemId as string,
        phaseId: toolInput.phaseId as string,
        priority: toolInput.priority as Priority,
        estimatedCostILS: toolInput.estimatedCostILS as number | undefined,
        agentRationale: toolInput.agentRationale as string | undefined,
        dependsOnTaskIds: (toolInput.dependsOnTaskIds as string[] | undefined) ?? [],
        status: 'todo',
        addedBy: 'agent',
      });
      return `Task added: "${task.name}" (ID: ${task.id}) to phase ${task.phaseId}`;
    }

    case 'update_task_status': {
      const status = toolInput.status as TaskStatus;
      store.setTaskStatus(toolInput.taskId as string, status);
      if (toolInput.note) {
        store.addTaskNote(toolInput.taskId as string, toolInput.note as string);
      }
      if (status === 'done') {
        store.completeTask(toolInput.taskId as string);
      }
      const taskId = toolInput.taskId as string;
      const taskName = planTasks[taskId]?.name ?? store.storeOnlyTasks[taskId]?.name ?? taskId;
      return `Task "${taskName}" status updated to ${status}`;
    }

    case 'add_task_note': {
      const taskId = toolInput.taskId as string;
      store.addTaskNote(taskId, toolInput.note as string);
      const taskName = planTasks[taskId]?.name ?? store.storeOnlyTasks[taskId]?.name ?? taskId;
      return `Note added to task "${taskName}"`;
    }

    case 'update_task_cost': {
      const taskId = toolInput.taskId as string;
      store.updateTaskCost(taskId, toolInput.costILS as number);
      const taskName = planTasks[taskId]?.name ?? store.storeOnlyTasks[taskId]?.name ?? taskId;
      return `Cost updated for "${taskName}": ₪${toolInput.costILS}`;
    }

    case 'add_part_to_task': {
      const taskId = toolInput.taskId as string;
      store.addPartToTask(
        taskId,
        toolInput.partName as string,
        toolInput.estimatedCostILS as number | undefined,
        toolInput.partNumber as string | undefined
      );
      const taskName = planTasks[taskId]?.name ?? store.storeOnlyTasks[taskId]?.name ?? taskId;
      return `Part "${toolInput.partName}" added to task "${taskName}"`;
    }

    case 'set_task_steps': {
      const taskId = toolInput.taskId as string;
      const steps = toolInput.steps as string[];
      const guide = toolInput.guide as string | undefined;
      store.setTaskSteps(taskId, steps);
      if (guide) store.setTaskGuide(taskId, guide);
      const taskName = planTasks[taskId]?.name ?? store.storeOnlyTasks[taskId]?.name ?? taskId;
      return `Steps saved to "${taskName}" (${steps.length} steps${guide ? ', with overview' : ''})`;
    }

    case 'record_decision': {
      const decision = store.recordDecision({
        category: toolInput.category as 'priority' | 'budget' | 'approach' | 'scope' | 'timeline' | 'supplier' | 'safety' | 'other',
        summary: toolInput.summary as string,
        rationale: toolInput.rationale as string | undefined,
        madeBy: toolInput.madeBy as 'user' | 'agent',
      });
      return `Decision recorded: "${decision.summary}"`;
    }

    case 'annotate_file': {
      import('../store/fileStore').then(({ updateFileAnalysis }) => {
        const note = toolInput.note as string;
        updateFileAnalysis(toolInput.fileId as string, note);
        store.updateFileInIndex(toolInput.fileId as string, { analysisNote: note });
      });
      return `File annotated: "${String(toolInput.note).slice(0, 60)}..."`;
    }

    case 'flag_gap': {
      // Repurposed: write as a task note instead of a Gap object
      const desc = toolInput.description as string;
      const severity = toolInput.severity as string;
      const relatedTaskId = toolInput.relatedTaskId as string | undefined;
      const prefix = severity === 'critical' ? '⚠️ CRITICAL GAP' : severity === 'warning' ? '⚠️ WARNING' : '💡 SUGGESTION';
      const note = `${prefix} [${toolInput.systemId}]: ${desc}`;

      if (relatedTaskId) {
        store.addTaskNote(relatedTaskId, note);
        const taskName = planTasks[relatedTaskId]?.name ?? store.storeOnlyTasks[relatedTaskId]?.name ?? relatedTaskId;
        return `Gap flagged (${severity}) and added to task "${taskName}"`;
      }
      // No related task: record as a decision so it's not lost
      store.recordDecision({
        category: 'other',
        summary: `[GAP ${severity.toUpperCase()}] ${desc}`,
        rationale: `System: ${toolInput.systemId}`,
        madeBy: 'agent',
      });
      return `Gap flagged (${severity}): ${desc}`;
    }

    case 'get_full_plan': {
      const tasks = getResolvedTasksSnapshot();
      const phases = getResolvedPhasesSnapshot();
      const taskDependencies = getTaskDependenciesSnapshot();
      const summary = phases
        .sort((a, b) => a.order - b.order)
        .map((p) => {
          const phaseTasks = p.taskIds.map((id) => tasks[id]).filter(Boolean);
          const taskList = phaseTasks
            .map((t) => {
              const deps = taskDependencies
                .filter((d) => d.taskId === t!.id)
                .map((d) => tasks[d.dependsOnTaskId]?.name ?? d.dependsOnTaskId);
              const depStr = deps.length > 0 ? ` [needs: ${deps.join(', ')}]` : '';
              return `  - [${t!.status}] ${t!.name}${t!.estimatedCostILS ? ` (₪${t!.estimatedCostILS})` : ''}${depStr}`;
            })
            .join('\n');
          return `Phase ${p.order}: ${p.name} (${p.subtitle})\n${taskList || '  (no tasks)'}`;
        })
        .join('\n\n');
      return summary || 'No phases defined yet.';
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

// ─── Tool label builder (used by AgentBar to show tool result labels) ─────────

export function makeToolLabel(toolName: string, toolInput: Record<string, unknown>): string {
  switch (toolName) {
    case 'search_web': return `🔍 Web: "${String(toolInput.query).slice(0, 40)}"`;
    case 'search_jeepland': return `🛒 Jeepland: "${String(toolInput.query).slice(0, 40)}"`;
    case 'add_task': {
      const phaseId = toolInput.phaseId as string;
      const phase = planPhases.find((p) => p.id === phaseId);
      return `+ Task: "${toolInput.name}" → ${phase?.name ?? phaseId}`;
    }
    case 'update_task_status': {
      const taskId = toolInput.taskId as string;
      const name = planTasks[taskId]?.name ?? useRenovationStore.getState().storeOnlyTasks[taskId]?.name ?? taskId;
      return `✓ ${name} → ${toolInput.status}`;
    }
    case 'add_task_note': {
      const taskId = toolInput.taskId as string;
      const name = planTasks[taskId]?.name ?? useRenovationStore.getState().storeOnlyTasks[taskId]?.name ?? taskId;
      return `📝 Note → "${name}"`;
    }
    case 'set_task_steps': {
      const taskId = toolInput.taskId as string;
      const name = planTasks[taskId]?.name ?? useRenovationStore.getState().storeOnlyTasks[taskId]?.name ?? taskId;
      const count = (toolInput.steps as string[]).length;
      return `📋 ${count} steps → "${name}"`;
    }
    case 'add_part_to_task': return `🔧 Part: ${toolInput.partName}`;
    case 'record_decision': return `📌 Decision: ${String(toolInput.summary).slice(0, 50)}`;
    case 'annotate_file': return `📸 Photo annotated`;
    case 'flag_gap': return `⚠️ Gap [${toolInput.severity}]: ${String(toolInput.description).slice(0, 50)}`;
    case 'get_full_plan': return `📋 Full plan loaded`;
    default: return toolName;
  }
}
