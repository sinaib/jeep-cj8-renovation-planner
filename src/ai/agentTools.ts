import { useRenovationStore } from '../store/useRenovationStore';
import type { GapSeverity, Priority, TaskStatus } from '../types';

// Tool definitions sent to Claude
export const AGENT_TOOL_DEFINITIONS = [
  {
    name: 'add_task',
    description: 'Add a new task to a phase in the renovation plan. Use this when the user mentions work that needs to be done or when you identify a missing task.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Clear, specific task name' },
        systemId: { type: 'string', description: 'CJ8 system this task belongs to (engine, fuel, cooling, transmission, driveshafts, brakes, steering, suspension, electrical, body, interior, upgrades)' },
        phaseId: { type: 'string', description: 'Phase ID to add the task to' },
        priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        estimatedCostILS: { type: 'number', description: 'Estimated cost in Israeli Shekels if known' },
        agentRationale: { type: 'string', description: 'Brief explanation of why this task is needed' },
      },
      required: ['name', 'systemId', 'phaseId', 'priority'],
    },
  },
  {
    name: 'add_phase',
    description: 'Create a new phase in the renovation plan.',
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
    description: 'Add a note to a task. Use when user shares a discovery, measurement, or observation.',
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
    description: 'Add a required part to a task\'s parts list.',
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
    name: 'flag_gap',
    description: 'Flag a potential gap or missing item in the renovation plan that the user may not have considered.',
    input_schema: {
      type: 'object',
      properties: {
        systemId: { type: 'string' },
        description: { type: 'string', description: 'Clear description of what might be missing and why it matters' },
        severity: { type: 'string', enum: ['critical', 'warning', 'suggestion'] },
      },
      required: ['systemId', 'description', 'severity'],
    },
  },
  {
    name: 'remove_task',
    description: 'Remove a task from the plan (e.g. user decides to skip or it was added in error).',
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
    description: 'Move a task to a different phase.',
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
    description: 'Get a full summary of the current renovation plan with all phases and tasks.',
    input_schema: { type: 'object', properties: {} },
  },
];

// Execute a tool call and return a result string
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  const store = useRenovationStore.getState();

  switch (toolName) {
    case 'add_task': {
      const task = store.addTask({
        name: toolInput.name as string,
        systemId: toolInput.systemId as string,
        phaseId: toolInput.phaseId as string,
        priority: toolInput.priority as Priority,
        estimatedCostILS: toolInput.estimatedCostILS as number | undefined,
        agentRationale: toolInput.agentRationale as string | undefined,
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
      const { phases, tasks } = store;
      const summary = phases
        .sort((a, b) => a.order - b.order)
        .map((p) => {
          const phaseTasks = p.taskIds.map((id) => tasks[id]).filter(Boolean);
          const taskList = phaseTasks
            .map((t) => `  - [${t.status}] ${t.name}${t.estimatedCostILS ? ` (₪${t.estimatedCostILS})` : ''}`)
            .join('\n');
          return `Phase ${p.order}: ${p.name}\n${taskList || '  (no tasks)'}`;
        })
        .join('\n\n');
      return summary || 'No phases defined yet.';
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
