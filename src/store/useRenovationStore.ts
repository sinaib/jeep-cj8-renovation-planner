import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Task, Phase, Gap, AgentMessage, TaskStatus, GapSeverity,
  Decision, CarFact, ResearchNote, TaskDependency, FileMeta,
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

interface RenovationState {
  // App flow
  appState: 'onboarding' | 'plan_built' | 'in_progress';
  onboardingSystemsCompleted: string[];

  // Plan data
  phases: Phase[];
  tasks: Record<string, Task>;
  gaps: Gap[];

  // Intelligence layer
  decisions: Decision[];
  carFacts: CarFact[];
  researchNotes: ResearchNote[];
  taskDependencies: TaskDependency[];

  // Files (metadata only — binary lives in IndexedDB via fileStore.ts)
  fileIndex: FileMeta[];

  // Agent
  agentHistory: AgentMessage[];
  agentStreaming: boolean;

  // Active UI state (not persisted)
  activeTaskId: string | null;
  activePhaseId: string | null;
}

interface RenovationActions {
  // Onboarding
  markSystemOnboarded: (systemId: string) => void;
  finishOnboarding: () => void;

  // Phase actions
  addPhase: (phase: Omit<Phase, 'id' | 'taskIds'> & { id?: string }) => Phase;
  updatePhase: (phaseId: string, updates: Partial<Phase>) => void;

  // Task actions
  addTask: (task: Omit<Task, 'id' | 'parts' | 'notes' | 'manualRefs' | 'phaseOrder'>) => Task;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  completeTask: (taskId: string, actualCostILS?: number) => void;
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  addTaskNote: (taskId: string, note: string) => void;
  updateTaskCost: (taskId: string, costILS: number) => void;
  addPartToTask: (taskId: string, partName: string, estimatedCostILS?: number, partNumber?: string) => void;
  markPartPurchased: (taskId: string, partId: string) => void;
  removeTask: (taskId: string) => void;
  moveTask: (taskId: string, newPhaseId: string, newOrder?: number) => void;

  // File index actions
  addFileToIndex: (meta: FileMeta) => void;
  removeFileFromIndex: (id: string) => void;
  updateFileInIndex: (id: string, updates: Partial<FileMeta>) => void;
  getFilesForTask: (taskId: string) => FileMeta[];

  // Gap actions
  addGap: (systemId: string, description: string, severity: GapSeverity) => Gap;
  dismissGap: (gapId: string) => void;
  convertGapToTask: (gapId: string, taskId: string) => void;

  // Intelligence layer
  recordDecision: (decision: Omit<Decision, 'id' | 'madeAt'>) => Decision;
  setCarFact: (key: string, value: string, confirmedBy: CarFact['confirmedBy']) => CarFact;
  addResearchNote: (note: Omit<ResearchNote, 'id' | 'addedAt'>) => ResearchNote;
  addTaskDependency: (taskId: string, dependsOnTaskId: string, reason: string) => void;
  removeTaskDependency: (taskId: string, dependsOnTaskId: string) => void;
  getCarProfile: () => Record<string, string>;
  getBlockingTasks: (taskId: string) => Task[];
  getDependentTasks: (taskId: string) => Task[];

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

  // Computed selectors
  getTasksForPhase: (phaseId: string) => Task[];
  getPhaseCompletionPercent: (phaseId: string) => number;
  getOverallCompletionPercent: () => number;
  getNextTask: () => Task | undefined;
  getTotalCostEstimated: () => number;
  getTotalCostSpent: () => number;
  getActiveGaps: () => Gap[];
}

type RenovationStore = RenovationState & RenovationActions;

