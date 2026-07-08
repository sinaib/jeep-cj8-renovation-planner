import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Task, AgentMessage, TaskStatus,
  Decision, FileMeta, Part, TaskDependency,
} from '../types';
import { scheduleBackgroundAnalysis, triggerTaskCompletedAnalysis } from '../ai/agentBackground';
import { logChange } from './changelog';

// ─── Dual-write storage: localStorage (instant) + disk file (persistent) ─────
// On load: reads from disk file first, falls back to localStorage.
// On save: writes to localStorage synchronously, fires disk write async.
const fileBackedStorage: StateStorage = {
  getItem: (name: string): Promise<string | null> => {
    return fetch('/api/project')
      .then((res) => res.ok ? res.text() : localStorage.getItem(name))
      .catch(() => localStorage.getItem(name));
  },
  setItem: (name: string, value: string): void => {
    localStorage.setItem(name, value);
    fetch('/api/project', {
      method: 'POST',
      body: value,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};

// ─── State ────────────────────────────────────────────────────────────────────
// Store persists ONLY the runtime delta. Plan structure (phases, tasks,
// dependencies) lives in plan.ts and is read via usePlanData hook.

interface RenovationState {
  // Runtime delta — overlaid on top of plan.ts at render time
  taskStatuses: Record<string, TaskStatus>;   // taskId → overridden status
  taskNotes: Record<string, string>;          // taskId → notes
  taskActualCosts: Record<string, number>;    // taskId → actual cost ILS
  taskSteps: Record<string, string[]>;        // taskId → steps (overrides plan.ts)
  taskGuides: Record<string, string>;         // taskId → guide (overrides plan.ts)
  taskExtraParts: Record<string, Part[]>;     // taskId → extra parts (agent/user added)
  purchasedPartIds: string[];                 // stable part IDs marked purchased

  // Tasks added via in-app agent (not yet integrated into plan.ts)
  storeOnlyTasks: Record<string, Task>;

  // Runtime state (persisted)
  decisions: Decision[];
  fileIndex: FileMeta[];
  agentHistory: AgentMessage[];

  // UI state (not persisted)
  agentStreaming: boolean;
  activeTaskId: string | null;
  activePhaseId: string | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface RenovationActions {
  // Task delta
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  completeTask: (taskId: string, actualCostILS?: number) => void;
  addTaskNote: (taskId: string, note: string) => void;
  updateTaskCost: (taskId: string, costILS: number) => void;
  setTaskSteps: (taskId: string, steps: string[]) => void;
  setTaskGuide: (taskId: string, guide: string) => void;

  // Parts
  addPartToTask: (taskId: string, partName: string, estimatedCostILS?: number, partNumber?: string, url?: string, addedBy?: 'agent' | 'user') => void;
  markPartPurchased: (partId: string) => void;

  // storeOnly tasks (added by in-app agent)
  addStoreOnlyTask: (taskData: Omit<Task, 'id' | 'parts' | 'notes' | 'manualRefs' | 'phaseOrder'>) => Task;
  updateStoreOnlyTask: (taskId: string, updates: Partial<Task>) => void;

  // Decisions
  recordDecision: (decision: Omit<Decision, 'id' | 'madeAt'>) => Decision;

  // File index
  addFileToIndex: (meta: FileMeta) => void;
  removeFileFromIndex: (id: string) => void;
  updateFileInIndex: (id: string, updates: Partial<FileMeta>) => void;
  getFilesForTask: (taskId: string) => FileMeta[];

  // Agent
  addAgentMessage: (message: Omit<AgentMessage, 'id' | 'timestamp'>) => void;
  setAgentStreaming: (streaming: boolean) => void;
  updateLastAgentMessage: (content: string, toolCalls?: AgentMessage['toolCalls']) => void;
  compressAgentHistory: (summaryContent: string, idsToReplace: string[]) => void;

  // UI
  setActiveTask: (taskId: string | null) => void;
  setActivePhase: (phaseId: string | null) => void;

  // Persistence
  exportProgress: () => string;
  importProgress: (json: string) => void;
  resetAll: () => void;
}

type RenovationStore = RenovationState & RenovationActions;

const initialState: RenovationState = {
  taskStatuses: {},
  taskNotes: {},
  taskActualCosts: {},
  taskSteps: {},
  taskGuides: {},
  taskExtraParts: {},
  purchasedPartIds: [],
  storeOnlyTasks: {},
  decisions: [],
  fileIndex: [],
  agentHistory: [],
  agentStreaming: false,
  activeTaskId: null,
  activePhaseId: null,
};

export const useRenovationStore = create<RenovationStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ─── Task delta ───────────────────────────────────────────────────

      setTaskStatus: (taskId, status) => {
        const prev = get().taskStatuses[taskId] ?? 'todo';
        set((s) => ({ taskStatuses: { ...s.taskStatuses, [taskId]: status } }));
        logChange({
          type: 'task_status',
          summary: `Task ${taskId}: ${prev} → ${status}`,
          taskId,
          prev,
          next: status,
        });
      },

      completeTask: (taskId, actualCostILS) => {
        const prev = get().taskStatuses[taskId] ?? 'todo';
        set((s) => ({
          taskStatuses: { ...s.taskStatuses, [taskId]: 'done' },
          ...(actualCostILS !== undefined
            ? { taskActualCosts: { ...s.taskActualCosts, [taskId]: actualCostILS } }
            : {}),
        }));
        logChange({
          type: 'task_completed',
          summary: `Completed task ${taskId}`,
          taskId,
          ...(actualCostILS !== undefined ? { actualCostILS } : {}),
        });
        scheduleBackgroundAnalysis();
        triggerTaskCompletedAnalysis(taskId, taskId);
      },

      addTaskNote: (taskId, note) => {
        set((s) => {
          const existing = s.taskNotes[taskId] ?? '';
          const newNote = existing
            ? `${existing}\n\n[${new Date().toLocaleDateString()}] ${note}`
            : `[${new Date().toLocaleDateString()}] ${note}`;
          return { taskNotes: { ...s.taskNotes, [taskId]: newNote } };
        });
        logChange({ type: 'note_added', summary: `Note on ${taskId}: ${note.slice(0, 80)}`, taskId });
      },

      updateTaskCost: (taskId, costILS) => {
        set((s) => ({ taskActualCosts: { ...s.taskActualCosts, [taskId]: costILS } }));
        logChange({ type: 'cost_updated', summary: `Cost for ${taskId} → ₪${costILS}`, taskId, costILS });
      },

      setTaskSteps: (taskId, steps) => {
        set((s) => ({ taskSteps: { ...s.taskSteps, [taskId]: steps } }));
      },

      setTaskGuide: (taskId, guide) => {
        set((s) => ({ taskGuides: { ...s.taskGuides, [taskId]: guide } }));
      },

      // ─── Parts ───────────────────────────────────────────────────────

      addPartToTask: (taskId, partName, estimatedCostILS, partNumber, url, addedBy = 'agent') => {
        const part: Part = {
          id: nanoid(6),
          name: partName,
          estimatedCostILS,
          partNumber,
          purchased: false,
          url,
          addedBy,
        };
        const storeOnly = get().storeOnlyTasks[taskId];
        if (storeOnly) {
          // For storeOnly tasks: add part directly to the task
          set((s) => ({
            storeOnlyTasks: {
              ...s.storeOnlyTasks,
              [taskId]: { ...storeOnly, parts: [...storeOnly.parts, part] },
            },
          }));
        } else {
          // For plan tasks: add to taskExtraParts
          set((s) => ({
            taskExtraParts: {
              ...s.taskExtraParts,
              [taskId]: [...(s.taskExtraParts[taskId] ?? []), part],
            },
          }));
        }
      },

      markPartPurchased: (partId) => {
        // For plan parts: add to purchasedPartIds (overlay in useResolvedTasks)
        // For storeOnly parts: also add to purchasedPartIds — hook checks it universally
        set((s) => ({
          purchasedPartIds: s.purchasedPartIds.includes(partId)
            ? s.purchasedPartIds
            : [...s.purchasedPartIds, partId],
        }));
      },

      // ─── storeOnly tasks ──────────────────────────────────────────────

      addStoreOnlyTask: (taskData) => {
        const task: Task = {
          id: `task-${nanoid(8)}`,
          parts: [],
          notes: '',
          manualRefs: [],
          phaseOrder: 999,
          dependsOnTaskIds: [],
          ...taskData,
        };
        set((s) => ({ storeOnlyTasks: { ...s.storeOnlyTasks, [task.id]: task } }));
        logChange({
          type: 'task_added',
          summary: `Added '${task.name}' via in-app agent`,
          taskId: task.id,
          addedBy: task.addedBy,
        });
        scheduleBackgroundAnalysis();
        return task;
      },

      updateStoreOnlyTask: (taskId, updates) => {
        set((s) => {
          const existing = s.storeOnlyTasks[taskId];
          if (!existing) return s;
          return {
            storeOnlyTasks: {
              ...s.storeOnlyTasks,
              [taskId]: { ...existing, ...updates },
            },
          };
        });
      },

      // ─── Decisions ────────────────────────────────────────────────────

      recordDecision: (decisionData) => {
        const decision: Decision = {
          id: nanoid(8),
          madeAt: new Date().toISOString(),
          ...decisionData,
        };
        set((s) => ({ decisions: [...s.decisions, decision] }));
        logChange({
          type: 'decision',
          summary: `Decision [${decision.category}]: ${decision.summary}`,
          decisionId: decision.id,
          category: decision.category,
        });
        return decision;
      },

      // ─── File index ───────────────────────────────────────────────────

      addFileToIndex: (meta) =>
        set((s) => ({ fileIndex: [...s.fileIndex, meta] })),

      removeFileFromIndex: (id) =>
        set((s) => ({ fileIndex: s.fileIndex.filter((f) => f.id !== id) })),

      updateFileInIndex: (id, updates) =>
        set((s) => ({
          fileIndex: s.fileIndex.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        })),

      getFilesForTask: (taskId) =>
        get().fileIndex.filter((f) => f.taskId === taskId),

      // ─── Agent ───────────────────────────────────────────────────────

      addAgentMessage: (message) => {
        const full: AgentMessage = { id: nanoid(8), timestamp: new Date().toISOString(), ...message };
        set((s) => ({ agentHistory: [...s.agentHistory, full] }));
      },

      setAgentStreaming: (streaming) => set({ agentStreaming: streaming }),

      updateLastAgentMessage: (content, toolCalls) =>
        set((s) => {
          if (s.agentHistory.length === 0) return s;
          const history = [...s.agentHistory];
          history[history.length - 1] = {
            ...history[history.length - 1],
            content,
            ...(toolCalls ? { toolCalls } : {}),
          };
          return { agentHistory: history };
        }),

      compressAgentHistory: (summaryContent, idsToReplace) =>
        set((s) => ({
          agentHistory: [
            {
              id: nanoid(8),
              role: 'assistant' as const,
              content: summaryContent,
              timestamp: new Date().toISOString(),
            },
            ...s.agentHistory.filter((m) => !idsToReplace.includes(m.id)),
          ],
        })),

      // ─── UI ──────────────────────────────────────────────────────────

      setActiveTask: (taskId) => set({ activeTaskId: taskId }),
      setActivePhase: (phaseId) => set({ activePhaseId: phaseId }),

      // ─── Persistence ─────────────────────────────────────────────────

      exportProgress: () => {
        const s = get();
        return JSON.stringify({
          taskStatuses: s.taskStatuses,
          taskNotes: s.taskNotes,
          taskActualCosts: s.taskActualCosts,
          taskSteps: s.taskSteps,
          taskGuides: s.taskGuides,
          taskExtraParts: s.taskExtraParts,
          purchasedPartIds: s.purchasedPartIds,
          storeOnlyTasks: s.storeOnlyTasks,
          decisions: s.decisions,
          agentHistory: s.agentHistory,
        }, null, 2);
      },

      importProgress: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            taskStatuses: data.taskStatuses ?? {},
            taskNotes: data.taskNotes ?? {},
            taskActualCosts: data.taskActualCosts ?? {},
            taskSteps: data.taskSteps ?? {},
            taskGuides: data.taskGuides ?? {},
            taskExtraParts: data.taskExtraParts ?? {},
            purchasedPartIds: data.purchasedPartIds ?? [],
            storeOnlyTasks: data.storeOnlyTasks ?? {},
            decisions: data.decisions ?? [],
            agentHistory: data.agentHistory ?? [],
          });
        } catch (e) {
          console.error('Failed to import progress', e);
        }
      },

      resetAll: () => set({ ...initialState }),
    }),
    {
      name: 'jeep-renovation-planner',
      version: 3,
      storage: createJSONStorage(() => fileBackedStorage),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 3) {
          // Rescue runtime delta from old v1/v2 store that had full tasks/phases
          const old = persistedState as {
            tasks?: Record<string, { status?: string; notes?: string; actualCostILS?: number }>;
            agentHistory?: AgentMessage[];
            decisions?: Decision[];
          };
          const taskStatuses: Record<string, TaskStatus> = {};
          const taskNotes: Record<string, string> = {};
          const taskActualCosts: Record<string, number> = {};
          if (old.tasks) {
            for (const [id, t] of Object.entries(old.tasks)) {
              if (t.status && t.status !== 'todo') taskStatuses[id] = t.status as TaskStatus;
              if (t.notes) taskNotes[id] = t.notes;
              if (t.actualCostILS) taskActualCosts[id] = t.actualCostILS;
            }
          }
          return {
            taskStatuses,
            taskNotes,
            taskActualCosts,
            taskSteps: {},
            taskGuides: {},
            taskExtraParts: {},
            purchasedPartIds: [],
            storeOnlyTasks: {},
            decisions: old.decisions ?? [],
            agentHistory: old.agentHistory ?? [],
            fileIndex: [],
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        taskStatuses: state.taskStatuses,
        taskNotes: state.taskNotes,
        taskActualCosts: state.taskActualCosts,
        taskSteps: state.taskSteps,
        taskGuides: state.taskGuides,
        taskExtraParts: state.taskExtraParts,
        purchasedPartIds: state.purchasedPartIds,
        storeOnlyTasks: state.storeOnlyTasks,
        decisions: state.decisions,
        agentHistory: state.agentHistory,
        fileIndex: state.fileIndex,
      }),
    }
  )
);
