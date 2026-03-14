/**
 * agentBackground tests
 *
 * Tests the debounce, rate-limiting, and guard logic for all three
 * background analysis triggers. We use vitest fake timers and mock
 * `sendAgentMessage` to avoid real API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock sendAgentMessage — we don't want API calls in background tests
const mockSendAgentMessage = vi.fn().mockResolvedValue(undefined);
vi.mock('../../ai/agentClient', () => ({
  sendAgentMessage: mockSendAgentMessage,
}));

// Mock logChange
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));

// Mock store — agentBackground reads store state to check plan length and API key
vi.mock('../../store/useRenovationStore', () => {
  let _phases: unknown[] = [{ id: 'phase-1', name: 'Test Phase' }];
  let _dependencies: unknown[] = [];
  let _tasks: Record<string, unknown> = {};

  return {
    useRenovationStore: {
      getState: vi.fn(() => ({
        phases: _phases,
        tasks: _tasks,
        taskDependencies: _dependencies,
      })),
      // Allow tests to override state
      __setMockState: (state: { phases?: unknown[]; tasks?: Record<string, unknown>; deps?: unknown[] }) => {
        if (state.phases !== undefined) _phases = state.phases;
        if (state.tasks !== undefined) _tasks = state.tasks;
        if (state.deps !== undefined) _dependencies = state.deps;
      },
      __resetMockState: () => {
        _phases = [{ id: 'phase-1', name: 'Test Phase' }];
        _tasks = {};
        _dependencies = [];
      },
    },
  };
});

// We must import AFTER mocks are set up
const {
  scheduleBackgroundAnalysis,
  triggerTaskCompletedAnalysis,
  maybeRunWeeklyCheck,
  __resetTimersForTesting__,
// eslint-disable-next-line @typescript-eslint/no-require-imports
} = await import('../../ai/agentBackground');

// Helper to access mock state setter
const { useRenovationStore } = await import('../../store/useRenovationStore');
const storeHelper = useRenovationStore as unknown as {
  __setMockState: (s: unknown) => void;
  __resetMockState: () => void;
};

const WEEKLY_KEY = 'jeep-planner-last-weekly-check';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  storeHelper.__resetMockState();
  localStorage.clear();
  __resetTimersForTesting__(); // reset module-level lastRunAt and debounce timers
});

afterEach(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('scheduleBackgroundAnalysis — debounce', () => {

  it('does not fire immediately', async () => {
    scheduleBackgroundAnalysis();
    expect(mockSendAgentMessage).not.toHaveBeenCalled();
  });

  it('fires after 8-second debounce', async () => {
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(mockSendAgentMessage).toHaveBeenCalledTimes(1);
  });

  it('debounces: multiple calls within 8s result in single execution', async () => {
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(2_000);
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(2_000);
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(8_000); // only last timer fires
    expect(mockSendAgentMessage).toHaveBeenCalledTimes(1);
  });

  it('skips if no phases in store', async () => {
    storeHelper.__setMockState({ phases: [] });
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(mockSendAgentMessage).not.toHaveBeenCalled();
  });

  it('respects 10-minute rate limit: second call within 10 min is skipped', async () => {
    // First run
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(mockSendAgentMessage).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    // Second run — within 10 minutes
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(mockSendAgentMessage).not.toHaveBeenCalled(); // rate limited
  });

  it('fires again after 10-minute cooldown has passed', async () => {
    // First run
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(mockSendAgentMessage).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    // Advance past the 10-minute rate limit
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1000);

    // Now schedule again
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(mockSendAgentMessage).toHaveBeenCalledTimes(1);
  });

  it('calls sendAgentMessage with a background gap scan prompt', async () => {
    scheduleBackgroundAnalysis();
    await vi.advanceTimersByTimeAsync(8_000);
    const call = mockSendAgentMessage.mock.calls[0];
    expect(call[0]).toContain('[BACKGROUND GAP SCAN]');
    expect(call[0]).toContain('CJ8');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('triggerTaskCompletedAnalysis', () => {

  it('does NOT fire if no tasks are unblocked', async () => {
    // No dependencies — completing task-1 unblocks nothing
    storeHelper.__setMockState({
      tasks: { 'task-1': { id: 'task-1', name: 'Fix leak' } },
      deps: [], // no one depends on task-1
    });
    triggerTaskCompletedAnalysis('task-1', 'Fix leak');
    await vi.advanceTimersByTimeAsync(3_000);
    expect(mockSendAgentMessage).not.toHaveBeenCalled();
  });

  it('fires with 3-second delay when a task is unblocked', async () => {
    storeHelper.__setMockState({
      tasks: {
        'task-1': { id: 'task-1', name: 'Fix leak' },
        'task-2': { id: 'task-2', name: 'Engine tune' },
      },
      deps: [{ taskId: 'task-2', dependsOnTaskId: 'task-1', reason: 'leak first' }],
    });
    triggerTaskCompletedAnalysis('task-1', 'Fix leak');
    expect(mockSendAgentMessage).not.toHaveBeenCalled(); // not yet
    await vi.advanceTimersByTimeAsync(3_000);
    expect(mockSendAgentMessage).toHaveBeenCalledTimes(1);
  });

  it('prompt mentions the completed task name', async () => {
    storeHelper.__setMockState({
      tasks: {
        'task-1': { id: 'task-1', name: 'Frame rust treatment' },
        'task-2': { id: 'task-2', name: 'Paint frame' },
      },
      deps: [{ taskId: 'task-2', dependsOnTaskId: 'task-1', reason: 'paint after' }],
    });
    triggerTaskCompletedAnalysis('task-1', 'Frame rust treatment');
    await vi.advanceTimersByTimeAsync(3_000);
    const prompt = mockSendAgentMessage.mock.calls[0][0] as string;
    expect(prompt).toContain('Frame rust treatment');
    expect(prompt).toContain('[COMPLETION FOLLOW-UP]');
  });

  it('prompt mentions the unblocked task name', async () => {
    storeHelper.__setMockState({
      tasks: {
        'task-1': { id: 'task-1', name: 'Fix leak' },
        'task-2': { id: 'task-2', name: 'Carburetor rebuild' },
      },
      deps: [{ taskId: 'task-2', dependsOnTaskId: 'task-1', reason: 'fix first' }],
    });
    triggerTaskCompletedAnalysis('task-1', 'Fix leak');
    await vi.advanceTimersByTimeAsync(3_000);
    const prompt = mockSendAgentMessage.mock.calls[0][0] as string;
    expect(prompt).toContain('Carburetor rebuild');
  });

  it('debounces: rapid completions result in single delayed fire', async () => {
    storeHelper.__setMockState({
      tasks: {
        'task-1': { id: 'task-1', name: 'T1' },
        'task-2': { id: 'task-2', name: 'T2' },
      },
      deps: [{ taskId: 'task-2', dependsOnTaskId: 'task-1', reason: 'reason' }],
    });
    triggerTaskCompletedAnalysis('task-1', 'T1');
    triggerTaskCompletedAnalysis('task-1', 'T1'); // second call resets timer
    await vi.advanceTimersByTimeAsync(3_000);
    expect(mockSendAgentMessage).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('maybeRunWeeklyCheck', () => {

  it('does not fire if no phases in store', async () => {
    storeHelper.__setMockState({ phases: [] });
    maybeRunWeeklyCheck();
    await vi.advanceTimersByTimeAsync(100);
    expect(mockSendAgentMessage).not.toHaveBeenCalled();
  });

  it('fires when no prior run recorded', async () => {
    // No localStorage key = never ran before
    expect(localStorage.getItem(WEEKLY_KEY)).toBeNull();
    maybeRunWeeklyCheck();
    await vi.advanceTimersByTimeAsync(100);
    expect(mockSendAgentMessage).toHaveBeenCalledTimes(1);
  });

  it('sets localStorage timestamp when fired', () => {
    maybeRunWeeklyCheck();
    const timestamp = localStorage.getItem(WEEKLY_KEY);
    expect(timestamp).toBeTruthy();
    expect(parseInt(timestamp!)).toBeGreaterThan(0);
  });

  it('does NOT fire if ran less than 7 days ago', async () => {
    const sixDaysAgo = Date.now() - (6 * 24 * 60 * 60 * 1000);
    localStorage.setItem(WEEKLY_KEY, sixDaysAgo.toString());
    maybeRunWeeklyCheck();
    await vi.advanceTimersByTimeAsync(100);
    expect(mockSendAgentMessage).not.toHaveBeenCalled();
  });

  it('DOES fire if ran more than 7 days ago', async () => {
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
    localStorage.setItem(WEEKLY_KEY, eightDaysAgo.toString());
    maybeRunWeeklyCheck();
    await vi.advanceTimersByTimeAsync(100);
    expect(mockSendAgentMessage).toHaveBeenCalledTimes(1);
  });

  it('prompt includes WEEKLY HEALTH CHECK marker', async () => {
    maybeRunWeeklyCheck();
    await vi.advanceTimersByTimeAsync(100);
    const prompt = mockSendAgentMessage.mock.calls[0][0] as string;
    expect(prompt).toContain('[WEEKLY HEALTH CHECK]');
  });

  it('updates localStorage timestamp on each run', async () => {
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
    localStorage.setItem(WEEKLY_KEY, eightDaysAgo.toString());
    const before = parseInt(localStorage.getItem(WEEKLY_KEY)!);
    maybeRunWeeklyCheck();
    const after = parseInt(localStorage.getItem(WEEKLY_KEY)!);
    expect(after).toBeGreaterThan(before);
  });
});
