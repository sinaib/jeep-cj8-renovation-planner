export type ChangelogEventType =
  | 'task_status'
  | 'task_added'
  | 'task_removed'
  | 'task_completed'
  | 'note_added'
  | 'cost_updated'
  | 'decision'
  | 'agent_turn'
  | 'snapshot'
  | 'agent_bulk_change'
  | 'history_compressed'   // conversation history compressed to save tokens
  | 'fast_query'           // simple query routed to fast (haiku) tier
  | 'proactive_analysis';  // background proactive analysis fired

export interface ChangelogEntry {
  t: string;                       // ISO timestamp
  type: ChangelogEventType;
  summary: string;                 // human-readable one-liner
  [key: string]: unknown;          // optional extra fields
}

/**
 * Append a change event to data/changelog.ndjson via the Vite server plugin.
 * Fire-and-forget — never throws, never blocks the UI.
 */
export async function logChange(entry: Omit<ChangelogEntry, 't'>): Promise<void> {
  try {
    const line = JSON.stringify({ t: new Date().toISOString(), ...entry });
    await fetch('/api/changelog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: line,
    });
  } catch {
    // Silently ignore — persistence is best-effort for changelog
  }
}

/**
 * Write a full project snapshot to data/snapshots/.
 * Called before bulk agent changes and from Settings.
 */
export async function saveSnapshot(stateJson: string): Promise<string | null> {
  try {
    const res = await fetch('/api/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stateJson,
    });
    if (res.ok) {
      const data = await res.json() as { file?: string };
      await logChange({ type: 'snapshot', summary: `Snapshot saved: ${data.file ?? 'unknown'}` });
      return data.file ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}
