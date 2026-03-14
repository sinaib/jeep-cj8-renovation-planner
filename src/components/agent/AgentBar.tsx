import React, { useState, useRef, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { motion, AnimatePresence } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';
import { sendAgentMessage, type PendingImage } from '../../ai/agentClient';
import { saveFile, type ProjectFile } from '../../store/fileStore';
import type { Task, Phase, FileMeta } from '../../types';

function parseApiError(err: string): string {
  try {
    const jsonStart = err.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(err.slice(jsonStart));
      const msg: string = parsed?.error?.message ?? parsed?.message ?? err;
      if (msg.toLowerCase().includes('credit balance'))
        return 'Insufficient API credits — go to console.anthropic.com → Billing.';
      if (msg.toLowerCase().includes('authentication'))
        return 'Invalid API key — check VITE_ANTHROPIC_API_KEY in .env.local.';
      return msg;
    }
  } catch {}
  return err;
}

function formatToolLabel(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'add_task':            return `Adding task: "${input.name}"`;
    case 'add_phase':           return `Adding phase: "${input.name}"`;
    case 'update_task_status':  return `Status → ${input.status}`;
    case 'add_task_note':       return `Adding note`;
    case 'update_task_cost':    return `Cost: ₪${input.costILS}`;
    case 'add_part_to_task':    return `Part: "${input.partName}"`;
    case 'flag_gap':            return `Gap flagged [${input.severity}]`;
    case 'remove_task':         return `Removing task`;
    case 'move_task':           return `Moving task`;
    case 'get_full_plan':       return `Reading plan`;
    case 'search_web':          return `Searching: "${String(input.query ?? '').slice(0, 40)}"`;
    case 'set_car_fact':        return `Car fact: ${input.key} = ${input.value}`;
    case 'record_decision':     return `Decision recorded`;
    case 'add_research_note':   return `Research: ${String(input.topic ?? '').slice(0, 40)}`;
    case 'set_task_dependency': return `Dependency set`;
    case 'set_task_steps':      return `Guide saved (${(input.steps as string[])?.length ?? 0} steps)`;
    case 'annotate_file':       return `File annotated`;
    default: return toolName;
  }
}

interface AgentBarProps {
  contextHint?: string;
  currentTask?: Task | null;
  currentPhase?: Phase | null;
}

