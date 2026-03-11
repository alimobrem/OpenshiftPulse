// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Alerts from '../pages/observe/Alerts';

const addToastMock = vi.fn();

vi.mock('@/store/useUIStore', () => ({
  useUIStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ addToast: addToastMock }),
}));

const firingAlerts = {
  data: {
    alerts: [
      {
        labels: { alertname: 'HighCPU', severity: 'critical', namespace: 'default' },
        annotations: { summary: 'CPU usage above 90%' },
        state: 'firing',
        activeAt: new Date(Date.now() - 30 * 60000).toISOString(),
      },
      {
        labels: { alertname: 'DiskFull', severity: 'warning', namespace: 'monitoring' },
        annotations: { description: 'Disk usage above 85%' },
        state: 'pending',
        activeAt: new Date(Date.now() - 5 * 60000).toISOString(),
      },
    ],
  },
};

function renderAlerts() {
  return render(
    <MemoryRouter>
      <Alerts />
    </MemoryRouter>,
  );
}

describe('Alerts page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    addToastMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders title and fetches alerts from Prometheus', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(firingAlerts),
    });

    renderAlerts();

    await waitFor(() => {
      expect(screen.getByText('HighCPU')).toBeDefined();
      expect(screen.getByText('DiskFull')).toBeDefined();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/prometheus/api/v1/alerts');
  });

  it('shows firing alerts sorted before pending', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(firingAlerts),
    });

    renderAlerts();

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // First data row should be the firing alert (HighCPU)
      const firstDataRow = rows[1]; // rows[0] is header
      expect(firstDataRow.textContent).toContain('HighCPU');
    });
  });

  it('displays alert message from summary annotation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(firingAlerts),
    });

    renderAlerts();

    await waitFor(() => {
      expect(screen.getByText('CPU usage above 90%')).toBeDefined();
      expect(screen.getByText('Disk usage above 85%')).toBeDefined();
    });
  });

  it('shows error message when fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    renderAlerts();

    await waitFor(() => {
      expect(screen.getByText(/Error loading alerts/)).toBeDefined();
    });
  });

  it('creates a real silence via Alertmanager API on Silence click', async () => {
    global.fetch = vi.fn()
      // Initial alerts fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(firingAlerts),
      })
      // Silence POST
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ silenceID: 'abc-123' }),
        text: () => Promise.resolve(''),
      })
      // Refetch after silence
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(firingAlerts),
      });

    renderAlerts();

    await waitFor(() => {
      expect(screen.getByText('HighCPU')).toBeDefined();
    });

    const silenceButtons = screen.getAllByText('Silence');
    fireEvent.click(silenceButtons[0]);

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'Silence created',
        }),
      );
    });

    // Verify the silence POST was called with correct structure
    const silenceCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(silenceCall[0]).toBe('/api/alertmanager/api/v2/silences');
    const body = JSON.parse(silenceCall[1].body);
    expect(body.matchers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'alertname', value: 'HighCPU' }),
      ]),
    );
    expect(body.createdBy).toBe('openshift-console');
    expect(body.startsAt).toBeDefined();
    expect(body.endsAt).toBeDefined();
  });

  it('shows error toast when silence creation fails', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(firingAlerts),
      })
      .mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Forbidden'),
      });

    renderAlerts();

    await waitFor(() => {
      expect(screen.getByText('HighCPU')).toBeDefined();
    });

    const silenceButtons = screen.getAllByText('Silence');
    fireEvent.click(silenceButtons[0]);

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Failed to create silence',
        }),
      );
    });
  });

  it('handles empty alerts list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { alerts: [] } }),
    });

    renderAlerts();

    await waitFor(() => {
      // Should render without crashing, no alert rows
      expect(screen.queryByText('HighCPU')).toBeNull();
    });
  });

  it('shows namespace column', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(firingAlerts),
    });

    renderAlerts();

    await waitFor(() => {
      expect(screen.getByText('default')).toBeDefined();
      expect(screen.getByText('monitoring')).toBeDefined();
    });
  });
});
