import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';

interface TopBarProps {
  onSettingsOpen: () => void;
}

export function TopBar({ onSettingsOpen }: TopBarProps) {
  const pct = useRenovationStore((s) => s.getOverallCompletionPercent());
  const totalTasks = useRenovationStore((s) => Object.keys(s.tasks).length);
  const doneTasks = useRenovationStore((s) =>
    Object.values(s.tasks).filter((t) => t.status === 'done').length
  );
  const rawGaps = useRenovationStore((s) => s.gaps);
  const criticalGaps = useMemo(
    () => rawGaps.filter((g) => !g.dismissed && g.severity === 'critical').length,
    [rawGaps]
  );
  const streaming = useRenovationStore((s) => s.agentStreaming);
  const phases = useRenovationStore((s) => s.phases);
  const totalCost = useRenovationStore((s) => s.getTotalCostEstimated());

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 48,
        padding: '0 16px',
        gap: 14,
      }}>
        {/* Vehicle identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🚙</span>
          <div>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--amber)',
            }}>
              CJ8 SCRAMBLER 1989
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
              RESTORATION PLAN
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* Progress summary */}
        {totalTasks > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Bar */}
            <div style={{
              width: 100,
              height: 4,
              background: 'var(--surface-2)',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <motion.div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--olive), var(--green))',
                  borderRadius: 2,
                }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 15 }}
              />
            </div>
            <span style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              {doneTasks}/{totalTasks}
            </span>
            <span style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
            }}>
              {pct}%
            </span>
          </div>
        )}

        {/* Phase count */}
        {phases.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {phases.length} phase{phases.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Total cost estimate */}
        {totalCost > 0 && (
          <span style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
          }}>
            ~₪{totalCost.toLocaleString()}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Critical gaps badge */}
        {criticalGaps > 0 && (
          <div style={{
            background: 'var(--red)',
            color: 'white',
            borderRadius: 20,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 600,
          }}>
            ⚠ {criticalGaps} critical
          </div>
        )}

        {/* Streaming indicator */}
        {streaming && (
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: 'var(--amber)',
            }}
          >
            <span>●</span>
            <span>advisor thinking</span>
          </motion.div>
        )}

        {/* Settings */}
        <button
          onClick={onSettingsOpen}
          style={{
            color: 'var(--text-dim)',
            fontSize: 14,
            padding: '4px 6px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderRadius: 4,
            transition: 'color 0.15s',
          }}
          title="Settings / Export"
        >
          ⚙
        </button>
      </div>

      {/* Progress line at the bottom of the bar */}
      {totalTasks > 0 && (
        <motion.div
          style={{
            position: 'absolute',
            bottom: 0, left: 0,
            height: 2,
            background: 'linear-gradient(90deg, var(--olive), var(--amber))',
          }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 40, damping: 15 }}
        />
      )}
    </div>
  );
}
