import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';
import { sendAgentMessage } from '../../ai/agentClient';

function parseApiError(err: string): string {
  try {
    const jsonStart = err.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(err.slice(jsonStart));
      const msg: string = parsed?.error?.message ?? parsed?.message ?? err;
      if (msg.toLowerCase().includes('credit balance')) {
        return 'Insufficient API credits. Go to console.anthropic.com → Billing to add credits, then refresh.';
      }
      if (msg.toLowerCase().includes('authentication')) {
        return 'Invalid API key. Check VITE_ANTHROPIC_API_KEY in .env.local, then refresh.';
      }
      return msg;
    }
  } catch {}
  return err;
}

export function OnboardingScreen() {
  const agentHistory = useRenovationStore((s) => s.agentHistory);
  const streaming = useRenovationStore((s) => s.agentStreaming);
  const addAgentMessage = useRenovationStore((s) => s.addAgentMessage);
  const updateLastAgentMessage = useRenovationStore((s) => s.updateLastAgentMessage);
  const finishOnboarding = useRenovationStore((s) => s.finishOnboarding);
  const resetAll = useRenovationStore((s) => s.resetAll);
  const phases = useRenovationStore((s) => s.phases);
  const tasks = useRenovationStore((s) => s.tasks);
  const carFacts = useRenovationStore((s) => s.carFacts);
  const decisions = useRenovationStore((s) => s.decisions);
  const researchNotes = useRenovationStore((s) => s.researchNotes);

  const [input, setInput] = useState('');
  const [started, setStarted] = useState(agentHistory.length > 0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentHistory]);

  useEffect(() => {
    if (started && agentHistory.length === 0) {
      triggerAgentStart();
    }
  }, [started]);

  const triggerAgentStart = async () => {
    addAgentMessage({ role: 'assistant', content: '' });

    // The agent starts completely free — no pre-defined structure, no script.
    // It will research the CJ8 1989, record base facts, then ask the user open questions.
    await sendAgentMessage(
      `[ASSESSMENT START]
You are beginning a fresh restoration assessment for a Jeep CJ8 1989 Scrambler.

Your job right now:
1. Search the web for "Jeep CJ8 1989 Scrambler restoration common issues" to refresh your knowledge of this specific vehicle
2. Record the base vehicle fact using set_car_fact: key="vehicle", value="Jeep CJ8 Scrambler 1989"
3. Add a research note with your most important findings from the search
4. Then greet the user and ask them ONE open question to start understanding their specific car's situation

Do NOT create any phases or tasks yet. Do NOT follow a script. Start the conversation by asking about this specific car — its current state, what they know about it, what's wrong with it. Be direct and human.

Your opening question should be broad enough to let them tell the story of the car in their own words.`,
      {
        onToken: (token) => {
          const last = useRenovationStore.getState().agentHistory.slice(-1)[0];
          updateLastAgentMessage((last?.content ?? '') + token);
        },
        onToolCall: () => {},
        onToolResult: () => {},
        onDone: (fullText, toolCalls) => {
          updateLastAgentMessage(fullText, toolCalls);
        },
        onError: (error) => {
          const msg = parseApiError(error);
          updateLastAgentMessage(`⚠️ ${msg}\n\nOnce fixed, refresh the page to try again.`);
        },
      }
    );
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    addAgentMessage({ role: 'user', content: text });
    addAgentMessage({ role: 'assistant', content: '' });

    await sendAgentMessage(text, {
      onToken: (token) => {
        const last = useRenovationStore.getState().agentHistory.slice(-1)[0];
        updateLastAgentMessage((last?.content ?? '') + token);
      },
      onToolCall: () => {},
      onToolResult: () => {},
      onDone: (fullText, toolCalls) => {
        updateLastAgentMessage(fullText, toolCalls);
      },
      onError: (err) => {
        updateLastAgentMessage(`⚠️ ${parseApiError(err)}`);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const taskCount = Object.keys(tasks).length;
  const phaseCount = phases.length;

  // ── Landing screen ─────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-mono)',
      }}>
        {/* Top status bar */}
        <div style={{
          padding: '10px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 16,
          fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em',
        }}>
          <span style={{ color: 'var(--amber)' }}>● SYSTEM READY</span>
          <span>JEEP CJ8 1989 — RESTORATION ADVISOR</span>
          <span style={{ marginLeft: 'auto' }}>v2.0</span>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 0 }}>
          {/* Left panel */}
          <div style={{
            flex: '0 0 55%', padding: '48px 40px',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ marginBottom: 40 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.15em', marginBottom: 8 }}>
                  VEHICLE
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--amber)', letterSpacing: '0.05em', lineHeight: 1.2 }}>
                  JEEP CJ8<br />SCRAMBLER 1989
                </div>
              </div>

              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 16 }}>
                  ADVISOR CAPABILITIES
                </div>
                {[
                  { icon: '◈', text: 'Researches your specific car from online sources, forums, and technical databases' },
                  { icon: '◈', text: 'Builds a unique understanding of your vehicle\'s state through conversation' },
                  { icon: '◈', text: 'Maps task dependencies — understands what must happen before what' },
                  { icon: '◈', text: 'Tracks decisions, research findings, and evolving context across sessions' },
                  { icon: '◈', text: 'Proactively flags gaps based on known failure patterns for this model' },
                  { icon: '◈', text: 'Plan updates continuously as you share new information' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}
                  >
                    <span style={{ color: 'var(--olive)', fontSize: 10, marginTop: 2, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em', lineHeight: 1.5 }}>{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em' }}>
              STATUS: <span style={{ color: 'var(--amber)' }}>AWAITING ASSESSMENT</span>
            </div>
          </div>

          {/* Right panel */}
          <div style={{
            flex: 1, padding: '48px 40px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', marginBottom: 20 }}>
                ASSESSMENT PROTOCOL
              </div>

              {[
                { label: 'PHASE 1', value: 'Research vehicle history & known issues', status: 'pending' },
                { label: 'PHASE 2', value: 'Interview: current state of your car', status: 'pending' },
                { label: 'PHASE 3', value: 'Build plan based on findings', status: 'pending' },
                { label: 'PHASE 4', value: 'Map dependencies & optimal order', status: 'pending' },
                { label: 'ONGOING', value: 'Refine as work progresses', status: 'continuous' },
              ].map(({ label, value, status }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  style={{
                    display: 'flex', gap: 16,
                    padding: '8px 0', borderBottom: '1px solid var(--border)',
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: 'var(--text-dim)', letterSpacing: '0.08em', flexShrink: 0, width: 64 }}>{label}</span>
                  <span style={{ color: 'var(--text-muted)', flex: 1 }}>{value}</span>
                  <span style={{ color: status === 'continuous' ? 'var(--olive)' : 'var(--border-light)', fontSize: 9, letterSpacing: '0.1em' }}>
                    {status === 'continuous' ? 'LIVE' : '○'}
                  </span>
                </motion.div>
              ))}

              <motion.div
                style={{ marginTop: 20, fontSize: 11, color: 'var(--text-dim)' }}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
              >
                █
              </motion.div>
            </div>

            <div>
              <motion.button
                onClick={() => setStarted(true)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%', padding: '16px 24px',
                  background: 'var(--amber)',
                  border: 'none', borderRadius: 4,
                  color: 'white', fontFamily: 'var(--font-mono)',
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
                  cursor: 'pointer',
                  boxShadow: '0 0 40px rgba(212,131,42,0.25)',
                }}
              >
                START ASSESSMENT →
              </motion.button>
              <div style={{
                marginTop: 10, fontSize: 9, color: 'var(--text-dim)',
                letterSpacing: '0.08em', textAlign: 'center',
              }}>
                REQUIRES ANTHROPIC API KEY IN .env.local
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Active assessment / conversation ──────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', gap: 0,
    }}>
      {/* Left: Chat */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 600,
        borderRight: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔧</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Jeep Advisor</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                CJ8 1989 specialist
                {taskCount > 0 && ` · ${taskCount} task${taskCount !== 1 ? 's' : ''} · ${phaseCount} phase${phaseCount !== 1 ? 's' : ''}`}
              </div>
            </div>
            {/* Live intel badges */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              {researchNotes.length > 0 && (
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'var(--olive-dim)', color: 'var(--olive)', border: '1px solid var(--olive)', letterSpacing: '0.06em' }}>
                  {researchNotes.length} research
                </span>
              )}
              {decisions.length > 0 && (
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-dim)', border: '1px solid var(--border)', letterSpacing: '0.06em' }}>
                  {decisions.length} decisions
                </span>
              )}
              {carFacts.length > 0 && (
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-dim)', border: '1px solid var(--border)', letterSpacing: '0.06em' }}>
                  {carFacts.length} facts
                </span>
              )}
              {streaming && (
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  style={{ color: 'var(--amber)', fontSize: 11 }}
                >
                  ● thinking
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {agentHistory.filter((m) => m.content).map((msg) => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%', padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? 'var(--olive-dim)' : 'var(--surface)',
                border: `1px solid ${msg.role === 'user' ? 'var(--olive)' : 'var(--border)'}`,
                fontSize: 13, lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content || (msg.role === 'assistant' && streaming ? (
                  <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                    ● ● ●
                  </motion.span>
                ) : null)}

                {msg.toolCalls && msg.toolCalls.filter(tc => !['get_full_plan'].includes(tc.name)).length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    {msg.toolCalls
                      .filter(tc => !['get_full_plan'].includes(tc.name))
                      .map((tc, i) => (
                        <div key={i} style={{
                          fontSize: 10,
                          color: tc.name === 'search_web' ? 'var(--text-muted)'
                               : tc.name === 'add_research_note' ? 'var(--olive)'
                               : tc.name === 'record_decision' ? 'var(--amber)'
                               : tc.name === 'set_car_fact' ? 'var(--text-muted)'
                               : 'var(--amber)',
                          fontFamily: 'var(--font-mono)', marginBottom: 2,
                        }}>
                          {tc.name === 'search_web' ? '🔍' : tc.name === 'add_research_note' ? '📝' : tc.name === 'record_decision' ? '⚑' : tc.name === 'set_car_fact' ? '◈' : '✓'} {tc.result}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input + finish button */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
          {phaseCount > 0 && taskCount > 0 && (
            <button
              onClick={finishOnboarding}
              style={{
                width: '100%', marginBottom: 10,
                padding: '10px', borderRadius: 'var(--radius)',
                background: 'var(--olive-dim)', border: '1px solid var(--olive)',
                color: 'var(--text)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              ✓ Plan looks good — start tracking ({taskCount} tasks, {phaseCount} phases)
            </button>
          )}
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)', padding: '8px 12px',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me about your Jeep..."
              rows={2}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', resize: 'none', fontSize: 13, lineHeight: 1.5,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              style={{
                background: input.trim() && !streaming ? 'var(--amber)' : 'var(--border)',
                color: 'white', borderRadius: 8, padding: '8px 12px', fontSize: 14,
                transition: 'all 0.15s', flexShrink: 0, cursor: input.trim() && !streaming ? 'pointer' : 'default',
              }}
            >
              →
            </button>
          </div>
          <button
            onClick={() => { resetAll(); setStarted(false); }}
            style={{
              fontSize: 10, color: 'var(--text-dim)', marginTop: 4,
              textDecoration: 'underline', background: 'none', border: 'none',
              cursor: 'pointer', display: 'block', width: '100%', textAlign: 'center',
            }}
          >
            Start over
          </button>
        </div>
      </div>

      {/* Right: Live plan building in real time */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: 'var(--bg)' }}>
        {/* Header row */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-dim)', fontWeight: 600 }}>
            PLAN — BUILDING LIVE
          </div>
          {taskCount > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {taskCount} task{taskCount !== 1 ? 's' : ''} · {phaseCount} phase{phaseCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Car facts sidebar */}
        {carFacts.length > 0 && (
          <div style={{
            marginBottom: 20, padding: '10px 14px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>
              CAR PROFILE
            </div>
            {carFacts.map((f) => (
              <div key={f.id} style={{ display: 'flex', gap: 8, fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: 'var(--olive)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>◈</span>
                <span style={{ color: 'var(--text-dim)' }}>{f.key.replace(/_/g, ' ')}:</span>
                <span style={{ color: 'var(--text-muted)', flex: 1 }}>{f.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {taskCount === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
            {streaming ? 'Researching your Jeep...' : 'Tasks will appear here as the advisor builds your plan...'}
          </div>
        )}

        {/* Phases + tasks */}
        {[...phases].sort((a, b) => a.order - b.order).map((phase) => {
          const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
          return (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 20 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 4, height: 16, borderRadius: 2,
                  background: phase.color ?? 'var(--olive)',
                }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Phase {phase.order}: {phase.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  ({phaseTasks.length})
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>{phase.subtitle}</span>
              </div>

              <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {phaseTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '6px 10px', borderRadius: 6,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                    }}
                  >
                    <span style={{
                      fontSize: 10, marginTop: 2, flexShrink: 0,
                      color: task.priority === 'critical' ? 'var(--red)' : task.priority === 'high' ? 'var(--amber)' : 'var(--text-dim)',
                    }}>
                      {task.priority === 'critical' ? '⚠' : task.priority === 'high' ? '!' : '○'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12 }}>{task.name}</div>
                      {task.agentRationale && (
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, fontStyle: 'italic' }}>
                          {task.agentRationale.slice(0, 80)}{task.agentRationale.length > 80 ? '…' : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                      {task.estimatedCostILS && (
                        <span style={{ fontSize: 10, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                          ₪{task.estimatedCostILS.toLocaleString()}
                        </span>
                      )}
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 10,
                        background: task.priority === 'critical' ? 'rgba(192,57,43,0.12)' : 'var(--surface-2)',
                        color: task.priority === 'critical' ? 'var(--red)' : 'var(--text-dim)',
                        border: `1px solid ${task.priority === 'critical' ? 'var(--red)' : 'var(--border)'}`,
                      }}>
                        {task.priority}
                      </span>
                    </div>
                  </motion.div>
                ))}
                {phaseTasks.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 10px' }}>
                    No tasks yet...
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Decisions + Research preview */}
        {(decisions.length > 0 || researchNotes.length > 0) && (
          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
            {decisions.length > 0 && (
              <div style={{
                flex: 1, padding: '10px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', fontSize: 11,
              }}>
                <div style={{ color: 'var(--amber)', letterSpacing: '0.08em', marginBottom: 6, fontSize: 10, fontWeight: 600 }}>
                  ⚑ {decisions.length} DECISION{decisions.length !== 1 ? 'S' : ''}
                </div>
                {decisions.slice(-3).map((d) => (
                  <div key={d.id} style={{ color: 'var(--text-dim)', marginBottom: 3 }}>
                    · {d.summary}
                  </div>
                ))}
              </div>
            )}
            {researchNotes.length > 0 && (
              <div style={{
                flex: 1, padding: '10px 12px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', fontSize: 11,
              }}>
                <div style={{ color: 'var(--olive)', letterSpacing: '0.08em', marginBottom: 6, fontSize: 10, fontWeight: 600 }}>
                  📝 {researchNotes.length} RESEARCH NOTE{researchNotes.length !== 1 ? 'S' : ''}
                </div>
                {researchNotes.slice(-3).map((n) => (
                  <div key={n.id} style={{ color: 'var(--text-dim)', marginBottom: 3 }}>
                    · {n.topic}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
