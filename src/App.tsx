import { useState, useRef, useMemo, useEffect } from 'react';
import { useRenovationStore } from './store/useRenovationStore';
import { TopBar } from './components/layout/TopBar';
import { JourneyStrip } from './components/layout/JourneyStrip';
import { PlanContent, type PlanContentHandle } from './components/plan/PlanContent';
import { TaskDetailView } from './components/tasks/TaskDetailView';
import { AgentBar, type AgentBarHandle } from './components/agent/AgentBar';
import { SettingsModal } from './components/settings/SettingsModal';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { maybeRunWeeklyCheck } from './ai/agentBackground';
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

  // Current phase for the selected task (for context injection)
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
      {/* Top bar */}
      <TopBar onSettingsOpen={() => setSettingsOpen(true)} onCriticalClick={handleCriticalClick} />

      {/* Journey strip */}
      <JourneyStrip
        scrollToPhase={handleScrollToPhase}
        activePhaseId={activePhaseId}
      />

      {/* Main content area — scrollable */}
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

      {/* Agent bar — always at bottom, receives current task context */}
      <AgentBar
        ref={agentBarRef}
        currentTask={selectedTask}
        currentPhase={selectedPhase}
        contextHint={selectedTask ? `Ask about "${selectedTask.name}"...` : undefined}
      />

      {/* Modals */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function App() {
  const appState = useRenovationStore((s) => s.appState);

  // Run weekly health check on load (at most once per week, silent)
  useEffect(() => {
    if (appState !== 'onboarding') {
      maybeRunWeeklyCheck();
    }
  }, [appState]);

  return appState === 'onboarding' ? (
    <OnboardingScreen />
  ) : (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
