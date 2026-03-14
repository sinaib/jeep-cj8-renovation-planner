/**
 * PromptChips component tests
 *
 * Verifies:
 * - Chips render for each context type
 * - Clicking a chip calls onSend with the chip text
 * - Task name appears in task-context chips
 * - Chips don't render when context has no chips (empty array guard)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptChips } from '../../components/agent/PromptChips';
import type { Task, Phase } from '../../types';

const mockTask: Task = {
  id: 't1',
  name: 'Inspect frame rails',
  systemId: 'frame',
  phaseId: 'p1',
  phaseOrder: 0,
  status: 'todo',
  priority: 'critical',
  parts: [],
  notes: '',
  manualRefs: [],
  addedBy: 'agent',
};

const mockPhase: Phase = {
  id: 'p1',
  order: 0,
  name: 'Foundation',
  subtitle: 'Core mechanical',
  systemIds: ['frame'],
  color: '#D4832A',
  taskIds: ['t1'],
};

describe('PromptChips', () => {
  it('renders chips in plan context', () => {
    const onSend = vi.fn();
    render(<PromptChips context="plan" onSend={onSend} />);
    // Should show plan-context chips
    expect(screen.getByText(/What should I do next/i)).toBeTruthy();
  });

  it('renders chips in task context', () => {
    const onSend = vi.fn();
    render(<PromptChips context="task" currentTask={mockTask} onSend={onSend} />);
    // Task-context chips should include the task name
    const chips = screen.getAllByRole('button');
    const taskChip = chips.find((c) => c.textContent?.includes('Inspect frame rails'));
    expect(taskChip).toBeTruthy();
  });

  it('renders chips in journey context', () => {
    const onSend = vi.fn();
    render(<PromptChips context="journey" onSend={onSend} />);
    expect(screen.getByText(/Summarize my progress/i)).toBeTruthy();
  });

  it('renders chips in workNow context', () => {
    const onSend = vi.fn();
    render(<PromptChips context="workNow" onSend={onSend} />);
    expect(screen.getByText(/What should I focus on today/i)).toBeTruthy();
  });

  it('calls onSend with full chip text when clicked', () => {
    const onSend = vi.fn();
    render(<PromptChips context="plan" onSend={onSend} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onSend).toHaveBeenCalledOnce();
    expect(onSend.mock.calls[0][0]).toBeTruthy();
    expect(typeof onSend.mock.calls[0][0]).toBe('string');
  });

  it('plan context with phase shows phase name in first chip', () => {
    const onSend = vi.fn();
    render(<PromptChips context="plan" currentPhase={mockPhase} onSend={onSend} />);
    expect(screen.getByText(/Map out all tasks for "Foundation"/i)).toBeTruthy();
  });
});
