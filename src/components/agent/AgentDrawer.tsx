import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';
import { sendAgentMessage } from '../../ai/agentClient';

function parseApiError(err: string): string {
  try {
    const jsonStart = err.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(err.slice(jsonStart));
      const msg: string = parsed?.error?.message ?? parsed?.message ?? err;
      if (msg.toLowerCase().includes('credit balance')) {
        return 'Insufficient API credits. Go to console.anthropic.com → Billing to add credits.';
      }
      if (msg.toLowerCase().includes('authentication')) {
        return 'Invalid API key. Check VITE_ANTHROPIC_API_KEY in .env.local.';
      }
      return msg;
    }
  } catch {}
  return err;
}

interface AgentDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function AgentDrawer({ open, onClose }: AgentDrawerProps) {
  const agentHistory = useRenovationStore((s) => s.agentHistory);
  const streaming = useRenovationStore((s) => s.agentStreaming);
  const addAgentMessage = useRenovationStore((s) => s.addAgentMessage);
  const updateLastAgentMessage = useRenovationStore((s) => s.updateLastAgentMessage);
  const appState = useRenovationStore((s) => s.appState);

  const [input, setInput] = useState('');
  const [toolActivity, setToolActivity] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentHistory, toolActivity]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setToolActivity([]);

    addAgentMessage({ role: 'user', content: text });
    addAgentMessage({ role: 'assistant', content: '' });

    await sendAgentMessage(text, {
      onToken: (token) => {
        const last = useRenovationStore.getState().agentHistory.slice(-1)[0];
        updateLastAgentMessage((last?.content ?? '') + token);
      },
      onToolCall: (toolName, input) => {
        const label = formatToolLabel(toolName, input);
        setToolActivity((prev) => [...prev, label]);
      },
      onToolResult: (toolName, result) => {
        updateLastAgentMessage(useRenovationStore.getState().agentHistory.slice(-1)[0]?.content ?? '', [
          ...(useRenovationStore.getState().agentHistory.slice(-1)[0]?.toolCalls ?? []),
          { name: toolName, input: {}, result },
        ]);
      },
      onDone: (fullText, toolCalls) => {
        updateLastAgentMessage(fullText, toolCalls);
        setToolActivity([]);
      },
      onError: (error) => {
        updateLastAgentMessage(`⚠️ ${parseApiError(error)}`);
        setToolActivity([]);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayMessages = appState === 'onboarding'
    ? agentHistory
    : agentHistory.filter((m) => m.content.trim() !== '');

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 199,
            }}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
              zIndex: 200, background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            }}>
              <span style={{ fontSize: 18 }}>🔧</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Jeep Advisor</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CJ8 1989 specialist</div>
              </div>
              {streaming && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: 'var(--amber)',
                }}>
                  <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>●</motion.span>
                  thinking
                </div>
              )}
              <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 18, padding: 4 }}>×</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {displayMessages.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🚙</div>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>Your CJ8 advisor is ready</div>
                  <div style={{ fontSize: 12 }}>Tell me about your Jeep or ask anything about the renovation plan.</div>
                </div>
              )}

              {displayMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: msg.role === 'user' ? 'var(--amber-bg)' : 'var(--surface-2)',
                    border: `1px solid ${msg.role === 'user' ? 'var(--amber-dim)' : 'var(--border)'}`,
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    {msg.content || (msg.role === 'assistant' && streaming ? (
                      <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>●●●</motion.span>
                    ) : '')}

                    {/* Tool call indicators */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        {msg.toolCalls.map((tc, i) => (
                          <div key={i} style={{
                            fontSize: 10, color: 'var(--amber)',
                            fontFamily: 'var(--font-mono)',
                            marginBottom: 2,
                          }}>
                            ✓ {formatToolLabel(tc.name, tc.input as Record<string, unknown>)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Live tool activity */}
              {toolActivity.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '8px 12px', borderRadius: 10,
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    fontSize: 11, color: 'var(--amber)', fontFamily: 'var(--font-mono)',
                  }}>
                    {toolActivity.map((a, i) => (
                      <div key={i}>⚡ {a}</div>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: 12, borderTop: '1px solid var(--border)', flexShrink: 0,
            }}>
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
                  placeholder="Tell me about your Jeep... (Enter to send)"
                  rows={1}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text)', resize: 'none', fontSize: 13, lineHeight: 1.5,
                    maxHeight: 100, overflowY: 'auto',
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  style={{
                    background: input.trim() && !streaming ? 'var(--amber)' : 'var(--border)',
                    color: input.trim() && !streaming ? 'white' : 'var(--text-dim)',
                    borderRadius: 8, padding: '6px 10px', fontSize: 13,
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                >
                  →
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, textAlign: 'center' }}>
                The agent can update your plan, add tasks, and search for CJ8 technical data
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function formatToolLabel(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'add_task': return `Adding task: "${input.name}"`;
    case 'add_phase': return `Adding phase: "${input.name}"`;
    case 'update_task_status': return `Updating status → ${input.status}`;
    case 'add_task_note': return `Adding note`;
    case 'update_task_cost': return `Setting cost: ₪${input.costILS}`;
    case 'add_part_to_task': return `Adding part: "${input.partName}"`;
    case 'flag_gap': return `Flagging gap [${input.severity}]`;
    case 'remove_task': return `Removing task`;
    case 'move_task': return `Moving task to new phase`;
    case 'get_full_plan': return `Reading full plan`;
    default: return toolName;
  }
}
