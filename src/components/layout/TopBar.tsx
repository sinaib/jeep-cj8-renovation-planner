import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';

interface TopBarProps {
  onSettingsOpen: () => void;
  onCriticalClick?: () => void;
}

export function TopBar({ onSettingsOpen, onCriticalClick }: TopBarProps) {
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
        height: 60,
        padding: '0 18px',
        gap: 16,
      }}>
        {/* Vehicle identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🚙</span>
          <div>
            <div style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: 'var(--amber)',
              lineHeight: 1.1,
            }}>
              CJ8 SCRAMBLER 1989
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>
              RESTORATION PLAN
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 140,
              height: 6,
              background: 'var(--surface-2)',
              borderRadius: 3,
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}>
              <motion.div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--olive), var(--green))',
                  borderRadius: 3,
                }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 15 }}
              />
            </div>
            <span style={{
              fontSize: 12,
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

        {/* Stat pills */}
        {phases.length > 0 && (
          <span style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '2px 8px',
            fontFamily: 'var(--font-mono)',
          }}>
            {phases.length} phase{phases.length !== 1 ? 's' : ''}
          </span>
        )}

        {totalCost > 0 && (
          <span style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '2px 8px',
            fontFamily: 'var(--font-mono)',
          }}>
            ~₪{totalCost.toLocaleString()}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Critical gaps badge */}
        {criticalGaps > 0 && (
          <button
            onClick={onCriticalClick}
            title="Jump to critical tasks"
            style={{
              background: 'var(--red)',
              color: 'white',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 700,
              border: 'none',
              cursor: onCriticalClick ? 'pointer' : 'default',
              boxShadow: '0 0 8px rgba(220,50,50,0.4)',
            }}
          >
            ⚠ {criticalGaps} critical
          </button>
        )}

        {/* Settings */}
        <button
          onClick={onSettingsOpen}
          style={{
            color: 'var(--text-dim)',
            fontSize: 16,
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
            height: 3,
            background: 'linear-gradient(90deg, var(--olive), var(--amber))',
          }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 40, damping: 15 }}
        />
      )}
    </div>
  );
}
