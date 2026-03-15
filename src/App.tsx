import { useState, useRef, useMemo, useEffect } from 'react';
import { useResolvedTasks, useResolvedPhases } from './hooks/usePlanData';
import { TopBar } from './components/layout/TopBar';
import { JourneyStrip } from './components/layout/JourneyStrip';
import { PlanContent, type PlanContentHandle } from './components/plan/PlanContent';
import { TaskDetailView } from './components/tasks/TaskDetailView';
import { AgentBar, type AgentBarHandle } from './components/agent/AgentBar';
import { SettingsModal } from './components/settings/SettingsModal';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { UserGuidePage } from './pages/UserGuidePage';
import { ProjectOverviewPage } from './pages/ProjectOverviewPage';
import { maybeRunWeeklyCheck } from './ai/agentBackground';
import type { Task } from './types';
import './styles/globals.css';

type PageView = 'plan' | 'guide' | 'overview';

function AppShell() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageView, setPageView] = useState<PageView>('plan');
  const planRef = useRef<PlanContentHandle>(null);
  const agentBarRef = useRef<AgentBarHandle>(null);

  const phases = useResolvedPhases();
  const allTasks = useResolvedTasks();

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
      <TopBar
        onSettingsOpen={() => setSettingsOpen(true)}
        onCriticalClick={handleCriticalClick}
        onGuideOpen={() => setPageView('guide')}
        onOverviewOpen={() => setPageView('overview')}
      />

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
          {pageView === 'plan' && (
            <JourneyStrip
              scrollToPhase={handleScrollToPhase}
              activePhaseId={activePhaseId}
            />
          )}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            {pageView === 'guide' ? (
              <UserGuidePage onClose={() => setPageView('plan')} />
            ) : pageView === 'overview' ? (
              <ProjectOverviewPage onClose={() => setPageView('plan')} />
            ) : selectedTask ? (
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
  useEffect(() => {
    maybeRunWeeklyCheck();
  }, []);

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
