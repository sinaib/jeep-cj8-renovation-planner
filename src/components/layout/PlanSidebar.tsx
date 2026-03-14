import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';

export function PlanSidebar() {
  const phases = useRenovationStore((s) => s.phases);
  const tasks = useRenovationStore((s) => s.tasks);
  const getPhaseCompletionPercent = useRenovationStore((s) => s.getPhaseCompletionPercent);
  const setActiveTask = useRenovationStore((s) => s.setActiveTask);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const togglePhase = (id: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      overflowY: 'auto', height: '100%',
    }}>
      <div style={{ padding: '12px 8px' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-dim)', padding: '0 8px 8px', fontWeight: 600 }}>
          RENOVATION PLAN
        </div>

        {sortedPhases.map((phase) => {
          const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
          const pct = getPhaseCompletionPercent(phase.id);
          const expanded = expandedPhases.has(phase.id);
          const doneTasks = phaseTasks.filter((t) => t.status === 'done').length;

          return (
            <div key={phase.id} style={{ marginBottom: 2 }}>
              {/* Phase header */}
              <button
                onClick={() => togglePhase(phase.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 'var(--radius)',
                  background: expanded ? 'var(--surface-2)' : 'transparent',
                  transition: 'background 0.15s', textAlign: 'left',
                }}
              >
                {/* Progress fill on left */}
                <div style={{
                  width: 3, height: 20, borderRadius: 2,
                  background: pct === 100 ? 'var(--green)' : pct > 0 ? 'var(--amber)' : 'var(--border-light)',
                  flexShrink: 0,
                }} />

                <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: pct === 100 ? 'var(--text-muted)' : 'var(--text)' }}>
                  {phase.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {doneTasks}/{phaseTasks.length}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  {expanded ? '▲' : '▼'}
                </span>
              </button>

              {/* Tasks */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ paddingLeft: 19, paddingBottom: 4 }}>
                      {phaseTasks.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => setActiveTask(task.id)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 8px', borderRadius: 6,
                            background: 'transparent', textAlign: 'left',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontSize: 10, width: 12, flexShrink: 0 }}>
                            {task.status === 'done' ? '✓' : task.status === 'active' ? '▶' : task.status === 'flagged' ? '⚠' : '○'}
                          </span>
                          <span style={{
                            fontSize: 11, flex: 1,
                            color: task.status === 'done' ? 'var(--text-dim)' : 'var(--text-muted)',
                            textDecoration: task.status === 'done' ? 'line-through' : 'none',
                          }}>
                            {task.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
