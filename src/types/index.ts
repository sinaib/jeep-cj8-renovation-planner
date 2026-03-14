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
  toolsNeeded: string[];
  commonMistakes: string[];
  estimatedTime: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  proTips: string[];
  partSuggestions: Array<{ name: string; partNumber?: string; estimatedCostILS?: number }>;
  safetyWarnings: string[];
}
