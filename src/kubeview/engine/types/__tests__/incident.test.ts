import { describe, it, expect } from 'vitest';

import {
  computeFreshness,
  findingToIncident,
  prometheusAlertToIncident,
  trackedErrorToIncident,
  timelineEntryToIncident,
  fleetAlertToIncident,
  type PrometheusAlert,
  type FleetAlert,
} from '../incident';
import type { Finding } from '../../monitorClient';
import type { TimelineEntry } from '../timeline';
import type { TrackedError } from '../../../store/errorStore';

// Fixed "now" for deterministic freshness tests
const NOW = 1_700_000_000_000;

describe('computeFreshness', () => {
  it('returns "new" when age < 5 minutes', () => {
    expect(computeFreshness(NOW - 2 * 60 * 1000, NOW)).toBe('new');
  });

  it('returns "recent" when age >= 5 min and < 1 hour', () => {
    expect(computeFreshness(NOW - 30 * 60 * 1000, NOW)).toBe('recent');
  });

  it('returns "stale" when age >= 1 hour', () => {
    expect(computeFreshness(NOW - 2 * 60 * 60 * 1000, NOW)).toBe('stale');
  });

  it('returns "new" at exact boundary (0 ms age)', () => {
    expect(computeFreshness(NOW, NOW)).toBe('new');
  });

  it('returns "recent" at exact 5-min boundary', () => {
    expect(computeFreshness(NOW - 5 * 60 * 1000, NOW)).toBe('recent');
  });

  it('returns "stale" at exact 1-hour boundary', () => {
    expect(computeFreshness(NOW - 60 * 60 * 1000, NOW)).toBe('stale');
  });
});

describe('findingToIncident', () => {
  const finding: Finding = {
    id: 'f-1',
    severity: 'critical',
    category: 'cpu',
    title: 'High CPU',
    summary: 'CPU usage > 90%',
    resources: [{ kind: 'Pod', name: 'web-1', namespace: 'default' }],
    autoFixable: true,
    timestamp: NOW - 60_000,
  };

  it('maps all fields correctly', () => {
    const item = findingToIncident(finding, NOW);
    expect(item).toMatchObject({
      id: 'f-1',
      source: 'finding',
      severity: 'critical',
      title: 'High CPU',
      detail: 'CPU usage > 90%',
      timestamp: finding.timestamp,
      freshness: 'new',
      namespace: 'default',
      category: 'cpu',
    });
    expect(item.resources).toHaveLength(1);
    expect(item.raw).toBe(finding);
  });

  it('handles finding with no resources', () => {
    const bare: Finding = { ...finding, resources: [] };
    const item = findingToIncident(bare, NOW);
    expect(item.namespace).toBeUndefined();
    expect(item.resources).toHaveLength(0);
  });
});

describe('prometheusAlertToIncident', () => {
  const alert: PrometheusAlert = {
    labels: { alertname: 'KubePodCrashLooping', severity: 'warning', namespace: 'kube-system', pod: 'coredns-abc' },
    annotations: { description: 'Pod crash looping' },
    state: 'firing',
    activeAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
  };

  it('maps severity and freshness', () => {
    const item = prometheusAlertToIncident(alert, NOW);
    expect(item.severity).toBe('warning');
    expect(item.freshness).toBe('recent');
    expect(item.source).toBe('prometheus-alert');
  });

  it('extracts pod resource ref', () => {
    const item = prometheusAlertToIncident(alert, NOW);
    expect(item.resources).toEqual([{ kind: 'Pod', name: 'coredns-abc', namespace: 'kube-system' }]);
  });

  it('falls back to "info" for unknown severity', () => {
    const a = { ...alert, labels: { ...alert.labels, severity: 'notice' } };
    expect(prometheusAlertToIncident(a, NOW).severity).toBe('info');
  });

  it('uses now as timestamp when activeAt is missing', () => {
    const a: PrometheusAlert = { labels: { alertname: 'X' }, annotations: {}, state: 'firing' };
    const item = prometheusAlertToIncident(a, NOW);
    expect(item.timestamp).toBe(NOW);
    expect(item.freshness).toBe('new');
  });
});

