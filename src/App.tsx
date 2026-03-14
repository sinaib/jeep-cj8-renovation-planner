import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useRenovationStore } from './store/useRenovationStore';
import { TopBar } from './components/layout/TopBar';
import { PlanSidebar } from './components/layout/PlanSidebar';
import { AgentDrawer } from './components/agent/AgentDrawer';
import { TaskDetailPanel } from './components/tasks/TaskDetailPanel';
import { SettingsModal } from './components/settings/SettingsModal';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import { HomeView } from './views/HomeView';
import { PhaseView } from './views/PhaseView';
import { PlanView } from './components/plan/PlanView';
import { ManualLibrary } from './components/manuals/ManualLibrary';
import './styles/globals.css';

function AppShell() {
  const [agentOpen, setAgentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <TopBar
        onAgentOpen={() => setAgentOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
      />

      <div style={{ display: 'flex', height: '100vh', paddingTop: 52 }}>
        {/* Always-visible plan sidebar */}
        <PlanSidebar />

        {/* Main scrollable content */}
        <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/plan" element={<PlanView />} />
            <Route path="/phase/:phaseId" element={<PhaseView />} />
            <Route path="/manuals" element={<ManualLibrary />} />
          </Routes>
        </main>
      </div>

      {/* Overlay panels */}
      <TaskDetailPanel />
      <AgentDrawer open={agentOpen} onClose={() => setAgentOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

export default function App() {
  const appState = useRenovationStore((s) => s.appState);

  return (
    <BrowserRouter>
      {appState === 'onboarding' ? (
        <OnboardingScreen />
      ) : (
        <AppShell />
      )}
    </BrowserRouter>
  );
}
