import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';
import { AiBriefing } from './AiBriefing';
import type { TaskStatus } from '../../types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  active: 'In Progress',
  done: 'Done',
  flagged: 'Flagged',
  skipped: 'Skipped',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'var(--text-muted)',
  active: 'var(--amber)',
  done: 'var(--green)',
  flagged: 'var(--red)',
  skipped: 'var(--text-dim)',
};

export function TaskDetailPanel() {
  const activeTaskId = useRenovationStore((s) => s.activeTaskId);
  const tasks = useRenovationStore((s) => s.tasks);
  const phases = useRenovationStore((s) => s.phases);
  const setActiveTask = useRenovationStore((s) => s.setActiveTask);
  const completeTask = useRenovationStore((s) => s.completeTask);
  const setTaskStatus = useRenovationStore((s) => s.setTaskStatus);
  const addTaskNote = useRenovationStore((s) => s.addTaskNote);
  const markPartPurchased = useRenovationStore((s) => s.markPartPurchased);

  const [noteInput, setNoteInput] = useState('');
  const [completing, setCompleting] = useState(false);
  const [actualCost, setActualCost] = useState('');

  const task = activeTaskId ? tasks[activeTaskId] : null;
  const phase = task ? phases.find((p) => p.id === task.phaseId) : null;

  const handleComplete = async () => {
    if (!task) return;
    setCompleting(true);
    await new Promise((r) => setTimeout(r, 600));
    completeTask(task.id, actualCost ? parseFloat(actualCost) : undefined);
    setCompleting(false);
    setActualCost('');
  };

  const handleAddNote = () => {
    if (!task || !noteInput.trim()) return;
    addTaskNote(task.id, noteInput.trim());
    setNoteInput('');
  };

  return (
    <AnimatePresence>
      {task && (
        <>
          {/* Backdrop (mobile) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveTask(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
              zIndex: 149,
              display: 'none',
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed', top: 52, right: 0, bottom: 0, width: 400,
              background: 'var(--surface)', borderLeft: '1px solid var(--border)',
              zIndex: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1, flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  {phase && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
                      PHASE {phase.order} · {phase.name.toUpperCase()}
                    </div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{task.name}</div>
                </div>
                <button onClick={() => setActiveTask(null)} style={{ color: 'var(--text-muted)', fontSize: 20, padding: 4 }}>×</button>
              </div>

              {/* Status + priority row */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <select
                  value={task.status}
                  onChange={(e) => setTaskStatus(task.id, e.target.value as TaskStatus)}
                  style={{
                    background: 'var(--surface-2)', border: `1px solid ${STATUS_COLORS[task.status]}`,
                    color: STATUS_COLORS[task.status], borderRadius: 20, padding: '3px 10px',
                    fontSize: 11, fontWeight: 500, cursor: 'pointer', outline: 'none',
                  }}
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>

                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                  background: 'var(--surface-2)', color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}>
                  {task.priority}
                </span>

                {task.estimatedCostILS && (
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: 'var(--surface-2)', color: 'var(--amber)', fontFamily: 'var(--font-mono)', border: '1px solid var(--border)' }}>
                    ₪{task.estimatedCostILS.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Agent rationale */}
              {task.agentRationale && (
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius)',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic',
                }}>
                  💬 {task.agentRationale}
                </div>
              )}

              {/* Complete button */}
              {task.status !== 'done' && (
                <div style={{
                  background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)',
                  padding: 16, border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Mark this task complete
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input
                      type="number"
                      placeholder="Actual cost in ₪ (optional)"
                      value={actualCost}
                      onChange={(e) => setActualCost(e.target.value)}
                      style={{
                        flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)', padding: '7px 10px',
                        color: 'var(--text)', fontSize: 12, outline: 'none',
                      }}
                    />
                  </div>
                  <motion.button
                    onClick={handleComplete}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      width: '100%', padding: '12px',
                      background: completing ? 'var(--green)' : 'var(--olive)',
                      border: `1px solid ${completing ? 'var(--green-light)' : 'var(--olive-light)'}`,
                      borderRadius: 'var(--radius)', color: 'white',
                      fontWeight: 600, fontSize: 14, letterSpacing: '0.03em',
                      transition: 'all 0.3s',
                    }}
                    disabled={completing}
                  >
                    {completing ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{ display: 'inline-block' }}
                      >
                        ✓ Done!
                      </motion.span>
                    ) : 'Mark Complete'}
                  </motion.button>
                </div>
              )}

              {/* Done state */}
              {task.status === 'done' && (
                <div style={{
                  padding: '12px 16px', borderRadius: 'var(--radius)',
                  background: 'rgba(39, 174, 96, 0.1)', border: '1px solid var(--green)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>✓</span>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--green)' }}>Completed</div>
                    {task.completedAt && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(task.completedAt).toLocaleDateString()}
                        {task.actualCostILS ? ` · ₪${task.actualCostILS.toLocaleString()} spent` : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Parts */}
              {task.parts.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 8 }}>
                    PARTS NEEDED
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {task.parts.map((part) => (
                      <div key={part.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 'var(--radius)',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                      }}>
                        <button
                          onClick={() => markPartPurchased(task.id, part.id)}
                          style={{
                            width: 16, height: 16, borderRadius: 4,
                            border: `2px solid ${part.purchased ? 'var(--green)' : 'var(--border-light)'}`,
                            background: part.purchased ? 'var(--green)' : 'transparent',
                            flexShrink: 0, fontSize: 10, color: 'white',
                          }}
                        >
                          {part.purchased ? '✓' : ''}
                        </button>
                        <span style={{
                          flex: 1, fontSize: 12,
                          color: part.purchased ? 'var(--text-dim)' : 'var(--text)',
                          textDecoration: part.purchased ? 'line-through' : 'none',
                        }}>
                          {part.name}
                        </span>
                        {part.partNumber && (
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {part.partNumber}
                          </span>
                        )}
                        {part.estimatedCostILS && (
                          <span style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                            ₪{part.estimatedCostILS}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 8 }}>
                  NOTES
                </div>
                {task.notes && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 'var(--radius)',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
                    marginBottom: 8, lineHeight: 1.6,
                  }}>
                    {task.notes}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Add a note..."
                    style={{
                      flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '7px 10px',
                      color: 'var(--text)', fontSize: 12, outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleAddNote}
                    style={{
                      background: 'var(--surface-3)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', padding: '7px 12px',
                      color: 'var(--text-muted)', fontSize: 12,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Manual refs */}
              {task.manualRefs.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 8 }}>
                    MANUAL REFERENCES
                  </div>
                  {task.manualRefs.map((ref, i) => (
                    <a
                      key={i}
                      href={`/manuals#${ref.manualId}-p${ref.page}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 'var(--radius)',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        fontSize: 12, marginBottom: 4,
                      }}
                    >
                      <span>📄</span>
                      <span style={{ flex: 1 }}>{ref.description}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                        p.{ref.page}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {/* AI Briefing */}
              <AiBriefing task={task} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
