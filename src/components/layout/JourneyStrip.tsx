import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';

interface JourneyStripProps {
  scrollToPhase: (phaseId: string) => void;
  activePhaseId?: string | null;
}

export function JourneyStrip({ scrollToPhase, activePhaseId }: JourneyStripProps) {
  const rawPhases = useRenovationStore((s) => s.phases);
  const tasks = useRenovationStore((s) => s.tasks);

  const phases = useMemo(
    () => [...rawPhases].sort((a, b) => a.order - b.order),
    [rawPhases]
  );

  if (phases.length === 0) return null;

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      flexShrink: 0,
      overflowX: 'auto',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        gap: 0,
        minWidth: 'max-content',
      }}>
        {phases.map((phase, i) => {
          const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
          const done = phaseTasks.filter((t) => t.status === 'done').length;
          const total = phaseTasks.length;
          const isComplete = total > 0 && done === total;
          const hasActive = phaseTasks.some((t) => t.status === 'active');
          const isCurrent = phase.id === activePhaseId;

          const dotColor = isComplete
            ? 'var(--green)'
            : hasActive || isCurrent
            ? 'var(--amber)'
            : 'var(--border)';

          const labelColor = isComplete
            ? 'var(--green)'
            : hasActive || isCurrent
            ? 'var(--amber)'
            : 'var(--text-dim)';

          return (
            <div key={phase.id} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <div style={{
                  width: 28,
                  height: 1,
                  background: isComplete ? 'var(--green)' : 'var(--border)',
                  flexShrink: 0,
                }} />
              )}
              <button
                onClick={() => scrollToPhase(phase.id)}
                title={`${phase.name}${total > 0 ? ` (${done}/${total})` : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 6px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 6,
                  transition: 'background 0.15s',
                }}
              >
                <motion.div
                  animate={hasActive || isCurrent ? {
                    scale: [1, 1.3, 1],
                    boxShadow: ['0 0 0px var(--amber)', '0 0 8px var(--amber)', '0 0 0px var(--amber)'],
                  } : {}}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{
                  fontSize: 9,
                  color: labelColor,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                  maxWidth: 56,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  {phase.name.length > 8 ? phase.name.split(' ').slice(0, 2).join(' ') : phase.name}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