describe('trackedErrorToIncident', () => {
  const err: TrackedError = {
    id: 'e-1',
    timestamp: NOW - 3 * 60 * 60 * 1000,
    category: 'server',
    message: 'Internal server error',
    userMessage: 'Something broke',
    statusCode: 500,
    operation: 'get',
    resourceKind: 'Deployment',
    resourceName: 'api',
    namespace: 'prod',
    suggestions: ['Retry later'],
    resolved: false,
  };

  it('maps 5xx to critical', () => {
    const item = trackedErrorToIncident(err, NOW);
    expect(item.severity).toBe('critical');
    expect(item.freshness).toBe('stale');
  });

  it('maps 4xx to warning', () => {
    const item = trackedErrorToIncident({ ...err, statusCode: 403 }, NOW);
    expect(item.severity).toBe('warning');
  });

  it('builds resource ref from kind/name/namespace', () => {
    const item = trackedErrorToIncident(err, NOW);
    expect(item.resources).toEqual([{ kind: 'Deployment', name: 'api', namespace: 'prod' }]);
  });

  it('omits resource ref when kind/name missing', () => {
    const e: TrackedError = { ...err, resourceKind: undefined, resourceName: undefined };
    expect(trackedErrorToIncident(e, NOW).resources).toHaveLength(0);
  });
});

describe('timelineEntryToIncident', () => {
  const entry: TimelineEntry = {
    id: 't-1',
    timestamp: new Date(NOW - 1000).toISOString(),
    category: 'alert',
    severity: 'critical',
    title: 'Alert fired',
    detail: 'Pod OOMKilled',
    namespace: 'default',
    resource: { apiVersion: 'v1', kind: 'Pod', name: 'web-0', namespace: 'default' },
    source: { type: 'prometheus' },
  };

  it('converts ISO timestamp to ms', () => {
    const item = timelineEntryToIncident(entry, NOW);
    expect(item.timestamp).toBeCloseTo(NOW - 1000, -2);
  });

  it('maps "normal" severity to "info"', () => {
    const e: TimelineEntry = { ...entry, severity: 'normal' };
    expect(timelineEntryToIncident(e, NOW).severity).toBe('info');
  });

  it('builds resource ref from entry.resource', () => {
    const item = timelineEntryToIncident(entry, NOW);
    expect(item.resources).toEqual([{ kind: 'Pod', name: 'web-0', namespace: 'default' }]);
  });

  it('returns empty resources when entry has no resource', () => {
    const e: TimelineEntry = { ...entry, resource: undefined };
    expect(timelineEntryToIncident(e, NOW).resources).toHaveLength(0);
  });

  it('prefers entry.namespace over resource.namespace', () => {
    const e: TimelineEntry = {
      ...entry,
      namespace: 'ns-a',
      resource: { apiVersion: 'v1', kind: 'Pod', name: 'x', namespace: 'ns-b' },
    };
    expect(timelineEntryToIncident(e, NOW).namespace).toBe('ns-a');
  });
});

describe('fleetAlertToIncident', () => {
  const alert: FleetAlert = {
    clusterId: 'c-1',
    clusterName: 'prod-east',
    alertName: 'NodeNotReady',
    severity: 'critical',
    namespace: 'openshift-monitoring',
    state: 'firing',
    activeAt: new Date(NOW - 120_000).toISOString(),
    labels: {},
    annotations: { description: 'Node is not ready' },
  };

  it('prefixes title with cluster name', () => {
    const item = fleetAlertToIncident(alert, NOW);
    expect(item.title).toBe('[prod-east] NodeNotReady');
  });

  it('sets source to fleet-alert', () => {
    expect(fleetAlertToIncident(alert, NOW).source).toBe('fleet-alert');
  });

  it('computes freshness from activeAt', () => {
    expect(fleetAlertToIncident(alert, NOW).freshness).toBe('new');
  });

  it('has empty resources array', () => {
    expect(fleetAlertToIncident(alert, NOW).resources).toHaveLength(0);
  });
});
