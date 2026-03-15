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
        gap: 6,
        padding: '10px 14px',
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

          return (
            <button
              key={phase.id}
              onClick={() => scrollToPhase(phase.id)}
              title={`${phase.name}${total > 0 ? ` — ${done}/${total} done` : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 20,
                border: `1px solid ${isCurrent ? 'var(--amber)' : isComplete ? 'var(--green)' : 'var(--border)'}`,
                background: isCurrent ? 'var(--amber-bg)' : 'transparent',
                color: isCurrent ? 'var(--amber)' : isComplete ? 'var(--green)' : 'var(--text-dim)',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <motion.span
                animate={hasActive || isCurrent ? { scale: [1, 1.4, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2.5 }}
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                }}
              />
              <span>Ph.{i + 1}</span>
              {total > 0 && (
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.7 }}>
                  {done}/{total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