const initialState: RenovationState = {
  appState: 'onboarding',
  onboardingSystemsCompleted: [],
  phases: [],
  tasks: {},
  gaps: [],
  decisions: [],
  carFacts: [],
  researchNotes: [],
  taskDependencies: [],
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

      markSystemOnboarded: (systemId) =>
        set((s) => ({
          onboardingSystemsCompleted: s.onboardingSystemsCompleted.includes(systemId)
            ? s.onboardingSystemsCompleted
            : [...s.onboardingSystemsCompleted, systemId],
        })),

      finishOnboarding: () => set({ appState: 'plan_built' }),

      addPhase: (phaseData) => {
        const phase: Phase = {
          id: phaseData.id ?? `phase-${nanoid(6)}`,
          taskIds: [],
          ...phaseData,
        };
        set((s) => ({ phases: [...s.phases, phase] }));
        return phase;
      },

      updatePhase: (phaseId, updates) =>
        set((s) => ({
          phases: s.phases.map((p) => (p.id === phaseId ? { ...p, ...updates } : p)),
        })),

      addTask: (taskData) => {
        const phaseId = taskData.phaseId;
        const state = get();
        const phaseTasks = state.getTasksForPhase(phaseId);
        const task: Task = {
          id: `task-${nanoid(8)}`,
          parts: [],
          notes: '',
          manualRefs: [],
          phaseOrder: phaseTasks.length,
          dependsOnTaskIds: [],
          ...taskData,
        };
        set((s) => {
          const updatedPhases = s.phases.map((p) =>
            p.id === phaseId ? { ...p, taskIds: [...p.taskIds, task.id] } : p
          );
          return {
            tasks: { ...s.tasks, [task.id]: task },
            phases: updatedPhases,
          };
        });
        logChange({
          type: 'task_added',
          summary: `Added '${task.name}'`,
          taskId: task.id,
          addedBy: task.addedBy,
        });
        scheduleBackgroundAnalysis();
        return task;
      },

      updateTask: (taskId, updates) =>
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], ...updates } },
        })),

      completeTask: (taskId, actualCostILS) => {
        const task = get().tasks[taskId];
        set((s) => ({
          tasks: {
            ...s.tasks,
            [taskId]: {
              ...s.tasks[taskId],
              status: 'done',
              completedAt: new Date().toISOString(),
              ...(actualCostILS !== undefined ? { actualCostILS } : {}),
            },
          },
        }));
        logChange({
          type: 'task_completed',
          summary: `Completed '${task?.name ?? taskId}'`,
          taskId,
          ...(actualCostILS !== undefined ? { actualCostILS } : {}),
        });
        scheduleBackgroundAnalysis();
        // Proactive: check what just got unblocked by this completion
        if (task) {
          triggerTaskCompletedAnalysis(taskId, task.name);
        }
      },

      setTaskStatus: (taskId, status) => {
        const task = get().tasks[taskId];
        const prevStatus = task?.status;
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], status } },
        }));
        if (task) {
          logChange({
            type: 'task_status',
            summary: `'${task.name}' ${prevStatus} → ${status}`,
            taskId,
            prev: prevStatus,
            next: status,
          });
        }
      },

      addTaskNote: (taskId, note) => {
        const task = get().tasks[taskId];
        if (!task) return;
        set((s) => {
          const existing = s.tasks[taskId].notes;
          const newNote = existing
            ? `${existing}\n\n[${new Date().toLocaleDateString()}] ${note}`
            : `[${new Date().toLocaleDateString()}] ${note}`;
          return { tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], notes: newNote } } };
        });
        logChange({
          type: 'note_added',
          summary: `Note on '${task.name}': ${note.slice(0, 80)}`,
          taskId,
        });
      },

      updateTaskCost: (taskId, costILS) => {
        const task = get().tasks[taskId];
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], estimatedCostILS: costILS } },
        }));
        logChange({
          type: 'cost_updated',
          summary: `Cost for '${task?.name ?? taskId}' → ₪${costILS}`,
          taskId,
          costILS,
        });
      },

      addPartToTask: (taskId, partName, estimatedCostILS, partNumber) =>
        set((s) => {
          const task = s.tasks[taskId];
          if (!task) return s;
          const part = { id: nanoid(6), name: partName, estimatedCostILS, partNumber, purchased: false };
          return { tasks: { ...s.tasks, [taskId]: { ...task, parts: [...task.parts, part] } } };
        }),

      markPartPurchased: (taskId, partId) =>
        set((s) => {
          const task = s.tasks[taskId];
          if (!task) return s;
          const parts = task.parts.map((p) => (p.id === partId ? { ...p, purchased: true } : p));
          return { tasks: { ...s.tasks, [taskId]: { ...task, parts } } };
        }),

      removeTask: (taskId) => {
        const taskName = get().tasks[taskId]?.name ?? taskId;
        set((s) => {
          const task = s.tasks[taskId];
          if (!task) return s;
          const { [taskId]: _, ...remainingTasks } = s.tasks;
          const updatedPhases = s.phases.map((p) =>
            p.id === task.phaseId ? { ...p, taskIds: p.taskIds.filter((id) => id !== taskId) } : p
          );
          const updatedDeps = s.taskDependencies.filter(
            (d) => d.taskId !== taskId && d.dependsOnTaskId !== taskId
          );
          return { tasks: remainingTasks, phases: updatedPhases, taskDependencies: updatedDeps };
        });
        logChange({ type: 'task_removed', summary: `Removed '${taskName}'`, taskId });
      },

      moveTask: (taskId, newPhaseId, newOrder) =>
        set((s) => {
          const task = s.tasks[taskId];
          if (!task) return s;
          const oldPhaseId = task.phaseId;
          const phaseTasks = Object.values(s.tasks).filter((t) => t.phaseId === newPhaseId);
          const updatedTask = { ...task, phaseId: newPhaseId, phaseOrder: newOrder ?? phaseTasks.length };
          const updatedPhases = s.phases.map((p) => {
            if (p.id === oldPhaseId) return { ...p, taskIds: p.taskIds.filter((id) => id !== taskId) };
            if (p.id === newPhaseId) return { ...p, taskIds: [...p.taskIds, taskId] };
            return p;
          });
          return { tasks: { ...s.tasks, [taskId]: updatedTask }, phases: updatedPhases };
        }),

      // ─── File index actions ───────────────────────────────────────────
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

      // ─── Gap actions ─────────────────────────────────────────────────

      addGap: (systemId, description, severity) => {
        const gap: Gap = { id: nanoid(6), systemId, description, severity, dismissed: false };
        set((s) => ({ gaps: [...s.gaps, gap] }));
        return gap;
      },

      dismissGap: (gapId) =>
        set((s) => ({ gaps: s.gaps.map((g) => (g.id === gapId ? { ...g, dismissed: true } : g)) })),

      convertGapToTask: (gapId, taskId) =>
        set((s) => ({
          gaps: s.gaps.map((g) => (g.id === gapId ? { ...g, convertedToTaskId: taskId, dismissed: true } : g)),
        })),

      // ─── Intelligence layer ───────────────────────────────────────────

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

      setCarFact: (key, value, confirmedBy) => {
        const existing = get().carFacts.find((f) => f.key === key);
        if (existing) {
          const updated: CarFact = { ...existing, value, confirmedBy, updatedAt: new Date().toISOString() };
          set((s) => ({
            carFacts: s.carFacts.map((f) => (f.key === key ? updated : f)),
          }));
          return updated;
        }
        const fact: CarFact = {
          id: nanoid(6),
          key,
          value,
          confirmedBy,
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ carFacts: [...s.carFacts, fact] }));
        return fact;
      },

      addResearchNote: (noteData) => {
        const note: ResearchNote = {
          id: nanoid(8),
          addedAt: new Date().toISOString(),
          ...noteData,
        };
        set((s) => ({ researchNotes: [...s.researchNotes, note] }));
        return note;
      },

      addTaskDependency: (taskId, dependsOnTaskId, reason) => {
        const existing = get().taskDependencies.find(
          (d) => d.taskId === taskId && d.dependsOnTaskId === dependsOnTaskId
        );
        if (existing) return;
        set((s) => ({
          taskDependencies: [...s.taskDependencies, { taskId, dependsOnTaskId, reason }],
        }));
      },

      removeTaskDependency: (taskId, dependsOnTaskId) =>
        set((s) => ({
          taskDependencies: s.taskDependencies.filter(
            (d) => !(d.taskId === taskId && d.dependsOnTaskId === dependsOnTaskId)
          ),
        })),

      getCarProfile: () => {
        const facts = get().carFacts;
        return facts.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {} as Record<string, string>);
      },

      getBlockingTasks: (taskId) => {
        const { taskDependencies, tasks } = get();
        const deps = taskDependencies.filter((d) => d.taskId === taskId);
        return deps.map((d) => tasks[d.dependsOnTaskId]).filter(Boolean) as Task[];
      },

      getDependentTasks: (taskId) => {
        const { taskDependencies, tasks } = get();
        const deps = taskDependencies.filter((d) => d.dependsOnTaskId === taskId);
        return deps.map((d) => tasks[d.taskId]).filter(Boolean) as Task[];
      },

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
          history[history.length - 1] = { ...history[history.length - 1], content, ...(toolCalls ? { toolCalls } : {}) };
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

      setActiveTask: (taskId) => set({ activeTaskId: taskId }),
      setActivePhase: (phaseId) => set({ activePhaseId: phaseId }),

      exportProgress: () => {
        const s = get();
        return JSON.stringify({
          appState: s.appState,
          onboardingSystemsCompleted: s.onboardingSystemsCompleted,
          phases: s.phases,
          tasks: s.tasks,
          gaps: s.gaps,
          decisions: s.decisions,
          carFacts: s.carFacts,
          researchNotes: s.researchNotes,
          taskDependencies: s.taskDependencies,
          agentHistory: s.agentHistory,
        }, null, 2);
      },

      importProgress: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            appState: data.appState,
            onboardingSystemsCompleted: data.onboardingSystemsCompleted ?? [],
            phases: data.phases ?? [],
            tasks: data.tasks ?? {},
            gaps: data.gaps ?? [],
            decisions: data.decisions ?? [],
            carFacts: data.carFacts ?? [],
            researchNotes: data.researchNotes ?? [],
            taskDependencies: data.taskDependencies ?? [],
            agentHistory: data.agentHistory ?? [],
          });
        } catch (e) {
          console.error('Failed to import progress', e);
        }
      },

      resetAll: () => set({ ...initialState }),

      getTasksForPhase: (phaseId) => {
        const s = get();
        const phase = s.phases.find((p) => p.id === phaseId);
        if (!phase) return [];
        return phase.taskIds.map((id) => s.tasks[id]).filter(Boolean).sort((a, b) => a.phaseOrder - b.phaseOrder) as Task[];
      },

      getPhaseCompletionPercent: (phaseId) => {
        const s = get();
        const tasks = s.getTasksForPhase(phaseId);
        if (tasks.length === 0) return 0;
        const done = tasks.filter((t) => t.status === 'done' || t.status === 'skipped').length;
        return Math.round((done / tasks.length) * 100);
      },

      getOverallCompletionPercent: () => {
        const s = get();
        const allTasks = Object.values(s.tasks);
        if (allTasks.length === 0) return 0;
        const done = allTasks.filter((t) => t.status === 'done' || t.status === 'skipped').length;
        return Math.round((done / allTasks.length) * 100);
      },

      getNextTask: () => {
        const s = get();
        for (const phase of [...s.phases].sort((a, b) => a.order - b.order)) {
          const tasks = s.getTasksForPhase(phase.id);
          const pending = tasks.find((t) => t.status !== 'done' && t.status !== 'skipped');
          if (pending) return pending;
        }
        return undefined;
      },

      getTotalCostEstimated: () => {
        const s = get();
        return Object.values(s.tasks).reduce((sum, t) => sum + (t.estimatedCostILS ?? 0), 0);
      },

      getTotalCostSpent: () => {
        const s = get();
        return Object.values(s.tasks).reduce((sum, t) => sum + (t.actualCostILS ?? 0), 0);
      },

      getActiveGaps: () => get().gaps.filter((g) => !g.dismissed),
    }),
    {
      name: 'jeep-renovation-planner',
      storage: createJSONStorage(() => fileBackedStorage),
      partialize: (state) => ({
        appState: state.appState,
        onboardingSystemsCompleted: state.onboardingSystemsCompleted,
        phases: state.phases,
        tasks: state.tasks,
        gaps: state.gaps,
        decisions: state.decisions,
        carFacts: state.carFacts,
        researchNotes: state.researchNotes,
        taskDependencies: state.taskDependencies,
        agentHistory: state.agentHistory,
      }),
    }
  )
);
