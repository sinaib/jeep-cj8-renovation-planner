export type TaskStatus = 'flagged' | 'todo' | 'active' | 'done' | 'skipped';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type GapSeverity = 'critical' | 'warning' | 'suggestion';
export type AgentRole = 'user' | 'assistant';
export type ManualId = 'battlefield' | 'hebrew' | 'gimel';

export interface Part {
  id: string;
  name: string;
  estimatedCostILS?: number;
  partNumber?: string;
  supplier?: string;
  purchased: boolean;
  url?: string;           // link to product page (jeepland, aliexpress, etc.)
  addedBy?: 'agent' | 'user';  // distinguish manual vs agent-added
}

export interface ManualRef {
  manualId: ManualId;
  page: number;
  description: string;
}

export interface Task {
  id: string;
  name: string;
  systemId: string;
  phaseId: string;
  phaseOrder: number;
  status: TaskStatus;
  priority: Priority;
  estimatedCostILS?: number;
  actualCostILS?: number;
  parts: Part[];
  notes: string;
  manualRefs: ManualRef[];
  addedBy: 'agent' | 'user';
  agentRationale?: string;
  completedAt?: string;
  dependsOnTaskIds?: string[];
  steps?: string[];    // Persisted step-by-step guide — set by enrichment or agent
  guide?: string;      // Technical overview for this specific job
}

export interface Phase {
  id: string;
  order: number;
  name: string;
  subtitle: string;
  systemIds: string[];
  color: string;
  taskIds: string[];
}

export interface Gap {
  id: string;
  systemId: string;
  description: string;
  severity: GapSeverity;
  dismissed: boolean;
  convertedToTaskId?: string;
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: string;
}

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  toolCalls?: ToolCall[];
  timestamp: string;
}

// ─── New intelligence layer ───────────────────────────────────────────────

/** A project decision that was explicitly made and should be remembered */
export interface Decision {
  id: string;
  category: 'priority' | 'budget' | 'approach' | 'scope' | 'timeline' | 'supplier' | 'safety' | 'other';
  summary: string;       // One-line: "Will do all work DIY"
  rationale?: string;    // Why this decision was made
  madeAt: string;        // ISO timestamp
  madeBy: 'user' | 'agent';
}

/** A fact about this specific car and project context, built up over conversation */
export interface CarFact {
  id: string;
  key: string;           // e.g. "engine_condition", "mileage", "goals", "budget", "skills"
  value: string;         // The actual fact
  confirmedBy: 'user' | 'agent' | 'inspection';
  updatedAt: string;
}

/** A research finding from web search or agent knowledge, stored for ongoing reference */
export interface ResearchNote {
  id: string;
  topic: string;         // "AMC 258 common head gasket failure"
  finding: string;       // The actual insight/data
  source?: string;       // URL or "agent knowledge" or manual reference
  relevantTaskIds?: string[];
  addedAt: string;
}

/** Explicit dependency: taskId cannot be started until dependsOnTaskId is done */
export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
  reason: string;
}

// ─── File system ─────────────────────────────────────────────────────────────

/** Lightweight metadata stored in Zustand (no binary data) */
export interface FileMeta {
  id: string;
  taskId?: string;
  phaseId?: string;
  name: string;
  type: 'image' | 'pdf' | 'other';
  createdAt: string;
  size: number;           // bytes
  caption?: string;       // user label (kept in sync with IndexedDB record)
  analysisNote?: string;  // AI observation (kept in sync with IndexedDB record)
}

// ─── Legacy types kept for manual/briefing features ──────────────────────

export interface VehicleSystem {
  id: string;
  name: string;
  icon: string;
  subsystems: string[];
  commonFailurePoints: string[];
  inspectionChecklist: string[];
}

export interface Manual {
  id: ManualId;
  title: string;
  filename: string;
  pageCount: number;
  language: 'en' | 'he';
  description: string;
}

export interface TaskBriefing {
  overview: string;
  steps: string[];
  toolsNeeded: string[];
  commonMistakes: string[];
  estimatedTime: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  proTips: string[];
  partSuggestions: Array<{ name: string; partNumber?: string; estimatedCostILS?: number }>;
  safetyWarnings: string[];
}
