// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InboxHeader } from '../InboxHeader';

vi.mock('../../../store/inboxStore', () => ({
  useInboxStore: vi.fn((selector) => {
    const state = {
      stats: { new: 3, total: 10, agent_cleared: 5, critical: 2, warning: 4 },
      activePreset: null,
      setPreset: vi.fn(),
    };
    return selector(state);
  }),
}));

describe('InboxHeader', () => {
  const onNewTask = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inbox title', () => {
    render(<InboxHeader onNewTask={onNewTask} />);
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeDefined();
  });

  it('renders preset buttons with aria-pressed', () => {
    render(<InboxHeader onNewTask={onNewTask} />);
    const btns = screen.getAllByRole('button', { pressed: false });
    const presetLabels = btns.map((b) => b.textContent).filter((t) => t?.includes('Attention') || t?.includes('Cleared'));
    expect(presetLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('renders new task button', () => {
    render(<InboxHeader onNewTask={onNewTask} />);
    const btns = screen.getAllByText(/New Task/);
    expect(btns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(btns[0]);
    expect(onNewTask).toHaveBeenCalled();
  });

  it('renders severity badges when data exists', () => {
    render(<InboxHeader onNewTask={onNewTask} />);
    expect(screen.getAllByText(/Critical/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Warning/).length).toBeGreaterThanOrEqual(1);
  });
});
