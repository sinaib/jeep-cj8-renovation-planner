import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';

interface TopBarProps {
  onSettingsOpen: () => void;
  onAgentOpen: () => void;
}

export function TopBar({ onSettingsOpen, onAgentOpen }: TopBarProps) {
  const location = useLocation();
  const pct = useRenovationStore((s) => s.getOverallCompletionPercent());
  const totalTasks = useRenovationStore((s) => Object.keys(s.tasks).length);
  const doneTasks = useRenovationStore((s) =>
    Object.values(s.tasks).filter((t) => t.status === 'done').length
  );
  const gaps = useRenovationStore((s) => s.getActiveGaps());
  const appState = useRenovationStore((s) => s.appState);
  const streaming = useRenovationStore((s) => s.agentStreaming);

  const navLinks = [
    { to: '/', label: 'Map' },
    { to: '/plan', label: 'Plan' },
    { to: '/manuals', label: 'Manuals' },
  ];

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      height: 52,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', height: '100%',
        padding: '0 16px', gap: 16,
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🚙</span>
          <span style={{ fontWeight: 700, letterSpacing: '0.05em', color: 'var(--amber)', fontSize: 13 }}>
            CJ8 PLANNER
          </span>
        </Link>

        {/* Nav */}
        {appState !== 'onboarding' && (
          <nav style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {navLinks.map(({ to, label }) => {
              const active = location.pathname === to;
              return (
                <Link key={to} to={to} style={{
                  padding: '4px 10px', borderRadius: 'var(--radius)',
                  fontSize: 12, fontWeight: 500, letterSpacing: '0.04em',
                  color: active ? 'var(--amber)' : 'var(--text-muted)',
                  background: active ? 'var(--amber-dim)' : 'transparent',
                  transition: 'all 0.15s',
                }}>
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        <div style={{ flex: 1 }} />

        {/* Progress pill */}
        {appState !== 'onboarding' && totalTasks > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-2)', padding: '4px 12px',
            borderRadius: 20, border: '1px solid var(--border)',
          }}>
            <div style={{ width: 80, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: 'var(--green)', borderRadius: 2 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 15 }}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {doneTasks}/{totalTasks}
            </span>
          </div>
        )}

        {/* Gap badge */}
        {gaps.length > 0 && appState !== 'onboarding' && (
          <div style={{
            background: 'var(--red)', color: 'white',
            borderRadius: 20, padding: '3px 8px', fontSize: 11, fontWeight: 600,
          }}>
            {gaps.filter(g => g.severity === 'critical').length > 0 ? '⚠' : '!'} {gaps.length} gap{gaps.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Agent button */}
        <button
          onClick={onAgentOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 'var(--radius)',
            background: streaming ? 'var(--amber-dim)' : 'var(--olive-dim)',
            border: `1px solid ${streaming ? 'var(--amber)' : 'var(--olive)'}`,
            color: streaming ? 'var(--amber)' : 'var(--text)',
            fontSize: 12, fontWeight: 500,
            transition: 'all 0.15s',
          }}
        >
          <span>{streaming ? '⚡' : '🔧'}</span>
          <span>{streaming ? 'Thinking...' : 'Agent'}</span>
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsOpen}
          style={{ color: 'var(--text-muted)', fontSize: 16, padding: 4 }}
          title="Settings"
        >
          ⚙
        </button>
      </div>

      {/* Thin progress line at very bottom of header */}
      {appState !== 'onboarding' && (
        <motion.div
          style={{
            position: 'absolute', bottom: 0, left: 0, height: 2,
            background: 'linear-gradient(90deg, var(--olive), var(--amber))',
          }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 40, damping: 15 }}
        />
      )}
    </header>
  );
}
