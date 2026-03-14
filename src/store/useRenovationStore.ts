import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Task, Phase, Gap, AgentMessage, TaskStatus, GapSeverity,
} from '../types';

interface RenovationState {
  // App flow
  appState: 'onboarding' | 'plan_built' | 'in_progress';
  onboardingSystemsCompleted: string[];

  // Plan data
  phases: Phase[];
  tasks: Record<string, Task>;
  gaps: Gap[];

  // Agent
  agentHistory: AgentMessage[];
  agentStreaming: boolean;

  // Active UI state (not persisted but kept in store for simplicity)
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

  // Gap actions
  addGap: (systemId: string, description: string, severity: GapSeverity) => Gap;
  dismissGap: (gapId: string) => void;
  convertGapToTask: (gapId: string, taskId: string) => void;

  // Agent
  addAgentMessage: (message: Omit<AgentMessage, 'id' | 'timestamp'>) => void;
  setAgentStreaming: (streaming: boolean) => void;
  updateLastAgentMessage: (content: string, toolCalls?: AgentMessage['toolCalls']) => void;

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
        return task;
      },

      updateTask: (taskId, updates) =>
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], ...updates } },
        })),

      completeTask: (taskId, actualCostILS) =>
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
        })),

      setTaskStatus: (taskId, status) =>
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], status } },
        })),

      addTaskNote: (taskId, note) =>
        set((s) => {
          const task = s.tasks[taskId];
          if (!task) return s;
          const existing = task.notes;
          const newNote = existing
            ? `${existing}\n\n[${new Date().toLocaleDateString()}] ${note}`
            : `[${new Date().toLocaleDateString()}] ${note}`;
          return { tasks: { ...s.tasks, [taskId]: { ...task, notes: newNote } } };
        }),

      updateTaskCost: (taskId, costILS) =>
        set((s) => ({
          tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], estimatedCostILS: costILS } },
        })),

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

      removeTask: (taskId) =>
        set((s) => {
          const task = s.tasks[taskId];
          if (!task) return s;
          const { [taskId]: _, ...remainingTasks } = s.tasks;
          const updatedPhases = s.phases.map((p) =>
            p.id === task.phaseId ? { ...p, taskIds: p.taskIds.filter((id) => id !== taskId) } : p
          );
          return { tasks: remainingTasks, phases: updatedPhases };
        }),

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

      setActiveTask: (taskId) => set({ activeTaskId: taskId }),
      setActivePhase: (phaseId) => set({ activePhaseId: phaseId }),

      exportProgress: () => {
        const s = get();
        return JSON.stringify({ appState: s.appState, onboardingSystemsCompleted: s.onboardingSystemsCompleted, phases: s.phases, tasks: s.tasks, gaps: s.gaps, agentHistory: s.agentHistory }, null, 2);
      },

      importProgress: (json) => {
        try {
          const data = JSON.parse(json);
          set({ appState: data.appState, onboardingSystemsCompleted: data.onboardingSystemsCompleted ?? [], phases: data.phases ?? [], tasks: data.tasks ?? {}, gaps: data.gaps ?? [], agentHistory: data.agentHistory ?? [] });
        } catch (e) {
          console.error('Failed to import progress', e);
        }
      },

      resetAll: () => set({ ...initialState }),

      getTasksForPhase: (phaseId) => {
        const s = get();
        const phase = s.phases.find((p) => p.id === phaseId);
        if (!phase) return [];
        return phase.taskIds.map((id) => s.tasks[id]).filter(Boolean).sort((a, b) => a.phaseOrder - b.phaseOrder);
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        appState: state.appState,
        onboardingSystemsCompleted: state.onboardingSystemsCompleted,
        phases: state.phases,
        tasks: state.tasks,
        gaps: state.gaps,
        agentHistory: state.agentHistory,
      }),
    }
  )
);
