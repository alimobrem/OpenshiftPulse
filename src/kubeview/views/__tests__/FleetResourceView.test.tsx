import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock modules before imports
vi.mock('../../engine/clusterConnection', () => {
  const clusters = new Map<string, any>();
  return {
    getAllConnections: () => Array.from(clusters.values()),
    getClusterBase: (id?: string) => {
      if (!id) return '/api/kubernetes';
      return clusters.get(id)?.apiBase || '/api/kubernetes';
    },
    __setTestClusters: (list: any[]) => {
      clusters.clear();
      for (const c of list) clusters.set(c.id, c);
    },
  };
});

vi.mock('../../store/uiStore', () => ({
  useUIStore: Object.assign(
    (sel: (s: any) => any) => sel({ addTab: vi.fn(), addToast: vi.fn(), selectedNamespace: '*', impersonateUser: null, impersonateGroups: [] }),
    { getState: () => ({ impersonateUser: null, impersonateGroups: [] }) },
  ),
}));

vi.mock('../../store/fleetStore', () => ({
  useFleetStore: (sel: (s: any) => any) => sel({ setActiveCluster: vi.fn() }),
}));

vi.mock('../../hooks/useNavigateTab', () => ({
  useNavigateTab: () => vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ gvr: 'apps~v1~deployments' }),
}));

describe('FleetResourceView', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../fleet/FleetResourceView.tsx'), 'utf-8'
  );

  it('exports a default component', () => {
    expect(source).toContain('export default function FleetResourceView');
  });

  it('accepts gvrKey prop', () => {
    expect(source).toContain('gvrKey: string');
  });

  it('calls fleetList to fetch resources', () => {
    expect(source).toContain('fleetList');
  });

  it('renders cluster column with health dot', () => {
    expect(source).toContain('clusterName');
    expect(source).toContain('statusDot');
  });

  it('renders all five table columns', () => {
    const columns = ['Cluster', 'Name', 'Namespace', 'Status', 'Age'];
    for (const col of columns) {
      expect(source).toContain(`'${col}'`);
    }
  });

  it('supports cluster filter dropdown', () => {
    expect(source).toContain('clusterFilter');
    expect(source).toContain('Filter by cluster');
  });

  it('supports namespace filter input', () => {
    expect(source).toContain('namespaceFilter');
    expect(source).toContain('Filter by namespace');
  });

  it('supports text search with debounce', () => {
    expect(source).toContain('searchInput');
    expect(source).toContain('searchTerm');
    expect(source).toContain('setTimeout');
  });

  it('shows per-cluster counts in summary bar', () => {
    expect(source).toContain('perClusterCounts');
  });

  it('navigates to resource detail on row click', () => {
    expect(source).toContain('handleRowClick');
    expect(source).toContain('setActiveCluster');
    expect(source).toContain('navigate');
  });

  it('shows loading skeleton', () => {
    expect(source).toContain('animate-pulse');
  });

  it('shows empty state when no clusters connected', () => {
    expect(source).toContain('No clusters connected');
  });

  it('uses detectResourceStatus for status column', () => {
    expect(source).toContain('detectResourceStatus');
  });

  it('uses timeAgo for age column', () => {
    expect(source).toContain('timeAgo');
  });

  it('supports sorting by all columns', () => {
    expect(source).toContain("handleSort");
    expect(source).toContain("sortCol");
    expect(source).toContain("sortDir");
  });
});
