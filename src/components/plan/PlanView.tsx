import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';
import type { TaskStatus } from '../../types';

const STATUS_DOT: Record<TaskStatus, { color: string; symbol: string }> = {
  todo: { color: 'var(--text-dim)', symbol: '○' },
  active: { color: 'var(--amber)', symbol: '▶' },
  done: { color: 'var(--green)', symbol: '✓' },
  flagged: { color: 'var(--red)', symbol: '⚠' },
  skipped: { color: 'var(--text-dim)', symbol: '–' },
};

export function PlanView() {
  const phases = useRenovationStore((s) => [...s.phases].sort((a, b) => a.order - b.order));
  const tasks = useRenovationStore((s) => s.tasks);
  const gaps = useRenovationStore((s) => s.getActiveGaps());
  const getPhaseCompletionPercent = useRenovationStore((s) => s.getPhaseCompletionPercent);
  const setActiveTask = useRenovationStore((s) => s.setActiveTask);
  const dismissGap = useRenovationStore((s) => s.dismissGap);

  const totalTasks = Object.keys(tasks).length;
  const doneTasks = Object.values(tasks).filter((t) => t.status === 'done').length;
  const totalCost = useRenovationStore.getState().getTotalCostEstimated();

  return (
    <div style={{ padding: '24px', maxWidth: 760, margin: '0 auto' }}>
      {/* Summary header */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap',
      }}>
        <div style={{
          flex: 1, minWidth: 120, padding: '14px 16px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>PHASES</div>
          <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'var(--font-mono)' }}>{phases.length}</div>
        </div>
        <div style={{
          flex: 1, minWidth: 120, padding: '14px 16px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>TASKS</div>
          <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'var(--font-mono)' }}>
            {doneTasks}<span style={{ color: 'var(--text-dim)', fontSize: 14 }}>/{totalTasks}</span>
          </div>
        </div>
        {totalCost > 0 && (
          <div style={{
            flex: 1, minWidth: 120, padding: '14px 16px',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>EST. COST</div>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
              ₪{totalCost.toLocaleString()}
            </div>
          </div>
        )}
        {gaps.length > 0 && (
          <div style={{
            flex: 1, minWidth: 120, padding: '14px 16px',
            background: 'rgba(192,57,43,0.08)', border: '1px solid var(--red)', borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--red)', letterSpacing: '0.08em', marginBottom: 4 }}>GAPS</div>
            <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>
              {gaps.length}
            </div>
          </div>
        )}
      </div>

      {/* Gap alerts */}
      {gaps.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 10 }}>
            GAP ALERTS
          </div>
          {gaps.map((gap) => (
            <motion.div
              key={gap.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 14px', borderRadius: 'var(--radius)',
                background: gap.severity === 'critical' ? 'rgba(192,57,43,0.08)' : 'var(--surface)',
                border: `1px solid ${gap.severity === 'critical' ? 'var(--red)' : gap.severity === 'warning' ? 'var(--amber-dim)' : 'var(--border)'}`,
                marginBottom: 6,
              }}
            >
              <span style={{ color: gap.severity === 'critical' ? 'var(--red)' : 'var(--amber)', fontSize: 14 }}>
                {gap.severity === 'critical' ? '⚠' : '!'}
              </span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>{gap.description}</span>
              <button
                onClick={() => dismissGap(gap.id)}
                style={{ color: 'var(--text-dim)', fontSize: 14, padding: '0 4px' }}
              >
                ×
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Phases */}
      {phases.map((phase) => {
        const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
        const pct = getPhaseCompletionPercent(phase.id);
        const done = phaseTasks.filter((t) => t.status === 'done').length;

        return (
          <div key={phase.id} style={{ marginBottom: 32 }}>
            {/* Phase header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 12, paddingBottom: 8,
              borderBottom: `2px solid ${pct === 100 ? 'var(--olive)' : 'var(--border)'}`,
            }}>
              <div style={{
                width: 4, height: 20, borderRadius: 2,
                background: pct === 100 ? 'var(--green)' : pct > 0 ? 'var(--amber)' : 'var(--border-light)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Phase {phase.order}: {phase.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {done}/{phaseTasks.length}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{phase.subtitle}</div>
              </div>
              <div style={{ fontSize: 12, color: pct === 100 ? 'var(--green)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {pct}%
              </div>
            </div>

            {/* Progress bar */}
            {phaseTasks.length > 0 && (
              <div style={{ height: 2, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                <motion.div
                  style={{ height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--amber)', borderRadius: 2 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                />
              </div>
            )}

            {/* Tasks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {phaseTasks.sort((a, b) => a.phaseOrder - b.phaseOrder).map((task, taskIdx) => {
                const dot = STATUS_DOT[task.status];
                return (
                  <motion.button
                    key={task.id}
                    onClick={() => setActiveTask(task.id)}
                    whileHover={{ x: 4 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 'var(--radius)',
                      background: 'transparent', textAlign: 'left',
                      transition: 'background 0.1s',
                      border: '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--surface)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 20, textAlign: 'right', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                      {taskIdx + 1}.
                    </span>
                    <span style={{ fontSize: 12, color: dot.color, flexShrink: 0 }}>{dot.symbol}</span>
                    <span style={{
                      flex: 1, fontSize: 13,
                      color: task.status === 'done' ? 'var(--text-dim)' : 'var(--text)',
                      textDecoration: task.status === 'done' ? 'line-through' : 'none',
                    }}>
                      {task.name}
                    </span>
                    {task.priority === 'critical' && (
                      <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>CRITICAL</span>
                    )}
                    {task.estimatedCostILS && (
                      <span style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        ₪{task.estimatedCostILS.toLocaleString()}
                      </span>
                    )}
                    {task.parts.length > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        {task.parts.filter(p => p.purchased).length}/{task.parts.length} parts
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