export function AgentBar({ contextHint, currentTask, currentPhase }: AgentBarProps) {
  const agentHistory = useRenovationStore((s) => s.agentHistory);
  const streaming = useRenovationStore((s) => s.agentStreaming);
  const addAgentMessage = useRenovationStore((s) => s.addAgentMessage);
  const updateLastAgentMessage = useRenovationStore((s) => s.updateLastAgentMessage);
  const addFileToIndex = useRenovationStore((s) => s.addFileToIndex);

  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [toolActivity, setToolActivity] = useState<string[]>([]);
  const [pendingImage, setPendingImage] = useState<PendingImage & { previewUrl: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [expanded]);

  useEffect(() => {
    if (expanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentHistory, toolActivity, expanded]);

  useEffect(() => {
    if (streaming) setExpanded(true);
  }, [streaming]);

  // Clear pending image when task changes
  useEffect(() => {
    setPendingImage(null);
  }, [currentTask?.id]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingImage({
        dataUrl,
        mimeType: file.type,
        filename: file.name,
        previewUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || streaming) return;
    setInput('');
    setToolActivity([]);
    if (!expanded) setExpanded(true);

    const contextPrefix = currentTask
      ? `[Viewing task: "${currentTask.name}" | task ID: ${currentTask.id} | phase: "${currentPhase?.name ?? currentTask.phaseId}" | system: ${currentTask.systemId}]\n`
      : '';
    const messageToSend = contextPrefix + (text || (pendingImage ? '(See attached image)' : ''));

    // Display message in chat — show image indicator if attached
    const displayText = text + (pendingImage ? (text ? ' 📎' : '📎 photo') : '');
    addAgentMessage({ role: 'user', content: displayText });
    addAgentMessage({ role: 'assistant', content: '' });

    // Save the image to IndexedDB attached to the current task (if applicable)
    const imageCopy = pendingImage;
    setPendingImage(null);

    if (imageCopy && currentTask) {
      const newFile: ProjectFile = {
        id: nanoid(10),
        taskId: currentTask.id,
        name: imageCopy.filename ?? 'photo.jpg',
        type: 'image',
        mimeType: imageCopy.mimeType,
        dataUrl: imageCopy.dataUrl,
        size: Math.round((imageCopy.dataUrl.length * 3) / 4),
        createdAt: new Date().toISOString(),
      };
      await saveFile(newFile);
      const meta: FileMeta = {
        id: newFile.id,
        taskId: newFile.taskId,
        name: newFile.name,
        type: newFile.type,
        createdAt: newFile.createdAt,
        size: newFile.size,
      };
      addFileToIndex(meta);
    }

    await sendAgentMessage(messageToSend, {
      onToken: (token) => {
        const last = useRenovationStore.getState().agentHistory.slice(-1)[0];
        updateLastAgentMessage((last?.content ?? '') + token);
      },
      onToolCall: (toolName, inp) => {
        setToolActivity((prev) => [...prev, formatToolLabel(toolName, inp)]);
      },
      onToolResult: (toolName, result) => {
        const last = useRenovationStore.getState().agentHistory.slice(-1)[0];
        updateLastAgentMessage(last?.content ?? '', [
          ...(last?.toolCalls ?? []),
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
    }, imageCopy ?? undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setExpanded(false);
    }
  };

  const displayMessages = agentHistory.filter((m) => m.content.trim() !== '');
  const placeholder = contextHint ?? 'Ask your advisor...';

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Expanded chat history */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: '40vh' }}
            exit={{ height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '8px 16px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                🔧 JEEP ADVISOR
              </span>
              {streaming && (
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  style={{ marginLeft: 10, fontSize: 10, color: 'var(--amber)' }}
                >
                  ● thinking
                </motion.span>
              )}
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setExpanded(false)}
                style={{ color: 'var(--text-dim)', fontSize: 16, padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                ↓
              </button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {displayMessages.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-dim)', fontSize: 12 }}>
                  Your conversation will appear here
                </div>
              )}

              {displayMessages.map((msg) => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%',
                    padding: '9px 13px',
                    borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    background: msg.role === 'user' ? 'var(--amber-bg)' : 'var(--surface-2)',
                    border: `1px solid ${msg.role === 'user' ? 'var(--amber-dim)' : 'var(--border)'}`,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--text)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content || (msg.role === 'assistant' && streaming ? (
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        style={{ color: 'var(--text-dim)' }}
                      >
                        ●●●
                      </motion.span>
                    ) : '')}

                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div style={{
                        marginTop: 8, paddingTop: 6,
                        borderTop: '1px solid var(--border)',
                        display: 'flex', flexDirection: 'column', gap: 1,
                      }}>
                        {msg.toolCalls.map((tc, i) => (
                          <div key={i} style={{ fontSize: 10, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                            ✓ {formatToolLabel(tc.name, tc.input as Record<string, unknown>)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {toolActivity.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    padding: '7px 11px',
                    borderRadius: 10,
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    fontSize: 10,
                    color: 'var(--amber)',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex', flexDirection: 'column', gap: 1,
                  }}>
                    {toolActivity.map((a, i) => <div key={i}>⚡ {a}</div>)}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending image preview */}
      <AnimatePresence>
        {pendingImage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: '6px 14px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <img
              src={pendingImage.previewUrl}
              alt="pending"
              style={{
                width: 40, height: 40,
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid var(--amber)',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
              {pendingImage.filename ?? 'Photo ready to send'}
            </span>
            <button
              onClick={() => setPendingImage(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: 14,
                padding: '2px 6px',
              }}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        {/* Hidden file input for images */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />

        {/* Toggle button */}
        <button
          onClick={() => setExpanded((p) => !p)}
          title={expanded ? 'Collapse' : 'Show conversation'}
          style={{
            flexShrink: 0,
            width: 28, height: 28,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: expanded ? 'var(--amber-dim)' : 'transparent',
            color: expanded ? 'var(--amber)' : 'var(--text-dim)',
            fontSize: 10,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {expanded ? '↓' : '🔧'}
        </button>

        {/* Input area */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          background: 'var(--surface-2)',
          border: `1px solid ${(input.trim() || pendingImage) ? 'var(--amber)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '7px 8px',
          transition: 'border-color 0.15s',
        }}>
          {/* Paperclip — only when on a task */}
          {currentTask && (
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={streaming}
              title="Attach photo"
              style={{
                flexShrink: 0,
                width: 26, height: 26,
                borderRadius: 5,
                border: 'none',
                background: pendingImage ? 'var(--amber-dim)' : 'transparent',
                color: pendingImage ? 'var(--amber)' : 'var(--text-dim)',
                fontSize: 13,
                cursor: streaming ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              📎
            </button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setExpanded(true)}
            placeholder={streaming ? 'Advisor is thinking...' : placeholder}
            disabled={streaming}
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 13,
              resize: 'none',
              lineHeight: 1.4,
              maxHeight: 80,
              overflowY: 'auto',
              fontFamily: 'inherit',
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 80) + 'px';
            }}
          />

          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingImage) || streaming}
            style={{
              flexShrink: 0,
              width: 28, height: 28,
              borderRadius: 6,
              border: 'none',
              background: (input.trim() || pendingImage) && !streaming ? 'var(--amber)' : 'var(--border)',
              color: (input.trim() || pendingImage) && !streaming ? '#fff' : 'var(--text-dim)',
              fontSize: 14,
              cursor: (input.trim() || pendingImage) && !streaming ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
