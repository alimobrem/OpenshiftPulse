// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startAgentNotifications, stopAgentNotifications, isAgentNotificationsRunning } from '../agentNotifications';

const mockAddToast = vi.fn();

vi.mock('../../store/uiStore', () => ({
  useUIStore: { getState: () => ({ addToast: mockAddToast }) },
}));

let mockHandler: ((event: any) => void) | null = null;
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSend = vi.fn();

vi.mock('../agentClient', () => ({
  AgentClient: class {
    on(handler: (event: any) => void) {
      mockHandler = handler;
      return () => {};
    }
    connect() { mockConnect(); }
    disconnect() { mockDisconnect(); }
    send(content: string) { mockSend(content); }
  },
}));

describe('agentNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockHandler = null;
    stopAgentNotifications();
  });

  afterEach(() => {
    stopAgentNotifications();
    vi.useRealTimers();
  });

  it('starts and stops', () => {
    startAgentNotifications(5000);
    expect(isAgentNotificationsRunning()).toBe(true);

    stopAgentNotifications();
    expect(isAgentNotificationsRunning()).toBe(false);
  });

  it('does not poll immediately on start', () => {
    startAgentNotifications(5000);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('polls after interval', () => {
    startAgentNotifications(5000);
    vi.advanceTimersByTime(5000);
    expect(mockConnect).toHaveBeenCalledOnce();
  });

  it('shows toast when agent reports issues', async () => {
    startAgentNotifications(5000);
    vi.advanceTimersByTime(5000);

    // Simulate connected -> send -> done with a warning
    mockHandler?.({ type: 'connected' });
    expect(mockSend).toHaveBeenCalled();

    mockHandler?.({ type: 'done', full_response: 'Node worker-3 memory at 95%, likely to hit pressure within 2 hours.' });

    // Allow promise microtasks
    await vi.advanceTimersByTimeAsync(0);

    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning',
      title: 'AI Insight',
      detail: expect.stringContaining('worker-3'),
    }));
  });

  it('does not show toast when agent says OK', async () => {
    startAgentNotifications(5000);
    vi.advanceTimersByTime(5000);

    mockHandler?.({ type: 'connected' });
    mockHandler?.({ type: 'done', full_response: 'OK' });

    await vi.advanceTimersByTimeAsync(0);

    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('silently skips on error', async () => {
    startAgentNotifications(5000);
    vi.advanceTimersByTime(5000);

    mockHandler?.({ type: 'error', message: 'Connection failed' });

    await vi.advanceTimersByTimeAsync(0);

    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('does not double-start', () => {
    startAgentNotifications(5000);
    startAgentNotifications(5000);
    vi.advanceTimersByTime(5000);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });
});
