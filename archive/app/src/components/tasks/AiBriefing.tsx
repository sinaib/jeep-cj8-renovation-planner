import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task, TaskBriefing } from '../../types';
import { getTaskBriefing } from '../../ai/taskEnrichment';

interface AiBriefingProps {
  task: Task;
}

const DIFF_LABELS = ['', 'Easy', 'Moderate', 'Involved', 'Advanced', 'Expert'];

export function AiBriefing({ task }: AiBriefingProps) {
  const [briefing, setBriefing] = useState<TaskBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleFetch = async () => {
    if (briefing) { setExpanded((e) => !e); return; }
    setLoading(true);
    setError('');
    try {
      const result = await getTaskBriefing(task);
      setBriefing(result);
      setExpanded(true);
    } catch (e) {
      setError('Failed to load briefing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <button
        onClick={handleFetch}
        style={{
          width: '100%', padding: '12px 16px',
          background: expanded ? 'var(--surface-3)' : 'var(--surface-2)',
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 16 }}>⚡</span>
        <span style={{ flex: 1, fontWeight: 500, fontSize: 13, textAlign: 'left' }}>
          AI Technical Briefing
        </span>
        {loading && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            style={{ color: 'var(--amber)', fontSize: 11 }}
          >
            loading...
          </motion.span>
        )}
        {briefing && !loading && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
        {!briefing && !loading && (
          <span style={{ fontSize: 11, color: 'var(--amber)' }}>Get briefing →</span>
        )}
      </button>

      <AnimatePresence>
        {expanded && briefing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Overview */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {briefing.overview}
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)',
                  background: 'var(--surface-3)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>TIME</div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{briefing.estimatedTime}</div>
                </div>
                <div style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)',
                  background: 'var(--surface-3)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>DIFFICULTY</div>
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginBottom: 2 }}>
                    {[1,2,3,4,5].map((d) => (
                      <div key={d} style={{
                        width: 8, height: 8, borderRadius: 2,
                        background: d <= briefing.difficulty ? 'var(--amber)' : 'var(--border)',
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {DIFF_LABELS[briefing.difficulty]}
                  </div>
                </div>
              </div>

              {/* Tools needed */}
              {briefing.toolsNeeded.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    TOOLS NEEDED
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {briefing.toolsNeeded.map((tool, i) => (
                      <span key={i} style={{
                        padding: '2px 8px', borderRadius: 20, fontSize: 11,
                        background: 'var(--surface-3)', color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}>
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pro tips */}
              {briefing.proTips.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    CJ8 PRO TIPS
                  </div>
                  {briefing.proTips.map((tip, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 8, marginBottom: 4, fontSize: 12, color: 'var(--text-muted)',
                    }}>
                      <span style={{ color: 'var(--amber)', flexShrink: 0 }}>→</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Common mistakes */}
              {briefing.commonMistakes.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    COMMON MISTAKES
                  </div>
                  {briefing.commonMistakes.map((m, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 8, marginBottom: 4, fontSize: 12, color: 'var(--text-muted)',
                    }}>
                      <span style={{ color: 'var(--red)', flexShrink: 0 }}>!</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Safety warnings */}
              {briefing.safetyWarnings.length > 0 && (
                <div style={{
                  padding: '10px 12px', borderRadius: 'var(--radius)',
                  background: 'rgba(192, 57, 43, 0.1)', border: '1px solid var(--red)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    ⚠ SAFETY
                  </div>
                  {briefing.safetyWarnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Part suggestions */}
              {briefing.partSuggestions.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    SUGGESTED PARTS
                  </div>
                  {briefing.partSuggestions.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 6, background: 'var(--surface-3)',
                      border: '1px solid var(--border)', marginBottom: 4, fontSize: 12,
                    }}>
                      <span style={{ flex: 1 }}>{p.name}</span>
                      {p.partNumber && (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {p.partNumber}
                        </span>
                      )}
                      {p.estimatedCostILS && (
                        <span style={{ fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                          ₪{p.estimatedCostILS}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--red)' }}>{error}</div>
      )}
    </div>
  );
}
