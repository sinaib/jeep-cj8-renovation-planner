import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';
import { sendAgentMessage } from '../../ai/agentClient';

export function OnboardingScreen() {
  const agentHistory = useRenovationStore((s) => s.agentHistory);
  const streaming = useRenovationStore((s) => s.agentStreaming);
  const addAgentMessage = useRenovationStore((s) => s.addAgentMessage);
  const updateLastAgentMessage = useRenovationStore((s) => s.updateLastAgentMessage);
  const finishOnboarding = useRenovationStore((s) => s.finishOnboarding);
  const phases = useRenovationStore((s) => s.phases);
  const tasks = useRenovationStore((s) => s.tasks);

  const [input, setInput] = useState('');
  const [started, setStarted] = useState(agentHistory.length > 0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentHistory]);

  useEffect(() => {
    if (started && agentHistory.length === 0) {
      // Kick off the first message from the agent
      triggerAgentStart();
    }
  }, [started]);

  const triggerAgentStart = async () => {
    addAgentMessage({ role: 'assistant', content: '' });

    const greeting = `Let's build your Jeep CJ8 1989 renovation plan together. I'll guide you through each major system, ask about its current state, and create a comprehensive plan based on what you tell me.

First, let me set up the phases for the plan — I'll organize everything by the logical order of work: critical safety and running issues first, then systems in sequence.

To start: **tell me about the engine**. Does the CJ8 currently start and run? Any oil leaks you've noticed? Rough idle or any obvious issues?`;

    // Create phases first via agent
    await sendAgentMessage(
      `[SYSTEM INIT] Please create the renovation phases for a CJ8 1989 restoration, then greet the user and ask about the engine. Create these phases in this order:
0: "Stop the Bleeding" - Critical leaks and urgent fixes
1: "Engine & Fuel" - Engine, fuel system, cooling
2: "Drivetrain" - Transmission, transfer case, driveshafts
3: "Steering" - Steering system
4: "Brakes" - Brake system
5: "Suspension" - Suspension system
6: "Electrical" - Electrical systems
7: "Body & Frame" - Body, frame, exterior
8: "Interior" - Interior and comfort
9: "Upgrades" - Custom upgrades

Use add_phase for each. Then greet the user with the message exactly: "${greeting}"`,
      {
        onToken: (token) => {
          const last = useRenovationStore.getState().agentHistory.slice(-1)[0];
          updateLastAgentMessage((last?.content ?? '') + token);
        },
        onToolCall: () => {},
        onToolResult: () => {},
        onDone: (_fullText, toolCalls) => {
          // Override with the clean greeting
          updateLastAgentMessage(greeting, toolCalls);
        },
        onError: (_error) => {
          updateLastAgentMessage(`Ready to start! Tell me about your Jeep CJ8 — what's its current condition?`);
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
        updateLastAgentMessage(`Error: ${err}`);
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

  if (!started) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            maxWidth: 520, width: '100%', textAlign: 'center',
          }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            style={{ fontSize: 64, marginBottom: 24 }}
          >
            🚙
          </motion.div>

          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--amber)' }}>
            CJ8 1989 Renovation Planner
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 15, lineHeight: 1.6 }}>
            Your AI mechanic advisor will guide you through building a complete renovation plan — system by system — tailored to your Jeep's actual condition.
          </p>

          <div style={{
            display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 40,
            flexWrap: 'wrap',
          }}>
            {['12 vehicle systems', 'Tracks all tasks', 'Live AI guidance', 'Parts & costs'].map((feat) => (
              <div key={feat} style={{
                padding: '6px 14px', borderRadius: 20,
                background: 'var(--surface)', border: '1px solid var(--border)',
                fontSize: 12, color: 'var(--text-muted)',
              }}>
                {feat}
              </div>
            ))}
          </div>

          <button
            onClick={() => setStarted(true)}
            style={{
              background: 'var(--amber)', color: 'white',
              padding: '14px 40px', borderRadius: 'var(--radius-lg)',
              fontSize: 15, fontWeight: 600, letterSpacing: '0.03em',
              boxShadow: '0 4px 24px rgba(212, 131, 42, 0.4)',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Start Building My Plan
          </button>

          <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-dim)' }}>
            Requires Anthropic API key in .env.local
          </p>
        </motion.div>
      </div>
    );
  }

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
              <div style={{ fontWeight: 600, fontSize: 14 }}>CJ8 Advisor</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Building your renovation plan
                {taskCount > 0 && ` · ${taskCount} task${taskCount !== 1 ? 's' : ''} added`}
              </div>
            </div>
            {streaming && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                style={{ marginLeft: 'auto', color: 'var(--amber)', fontSize: 11 }}
              >
                ● thinking
              </motion.div>
            )}
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

                {msg.toolCalls && msg.toolCalls.filter(tc => tc.name !== 'get_full_plan').length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    {msg.toolCalls.filter(tc => tc.name !== 'get_full_plan').map((tc, i) => (
                      <div key={i} style={{ fontSize: 10, color: 'var(--amber)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                        ✓ {tc.result}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input + finish button */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
          {phases.length > 0 && taskCount > 0 && (
            <button
              onClick={finishOnboarding}
              style={{
                width: '100%', marginBottom: 10,
                padding: '10px', borderRadius: 'var(--radius)',
                background: 'var(--olive-dim)', border: '1px solid var(--olive)',
                color: 'var(--text)', fontSize: 13, fontWeight: 500,
              }}
            >
              ✓ Plan looks good — start tracking ({taskCount} tasks)
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
              placeholder="Describe what you know about your Jeep..."
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
                transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Right: Live plan preview */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 24,
        background: 'var(--bg)',
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 8, fontWeight: 600 }}>
            YOUR RENOVATION PLAN — BUILDING LIVE
          </div>
          {taskCount === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
              Tasks will appear here as you describe your Jeep...
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {taskCount} task{taskCount !== 1 ? 's' : ''} added across {phases.length} phase{phases.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {[...phases].sort((a, b) => a.order - b.order).map((phase) => {
          const phaseTasks = phase.taskIds.map((id) => tasks[id]).filter(Boolean);
          return (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 20 }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 8,
              }}>
                <div style={{
                  width: 4, height: 16, borderRadius: 2,
                  background: phase.color ?? 'var(--olive)',
                }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Phase {phase.order}: {phase.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  ({phaseTasks.length})
                </span>
              </div>

              <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {phaseTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 6,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>○</span>
                    <span style={{ fontSize: 12, flex: 1 }}>{task.name}</span>
                    {task.estimatedCostILS && (
                      <span style={{ fontSize: 10, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                        ₪{task.estimatedCostILS.toLocaleString()}
                      </span>
                    )}
                    <span style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 10,
                      background: 'var(--surface-2)', color: 'var(--text-dim)',
                    }}>
                      {task.priority}
                    </span>
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
      </div>
    </div>
  );
}
