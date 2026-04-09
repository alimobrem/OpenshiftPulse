import { describe, it, expect, vi } from 'vitest';

vi.mock('../renderers/index', () => ({
  kindToPlural: (kind: string) => {
    const map: Record<string, string> = {
      Pod: 'pods',
      Deployment: 'deployments',
      Service: 'services',
      Namespace: 'namespaces',
      Node: 'nodes',
      ClusterRole: 'clusterroles',
    };
    return map[kind] || kind.toLowerCase() + 's';
  },
}));

vi.mock('../clusterConnection', () => ({
  getClusterBase: () => '/api/kubernetes',
}));

import { gvrToUrl, urlToGvr, resourceDetailUrl, K8S_BASE } from '../gvr';
import { buildApiPath } from '../../hooks/useResourceUrl';

describe('gvrToUrl', () => {
  it('converts core resource GVR key to URL segment', () => {
    expect(gvrToUrl('v1/pods')).toBe('v1~pods');
  });

  it('converts group resource GVR key to URL segment', () => {
    expect(gvrToUrl('apps/v1/deployments')).toBe('apps~v1~deployments');
  });

  it('handles multiple slashes', () => {
    expect(gvrToUrl('rbac.authorization.k8s.io/v1/clusterroles')).toBe('rbac.authorization.k8s.io~v1~clusterroles');
  });

  it('returns unchanged string with no slashes', () => {
    expect(gvrToUrl('pods')).toBe('pods');
  });
});

describe('urlToGvr', () => {
  it('converts URL segment back to GVR key', () => {
    expect(urlToGvr('apps~v1~deployments')).toBe('apps/v1/deployments');
  });

  it('converts core resource URL back', () => {
    expect(urlToGvr('v1~pods')).toBe('v1/pods');
  });

  it('is the inverse of gvrToUrl', () => {
    const key = 'apps/v1/deployments';
    expect(urlToGvr(gvrToUrl(key))).toBe(key);
  });
});

describe('resourceDetailUrl', () => {
  it('builds URL for namespaced resource with group', () => {
    const resource = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'nginx', namespace: 'default' },
    };
    expect(resourceDetailUrl(resource)).toBe('/r/apps~v1~deployments/default/nginx');
  });

  it('builds URL for namespaced core resource', () => {
    const resource = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: 'my-pod', namespace: 'kube-system' },
    };
    expect(resourceDetailUrl(resource)).toBe('/r/v1~pods/kube-system/my-pod');
  });

  it('builds URL for cluster-scoped resource', () => {
    const resource = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: { name: 'admin' },
    };
    expect(resourceDetailUrl(resource)).toBe('/r/rbac.authorization.k8s.io~v1~clusterroles/_/admin');
  });

  it('handles missing namespace with underscore placeholder', () => {
    const resource = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: 'default' },
    };
    expect(resourceDetailUrl(resource)).toBe('/r/v1~namespaces/_/default');
  });
});

describe('K8S_BASE', () => {
  it('is the correct base path', () => {
    expect(K8S_BASE).toBe('/api/kubernetes');
  });
});

describe('route safety — no leading tilde or double slashes', () => {
  const CORE_RESOURCES = [
    { apiVersion: 'v1', kind: 'Pod', gvr: 'v1/pods', namespaced: true },
    { apiVersion: 'v1', kind: 'Node', gvr: 'v1/nodes', namespaced: false },
    { apiVersion: 'v1', kind: 'Namespace', gvr: 'v1/namespaces', namespaced: false },
    { apiVersion: 'v1', kind: 'Service', gvr: 'v1/services', namespaced: true },
  ];
  const GROUP_RESOURCES = [
    { apiVersion: 'apps/v1', kind: 'Deployment', gvr: 'apps/v1/deployments', namespaced: true },
    { apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'ClusterRole', gvr: 'rbac.authorization.k8s.io/v1/clusterroles', namespaced: false },
  ];
  const ALL = [...CORE_RESOURCES, ...GROUP_RESOURCES];

  describe('gvrToUrl never produces leading tilde', () => {
    it.each(ALL.map(r => [r.kind, r.gvr]))('%s', (_kind, gvr) => {
      const url = gvrToUrl(gvr);
      expect(url).not.toMatch(/^~/);
    });
  });

  describe('resourceDetailUrl never produces leading tilde in GVR segment', () => {
    it.each(ALL.map(r => [r.kind, r]))('%s', (_kind, r) => {
      const resource = {
        apiVersion: r.apiVersion,
        kind: r.kind,
        metadata: { name: 'test', ...(r.namespaced ? { namespace: 'default' } : {}) },
      };
      const url = resourceDetailUrl(resource);
      // Extract GVR segment: /r/{gvr}/...
      const gvrSegment = url.split('/')[2];
      expect(gvrSegment).not.toMatch(/^~/);
      expect(url).not.toContain('//');
    });

    it('cluster-scoped resource uses _ namespace placeholder', () => {
      const resource = {
        apiVersion: 'v1',
        kind: 'Node',
        metadata: { name: 'worker-1' },
      };
      const url = resourceDetailUrl(resource);
      expect(url).toBe('/r/v1~nodes/_/worker-1');
      expect(url).not.toContain('*');
    });
  });

  describe('buildApiPath never produces double slashes', () => {
    it.each(ALL.map(r => [r.kind, r.gvr]))('%s', (_kind, gvr) => {
      const path = buildApiPath(gvr, 'default');
      expect(path).not.toMatch(/\/\//);
    });

    it('core resource uses /api/ not /apis/', () => {
      const path = buildApiPath('v1/nodes');
      expect(path).toBe('/api/v1/nodes');
      expect(path).not.toMatch(/^\/apis\//);
    });

    it('group resource uses /apis/', () => {
      const path = buildApiPath('apps/v1/deployments', 'default');
      expect(path).toMatch(/^\/apis\/apps\/v1/);
    });

    it('rejects GVR with empty group segment (the leading-tilde bug)', () => {
      // A leading-tilde URL like "~v1~nodes" decodes to "/v1/nodes" (3 parts, empty group).
      // buildApiPath treats 3 parts as a named group, producing /apis//v1 — a double-slash bug.
      const decoded = urlToGvr('~v1~nodes'); // "/v1/nodes"
      const path = buildApiPath(decoded);
      // If empty group sneaks through, it produces /apis//v1/nodes
      expect(path).not.toMatch(/\/\//);
    });
  });
});
