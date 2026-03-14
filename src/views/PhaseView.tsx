import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRenovationStore } from '../store/useRenovationStore';
import type { TaskStatus } from '../types';

const STATUS_ICON: Record<TaskStatus, string> = {
  todo: '○', active: '▶', done: '✓', flagged: '⚠', skipped: '–',
};
const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: 'var(--text-dim)', active: 'var(--amber)', done: 'var(--green)',
  flagged: 'var(--red)', skipped: 'var(--text-dim)',
};

export function PhaseView() {
  const { phaseId } = useParams<{ phaseId: string }>();
  const phases = useRenovationStore((s) => s.phases);
  const getTasksForPhase = useRenovationStore((s) => s.getTasksForPhase);
  const getPhaseCompletionPercent = useRenovationStore((s) => s.getPhaseCompletionPercent);
  const setActiveTask = useRenovationStore((s) => s.setActiveTask);

  const phase = phases.find((p) => p.id === phaseId);
  const tasks = phaseId ? getTasksForPhase(phaseId) : [];
  const pct = phaseId ? getPhaseCompletionPercent(phaseId) : 0;

  if (!phase) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Phase not found. <Link to="/" style={{ color: 'var(--amber)' }}>Go home</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: 640, margin: '0 auto' }}>
      <Link to="/" style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        ← Back to map
      </Link>

      {/* Phase header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
          PHASE {phase.order}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{phase.name}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>{phase.subtitle}</p>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
          <motion.div
            style={{ height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--amber)', borderRadius: 2 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 60 }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {tasks.filter(t => t.status === 'done').length} / {tasks.length} tasks · {pct}% complete
        </div>
      </div>

      {/* Tasks as numbered steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.sort((a, b) => a.phaseOrder - b.phaseOrder).map((task, i) => (
          <motion.button
            key={task.id}
            onClick={() => setActiveTask(task.id)}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 'var(--radius-lg)',
              background: 'var(--surface)', border: `1px solid ${task.status === 'done' ? 'var(--olive-dim)' : 'var(--border)'}`,
              textAlign: 'left', cursor: 'pointer',
              opacity: task.status === 'skipped' ? 0.5 : 1,
            }}
          >
            {/* Step number */}
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: task.status === 'done' ? 'var(--olive-dim)' : 'var(--surface-2)',
              border: `1px solid ${task.status === 'done' ? 'var(--olive)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: task.status === 'done' ? 'var(--green)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              {task.status === 'done' ? '✓' : i + 1}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 500, fontSize: 14,
                color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text)',
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
              }}>
                {task.name}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: STATUS_COLOR[task.status] }}>
                  {STATUS_ICON[task.status]} {task.status}
                </span>
                {task.priority === 'critical' && (
                  <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>critical</span>
                )}
                {task.parts.length > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {task.parts.filter(p => p.purchased).length}/{task.parts.length} parts
                  </span>
                )}
              </div>
            </div>

            {task.estimatedCostILS && (
              <span style={{ fontSize: 12, color: 'var(--amber)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                ₪{task.estimatedCostILS.toLocaleString()}
              </span>
            )}
            <span style={{ color: 'var(--text-dim)', fontSize: 14, flexShrink: 0 }}>→</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
