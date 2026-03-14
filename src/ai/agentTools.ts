import { useRenovationStore } from '../store/useRenovationStore';
import type { GapSeverity, Priority, TaskStatus } from '../types';

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
    name: 'add_research_note',
    description: 'Store a research finding that is relevant to this project. Use after web searches or when drawing on specific technical knowledge that should be remembered and referenced later.',
    input_schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Short topic label, e.g. "AMC 258 head gasket failure modes"' },
        finding: { type: 'string', description: 'The actual finding, insight, or data point' },
        source: { type: 'string', description: 'URL, forum name, manual reference, or "agent knowledge"' },
      },
      required: ['topic', 'finding'],
    },
  },

  // ─── Car profile tools ───────────────────────────────────────────────────
  {
    name: 'set_car_fact',
    description: 'Record a fact about this specific car or project. Call this throughout the conversation as you learn things. Keys should be descriptive snake_case strings.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Fact category, e.g.: engine_condition, mileage, history, body_rust, electrical_state, goals, budget, diy_skills, tools_available, location, transmission_type, engine_variant, last_driven, known_issues, usage_intent',
        },
        value: { type: 'string', description: 'The fact value in plain language' },
        confirmedBy: { type: 'string', enum: ['user', 'agent', 'inspection'] },
      },
      required: ['key', 'value', 'confirmedBy'],
    },
  },

  // ─── Decision tools ──────────────────────────────────────────────────────
  {
    name: 'record_decision',
    description: 'Record an important project decision. Use whenever the user commits to an approach, priority level, budget constraint, scope choice, timeline, or any decision that should be remembered and influence future planning.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['priority', 'budget', 'approach', 'scope', 'timeline', 'supplier', 'safety', 'other'],
        },
        summary: { type: 'string', description: 'One-line summary of the decision, e.g. "Prioritize mechanical safety over aesthetics"' },
        rationale: { type: 'string', description: 'Brief reason why this decision was made' },
        madeBy: { type: 'string', enum: ['user', 'agent'] },
      },
      required: ['category', 'summary', 'madeBy'],
    },
  },

  // ─── Plan building tools ─────────────────────────────────────────────────
  {
    name: 'add_phase',
    description: 'Create a new phase in the renovation plan. Phases should reflect logical work groupings based on what this specific car needs — do not follow a predetermined template.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        subtitle: { type: 'string', description: 'One-line description of what this phase covers' },
        systemIds: { type: 'array', items: { type: 'string' }, description: 'Which vehicle systems this phase covers' },
        order: { type: 'number', description: 'Phase order (0 = first)' },
        color: { type: 'string', description: 'Hex color for this phase, e.g. #4A5C3A' },
      },
      required: ['name', 'subtitle', 'systemIds', 'order'],
    },
  },
  {
    name: 'add_task',
    description: 'Add a new task to a phase. Be specific and actionable. Include your rationale so the user understands why this task exists.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Clear, specific, actionable task name' },
        systemId: { type: 'string', description: 'Vehicle system: engine, fuel, cooling, transmission, driveshafts, brakes, steering, suspension, electrical, body, frame, interior, or custom string for novel systems' },
        phaseId: { type: 'string', description: 'Phase ID to add the task to' },
        priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        estimatedCostILS: { type: 'number', description: 'Estimated cost in Israeli Shekels if known' },
        agentRationale: { type: 'string', description: 'Why this specific task is needed for this specific car' },
        dependsOnTaskIds: { type: 'array', items: { type: 'string' }, description: 'Task IDs that must be completed before this one' },
      },
      required: ['name', 'systemId', 'phaseId', 'priority'],
    },
  },

  // ─── Dependency tools ────────────────────────────────────────────────────
  {
    name: 'set_task_dependency',
    description: 'Declare that one task must be completed before another can start. Use this to encode logical ordering — e.g. oil leak must be fixed before engine tuning, frame rust treated before body panels.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task that cannot start yet' },
        dependsOnTaskId: { type: 'string', description: 'The task that must be done first' },
        reason: { type: 'string', description: 'Why this dependency exists (mechanical, logical, practical reason)' },
      },
      required: ['taskId', 'dependsOnTaskId', 'reason'],
    },
  },

  // ─── Progress tracking tools ─────────────────────────────────────────────
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
    description: 'Set or update the estimated cost of a task in ILS.',
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

  // ─── Task content tools ──────────────────────────────────────────────────
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

  // ─── Gap detection ───────────────────────────────────────────────────────
  {
    name: 'flag_gap',
    description: 'Flag a potential gap, missing item, or risk in the renovation plan. Use when you notice something important that hasn\'t been addressed — based on your knowledge of this car model, typical failure patterns, or logical dependencies.',
    input_schema: {
      type: 'object',
      properties: {
        systemId: { type: 'string' },
        description: { type: 'string', description: 'Clear description of what is missing and why it matters for this car' },
        severity: { type: 'string', enum: ['critical', 'warning', 'suggestion'] },
      },
      required: ['systemId', 'description', 'severity'],
    },
  },

  // ─── Plan management ─────────────────────────────────────────────────────
  {
    name: 'remove_task',
    description: 'Remove a task from the plan.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'move_task',
    description: 'Move a task to a different phase (e.g. to reorder based on new understanding of dependencies or priority).',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        newPhaseId: { type: 'string' },
      },
      required: ['taskId', 'newPhaseId'],
    },
  },
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
      // Routes through the Vite server-side proxy (/api/search) to bypass
      // browser CORS restrictions on the DuckDuckGo API. No API key required.
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

    case 'add_research_note': {
      const note = store.addResearchNote({
        topic: toolInput.topic as string,
        finding: toolInput.finding as string,
        source: toolInput.source as string | undefined,
      });
      return `Research note saved: "${note.topic}"`;
    }

    case 'set_car_fact': {
      const fact = store.setCarFact(
        toolInput.key as string,
        toolInput.value as string,
        toolInput.confirmedBy as 'user' | 'agent' | 'inspection'
      );
      return `Car fact recorded: ${fact.key} = "${fact.value}"`;
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

    case 'set_task_dependency': {
      store.addTaskDependency(
        toolInput.taskId as string,
        toolInput.dependsOnTaskId as string,
        toolInput.reason as string
      );
      const task = store.tasks[toolInput.taskId as string];
      const blocker = store.tasks[toolInput.dependsOnTaskId as string];
      return `Dependency set: "${task?.name ?? toolInput.taskId}" requires "${blocker?.name ?? toolInput.dependsOnTaskId}" first — ${toolInput.reason}`;
    }

    case 'add_task': {
      const task = store.addTask({
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

    case 'add_phase': {
      const phase = store.addPhase({
        name: toolInput.name as string,
        subtitle: toolInput.subtitle as string,
        systemIds: toolInput.systemIds as string[],
        order: toolInput.order as number,
        color: (toolInput.color as string) ?? '#4A5C3A',
      });
      return `Phase added: "${phase.name}" (ID: ${phase.id})`;
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
      const task = store.tasks[toolInput.taskId as string];
      return `Task "${task?.name ?? toolInput.taskId}" status updated to ${status}`;
    }

    case 'add_task_note': {
      store.addTaskNote(toolInput.taskId as string, toolInput.note as string);
      const task = store.tasks[toolInput.taskId as string];
      return `Note added to task "${task?.name ?? toolInput.taskId}"`;
    }

    case 'update_task_cost': {
      store.updateTaskCost(toolInput.taskId as string, toolInput.costILS as number);
      const task = store.tasks[toolInput.taskId as string];
      return `Cost updated for "${task?.name ?? toolInput.taskId}": ₪${toolInput.costILS}`;
    }

    case 'add_part_to_task': {
      store.addPartToTask(
        toolInput.taskId as string,
        toolInput.partName as string,
        toolInput.estimatedCostILS as number | undefined,
        toolInput.partNumber as string | undefined
      );
      const task = store.tasks[toolInput.taskId as string];
      return `Part "${toolInput.partName}" added to task "${task?.name ?? toolInput.taskId}"`;
    }

    case 'set_task_steps': {
      const steps = toolInput.steps as string[];
      const guide = toolInput.guide as string | undefined;
      store.updateTask(toolInput.taskId as string, { steps, ...(guide ? { guide } : {}) });
      const task = store.tasks[toolInput.taskId as string];
      return `Steps saved to "${task?.name ?? toolInput.taskId}" (${steps.length} steps${guide ? ', with overview' : ''})`;
    }

    case 'annotate_file': {
      // Import and call fileStore async — fire and forget (tool handler must be sync)
      import('../store/fileStore').then(({ updateFileAnalysis, updateFileCaption }) => {
        const note = toolInput.note as string;
        updateFileAnalysis(toolInput.fileId as string, note);
        // Also update the Zustand file index
        store.updateFileInIndex(toolInput.fileId as string, { analysisNote: note });
      });
      return `File annotated: "${String(toolInput.note).slice(0, 60)}..."`;
    }

    case 'flag_gap': {
      const gap = store.addGap(
        toolInput.systemId as string,
        toolInput.description as string,
        toolInput.severity as GapSeverity
      );
      return `Gap flagged (${gap.severity}): ${gap.description}`;
    }

    case 'remove_task': {
      const task = store.tasks[toolInput.taskId as string];
      const name = task?.name ?? toolInput.taskId;
      store.removeTask(toolInput.taskId as string);
      return `Task "${name}" removed from plan`;
    }

    case 'move_task': {
      const task = store.tasks[toolInput.taskId as string];
      store.moveTask(toolInput.taskId as string, toolInput.newPhaseId as string);
      return `Task "${task?.name}" moved to phase ${toolInput.newPhaseId}`;
    }

    case 'get_full_plan': {
      const { phases, tasks, taskDependencies } = store;
      const summary = phases
        .sort((a, b) => a.order - b.order)
        .map((p) => {
          const phaseTasks = p.taskIds.map((id) => tasks[id]).filter(Boolean);
          const taskList = phaseTasks
            .map((t) => {
              const deps = taskDependencies
                .filter((d) => d.taskId === t.id)
                .map((d) => tasks[d.dependsOnTaskId]?.name ?? d.dependsOnTaskId);
              const depStr = deps.length > 0 ? ` [needs: ${deps.join(', ')}]` : '';
              return `  - [${t.status}] ${t.name}${t.estimatedCostILS ? ` (₪${t.estimatedCostILS})` : ''}${depStr}`;
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
