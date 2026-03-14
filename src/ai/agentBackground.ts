/**
 * agentBackground.ts
 *
 * Proactive background analysis — fires automatically at key moments
 * so the advisor surfaces insights without the user having to ask.
 *
 * Three trigger types:
 *
 *  1. scheduleBackgroundAnalysis() — debounced, fires after any plan
 *     change. Scans for CJ8-specific gaps not yet captured.
 *     Rate-limited to once per 10 minutes to avoid token waste.
 *
 *  2. triggerTaskCompletedAnalysis(taskId, taskName) — fires immediately
 *     when a task is marked done. Checks what's now unblocked and
 *     whether any dependencies were missed.
 *
 *  3. maybeRunWeeklyCheck() — called on app load, runs at most once
 *     per week. Scans for stale active tasks and structural plan gaps.
 *
 * All background calls use the full (sonnet) agent pipeline so they can
 * use tools. They are fully silent — no UI callbacks, no error popups.
 */

import { sendAgentMessage } from './agentClient';
import { useRenovationStore } from '../store/useRenovationStore';
import { logChange } from '../store/changelog';

// ─── 1. Debounced plan-change scan ────────────────────────────────────────────

let lastRunAt = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const MIN_INTERVAL_MS = 10 * 60 * 1000;  // once per 10 minutes max
const DEBOUNCE_MS = 8_000;               // wait 8s after last change

export function scheduleBackgroundAnalysis() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const now = Date.now();
    if (now - lastRunAt < MIN_INTERVAL_MS) return;
    lastRunAt = now;
    runPlanGapScan();
  }, DEBOUNCE_MS);
}

async function runPlanGapScan() {
  const store = useRenovationStore.getState();
  // Skip if no plan yet or no API key
  if (store.phases.length === 0) return;
  if (!import.meta.env.VITE_ANTHROPIC_API_KEY) return;

  logChange({
    type: 'proactive_analysis',
    summary: 'Background plan gap scan triggered',
  }).catch(() => {});

  try {
    await sendAgentMessage(
      `[BACKGROUND GAP SCAN] Silently review the full plan for CJ8 1989 restoration gaps. Check for: (1) CJ8-specific known failure points with no corresponding task, (2) missing safety-critical items, (3) task dependencies that aren't captured but are logically required. Use flag_gap for critical findings only. Do NOT add tasks and do NOT respond with text. Only call tools if you find something important.`,
      SILENT_CALLBACKS,
    );
  } catch {
    // Silent failure — background errors never bother the user
  }
}

// ─── 2. Post-completion analysis ─────────────────────────────────────────────
// Fires immediately when a task is marked done.
// Checks if newly-unblocked tasks need a heads-up note,
// and whether the completion exposed any new gaps.

let completionAnalysisTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerTaskCompletedAnalysis(taskId: string, taskName: string) {
  // Check if this completion actually unblocks anything
  const store = useRenovationStore.getState();
  const unblocked = store.taskDependencies
    .filter((d) => d.dependsOnTaskId === taskId)
    .map((d) => store.tasks[d.taskId])
    .filter(Boolean);

  // If nothing is unblocked, skip — not worth a call
  if (unblocked.length === 0) return;
  if (!import.meta.env.VITE_ANTHROPIC_API_KEY) return;

  // Slight delay so the store settles before the agent reads it
  if (completionAnalysisTimer) clearTimeout(completionAnalysisTimer);
  completionAnalysisTimer = setTimeout(async () => {
    const unblockedNames = unblocked.map((t) => `"${t.name}"`).join(', ');

    logChange({
      type: 'proactive_analysis',
      summary: `Post-completion analysis for "${taskName}" — ${unblocked.length} task(s) unblocked`,
      completedTaskId: taskId,
      unblockedCount: unblocked.length,
    }).catch(() => {});

    try {
      await sendAgentMessage(
        `[COMPLETION FOLLOW-UP] Task "${taskName}" was just marked done. These tasks are now unblocked: ${unblockedNames}. For each newly unblocked task: (1) check if its parts list and steps are already populated, and if not, populate them now; (2) add a brief note about anything to watch out for based on what was just completed. Use set_task_steps, add_part_to_task, add_task_note as needed. Do NOT respond with text.`,
        SILENT_CALLBACKS,
      );
    } catch {
      // Silent failure
    }
  }, 3_000);
}

// ─── 3. Weekly health check ──────────────────────────────────────────────────
// Runs at most once per week on app load.
// Looks for stale active tasks and structural plan gaps.

const WEEKLY_CHECK_KEY = 'jeep-planner-last-weekly-check';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function maybeRunWeeklyCheck() {
  if (!import.meta.env.VITE_ANTHROPIC_API_KEY) return;

  const store = useRenovationStore.getState();
  if (store.phases.length === 0) return; // no plan yet

  const lastRun = parseInt(localStorage.getItem(WEEKLY_CHECK_KEY) ?? '0');
  if (Date.now() - lastRun < ONE_WEEK_MS) return;

  localStorage.setItem(WEEKLY_CHECK_KEY, Date.now().toString());
  runWeeklyHealthCheck();
}

async function runWeeklyHealthCheck() {
  logChange({
    type: 'proactive_analysis',
    summary: 'Weekly plan health check triggered',
  }).catch(() => {});

  try {
    await sendAgentMessage(
      `[WEEKLY HEALTH CHECK] It's been a week since the last review. Silently scan the plan for: (1) tasks marked "active" with no recent notes (stale — may have been forgotten); add a note flagging them as potentially stale. (2) phases that are over-loaded (>10 tasks) that might benefit from being split; use flag_gap to note this. (3) any obvious missing phase for a complete CJ8 restoration (e.g. if there's no interior phase, no safety inspection phase). Flag gaps only for (3) — don't add tasks. Do NOT respond with text.`,
      SILENT_CALLBACKS,
    );
  } catch {
    // Silent failure
  }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────
// Resets module-level timer state so unit tests can run in isolation.
// Never called in production code.
export function __resetTimersForTesting__(): void {
  lastRunAt = 0;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  if (completionAnalysisTimer) clearTimeout(completionAnalysisTimer);
  completionAnalysisTimer = null;
}

// ─── Silent callbacks (used by all background calls) ─────────────────────────

const SILENT_CALLBACKS = {
  onToken: () => {},
  onToolCall: () => {},
  onToolResult: () => {},
  onDone: () => {},
  onError: () => {},
};
