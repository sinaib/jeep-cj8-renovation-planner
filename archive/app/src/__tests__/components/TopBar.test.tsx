/**
 * TopBar component tests
 *
 * TopBar now uses useResolvedTasks/useResolvedPhases from usePlanData.
 * We mock those hooks to control what data the component sees.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '../../components/layout/TopBar';
import type { Task, Phase } from '../../types';

vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
  maybeRunWeeklyCheck: vi.fn(),
}));
vi.mock('../../store/changelog', () => ({ logChange: vi.fn() }));
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) =>
      <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock usePlanData so we can control tasks/phases
const mockTasks: Record<string, Partial<Task>> = {};
const mockPhases: Partial<Phase>[] = [];
vi.mock('../../hooks/usePlanData', () => ({
  useResolvedTasks: () => mockTasks,
  useResolvedPhases: () => mockPhases,
}));

function clearMocks() {
  for (const k of Object.keys(mockTasks)) delete mockTasks[k];
  mockPhases.length = 0;
}

describe('TopBar', () => {
  it('does not show critical badge when no critical tasks', () => {
    clearMocks();
    const { container } = render(<TopBar onSettingsOpen={vi.fn()} />);
    expect(container.querySelector('[title="Jump to critical tasks"]')).toBeNull();
    expect(screen.queryByText(/critical/i)).toBeNull();
  });

  it('shows critical badge when critical tasks exist', () => {
    clearMocks();
    mockTasks['t1'] = { id: 't1', status: 'todo', priority: 'critical', estimatedCostILS: 0 } as Task;
    render(<TopBar onSettingsOpen={vi.fn()} />);
    expect(screen.getByText(/critical/i)).toBeTruthy();
  });

  it('critical badge is a button element', () => {
    clearMocks();
    mockTasks['t1'] = { id: 't1', status: 'todo', priority: 'critical', estimatedCostILS: 0 } as Task;
    const { container } = render(<TopBar onSettingsOpen={vi.fn()} />);
    const badge = container.querySelector('[title="Jump to critical tasks"]');
    expect(badge?.tagName.toLowerCase()).toBe('button');
  });

  it('calls onCriticalClick when critical badge is clicked', () => {
    clearMocks();
    mockTasks['t1'] = { id: 't1', status: 'todo', priority: 'critical', estimatedCostILS: 0 } as Task;
    const onCriticalClick = vi.fn();
    render(<TopBar onSettingsOpen={vi.fn()} onCriticalClick={onCriticalClick} />);
    fireEvent.click(screen.getByTitle('Jump to critical tasks'));
    expect(onCriticalClick).toHaveBeenCalledOnce();
  });

  it('does not show critical badge for done critical tasks', () => {
    clearMocks();
    mockTasks['t1'] = { id: 't1', status: 'done', priority: 'critical', estimatedCostILS: 0 } as Task;
    const { container } = render(<TopBar onSettingsOpen={vi.fn()} />);
    expect(container.querySelector('[title="Jump to critical tasks"]')).toBeNull();
  });

  it('calls onSettingsOpen when settings button clicked', () => {
    clearMocks();
    const onSettingsOpen = vi.fn();
    render(<TopBar onSettingsOpen={onSettingsOpen} />);
    fireEvent.click(screen.getByTitle('Settings / Export'));
    expect(onSettingsOpen).toHaveBeenCalledOnce();
  });
});
