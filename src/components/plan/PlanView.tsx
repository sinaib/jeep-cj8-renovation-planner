import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';
import { CostDashboard } from '../dashboard/CostDashboard';
import type { TaskStatus } from '../../types';

const STATUS_DOT: Record<TaskStatus, { color: string; symbol: string }> = {
  todo: { color: 'var(--text-dim)', symbol: '○' },
  active: { color: 'var(--amber)', symbol: '▶' },
  done: { color: 'var(--green)', symbol: '✓' },
  flagged: { color: 'var(--red)', symbol: '⚠' },
  skipped: { color: 'var(--text-dim)', symbol: '–' },
};

const DECISION_CATEGORY_COLOR: Record<string, string> = {
  priority: 'var(--red)',
  budget: 'var(--amber)',
  approach: 'var(--olive)',
  scope: 'var(--text-muted)',
  timeline: 'var(--text-muted)',
  supplier: 'var(--text-muted)',
  safety: 'var(--red)',
  other: 'var(--text-dim)',
};

type Tab = 'plan' | 'costs' | 'decisions' | 'research' | 'profile';

export function PlanView() {
  const [activeTab, setActiveTab] = useState<Tab>('plan');

  const rawPhases = useRenovationStore((s) => s.phases);
  const phases = useMemo(() => [...rawPhases].sort((a, b) => a.order - b.order), [rawPhases]);
  const tasks = useRenovationStore((s) => s.tasks);
  const rawGaps = useRenovationStore((s) => s.gaps);
  const gaps = useMemo(() => rawGaps.filter((g) => !g.dismissed), [rawGaps]);
  const getPhaseCompletionPercent = useRenovationStore((s) => s.getPhaseCompletionPercent);
  const setActiveTask = useRenovationStore((s) => s.setActiveTask);
  const dismissGap = useRenovationStore((s) => s.dismissGap);
  const decisions = useRenovationStore((s) => s.decisions);
  const researchNotes = useRenovationStore((s) => s.researchNotes);
  const carFacts = useRenovationStore((s) => s.carFacts);
  const taskDependencies = useRenovationStore((s) => s.taskDependencies);

  const totalTasks = Object.keys(tasks).length;
  const doneTasks = Object.values(tasks).filter((t) => t.status === 'done').length;
  const totalCost = useRenovationStore((s) => s.getTotalCostEstimated());

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'plan', label: 'Plan', count: totalTasks },
    { id: 'costs', label: '₪ Costs' },
    { id: 'decisions', label: 'Decisions', count: decisions.length },
    { id: 'research', label: 'Research', count: researchNotes.length },
    { id: 'profile', label: 'Car Profile', count: carFacts.length },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      {/* Summary header */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 100, padding: '14px 16px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>PHASES</div>
          <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'var(--font-mono)' }}>{phases.length}</div>
        </div>
        <div style={{
          flex: 1, minWidth: 100, padding: '14px 16px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>TASKS</div>
          <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'var(--font-mono)' }}>
            {doneTasks}<span style={{ color: 'var(--text-dim)', fontSize: 14 }}>/{totalTasks}</span>
          </div>
        </div>
        {totalCost > 0 && (
          <div style={{
            flex: 1, minWidth: 100, padding: '14px 16px',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>EST. COST</div>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
              ₪{totalCost.toLocaleString()}
            </div>
          </div>
        )}
        {decisions.length > 0 && (
          <div style={{
            flex: 1, minWidth: 100, padding: '14px 16px',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>DECISIONS</div>
            <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'var(--font-mono)' }}>{decisions.length}</div>
          </div>
        )}
        {gaps.length > 0 && (
          <div style={{
            flex: 1, minWidth: 100, padding: '14px 16px',
            background: 'rgba(192,57,43,0.08)', border: '1px solid var(--red)', borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--red)', letterSpacing: '0.08em', marginBottom: 4 }}>GAPS</div>
            <div style={{ fontWeight: 700, fontSize: 20, fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>
              {gaps.length}
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 14px', borderRadius: '4px 4px 0 0',
              background: activeTab === tab.id ? 'var(--surface)' : 'transparent',
              border: activeTab === tab.id ? '1px solid var(--border)' : '1px solid transparent',
              borderBottom: activeTab === tab.id ? '1px solid var(--surface)' : 'none',
              marginBottom: activeTab === tab.id ? -1 : 0,
              color: activeTab === tab.id ? 'var(--amber)' : 'var(--text-dim)',
              fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer', letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 8,
                background: activeTab === tab.id ? 'var(--amber-dim)' : 'var(--surface-2)',
                color: activeTab === tab.id ? 'var(--amber)' : 'var(--text-dim)',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Costs tab ────────────────────────────────────────────────────── */}
      {activeTab === 'costs' && <CostDashboard />}

      {/* ── Plan tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'plan' && (
        <>
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
                  <button onClick={() => dismissGap(gap.id)} style={{ color: 'var(--text-dim)', fontSize: 14, padding: '0 4px' }}>×</button>
                </motion.div>
              ))}
            </div>
          )}

          {phases.map((phase) => {
            const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
            const pct = getPhaseCompletionPercent(phase.id);
            const done = phaseTasks.filter((t) => t.status === 'done').length;

            return (
              <div key={phase.id} style={{ marginBottom: 32 }}>
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

                {phaseTasks.length > 0 && (
                  <div style={{ height: 2, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                    <motion.div
                      style={{ height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--amber)', borderRadius: 2 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {phaseTasks.sort((a, b) => a.phaseOrder - b.phaseOrder).map((task, taskIdx) => {
                    const dot = STATUS_DOT[task.status];
                    const blockers = taskDependencies
                      .filter((d) => d.taskId === task.id)
                      .map((d) => tasks[d.dependsOnTaskId])
                      .filter((t) => t && t.status !== 'done' && t.status !== 'skipped');
                    const isBlocked = blockers.length > 0;

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
                          opacity: isBlocked ? 0.6 : 1,
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
                        {isBlocked && (
                          <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                            BLOCKED
                          </span>
                        )}
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
        </>
      )}

      {/* ── Decisions tab ────────────────────────────────────────────────── */}
      {activeTab === 'decisions' && (
        <div>
          {decisions.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              No decisions recorded yet. The advisor captures decisions as you make them.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...decisions].reverse().map((d) => (
                <div key={d.id} style={{
                  padding: '14px 16px', borderRadius: 'var(--radius)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 10,
                      background: 'var(--surface-2)',
                      color: DECISION_CATEGORY_COLOR[d.category] ?? 'var(--text-dim)',
                      border: `1px solid ${DECISION_CATEGORY_COLOR[d.category] ?? 'var(--border)'}`,
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 600,
                    }}>
                      {d.category.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                      {new Date(d.madeAt).toLocaleDateString()} · by {d.madeBy}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: d.rationale ? 4 : 0 }}>
                    {d.summary}
                  </div>
                  {d.rationale && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {d.rationale}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Research tab ─────────────────────────────────────────────────── */}
      {activeTab === 'research' && (
        <div>
          {researchNotes.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              No research notes yet. The advisor stores technical findings from searches and analysis.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...researchNotes].reverse().map((n) => (
                <div key={n.id} style={{
                  padding: '14px 16px', borderRadius: 'var(--radius)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--olive)' }}>
                      📝 {n.topic}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                      {new Date(n.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{n.finding}</div>
                  {n.source && (
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                      {n.source}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Car Profile tab ──────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div>
          {carFacts.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              Car profile is empty. Describes your Jeep to the advisor to build this up.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...carFacts].sort((a, b) => a.key.localeCompare(b.key)).map((f) => (
                <div key={f.id} style={{
                  display: 'flex', gap: 16, padding: '10px 14px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    fontSize: 11, color: 'var(--olive)', fontFamily: 'var(--font-mono)',
                    flexShrink: 0, width: 160, paddingTop: 1,
                  }}>
                    {f.key.replace(/_/g, ' ')}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{f.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{f.confirmedBy}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
