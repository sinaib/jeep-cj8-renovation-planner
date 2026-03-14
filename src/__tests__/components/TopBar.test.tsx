/**
 * TopBar component tests
 *
 * Verifies:
 * - Critical badge renders when criticalGaps > 0
 * - Critical badge is a <button> (not <div>)
 * - Clicking badge calls the onCriticalClick callback
 * - Badge does not render when criticalGaps === 0
 * - Settings button calls onSettingsOpen
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '../../components/layout/TopBar';
import { useRenovationStore } from '../../store/useRenovationStore';

vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
  maybeRunWeeklyCheck: vi.fn(),
}));
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn(),
}));
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) =>
      <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const store = () => useRenovationStore.getState();

beforeEach(() => {
  store().resetAll();
});

describe('TopBar', () => {
  it('does not show critical badge when no critical gaps', () => {
    const { container } = render(<TopBar onSettingsOpen={vi.fn()} />);
    expect(container.querySelector('[title="Jump to critical tasks"]')).toBeNull();
    expect(screen.queryByText(/critical/i)).toBeNull();
  });

  it('shows critical badge when critical gaps exist', () => {
    const phase = store().addPhase({ name: 'P', subtitle: '', systemIds: [], order: 0, color: '#000' });
    store().addGap(phase.id, 'Safety issue', 'critical');
    render(<TopBar onSettingsOpen={vi.fn()} />);
    expect(screen.getByText(/critical/i)).toBeTruthy();
  });

  it('critical badge is a button element', () => {
    const phase = store().addPhase({ name: 'P', subtitle: '', systemIds: [], order: 0, color: '#000' });
    store().addGap(phase.id, 'Safety issue', 'critical');
    const { container } = render(<TopBar onSettingsOpen={vi.fn()} />);
    const badge = container.querySelector('[title="Jump to critical tasks"]');
    expect(badge?.tagName.toLowerCase()).toBe('button');
  });

  it('calls onCriticalClick when critical badge is clicked', () => {
    const phase = store().addPhase({ name: 'P', subtitle: '', systemIds: [], order: 0, color: '#000' });
    store().addGap(phase.id, 'Safety issue', 'critical');
    const onCriticalClick = vi.fn();
    render(<TopBar onSettingsOpen={vi.fn()} onCriticalClick={onCriticalClick} />);
    const badge = screen.getByTitle('Jump to critical tasks');
    fireEvent.click(badge);
    expect(onCriticalClick).toHaveBeenCalledOnce();
  });

  it('calls onSettingsOpen when settings button clicked', () => {
    const onSettingsOpen = vi.fn();
    render(<TopBar onSettingsOpen={onSettingsOpen} />);
    const settingsBtn = screen.getByTitle('Settings / Export');
    fireEvent.click(settingsBtn);
    expect(onSettingsOpen).toHaveBeenCalledOnce();
  });
});
