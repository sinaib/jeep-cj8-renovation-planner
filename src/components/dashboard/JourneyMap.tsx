import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useRenovationStore } from '../../store/useRenovationStore';

export function JourneyMap() {
  const phases = useRenovationStore((s) => [...s.phases].sort((a, b) => a.order - b.order));
  const getPhaseCompletionPercent = useRenovationStore((s) => s.getPhaseCompletionPercent);
  const getTasksForPhase = useRenovationStore((s) => s.getTasksForPhase);
  const navigate = useNavigate();

  if (phases.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔧</div>
        <div>No phases yet. Complete the onboarding to build your plan.</div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '32px 24px', gap: 0,
    }}>
      {phases.map((phase, index) => {
        const pct = getPhaseCompletionPercent(phase.id);
        const tasks = getTasksForPhase(phase.id);
        const done = tasks.filter((t) => t.status === 'done').length;
        const isDone = pct === 100;
        const isActive = !isDone && (index === 0 || getPhaseCompletionPercent(phases[index - 1]?.id ?? '') === 100 || true);
        const isLeft = index % 2 === 0;

        return (
          <div key={phase.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {/* Connector line above (except first) */}
            {index > 0 && (
              <div style={{ height: 32, width: 2, background: 'var(--border)', position: 'relative' }}>
                <motion.div
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%',
                    background: 'var(--green)',
                  }}
                  animate={{ height: getPhaseCompletionPercent(phases[index - 1].id) === 100 ? '100%' : '0%' }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}

            {/* Phase node row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              justifyContent: isLeft ? 'flex-start' : 'flex-end',
              width: '100%', maxWidth: 480, paddingLeft: isLeft ? 0 : 0,
            }}>
              {!isLeft && <div style={{ flex: 1 }} />}

              {/* Node */}
              <motion.button
                onClick={() => navigate(`/phase/${phase.id}`)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  position: 'relative', width: 72, height: 72,
                  borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                  background: isDone
                    ? 'var(--olive)'
                    : isActive ? 'var(--surface-2)' : 'var(--surface)',
                  border: `3px solid ${isDone ? 'var(--green)' : isActive ? 'var(--amber)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                  gap: 2,
                }}
              >
                {/* Ambient glow for active */}
                {isActive && !isDone && (
                  <motion.div
                    style={{
                      position: 'absolute', inset: -6, borderRadius: '50%',
                      border: '2px solid var(--amber)',
                      opacity: 0,
                    }}
                    animate={{ opacity: [0, 0.4, 0], scale: [0.9, 1.15, 0.9] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                  />
                )}

                {/* Circular progress */}
                <svg style={{ position: 'absolute', inset: 0 }} width={72} height={72}>
                  <circle cx={36} cy={36} r={32} fill="none" stroke="var(--border)" strokeWidth={2} />
                  <motion.circle
                    cx={36} cy={36} r={32} fill="none"
                    stroke={isDone ? 'var(--green)' : 'var(--amber)'}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    animate={{ strokeDashoffset: `${2 * Math.PI * 32 * (1 - pct / 100)}` }}
                    initial={{ strokeDashoffset: `${2 * Math.PI * 32}` }}
                    transform="rotate(-90 36 36)"
                    transition={{ duration: 0.8, type: 'spring' }}
                  />
                </svg>

                <span style={{ fontSize: 18, zIndex: 1 }}>
                  {isDone ? '✓' : phase.systemIds[0] === 'engine' ? '⚙️' : phase.systemIds[0] === 'brakes' ? '🛑' : phase.systemIds[0] === 'suspension' ? '🏗️' : phase.systemIds[0] === 'electrical' ? '⚡' : phase.systemIds[0] === 'body' ? '🚙' : '🔧'}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', zIndex: 1 }}>
                  {done}/{tasks.length}
                </span>
              </motion.button>

              {/* Label card */}
              <div style={{
                background: 'var(--surface)', border: `1px solid ${isDone ? 'var(--olive)' : isActive ? 'var(--border)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', padding: '10px 14px',
                maxWidth: 200,
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, fontFamily: 'var(--font-mono)' }}>
                  PHASE {phase.order}
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{phase.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{phase.subtitle}</div>
                {pct > 0 && pct < 100 && (
                  <div style={{ marginTop: 6, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <motion.div
                      style={{ height: '100%', background: 'var(--amber)', borderRadius: 2 }}
                      animate={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>

              {isLeft && <div style={{ flex: 1 }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
