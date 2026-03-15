import { useState, useRef, useMemo, useEffect } from 'react';
import { useRenovationStore } from './store/useRenovationStore';
import { TopBar } from './components/layout/TopBar';
import { JourneyStrip } from './components/layout/JourneyStrip';
import { PlanContent, type PlanContentHandle } from './components/plan/PlanContent';
import { TaskDetailView } from './components/tasks/TaskDetailView';
import { AgentBar, type AgentBarHandle } from './components/agent/AgentBar';
import { SettingsModal } from './components/settings/SettingsModal';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { maybeRunWeeklyCheck } from './ai/agentBackground';
import { buildSeedData } from './data/seed';
import type { Task } from './types';
import './styles/globals.css';

function AppShell() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const planRef = useRef<PlanContentHandle>(null);
  const agentBarRef = useRef<AgentBarHandle>(null);

  const rawPhases = useRenovationStore((s) => s.phases);
  const phases = useMemo(() => rawPhases, [rawPhases]);
  const allTasks = useRenovationStore((s) => s.tasks);

  const selectedPhase = useMemo(
    () => selectedTask ? (phases.find((p) => p.id === selectedTask.phaseId) ?? null) : null,
    [selectedTask, phases]
  );

  const handleScrollToPhase = (phaseId: string) => {
    setSelectedTask(null);
    setTimeout(() => planRef.current?.scrollToPhase(phaseId), 50);
  };

  const handleMapPhase = (phaseName: string) => {
    agentBarRef.current?.sendPrompt(
      `Map out all the tasks I'll need for "${phaseName}" on my CJ8 Scrambler renovation`
    );
  };

  const handleCriticalClick = () => {
    const criticalTask = Object.values(allTasks).find(
      (t) => t.priority === 'critical' && t.status !== 'done' && t.status !== 'skipped'
    );
    if (criticalTask) {
      handleScrollToPhase(criticalTask.phaseId);
    }
  };

  const activePhaseId = planRef.current?.getActivePhaseId() ?? null;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      {/* Top bar — full width */}
      <TopBar onSettingsOpen={() => setSettingsOpen(true)} onCriticalClick={handleCriticalClick} />

      {/* Two-column body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT: Plan column */}
        <div style={{
          flex: '0 0 55%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '2px solid var(--border)',
          overflow: 'hidden',
        }}>
          <JourneyStrip
            scrollToPhase={handleScrollToPhase}
            activePhaseId={activePhaseId}
          />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            {selectedTask ? (
              <TaskDetailView
                task={selectedTask}
                onBack={() => setSelectedTask(null)}
              />
            ) : (
              <PlanContent
                ref={planRef}
                onSelectTask={setSelectedTask}
                onMapPhase={handleMapPhase}
              />
            )}
          </div>
        </div>

        {/* RIGHT: Agent panel — always visible */}
        <AgentBar
          ref={agentBarRef}
          currentTask={selectedTask}
          currentPhase={selectedPhase}
          contextHint={selectedTask ? `Ask about "${selectedTask.name}"...` : undefined}
        />
      </div>

      {/* Modals */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  const phases = useRenovationStore((s) => s.phases);

  // Seed store from plan.ts when empty or when old-format data lacks our plan IDs
  useEffect(() => {
    const hasOurPlan = phases.some((p) => p.id === 'phase-1' || p.id === 'phase-2');
    if (phases.length === 0 || !hasOurPlan) {
      const { phases: seedPhases, tasks: seedTasks, taskDependencies, decisions } = buildSeedData();
      useRenovationStore.setState({
        appState: 'plan_built',
        phases: seedPhases,
        tasks: seedTasks,
        taskDependencies,
        decisions,
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const appState = useRenovationStore((s) => s.appState);

  useEffect(() => {
    if (appState === 'plan_built' || appState === 'in_progress') {
      maybeRunWeeklyCheck();
    }
  }, [appState]);

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
