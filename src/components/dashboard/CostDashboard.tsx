import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';

function fmt(n: number) {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{
      height: 6, borderRadius: 3, background: 'var(--border)',
      overflow: 'hidden', marginTop: 6,
    }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: 3 }}
      />
    </div>
  );
}

export function CostDashboard() {
  const phases = useRenovationStore((s) => s.phases);
  const tasks = useRenovationStore((s) => s.tasks);
  const carFacts = useRenovationStore((s) => s.carFacts);

  const budgetFact = carFacts.find((f) => f.key === 'budget');
  const budget = budgetFact
    ? parseInt(budgetFact.value.replace(/[^\d]/g, ''), 10) || 0
    : 0;

  const allTasks = Object.values(tasks);

  const { totalEst, totalSpent, byPhase } = useMemo(() => {
    const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

    let totalEst = 0;
    let totalSpent = 0;

    const byPhase = sortedPhases.map((phase) => {
      const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
      const est = phaseTasks.reduce((s, t) => s + (t.estimatedCostILS ?? 0), 0);
      const spent = phaseTasks
        .filter((t) => t.status === 'done')
        .reduce((s, t) => s + (t.actualCostILS ?? t.estimatedCostILS ?? 0), 0);
      const doneCount = phaseTasks.filter((t) => t.status === 'done').length;
      const totalCount = phaseTasks.length;
      totalEst += est;
      totalSpent += spent;
      return { phase, est, spent, doneCount, totalCount };
    });

    return { totalEst, totalSpent, byPhase };
  }, [phases, tasks]);

  const remaining = totalEst - totalSpent;
  const budgetUsedPct = budget > 0 ? (totalEst / budget) * 100 : 0;
  const overBudget = budget > 0 && totalEst > budget;

  const uncostedCount = allTasks.filter(
    (t) => t.status !== 'done' && t.status !== 'skipped' && !t.estimatedCostILS
  ).length;

  const statusColor = overBudget
    ? 'var(--red)'
    : budgetUsedPct > 80
    ? '#E67E22'
    : 'var(--green, #27AE60)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Top summary row ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>

        {/* Total estimated */}
        <div style={{
          flex: '1 1 140px', padding: '16px 18px',
          background: 'var(--surface)', border: '2px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '3px 3px 0 rgba(28,21,16,0.08)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 6 }}>
            TOTAL ESTIMATE
          </div>
          <div style={{ fontWeight: 700, fontSize: 22, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
            {totalEst > 0 ? fmt(totalEst) : '—'}
          </div>
          {uncostedCount > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              +{uncostedCount} tasks without cost estimate
            </div>
          )}
        </div>

        {/* Spent (done tasks) */}
        <div style={{
          flex: '1 1 140px', padding: '16px 18px',
          background: 'var(--surface)', border: '2px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '3px 3px 0 rgba(28,21,16,0.08)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 6 }}>
            SPENT SO FAR
          </div>
          <div style={{ fontWeight: 700, fontSize: 22, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
            {totalSpent > 0 ? fmt(totalSpent) : '₪0'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            on completed tasks
          </div>
        </div>

        {/* Still to spend */}
        <div style={{
          flex: '1 1 140px', padding: '16px 18px',
          background: 'var(--surface)', border: '2px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '3px 3px 0 rgba(28,21,16,0.08)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 6 }}>
            REMAINING
          </div>
          <div style={{ fontWeight: 700, fontSize: 22, fontFamily: 'var(--font-mono)' }}>
            {remaining > 0 ? fmt(remaining) : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            estimated still to spend
          </div>
        </div>

        {/* Budget card — only if budget is set */}
        {budget > 0 && (
          <div style={{
            flex: '1 1 140px', padding: '16px 18px',
            background: overBudget ? 'rgba(192,57,43,0.07)' : 'var(--surface)',
            border: `2px solid ${statusColor}`,
            borderRadius: 'var(--radius-lg)', boxShadow: '3px 3px 0 rgba(28,21,16,0.08)',
          }}>
            <div style={{ fontSize: 10, color: statusColor, letterSpacing: '0.08em', marginBottom: 6 }}>
              {overBudget ? 'OVER BUDGET' : 'BUDGET'}
            </div>
            <div style={{ fontWeight: 700, fontSize: 22, fontFamily: 'var(--font-mono)', color: statusColor }}>
              {fmt(budget)}
            </div>
            <Bar pct={budgetUsedPct} color={statusColor} />
            <div style={{ fontSize: 11, color: statusColor, marginTop: 6 }}>
              {overBudget
                ? `${fmt(totalEst - budget)} over budget`
                : `${fmt(budget - totalEst)} remaining in budget`}
            </div>
          </div>
        )}
      </div>

      {/* ── Phase breakdown ─────────────────────────────────────────────── */}
      {byPhase.filter((p) => p.totalCount > 0).length > 0 && (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-dim)',
            letterSpacing: '0.08em', marginBottom: 12,
          }}>
            COST BY PHASE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byPhase
              .filter((p) => p.totalCount > 0)
              .map(({ phase, est, spent, doneCount, totalCount }) => {
                const phasePct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
                const hasEstimates = est > 0;
                return (
                  <motion.div
                    key={phase.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: '12px 16px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${phase.color ?? 'var(--amber)'}`,
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{phase.name}</span>
                        <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 8 }}>
                          {doneCount}/{totalCount} tasks done
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {hasEstimates ? (
                          <>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--amber)' }}>
                              {fmt(est)}
                            </span>
                            {spent > 0 && (
                              <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 8 }}>
                                ({fmt(spent)} spent)
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>no estimates yet</span>
                        )}
                      </div>
                    </div>
                    <Bar pct={phasePct} color={phase.color ?? 'var(--amber)'} />
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── No data state ────────────────────────────────────────────────── */}
      {totalEst === 0 && allTasks.length === 0 && (
        <div style={{
          padding: '32px 24px', textAlign: 'center',
          border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)',
          color: 'var(--text-dim)', fontSize: 13,
        }}>
          No cost estimates yet. Ask the agent to add tasks — it will estimate Israeli market prices automatically.
        </div>
      )}

      {/* ── Budget tip if not set ────────────────────────────────────────── */}
      {!budget && totalEst > 0 && (
        <div style={{
          padding: '10px 14px', fontSize: 12, color: 'var(--text-dim)',
          background: 'var(--surface)', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}>
          💡 Tell the agent your budget (e.g. "my budget is ₪80,000") and it will track whether you're on track.
        </div>
      )}
    </div>
  );
}
