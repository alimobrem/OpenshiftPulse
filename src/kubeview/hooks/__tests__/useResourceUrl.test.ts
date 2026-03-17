import { describe, it, expect } from 'vitest';
import { buildApiPath, buildApiPathFromResource } from '../useResourceUrl';

describe('buildApiPath', () => {
  describe('core resources (2-part GVR)', () => {
    it('builds path for v1/pods', () => {
      expect(buildApiPath('v1/pods')).toBe('/api/v1/pods');
    });

    it('builds path with namespace', () => {
      expect(buildApiPath('v1/pods', 'default')).toBe('/api/v1/namespaces/default/pods');
    });

    it('builds path with namespace and name', () => {
      expect(buildApiPath('v1/pods', 'default', 'nginx'))
        .toBe('/api/v1/namespaces/default/pods/nginx');
    });

    it('builds path for cluster-scoped resources', () => {
      expect(buildApiPath('v1/nodes')).toBe('/api/v1/nodes');
    });

    it('builds path for cluster-scoped with name', () => {
      expect(buildApiPath('v1/nodes', undefined, 'node-1'))
        .toBe('/api/v1/nodes/node-1');
    });
  });

  describe('grouped resources (3-part GVR)', () => {
    it('builds path for apps/v1/deployments', () => {
      expect(buildApiPath('apps/v1/deployments')).toBe('/apis/apps/v1/deployments');
    });

    it('builds path with namespace', () => {
      expect(buildApiPath('apps/v1/deployments', 'production'))
        .toBe('/apis/apps/v1/namespaces/production/deployments');
    });

    it('builds path with namespace and name', () => {
      expect(buildApiPath('apps/v1/deployments', 'production', 'api'))
        .toBe('/apis/apps/v1/namespaces/production/deployments/api');
    });

    it('builds path for batch/v1/jobs', () => {
      expect(buildApiPath('batch/v1/jobs', 'default'))
        .toBe('/apis/batch/v1/namespaces/default/jobs');
    });

    it('builds path for networking.k8s.io/v1/networkpolicies', () => {
      expect(buildApiPath('networking.k8s.io/v1/networkpolicies', 'test'))
        .toBe('/apis/networking.k8s.io/v1/namespaces/test/networkpolicies');
    });
  });

  describe('error handling', () => {
    it('throws for invalid GVR format (1 part)', () => {
      expect(() => buildApiPath('pods')).toThrow('Invalid GVR key format');
    });

    it('throws for invalid GVR format (4 parts)', () => {
      expect(() => buildApiPath('a/b/c/d')).toThrow('Invalid GVR key format');
    });
  });

  describe('edge cases', () => {
    it('handles namespace with special characters', () => {
      expect(buildApiPath('v1/pods', 'my-namespace'))
        .toBe('/api/v1/namespaces/my-namespace/pods');
    });

    it('handles name with dots', () => {
      expect(buildApiPath('v1/nodes', undefined, 'ip-10-0-1-1.ec2.internal'))
        .toBe('/api/v1/nodes/ip-10-0-1-1.ec2.internal');
    });

    it('omits namespace segment when namespace is undefined', () => {
      const path = buildApiPath('apps/v1/deployments', undefined, 'nginx');
      expect(path).toBe('/apis/apps/v1/deployments/nginx');
      expect(path).not.toContain('namespaces');
    });

    it('treats "_" as cluster-scoped (no namespace segment)', () => {
      const path = buildApiPath('v1/nodes', '_', 'node-1');
      expect(path).toBe('/api/v1/nodes/node-1');
      expect(path).not.toContain('namespaces');
    });

    it('treats "_" as cluster-scoped for grouped resources', () => {
      const path = buildApiPath('config.openshift.io/v1/clusteroperators', '_', 'authentication');
      expect(path).toBe('/apis/config.openshift.io/v1/clusteroperators/authentication');
      expect(path).not.toContain('namespaces');
    });

    it('builds correct delete path for namespaced deployment', () => {
      const path = buildApiPath('apps/v1/deployments', 'default', 'nginx');
      expect(path).toBe('/apis/apps/v1/namespaces/default/deployments/nginx');
    });

    it('builds correct delete path for cluster-scoped resource via _', () => {
      const path = buildApiPath('rbac.authorization.k8s.io/v1/clusterroles', '_', 'admin');
      expect(path).toBe('/apis/rbac.authorization.k8s.io/v1/clusterroles/admin');
    });
  });
});

describe('buildApiPathFromResource', () => {
  it('builds path for namespaced core resource', () => {
    const path = buildApiPathFromResource({
      apiVersion: 'v1', kind: 'Pod',
      metadata: { name: 'nginx', namespace: 'default' },
    });
    expect(path).toBe('/api/v1/namespaces/default/pods/nginx');
  });

  it('builds path for namespaced grouped resource', () => {
    const path = buildApiPathFromResource({
      apiVersion: 'apps/v1', kind: 'Deployment',
      metadata: { name: 'my-app', namespace: 'production' },
    });
    expect(path).toBe('/apis/apps/v1/namespaces/production/deployments/my-app');
  });

  it('builds path for cluster-scoped resource', () => {
    const path = buildApiPathFromResource({
      apiVersion: 'v1', kind: 'Node',
      metadata: { name: 'worker-1' },
    });
    expect(path).toBe('/api/v1/nodes/worker-1');
  });

  it('builds path for CRD resource', () => {
    const path = buildApiPathFromResource({
      apiVersion: 'networking.k8s.io/v1', kind: 'Ingress',
      metadata: { name: 'my-ingress', namespace: 'default' },
    });
    expect(path).toBe('/apis/networking.k8s.io/v1/namespaces/default/ingresses/my-ingress');
  });

  it('matches buildApiPath output for deployments', () => {
    const fromResource = buildApiPathFromResource({
      apiVersion: 'apps/v1', kind: 'Deployment',
      metadata: { name: 'nginx', namespace: 'default' },
    });
    const fromGvr = buildApiPath('apps/v1/deployments', 'default', 'nginx');
    expect(fromResource).toBe(fromGvr);
  });

  it('matches buildApiPath output for cluster-scoped', () => {
    const fromResource = buildApiPathFromResource({
      apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'ClusterRole',
      metadata: { name: 'admin' },
    });
    const fromGvr = buildApiPath('rbac.authorization.k8s.io/v1/clusterroles', '_', 'admin');
    expect(fromResource).toBe(fromGvr);
  });
});
