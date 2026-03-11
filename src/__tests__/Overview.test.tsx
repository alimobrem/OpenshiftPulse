// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Overview from '../pages/home/Overview';

const navigateMock = vi.fn();

const mockNodes = [
  { name: 'node-1', status: 'Ready', cpu: 40, memory: 50, role: 'master', version: 'v1.28' },
  { name: 'node-2', status: 'Ready', cpu: 60, memory: 70, role: 'worker', version: 'v1.28' },
  { name: 'node-3', status: 'Ready', cpu: 80, memory: 30, role: 'worker', version: 'v1.28' },
];

const storeState: Record<string, unknown> = {
  nodes: mockNodes,
  pods: [],
  events: [],
  metrics: [{ timestamp: new Date().toISOString(), cpu: 50, memory: 50, pods: 10 }],
  clusterInfo: { version: 'v4.14', kubernetesVersion: 'v1.28', platform: 'AWS', region: 'us-east-1', consoleURL: '', apiURL: '', updateChannel: 'stable' },
  fetchClusterData: vi.fn(),
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  selectedNamespace: 'all',
  namespaces: [],
  setSelectedNamespace: vi.fn(),
};

vi.mock('@/store/useClusterStore', () => ({
  useClusterStore: (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(storeState) : storeState,
}));

vi.mock('@/store/useUIStore', () => ({
  useUIStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ addToast: vi.fn(), sidebarCollapsed: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderOverview() {
  return render(
    <MemoryRouter>
      <Overview />
    </MemoryRouter>,
  );
}

describe('Overview page - Node filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders node role filter labels', () => {
    renderOverview();
    expect(screen.getByText('All Nodes')).toBeDefined();
    expect(screen.getByText('master')).toBeDefined();
    expect(screen.getByText('worker')).toBeDefined();
  });

  it('defaults to showing all nodes', () => {
    renderOverview();
    // With all 3 nodes: avg CPU = (40+60+80)/3 = 60, cores = 3*4 = 12
    expect(screen.getByText(/60% of 12 cores/)).toBeDefined();
  });

  it('filters by worker role when clicked', () => {
    renderOverview();
    fireEvent.click(screen.getByText('worker'));
    // Worker nodes: node-2 (60%) and node-3 (80%), avg = 70%, cores = 2*4 = 8
    expect(screen.getByText(/70% of 8 cores/)).toBeDefined();
  });

  it('filters by master role when clicked', () => {
    renderOverview();
    fireEvent.click(screen.getByText('master'));
    // Master node: node-1 (40%), cores = 1*4 = 4
    expect(screen.getByText(/40% of 4 cores/)).toBeDefined();
  });

  it('returns to all nodes when All Nodes is clicked', () => {
    renderOverview();
    fireEvent.click(screen.getByText('worker'));
    fireEvent.click(screen.getByText('All Nodes'));
    expect(screen.getByText(/60% of 12 cores/)).toBeDefined();
  });
});
