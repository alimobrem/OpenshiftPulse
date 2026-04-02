// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@/lib/utils', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }));

vi.mock('../../store/monitorStore', () => ({
  useMonitorStore: Object.assign(
    (selector: any) => {
      const state = {
        connected: false,
        monitorEnabled: true,
        setMonitorEnabled: vi.fn(),
        triggerScan: vi.fn(),
        lastScanTime: null,
        findings: [],
      };
      return selector(state);
    },
    { getState: () => ({ findings: [] }) },
  ),
}));

vi.mock('../../store/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: any) => {
      const state = { addToast: vi.fn() };
      return selector(state);
    },
    { getState: () => ({ addToast: vi.fn() }) },
  ),
}));

vi.mock('../../store/trustStore', () => ({
  useTrustStore: (selector: any) => {
    const state = {
      trustLevel: 0,
      setTrustLevel: vi.fn(),
      autoFixCategories: [],
      setAutoFixCategories: vi.fn(),
      communicationStyle: 'brief',
      setCommunicationStyle: vi.fn(),
    };
    return selector(state);
  },
  TRUST_LABELS: {},
  TRUST_DESCRIPTIONS: {},
}));

vi.mock('../../store/agentStore', () => ({
  useAgentStore: (selector: any) => {
    const state = { connected: false };
    return selector(state);
  },
}));

vi.mock('../../engine/evalStatus', () => ({
  fetchAgentEvalStatus: vi.fn().mockResolvedValue(null),
}));

// Mock lazy-loaded tabs
vi.mock('../MemoryView', () => ({
  default: () => <div data-testid="memory-view">MemoryView</div>,
}));

vi.mock('../ViewsManagement', () => ({
  default: () => <div data-testid="views-management">ViewsManagement</div>,
}));

import AgentSettingsView from '../AgentSettingsView';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

function renderView(initialRoute = '/agent') {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AgentSettingsView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AgentSettingsView', () => {
  afterEach(cleanup);

  it('renders page header', () => {
    renderView();
    expect(screen.getByText('Agent')).toBeDefined();
  });

  it('renders all 3 tab buttons', () => {
    renderView();
    expect(screen.getByRole('tab', { name: /Settings/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Memory/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Views/ })).toBeDefined();
  });

  it('shows settings tab by default', () => {
    renderView();
    expect(screen.getByText('Continuous Monitoring')).toBeDefined();
  });

  it('switches to memory tab without crashing', async () => {
    renderView('/agent?tab=memory');
    expect(await screen.findByTestId('memory-view')).toBeDefined();
  });

  it('switches to views tab without crashing', async () => {
    renderView('/agent?tab=views');
    expect(await screen.findByTestId('views-management')).toBeDefined();
  });

  it('clicking memory tab shows memory view', async () => {
    renderView();
    fireEvent.click(screen.getByRole('tab', { name: /Memory/ }));
    expect(await screen.findByTestId('memory-view')).toBeDefined();
  });

  it('clicking views tab shows views management', async () => {
    renderView();
    fireEvent.click(screen.getByRole('tab', { name: /Views/ }));
    expect(await screen.findByTestId('views-management')).toBeDefined();
  });

  it('shows connection status', () => {
    renderView();
    expect(screen.getByText('Disconnected')).toBeDefined();
  });

  it('has tablist role for accessibility', () => {
    renderView();
    expect(screen.getByRole('tablist', { name: /Agent tabs/ })).toBeDefined();
  });
});
