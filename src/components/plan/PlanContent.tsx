import { useState, useRef, useMemo, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';
import type { Task } from '../../types';

export interface PlanContentHandle {
  scrollToPhase: (phaseId: string) => void;
  getActivePhaseId: () => string | null;
}

interface PlanContentProps {
  onSelectTask: (task: Task) => void;
  onMapPhase?: (phaseName: string) => void;
}

const STATUS_DOT: Record<string, { color: string; symbol: string }> = {
  done:    { color: 'var(--green)',    symbol: '✓' },
  active:  { color: 'var(--amber)',    symbol: '◉' },
  flagged: { color: 'var(--red)',      symbol: '⚑' },
  todo:    { color: 'var(--border)',   symbol: '○' },
  skipped: { color: 'var(--text-dim)', symbol: '—' },
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'var(--red)',
  high:     'var(--amber)',
  medium:   'var(--text-muted)',
  low:      'var(--text-dim)',
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type ViewMode = 'plan' | 'work' | 'journey';

export const PlanContent = forwardRef<PlanContentHandle, PlanContentProps>(
  ({ onSelectTask, onMapPhase }, ref) => {
    const rawPhases = useRenovationStore((s) => s.phases);
    const tasks = useRenovationStore((s) => s.tasks);
    const taskDependencies = useRenovationStore((s) => s.taskDependencies);
    const setTaskStatus = useRenovationStore((s) => s.setTaskStatus);
    const fileIndex = useRenovationStore((s) => s.fileIndex);
    const decisions = useRenovationStore((s) => s.decisions);

    const [viewMode, setViewMode] = useState<ViewMode>('plan');

    const phases = useMemo(
      () => [...rawPhases].sort((a, b) => a.order - b.order),
      [rawPhases]
    );

    // Determine which phase is the "current" one (first non-complete phase)
    const activePhaseId = useMemo(() => {
      for (const phase of phases) {
        const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
        if (phaseTasks.some((t) => t.status === 'active')) return phase.id;
      }
      for (const phase of phases) {
        const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
        const allDone = phaseTasks.length > 0 && phaseTasks.every((t) => t.status === 'done');
        if (!allDone) return phase.id;
      }
      return phases[0]?.id ?? null;
    }, [phases, tasks]);

    const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
      () => new Set(activePhaseId ? [activePhaseId] : [])
    );

    const phaseRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      scrollToPhase: (phaseId) => {
        const el = phaseRefs.current.get(phaseId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setExpandedPhases((prev) => new Set([...prev, phaseId]));
        }
      },
      getActivePhaseId: () => activePhaseId,
    }));

    const togglePhase = (phaseId: string) => {
      setExpandedPhases((prev) => {
        const next = new Set(prev);
        if (next.has(phaseId)) next.delete(phaseId);
        else next.add(phaseId);
        return next;
      });
    };

    // ── WORK NOW — sorted flat task list ──────────────────────────────────────
    const workNowTasks = useMemo(() => {
      const allTasks = Object.values(tasks).filter(
        (t) => t.status !== 'done' && t.status !== 'skipped'
      );
      const doneTaskIds = new Set(
        Object.values(tasks).filter((t) => t.status === 'done').map((t) => t.id)
      );

      return allTasks
        .map((task) => {
          const blockedBy = taskDependencies
            .filter((d) => d.taskId === task.id && !doneTaskIds.has(d.dependsOnTaskId))
            .map((d) => tasks[d.dependsOnTaskId]?.name ?? d.dependsOnTaskId);
          const phase = phases.find((p) => p.id === task.phaseId);
          return { task, blockedBy, phase };
        })
        .sort((a, b) => {
          const pDiff = (PRIORITY_ORDER[a.task.priority] ?? 3) - (PRIORITY_ORDER[b.task.priority] ?? 3);
          if (pDiff !== 0) return pDiff;
          const aPhaseOrder = a.phase?.order ?? 99;
          const bPhaseOrder = b.phase?.order ?? 99;
          return aPhaseOrder - bPhaseOrder;
        });
    }, [tasks, taskDependencies, phases]);

    // ── JOURNEY — completed tasks with files ──────────────────────────────────
    const journeyEntries = useMemo(() => {
      return Object.values(tasks)
        .filter((t) => t.status === 'done')
        .sort((a, b) => {
          const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return bTime - aTime;
        })
        .map((task) => ({
          task,
          phase: phases.find((p) => p.id === task.phaseId),
          files: fileIndex.filter((f) => f.taskId === task.id && f.type === 'image'),
        }));
    }, [tasks, phases, fileIndex]);

    const journeyDecisions = useMemo(
      () => decisions.filter((d) => d.category === 'approach' || d.category === 'scope'),
      [decisions]
    );

    if (phases.length === 0) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 16,
          color: 'var(--text-dim)',
        }}>
          <div style={{ fontSize: 48 }}>🚙</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            Your plan is being built
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
            Ask the advisor to map out your restoration phases and tasks
          </div>
        </div>
      );
    }

    return (
      <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* View toggle */}
        <div style={{
          display: 'flex',
          gap: 2,
          padding: '10px 16px 0',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}>
          {([
            { id: 'plan',    label: 'PLAN' },
            { id: 'work',    label: 'WORK NOW' },
            { id: 'journey', label: 'JOURNEY' },
          ] as { id: ViewMode; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setViewMode(id)}
              style={{
                padding: '6px 12px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${viewMode === id ? 'var(--amber)' : 'transparent'}`,
                color: viewMode === id ? 'var(--amber)' : 'var(--text-dim)',
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable content area */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

          {/* ─── PLAN view — phase cards ────────────────────────────────── */}
          {viewMode === 'plan' && (
            <div style={{ paddingBottom: 40 }}>
              {phases.map((phase) => {
                const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
                const done = phaseTasks.filter((t) => t.status === 'done').length;
                const total = phaseTasks.length;
                const isComplete = total > 0 && done === total;
                const hasActive = phaseTasks.some((t) => t.status === 'active');
                const isCurrent = phase.id === activePhaseId;
                const isExpanded = expandedPhases.has(phase.id);

                const phaseAccentColor = isComplete
                  ? 'var(--green)'
                  : hasActive || isCurrent
                  ? 'var(--amber)'
                  : phase.color ?? 'var(--border)';

                return (
                  <div
                    key={phase.id}
                    ref={(el) => {
                      if (el) phaseRefs.current.set(phase.id, el);
                      else phaseRefs.current.delete(phase.id);
                    }}
                    style={{
                      margin: '12px 14px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xl, 12px)',
                      boxShadow: 'var(--shadow, 0 2px 8px rgba(0,0,0,0.2))',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Phase card header — clickable */}
                    <button
                      onClick={() => togglePhase(phase.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {/* Colored top band */}
                      <div style={{
                        height: 6,
                        background: phaseAccentColor,
                        borderRadius: '12px 12px 0 0',
                      }} />

                      {/* Header body */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '16px 18px 14px',
                      }}>
                        <motion.span
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.15 }}
                          style={{
                            color: phaseAccentColor,
                            fontSize: 11,
                            flexShrink: 0,
                            display: 'inline-block',
                          }}
                        >
                          ▶
                        </motion.span>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: isComplete ? 'var(--text-muted)' : 'var(--text)',
                            textDecoration: isComplete ? 'line-through' : 'none',
                            lineHeight: 1.2,
                            marginBottom: phase.subtitle ? 3 : 0,
                          }}>
                            {phase.name}
                          </div>
                          {phase.subtitle && (
                            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.3 }}>
                              {phase.subtitle}
                            </div>
                          )}
                        </div>

                        {/* Progress bar + fraction */}
                        {total > 0 && (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 4,
                            flexShrink: 0,
                          }}>
                            <div style={{
                              width: 72,
                              height: 5,
                              background: 'var(--surface-2)',
                              borderRadius: 3,
                              overflow: 'hidden',
                            }}>
                              <motion.div
                                style={{
                                  height: '100%',
                                  background: isComplete ? 'var(--green)' : 'var(--amber)',
                                  borderRadius: 3,
                                }}
                                animate={{ width: `${(done / total) * 100}%` }}
                                transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                              />
                            </div>
                            <span style={{
                              fontSize: 11,
                              color: 'var(--text-dim)',
                              fontFamily: 'var(--font-mono)',
                            }}>
                              {done}/{total}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Task list — inside card */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            {phaseTasks.length === 0 ? (
                              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                  No tasks yet for this phase.
                                </div>
                                {onMapPhase && (
                                  <button
                                    onClick={() => onMapPhase(phase.name)}
                                    style={{
                                      alignSelf: 'flex-start',
                                      padding: '6px 14px',
                                      borderRadius: 20,
                                      border: '1px solid var(--amber-dim)',
                                      background: 'var(--amber-bg)',
                                      color: 'var(--amber)',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🔧 Map out {phase.name} tasks
                                  </button>
                                )}
                              </div>
                            ) : (
                              phaseTasks.map((task, idx) => {
                                const dot = STATUS_DOT[task.status] ?? STATUS_DOT.todo;
                                const isDone = task.status === 'done';
                                const isActive = task.status === 'active';
                                return (
                                  <motion.button
                                    key={task.id}
                                    onClick={() => onSelectTask(task)}
                                    layout
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 12,
                                      padding: '13px 18px',
                                      background: isActive ? 'rgba(212,131,42,0.05)' : 'transparent',
                                      border: 'none',
                                      borderBottom: idx < phaseTasks.length - 1 ? '1px solid var(--border)' : 'none',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                    }}
                                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                                  >
                                    <span style={{
                                      color: dot.color,
                                      fontSize: 14,
                                      width: 18,
                                      textAlign: 'center',
                                      flexShrink: 0,
                                    }}>
                                      {dot.symbol}
                                    </span>
                                    <span style={{
                                      flex: 1,
                                      fontSize: 14,
                                      color: isDone ? 'var(--text-dim)' : 'var(--text)',
                                      textDecoration: isDone ? 'line-through' : 'none',
                                      lineHeight: 1.4,
                                    }}>
                                      {task.name}
                                    </span>
                                    <span style={{
                                      fontSize: 10,
                                      color: PRIORITY_COLOR[task.priority],
                                      fontFamily: 'var(--font-mono)',
                                      letterSpacing: '0.08em',
                                      flexShrink: 0,
                                      fontWeight: 700,
                                    }}>
                                      {task.priority.toUpperCase()}
                                    </span>
                                    {task.estimatedCostILS != null && (
                                      <span style={{
                                        fontSize: 11,
                                        color: 'var(--text-dim)',
                                        fontFamily: 'var(--font-mono)',
                                        flexShrink: 0,
                                      }}>
                                        ₪{task.estimatedCostILS.toLocaleString()}
                                      </span>
                                    )}
                                    <span style={{ color: 'var(--text-dim)', fontSize: 11, flexShrink: 0 }}>›</span>
                                  </motion.button>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── WORK NOW view ─────────────────────────────────────────── */}
          {viewMode === 'work' && (
            <div style={{ padding: '16px 16px 40px' }}>
              {workNowTasks.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '48px 0',
                  color: 'var(--text-dim)', fontSize: 13,
                }}>
                  🎉 All tasks complete
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, letterSpacing: '0.06em' }}>
                    {workNowTasks.filter((e) => !e.blockedBy.length).length} tasks available
                    {workNowTasks.filter((e) => e.blockedBy.length > 0).length > 0
                      ? ` · ${workNowTasks.filter((e) => e.blockedBy.length > 0).length} blocked`
                      : ''}
                  </div>

                  {workNowTasks.map(({ task, blockedBy, phase }) => {
                    const isBlocked = blockedBy.length > 0;
                    const isActive = task.status === 'active';

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: isBlocked ? 0.45 : 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          marginBottom: 4,
                          background: isActive ? 'rgba(212,131,42,0.08)' : 'var(--surface)',
                          border: `1px solid ${isActive ? 'var(--amber)' : 'var(--border)'}`,
                          borderRadius: 8,
                          cursor: isBlocked ? 'default' : 'pointer',
                        }}
                        onClick={() => !isBlocked && onSelectTask(task)}
                        whileHover={!isBlocked ? { borderColor: 'var(--amber)', transition: { duration: 0.1 } } : {}}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: PRIORITY_COLOR[task.priority],
                        }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: isBlocked ? 'var(--text-dim)' : 'var(--text)', lineHeight: 1.3 }}>
                            {task.name}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                            {phase && (
                              <span style={{
                                fontSize: 9,
                                color: 'var(--text-dim)',
                                padding: '1px 5px',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border)',
                                borderRadius: 4,
                                fontFamily: 'var(--font-mono)',
                                letterSpacing: '0.04em',
                              }}>
                                {phase.name}
                              </span>
                            )}
                            {isBlocked && (
                              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                blocked by: {blockedBy.slice(0, 1).join(', ')}{blockedBy.length > 1 ? ` +${blockedBy.length - 1}` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {task.estimatedCostILS != null && (
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                            ₪{task.estimatedCostILS.toLocaleString()}
                          </span>
                        )}

                        {!isBlocked && (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {!isActive && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTaskStatus(task.id, 'active');
                                  onSelectTask(task);
                                }}
                                style={{
                                  padding: '3px 8px',
                                  background: 'var(--amber)',
                                  color: 'var(--bg)',
                                  border: 'none',
                                  borderRadius: 5,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                START
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTaskStatus(task.id, 'done');
                              }}
                              style={{
                                padding: '3px 8px',
                                background: 'transparent',
                                color: 'var(--green)',
                                border: '1px solid var(--green)',
                                borderRadius: 5,
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              ✓
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ─── JOURNEY view ──────────────────────────────────────────── */}
          {viewMode === 'journey' && (
            <div style={{ padding: '16px 16px 40px' }}>
              {journeyEntries.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '48px 20px',
                  color: 'var(--text-dim)', fontSize: 13,
                  display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
                }}>
                  <span style={{ fontSize: 32 }}>📖</span>
                  <span>Your journey log is empty</span>
                  <span style={{ fontSize: 11 }}>Complete your first task to start the record</span>
                </div>
              ) : (
                <>
                  {journeyDecisions.length > 0 && (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(212,131,42,0.06)',
                      border: '1px solid var(--amber)',
                      borderRadius: 8,
                      marginBottom: 20,
                    }}>
                      <div style={{ fontSize: 9, color: 'var(--amber)', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>
                        KEY DECISIONS
                      </div>
                      {journeyDecisions.slice(0, 5).map((d) => (
                        <div key={d.id} style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                          · {d.summary}
                        </div>
                      ))}
                    </div>
                  )}

                  {journeyEntries.map(({ task, phase, files }) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginBottom: 16,
                        padding: '12px 14px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${phase?.color ?? 'var(--green)'}`,
                        borderRadius: '0 8px 8px 0',
                        cursor: 'pointer',
                      }}
                      onClick={() => onSelectTask(task)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>
                            {task.name}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                            {phase && (
                              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                                {phase.name}
                              </span>
                            )}
                            {task.completedAt && (
                              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                {new Date(task.completedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {task.actualCostILS != null ? (
                            <>
                              <div style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                ₪{task.actualCostILS.toLocaleString()} actual
                              </div>
                              {task.estimatedCostILS != null && (
                                <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                  est. ₪{task.estimatedCostILS.toLocaleString()}
                                </div>
                              )}
                            </>
                          ) : task.estimatedCostILS != null ? (
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                              ~₪{task.estimatedCostILS.toLocaleString()}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {task.notes && (
                        <div style={{
                          fontSize: 11, color: 'var(--text-muted)',
                          lineHeight: 1.5, marginBottom: files.length > 0 ? 8 : 0,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        } as React.CSSProperties}>
                          {task.notes}
                        </div>
                      )}

                      {files.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {files.slice(0, 6).map((f) => (
                            <div key={f.id} style={{
                              width: 40, height: 40,
                              borderRadius: 4,
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border)',
                              overflow: 'hidden',
                              fontSize: 8,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--text-dim)',
                            }}>
                              📷
                            </div>
                          ))}
                          {files.length > 6 && (
                            <div style={{
                              width: 40, height: 40,
                              borderRadius: 4,
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 9, color: 'var(--text-dim)',
                            }}>
                              +{files.length - 6}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    );
  }
);

PlanContent.displayName = 'PlanContent';
