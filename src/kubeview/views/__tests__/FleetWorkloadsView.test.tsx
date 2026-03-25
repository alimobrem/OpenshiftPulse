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

describe('FleetWorkloadsView', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../fleet/FleetWorkloadsView.tsx'), 'utf-8'
  );

  it('exports a default component', () => {
    expect(source).toContain('export default function FleetWorkloadsView');
  });

  it('fetches both deployments and pods via fleetList', () => {
    expect(source).toContain("fleetList<K8sResource>('/apis/apps/v1/deployments')");
    expect(source).toContain("fleetList<K8sResource>('/api/v1/pods')");
  });

  it('renders summary cards using MetricGrid', () => {
    expect(source).toContain('MetricGrid');
    expect(source).toContain('Total Deployments');
    expect(source).toContain('Total Pods');
    expect(source).toContain('Failed Pods');
  });

  it('renders per-cluster breakdown table', () => {
    expect(source).toContain('Per-Cluster Breakdown');
    expect(source).toContain('Deployments');
    expect(source).toContain('Pods');
    expect(source).toContain('Unhealthy Deploys');
  });

  it('navigates to cluster Workloads view on row click', () => {
    expect(source).toContain('handleClusterClick');
    expect(source).toContain('setActiveCluster');
    expect(source).toContain("'/workloads'");
  });

  it('detects failed pods by phase', () => {
    expect(source).toContain('isPodFailed');
    expect(source).toContain("=== 'Failed'");
  });

  it('detects unhealthy deployments', () => {
    expect(source).toContain('isDeployUnhealthy');
    expect(source).toContain('readyReplicas');
  });

  it('shows loading state', () => {
    expect(source).toContain('Loader2');
    expect(source).toContain('animate-spin');
  });

  it('shows empty state when no clusters', () => {
    expect(source).toContain('No clusters connected');
  });

  it('uses Card for the breakdown table', () => {
    expect(source).toContain('Card');
    expect(source).toContain('CardHeader');
    expect(source).toContain('CardBody');
  });
});
