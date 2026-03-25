import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock uiStore before importing anything that depends on it
vi.mock('../../store/uiStore', () => ({
  useUIStore: {
    getState: () => ({ impersonateUser: null, impersonateGroups: [] }),
  },
}));

// Mock clusterConnection — we control registered clusters
vi.mock('../clusterConnection', () => {
  const clusters = new Map<string, any>();

  return {
    getAllConnections: () => Array.from(clusters.values()),
    isMultiCluster: () => clusters.size > 1,
    getClusterBase: (id?: string) => {
      if (!id) return '/api/kubernetes';
      return clusters.get(id)?.apiBase || '/api/kubernetes';
    },
    // Test helper
    __setTestClusters: (list: any[]) => {
      clusters.clear();
      for (const c of list) clusters.set(c.id, c);
    },
  };
});

import { fleetList, fleetSearch, fleetCount } from '../fleet';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockOk(data: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    status: 200,
  };
}

function mockError(code: number, message: string) {
  return {
    ok: false,
    status: code,
    json: () => Promise.resolve({ kind: 'Status', message, reason: 'NotFound', code }),
  };
}

// Access the test helper from our mock
const { __setTestClusters } = await import('../clusterConnection') as any;

beforeEach(() => {
  mockFetch.mockReset();
  __setTestClusters([
    { id: 'cluster-a', name: 'Cluster A', status: 'connected', apiBase: '/api/kubernetes' },
    { id: 'cluster-b', name: 'Cluster B', status: 'connected', apiBase: '/api/kubernetes/cluster/cluster-b' },
  ]);
});

describe('fleetList', () => {
  it('returns results from all connected clusters', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [{ metadata: { name: 'pod-a1' } }, { metadata: { name: 'pod-a2' } }],
      }))
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [{ metadata: { name: 'pod-b1' } }],
      }));

    const results = await fleetList('/api/v1/pods');

    expect(results).toHaveLength(2);
    expect(results[0].clusterId).toBe('cluster-a');
    expect(results[0].status).toBe('fulfilled');
    expect(results[0].data).toHaveLength(2);
    expect(results[1].clusterId).toBe('cluster-b');
    expect(results[1].data).toHaveLength(1);
  });

  it('handles one unreachable cluster gracefully', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [{ metadata: { name: 'pod-a1' } }],
      }))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const results = await fleetList('/api/v1/pods');

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('fulfilled');
    expect(results[0].data).toHaveLength(1);
    expect(results[1].status).toBe('rejected');
    expect(results[1].data).toHaveLength(0);
    expect(results[1].error).toBe('ECONNREFUSED');
  });

  it('skips clusters that are not connected', async () => {
    __setTestClusters([
      { id: 'cluster-a', name: 'Cluster A', status: 'connected', apiBase: '/api/kubernetes' },
      { id: 'cluster-c', name: 'Cluster C', status: 'unreachable', apiBase: '/api/kubernetes/cluster/cluster-c' },
    ]);

    mockFetch.mockResolvedValueOnce(mockOk({
      apiVersion: 'v1', kind: 'PodList', metadata: {},
      items: [{ metadata: { name: 'pod-a1' } }],
    }));

    const results = await fleetList('/api/v1/pods');

    expect(results).toHaveLength(1);
    expect(results[0].clusterId).toBe('cluster-a');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('fleetSearch', () => {
  it('filters results by name across clusters', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [
          { metadata: { name: 'nginx-abc' } },
          { metadata: { name: 'redis-xyz' } },
        ],
      }))
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [
          { metadata: { name: 'nginx-def' } },
          { metadata: { name: 'postgres-123' } },
        ],
      }));

    const results = await fleetSearch('/api/v1/pods', 'nginx');

    expect(results).toHaveLength(2);
    // Cluster A: only nginx-abc should match
    expect(results[0].data).toHaveLength(1);
    expect(results[0].data[0].metadata.name).toBe('nginx-abc');
    // Cluster B: only nginx-def should match
    expect(results[1].data).toHaveLength(1);
    expect(results[1].data[0].metadata.name).toBe('nginx-def');
  });

  it('is case-insensitive', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [{ metadata: { name: 'Nginx-Pod' } }],
      }))
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [],
      }));

    const results = await fleetSearch('/api/v1/pods', 'NGINX');

    expect(results[0].data).toHaveLength(1);
    expect(results[0].data[0].metadata.name).toBe('Nginx-Pod');
  });

  it('returns empty data arrays when nothing matches', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [{ metadata: { name: 'redis' } }],
      }))
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [{ metadata: { name: 'postgres' } }],
      }));

    const results = await fleetSearch('/api/v1/pods', 'nonexistent');

    expect(results[0].data).toHaveLength(0);
    expect(results[1].data).toHaveLength(0);
  });
});

describe('fleetCount', () => {
  it('aggregates counts across clusters', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [{ metadata: { name: 'a' } }, { metadata: { name: 'b' } }],
      }))
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [{ metadata: { name: 'c' } }],
      }));

    const result = await fleetCount('/api/v1/pods');

    expect(result.total).toBe(3);
    expect(result.perCluster).toHaveLength(2);
    expect(result.perCluster[0].count).toBe(2);
    expect(result.perCluster[1].count).toBe(1);
  });

  it('excludes rejected clusters from count', async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk({
        apiVersion: 'v1', kind: 'PodList', metadata: {},
        items: [{ metadata: { name: 'a' } }],
      }))
      .mockRejectedValueOnce(new Error('unreachable'));

    const result = await fleetCount('/api/v1/pods');

    expect(result.total).toBe(1);
    expect(result.perCluster).toHaveLength(1);
  });
});
