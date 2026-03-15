// ─── Vehicle & System Types ────────────────────────────────────────────────
// These types define the living document of the car itself.
// car.ts (data) is the source of truth for vehicle state.

export type Condition = 'unknown' | 'poor' | 'fair' | 'good' | 'rebuilt' | 'replaced' | 'not-applicable';
export type AssemblyStatus = 'on-car' | 'removed' | 'partially-disassembled' | 'missing' | 'unknown';

export interface SystemHistoryEntry {
  date: string;                  // ISO date string
  event:
    | 'inspected'
    | 'disassembled'
    | 'removed'
    | 'cleaned'
    | 'repaired'
    | 'rebuilt'
    | 'replaced'
    | 'reinstalled'
    | 'tested'
    | 'skipped'
    | 'discovered'               // found something during inspection
    | 'noted';                   // general observation
  description: string;           // what was done or found
  condition: Condition;          // condition AFTER this event
  taskId?: string;               // the plan task that caused this event (if any)
  by: 'owner' | 'shop' | 'claude' | 'unknown';
  photos?: string[];             // photo filenames attached to this entry
  cost?: number;                 // ₪ spent if applicable
}

export interface CarSystem {
  id: string;                    // e.g. 'engine', 'frame', 'fuel'
  name: string;
  currentCondition: Condition;
  assemblyStatus: AssemblyStatus;
  notes: string;                 // free-form current notes
  lastUpdated: string;           // ISO date of last history entry
  linkedTaskIds: string[];       // task IDs in plan.ts that affect this system
  history: SystemHistoryEntry[];
}

export interface VehicleSpec {
  make: 'Jeep';
  model: 'CJ8 Scrambler';
  year: number;
  vin?: string;
  engine: string;                // e.g. 'AMC 258 4.2L inline-6'
  transmission?: string;         // e.g. 'T4 4-speed' or 'T5 5-speed'
  transferCase: string;          // e.g. 'Dana 300'
  frontAxle: string;             // e.g. 'Dana 30'
  rearAxle: string;              // e.g. 'AMC 20'
  wheelbase: string;             // '103.5"'
  gearRatio?: string;            // e.g. '3.54:1' or '4.10:1'
  hasTraction?: boolean;         // positraction / limited slip on rear
  mileage?: number;              // last known odometer reading
  mileageAsOf?: string;          // date of that reading
}

export interface CarFile {
  vehicle: VehicleSpec;
  systems: Record<string, CarSystem>;  // keyed by system id
  overallStatus: string;               // one-line summary: "Partially disassembled, assessment in progress"
  lastSessionDate?: string;            // when Claude Code last touched this file
}
