// ─── Knowledge Layer Types ─────────────────────────────────────────────────
// Decisions, discoveries, log events, and parts library entries.

// ─── Decisions ───────────────────────────────────────────────────────────────

export type DecisionCategory =
  | 'build-direction'   // stock vs restomod, engine swap, lift height
  | 'part-selection'    // chose part A over B, ruled out alternatives
  | 'deferred'          // explicitly decided to skip/postpone with reason
  | 'approach'          // DIY vs shop, technique choice
  | 'budget';           // budget allocation, priority spending

export interface DecisionEntry {
  id: string;
  date: string;                  // ISO date
  category: DecisionCategory;
  title: string;                 // e.g. "Keep AMC 258 — rebuild vs. swap"
  decision: string;              // what was decided
  rationale: string;             // why
  alternativesConsidered?: string[];
  affectsSystemIds?: string[];
  affectsTaskIds?: string[];
  revisable: boolean;            // can this be revisited or is it locked in?
}

// ─── Discoveries ─────────────────────────────────────────────────────────────

export type DiscoverySeverity = 'info' | 'concern' | 'critical';

export interface DiscoveryEntry {
  id: string;
  date: string;                  // ISO date
  system: string;                // which system this was found on
  description: string;           // raw field note — what was found
  severity: DiscoverySeverity;
  photos?: string[];
  processedAt?: string;          // date when Claude Code processed this into car.ts/plan.ts
  resultedIn?: {
    carUpdate?: boolean;         // did this update car.ts?
    newTaskIds?: string[];       // any tasks added to plan as a result?
    decisionId?: string;         // did this force a decision?
  };
}

// ─── Event Log ───────────────────────────────────────────────────────────────

export type LogEventType =
  | 'task_completed'
  | 'task_added'
  | 'task_updated'
  | 'task_skipped'
  | 'phase_added'
  | 'part_ordered'
  | 'part_received'
  | 'part_installed'
  | 'discovery_logged'
  | 'decision_made'
  | 'system_updated'
  | 'plan_restructured'
  | 'session_start'
  | 'session_end'
  | 'knowledge_updated';

export interface LogEvent {
  id: string;
  timestamp: string;             // ISO datetime
  sessionDate: string;           // ISO date of the Claude Code session
  type: LogEventType;
  summary: string;               // human-readable description
  filesChanged: string[];        // which data files were modified
  relatedIds?: {
    taskId?: string;
    phaseId?: string;
    systemId?: string;
    decisionId?: string;
    discoveryId?: string;
  };
}

// ─── Parts Library ───────────────────────────────────────────────────────────

export type PartSource = 'jeepland' | 'import-us' | 'import-eu' | 'local-shop' | 'fabricate' | 'salvage';
export type PartStatus = 'needed' | 'researching' | 'ordered' | 'owned' | 'installed' | 'returned' | 'not-needed';

export interface PartLibraryEntry {
  id: string;                    // unique part id for cross-referencing
  name: string;
  system: string;                // which system it belongs to
  oemPartNumber?: string;
  aftermarketPartNumbers?: Record<string, string>;  // brand → part number
  jeeplandSku?: string;          // if available at Jeepland
  estimatedCostILS?: number;     // estimated cost in ₪
  actualCostILS?: number;        // what was actually paid
  source?: PartSource;           // where to get it
  status: PartStatus;
  taskId?: string;               // which task this part is for
  notes?: string;                // fitment notes, alternatives, warnings
  orderedAt?: string;
  receivedAt?: string;
  installedAt?: string;
}
