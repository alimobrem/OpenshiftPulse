import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('../../store/uiStore', () => ({
  useUIStore: Object.assign(
    (sel: (s: any) => any) => sel({ addTab: vi.fn(), addToast: vi.fn() }),
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
}));

describe('FleetAlertsView', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../fleet/FleetAlertsView.tsx'), 'utf-8'
  );

  it('exports a default component', () => {
    expect(source).toContain('export default function FleetAlertsView');
  });

  it('fetches alerts from each cluster Prometheus endpoint', () => {
    expect(source).toContain('prometheus-k8s');
    expect(source).toContain('api/v1/rules');
  });

  it('renders all six table columns', () => {
    const columns = ['Cluster', 'Alert Name', 'Severity', 'Namespace', 'Duration', 'Status'];
    for (const col of columns) {
      expect(source).toContain(col);
    }
  });

  it('shows correlation badge for alerts firing on multiple clusters', () => {
    expect(source).toContain('correlationMap');
    expect(source).toContain('Firing on');
    expect(source).toContain('clusters');
  });

  it('supports severity filter', () => {
    expect(source).toContain('severityFilter');
    expect(source).toContain('Filter by severity');
    expect(source).toContain('Critical');
    expect(source).toContain('Warning');
  });

  it('supports cluster filter', () => {
    expect(source).toContain('clusterFilter');
    expect(source).toContain('Filter by cluster');
  });

  it('supports text search with debounce', () => {
    expect(source).toContain('searchInput');
    expect(source).toContain('searchTerm');
    expect(source).toContain('setTimeout');
  });

  it('navigates to cluster Alerts view on row click', () => {
    expect(source).toContain('handleAlertClick');
    expect(source).toContain('setActiveCluster');
    expect(source).toContain("'/alerts'");
  });

  it('sorts alerts by severity (critical first)', () => {
    expect(source).toContain('sevOrder');
    expect(source).toContain('critical: 0');
    expect(source).toContain('warning: 1');
  });

  it('shows duration using formatDuration', () => {
    expect(source).toContain('formatDuration');
  });

  it('shows loading state', () => {
    expect(source).toContain('Loader2');
    expect(source).toContain('animate-spin');
  });

  it('shows empty state when no alerts are firing', () => {
    expect(source).toContain('No firing alerts across the fleet');
  });

  it('shows alert counts in header', () => {
    expect(source).toContain('criticalCount');
    expect(source).toContain('warningCount');
  });
});
