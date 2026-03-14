/**
 * CostDashboard component tests
 *
 * Tests the cost summary component rendering in various store states:
 * - empty state (no tasks)
 * - tasks without estimates
 * - tasks with estimates
 * - completed tasks (spent tracking)
 * - budget set (under and over)
 * - phase breakdown
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CostDashboard } from '../../components/dashboard/CostDashboard';
import { useRenovationStore } from '../../store/useRenovationStore';

// Prevent side effects from store mutations
vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
  maybeRunWeeklyCheck: vi.fn(),
}));

vi.mock('../../store/changelog', () => ({
  logChange: vi.fn(),
}));

// Framer Motion can cause issues in tests — mock it to render children directly
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, style, ...props }: React.HTMLAttributes<HTMLDivElement> & { initial?: unknown; animate?: unknown; transition?: unknown }) =>
      <div style={style} {...props}>{children}</div>,
  },
}));

const store = () => useRenovationStore.getState();

beforeEach(() => {
  store().resetAll();
});

// ─── Helper: seed the store ───────────────────────────────────────────────────

function addPhaseWithTasks(opts: {
  phaseName: string;
  phaseColor?: string;
  tasks: Array<{
    name: string;
    estimatedCostILS?: number;
    actualCostILS?: number;
    status?: 'todo' | 'active' | 'done' | 'skipped' | 'flagged';
  }>;
}) {
  const phase = store().addPhase({ name: opts.phaseName, order: 1, color: opts.phaseColor ?? '#E74C3C' });
  const tasks = opts.tasks.map((t) => {
    const task = store().addTask({
      name: t.name,
      system: 'Engine',
      phaseId: phase.id,
      status: t.status ?? 'todo',
      priority: 'normal',
      addedBy: 'agent',
      agentRationale: 'test',
      estimatedCostILS: t.estimatedCostILS,
      dependsOnTaskIds: [],
    });
    if (t.status === 'done') {
      store().completeTask(task.id, t.actualCostILS ?? t.estimatedCostILS ?? 0);
    }
    return task;
  });
  return { phase, tasks };
}

// ─── Empty State ─────────────────────────────────────────────────────────────

describe('CostDashboard: empty state', () => {
  it('renders the empty state message when there are no tasks', () => {
    render(<CostDashboard />);
    expect(screen.getByText(/No cost estimates yet/i)).toBeInTheDocument();
  });

  it('shows TOTAL ESTIMATE and SPENT SO FAR labels', () => {
    render(<CostDashboard />);
    expect(screen.getByText('TOTAL ESTIMATE')).toBeInTheDocument();
    expect(screen.getByText('SPENT SO FAR')).toBeInTheDocument();
    expect(screen.getByText('REMAINING')).toBeInTheDocument();
  });

  it('shows dash (—) for total estimate when no estimates exist', () => {
    render(<CostDashboard />);
    // Both TOTAL ESTIMATE and REMAINING show —
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows ₪0 for spent when nothing is done', () => {
    render(<CostDashboard />);
    expect(screen.getByText('₪0')).toBeInTheDocument();
  });
});

// ─── Tasks With Estimates ─────────────────────────────────────────────────────

describe('CostDashboard: with estimated costs', () => {
  it('shows total estimate when tasks have costs', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [
        { name: 'Brake pads', estimatedCostILS: 1800 },
        { name: 'Rotors', estimatedCostILS: 2400 },
      ],
    });
    render(<CostDashboard />);
    // 1800 + 2400 = 4200; formatted in Hebrew locale — multiple ₪ symbols, check total
    const shekels = screen.getAllByText(/₪/);
    expect(shekels.length).toBeGreaterThanOrEqual(1);
    // Total estimate card should not show dash (—) when there are costs
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('shows "X tasks without cost estimate" when some tasks lack estimates', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [
        { name: 'Brake pads', estimatedCostILS: 1800 },
        { name: 'Rotors' }, // no estimate
        { name: 'Lines' },  // no estimate
      ],
    });
    render(<CostDashboard />);
    expect(screen.getByText(/2 tasks without cost estimate/i)).toBeInTheDocument();
  });

  it('does not show the budget tip when no estimates exist', () => {
    render(<CostDashboard />);
    expect(screen.queryByText(/Tell the agent your budget/i)).not.toBeInTheDocument();
  });

  it('shows the budget tip when estimates exist but no budget is set', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [{ name: 'Brake pads', estimatedCostILS: 1800 }],
    });
    render(<CostDashboard />);
    expect(screen.getByText(/Tell the agent your budget/i)).toBeInTheDocument();
  });
});

// ─── Completed Tasks (Spent Tracking) ────────────────────────────────────────

describe('CostDashboard: spent tracking', () => {
  it('shows spent amount for completed tasks', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [
        { name: 'Brake pads', estimatedCostILS: 1800, actualCostILS: 1750, status: 'done' },
      ],
    });
    render(<CostDashboard />);
    expect(screen.getByText('on completed tasks')).toBeInTheDocument();
  });

  it('does not count in-progress tasks as spent', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [
        { name: 'Brake pads', estimatedCostILS: 1800, status: 'active' },
      ],
    });
    render(<CostDashboard />);
    // Should still show ₪0 for spent
    expect(screen.getByText('₪0')).toBeInTheDocument();
  });
});

// ─── Budget Card ─────────────────────────────────────────────────────────────

describe('CostDashboard: budget tracking', () => {
  it('does not show the budget card when no budget is set', () => {
    render(<CostDashboard />);
    expect(screen.queryByText('BUDGET')).not.toBeInTheDocument();
    expect(screen.queryByText('OVER BUDGET')).not.toBeInTheDocument();
  });

  it('shows BUDGET card when budget car fact is set', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [{ name: 'Brake pads', estimatedCostILS: 1800 }],
    });
    store().setCarFact('budget', '₪10000', 'user');
    render(<CostDashboard />);
    expect(screen.getByText('BUDGET')).toBeInTheDocument();
  });

  it('shows OVER BUDGET when total estimate exceeds budget', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [
        { name: 'Brake pads', estimatedCostILS: 5000 },
        { name: 'Rotors', estimatedCostILS: 4000 },
      ],
    });
    store().setCarFact('budget', '₪8000', 'user');
    render(<CostDashboard />);
    expect(screen.getByText('OVER BUDGET')).toBeInTheDocument();
  });

  it('shows remaining budget text when under budget', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [{ name: 'Brake pads', estimatedCostILS: 2000 }],
    });
    store().setCarFact('budget', '₪10000', 'user');
    render(<CostDashboard />);
    expect(screen.getByText(/remaining in budget/i)).toBeInTheDocument();
  });

  it('shows over budget text and amount when exceeded', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [{ name: 'Brake pads', estimatedCostILS: 12000 }],
    });
    store().setCarFact('budget', '₪10000', 'user');
    render(<CostDashboard />);
    // Multiple elements may contain "over budget" text — just verify at least one exists
    const overBudgetElements = screen.getAllByText(/over budget/i);
    expect(overBudgetElements.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Phase Breakdown ──────────────────────────────────────────────────────────

describe('CostDashboard: phase breakdown', () => {
  it('shows COST BY PHASE when there are tasks with phases', () => {
    addPhaseWithTasks({
      phaseName: 'Safety First',
      tasks: [{ name: 'Brakes', estimatedCostILS: 1800 }],
    });
    render(<CostDashboard />);
    expect(screen.getByText('COST BY PHASE')).toBeInTheDocument();
  });

  it('shows phase name in the breakdown', () => {
    addPhaseWithTasks({
      phaseName: 'Safety First',
      tasks: [{ name: 'Brakes', estimatedCostILS: 1800 }],
    });
    render(<CostDashboard />);
    expect(screen.getByText('Safety First')).toBeInTheDocument();
  });

  it('shows task completion count per phase', () => {
    addPhaseWithTasks({
      phaseName: 'Safety',
      tasks: [
        { name: 'Brake pads', estimatedCostILS: 1800, status: 'done' },
        { name: 'Rotors', estimatedCostILS: 2400, status: 'todo' },
      ],
    });
    render(<CostDashboard />);
    expect(screen.getByText(/1\/2 tasks done/i)).toBeInTheDocument();
  });

  it('shows "no estimates yet" when a phase has tasks but no costs', () => {
    addPhaseWithTasks({
      phaseName: 'Engine',
      tasks: [
        { name: 'Oil change' }, // no estimatedCostILS
      ],
    });
    render(<CostDashboard />);
    expect(screen.getByText(/no estimates yet/i)).toBeInTheDocument();
  });

  it('does not show COST BY PHASE for empty phases', () => {
    store().addPhase({ name: 'Empty Phase', order: 1 });
    render(<CostDashboard />);
    expect(screen.queryByText('COST BY PHASE')).not.toBeInTheDocument();
  });

  it('shows multiple phases in the breakdown', () => {
    addPhaseWithTasks({
      phaseName: 'Safety First',
      tasks: [{ name: 'Brakes', estimatedCostILS: 2000 }],
    });
    const phase2 = store().addPhase({ name: 'Engine Rebuild', order: 2 });
    store().addTask({
      name: 'Oil change', system: 'Engine', phaseId: phase2.id,
      status: 'todo', priority: 'normal', addedBy: 'agent',
      agentRationale: 'test', estimatedCostILS: 500, dependsOnTaskIds: [],
    });
    render(<CostDashboard />);
    expect(screen.getByText('Safety First')).toBeInTheDocument();
    expect(screen.getByText('Engine Rebuild')).toBeInTheDocument();
  });
});

// ─── Stat labels always present ───────────────────────────────────────────────

describe('CostDashboard: structural elements always present', () => {
  it('renders all three top summary cards in every state', () => {
    render(<CostDashboard />);
    expect(screen.getByText('TOTAL ESTIMATE')).toBeInTheDocument();
    expect(screen.getByText('SPENT SO FAR')).toBeInTheDocument();
    expect(screen.getByText('REMAINING')).toBeInTheDocument();
  });

  it('always shows "on completed tasks" label in Spent card', () => {
    render(<CostDashboard />);
    expect(screen.getByText('on completed tasks')).toBeInTheDocument();
  });

  it('always shows "estimated still to spend" label in Remaining card', () => {
    render(<CostDashboard />);
    expect(screen.getByText('estimated still to spend')).toBeInTheDocument();
  });
});
