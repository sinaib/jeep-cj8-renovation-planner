/**
 * SettingsModal tests
 *
 * Verifies:
 * - Modal renders when open=true
 * - Modal does not render when open=false
 * - Modal container has maxHeight style for scroll safety
 * - Modal container has overflowY: auto
 * - "View prompt guide" link is present and points to user-guide.html
 * - Close button calls onClose
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../../components/settings/SettingsModal';

vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
  maybeRunWeeklyCheck: vi.fn(),
}));
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn(),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, style, ...p }: React.PropsWithChildren<{ style?: React.CSSProperties }>) =>
      <div style={style} {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock('../../store/useRenovationStore', () => {
  const { create } = require('zustand');
  const store = create(() => ({
    appState: 'in_progress',
    exportProgress: () => '{}',
    importProgress: vi.fn(),
    resetAll: vi.fn(),
    finishOnboarding: vi.fn(),
  }));
  return { useRenovationStore: store };
});

describe('SettingsModal', () => {
  it('does not render when open=false', () => {
    render(<SettingsModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Settings')).toBeNull();
  });

  it('renders when open=true', () => {
    render(<SettingsModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('modal container has maxHeight style', () => {
    const { container } = render(<SettingsModal open={true} onClose={vi.fn()} />);
    // Find the modal div (has zIndex 300 in style)
    const modalDiv = Array.from(container.querySelectorAll('div')).find(
      (el) => (el as HTMLElement).style?.maxHeight === '85vh'
    );
    expect(modalDiv).toBeTruthy();
  });

  it('modal container has overflowY auto', () => {
    const { container } = render(<SettingsModal open={true} onClose={vi.fn()} />);
    const modalDiv = Array.from(container.querySelectorAll('div')).find(
      (el) => (el as HTMLElement).style?.overflowY === 'auto'
    );
    expect(modalDiv).toBeTruthy();
  });

  it('prompt guide link is present and points to user-guide.html', () => {
    render(<SettingsModal open={true} onClose={vi.fn()} />);
    const link = screen.getByText(/View prompt guide/i).closest('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toContain('user-guide.html');
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<SettingsModal open={true} onClose={onClose} />);
    // The × close button
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
