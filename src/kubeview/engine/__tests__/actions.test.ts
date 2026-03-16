import { describe, it, expect, vi } from 'vitest';
import {
  getActionsForResource,
  getActionsByCategory,
  findAction,
  executeAction,
} from '../actions';
import type { ResourceType } from '../discovery';

function makeResourceType(overrides: Partial<ResourceType> = {}): ResourceType {
  return {
    group: '',
    version: 'v1',
    kind: 'Pod',
    plural: 'pods',
    singularName: 'pod',
    namespaced: true,
    verbs: ['get', 'list', 'create', 'update', 'delete', 'watch'],
    shortNames: [],
    categories: [],
    ...overrides,
  };
}

function makePod(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'test-pod', namespace: 'default' },
    status: { phase: 'Running' },
    ...overrides,
  };
}

function makeDeployment(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'test-deploy', namespace: 'default' },
    spec: { replicas: 3 },
    ...overrides,
  };
}

function makeNode(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: 'v1',
    kind: 'Node',
    metadata: { name: 'worker-1' },
    spec: {},
    ...overrides,
  };
}

const mockContext = {
  navigate: vi.fn(),
  addToast: vi.fn(),
  queryClient: {} as any,
  openDock: vi.fn(),
};

describe('getActionsForResource', () => {
  it('returns delete and edit-yaml for a pod with full verbs', () => {
    const pod = makePod();
    const rt = makeResourceType();
    const actions = getActionsForResource(pod, rt);
    const ids = actions.map((a) => a.id);

    expect(ids).toContain('delete');
    expect(ids).toContain('edit-yaml');
  });

  it('returns view-logs and open-terminal for running pod', () => {
    const pod = makePod({ status: { phase: 'Running' } });
    const rt = makeResourceType();
    const actions = getActionsForResource(pod, rt);
    const ids = actions.map((a) => a.id);

    expect(ids).toContain('view-logs');
    expect(ids).toContain('open-terminal');
  });

  it('returns view-logs but not open-terminal for non-running pod', () => {
    const pod = makePod({ status: { phase: 'Pending' } });
    const rt = makeResourceType();
    const actions = getActionsForResource(pod, rt);
    const ids = actions.map((a) => a.id);

    expect(ids).toContain('view-logs');
    expect(ids).not.toContain('open-terminal');
  });

  it('returns scale and restart-rollout for deployment', () => {
    const deploy = makeDeployment();
    const rt = makeResourceType({ kind: 'Deployment', plural: 'deployments', group: 'apps' });
    const actions = getActionsForResource(deploy, rt);
    const ids = actions.map((a) => a.id);

    expect(ids).toContain('scale');
    expect(ids).toContain('restart-rollout');
  });

  it('returns cordon for schedulable node', () => {
    const node = makeNode({ spec: { unschedulable: false } });
    const rt = makeResourceType({ kind: 'Node', plural: 'nodes', namespaced: false });
    const actions = getActionsForResource(node, rt);
    const ids = actions.map((a) => a.id);

    expect(ids).toContain('cordon');
    expect(ids).not.toContain('uncordon');
    expect(ids).toContain('drain');
  });

  it('returns uncordon for cordoned node', () => {
    const node = makeNode({ spec: { unschedulable: true } });
    const rt = makeResourceType({ kind: 'Node', plural: 'nodes', namespaced: false });
    const actions = getActionsForResource(node, rt);
    const ids = actions.map((a) => a.id);

    expect(ids).toContain('uncordon');
    expect(ids).not.toContain('cordon');
  });

  it('excludes delete when verbs do not include delete', () => {
    const pod = makePod();
    const rt = makeResourceType({ verbs: ['get', 'list'] });
    const actions = getActionsForResource(pod, rt);
    const ids = actions.map((a) => a.id);

    expect(ids).not.toContain('delete');
  });

  it('excludes edit-yaml when verbs do not include update', () => {
    const pod = makePod();
    const rt = makeResourceType({ verbs: ['get', 'list', 'delete'] });
    const actions = getActionsForResource(pod, rt);
    const ids = actions.map((a) => a.id);

    expect(ids).not.toContain('edit-yaml');
  });
});

describe('getActionsByCategory', () => {
  it('returns only danger actions', () => {
    const pod = makePod();
    const rt = makeResourceType();
    const actions = getActionsByCategory(pod, rt, 'danger');

    expect(actions.every((a) => a.category === 'danger')).toBe(true);
    expect(actions.some((a) => a.id === 'delete')).toBe(true);
  });

  it('returns only navigate actions', () => {
    const pod = makePod({ status: { phase: 'Running' } });
    const rt = makeResourceType();
    const actions = getActionsByCategory(pod, rt, 'navigate');

    expect(actions.every((a) => a.category === 'navigate')).toBe(true);
  });

  it('returns only quick actions for deployment', () => {
    const deploy = makeDeployment();
    const rt = makeResourceType({ kind: 'Deployment', plural: 'deployments', group: 'apps' });
    const actions = getActionsByCategory(deploy, rt, 'quick');

    expect(actions.every((a) => a.category === 'quick')).toBe(true);
    expect(actions.some((a) => a.id === 'scale')).toBe(true);
  });
});

describe('findAction', () => {
  it('finds an action by ID', () => {
    const pod = makePod();
    const rt = makeResourceType();
    const action = findAction(pod, rt, 'delete');

    expect(action).toBeDefined();
    expect(action!.id).toBe('delete');
  });

  it('returns undefined for unavailable action', () => {
    const pod = makePod();
    const rt = makeResourceType();
    const action = findAction(pod, rt, 'scale');

    // Scale is not available for pods
    expect(action).toBeUndefined();
  });

  it('returns undefined for non-existent action', () => {
    const pod = makePod();
    const rt = makeResourceType();
    const action = findAction(pod, rt, 'nonexistent');

    expect(action).toBeUndefined();
  });
});

describe('executeAction', () => {
  it('returns failure for unknown action', async () => {
    const pod = makePod();
    const rt = makeResourceType();
    const result = await executeAction(pod, rt, 'nonexistent', mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});
