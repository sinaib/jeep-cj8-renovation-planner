import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';

export function NextUpCard() {
  const task = useRenovationStore((s) => s.getNextTask());
  const phases = useRenovationStore((s) => s.phases);
  const setActiveTask = useRenovationStore((s) => s.setActiveTask);

  if (!task) {
    return (
      <div style={{
        background: 'var(--olive-dim)', border: '1px solid var(--olive)',
        borderRadius: 'var(--radius-lg)', padding: '20px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🏁</div>
        <div style={{ fontWeight: 600, color: 'var(--green)' }}>All tasks complete!</div>
      </div>
    );
  }

  const phase = phases.find((p) => p.id === task.phaseId);

  const priorityColors: Record<string, string> = {
    critical: 'var(--red)',
    high: 'var(--amber)',
    medium: 'var(--text)',
    low: 'var(--text-muted)',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '20px 24px',
        borderLeft: `3px solid ${task.priority === 'critical' ? 'var(--red)' : task.priority === 'high' ? 'var(--amber)' : 'var(--olive)'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
          }}>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: 'var(--surface-2)', color: 'var(--text-dim)',
              fontWeight: 600, letterSpacing: '0.06em',
            }}>
              {phase ? `PHASE ${phase.order}` : 'NEXT UP'}
            </span>
            <span style={{
              fontSize: 10, color: priorityColors[task.priority] ?? 'var(--text)',
              fontWeight: 500,
            }}>
              {task.priority.toUpperCase()}
            </span>
          </div>

          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{task.name}</div>

          {phase && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {phase.name}
            </div>
          )}

          {task.estimatedCostILS && (
            <div style={{ fontSize: 12, color: 'var(--amber)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              Est. ₪{task.estimatedCostILS.toLocaleString()}
            </div>
          )}

          {task.agentRationale && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
              {task.agentRationale}
            </div>
          )}
        </div>

        <button
          onClick={() => setActiveTask(task.id)}
          style={{
            background: 'var(--amber)', color: 'white',
            padding: '8px 16px', borderRadius: 'var(--radius)',
            fontWeight: 600, fontSize: 13,
            boxShadow: '0 2px 12px rgba(212,131,42,0.3)',
            flexShrink: 0,
          }}
        >
          Open →
        </button>
      </div>
    </motion.div>
  );
}
