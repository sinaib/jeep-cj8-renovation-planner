import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { nanoid } from 'nanoid';
import { useRenovationStore } from '../../store/useRenovationStore';
import { getTaskBriefing } from '../../ai/taskEnrichment';
import {
  saveFile, listFilesForTask, deleteFile, updateFileAnalysis, updateFileCaption,
  type ProjectFile,
} from '../../store/fileStore';
import { analyzeImage } from '../../ai/agentClient';
import type { Task, TaskBriefing, TaskStatus, FileMeta } from '../../types';

interface TaskDetailViewProps {
  task: Task;
  onBack: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'todo',    label: 'TO DO',  color: 'var(--text-dim)' },
  { value: 'active',  label: 'ACTIVE', color: 'var(--amber)' },
  { value: 'done',    label: 'DONE',   color: 'var(--green)' },
  { value: 'skipped', label: 'SKIP',   color: 'var(--text-muted)' },
];

const DIFFICULTY_LABEL = ['', 'Very Easy', 'Easy', 'Moderate', 'Hard', 'Expert'];

export function TaskDetailView({ task, onBack }: TaskDetailViewProps) {
  const updateTaskStatus = useRenovationStore((s) => s.setTaskStatus);
  const addTaskNote = useRenovationStore((s) => s.addTaskNote);
  const markPartPurchased = useRenovationStore((s) => s.markPartPurchased);
  const updateTaskCost = useRenovationStore((s) => s.updateTaskCost);

  // Always get the live task from the store so status updates reflect immediately
  const liveTask = useRenovationStore((s) => s.tasks[task.id]) ?? task;

  const updateTask = useRenovationStore((s) => s.updateTask);

  const [briefing, setBriefing] = useState<TaskBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [costInput, setCostInput] = useState(
    liveTask.estimatedCostILS != null ? String(liveTask.estimatedCostILS) : ''
  );
  const [editingCost, setEditingCost] = useState(false);

  // Add-part form
  const addPartToTask = useRenovationStore((s) => s.addPartToTask);
  const [showAddPartForm, setShowAddPartForm] = useState(false);
  const [addPartName, setAddPartName] = useState('');
  const [addPartCost, setAddPartCost] = useState('');
  const [addPartUrl, setAddPartUrl] = useState('');

  // Advisor suggestions — track which have been added to plan
  const [addedSuggestionNames, setAddedSuggestionNames] = useState<Set<string>>(new Set());

  // Auto-regen guard — fire once per task open if steps are placeholder
  const hasAutoRegenned = useRef(false);

  // ── Files ────────────────────────────────────────────────────────────────
  const addFileToIndex = useRenovationStore((s) => s.addFileToIndex);
  const removeFileFromIndex = useRenovationStore((s) => s.removeFileFromIndex);
  const updateFileInIndex = useRenovationStore((s) => s.updateFileInIndex);

  const [taskFiles, setTaskFiles] = useState<ProjectFile[]>([]);
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionInput, setCaptionInput] = useState('');
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files from IndexedDB on mount
  useEffect(() => {
    listFilesForTask(liveTask.id).then(setTaskFiles);
  }, [liveTask.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    for (const file of files) {
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const type: ProjectFile['type'] =
            file.type.startsWith('image/') ? 'image'
            : file.type === 'application/pdf' ? 'pdf'
            : 'other';

          const newFile: ProjectFile = {
            id: nanoid(10),
            taskId: liveTask.id,
            name: file.name,
            type,
            mimeType: file.type,
            dataUrl,
            size: file.size,
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
          setTaskFiles((prev) => [...prev, newFile]);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input so re-uploading same file works
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = async (fileId: string) => {
    await deleteFile(fileId);
    removeFileFromIndex(fileId);
    setTaskFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleAnalyzeFile = async (file: ProjectFile) => {
    if (file.type !== 'image') return;
    setAnalyzingFileId(file.id);
    try {
      const note = await analyzeImage(
        { dataUrl: file.dataUrl, mimeType: file.mimeType, filename: file.name },
        `[Task: "${liveTask.name}" | System: ${liveTask.systemId}]`,
      );
      await updateFileAnalysis(file.id, note);
      updateFileInIndex(file.id, { analysisNote: note });
      setTaskFiles((prev) => prev.map((f) => f.id === file.id ? { ...f, analysisNote: note } : f));
    } finally {
      setAnalyzingFileId(null);
    }
  };

  const handleSaveCaption = async (fileId: string) => {
    await updateFileCaption(fileId, captionInput);
    updateFileInIndex(fileId, { caption: captionInput });
    setTaskFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, caption: captionInput } : f));
    setEditingCaptionId(null);
    setCaptionInput('');
  };

  const fetchBriefing = (forceRefresh = false) => {
    if (forceRefresh) {
      // Clear persisted steps so enrichment re-runs
      updateTask(liveTask.id, { steps: [], guide: undefined });
    }
    setBriefingLoading(true);
    setBriefingError(false);
    // Pass the live task WITHOUT steps if force-refreshing, so enrichment runs fresh
    const taskForFetch = forceRefresh ? { ...liveTask, steps: [], guide: undefined } : liveTask;
    getTaskBriefing(taskForFetch)
      .then((b) => { setBriefing(b); setBriefingLoading(false); })
      .catch(() => { setBriefingError(true); setBriefingLoading(false); });
  };

  useEffect(() => {
    // If task already has persisted steps, build briefing instantly — no API call
    if (liveTask.steps && liveTask.steps.length > 0) {
      setBriefing({
        overview: liveTask.guide ?? '',
        steps: liveTask.steps,
        toolsNeeded: [],
        commonMistakes: [],
        estimatedTime: 'Varies',
        difficulty: 3,
        proTips: [],
        partSuggestions: liveTask.parts.map((p) => ({ name: p.name, estimatedCostILS: p.estimatedCostILS })),
        safetyWarnings: [],
      });
      setBriefingLoading(false);
    } else {
      // No steps yet — auto-fetch (will save to store on success)
      fetchBriefing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTask.id]);

  // Auto-regen if persisted steps are placeholder content
  useEffect(() => {
    if (briefingLoading || hasAutoRegenned.current) return;
    if (!briefing) return;
    const isPlaceholder = briefing.steps.some(
      (s) => s.includes('Consult the CJ8 manual') || s.includes('Gather required tools before starting')
    );
    if (isPlaceholder) {
      hasAutoRegenned.current = true;
      fetchBriefing(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefing?.steps, briefingLoading]);

  const handleStatusClick = (status: TaskStatus) => {
    updateTaskStatus(liveTask.id, status);
  };

  const handleAddNote = () => {
    const text = noteInput.trim();
    if (!text) return;
    addTaskNote(liveTask.id, text);
    setNoteInput('');
    setShowNoteInput(false);
  };

  const handleSaveCost = () => {
    const val = parseFloat(costInput);
    if (!isNaN(val)) updateTaskCost(liveTask.id, val);
    setEditingCost(false);
  };

  const handleAddPart = () => {
    const name = addPartName.trim();
    if (!name) return;
    const cost = addPartCost ? parseFloat(addPartCost) : undefined;
    const url = addPartUrl.trim() || undefined;
    addPartToTask(liveTask.id, name, cost, undefined, url, 'user');
    setAddPartName('');
    setAddPartCost('');
    setAddPartUrl('');
    setShowAddPartForm(false);
  };

  const handleAddSuggestion = (partName: string, estimatedCostILS?: number, partNumber?: string) => {
    addPartToTask(liveTask.id, partName, estimatedCostILS, partNumber, undefined, 'agent');
    setAddedSuggestionNames((prev) => new Set([...prev, partName]));
  };

  const totalBriefingCost = briefing?.partSuggestions.reduce(
    (sum, p) => sum + (p.estimatedCostILS ?? 0), 0
  ) ?? 0;

  const totalTaskPartsCost = liveTask.parts.reduce(
    (sum, p) => sum + (p.estimatedCostILS ?? 0), 0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
    >
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={onBack}
          style={{
            color: 'var(--text-muted)',
            fontSize: 13,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            transition: 'all 0.15s',
          }}
        >
          ← Plan
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {liveTask.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
            {liveTask.systemId} · {liveTask.priority}
          </div>
        </div>

        {/* Status buttons */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {STATUS_OPTIONS.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => handleStatusClick(value)}
              style={{
                padding: '4px 9px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                border: `1px solid ${liveTask.status === value ? color : 'var(--border)'}`,
                background: liveTask.status === value ? `${color}22` : 'transparent',
                color: liveTask.status === value ? color : 'var(--text-dim)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>

        {/* Agent rationale */}
        {liveTask.agentRationale && (
          <div style={{
            marginBottom: 24,
            padding: '10px 14px',
            background: 'rgba(74,92,58,0.15)',
            border: '1px solid var(--olive)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            <span style={{ color: 'var(--olive)', fontWeight: 600, marginRight: 6 }}>WHY THIS TASK</span>
            {liveTask.agentRationale}
          </div>
        )}

        {/* Briefing loading skeleton */}
        {briefingLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: i === 1 ? 80 : 40,
                background: 'var(--surface-2)',
                borderRadius: 8,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
              Generating CJ8-specific guide...
            </div>
          </div>
        )}

        {briefingError && (
          <div style={{
            padding: '14px 16px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            fontSize: 13,
            marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ flex: 1 }}>
              Could not generate guide — ask the advisor below about this task, or try again.
            </span>
            <button
              onClick={() => fetchBriefing(true)}
              style={{
                padding: '5px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-muted)',
                fontSize: 11,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {briefing && !briefingLoading && (
          <>
            {/* Overview */}
            <Section title="OVERVIEW">
              <p style={{
                margin: 0,
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.6,
              }}>
                {briefing.overview}
              </p>
              <div style={{
                display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap',
              }}>
                <Stat label="TIME" value={briefing.estimatedTime} />
                <Stat label="DIFFICULTY" value={`${briefing.difficulty}/5 — ${DIFFICULTY_LABEL[briefing.difficulty]}`} />
                {liveTask.estimatedCostILS != null && (
                  <Stat
                    label="ESTIMATED COST"
                    value={`₪${liveTask.estimatedCostILS.toLocaleString()}`}
                    color="var(--amber)"
                  />
                )}
              </div>
            </Section>

            {/* Steps */}
            {briefing.steps.length > 0 && (
              <Section title="HOW TO DO THIS" action={
                <button
                  onClick={() => fetchBriefing(true)}
                  title="Regenerate guide from AI"
                  style={{
                    fontSize: 10, color: 'var(--text-dim)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', padding: '2px 4px',
                  }}
                >
                  ↺ regen
                </button>
              }>
                <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {briefing.steps.map((step, i) => (
                    <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--amber)',
                        fontWeight: 700,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{
                        fontSize: 13,
                        color: 'var(--text)',
                        lineHeight: 1.5,
                        paddingTop: 3,
                      }}>
                        {step.replace(/^Step \d+:\s*/i, '')}
                      </span>
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {/* Tools */}
            {briefing.toolsNeeded.length > 0 && (
              <Section title="TOOLS NEEDED">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {briefing.toolsNeeded.map((tool, i) => (
                    <span key={i} style={{
                      padding: '3px 10px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 20,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}>
                      {tool}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Safety warnings */}
            {briefing.safetyWarnings.length > 0 && (
              <Section title="⚠ SAFETY">
                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {briefing.safetyWarnings.map((w, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>{w}</li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Pro tips */}
            {briefing.proTips.length > 0 && (
              <Section title="PRO TIPS">
                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {briefing.proTips.map((tip, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tip}</li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Parts */}
            <Section title="PARTS">
              {/* Parts tracked in plan */}
              {liveTask.parts.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 8 }}>
                    FROM YOUR PLAN
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {liveTask.parts.map((part) => (
                      <div key={part.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px',
                        background: part.purchased ? 'rgba(39,174,96,0.08)' : 'var(--surface-2)',
                        border: `1px solid ${part.purchased ? 'var(--green)' : 'var(--border)'}`,
                        borderRadius: 8,
                      }}>
                        <input
                          type="checkbox"
                          checked={part.purchased}
                          onChange={() => markPartPurchased(liveTask.id, part.id)}
                          style={{ accentColor: 'var(--green)', flexShrink: 0 }}
                        />
                        <span style={{
                          flex: 1,
                          fontSize: 12,
                          color: part.purchased ? 'var(--text-dim)' : 'var(--text)',
                          textDecoration: part.purchased ? 'line-through' : 'none',
                        }}>
                          {part.url ? (
                            <a href={part.url} target="_blank" rel="noopener noreferrer"
                              style={{ color: 'inherit', textDecoration: 'underline' }}>
                              {part.name}
                            </a>
                          ) : part.name}
                          {part.partNumber && (
                            <span style={{ color: 'var(--text-dim)', marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                              #{part.partNumber}
                            </span>
                          )}
                          {part.url && (
                            <span style={{ marginLeft: 6, fontSize: 10 }}>🔗</span>
                          )}
                        </span>
                        {part.estimatedCostILS != null && (
                          <span style={{
                            fontSize: 11, color: 'var(--amber)',
                            fontFamily: 'var(--font-mono)', flexShrink: 0,
                          }}>
                            ₪{part.estimatedCostILS.toLocaleString()}
                          </span>
                        )}
                      </div>
                    ))}
                    {(() => {
                      const purchasedCost = liveTask.parts.filter((p) => p.purchased).reduce((sum, p) => sum + (p.estimatedCostILS ?? 0), 0);
                      const allPurchased = liveTask.parts.every((p) => p.purchased);
                      const anyPurchased = liveTask.parts.some((p) => p.purchased);
                      if (totalTaskPartsCost === 0) return null;
                      if (allPurchased) return (
                        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)', paddingRight: 4 }}>
                          ✓ All parts purchased — ₪{totalTaskPartsCost.toLocaleString()}
                        </div>
                      );
                      if (anyPurchased) return (
                        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', paddingRight: 4 }}>
                          ₪{purchasedCost.toLocaleString()} of ₪{totalTaskPartsCost.toLocaleString()} purchased
                        </div>
                      );
                      return (
                        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', paddingRight: 4 }}>
                          Total: ₪{totalTaskPartsCost.toLocaleString()}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Briefing suggestions */}
              {briefing.partSuggestions.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 8 }}>
                    {liveTask.parts.length > 0 ? 'ADVISOR SUGGESTIONS' : 'SUGGESTED PARTS'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {briefing.partSuggestions.map((part, i) => {
                      const alreadyAdded = addedSuggestionNames.has(part.name) ||
                        liveTask.parts.some((p) => p.name === part.name);
                      return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        opacity: alreadyAdded ? 0.5 : 0.8,
                      }}>
                        <span style={{
                          flex: 1, fontSize: 12, color: 'var(--text-muted)',
                        }}>
                          {part.name}
                          {part.partNumber && (
                            <span style={{ color: 'var(--text-dim)', marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                              #{part.partNumber}
                            </span>
                          )}
                        </span>
                        {part.estimatedCostILS != null && (
                          <span style={{
                            fontSize: 11, color: 'var(--text-dim)',
                            fontFamily: 'var(--font-mono)', flexShrink: 0,
                          }}>
                            ~₪{part.estimatedCostILS.toLocaleString()}
                          </span>
                        )}
                        {!alreadyAdded && (
                          <button
                            onClick={() => handleAddSuggestion(part.name, part.estimatedCostILS, part.partNumber)}
                            title="Add to my parts list"
                            style={{
                              flexShrink: 0,
                              width: 22, height: 22,
                              borderRadius: '50%',
                              border: '1px solid var(--border)',
                              background: 'var(--surface-2)',
                              color: 'var(--text-muted)',
                              fontSize: 14,
                              lineHeight: 1,
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            +
                          </button>
                        )}
                        {alreadyAdded && (
                          <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--green)' }}>✓</span>
                        )}
                      </div>
                    );
                    })}
                    {totalBriefingCost > 0 && (
                      <div style={{
                        textAlign: 'right', fontSize: 11,
                        color: 'var(--text-dim)', fontFamily: 'var(--font-mono)',
                        paddingRight: 4,
                      }}>
                        Estimated total: ~₪{totalBriefingCost.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manual add-part form */}
              {showAddPartForm ? (
                <div style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', fontWeight: 600 }}>
                    ADD PART
                  </div>
                  <input
                    placeholder="Part name *"
                    value={addPartName}
                    onChange={(e) => setAddPartName(e.target.value)}
                    autoFocus
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 6, color: 'var(--text)', fontSize: 12,
                      padding: '7px 10px', outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder="Cost ₪ (optional)"
                      type="number"
                      min="0"
                      value={addPartCost}
                      onChange={(e) => setAddPartCost(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 6, color: 'var(--text)', fontSize: 12,
                        padding: '7px 10px', outline: 'none',
                      }}
                    />
                    <input
                      placeholder="Link (optional)"
                      value={addPartUrl}
                      onChange={(e) => setAddPartUrl(e.target.value)}
                      style={{
                        flex: 2,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 6, color: 'var(--text)', fontSize: 12,
                        padding: '7px 10px', outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={handleAddPart}
                      disabled={!addPartName.trim()}
                      style={{
                        padding: '6px 16px',
                        background: 'var(--amber)', color: 'var(--bg)',
                        borderRadius: 6, border: 'none',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        opacity: addPartName.trim() ? 1 : 0.5,
                      }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setShowAddPartForm(false); setAddPartName(''); setAddPartCost(''); setAddPartUrl(''); }}
                      style={{
                        padding: '6px 14px',
                        background: 'transparent', color: 'var(--text-muted)',
                        borderRadius: 6, border: '1px solid var(--border)',
                        fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddPartForm(true)}
                  style={{
                    marginTop: 8,
                    width: '100%', padding: '8px',
                    background: 'transparent',
                    border: '1px dashed var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-dim)',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  + Add part manually
                </button>
              )}

              {liveTask.parts.length === 0 && briefing.partSuggestions.length === 0 && !showAddPartForm && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 4 }}>
                  No parts listed yet.
                </div>
              )}
            </Section>

            {/* Common mistakes */}
            {briefing.commonMistakes.length > 0 && (
              <Section title="COMMON MISTAKES">
                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {briefing.commonMistakes.map((m, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{m}</li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}

        {/* Notes */}
        <Section title="NOTES">
          {liveTask.notes && (
            <div style={{
              padding: '10px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              marginBottom: 10,
            }}>
              {liveTask.notes}
            </div>
          )}

          {showNoteInput ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add a note..."
                autoFocus
                rows={3}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text)',
                  fontSize: 12,
                  padding: '10px 12px',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleAddNote}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--amber)',
                    color: 'var(--bg)',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowNoteInput(false); setNoteInput(''); }}
                  style={{
                    padding: '6px 14px',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNoteInput(true)}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: 6,
                color: 'var(--text-dim)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              + Add note
            </button>
          )}
        </Section>

        {/* Files */}
        <Section
          title={`FILES${taskFiles.length > 0 ? ` (${taskFiles.length})` : ''}`}
          action={
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: 10, color: 'var(--amber)',
                background: 'none', border: 'none',
                cursor: 'pointer', padding: '2px 4px',
              }}
            >
              + Upload
            </button>
          }
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />

          {taskFiles.length === 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                padding: '20px',
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: 8,
                color: 'var(--text-dim)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 20 }}>📎</span>
              <span>Attach photos or documents</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Images, PDFs — stored locally</span>
            </button>
          )}

          {/* Image grid */}
          {taskFiles.filter((f) => f.type === 'image').length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginBottom: taskFiles.filter((f) => f.type !== 'image').length > 0 ? 12 : 0,
            }}>
              {taskFiles.filter((f) => f.type === 'image').map((file) => (
                <div key={file.id} style={{
                  position: 'relative',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                }}>
                  {/* Thumbnail */}
                  <div
                    style={{ cursor: 'pointer', lineHeight: 0 }}
                    onClick={() => setExpandedImageId(expandedImageId === file.id ? null : file.id)}
                  >
                    <img
                      src={file.dataUrl}
                      alt={file.name}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>

                  {/* Actions overlay */}
                  <div style={{
                    display: 'flex',
                    gap: 2,
                    padding: '4px 4px 2px',
                    background: 'var(--surface)',
                    borderTop: '1px solid var(--border)',
                  }}>
                    <button
                      onClick={() => handleAnalyzeFile(file)}
                      disabled={analyzingFileId === file.id}
                      title="Analyze with AI"
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        cursor: analyzingFileId === file.id ? 'default' : 'pointer',
                        fontSize: 10,
                        color: file.analysisNote ? 'var(--olive)' : 'var(--text-dim)',
                        padding: '2px',
                      }}
                    >
                      {analyzingFileId === file.id ? '⏳' : file.analysisNote ? '🔍✓' : '🔍'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingCaptionId(file.id);
                        setCaptionInput(file.caption ?? '');
                      }}
                      title="Add caption"
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 10,
                        color: file.caption ? 'var(--amber)' : 'var(--text-dim)',
                        padding: '2px',
                      }}
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      title="Delete"
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 10,
                        color: 'var(--text-dim)',
                        padding: '2px',
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Caption */}
                  {editingCaptionId === file.id ? (
                    <div style={{ padding: '4px 6px', background: 'var(--surface)' }}>
                      <input
                        autoFocus
                        value={captionInput}
                        onChange={(e) => setCaptionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCaption(file.id);
                          if (e.key === 'Escape') setEditingCaptionId(null);
                        }}
                        placeholder="Add caption..."
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--text)',
                          fontSize: 10,
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  ) : file.caption ? (
                    <div style={{
                      padding: '3px 6px',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      background: 'var(--surface)',
                      lineHeight: 1.3,
                    }}>
                      {file.caption}
                    </div>
                  ) : null}

                  {/* Analysis note */}
                  {file.analysisNote && expandedImageId === file.id && (
                    <div style={{
                      padding: '6px 8px',
                      fontSize: 10,
                      color: 'var(--text)',
                      background: 'rgba(74,92,58,0.15)',
                      borderTop: '1px solid var(--olive)',
                      lineHeight: 1.4,
                    }}>
                      <span style={{ color: 'var(--olive)', fontWeight: 600 }}>AI: </span>
                      {file.analysisNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Non-image files list */}
          {taskFiles.filter((f) => f.type !== 'image').map((file) => (
            <div key={file.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {file.type === 'pdf' ? '📄' : '📎'}
              </span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
                {(file.size / 1024).toFixed(0)}KB
              </span>
              <button
                onClick={() => handleDeleteFile(file.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  fontSize: 12,
                  padding: '2px 4px',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}

          {/* Upload more button when files exist */}
          {taskFiles.length > 0 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                marginTop: 6,
                padding: '5px 10px',
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: 6,
                color: 'var(--text-dim)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              + Add more
            </button>
          )}
        </Section>

        {/* Cost edit */}
        <Section title="COST ESTIMATE">
          {editingCost ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--amber)', fontSize: 13 }}>₪</span>
              <input
                type="number"
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                autoFocus
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontSize: 13,
                  padding: '4px 8px',
                  width: 120,
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCost();
                  if (e.key === 'Escape') setEditingCost(false);
                }}
              />
              <button
                onClick={handleSaveCost}
                style={{
                  padding: '4px 10px',
                  background: 'var(--amber)',
                  color: 'var(--bg)',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingCost(false)}
                style={{
                  padding: '4px 8px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingCost(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 16,
                fontWeight: 600,
                color: liveTask.estimatedCostILS != null ? 'var(--amber)' : 'var(--text-dim)',
              }}>
                {liveTask.estimatedCostILS != null
                  ? `₪${liveTask.estimatedCostILS.toLocaleString()}`
                  : 'Not set'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>✎</span>
            </button>
          )}
        </Section>

      </div>
    </motion.div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-dim)',
        letterSpacing: '0.1em',
        marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {title}
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {action}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: color ?? 'var(--text-muted)',
      }}>
        {value}
      </div>
    </div>
  );
}
