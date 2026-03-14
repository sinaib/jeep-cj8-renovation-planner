import { sendAgentMessage } from './agentClient';

let lastRunAt = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const MIN_INTERVAL_MS = 30_000; // max once per 30 seconds
const DEBOUNCE_MS = 5_000;      // wait 5s after last change

export function scheduleBackgroundAnalysis() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const now = Date.now();
    if (now - lastRunAt < MIN_INTERVAL_MS) return;
    lastRunAt = now;
    runBackgroundAnalysis();
  }, DEBOUNCE_MS);
}

async function runBackgroundAnalysis() {
  try {
    await sendAgentMessage(
      `[BACKGROUND ANALYSIS] The renovation plan has been updated. Silently review the full plan for: (1) unaddressed CJ8 1989 known failure points that have no corresponding task, (2) task dependencies that aren't captured (e.g. clutch job without slave cylinder), (3) any safety-critical items that are missing. Use flag_gap for critical findings only. Do NOT add tasks proactively — only flag gaps. Do not respond with text. Only use tools if you find something.`,
      {
        onToken: () => {},
        onToolCall: () => {},
        onToolResult: () => {},
        onDone: () => {},
        onError: () => {}, // Silent — background errors don't bother the user
      }
    );
  } catch {
    // Silent failure
  }
}
