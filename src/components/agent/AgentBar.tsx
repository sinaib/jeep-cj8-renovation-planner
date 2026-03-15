import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { nanoid } from 'nanoid';
import { motion, AnimatePresence } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';
import { sendAgentMessage, type PendingImage } from '../../ai/agentClient';
import { saveFile, type ProjectFile } from '../../store/fileStore';
import { PromptChips } from './PromptChips';
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

interface AgentBarProps {
  contextHint?: string;
  currentTask?: Task | null;
  currentPhase?: Phase | null;
}

export interface AgentBarHandle {
  sendPrompt: (text: string) => void;
}

function AgentBarInner(
  { contextHint, currentTask, currentPhase }: AgentBarProps,
  ref: React.ForwardedRef<AgentBarHandle>
) {
  const agentHistory = useRenovationStore((s) => s.agentHistory);
  const streaming = useRenovationStore((s) => s.agentStreaming);
  const addAgentMessage = useRenovationStore((s) => s.addAgentMessage);
  const updateLastAgentMessage = useRenovationStore((s) => s.updateLastAgentMessage);
  const addFileToIndex = useRenovationStore((s) => s.addFileToIndex);

  const [input, setInput] = useState('');
  const [toolActivity, setToolActivity] = useState<string[]>([]);
  const [pendingImage, setPendingImage] = useState<PendingImage & { previewUrl: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isSubmitting = useRef(false);

  const sendPromptRef = useRef<(text: string) => void>(() => {});
  useImperativeHandle(ref, () => ({ sendPrompt: (text) => sendPromptRef.current(text) }));

  // Smart tool labels using live store state
  const makeToolLabel = (toolName: string, input: Record<string, unknown>): string => {
    const { phases, tasks } = useRenovationStore.getState();
    const phaseCount = phases.length;
    const taskCount = Object.keys(tasks).length;

    switch (toolName) {
      case 'get_full_plan':
        return `Reviewing your ${phaseCount}-phase restoration plan (${taskCount} tasks)`;
      case 'add_task': {
        const phaseName = phases.find((p) => p.id === input.phaseId)?.name ?? (input.phaseId as string);
        return `Adding "${input.name}" → ${phaseName}`;
      }
      case 'add_phase':
        return `Creating phase: "${input.name}"`;
      case 'update_task_status': {
        const taskName = tasks[input.taskId as string]?.name ?? input.taskId;
        return `Marking "${taskName}" as ${input.status}`;
      }
      case 'add_task_note': {
        const taskName = tasks[input.taskId as string]?.name ?? input.taskId;
        return `Adding note to "${taskName}"`;
      }
      case 'update_task_cost': {
        const taskName = tasks[input.taskId as string]?.name ?? input.taskId;
        return `Cost for "${taskName}": ₪${input.costILS}`;
      }
      case 'add_part_to_task': {
        const taskName = tasks[input.taskId as string]?.name ?? input.taskId;
        return `Part "${input.partName}" → ${taskName}`;
      }
      case 'flag_gap':
        return `Gap flagged [${input.severity}]: ${String(input.description ?? '').slice(0, 50)}`;
      case 'remove_task': {
        const taskName = tasks[input.taskId as string]?.name ?? input.taskId;
        return `Removing "${taskName}"`;
      }
      case 'move_task': {
        const taskName = tasks[input.taskId as string]?.name ?? input.taskId;
        const destPhase = phases.find((p) => p.id === input.toPhaseId)?.name ?? input.toPhaseId;
        return `Moving "${taskName}" → ${destPhase}`;
      }
      case 'search_web':
        return `Searching: "${String(input.query ?? '').slice(0, 50)}"`;
      case 'set_car_fact':
        return `Car fact: ${input.key} = ${input.value}`;
      case 'record_decision':
        return `Decision: ${String(input.summary ?? '').slice(0, 60)}`;
      case 'add_research_note':
        return `Research: ${String(input.topic ?? '').slice(0, 50)}`;
      case 'set_task_dependency': {
        const taskName = tasks[input.taskId as string]?.name ?? input.taskId;
        const depName = tasks[input.dependsOnTaskId as string]?.name ?? input.dependsOnTaskId;
        return `${taskName} depends on ${depName}`;
      }
      case 'set_task_steps':
        return `Guide saved (${(input.steps as string[])?.length ?? 0} steps)`;
      case 'annotate_file':
        return `File annotated`;
      default:
        return toolName;
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentHistory, toolActivity]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || streaming || isSubmitting.current) return;
    isSubmitting.current = true;
    setInput('');
    setToolActivity([]);

    const contextPrefix = currentTask
      ? `[Viewing task: "${currentTask.name}" | task ID: ${currentTask.id} | phase: "${currentPhase?.name ?? currentTask.phaseId}" | system: ${currentTask.systemId}]\n`
      : '';
    const messageToSend = contextPrefix + (text || (pendingImage ? '(See attached image)' : ''));

    const displayText = text + (pendingImage ? (text ? ' 📎' : '📎 photo') : '');
    addAgentMessage({ role: 'user', content: displayText });
    addAgentMessage({ role: 'assistant', content: '' });

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
        setToolActivity((prev) => [...prev, makeToolLabel(toolName, inp)]);
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
        isSubmitting.current = false;
      },
      onError: (error) => {
        updateLastAgentMessage(`⚠️ ${parseApiError(error)}`);
        setToolActivity([]);
        isSubmitting.current = false;
      },
    }, imageCopy ?? undefined, {
      taskId: currentTask?.id,
      phaseId: currentPhase?.id,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayMessages = agentHistory.filter((m) => m.content.trim() !== '');
  const placeholder = contextHint ?? 'Ask your restoration advisor...';

  const handleChipSend = (prompt: string) => {
    setTimeout(() => {
      if (streaming || isSubmitting.current) return;
      isSubmitting.current = true;
      const contextPrefix = currentTask
        ? `[Viewing task: "${currentTask.name}" | task ID: ${currentTask.id} | phase: "${currentPhase?.name ?? currentTask.phaseId}" | system: ${currentTask.systemId}]\n`
        : '';
      addAgentMessage({ role: 'user', content: prompt });
      addAgentMessage({ role: 'assistant', content: '' });
      sendAgentMessage(contextPrefix + prompt, {
        onToken: (token) => {
          const last = useRenovationStore.getState().agentHistory.slice(-1)[0];
          updateLastAgentMessage((last?.content ?? '') + token);
        },
        onToolCall: (toolName, inp) => {
          setToolActivity((prev) => [...prev, makeToolLabel(toolName, inp)]);
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
          isSubmitting.current = false;
        },
        onError: (error) => {
          updateLastAgentMessage(`⚠️ ${parseApiError(error)}`);
          setToolActivity([]);
          isSubmitting.current = false;
        },
      }, undefined, { taskId: currentTask?.id, phaseId: currentPhase?.id });
    }, 0);
  };

  sendPromptRef.current = handleChipSend;

  const chipContext = currentTask ? 'task' : 'plan';

  return (
    <div style={{
      flex: '0 0 45%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface)',
      height: '100%',
      overflow: 'hidden',
      borderLeft: '1px solid var(--border)',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14 }}>🔧</span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--amber)',
        }}>
          RESTORATION ADVISOR
        </span>
        {streaming && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 'auto' }}
          >
            ● thinking
          </motion.span>
        )}
      </div>

      {/* Message history */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Empty state */}
        {displayMessages.length === 0 && toolActivity.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Your restoration advisor
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              Ask anything about your CJ8 build — parts, tasks, timelines, technical questions.
            </div>
          </div>
        )}

        {displayMessages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
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
                      ✓ {makeToolLabel(tc.name, tc.input as Record<string, unknown>)}
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
              padding: '7px 11px',
              borderRadius: 10,
              background: 'var(--surface-3, var(--surface-2))',
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

      {/* Prompt chips — only when idle and no conversation */}
      {!streaming && displayMessages.length === 0 && (
        <PromptChips
          context={chipContext}
          currentTask={currentTask}
          currentPhase={currentPhase}
          onSend={handleChipSend}
        />
      )}

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
              flexShrink: 0,
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

      {/* Input row — always at bottom */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border)',
        padding: '10px 14px',
      }}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />

        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          background: 'var(--surface-2)',
          border: `1px solid ${(input.trim() || pendingImage) ? 'var(--amber)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: '7px 8px',
          transition: 'border-color 0.15s',
        }}>
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

export const AgentBar = forwardRef(AgentBarInner);
AgentBar.displayName = 'AgentBar';
